import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ENCRYPTED_PREFIX = 'enc:v1:';
const IV_BYTE_LENGTH = 12;
const AUTH_TAG_BYTE_LENGTH = 16;

let cachedEncryptionKey: Buffer | null | undefined;

function toBase64Url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64');
}

function deriveKeyFromEnv(rawKey: string): Buffer {
  const trimmed = rawKey.trim();

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  try {
    const decoded = fromBase64Url(trimmed);
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    // Ignore and fallback to hash-based derivation.
  }

  return createHash('sha256').update(trimmed).digest();
}

function getEncryptionKey(): Buffer | null {
  if (cachedEncryptionKey !== undefined) {
    return cachedEncryptionKey;
  }

  const raw = process.env.API_CONFIG_ENCRYPTION_KEY?.trim();
  if (!raw) {
    cachedEncryptionKey = null;
    return null;
  }

  cachedEncryptionKey = deriveKeyFromEnv(raw);
  return cachedEncryptionKey;
}

export function isApiKeyEncrypted(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

export function isApiKeyEncryptionEnabled(): boolean {
  return getEncryptionKey() !== null;
}

export function encryptApiKey(plainValue: string): string {
  if (!plainValue) return '';
  if (isApiKeyEncrypted(plainValue)) return plainValue;

  const key = getEncryptionKey();
  if (!key) return plainValue;

  const iv = randomBytes(IV_BYTE_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainValue, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${toBase64Url(iv)}:${toBase64Url(authTag)}:${toBase64Url(encrypted)}`;
}

export function decryptApiKey(storedValue: string): string | null {
  if (!storedValue) return '';
  if (!isApiKeyEncrypted(storedValue)) return storedValue;

  const key = getEncryptionKey();
  if (!key) return null;

  const payload = storedValue.slice(ENCRYPTED_PREFIX.length);
  const [ivPart, tagPart, encryptedPart] = payload.split(':');
  if (!ivPart || !tagPart || !encryptedPart) {
    return null;
  }

  try {
    const iv = fromBase64Url(ivPart);
    const authTag = fromBase64Url(tagPart);
    const encrypted = fromBase64Url(encryptedPart);

    if (iv.length !== IV_BYTE_LENGTH || authTag.length !== AUTH_TAG_BYTE_LENGTH) {
      return null;
    }

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return plain.toString('utf8');
  } catch {
    return null;
  }
}

export function maskStoredApiKey(storedValue: string | undefined | null): string {
  if (!storedValue) return '';
  const plain = decryptApiKey(storedValue);
  return `[MASKED:${plain?.length ?? 0}]`;
}
