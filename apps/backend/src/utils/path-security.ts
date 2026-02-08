/**
 * Path sanitization utilities (SEC-001 remediation).
 * Prevents directory traversal attacks on file operation endpoints.
 */

import path from 'path';
import { ValidationError } from '../errors/index.js';

const TRAVERSAL_PATTERNS = [
  /\.\.[/\\]/, // ../  or ..\
  /[/\\]\.\.$/, // trailing /.. or \..
  /^\.\.$/, // bare ..
  /%2e%2e/i, // URL-encoded ..
  /%2f/i, // URL-encoded /
  /%5c/i, // URL-encoded \
  /\0/, // null bytes
  /%00/, // URL-encoded null byte
];

/**
 * Sanitize a user-supplied path, ensuring it's a safe relative path.
 * Rejects absolute paths, traversal sequences (including encoded), and null bytes.
 * Returns a normalized relative path.
 */
export function sanitizePath(userPath: string): string {
  if (!userPath) {
    throw new ValidationError('Path cannot be empty');
  }

  // Check for encoded traversal before decoding
  for (const pattern of TRAVERSAL_PATTERNS) {
    if (pattern.test(userPath)) {
      throw new ValidationError('Path contains forbidden sequences');
    }
  }

  // Reject absolute paths
  if (path.isAbsolute(userPath)) {
    throw new ValidationError('Absolute paths are not allowed');
  }

  // Normalize and verify no traversal after normalization
  const normalized = path.normalize(userPath);

  if (normalized.startsWith('..') || normalized.includes(`${path.sep}..`)) {
    throw new ValidationError('Path traversal is not allowed');
  }

  // Convert backslashes to forward slashes for consistency
  return normalized.split(path.sep).join('/');
}

/**
 * Validate that a user-supplied path resolves within an allowed base directory.
 * Returns the full resolved path if valid.
 */
export function validateBasePath(userPath: string, allowedBase: string): string {
  if (!userPath) {
    throw new ValidationError('Path cannot be empty');
  }

  // Check for encoded traversal sequences
  for (const pattern of TRAVERSAL_PATTERNS) {
    if (pattern.test(userPath)) {
      throw new ValidationError('Path contains forbidden sequences');
    }
  }

  // Resolve the full path
  let resolvedPath: string;
  if (path.isAbsolute(userPath)) {
    resolvedPath = path.resolve(userPath);
  } else {
    resolvedPath = path.resolve(allowedBase, userPath);
  }

  // Ensure resolved path starts with the allowed base
  const normalizedBase = path.resolve(allowedBase);
  if (!resolvedPath.startsWith(normalizedBase + path.sep) && resolvedPath !== normalizedBase) {
    throw new ValidationError('Path is outside the allowed directory');
  }

  return resolvedPath;
}
