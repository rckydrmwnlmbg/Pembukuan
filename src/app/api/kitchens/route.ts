import 'server-only';
import { z } from 'zod';
import { userRoute } from '@/server/http/user-route';
import { defaultLedgerStore } from '@/server/ledger/service';
import { listUserKitchens, createKitchen as createSupabaseKitchen } from '@/server/ledger/supabase-ledger';
import { HttpError } from '@/server/http/errors';

const GetKitchensSchema = z.object({});

const ManageKitchenSchema = z.object({
  action: z.enum(['create', 'clear_demo']),
  name: z.string().min(1).max(100).optional(),
  code: z.string().min(2).max(20).optional(),
  pjName: z.string().min(1).max(100).optional(),
  bankCode: z.string().min(2).max(20).optional(),
  accountNo: z.string().min(4).max(30).optional(),
  openingBalance: z.string().regex(/^\d+$/).optional(),
  adminFeeDefault: z.string().regex(/^\d+$/).optional(),
});

export const GET = userRoute(GetKitchensSchema, async ({ supabase, user }) => {
  // 1. Coba ambil dari Supabase nyata terlebih dahulu
  if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
    try {
      const realKitchens = await listUserKitchens(supabase, user.id);
      if (realKitchens.length > 0) {
        return Response.json({
          kitchens: realKitchens.map((k) => ({
            id: k.id,
            code: k.code,
            name: k.name,
            pjName: k.pjName,
            bankCode: k.bankCode,
            accountNoLast4: k.accountNoLast4,
            openingBalance: k.openingBalance.toString(),
            adminFeeDefault: k.adminFeeDefault.toString(),
            periodId: k.periodId,
            year: k.year,
            month: k.month,
            periodStatus: k.periodStatus,
            summary: {
              openingBalance: k.summary.openingBalance.toString(),
              totalIncoming: k.summary.totalIncoming.toString(),
              totalOutgoing: k.summary.totalOutgoing.toString(),
              closingBalance: k.summary.closingBalance.toString(),
            },
          })),
        });
      }
    } catch {
      // Jika tabel belum di-migrate, teruskan ke fallback
    }
  }

  // 2. Fallback untuk mock store / unit tests
  const kitchens = defaultLedgerStore.listKitchenMeta().map((k) => ({
    id: k.id,
    code: k.code,
    name: k.name,
    pjName: k.pjName,
    bankCode: k.bankCode,
    accountNoLast4: k.accountNoLast4,
    openingBalance: k.openingBalance.toString(),
    adminFeeDefault: k.adminFeeDefault.toString(),
    periodId: k.periodId,
    year: k.year,
    month: k.month,
    periodStatus: k.periodStatus,
    summary: {
      openingBalance: k.summary.openingBalance.toString(),
      totalIncoming: k.summary.totalIncoming.toString(),
      totalOutgoing: k.summary.totalOutgoing.toString(),
      closingBalance: k.summary.closingBalance.toString(),
    },
  }));

  return Response.json({ kitchens });
});

export const POST = userRoute(ManageKitchenSchema, async ({ supabase, user, input }) => {
  if (input.action === 'clear_demo') {
    defaultLedgerStore.clearDemoKitchens();
    return Response.json({ success: true, message: 'Data demo telah dibersihkan.' });
  }

  if (input.action === 'create') {
    if (!input.name || !input.code || !input.pjName || !input.bankCode || !input.accountNo || !input.openingBalance) {
      throw new HttpError(400, 'Seluruh isian dapur wajib dilengkapi.');
    }

    // 1. Simpan ke Supabase jika terhubung
    let createdId = crypto.randomUUID();
    let createdPeriodId = crypto.randomUUID();

    if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
      try {
        const realCreated = await createSupabaseKitchen(supabase, user.id, {
          name: input.name,
          code: input.code,
          pjName: input.pjName,
          bankCode: input.bankCode,
          accountNo: input.accountNo,
          openingBalance: BigInt(input.openingBalance),
          adminFeeDefault: input.adminFeeDefault ? BigInt(input.adminFeeDefault) : 6_500n,
        });
        createdId = realCreated.id;
        createdPeriodId = realCreated.periodId;
      } catch (err: unknown) {
        // Jika gagal di database nyata, lemparkan pesan galat sebenarnya
        throw new HttpError(
          500,
          err instanceof Error ? err.message : 'Gagal membuat dapur di database Supabase.',
        );
      }
    }

    // 2. Simpan juga ke in-memory store agar sinkron
    const created = defaultLedgerStore.createKitchen(user.id, {
      name: input.name,
      code: input.code,
      pjName: input.pjName,
      bankCode: input.bankCode,
      accountNoLast4: input.accountNo.slice(-4),
      openingBalance: BigInt(input.openingBalance),
      adminFeeDefault: input.adminFeeDefault ? BigInt(input.adminFeeDefault) : 6_500n,
    });

    return Response.json({
      success: true,
      kitchen: {
        id: createdId || created.id,
        code: input.code.toUpperCase(),
        name: input.name,
        pjName: input.pjName,
        bankCode: input.bankCode.toUpperCase(),
        accountNoLast4: input.accountNo.slice(-4),
        periodId: createdPeriodId || created.periodId,
      },
    });
  }

  throw new HttpError(400, 'Aksi tidak dikenali.');
});
