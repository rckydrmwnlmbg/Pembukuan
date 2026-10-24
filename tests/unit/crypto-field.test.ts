import { describe, expect, it } from 'vitest';
import {
  decryptField,
  encryptField,
  extractLast4Digits,
  hashForLookup,
} from '@/server/crypto/field';
import { assertSameOrigin } from '@/server/http/same-origin';
import { HttpError, toErrorResponse } from '@/server/http/errors';

const TEST_KEYS = {
  encryptionKeyBase64: Buffer.alloc(32, 0x11).toString('base64'),
  hashKeyBase64: Buffer.alloc(32, 0x22).toString('base64'),
};

describe('src/server/crypto/field.ts & src/server/http/* (SECURITY S-04, S-10, S-12)', () => {
  it('mengenkripsi dan mendekripsi nomor rekening sintetis dengan AES-256-GCM', () => {
    const syntheticAccount = '999012345678';
    const ct1 = encryptField(syntheticAccount, TEST_KEYS);
    const ct2 = encryptField(syntheticAccount, TEST_KEYS);

    expect(ct1).not.toBe(ct2); // IV acak setiap enkripsi
    expect(decryptField(ct1, TEST_KEYS)).toBe(syntheticAccount);
    expect(decryptField(ct2, TEST_KEYS)).toBe(syntheticAccount);
  });

  it('menghasilkan HMAC pencarian deterministik dan mengambil 4 digit terakhir', () => {
    const h1 = hashForLookup('9990 1234 5678', TEST_KEYS);
    const h2 = hashForLookup('999012345678', TEST_KEYS);
    expect(h1).toBe(h2);
    expect(extractLast4Digits('9990-1234-5678')).toBe('5678');
  });

  it('menolak permintaan lintas origin (CSRF protection S-10)', () => {
    const validReq = new Request('https://kasdapur.example/api/test', {
      method: 'POST',
      headers: {
        origin: 'https://kasdapur.example',
        host: 'kasdapur.example',
      },
    });
    expect(() => assertSameOrigin(validReq)).not.toThrow();

    const evilReq = new Request('https://kasdapur.example/api/test', {
      method: 'POST',
      headers: {
        origin: 'https://evil.example',
        host: 'kasdapur.example',
      },
    });
    expect(() => assertSameOrigin(evilReq)).toThrow(HttpError);
  });

  it('menyembunyikan detail galat internal pada respons 500 dan menyertakan requestId (S-12)', async () => {
    const dbError = new Error('relation "public.transactions" violates constraint xyz');
    const res = toErrorResponse(dbError);
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; requestId: string };
    expect(body.error).not.toContain('transactions');
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
