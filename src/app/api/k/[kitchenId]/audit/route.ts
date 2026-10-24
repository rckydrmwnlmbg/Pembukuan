import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { defaultLedgerStore } from '@/server/ledger/service';

const EmptyQuerySchema = z.object({}).strict();

export const GET = kitchenRoute(
  ['admin', 'maker', 'approver', 'viewer'],
  EmptyQuerySchema,
  async ({ kitchenId }) => {
    const logs = defaultLedgerStore.getKitchenAuditLogs(kitchenId);

    return Response.json({
      kitchenId,
      logs,
    });
  },
);
