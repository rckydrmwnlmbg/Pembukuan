import { redirect } from 'next/navigation';
import { defaultLedgerStore } from '@/server/ledger/service';
import { DashboardSummary } from '@/components/domain/DashboardSummary';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const kitchens = defaultLedgerStore.listKitchenMeta();

  // Jika ada dapur dan pengguna tidak secara eksplisit meminta tampilan ringkasan (?view=summary),
  // langsung arahkan ke Buku Kas dapur utama sesuai preferensi alur kerja
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
