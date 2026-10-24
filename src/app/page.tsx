import Link from 'next/link';
import { defaultLedgerStore } from '@/server/ledger/service';
import { DashboardSummary } from '@/components/domain/DashboardSummary';

export default function HomePage() {
  const kitchens = defaultLedgerStore.listKitchenMeta();

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink-base)] p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--neutral-subtle)] border border-[var(--line)] text-[var(--ink-muted)]">
              <span>Sintetis 100% · Mode Demo</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--ink-base)]">
              Kasdapur
            </h1>
            <p className="text-xs text-[var(--ink-muted)]">
              Pembukuan otomatis bukti transfer (PDF/JPG) ke Excel per dapur (SPPG).
            </p>
          </div>

          <div className="flex items-center gap-2">
            {kitchens[0] && (
              <Link
                href={`/k/${kitchens[0].id}/ledger`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[var(--accent)] text-xs font-semibold text-[var(--ink-on-accent,#fff)] hover:opacity-90 transition-opacity"
              >
                Buku Kas ({kitchens[0].code})
              </Link>
            )}
          </div>
        </header>

        <DashboardSummary kitchens={kitchens} selectedPeriodLabel="Maret 2026" />
      </div>
    </main>
  );
}
