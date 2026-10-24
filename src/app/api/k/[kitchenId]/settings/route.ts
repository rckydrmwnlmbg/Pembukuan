import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { UpdateKitchenSettingsBodySchema } from '@/lib/schemas/kitchen-settings';
import { defaultLedgerStore } from '@/server/ledger/service';

const EmptyQuerySchema = z.object({}).strict();

export const GET = kitchenRoute(
  ['admin', 'maker', 'approver', 'viewer'],
  EmptyQuerySchema,
  async ({ kitchenId }) => {
    const kitchen = defaultLedgerStore.getKitchen(kitchenId);

    return Response.json({
      id: kitchen.id,
      name: kitchen.name,
      code: kitchen.code,
      pjName: kitchen.pjName,
      bankCode: kitchen.bankCode,
      accountNoLast4: kitchen.accountNoLast4,
      adminFeeDefault: kitchen.adminFeeDefault.toString(),
      openingBalance: kitchen.openingBalance.toString(),
      periodId: kitchen.periodId,
      year: kitchen.year,
      month: kitchen.month,
      periodStatus: kitchen.periodStatus,
      nextPeriodOpeningBalance:
        kitchen.nextPeriodOpeningBalance !== null
          ? kitchen.nextPeriodOpeningBalance.toString()
          : null,
      pendingDraftCount: kitchen.pendingDraftCount,
      needsManualCount: kitchen.needsManualCount,
    });
  },
);

export const PATCH = kitchenRoute(
  ['admin'],
  UpdateKitchenSettingsBodySchema,
  async ({ kitchenId, user, input }) => {
    const updated = defaultLedgerStore.updateKitchenSettings(
      kitchenId,
      user.id,
      input,
    );

    return Response.json({
      id: updated.id,
      name: updated.name,
      code: updated.code,
      pjName: updated.pjName,
      bankCode: updated.bankCode,
      accountNoLast4: updated.accountNoLast4,
      adminFeeDefault: updated.adminFeeDefault.toString(),
      openingBalance: updated.openingBalance.toString(),
      periodId: updated.periodId,
      year: updated.year,
      month: updated.month,
      periodStatus: updated.periodStatus,
      nextPeriodOpeningBalance:
        updated.nextPeriodOpeningBalance !== null
          ? updated.nextPeriodOpeningBalance.toString()
          : null,
    });
  },
);
