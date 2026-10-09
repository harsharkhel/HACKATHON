import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { env } from '../config/env';
import {
  isPrivateAddress,
  resolveRedirectTarget,
  resolveAndValidateTarget,
  validateTargetUrl,
} from './urlSecurityService';

describe('isPrivateAddress', () => {
  it('blocks private, loopback, link-local, reserved, and malformed IPv4 addresses', () => {
    for (const address of [
      '0.0.0.0',
      '10.0.0.1',
      '100.64.1.1',
      '127.0.0.1',
      '169.254.169.254',
      '172.16.0.1',
      '192.168.1.1',
      '198.18.0.1',
      '224.0.0.1',
      'not-an-ip',
    ]) {
      assert.equal(isPrivateAddress(address), true, address);
    }

    assert.equal(isPrivateAddress('8.8.8.8'), false);
  });

  it('blocks non-global IPv6 and IPv4-mapped private addresses', () => {
    for (const address of [
      '::',
      '::1',
      'fc00::1',
      'fd00:ec2::254',
      'fe80::1',
      'ff02::1',
      '2001:db8::1',
      '::ffff:127.0.0.1',
    ]) {
      assert.equal(isPrivateAddress(address), true, address);
    }

    assert.equal(isPrivateAddress('2606:4700:4700::1111'), false);
  });
});

describe('validateTargetUrl', () => {
  it('normalizes a public URL and removes fragments', () => {
    assert.equal(
      validateTargetUrl(' HTTPS://Example.COM:443/project?q=1#section '),
      'https://example.com/project?q=1',
    );
  });

  it('rejects dangerous protocols, credentials, malformed URLs, and local targets', () => {
    for (const url of [
      'file:///etc/passwd',
      'ftp://example.com',
      'gopher://example.com',
      'https://user:password@example.com',
      'https://localhost',
      'https://app.localhost',
      'https://metadata.google.internal',
      'https://127.0.0.1',
      'https://0177.0.0.1',
      'https://10.20.30.40',
      'https://169.254.169.254/latest/meta-data/',
      'https://[::1]',
      'https://[fd00::1]',
      'https://[::ffff:127.0.0.1]',
      'not a URL',
      'https://',
    ]) {
      assert.throws(() => validateTargetUrl(url), { code: 'INVALID_PROJECT_URL' }, url);
    }
  });

  it('allows plain HTTP only when enabled explicitly', () => {
    if (env.ALLOW_HTTP_TARGETS) {
      assert.equal(validateTargetUrl('http://example.com'), 'http://example.com/');
    } else {
      assert.throws(
        () => validateTargetUrl('http://example.com'),
        { code: 'INVALID_PROJECT_URL' },
      );
    }
  });

  it('does not resolve or permit local hostnames as public targets', async () => {
    await assert.rejects(
      resolveAndValidateTarget('https://localhost'),
      { code: 'INVALID_PROJECT_URL' },
    );
  });

  it('returns checked addresses for callers to pin at connection time', async () => {
    const target = await resolveAndValidateTarget('https://1.1.1.1/');
    assert.equal(target.url, 'https://1.1.1.1/');
    assert.deepEqual(target.addresses, [{ address: '1.1.1.1', family: 4 }]);
  });

  it('rejects redirects that target loopback or private addresses', async () => {
    await assert.rejects(
      resolveRedirectTarget('https://1.1.1.1/start', 'https://127.0.0.1/admin'),
      { code: 'INVALID_PROJECT_URL' },
    );

    await assert.rejects(
      resolveRedirectTarget('https://1.1.1.1/start', '//169.254.169.254/latest/meta-data/'),
      { code: 'INVALID_PROJECT_URL' },
    );
  });
});
