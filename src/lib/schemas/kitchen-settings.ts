import { z } from 'zod';
import {
  PositiveRupiah,
  Rupiah,
  stripControlChars,
} from './common';

export const UpdateKitchenSettingsBodySchema = z
  .object({
    name: z
      .string()
      .transform((s) => stripControlChars(s).trim())
      .pipe(
        z
          .string()
          .min(3, 'Nama dapur minimal 3 karakter.')
          .max(80, 'Nama dapur maksimal 80 karakter.'),
      ),
    code: z
      .string()
      .trim()
      .regex(
        /^[A-Za-z0-9\-_]{2,16}$/,
        'Kode dapur berupa 2-16 karakter alfanumerik atau tanda hubung.',
      ),
    pjName: z
      .string()
      .transform((s) => stripControlChars(s).trim())
      .pipe(
        z
          .string()
          .min(2, 'Nama PJ dapur minimal 2 karakter.')
          .max(80, 'Nama PJ dapur maksimal 80 karakter.'),
      ),
    bankCode: z
      .string()
      .transform((s) => stripControlChars(s).trim().toUpperCase())
      .pipe(
        z
          .string()
          .min(2, 'Kode bank minimal 2 karakter.')
          .max(20, 'Kode bank maksimal 20 karakter.'),
      ),
    accountNo: z
      .string()
      .trim()
      .regex(/^[0-9\- ]{4,32}$/, 'Nomor rekening tidak valid (4-32 digit).'),
    adminFeeDefault: PositiveRupiah,
    initialOpeningBalance: Rupiah.optional(),
    year: z.number().int().min(2020).max(2050).optional(),
    month: z.number().int().min(1).max(12).optional(),
  })
  .strict();

export type UpdateKitchenSettingsInput = z.infer<
  typeof UpdateKitchenSettingsBodySchema
>;

export const LockPeriodBodySchema = z
  .object({
    forceWithUnpostedDrafts: z.boolean().optional().default(false),
  })
  .strict();

export type LockPeriodInput = z.infer<typeof LockPeriodBodySchema>;

export const UnlockPeriodBodySchema = z
  .object({
    reason: z
      .string()
      .transform((s) => stripControlChars(s).trim())
      .pipe(
        z
          .string()
          .min(
            5,
            'Alasan pembukaan kembali periode wajib diisi (minimal 5 karakter).',
          )
          .max(300, 'Alasan pembukaan kembali maksimal 300 karakter.'),
      ),
  })
  .strict();

export type UnlockPeriodInput = z.infer<typeof UnlockPeriodBodySchema>;
