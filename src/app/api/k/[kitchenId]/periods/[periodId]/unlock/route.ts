import { kitchenRoute } from '@/server/http/kitchen-route';
import { UnlockPeriodBodySchema } from '@/lib/schemas/kitchen-settings';
import { defaultLedgerStore } from '@/server/ledger/service';
import { HttpError } from '@/server/http/errors';

export const POST = kitchenRoute(
  ['admin'],
  UnlockPeriodBodySchema,
  async ({ kitchenId, user, role, params, input }) => {
    const periodId = params.periodId;
    if (!periodId) {
      throw new HttpError(400, 'Parameter periodId wajib disertakan.');
    }

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
