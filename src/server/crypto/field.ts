import 'server-only';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { getEnv } from '@/server/env';

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKeys(customKeys?: { encryptionKeyBase64: string; hashKeyBase64: string }): {
  encKey: Buffer;
  hashKey: Buffer;
} {
  if (customKeys) {
    return {
      encKey: Buffer.from(customKeys.encryptionKeyBase64, 'base64'),
      hashKey: Buffer.from(customKeys.hashKeyBase64, 'base64'),
    };
  }
  const env = getEnv();
  return {
    encKey: Buffer.from(env.FIELD_ENCRYPTION_KEY, 'base64'),
    hashKey: Buffer.from(env.FIELD_HASH_KEY, 'base64'),
  };
}

/**
 * Mengenkripsi field sensitif (mis. nomor rekening) dengan AES-256-GCM (SECURITY.md S-04).
 */
export function encryptField(
  plain: string,
  customKeys?: { encryptionKeyBase64: string; hashKeyBase64: string },
): string {
  const { encKey } = getKeys(customKeys);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', encKey, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ct]).toString('base64');
}

/**
 * Mendekripsi field yang dienkripsi oleh encryptField (AES-256-GCM) (SECURITY.md S-04).
 */
export function decryptField(
  b64: string,
  customKeys?: { encryptionKeyBase64: string; hashKeyBase64: string },
): string {
  const { encKey } = getKeys(customKeys);
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Ciphertext tidak valid.');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ct = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', encKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/**
 * Menghasilkan HMAC-SHA256 deterministik untuk mencocokkan aturan penerima
 * tanpa menyimpan nomor rekening mentah (SECURITY.md S-04 & PRD.md bagian 7).
 */
export function hashForLookup(
  plain: string,
  customKeys?: { encryptionKeyBase64: string; hashKeyBase64: string },
): string {
  const { hashKey } = getKeys(customKeys);
  const normalized = plain.replace(/\s+/g, '').trim();
  return createHmac('sha256', hashKey).update(normalized, 'utf8').digest('hex');
}

/**
 * Mengambil 4 digit terakhir nomor rekening untuk tampilan aman di UI (PRD FR-F2.2 & SECURITY S-12).
 */
export function extractLast4Digits(accountNo: string): string {
  const digitsOnly = accountNo.replace(/\D/g, '');
  return digitsOnly.slice(-4);
}
