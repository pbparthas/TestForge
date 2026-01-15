/**
 * Shared utilities for TestForge
 */

/**
 * Generate a random ID (for testing/mocking purposes)
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: 'USD' | 'INR'): string {
  const formatter = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
  });
  return formatter.format(amount);
}

/**
 * Convert USD to INR (approximate rate)
 */
export function usdToInr(usd: number, rate = 83): number {
  return usd * rate;
}

/**
 * Truncate string to max length
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Sleep for given milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if value is not null or undefined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Create a type-safe omit function
 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/**
 * Create a type-safe pick function
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}
