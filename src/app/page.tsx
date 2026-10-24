import { formatRupiah } from '@/lib/format';

export default function HomePage() {
  const openingSample = 120_000_000n;
  const incomingSample = 300_000_000n;
  const outgoingSample = 287_450_000n;
  const closingSample = openingSample + incomingSample - outgoingSample;

  return (
    <main className="mx-auto max-w-[1280px] px-8 py-12">
      <div className="mb-6 flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <span className="text-[18px] leading-[26px] font-semibold text-ink">
            Kasdapur
          </span>
          <span className="rounded-badge border border-line bg-surface-muted px-2 py-0.5 text-[12px] leading-[16px] font-medium text-ink-muted">
            Versi demo, data contoh
          </span>
        </div>
      </div>

      <section className="max-w-[72ch]">
        <h1 className="text-[44px] leading-[52px] font-semibold tracking-[-0.02em] text-ink">
          Dari bukti transfer ke buku kas Excel, tanpa mengetik ulang.
        </h1>
        <p className="mt-4 text-[16px] leading-[26px] text-ink-muted">
          Unggah bukti transfer (PDF atau JPG), periksa hasil bacaannya, lalu unduh buku kas dalam format Excel yang sama seperti biasa. Setiap dapur punya buku dan saldonya sendiri.
        </p>
        <p className="mt-3 text-[13px] leading-[18px] text-ink-subtle">
          Tanpa kata sandi bank. Sistem hanya menerima file yang Anda unggah.
        </p>
      </section>

      <section
        aria-label="Contoh strip persamaan saldo periode"
        className="mt-8 rounded-panel border border-line bg-surface px-6 py-5"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] leading-[18px] font-medium text-ink-muted">
            Persamaan saldo periode per dapur
          </span>
          <span className="rounded-badge border border-line bg-surface-muted px-2 py-0.5 text-[12px] leading-[16px] font-medium text-ink-muted">
            Data contoh
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <div className="text-[13px] leading-[20px] text-ink-muted">Saldo awal</div>
            <div className="tabular-nums text-[28px] leading-[36px] font-medium text-ink">
              {formatRupiah(openingSample)}
            </div>
            <div className="text-[12px] leading-[16px] text-ink-subtle">01 Mar 2026</div>
          </div>
          <div>
            <div className="text-[13px] leading-[20px] text-ink-muted">+ Dana masuk</div>
            <div className="tabular-nums text-[28px] leading-[36px] font-medium text-ink">
              {formatRupiah(incomingSample)}
            </div>
            <div className="text-[12px] leading-[16px] text-ink-subtle">2 transaksi</div>
          </div>
          <div>
            <div className="text-[13px] leading-[20px] text-ink-muted">− Dana keluar</div>
            <div className="tabular-nums text-[28px] leading-[36px] font-medium text-ink">
              {formatRupiah(outgoingSample)}
            </div>
            <div className="text-[12px] leading-[16px] text-ink-subtle">120 transaksi</div>
          </div>
          <div>
            <div className="text-[13px] leading-[20px] text-ink-muted">= Saldo akhir</div>
            <div
              aria-live="polite"
              className="tabular-nums text-[28px] leading-[36px] font-medium text-ink"
            >
              {formatRupiah(closingSample)}
            </div>
            <div className="text-[12px] leading-[16px] text-ink-subtle">per 28 Mar 2026</div>
          </div>
        </div>
      </section>
    </main>
  );
}
