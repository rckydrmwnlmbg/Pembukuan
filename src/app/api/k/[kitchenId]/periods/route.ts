import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { Rupiah } from '@/lib/schemas/common';
import { HttpError } from '@/server/http/errors';
import { defaultLedgerStore } from '@/server/ledger/service';

export const CreatePeriodBodySchema = z
  .object({
    year: z.number().int().min(2020).max(2050),
    month: z.number().int().min(1).max(12),
    openingBalance: Rupiah.optional().default(0n),
  })
  .strict();

export const POST = kitchenRoute(
  ['admin', 'maker'],
  CreatePeriodBodySchema,
  async ({ kitchenId, input, supabase, user }) => {
    const openingBig = input.openingBalance ?? 0n;
    if (openingBig < 0n || openingBig > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new HttpError(400, 'Saldo awal tidak valid.');
    }

    if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
      const { data: existing } = await supabase
        .from('periods')
        .select('id')
        .eq('kitchen_id', kitchenId)
        .eq('year', input.year)
        .eq('month', input.month)
        .maybeSingle();

      if (existing) {
        throw new HttpError(
          409,
          `Periode ${input.month}/${input.year} sudah terdaftar pada dapur ini.`,
        );
      }

      const newPeriodId = crypto.randomUUID();
      const { error: insErr } = await supabase.from('periods').insert({
        id: newPeriodId,
        kitchen_id: kitchenId,
        year: input.year,
        month: input.month,
        opening_balance: Number(openingBig),
        status: 'open',
      });

      if (insErr) {
        throw new HttpError(
          500,
          `Gagal membuat periode baru: ${insErr.message}`,
        );
      }

      return Response.json(
        {
          success: true,
          period: {
            id: newPeriodId,
            year: input.year,
            month: input.month,
            openingBalance: openingBig.toString(),
            status: 'open',
          },
        },
        { status: 201 },
      );
    }

    // Fallback in-memory/demo store
    const newPeriod = defaultLedgerStore.createPeriod(kitchenId, {
      year: input.year,
      month: input.month,
      openingBalance: openingBig,
    });
    return Response.json(
      {
        success: true,
        period: {
          id: newPeriod.id,
          year: newPeriod.year,
          month: newPeriod.month,
          openingBalance: newPeriod.openingBalance.toString(),
          status: newPeriod.status,
        },
      },
      { status: 201 },
    );
  },
);
