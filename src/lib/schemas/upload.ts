import { z } from 'zod';
import {
  DescriptionSchema,
  PositiveRupiah,
  ReferenceNoSchema,
  stripControlChars,
  TxDateSchema,
  UuidSchema,
} from './common';

const OptionalCounterpartyNameSchema = z
  .string()
  .transform((s) => stripControlChars(s).trim())
  .pipe(z.string().max(120, 'Nama penerima maksimal 120 karakter.'))
  .nullable()
  .optional();

const OptionalCounterpartyAccountSchema = z
  .string()
  .trim()
  .regex(/^[0-9\- ]{4,32}$/, 'Nomor rekening penerima tidak valid.')
  .nullable()
  .optional();

const OptionalBankSchema = z
  .string()
  .transform((s) => stripControlChars(s).trim())
  .pipe(z.string().max(60, 'Nama bank maksimal 60 karakter.'))
  .nullable()
  .optional();

const OptionalNoteSchema = z
  .string()
  .transform((s) => stripControlChars(s).trim())
  .pipe(z.string().max(500, 'Catatan maksimal 500 karakter.'))
  .nullable()
  .optional();

export const UploadQueueQuerySchema = z
  .object({
    status: z
      .enum(['all', 'reviewable', 'parsed', 'needs_manual', 'posted'])
      .optional(),
  })
  .strict();

export const BatchUploadBodySchema = z
  .object({
    files: z
      .array(
        z
          .object({
            name: z.string().min(1).max(120),
            base64: z.string().min(1),
          })
          .strict(),
      )
      .min(1, 'Pilih minimal 1 berkas bukti transfer.')
      .max(20, 'Maksimal 20 berkas per unggahan (PRD FR-F3.1).'),
  })
  .strict();

export type BatchUploadInput = z.infer<typeof BatchUploadBodySchema>;

/**
 * Skema konfirmasi review & posting bukti transfer ke buku kas (PRD FR-F4.1..F4.5, SECURITY.md S-07).
 * Wajib menggunakan `.strict()`. Tidak ada posting otomatis tanpa konfirmasi pengguna.
 */
export const PostUploadReviewBodySchema = z
  .object({
    periodId: UuidSchema.optional(),
    txDate: TxDateSchema,
    kind: z.enum(['incoming', 'outgoing']).optional().default('outgoing'),
    referenceNo: ReferenceNoSchema.nullable().optional(),
    description: DescriptionSchema,
    amount: PositiveRupiah,
    counterpartyAccount: OptionalCounterpartyAccountSchema,
    counterpartyName: OptionalCounterpartyNameSchema,
    counterpartyBank: OptionalBankSchema,
    note: OptionalNoteSchema,
    includeAdminFee: z.boolean().optional().default(false),
    adminFeeAmount: PositiveRupiah.optional(),
    confirmWrongKitchen: z.boolean().optional().default(false),
    saveCounterpartyRule: z.boolean().optional().default(true),
    isPayrollMassal: z.boolean().optional().default(false),
  })
  .strict();

export type PostUploadReviewInput = z.infer<typeof PostUploadReviewBodySchema>;
