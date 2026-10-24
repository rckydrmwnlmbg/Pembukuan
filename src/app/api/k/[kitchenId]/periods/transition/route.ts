import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { defaultLedgerStore } from '@/server/ledger/service';

const EmptyBodySchema = z.object({}).strict();

export const POST = kitchenRoute(
  ['admin', 'maker'],
  EmptyBodySchema,
  async ({ kitchenId, user }) => {
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
