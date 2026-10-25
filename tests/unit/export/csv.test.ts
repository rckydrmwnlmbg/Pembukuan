import { describe, expect, it } from 'vitest';
import { csvSafe } from '@/server/export/csv';

describe('SECURITY S-13: Proteksi Formula Injection pada CSV (F-005)', () => {
  it('mengawali apostrof pada karakter pembuka rumus berbahaya (=, +, -, @, \\t, \\r)', () => {
    expect(csvSafe('=1+1')).toBe("'=1+1");
    expect(csvSafe('+cmd|\' /C calc\'!A0')).toBe("'+cmd|' /C calc'!A0");
    expect(csvSafe('-2+3')).toBe("'-2+3");
    expect(csvSafe('@SUM(A1:B10)')).toBe("'@SUM(A1:B10)");
    expect(csvSafe('\tTAB_PREFIX')).toBe("'\tTAB_PREFIX");
    expect(csvSafe('\rCR_PREFIX')).toBe("'\rCR_PREFIX");
  });

  it('tidak mengubah teks biasa yang aman', () => {
    expect(csvSafe('Beras 50 kg')).toBe('Beras 50 kg');
    expect(csvSafe('UD Pangan Nusantara')).toBe('UD Pangan Nusantara');
    expect(csvSafe('123456')).toBe('123456');
    expect(csvSafe('')).toBe('');
    expect(csvSafe(null)).toBe('');
    expect(csvSafe(undefined)).toBe('');
  });
});
