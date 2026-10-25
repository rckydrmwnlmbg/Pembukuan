import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { UnlockPeriodBodySchema } from '@/lib/schemas/kitchen-settings';
import { UuidSchema } from '@/lib/schemas/common';
import { defaultLedgerStore } from '@/server/ledger/service';

const ParamsSchema = z.object({
  periodId: UuidSchema,
});

export const POST = kitchenRoute(
  ['admin'],
  UnlockPeriodBodySchema,
  async ({ kitchenId, user, role, params, input }) => {
    const { periodId } = ParamsSchema.parse(params);

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
