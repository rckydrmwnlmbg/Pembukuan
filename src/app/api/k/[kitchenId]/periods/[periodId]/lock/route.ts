import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { LockPeriodBodySchema } from '@/lib/schemas/kitchen-settings';
import { UuidSchema } from '@/lib/schemas/common';
import { defaultLedgerStore } from '@/server/ledger/service';

const ParamsSchema = z.object({
  periodId: UuidSchema,
});

export const POST = kitchenRoute(
  ['admin', 'maker'],
  LockPeriodBodySchema,
  async ({ kitchenId, user, params, input }) => {
    const { periodId } = ParamsSchema.parse(params);

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
