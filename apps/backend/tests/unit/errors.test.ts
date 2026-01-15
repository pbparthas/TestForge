/**
 * Error classes tests
 * TDD: These tests define the expected behavior of our error classes
 */

import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
} from '../../src/errors/index.js';

describe('AppError', () => {
  it('should create an error with code, message, and statusCode', () => {
    const error = new AppError('TEST_ERROR', 'Test message', 400);

    expect(error.code).toBe('TEST_ERROR');
    expect(error.message).toBe('Test message');
    expect(error.statusCode).toBe(400);
    expect(error.isOperational).toBe(true);
    expect(error.name).toBe('AppError');
  });

  it('should default to 500 status code', () => {
    const error = new AppError('TEST_ERROR', 'Test message');

    expect(error.statusCode).toBe(500);
  });

  it('should include details when provided', () => {
    const details = { field: 'email', reason: 'invalid format' };
    const error = new AppError('TEST_ERROR', 'Test message', 400, details);

    expect(error.details).toEqual(details);
  });

  it('should be an instance of Error', () => {
    const error = new AppError('TEST_ERROR', 'Test message');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });
});

describe('ValidationError', () => {
  it('should create a 400 error with VALIDATION_ERROR code', () => {
    const error = new ValidationError('Invalid input');

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Invalid input');
    expect(error.name).toBe('ValidationError');
  });

  it('should include validation details', () => {
    const details = [
      { field: 'email', message: 'Required' },
      { field: 'password', message: 'Too short' },
    ];
    const error = new ValidationError('Invalid input', details);

    expect(error.details).toEqual(details);
  });
});

describe('NotFoundError', () => {
  it('should create a 404 error with resource name and id', () => {
    const error = new NotFoundError('User', '123');

    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("User with id '123' not found");
    expect(error.name).toBe('NotFoundError');
  });

  it('should create a 404 error with just resource name', () => {
    const error = new NotFoundError('User');

    expect(error.message).toBe('User not found');
  });
});

describe('UnauthorizedError', () => {
  it('should create a 401 error', () => {
    const error = new UnauthorizedError();

    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Unauthorized');
    expect(error.name).toBe('UnauthorizedError');
  });

  it('should accept custom message', () => {
    const error = new UnauthorizedError('Invalid token');

    expect(error.message).toBe('Invalid token');
  });
});

describe('ForbiddenError', () => {
  it('should create a 403 error', () => {
    const error = new ForbiddenError();

    expect(error.code).toBe('FORBIDDEN');
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe('Forbidden');
    expect(error.name).toBe('ForbiddenError');
  });

  it('should accept custom message', () => {
    const error = new ForbiddenError('Admin access required');

    expect(error.message).toBe('Admin access required');
  });
});

describe('ConflictError', () => {
  it('should create a 409 error', () => {
    const error = new ConflictError('Email already exists');

    expect(error.code).toBe('CONFLICT');
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe('Email already exists');
    expect(error.name).toBe('ConflictError');
  });

  it('should include conflict details', () => {
    const details = { existingId: '456' };
    const error = new ConflictError('Duplicate entry', details);

    expect(error.details).toEqual(details);
  });
});

describe('RateLimitError', () => {
  it('should create a 429 error', () => {
    const error = new RateLimitError();

    expect(error.code).toBe('RATE_LIMIT');
    expect(error.statusCode).toBe(429);
    expect(error.message).toBe('Too many requests');
    expect(error.name).toBe('RateLimitError');
  });
});

describe('ExternalServiceError', () => {
  it('should create a 502 error with service name', () => {
    const error = new ExternalServiceError('Anthropic API', 'Request failed');

    expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
    expect(error.statusCode).toBe(502);
    expect(error.message).toBe('Anthropic API: Request failed');
    expect(error.name).toBe('ExternalServiceError');
  });

  it('should include service details', () => {
    const details = { responseCode: 500, body: 'Internal error' };
    const error = new ExternalServiceError('Bugzilla', 'Connection failed', details);

    expect(error.details).toEqual(details);
  });
});
