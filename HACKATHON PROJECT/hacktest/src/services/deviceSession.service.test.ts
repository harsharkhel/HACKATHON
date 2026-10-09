import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseDeviceMetadata } from './deviceSession.service';

describe('parseDeviceMetadata', () => {
  it('identifies mobile browser and operating system without returning an unbounded user agent', () => {
    const metadata = parseDeviceMetadata(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
    );

    assert.equal(metadata.deviceType, 'mobile');
    assert.equal(metadata.browser, 'Safari');
    assert.equal(metadata.operatingSystem, 'iOS');
  });

  it('prefers Edge over its Chromium compatibility signature', () => {
    const metadata = parseDeviceMetadata(
      'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    );

    assert.equal(metadata.browser, 'Edge');
    assert.equal(metadata.operatingSystem, 'Windows');
  });

  it('bounds stored user-agent strings and handles missing values', () => {
    assert.equal(parseDeviceMetadata('x'.repeat(600)).userAgent?.length, 512);
    assert.equal(parseDeviceMetadata(null).userAgent, null);
  });
});
