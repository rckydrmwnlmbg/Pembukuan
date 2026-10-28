import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { Rupiah } from '@/lib/schemas/common';
import { UuidSchema } from '@/lib/schemas/common';
import { HttpError } from '@/server/http/errors';
import { getKitchenLedger as getSupabaseKitchenLedger } from '@/server/ledger/supabase-ledger';
import { defaultLedgerStore } from '@/server/ledger/service';

const ParamsSchema = z.object({
  periodId: UuidSchema,
});

const UpdatePeriodBodySchema = z
  .object({
    openingBalance: Rupiah,
  })
  .strict();

export const PATCH = kitchenRoute(
  ['admin', 'maker'],
  UpdatePeriodBodySchema,
  async ({ kitchenId, params, input, supabase, user }) => {
    const { periodId } = ParamsSchema.parse(params);
    const balanceBig = input.openingBalance;

    if (balanceBig < 0n || balanceBig > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new HttpError(400, 'Saldo awal tidak valid.');
    }

    if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
      const { data: period, error: findErr } = await supabase
        .from('periods')
        .select('id, status, year, month')
        .eq('id', periodId)
        .eq('kitchen_id', kitchenId)
        .maybeSingle();

      if (findErr || !period) {
        throw new HttpError(404, 'Periode tidak ditemukan.');
      }

      if (period.status === 'locked') {
        throw new HttpError(
          409,
          'Periode sudah dikunci. Saldo awal pada periode terkunci tidak dapat diubah.',
        );
      }

      const { error: updateErr } = await supabase
        .from('periods')
        .update({ opening_balance: Number(balanceBig) })
        .eq('id', periodId);

      if (updateErr) {
        throw new HttpError(
          500,
          `Gagal memperbarui saldo awal periode: ${updateErr.message}`,
        );
      }

      const ledger = await getSupabaseKitchenLedger(supabase, kitchenId, periodId);

      return Response.json({
        success: true,
        periodId,
        openingBalance: balanceBig.toString(),
        summary: {
          openingBalance: ledger.summary.openingBalance.toString(),
          totalIncoming: ledger.summary.totalIncoming.toString(),
          totalOutgoing: ledger.summary.totalOutgoing.toString(),
          closingBalance: ledger.summary.closingBalance.toString(),
          incomingCount: ledger.summary.incomingCount,
          outgoingCount: ledger.summary.outgoingCount,
        },
      });
    }

    // Mock in-memory response
    const updated = defaultLedgerStore.updatePeriodOpeningBalance(
      kitchenId,
      periodId,
      balanceBig,
      user.id,
    );
    return Response.json({
      success: true,
      periodId,
      openingBalance: balanceBig.toString(),
      summary: {
        openingBalance: updated.summary.openingBalance.toString(),
        totalIncoming: updated.summary.totalIncoming.toString(),
        totalOutgoing: updated.summary.totalOutgoing.toString(),
        closingBalance: updated.summary.closingBalance.toString(),
        incomingCount: updated.summary.incomingCount,
        outgoingCount: updated.summary.outgoingCount,
      },
    });
  },
);
