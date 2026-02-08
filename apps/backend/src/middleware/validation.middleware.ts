/**
 * Shared request validation middleware using Zod schemas.
 * Replaces inline validate() functions duplicated across route files.
 */

import type { z } from 'zod';
import { ValidationError } from '../errors/index.js';

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    throw new ValidationError('Validation failed', errors);
  }
  return result.data;
}
