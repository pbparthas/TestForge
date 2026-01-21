/**
 * Encryption Utility Tests
 * TDD for AES-256 encryption/decryption
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt, generateKey } from '../../../src/utils/encryption.js';

describe('Encryption Utility', () => {
  let testKey: string;

  beforeAll(() => {
    // Generate a test key
    testKey = generateKey();
  });

  describe('generateKey', () => {
    it('should generate a 32-byte key in hex format (64 chars)', () => {
      const key = generateKey();
      expect(key).toBeDefined();
      expect(key).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(/^[a-f0-9]+$/.test(key)).toBe(true);
    });

    it('should generate unique keys each time', () => {
      const key1 = generateKey();
      const key2 = generateKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('encrypt', () => {
    it('should encrypt plaintext and return a string', () => {
      const plaintext = 'my-secret-api-token';
      const encrypted = encrypt(plaintext, testKey);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext);
    });

    it('should include IV in the encrypted output', () => {
      const plaintext = 'test-data';
      const encrypted = encrypt(plaintext, testKey);

      // Format: iv:encryptedData (both in hex)
      expect(encrypted).toContain(':');
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(2);
      expect(parts[0]).toHaveLength(32); // 16 bytes IV = 32 hex chars
    });

    it('should produce different ciphertext each time (random IV)', () => {
      const plaintext = 'same-plaintext';
      const encrypted1 = encrypt(plaintext, testKey);
      const encrypted2 = encrypt(plaintext, testKey);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw error for empty plaintext', () => {
      expect(() => encrypt('', testKey)).toThrow('Plaintext cannot be empty');
    });

    it('should throw error for invalid key length', () => {
      expect(() => encrypt('test', 'short-key')).toThrow('Invalid key length');
    });
  });

  describe('decrypt', () => {
    it('should decrypt ciphertext back to original plaintext', () => {
      const plaintext = 'my-secret-api-token-12345';
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = 'token@#$%^&*()_+{}|:"<>?';
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'token-🔐-秘密-κρυπτό';
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'a'.repeat(1000);
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for invalid ciphertext format', () => {
      expect(() => decrypt('invalid-no-colon', testKey)).toThrow('Invalid ciphertext format');
    });

    it('should throw error for wrong key', () => {
      const plaintext = 'secret-data';
      const encrypted = encrypt(plaintext, testKey);
      const wrongKey = generateKey();

      expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });

    it('should throw error for tampered ciphertext', () => {
      const plaintext = 'secret-data';
      const encrypted = encrypt(plaintext, testKey);
      const [iv, data] = encrypted.split(':');
      const tampered = iv + ':' + 'ff' + data.slice(2);

      expect(() => decrypt(tampered, testKey)).toThrow();
    });
  });

  describe('round-trip encryption', () => {
    it('should encrypt and decrypt API tokens correctly', () => {
      const tokens = [
        'jenkins-api-token-abc123',
        '11a1b2c3d4e5f6g7h8i9j0',
        'ghp_abcdefghijklmnop12345678901234567890',
      ];

      for (const token of tokens) {
        const encrypted = encrypt(token, testKey);
        const decrypted = decrypt(encrypted, testKey);
        expect(decrypted).toBe(token);
      }
    });
  });
});
