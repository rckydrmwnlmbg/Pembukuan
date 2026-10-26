import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { UnlockPeriodBodySchema } from '@/lib/schemas/kitchen-settings';
import { UuidSchema } from '@/lib/schemas/common';
import { defaultLedgerStore } from '@/server/ledger/service';
import { unlockPeriod as unlockSupabasePeriod } from '@/server/ledger/supabase-ledger';

const ParamsSchema = z.object({
  periodId: UuidSchema,
});

export const POST = kitchenRoute(
  ['admin'],
  UnlockPeriodBodySchema,
  async ({ kitchenId, user, role, params, input, supabase }) => {
    const { periodId } = ParamsSchema.parse(params);

    // 1. Buka kembali periode di Supabase jika pengguna nyata
    if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
      const realResult = await unlockSupabasePeriod(
        supabase,
        user.id,
        kitchenId,
        periodId,
        input,
        role,
      );

      return Response.json({
        success: true,
        periodId: realResult.periodId,
        status: realResult.status,
      });
    }

    // 2. Fallback untuk sesi demo testing
    const result = defaultLedgerStore.unlockPeriod(
      kitchenId,
      periodId,
      user.id,
      input,
      role,
    );

    return Response.json({
      success: true,
      periodId: result.periodId,
      status: result.status,
    });
  },
);
