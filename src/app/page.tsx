import Link from 'next/link';
import { formatPeriodLabel, formatRupiah } from '@/lib/format';
import { defaultLedgerStore } from '@/server/ledger/service';

export default function HomePage() {
  const kitchens = defaultLedgerStore.listKitchenMeta();

  return (
    <main className="min-h-screen bg-canvas text-ink-primary p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line-subtle pb-4">
          <div>
            <span className="inline-block rounded-sm bg-accent-subtle px-2 py-0.5 text-xs font-medium text-accent-primary">
              Data contoh
            </span>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-primary">
              Kasdapur
            </h1>
            <p className="text-sm text-ink-secondary">
              Pembukuan buku kas otomatis per dapur (SPPG) dari bukti transfer ke
              Excel berformat sumber Plombokan.
            </p>
          </div>

          {kitchens[0] ? (
            <Link
              href={`/k/${kitchens[0].id}/ledger`}
              className="inline-flex h-9 items-center justify-center rounded-md bg-accent-primary px-4 text-sm font-medium text-ink-on-accent transition-colors hover:bg-accent-primary-hover"
            >
              Buka Buku Kas ({kitchens[0].name})
            </Link>
          ) : null}
        </header>

        <section
          aria-labelledby="kitchen-list-heading"
          className="rounded-lg border border-line-subtle bg-surface p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="kitchen-list-heading"
              className="text-lg font-semibold text-ink-primary"
            >
              Pilih Dapur (Isolasi Buku Kas per Dapur — M2)
            </h2>
            <span className="text-xs text-ink-muted">
              Aturan emas #1: Tidak ada total gabungan lintas dapur
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {kitchens.map((kitchen) => (
              <article
                key={kitchen.id}
                className="flex flex-col justify-between rounded-md border border-line-subtle bg-surface-subtle p-4 space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-ink-primary">
                      {kitchen.name}
                    </h3>
                    <span className="rounded-sm border border-line-subtle bg-surface px-2 py-0.5 font-mono text-xs text-ink-secondary">
                      {kitchen.code}
                    </span>
                  </div>
                  <p className="text-xs text-ink-secondary">
                    PJ: {kitchen.pjName} · {kitchen.bankCode} ****
                    {kitchen.accountNoLast4} · Periode{' '}
                    {formatPeriodLabel(kitchen.year, kitchen.month)} (
                    {kitchen.periodStatus === 'locked' ? 'Terkunci' : 'Terbuka'})
                  </p>
                  <dl className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div>
                      <dt className="text-ink-muted">Saldo awal</dt>
                      <dd className="font-medium text-ink-primary tabular-nums">
                        {formatRupiah(kitchen.summary.openingBalance)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">Saldo akhir (Sisa uang)</dt>
                      <dd className="font-semibold text-accent-primary tabular-nums">
                        {formatRupiah(kitchen.summary.closingBalance)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-line-subtle pt-3">
                  <Link
                    href={`/k/${kitchen.id}/ledger`}
                    className="inline-flex h-8 items-center justify-center rounded-md bg-accent-primary px-3 text-xs font-medium text-ink-on-accent transition-colors hover:bg-accent-primary-hover"
                  >
                    Buka Buku Kas
                  </Link>
                  <Link
                    href={`/k/${kitchen.id}/review`}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-line-strong bg-surface px-3 text-xs font-medium text-ink-primary transition-colors hover:bg-surface-subtle"
                  >
                    Unggah & Review
                  </Link>
                  <a
                    href={`/api/k/${kitchen.id}/export/xlsx?periodId=${kitchen.periodId}`}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-line-strong bg-surface px-3 text-xs font-medium text-ink-primary transition-colors hover:bg-surface-subtle"
                  >
                    Ekspor Excel (.xlsx)
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
