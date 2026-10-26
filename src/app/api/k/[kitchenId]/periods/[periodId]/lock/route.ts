import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { LockPeriodBodySchema } from '@/lib/schemas/kitchen-settings';
import { UuidSchema } from '@/lib/schemas/common';
import { defaultLedgerStore } from '@/server/ledger/service';
import { lockPeriod as lockSupabasePeriod } from '@/server/ledger/supabase-ledger';

const ParamsSchema = z.object({
  periodId: UuidSchema,
});

export const POST = kitchenRoute(
  ['admin', 'maker'],
  LockPeriodBodySchema,
  async ({ kitchenId, user, params, input, supabase }) => {
    const { periodId } = ParamsSchema.parse(params);

    // 1. Kunci periode di Supabase jika pengguna nyata
    if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
      const realResult = await lockSupabasePeriod(
        supabase,
        user.id,
        kitchenId,
        periodId,
        input,
      );

      return Response.json({
        success: true,
        periodId: realResult.periodId,
        status: realResult.status,
        nextPeriodOpeningBalance: realResult.nextPeriodOpeningBalance.toString(),
        closingBalance: realResult.summary.closingBalance.toString(),
      });
    }

    // 2. Fallback untuk sesi demo testing
    const result = defaultLedgerStore.lockPeriod(
      kitchenId,
      periodId,
      user.id,
      input,
    );

    return Response.json({
      success: true,
      periodId: result.periodId,
      status: result.status,
      nextPeriodOpeningBalance: result.nextPeriodOpeningBalance.toString(),
      closingBalance: result.summary.closingBalance.toString(),
    });
  },
);
