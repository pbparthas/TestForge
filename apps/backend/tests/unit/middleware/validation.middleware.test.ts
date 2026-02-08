/**
 * Unit tests for shared validate middleware
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validate } from '../../../src/middleware/validation.middleware.js';
import { ValidationError } from '../../../src/errors/index.js';

describe('validate', () => {
  const testSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    age: z.number().int().positive().optional(),
  });

  it('should return parsed data for valid input', () => {
    const input = { name: 'Test', email: 'test@example.com' };
    const result = validate(testSchema, input);

    expect(result).toEqual(input);
  });

  it('should return parsed data with optional fields', () => {
    const input = { name: 'Test', email: 'test@example.com', age: 25 };
    const result = validate(testSchema, input);

    expect(result).toEqual(input);
  });

  it('should strip unknown fields', () => {
    const input = { name: 'Test', email: 'test@example.com', extra: 'field' };
    const result = validate(testSchema, input);

    expect(result).toEqual({ name: 'Test', email: 'test@example.com' });
    expect((result as Record<string, unknown>)['extra']).toBeUndefined();
  });

  it('should throw ValidationError for missing required fields', () => {
    const input = { email: 'test@example.com' };

    expect(() => validate(testSchema, input)).toThrow(ValidationError);
  });

  it('should throw ValidationError for invalid email', () => {
    const input = { name: 'Test', email: 'not-an-email' };

    expect(() => validate(testSchema, input)).toThrow(ValidationError);
  });

  it('should include field-level error details', () => {
    const input = {};

    try {
      validate(testSchema, input);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const validationErr = err as ValidationError;
      expect(validationErr.details).toBeInstanceOf(Array);
      const details = validationErr.details as Array<{ field: string; message: string }>;
      expect(details.length).toBeGreaterThan(0);
      expect(details[0]).toHaveProperty('field');
      expect(details[0]).toHaveProperty('message');
    }
  });

  it('should map nested field paths correctly', () => {
    const nestedSchema = z.object({
      address: z.object({
        city: z.string().min(1),
      }),
    });

    try {
      validate(nestedSchema, { address: { city: '' } });
      expect.fail('Should have thrown');
    } catch (err) {
      const validationErr = err as ValidationError;
      const details = validationErr.details as Array<{ field: string; message: string }>;
      expect(details[0]?.field).toBe('address.city');
    }
  });

  it('should throw ValidationError with message "Validation failed"', () => {
    try {
      validate(testSchema, {});
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).message).toBe('Validation failed');
    }
  });
});
