import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { defaultLedgerStore } from '@/server/ledger/service';
import { transitionToNextPeriod as transitionToNextPeriodSupabase } from '@/server/ledger/supabase-ledger';

const EmptyBodySchema = z.object({}).strict();

export const POST = kitchenRoute(
  ['admin', 'maker'],
  EmptyBodySchema,
  async ({ kitchenId, user, supabase }) => {
    // 1. Buat periode baru di Supabase jika pengguna nyata
    if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
      const realResult = await transitionToNextPeriodSupabase(
        supabase,
        user.id,
        kitchenId,
      );

      return Response.json({
        success: true,
        periodId: realResult.periodId,
        year: realResult.year,
        month: realResult.month,
        openingBalance: realResult.openingBalance.toString(),
        status: realResult.status,
      });
    }

    // 2. Fallback untuk sesi demo testing
    const result = defaultLedgerStore.transitionToNextPeriod(kitchenId, user.id);

    return Response.json({
      success: true,
      periodId: result.periodId,
      year: result.year,
      month: result.month,
      openingBalance: result.openingBalance.toString(),
      status: result.status,
    });
  },
);
