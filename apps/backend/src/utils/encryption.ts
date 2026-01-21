/**
 * Encryption Utility
 * AES-256-CBC encryption for sensitive data like API tokens
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size
const KEY_LENGTH = 32; // 256 bits

/**
 * Generate a random encryption key (32 bytes for AES-256)
 * @returns Hex-encoded key string
 */
export function generateKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Encrypt plaintext using AES-256-CBC
 * @param plaintext - The text to encrypt
 * @param key - Hex-encoded encryption key (64 chars = 32 bytes)
 * @returns Encrypted string in format "iv:ciphertext" (both hex-encoded)
 */
export function encrypt(plaintext: string, key: string): string {
  if (!plaintext) {
    throw new Error('Plaintext cannot be empty');
  }

  if (key.length !== KEY_LENGTH * 2) {
    throw new Error(`Invalid key length. Expected ${KEY_LENGTH * 2} hex characters, got ${key.length}`);
  }

  const keyBuffer = Buffer.from(key, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Return IV and ciphertext concatenated with colon
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt ciphertext using AES-256-CBC
 * @param ciphertext - Encrypted string in format "iv:ciphertext" (hex-encoded)
 * @param key - Hex-encoded encryption key (64 chars = 32 bytes)
 * @returns Decrypted plaintext
 */
export function decrypt(ciphertext: string, key: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid ciphertext format. Expected "iv:ciphertext"');
  }

  if (key.length !== KEY_LENGTH * 2) {
    throw new Error(`Invalid key length. Expected ${KEY_LENGTH * 2} hex characters, got ${key.length}`);
  }

  const [ivHex, encryptedHex] = parts;
  const keyBuffer = Buffer.from(key, 'hex');
  const iv = Buffer.from(ivHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Get encryption key from environment variable
 * @returns The encryption key or throws if not set
 */
export function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  if (key.length !== KEY_LENGTH * 2) {
    throw new Error(`Invalid ENCRYPTION_KEY length. Expected ${KEY_LENGTH * 2} hex characters`);
  }
  return key;
}
