import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { env } from '../config/env';
import { BadRequestError } from '../utils/errors';

const blockedIPv4 = new BlockList();
[
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
].forEach(([address, prefix]) => {
  blockedIPv4.addSubnet(address as string, prefix as number, 'ipv4');
});

const blockedIPv6 = new BlockList();
[
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
].forEach(([address, prefix]) => {
  blockedIPv6.addSubnet(address as string, prefix as number, 'ipv6');
});

const blockedHostnameSuffixes = [
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.home',
  '.test',
  '.invalid',
  '.localdomain',
  '.metadata.google.internal',
];

const blockedHostnames = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'metadata.azure.internal',
  'metadata.azure.com',
  'instance-data',
]);

const invalidTarget = (): BadRequestError =>
  new BadRequestError('Project URL must be a valid publicly reachable HTTP(S) URL', 'INVALID_PROJECT_URL');

const removeIPv6Brackets = (address: string): string =>
  address.startsWith('[') && address.endsWith(']') ? address.slice(1, -1) : address;

const ipv6Value = (address: string): bigint => {
  const normalized = address.toLowerCase();
  const halves = normalized.split('::');
  const parseHalf = (half: string): string[] => half ? half.split(':') : [];
  const left = parseHalf(halves[0]);
  const right = parseHalf(halves[1] ?? '');

  const lastGroup = right.length > 0 ? right[right.length - 1] : left[left.length - 1];
  if (lastGroup?.includes('.')) {
    const octets = lastGroup.split('.').map(Number);
    const ipv4Tail = [
      ((octets[0] << 8) | octets[1]).toString(16),
      ((octets[2] << 8) | octets[3]).toString(16),
    ];
    if (right.length > 0) right.splice(right.length - 1, 1, ...ipv4Tail);
    else left.splice(left.length - 1, 1, ...ipv4Tail);
  }

  const explicit = [...left, ...right];
  const zeroCount = 8 - explicit.length;
  const groups = halves.length === 2
    ? [...left, ...Array<string>(zeroCount).fill('0'), ...right]
    : explicit;

  return groups.reduce((value, group) => (value << 16n) | BigInt(`0x${group || '0'}`), 0n);
};

const isWithinIPv6Cidr = (address: bigint, network: bigint, prefix: bigint): boolean => {
  const shift = 128n - prefix;
  return (address >> shift) === (network >> shift);
};

export const isPrivateAddress = (ip: string): boolean => {
  const address = removeIPv6Brackets(ip);
  const family = isIP(address);

  if (family === 4) {
    return blockedIPv4.check(address, 'ipv4');
  }

  if (family !== 6) {
    return true;
  }

  const value = ipv6Value(address);
  const mappedNetwork = ipv6Value('::ffff:0:0');
  if ((value >> 32n) === (mappedNetwork >> 32n)) {
    const ipv4 = Number(value & 0xffffffffn);
    return isPrivateAddress([
      (ipv4 >>> 24) & 0xff,
      (ipv4 >>> 16) & 0xff,
      (ipv4 >>> 8) & 0xff,
      ipv4 & 0xff,
    ].join('.'));
  }

  const globalUnicast = isWithinIPv6Cidr(value, ipv6Value('2000::'), 3n);
  return !globalUnicast || blockedIPv6.check(address, 'ipv6');
};

export const validateTargetUrl = (input: string): string => {
  if (typeof input !== 'string' || input.length === 0 || input.length > 2048) {
    throw invalidTarget();
  }

  let target: URL;
  try {
    target = new URL(input.trim());
  } catch {
    throw invalidTarget();
  }

  if (
    target.protocol !== 'https:' &&
    !(env.ALLOW_HTTP_TARGETS && target.protocol === 'http:')
  ) {
    throw invalidTarget();
  }

  if (target.username || target.password) {
    throw invalidTarget();
  }

  const hostname = target.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname || blockedHostnames.has(hostname) || blockedHostnameSuffixes.some((suffix) => hostname.endsWith(suffix))) {
    throw invalidTarget();
  }

  const hostnameForIpCheck = removeIPv6Brackets(hostname);
  if (isIP(hostnameForIpCheck) !== 0 && isPrivateAddress(hostnameForIpCheck)) {
    throw invalidTarget();
  }

  target.hostname = hostname;
  target.hash = '';
  return target.toString();
};

export interface ResolvedTarget {
  url: string;
  addresses: Array<{ address: string; family: 4 | 6 }>;
}

export const resolveAndValidateTarget = async (input: string): Promise<ResolvedTarget> => {
  const url = validateTargetUrl(input);
  const target = new URL(url);

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(removeIPv6Brackets(target.hostname), { all: true, verbatim: true });
  } catch {
    throw invalidTarget();
  }

  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw invalidTarget();
  }

  return {
    url,
    addresses: addresses.map(({ address, family }) => ({
      address,
      family: family as 4 | 6,
    })),
  };
};

export const resolveRedirectTarget = async (
  currentUrl: string,
  location: string,
): Promise<ResolvedTarget> => {
  let redirectUrl: string;
  try {
    redirectUrl = new URL(location, validateTargetUrl(currentUrl)).toString();
  } catch {
    throw invalidTarget();
  }

  return resolveAndValidateTarget(redirectUrl);
};
