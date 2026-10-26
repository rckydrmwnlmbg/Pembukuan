import React from 'react';
import { notFound } from 'next/navigation';
import { formatPeriodLabel } from '@/lib/format';
import { defaultLedgerStore } from '@/server/ledger/service';
import { defaultUploadStore } from '@/server/upload/service';
import { ReviewWorkspace } from '@/components/domain/ReviewWorkspace';

interface ReviewPageProps {
  params: Promise<{ kitchenId: string }>;
}

export default async function KitchenReviewPage({ params }: ReviewPageProps) {
  const { kitchenId } = await params;

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
    <main className="space-y-5">
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
