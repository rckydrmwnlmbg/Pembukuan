import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { UuidSchema } from '@/lib/schemas/common';
import { defaultLedgerStore } from '@/server/ledger/service';
import { getKitchenLedger as getSupabaseKitchenLedger } from '@/server/ledger/supabase-ledger';
import { exportPlombokanXlsx } from '@/server/export/plombokan-xlsx';
import type { LedgerEntryInput } from '@/lib/ledger-math';

const ExportQuerySchema = z
  .object({
    periodId: UuidSchema.optional(),
  })
  .strict();

export const GET = kitchenRoute(
  ['admin', 'maker', 'approver', 'viewer'],
  ExportQuerySchema,
  async ({ supabase, user, kitchenId, input }) => {
    let kitchenName = '';
    let pjName = '';
    let year = 2026;
    let month = 3;
    let openingBalance = 0n;
    let adminFeeDefault = 6500n;
    let code = 'DPR';
    let rows: readonly LedgerEntryInput[] = [];

    // 1. Coba ambil dari Supabase jika terhubung
    if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
      try {
        const realLedger = await getSupabaseKitchenLedger(
          supabase,
          kitchenId,
          input.periodId,
        );
        kitchenName = realLedger.kitchen.name;
        pjName = realLedger.kitchen.pjName;
        year = realLedger.kitchen.year;
        month = realLedger.kitchen.month;
        openingBalance = realLedger.kitchen.openingBalance;
        adminFeeDefault = realLedger.kitchen.adminFeeDefault;
        code = realLedger.kitchen.code;
        rows = realLedger.rows;
      } catch {
        // Fallback ke in-memory
      }
    }

    // 2. Fallback in-memory jika belum di Supabase
    if (!kitchenName) {
      const ledger = defaultLedgerStore.getKitchenLedger(kitchenId, {
        periodId: input.periodId,
      });
      kitchenName = ledger.kitchen.name;
      pjName = ledger.kitchen.pjName;
      year = ledger.kitchen.year;
      month = ledger.kitchen.month;
      openingBalance = ledger.kitchen.openingBalance;
      adminFeeDefault = ledger.kitchen.adminFeeDefault;
      code = ledger.kitchen.code;
      rows = ledger.rows;
    }

    const { buffer } = await exportPlombokanXlsx({
      organizationName: 'Pembukuan Kas Yayasan',
      kitchenName,
      pjName,
      year,
      month,
      openingBalance,
      adminFeeDefault,
      entries: rows,
    });

    const safeCode = code.replace(/[^A-Za-z0-9\-_]/g, '_');
    const filename = `PEMBUKUAN_UMUM_${safeCode}_${year}_${String(month).padStart(2, '0')}.xlsx`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },
);
