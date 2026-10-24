import { z } from 'zod';
import {
  DescriptionSchema,
  PositiveRupiah,
  ReferenceNoSchema,
  stripControlChars,
  TxDateSchema,
  UuidSchema,
} from './common';

const OptionalNoteSchema = z
  .string()
  .transform((s) => stripControlChars(s).trim())
  .pipe(z.string().max(500, 'Catatan maksimal 500 karakter.'))
  .nullable()
  .optional();

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

/**
 * Skema pembuatan transaksi manual dengan `.strict()` (SECURITY.md S-07 & S-08).
 * Mendukung pencatatan dana masuk (`incoming`, referensi opsional) dan dana keluar
 * (`outgoing`, dengan opsi biaya admin berpasangan secara atomik).
 */
export const CreateTransactionBodySchema = z
  .object({
    periodId: UuidSchema.optional(),
    txDate: TxDateSchema,
    kind: z.enum(['incoming', 'outgoing']),
    referenceNo: ReferenceNoSchema.nullable().optional(),
    description: DescriptionSchema,
    amount: PositiveRupiah,
    counterpartyAccount: OptionalCounterpartyAccountSchema,
    counterpartyName: OptionalCounterpartyNameSchema,
    counterpartyBank: OptionalBankSchema,
    note: OptionalNoteSchema,
    includeAdminFee: z.boolean().optional().default(false),
    adminFeeAmount: PositiveRupiah.optional(),
  })
  .strict();

export type CreateTransactionInput = z.infer<typeof CreateTransactionBodySchema>;

/**
 * Skema pengeditan transaksi dengan optimistic locking (`version`) dan `.strict()` (PRD E13 & S-15).
 */
export const UpdateTransactionBodySchema = z
  .object({
    action: z.literal('update'),
    version: z.number().int().positive('Versi transaksi tidak valid.'),
    txDate: TxDateSchema,
    referenceNo: ReferenceNoSchema.nullable().optional(),
    description: DescriptionSchema,
    amount: PositiveRupiah,
    counterpartyAccount: OptionalCounterpartyAccountSchema,
    counterpartyName: OptionalCounterpartyNameSchema,
    counterpartyBank: OptionalBankSchema,
    note: OptionalNoteSchema,
  })
  .strict();

export type UpdateTransactionInput = z.infer<typeof UpdateTransactionBodySchema>;

/**
 * Skema pembatalan transaksi (`void`) dengan optimistic locking (`version`) dan `.strict()`.
 * Hapus permanen tidak ada (AGENTS.md §7 & PRD FR-F5.5).
 */
export const VoidTransactionBodySchema = z
  .object({
    action: z.literal('void'),
    version: z.number().int().positive('Versi transaksi tidak valid.'),
    reason: z
      .string()
      .transform((s) => stripControlChars(s).trim())
      .pipe(
        z
          .string()
          .min(3, 'Alasan pembatalan wajib diisi (minimal 3 karakter).')
          .max(300, 'Alasan pembatalan maksimal 300 karakter.'),
      ),
  })
  .strict();

export type VoidTransactionInput = z.infer<typeof VoidTransactionBodySchema>;

/**
 * Skema query pencarian & filter buku kas per dapur (SECURITY.md S-05 & S-07).
 */
export const LedgerQuerySchema = z
  .object({
    periodId: UuidSchema.optional(),
    q: z
      .string()
      .transform((s) => stripControlChars(s).trim())
      .pipe(z.string().max(100, 'Kata kunci pencarian maksimal 100 karakter.'))
      .optional(),
    status: z.enum(['all', 'posted', 'void']).optional(),
  })
  .strict();
