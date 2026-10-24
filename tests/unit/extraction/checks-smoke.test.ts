import { describe, expect, it } from 'vitest';
import { Rupiah } from '@/lib/schemas/common';

describe('Kerangka uji ekstraksi M0 (test:extraction)', () => {
  it('memvalidasi nominal hasil ekstraksi sintetis sebagai bigint tanpa float', () => {
    const parsedAmount = Rupiah.parse('2436500');
    expect(parsedAmount).toBe(2436500n);
  });
});
