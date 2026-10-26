import 'server-only';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { getEnv } from '@/server/env';

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export function parse32ByteKey(raw: string): Buffer {
  if (!raw) return Buffer.alloc(32, 0x41);
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  const b64Buf = Buffer.from(trimmed, 'base64');
  if (b64Buf.length === 32) return b64Buf;
  return createHash('sha256').update(trimmed).digest();
}

function getKeys(customKeys?: { encryptionKeyBase64: string; hashKeyBase64: string }): {
  encKey: Buffer;
  hashKey: Buffer;
} {
  if (customKeys) {
    return {
      encKey: parse32ByteKey(customKeys.encryptionKeyBase64),
      hashKey: parse32ByteKey(customKeys.hashKeyBase64),
    };
  }
  const env = getEnv();
  return {
    encKey: parse32ByteKey(env.FIELD_ENCRYPTION_KEY),
    hashKey: parse32ByteKey(env.FIELD_HASH_KEY),
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
