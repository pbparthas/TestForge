import { beforeEach, describe, expect, it } from 'vitest';
import crypto from 'crypto';
import {
  decryptLegacyCBC,
  decrypt,
  encrypt,
  generateKey,
  isLegacyFormat,
  setKeyProviderForTests,
} from '../../../src/utils/encryption.js';
import { LocalEncryptionService } from '../../../src/services/local-encryption.service.js';

describe('encryption utils', () => {
  beforeEach(() => {
    const key = generateKey();
    setKeyProviderForTests(new LocalEncryptionService(key));
  });

  it('encrypts and decrypts plaintext roundtrip', async () => {
    const plaintext = 'my-secret-token';
    const ciphertext = await encrypt(plaintext);
    const decrypted = await decrypt(ciphertext);

    expect(ciphertext).not.toEqual(plaintext);
    expect(decrypted).toEqual(plaintext);
  });

  it('fails to decrypt tampered ciphertext', async () => {
    const ciphertext = await encrypt('hello');
    const [iv, authTag, payload] = ciphertext.split(':');
    const tampered = `${iv}:${authTag}:ff${payload?.slice(2)}`;

    await expect(decrypt(tampered)).rejects.toThrow();
  });

  it('fails to decrypt when auth tag is tampered', async () => {
    const ciphertext = await encrypt('hello');
    const [iv, authTag, payload] = ciphertext.split(':');
    const tamperedTag = `ff${authTag?.slice(2)}`;
    const tampered = `${iv}:${tamperedTag}:${payload}`;

    await expect(decrypt(tampered)).rejects.toThrow();
  });

  it('detects and decrypts legacy CBC format', async () => {
    const key = generateKey();
    setKeyProviderForTests(new LocalEncryptionService(key));

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    const encrypted = Buffer.concat([cipher.update('legacy-secret', 'utf8'), cipher.final()]);
    const legacyCiphertext = `${iv.toString('hex')}:${encrypted.toString('hex')}`;

    expect(isLegacyFormat(legacyCiphertext)).toBe(true);
    expect(decryptLegacyCBC(legacyCiphertext, key)).toBe('legacy-secret');
    await expect(decrypt(legacyCiphertext)).resolves.toBe('legacy-secret');
  });

  it('throws on invalid ciphertext format', async () => {
    await expect(decrypt('bad-format')).rejects.toThrow(
      'Invalid ciphertext format'
    );
  });
});
