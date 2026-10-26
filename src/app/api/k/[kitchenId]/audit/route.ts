import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { defaultLedgerStore } from '@/server/ledger/service';
import { getKitchenAuditLogs as getKitchenAuditLogsSupabase } from '@/server/ledger/supabase-ledger';

const EmptyQuerySchema = z.object({}).strict();

export const GET = kitchenRoute(
  ['admin', 'maker', 'approver', 'viewer'],
  EmptyQuerySchema,
  async ({ kitchenId, user, supabase }) => {
    // 1. Ambil jejak audit riil dari Supabase jika pengguna nyata
    if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
      try {
        const logs = await getKitchenAuditLogsSupabase(supabase, kitchenId);
        return Response.json({
          kitchenId,
          logs,
        });
      } catch {
        // Fallback jika belum siap
      }
    }

    // 2. Fallback untuk sesi demo testing
    const logs = defaultLedgerStore.getKitchenAuditLogs(kitchenId);

    return Response.json({
      kitchenId,
      logs,
    });
  },
);
