import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { UpdateKitchenSettingsBodySchema } from '@/lib/schemas/kitchen-settings';
import { defaultLedgerStore } from '@/server/ledger/service';
import { getKitchenLedger as getSupabaseKitchenLedger } from '@/server/ledger/supabase-ledger';

const EmptyQuerySchema = z.object({}).strict();

export const GET = kitchenRoute(
  ['admin', 'maker', 'approver', 'viewer'],
  EmptyQuerySchema,
  async ({ supabase, user, kitchenId }) => {
    // 1. Coba ambil dari Supabase nyata
    if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
      try {
        const { kitchen } = await getSupabaseKitchenLedger(supabase, kitchenId);
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
          nextPeriodOpeningBalance: null,
          pendingDraftCount: kitchen.pendingDraftCount,
          needsManualCount: kitchen.needsManualCount,
        });
      } catch {
        // Fallback
      }
    }

    // 2. Fallback in-memory
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
  async ({ supabase, user, kitchenId, input }) => {
    // 1. Coba update ke Supabase jika terhubung
    if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
      try {
        const updates: Record<string, unknown> = {};
        if (input.name) updates.name = input.name.trim();
        if (input.code) updates.code = input.code.trim().toUpperCase();
        if (input.pjName) updates.pj_name = input.pjName.trim();
        if (input.adminFeeDefault) updates.admin_fee_default = Number(input.adminFeeDefault);

        if (Object.keys(updates).length > 0) {
          await supabase.from('kitchens').update(updates).eq('id', kitchenId);
        }

        if (input.bankCode) {
          await supabase
            .from('bank_accounts')
            .update({ bank_code: input.bankCode.trim().toUpperCase() })
            .eq('kitchen_id', kitchenId);
        }

        const { kitchen } = await getSupabaseKitchenLedger(supabase, kitchenId);
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
          nextPeriodOpeningBalance: null,
        });
      } catch {
        // Fallback
      }
    }

    // 2. Fallback in-memory
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
