import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { UuidSchema } from '@/lib/schemas/common';
import { defaultLedgerStore } from '@/server/ledger/service';
import { exportPlombokanXlsx } from '@/server/export/plombokan-xlsx';

const ExportQuerySchema = z
  .object({
    periodId: UuidSchema.optional(),
  })
  .strict();

export const GET = kitchenRoute(
  ['admin', 'maker', 'approver', 'viewer'],
  ExportQuerySchema,
  async ({ kitchenId, input }) => {
    const ledger = defaultLedgerStore.getKitchenLedger(kitchenId, {
      periodId: input.periodId,
    });

    const { buffer } = await exportPlombokanXlsx({
      organizationName: 'Yayasan Kuliner Sosial Nusantara (Data Contoh)',
      kitchenName: ledger.kitchen.name,
      pjName: ledger.kitchen.pjName,
      year: ledger.kitchen.year,
      month: ledger.kitchen.month,
      openingBalance: ledger.kitchen.openingBalance,
      adminFeeDefault: ledger.kitchen.adminFeeDefault,
      entries: ledger.rows,
    });

    const safeCode = ledger.kitchen.code.replace(/[^A-Za-z0-9\-_]/g, '_');
    const filename = `PEMBUKUAN_UMUM_${safeCode}_${ledger.kitchen.year}_${String(ledger.kitchen.month).padStart(2, '0')}.xlsx`;

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
