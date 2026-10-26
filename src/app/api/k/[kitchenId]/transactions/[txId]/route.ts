import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import {
  UpdateTransactionBodySchema,
  VoidTransactionBodySchema,
} from '@/lib/schemas/transaction';
import { UuidSchema } from '@/lib/schemas/common';
import { defaultLedgerStore } from '@/server/ledger/service';
import { voidTransaction as voidSupabaseTransaction, getKitchenLedger as getSupabaseKitchenLedger } from '@/server/ledger/supabase-ledger';
import { HttpError } from '@/server/http/errors';

const EmptyGetQuerySchema = z.object({}).strict();
const ParamsSchema = z.object({
  txId: UuidSchema,
});

/**
 * Skema gabungan untuk PATCH `/api/k/[kitchenId]/transactions/[txId]` dengan `.strict()`.
 * Mendukung `action: 'update'` dan `action: 'void'`.
 */
const PatchTransactionBodySchema = z
  .object({
    action: z.enum(['update', 'void']),
    version: z.number().int().positive('Versi transaksi tidak valid.'),
    txDate: z.string().optional(),
    referenceNo: z.string().nullable().optional(),
    description: z.string().optional(),
    amount: z.string().optional(),
    counterpartyAccount: z.string().nullable().optional(),
    counterpartyName: z.string().nullable().optional(),
    counterpartyBank: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    reason: z.string().optional(),
  })
  .strict();

export const GET = kitchenRoute(
  ['admin', 'maker', 'approver', 'viewer'],
  EmptyGetQuerySchema,
  async ({ supabase, user, kitchenId, params }) => {
    const { txId } = ParamsSchema.parse(params);

    // 1. Coba ambil dari Supabase jika terhubung
    if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
      try {
        const ledger = await getSupabaseKitchenLedger(supabase, kitchenId);
        const row = ledger.rows.find((r) => r.id === txId);
        if (row) {
          return Response.json({
            ...row,
            debit: row.debit.toString(),
            credit: row.credit.toString(),
            runningBalance: row.runningBalance.toString(),
            version: row.version ?? 1,
          });
        }
      } catch {
        // Fallback ke in-memory
      }
    }

    // 2. Fallback in-memory
    const ledger = defaultLedgerStore.getKitchenLedger(kitchenId);
    const row = ledger.rows.find((r) => r.id === txId);
    if (!row) {
      throw new HttpError(404, 'Tidak ditemukan');
    }

    return Response.json({
      ...row,
      debit: row.debit.toString(),
      credit: row.credit.toString(),
      runningBalance: row.runningBalance.toString(),
      version: row.version ?? 1,
    });
  },
);

export const PATCH = kitchenRoute(
  ['admin', 'maker'],
  PatchTransactionBodySchema,
  async ({ supabase, user, kitchenId, params, input }) => {
    const { txId } = ParamsSchema.parse(params);

    if (input.action === 'void') {
      const voidInput = VoidTransactionBodySchema.parse({
        action: 'void',
        version: input.version,
        reason: input.reason,
      });

      // 1. Batalkan di Supabase jika terhubung
      if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
        try {
          const { voidedIds } = await voidSupabaseTransaction(
            supabase,
            user.id,
            kitchenId,
            txId,
            input.reason || '',
          );
          const ledger = await getSupabaseKitchenLedger(supabase, kitchenId);

          return Response.json({
            voidedIds,
            summary: {
              openingBalance: ledger.summary.openingBalance.toString(),
              totalIncoming: ledger.summary.totalIncoming.toString(),
              totalOutgoing: ledger.summary.totalOutgoing.toString(),
              closingBalance: ledger.summary.closingBalance.toString(),
              incomingCount: ledger.summary.incomingCount,
              outgoingCount: ledger.summary.outgoingCount,
            },
          });
        } catch (err: unknown) {
          if (err instanceof Error && !err.message.includes('fetch failed')) {
            throw err;
          }
        }
      }

      // 2. Fallback in-memory
      const result = defaultLedgerStore.voidTransaction(
        kitchenId,
        txId,
        user.id,
        voidInput,
      );
      return Response.json({
        voidedIds: result.voidedIds,
        summary: {
          openingBalance: result.summary.openingBalance.toString(),
          totalIncoming: result.summary.totalIncoming.toString(),
          totalOutgoing: result.summary.totalOutgoing.toString(),
          closingBalance: result.summary.closingBalance.toString(),
          incomingCount: result.summary.incomingCount,
          outgoingCount: result.summary.outgoingCount,
        },
      });
    }

    const updateInput = UpdateTransactionBodySchema.parse({
      action: 'update',
      version: input.version,
      txDate: input.txDate,
      referenceNo: input.referenceNo,
      description: input.description,
      amount: input.amount,
      counterpartyAccount: input.counterpartyAccount,
      counterpartyName: input.counterpartyName,
      counterpartyBank: input.counterpartyBank,
      note: input.note,
    });

    const result = defaultLedgerStore.updateTransaction(
      kitchenId,
      txId,
      user.id,
      updateInput,
    );

    return Response.json({
      updated: {
        ...result.updated,
        debit: result.updated.debit.toString(),
        credit: result.updated.credit.toString(),
        runningBalance: result.updated.runningBalance.toString(),
        version: result.updated.version ?? input.version + 1,
      },
      summary: {
        openingBalance: result.summary.openingBalance.toString(),
        totalIncoming: result.summary.totalIncoming.toString(),
        totalOutgoing: result.summary.totalOutgoing.toString(),
        closingBalance: result.summary.closingBalance.toString(),
        incomingCount: result.summary.incomingCount,
        outgoingCount: result.summary.outgoingCount,
      },
    });
  },
);
