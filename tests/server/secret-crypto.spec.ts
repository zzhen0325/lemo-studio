import { afterAll, describe, expect, it, vi } from 'vitest';

const originalEncryptionKey = process.env.API_CONFIG_ENCRYPTION_KEY;

async function loadCryptoModule(encryptionKey?: string) {
  vi.resetModules();
  if (encryptionKey === undefined) {
    delete process.env.API_CONFIG_ENCRYPTION_KEY;
  } else {
    process.env.API_CONFIG_ENCRYPTION_KEY = encryptionKey;
  }
  return import('../../lib/server/utils/secret-crypto');
}

afterAll(() => {
  if (originalEncryptionKey === undefined) {
    delete process.env.API_CONFIG_ENCRYPTION_KEY;
  } else {
    process.env.API_CONFIG_ENCRYPTION_KEY = originalEncryptionKey;
  }
});

describe('secret-crypto', () => {
  it('keeps plaintext when encryption key is missing', async () => {
    const crypto = await loadCryptoModule(undefined);
    expect(crypto.isApiKeyEncryptionEnabled()).toBe(false);

    const plain = 'plain-key';
    expect(crypto.encryptApiKey(plain)).toBe(plain);
    expect(crypto.decryptApiKey(plain)).toBe(plain);
    expect(crypto.maskStoredApiKey(plain)).toBe('[MASKED:9]');
  });

  it('encrypts and decrypts with API_CONFIG_ENCRYPTION_KEY', async () => {
    const crypto = await loadCryptoModule('unit-test-encryption-key');
    expect(crypto.isApiKeyEncryptionEnabled()).toBe(true);

    const plain = 'super-secret-key';
    const encrypted = crypto.encryptApiKey(plain);

    expect(encrypted.startsWith('enc:v1:')).toBe(true);
    expect(encrypted).not.toBe(plain);
    expect(crypto.decryptApiKey(encrypted)).toBe(plain);
    expect(crypto.maskStoredApiKey(encrypted)).toBe('[MASKED:16]');
  });

  it('returns null when decrypting with wrong key', async () => {
    const cryptoA = await loadCryptoModule('first-key');
    const encrypted = cryptoA.encryptApiKey('sensitive');

    const cryptoB = await loadCryptoModule('second-key');
    expect(cryptoB.decryptApiKey(encrypted)).toBeNull();
    expect(cryptoB.maskStoredApiKey(encrypted)).toBe('[MASKED:0]');
  });
});
