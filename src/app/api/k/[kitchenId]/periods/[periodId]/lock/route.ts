import { kitchenRoute } from '@/server/http/kitchen-route';
import { LockPeriodBodySchema } from '@/lib/schemas/kitchen-settings';
import { defaultLedgerStore } from '@/server/ledger/service';
import { HttpError } from '@/server/http/errors';

export const POST = kitchenRoute(
  ['admin', 'maker'],
  LockPeriodBodySchema,
  async ({ kitchenId, user, params, input }) => {
    const periodId = params.periodId;
    if (!periodId) {
      throw new HttpError(400, 'Parameter periodId wajib disertakan.');
    }

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
