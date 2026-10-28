import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { UpdateKitchenSettingsBodySchema } from '@/lib/schemas/kitchen-settings';
import { defaultLedgerStore } from '@/server/ledger/service';
import { getKitchenLedger as getSupabaseKitchenLedger } from '@/server/ledger/supabase-ledger';
import { HttpError } from '@/server/http/errors';

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

        // Perbarui tahun & bulan periode jika disertakan dan periode masih open
        if (input.year !== undefined || input.month !== undefined) {
          const { data: openPeriod } = await supabase
            .from('periods')
            .select('id, year, month')
            .eq('kitchen_id', kitchenId)
            .eq('status', 'open')
            .order('year', { ascending: false })
            .order('month', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (openPeriod) {
            const targetYear = input.year ?? openPeriod.year;
            const targetMonth = input.month ?? openPeriod.month;

            const { data: conflictPeriod } = await supabase
              .from('periods')
              .select('id')
              .eq('kitchen_id', kitchenId)
              .eq('year', targetYear)
              .eq('month', targetMonth)
              .neq('id', openPeriod.id)
              .maybeSingle();

            if (conflictPeriod) {
              throw new HttpError(
                409,
                `Periode ${targetMonth}/${targetYear} sudah ada pada dapur ini.`,
              );
            }

            await supabase
              .from('periods')
              .update({ year: targetYear, month: targetMonth })
              .eq('id', openPeriod.id);
          }
        }

        // Perbarui saldo awal pada periode aktif di Supabase jika disertakan
        if (input.initialOpeningBalance !== undefined) {
          const balanceBig = BigInt(input.initialOpeningBalance);
          if (balanceBig < 0n || balanceBig > BigInt(Number.MAX_SAFE_INTEGER)) {
            throw new HttpError(400, 'Saldo awal tidak valid.');
          }

          const { error: periodErr } = await supabase
            .from('periods')
            .update({ opening_balance: Number(balanceBig) })
            .eq('kitchen_id', kitchenId)
            .eq('status', 'open');

          if (periodErr) {
            throw new HttpError(
              500,
              `Gagal memperbarui saldo awal periode di Supabase: ${periodErr.message}`,
            );
          }
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
