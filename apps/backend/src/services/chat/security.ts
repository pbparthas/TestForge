/**
 * Chat Security Utilities
 * Jailbreak detection and input sanitization for the chat service
 */

// Jailbreak detection patterns (security)
export const JAILBREAK_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /you\s+are\s+now\s+(DAN|jailbroken|unrestricted)/i,
  /pretend\s+(you\s+)?(have\s+)?no\s+restrictions/i,
  /system:\s*override/i,
  /forget\s+(your\s+)?rules/i,
  /bypass\s+(your\s+)?safety/i,
  /disable\s+(your\s+)?ethics/i,
  /act\s+as\s+if\s+you\s+have\s+no\s+guidelines/i,
];

/**
 * Detect jailbreak/prompt injection attempts
 */
export function detectJailbreak(content: string): boolean {
  return JAILBREAK_PATTERNS.some(pattern => pattern.test(content));
}

/**
 * Sanitize user input (strip HTML, trim, limit length)
 */
export function sanitizeInput(content: string): string {
  // Remove HTML tags
  let sanitized = content.replace(/<[^>]*>/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length
  if (sanitized.length > 5000) {
    sanitized = sanitized.substring(0, 5000);
  }

  return sanitized;
}
