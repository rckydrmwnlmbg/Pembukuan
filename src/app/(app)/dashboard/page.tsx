import { redirect } from 'next/navigation';
import { requireUser } from '@/server/auth/require-user';
import { defaultLedgerStore } from '@/server/ledger/service';
import { listUserKitchens } from '@/server/ledger/supabase-ledger';
import { DashboardSummary, type DashboardKitchenItem } from '@/components/domain/DashboardSummary';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const { user, supabase } = await requireUser();

  let kitchens: DashboardKitchenItem[] = [];

  // 1. Ambil dapur nyata milik pengguna dari Supabase
  if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
    try {
      const realKitchens = await listUserKitchens(supabase, user.id);
      kitchens = realKitchens.map((k) => ({
        id: k.id,
        organizationId: '00000000-0000-4000-8000-000000000001',
        code: k.code,
        name: k.name,
        pjName: k.pjName,
        bankCode: k.bankCode,
        accountNo: `****${k.accountNoLast4}`,
        accountNoLast4: k.accountNoLast4,
        adminFeeDefault: k.adminFeeDefault,
        highAmountThreshold: k.highAmountThreshold,
        periodId: k.periodId,
        year: k.year,
        month: k.month,
        openingBalance: k.openingBalance,
        periodStatus: k.periodStatus,
        nextPeriodOpeningBalance: null,
        pendingDraftCount: k.pendingDraftCount,
        needsManualCount: k.needsManualCount,
        lastUploadDate: k.lastUploadDate,
        summary: k.summary,
      }));
    } catch {
      kitchens = [];
    }
  }

  // 2. Fallback untuk sesi demo testing saja
  if (kitchens.length === 0 && user.id === '00000000-0000-4000-8000-000000000001') {
    kitchens = defaultLedgerStore.listKitchenMeta();
  }

  // Jika ada dapur dan tidak meminta tampilan daftar ringkasan, langsung buka Buku Kas dapur utama
  const primaryKitchen = kitchens[0];
  if (primaryKitchen && resolvedParams.view !== 'summary') {
    redirect(`/k/${primaryKitchen.id}/ledger`);
  }

  return (
    <div className="space-y-6">
      <DashboardSummary kitchens={kitchens} selectedPeriodLabel="Maret 2026" />
    </div>
  );
}
