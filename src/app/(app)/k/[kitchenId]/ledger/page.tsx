import React from 'react';
import { notFound } from 'next/navigation';
import { formatPeriodLabel } from '@/lib/format';
import { defaultLedgerStore } from '@/server/ledger/service';
import { defaultUploadStore } from '@/server/upload/service';
import {
  LedgerWorkspace,
  type SerializedKitchenInfo,
  type SerializedLedgerRow,
  type SerializedPeriodSummary,
} from '@/components/domain/LedgerWorkspace';

interface LedgerPageProps {
  params: Promise<{ kitchenId: string }>;
}

export default async function KitchenLedgerPage({ params }: LedgerPageProps) {
  const { kitchenId } = await params;

  let ledgerData;
  try {
    ledgerData = defaultLedgerStore.getKitchenLedger(kitchenId);
  } catch {
    notFound();
  }

  const periodLabel = formatPeriodLabel(
    ledgerData.kitchen.year,
    ledgerData.kitchen.month,
  );

  const serializedKitchen: SerializedKitchenInfo = {
    id: ledgerData.kitchen.id,
    code: ledgerData.kitchen.code,
    name: ledgerData.kitchen.name,
    pjName: ledgerData.kitchen.pjName,
    bankName: ledgerData.kitchen.bankCode,
    accountNumberMasked: `****${ledgerData.kitchen.accountNoLast4}`,
    adminFeeDefault: ledgerData.kitchen.adminFeeDefault.toString(),
    periodId: ledgerData.kitchen.periodId,
    year: ledgerData.kitchen.year,
    month: ledgerData.kitchen.month,
    periodLabel,
    periodStatus: ledgerData.kitchen.periodStatus,
  };

  let postedCounter = 0;
  const serializedRows: SerializedLedgerRow[] = ledgerData.rows.map((r) => {
    if (r.status === 'posted') {
      postedCounter += 1;
    }
    return {
      id: r.id,
      kitchenId: r.kitchenId ?? ledgerData.kitchen.id,
      periodId: r.periodId ?? ledgerData.kitchen.periodId,
      parentTransactionId: r.parentTransactionId ?? null,
      seqNo: r.seqNo,
      rowNo: postedCounter,
      txDate: r.txDate,
      kind: r.kind,
      referenceNo: r.referenceNo,
      description: r.description,
      counterpartyAccount: r.counterpartyAccount ?? null,
      counterpartyAccountLast4: r.counterpartyAccountLast4 ?? null,
      counterpartyName: r.counterpartyName ?? null,
      counterpartyBank: r.counterpartyBank ?? null,
      debit: r.debit.toString(),
      credit: r.credit.toString(),
      runningBalance: r.runningBalance.toString(),
      note: r.note ?? null,
      status: r.status,
      version: r.version ?? 1,
    };
  });

  const serializedSummary: SerializedPeriodSummary = {
    openingBalance: ledgerData.summary.openingBalance.toString(),
    totalIncoming: ledgerData.summary.totalIncoming.toString(),
    totalOutgoing: ledgerData.summary.totalOutgoing.toString(),
    closingBalance: ledgerData.summary.closingBalance.toString(),
  };

  const reviewQueueCount = defaultUploadStore.listKitchenUploads(
    kitchenId,
    'reviewable',
  ).length;

  return (
    <main className="space-y-5">
      <LedgerWorkspace
        kitchen={serializedKitchen}
        initialRows={serializedRows}
        initialSummary={serializedSummary}
        reviewQueueCount={reviewQueueCount}
      />
    </main>
  );
}
