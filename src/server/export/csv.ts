import 'server-only';

/**
 * Karakter berbahaya yang dapat memicu eksekusi rumus atau injeksi formula pada aplikasi spreadsheet (SECURITY.md S-13):
 * `=`, `+`, `-`, `@`, karakter tab (`\t`), atau carriage return (`\r`).
 */
export const DANGEROUS_FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * Mengamankan nilai string untuk ekspor CSV dengan mengawali apostrof jika mengandung karakter pembuka rumus berbahaya (SECURITY.md S-13).
 */
export function csvSafe(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return DANGEROUS_FORMULA_PREFIX.test(str) ? `'${str}` : str;
}
