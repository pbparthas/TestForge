/**
 * SSRF protection utilities (SEC-009 remediation).
 * Validates URLs to prevent server-side request forgery attacks.
 */

import { ValidationError } from '../errors/index.js';

const PRIVATE_IP_PATTERNS = [
  /^127\./, // 127.0.0.0/8 (loopback)
  /^10\./, // 10.0.0.0/8 (Class A private)
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12 (Class B private)
  /^192\.168\./, // 192.168.0.0/16 (Class C private)
  /^169\.254\./, // 169.254.0.0/16 (link-local, AWS metadata)
  /^0\.0\.0\.0$/, // Unspecified
  /^::1$/, // IPv6 loopback
  /^localhost$/i, // localhost hostname
];

/**
 * Check if a hostname or IP address is a private/internal address.
 */
export function isPrivateIP(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some(pattern => pattern.test(hostname));
}

/**
 * Get the SSRF allowlist from environment variable.
 * Returns a Set of explicitly allowed hostnames/IPs.
 */
function getAllowlist(): Set<string> {
  const hosts = process.env['SSRF_ALLOWED_HOSTS'];
  if (!hosts) return new Set();
  return new Set(hosts.split(',').map(h => h.trim()).filter(Boolean));
}

// Metadata endpoint is NEVER allowlisted
const METADATA_PATTERN = /^169\.254\./;

/**
 * Validate that a URL points to an external (non-private) host.
 * Supports an allowlist via SSRF_ALLOWED_HOSTS env var for legitimate internal services.
 * Always blocks cloud metadata endpoints (169.254.x.x) regardless of allowlist.
 * Returns a parsed URL object if valid.
 */
export function validateExternalUrl(urlString: string): URL {
  if (!urlString) {
    throw new ValidationError('URL cannot be empty');
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new ValidationError(`Invalid URL: ${urlString}`);
  }

  // Only allow http and https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError(`Invalid URL protocol: ${parsed.protocol}. Only http and https are allowed.`);
  }

  const hostname = parsed.hostname;

  // Metadata endpoints are NEVER allowed (even with allowlist)
  if (METADATA_PATTERN.test(hostname)) {
    throw new ValidationError('Access to cloud metadata endpoints is blocked');
  }

  // Check if hostname is private
  if (isPrivateIP(hostname)) {
    // Check allowlist
    const allowlist = getAllowlist();
    if (!allowlist.has(hostname)) {
      throw new ValidationError(`Access to private/internal address is blocked: ${hostname}`);
    }
  }

  return parsed;
}
