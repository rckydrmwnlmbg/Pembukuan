import React from 'react';
import { notFound } from 'next/navigation';
import { formatPeriodLabel } from '@/lib/format';
import { defaultLedgerStore } from '@/server/ledger/service';
import { defaultUploadStore } from '@/server/upload/service';
import { DapurSwitcher } from '@/components/domain/DapurSwitcher';
import { ReviewWorkspace } from '@/components/domain/ReviewWorkspace';

interface ReviewPageProps {
  params: Promise<{ kitchenId: string }>;
}

export default async function KitchenReviewPage({ params }: ReviewPageProps) {
  const { kitchenId } = await params;

  const allKitchens = defaultLedgerStore.listKitchenMeta();
  const switcherOptions = allKitchens.map((k) => ({
    id: k.id,
    code: k.code,
    name: k.name,
    periodLabel: formatPeriodLabel(k.year, k.month),
    periodStatus: k.periodStatus,
  }));

  let ledgerData;
  try {
    ledgerData = defaultLedgerStore.getKitchenLedger(kitchenId);
  } catch {
    notFound();
  }

  const uploads = defaultUploadStore.listKitchenUploads(
    kitchenId,
    'reviewable',
  );

  return (
    <main className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-subtle bg-surface px-4 py-2.5">
        <DapurSwitcher
          activeKitchenId={ledgerData.kitchen.id}
          kitchens={switcherOptions}
        />
        <span className="text-xs text-ink-muted">
          Manusia memeriksa sebelum posting — tidak ada posting otomatis
        </span>
      </div>

      <ReviewWorkspace
        kitchen={{
          id: ledgerData.kitchen.id,
          code: ledgerData.kitchen.code,
          name: ledgerData.kitchen.name,
          bankCode: ledgerData.kitchen.bankCode,
          accountNoLast4: ledgerData.kitchen.accountNoLast4,
          adminFeeDefault: ledgerData.kitchen.adminFeeDefault.toString(),
          periodId: ledgerData.kitchen.periodId,
          periodLabel: formatPeriodLabel(
            ledgerData.kitchen.year,
            ledgerData.kitchen.month,
          ),
          periodStatus: ledgerData.kitchen.periodStatus,
        }}
        initialUploads={uploads}
      />
    </main>
  );
}
