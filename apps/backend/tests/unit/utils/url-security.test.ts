/**
 * Unit tests for SSRF protection utility (SEC-009)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isPrivateIP, validateExternalUrl } from '../../../src/utils/url-security.js';
import { ValidationError } from '../../../src/errors/index.js';

describe('isPrivateIP', () => {
  // Loopback
  it('should detect 127.0.0.1 as private', () => {
    expect(isPrivateIP('127.0.0.1')).toBe(true);
  });

  it('should detect 127.x.x.x range as private', () => {
    expect(isPrivateIP('127.0.0.2')).toBe(true);
    expect(isPrivateIP('127.255.255.255')).toBe(true);
  });

  // 10.x.x.x (Class A private)
  it('should detect 10.x.x.x as private', () => {
    expect(isPrivateIP('10.0.0.1')).toBe(true);
    expect(isPrivateIP('10.255.255.255')).toBe(true);
  });

  // 172.16-31.x.x (Class B private)
  it('should detect 172.16-31.x.x as private', () => {
    expect(isPrivateIP('172.16.0.1')).toBe(true);
    expect(isPrivateIP('172.31.255.255')).toBe(true);
  });

  it('should NOT detect 172.15.x.x as private', () => {
    expect(isPrivateIP('172.15.0.1')).toBe(false);
  });

  it('should NOT detect 172.32.x.x as private', () => {
    expect(isPrivateIP('172.32.0.1')).toBe(false);
  });

  // 192.168.x.x (Class C private)
  it('should detect 192.168.x.x as private', () => {
    expect(isPrivateIP('192.168.0.1')).toBe(true);
    expect(isPrivateIP('192.168.255.255')).toBe(true);
  });

  // Link-local / metadata
  it('should detect 169.254.x.x (link-local/metadata) as private', () => {
    expect(isPrivateIP('169.254.169.254')).toBe(true);
    expect(isPrivateIP('169.254.0.1')).toBe(true);
  });

  // Special addresses
  it('should detect 0.0.0.0 as private', () => {
    expect(isPrivateIP('0.0.0.0')).toBe(true);
  });

  it('should detect localhost as private', () => {
    expect(isPrivateIP('localhost')).toBe(true);
  });

  // IPv6
  it('should detect ::1 (IPv6 loopback) as private', () => {
    expect(isPrivateIP('::1')).toBe(true);
  });

  // Public IPs
  it('should NOT detect public IPs as private', () => {
    expect(isPrivateIP('8.8.8.8')).toBe(false);
    expect(isPrivateIP('1.1.1.1')).toBe(false);
    expect(isPrivateIP('203.0.113.1')).toBe(false);
    expect(isPrivateIP('54.239.28.85')).toBe(false);
  });

  // Hostnames
  it('should NOT detect public hostnames as private', () => {
    expect(isPrivateIP('google.com')).toBe(false);
    expect(isPrivateIP('jenkins.example.com')).toBe(false);
  });
});

describe('validateExternalUrl', () => {
  it('should return URL object for valid external URLs', () => {
    const result = validateExternalUrl('https://jenkins.example.com/api/json');
    expect(result).toBeInstanceOf(URL);
    expect(result.hostname).toBe('jenkins.example.com');
  });

  it('should reject URLs pointing to localhost', () => {
    expect(() => validateExternalUrl('http://localhost:8080')).toThrow(ValidationError);
    expect(() => validateExternalUrl('http://127.0.0.1:8080')).toThrow(ValidationError);
  });

  it('should reject URLs pointing to private IP ranges', () => {
    expect(() => validateExternalUrl('http://10.0.0.1:8080')).toThrow(ValidationError);
    expect(() => validateExternalUrl('http://192.168.1.1:8080')).toThrow(ValidationError);
    expect(() => validateExternalUrl('http://172.16.0.1:8080')).toThrow(ValidationError);
  });

  it('should reject cloud metadata endpoint', () => {
    expect(() => validateExternalUrl('http://169.254.169.254/latest/meta-data')).toThrow(ValidationError);
  });

  it('should reject invalid URLs', () => {
    expect(() => validateExternalUrl('not-a-url')).toThrow(ValidationError);
    expect(() => validateExternalUrl('')).toThrow(ValidationError);
  });

  it('should reject non-http protocols', () => {
    expect(() => validateExternalUrl('ftp://files.example.com')).toThrow(ValidationError);
    expect(() => validateExternalUrl('file:///etc/passwd')).toThrow(ValidationError);
  });

  it('should allow http and https protocols', () => {
    expect(validateExternalUrl('http://jenkins.example.com')).toBeInstanceOf(URL);
    expect(validateExternalUrl('https://jenkins.example.com')).toBeInstanceOf(URL);
  });

  describe('with SSRF_ALLOWED_HOSTS', () => {
    beforeEach(() => {
      process.env['SSRF_ALLOWED_HOSTS'] = '10.0.0.5,192.168.1.100';
    });

    afterEach(() => {
      delete process.env['SSRF_ALLOWED_HOSTS'];
    });

    it('should allow explicitly allowlisted private IPs', () => {
      const result = validateExternalUrl('http://10.0.0.5:8080/api');
      expect(result).toBeInstanceOf(URL);
    });

    it('should still reject non-allowlisted private IPs', () => {
      expect(() => validateExternalUrl('http://10.0.0.6:8080')).toThrow(ValidationError);
    });

    it('should still reject metadata endpoint even with allowlist', () => {
      expect(() => validateExternalUrl('http://169.254.169.254')).toThrow(ValidationError);
    });
  });
});
