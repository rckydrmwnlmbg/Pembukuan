import React from 'react';
import { notFound } from 'next/navigation';
import { formatPeriodLabel } from '@/lib/format';
import { requireUser } from '@/server/auth/require-user';
import { defaultLedgerStore } from '@/server/ledger/service';
import { defaultUploadStore, type UploadRecord } from '@/server/upload/service';
import {
  getKitchenLedger as getSupabaseKitchenLedger,
  listSupabaseUploads,
} from '@/server/ledger/supabase-ledger';
import { ReviewWorkspace } from '@/components/domain/ReviewWorkspace';

export const dynamic = 'force-dynamic';

interface ReviewPageProps {
  params: Promise<{ kitchenId: string }>;
}

interface ReviewKitchenMeta {
  id: string;
  code: string;
  name: string;
  bankCode: string;
  accountNoLast4: string;
  adminFeeDefault: bigint;
  periodId: string;
  year: number;
  month: number;
  periodStatus: 'open' | 'locked';
}

export default async function KitchenReviewPage({ params }: ReviewPageProps) {
  const { kitchenId } = await params;
  const { user, supabase } = await requireUser();

  let kitchenMeta: ReviewKitchenMeta | undefined;
  let uploads: UploadRecord[] = [];

  // 1. Ambil data dapur dan antrean unggahan dari Supabase nyata
  if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
    try {
      const res = await getSupabaseKitchenLedger(supabase, kitchenId);
      kitchenMeta = res.kitchen;
      uploads = await listSupabaseUploads(supabase, kitchenId, 'reviewable');
    } catch {
      // Abaikan jika bukan dapur nyata
    }
  }

  // 2. Fallback untuk sesi demo testing
  if (!kitchenMeta) {
    try {
      const ledgerData = defaultLedgerStore.getKitchenLedger(kitchenId);
      kitchenMeta = ledgerData.kitchen;
      uploads = defaultUploadStore.listKitchenUploads(kitchenId, 'reviewable');
    } catch {
      notFound();
    }
  }

  if (!kitchenMeta) {
    notFound();
  }

  return (
    <main className="space-y-5">
      <ReviewWorkspace
        kitchen={{
          id: kitchenMeta.id,
          code: kitchenMeta.code,
          name: kitchenMeta.name,
          bankCode: kitchenMeta.bankCode,
          accountNoLast4: kitchenMeta.accountNoLast4,
          adminFeeDefault: kitchenMeta.adminFeeDefault.toString(),
          periodId: kitchenMeta.periodId,
          periodLabel: formatPeriodLabel(kitchenMeta.year, kitchenMeta.month),
          periodStatus: kitchenMeta.periodStatus,
        }}
        initialUploads={uploads}
      />
    </main>
  );
}
