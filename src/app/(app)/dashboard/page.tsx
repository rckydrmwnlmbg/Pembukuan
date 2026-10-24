import { defaultLedgerStore } from '@/server/ledger/service';
import { DashboardSummary } from '@/components/domain/DashboardSummary';

export default function DashboardPage() {
  const kitchens = defaultLedgerStore.listKitchenMeta();

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink-base)] p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <DashboardSummary kitchens={kitchens} selectedPeriodLabel="Maret 2026" />
      </div>
    </div>
  );
}
