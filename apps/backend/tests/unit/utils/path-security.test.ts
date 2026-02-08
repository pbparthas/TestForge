/**
 * Unit tests for path sanitization utility (SEC-001)
 */

import { describe, it, expect } from 'vitest';
import path from 'path';
import { sanitizePath, validateBasePath } from '../../../src/utils/path-security.js';
import { ValidationError } from '../../../src/errors/index.js';

describe('sanitizePath', () => {
  it('should allow simple relative paths', () => {
    expect(sanitizePath('file.txt')).toBe('file.txt');
    expect(sanitizePath('dir/file.txt')).toBe('dir/file.txt');
    expect(sanitizePath('dir/subdir/file.txt')).toBe('dir/subdir/file.txt');
  });

  it('should reject paths with ../ traversal', () => {
    expect(() => sanitizePath('../etc/passwd')).toThrow(ValidationError);
    expect(() => sanitizePath('dir/../../etc/passwd')).toThrow(ValidationError);
    expect(() => sanitizePath('a/../../../etc/shadow')).toThrow(ValidationError);
  });

  it('should reject paths with encoded traversal sequences', () => {
    expect(() => sanitizePath('..%2Fetc%2Fpasswd')).toThrow(ValidationError);
    expect(() => sanitizePath('..%2f..%2fetc%2fpasswd')).toThrow(ValidationError);
    expect(() => sanitizePath('%2e%2e/etc/passwd')).toThrow(ValidationError);
    expect(() => sanitizePath('%2e%2e%2fetc%2fpasswd')).toThrow(ValidationError);
  });

  it('should reject absolute paths', () => {
    expect(() => sanitizePath('/etc/passwd')).toThrow(ValidationError);
    expect(() => sanitizePath('/root/.ssh/id_rsa')).toThrow(ValidationError);
  });

  it('should reject null bytes', () => {
    expect(() => sanitizePath('file.txt\0.jpg')).toThrow(ValidationError);
    expect(() => sanitizePath('file%00.txt')).toThrow(ValidationError);
  });

  it('should reject backslash traversal (Windows-style)', () => {
    expect(() => sanitizePath('..\\etc\\passwd')).toThrow(ValidationError);
    expect(() => sanitizePath('dir\\..\\..\\etc')).toThrow(ValidationError);
  });

  it('should normalize redundant separators', () => {
    const result = sanitizePath('dir//file.txt');
    expect(result).toBe('dir/file.txt');
  });

  it('should handle paths with dots in filenames (not traversal)', () => {
    expect(sanitizePath('file.test.txt')).toBe('file.test.txt');
    expect(sanitizePath('.gitignore')).toBe('.gitignore');
    expect(sanitizePath('dir/.env.local')).toBe('dir/.env.local');
  });
});

describe('validateBasePath', () => {
  const allowedBase = '/testforge-workspace/reports';

  it('should return resolved path within allowed base', () => {
    const result = validateBasePath('report.pdf', allowedBase);
    expect(result).toBe(path.join(allowedBase, 'report.pdf'));
  });

  it('should return resolved path for nested subdirectories', () => {
    const result = validateBasePath('2024/jan/report.pdf', allowedBase);
    expect(result).toBe(path.join(allowedBase, '2024/jan/report.pdf'));
  });

  it('should reject paths that escape the base directory', () => {
    expect(() => validateBasePath('../../../etc/passwd', allowedBase)).toThrow(ValidationError);
  });

  it('should reject absolute paths that are outside base', () => {
    expect(() => validateBasePath('/etc/passwd', allowedBase)).toThrow(ValidationError);
  });

  it('should allow absolute paths that are within the base', () => {
    const absPath = path.join(allowedBase, 'report.pdf');
    const result = validateBasePath(absPath, allowedBase);
    expect(result).toBe(absPath);
  });

  it('should reject paths that resolve outside base via symlink-style traversal', () => {
    expect(() => validateBasePath('subdir/../../etc/passwd', allowedBase)).toThrow(ValidationError);
  });

  it('should reject encoded traversal attempts', () => {
    expect(() => validateBasePath('..%2F..%2Fetc%2Fpasswd', allowedBase)).toThrow(ValidationError);
  });
});
