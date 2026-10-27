import React from 'react';
import { notFound } from 'next/navigation';
import { formatPeriodLabel } from '@/lib/format';
import { requireUser } from '@/server/auth/require-user';
import { defaultLedgerStore } from '@/server/ledger/service';
import { defaultUploadStore } from '@/server/upload/service';
import {
  getKitchenLedger as getSupabaseKitchenLedger,
  listSupabaseUploads,
} from '@/server/ledger/supabase-ledger';
import {
  LedgerWorkspace,
  type SerializedKitchenInfo,
  type SerializedLedgerRow,
  type SerializedPeriodSummary,
} from '@/components/domain/LedgerWorkspace';

export const dynamic = 'force-dynamic';

interface LedgerPageProps {
  params: Promise<{ kitchenId: string }>;
  searchParams?: Promise<{ periodId?: string }>;
}

export default async function KitchenLedgerPage({
  params,
  searchParams,
}: LedgerPageProps) {
  const { kitchenId } = await params;
  const { periodId: selectedPeriodId } = (await searchParams) ?? {};
  const { user, supabase } = await requireUser();

  let ledgerData;
  let availablePeriods: Array<{
    id: string;
    year: number;
    month: number;
    status: 'open' | 'locked';
    label: string;
  }> = [];

  // 1. Ambil dari database Supabase nyata
  if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
    try {
      const { data: pList } = await supabase
        .from('periods')
        .select('id, year, month, status')
        .eq('kitchen_id', kitchenId)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (pList && pList.length > 0) {
        availablePeriods = pList.map((p) => ({
          id: p.id,
          year: p.year,
          month: p.month,
          status: p.status as 'open' | 'locked',
          label: formatPeriodLabel(p.year, p.month),
        }));
      }

      ledgerData = await getSupabaseKitchenLedger(
        supabase,
        kitchenId,
        selectedPeriodId,
      );
    } catch {
      // Abaikan jika belum ada di database nyata
    }
  }

  // 2. Fallback in-memory jika mode demo/test
  if (!ledgerData) {
    try {
      ledgerData = defaultLedgerStore.getKitchenLedger(kitchenId, {
        periodId: selectedPeriodId,
      });
    } catch {
      notFound();
    }
  }

  const periodLabel = formatPeriodLabel(
    ledgerData.kitchen.year,
    ledgerData.kitchen.month,
  );

  if (availablePeriods.length === 0) {
    availablePeriods = [
      {
        id: ledgerData.kitchen.periodId,
        year: ledgerData.kitchen.year,
        month: ledgerData.kitchen.month,
        status: ledgerData.kitchen.periodStatus,
        label: periodLabel,
      },
    ];
  }

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

  let reviewQueueCount = 0;
  if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
    try {
      const reviewable = await listSupabaseUploads(supabase, kitchenId, 'reviewable');
      reviewQueueCount = reviewable.length;
    } catch {
      reviewQueueCount = 0;
    }
  } else {
    reviewQueueCount = defaultUploadStore.listKitchenUploads(
      kitchenId,
      'reviewable',
    ).length;
  }

  return (
    <main className="space-y-5">
      <LedgerWorkspace
        kitchen={serializedKitchen}
        availablePeriods={availablePeriods}
        initialRows={serializedRows}
        initialSummary={serializedSummary}
        reviewQueueCount={reviewQueueCount}
      />
    </main>
  );
}
