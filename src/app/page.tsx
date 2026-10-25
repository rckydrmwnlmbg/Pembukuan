'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  ChevronDown,
  Check,
} from 'lucide-react';
import { PeriodEquation } from '@/components/domain/PeriodEquation';

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'Apakah sistem ini mengakses rekening atau internet banking saya?',
      a: 'Tidak. Kasdapur tidak pernah menyentuh akun bank Anda. Sistem tidak pernah meminta PIN, kata sandi internet banking, atau OTP transaksi. Sistem hanya memproses berkas bukti transfer (PDF atau JPG/PNG) yang Anda unggah secara sadar.',
    },
    {
      q: 'Bukti transfer dari bank mana saja yang dapat dibaca?',
      a: 'Sistem dapat membaca bukti transfer umum (PDF, JPG, PNG) dari berbagai bank di Indonesia seperti BNI, BRI, Mandiri, BCA, dan bank daerah. Seluruh hasil ekstraksi selalu berstatus draf dan wajib diperiksa maker sebelum disimpan.',
    },
    {
      q: 'Apa yang terjadi jika bukti transfer buram atau tidak terbaca?',
      a: 'Berkas masuk ke status "Perlu input manual". Sistem menganut prinsip gagal aman (fail-safe) dan dilarang keras menebak angka atau tanggal. Anda dapat mengetik langsung nominal dan referensi berdasarkan dokumen fisik.',
    },
    {
      q: 'Siapa yang dapat melihat pembukuan dan saldo dapur saya?',
      a: 'Hanya pengguna terotorisasi yang terdaftar di dapur tersebut. Isolasi ditegakkan langsung di mesin database PostgreSQL melalui Row Level Security (RLS). Pengguna di Dapur A tidak dapat membaca atau menulis data Dapur B.',
    },
    {
      q: 'Apakah berkas bukti transfer dikirim ke layanan pihak ketiga?',
      a: 'Ya, saat mode AI aktif, berkas bukti transfer dikirim ke penyedia model bahasa besar (LLM) hanya untuk mengekstraksi teks transaksi (tanggal, referensi, nominal, penerima). Hasil ekstraksi selalu diperiksa oleh manusia sebelum diposting ke buku kas.',
    },
    {
      q: 'Apakah saya tetap bisa mengunduh file Excel seperti pembukuan lama?',
      a: 'Ya. Anda dapat mengunduh buku kas kapan saja dalam format .xlsx dengan posisi kolom, lebar sel, dan rumus saldo yang persis sama dengan lembar kerja Excel Dapur Plombokan.',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      {/* 1. Header (64px) — DESIGN.md §6 */}
      <header className="h-16 border-b border-[var(--line)] bg-[var(--surface)] px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold tracking-tight text-[var(--accent)]">
            Kasdapur
          </span>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[11px] font-mono bg-[var(--neutral-subtle)] text-[var(--ink-muted)] border border-[var(--line)]">
            Versi demo · Data contoh
          </span>
        </div>

        <nav className="flex items-center gap-6 text-xs text-[var(--ink-muted)]">
          <a href="#cara-kerja" className="hover:text-[var(--ink)] transition-colors hidden md:inline">
            Cara kerja
          </a>
          <a href="#keamanan" className="hover:text-[var(--ink)] transition-colors hidden md:inline">
            Keamanan
          </a>
          <a href="#tanya-jawab" className="hover:text-[var(--ink)] transition-colors hidden sm:inline">
            Tanya jawab
          </a>
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-xs font-semibold text-[var(--ink-on-accent,#fff)] hover:bg-[var(--accent-hover)] transition-colors"
          >
            Masuk
          </Link>
        </nav>
      </header>

      {/* 2. Hero — DESIGN.md §6 */}
      <section className="px-4 sm:px-8 py-12 sm:py-20 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Kolom Kiri Hero */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <h1 className="text-3xl sm:text-[44px] sm:leading-[52px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
              Dari bukti transfer ke buku kas Excel, tanpa mengetik ulang.
            </h1>

            <p className="text-sm sm:text-base text-[var(--ink-muted)] leading-relaxed max-w-xl">
              Unggah bukti transfer (PDF atau JPG), periksa hasil bacaannya, lalu
              unduh buku kas dalam format Excel yang sama seperti biasa. Setiap
              dapur punya buku dan saldonya sendiri.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--ink-on-accent,#fff)] hover:bg-[var(--accent-hover)] transition-colors"
              >
                Masuk
              </Link>
              <a
                href="#cara-kerja"
                className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors"
              >
                Lihat cara kerja
              </a>
            </div>

            <p className="text-xs text-[var(--ink-muted)] pt-1">
              Tanpa kata sandi bank. Sistem hanya menerima file yang Anda unggah.
            </p>
          </div>

          {/* Kolom Kanan Hero: Komponen Produk Sungguhan berdata sintetis (DESIGN.md §6) */}
          <div className="lg:col-span-5 relative">
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm overflow-hidden max-h-[460px]">
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-2 mb-3">
                <span className="text-xs font-semibold text-[var(--ink)]">
                  Dapur Sintetis Cempaka (DS-CMP)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--neutral-subtle)] text-[var(--ink-muted)]">
                  Data contoh
                </span>
              </div>

              {/* Strip Persamaan Nyata */}
              <div className="mb-3">
                <PeriodEquation
                  kitchenId="10000000-0000-4000-8000-000000000001"
                  periodStatus="open"
                  openingBalance={115000000n}
                  totalIncoming={300000000n}
                  totalOutgoing={287450000n}
                  closingBalance={127550000n}
                  incomingCount={2}
                  outgoingCount={120}
                  variant="compact"
                />
              </div>

              {/* Cuplikan Baris Tabel Asli */}
              <div className="border border-[var(--line)] rounded overflow-hidden text-[11px] font-mono">
                <div className="bg-[var(--surface-muted)] px-3 py-1.5 font-medium text-[var(--ink-muted)] border-b border-[var(--line)] flex justify-between">
                  <span>DESKRIPSI</span>
                  <span>KREDIT</span>
                </div>
                <div className="divide-y divide-[var(--line)] bg-[var(--surface)]">
                  <div className="px-3 py-2 flex justify-between">
                    <span className="truncate pr-2">PERPINDAHAN SALDO FEBRUARI</span>
                    <span className="text-[var(--ink-muted)]">—</span>
                  </div>
                  <div className="px-3 py-2 flex justify-between">
                    <span className="truncate pr-2">Bahan sayur UD Pangan Segar</span>
                    <span className="font-semibold">Rp 3.450.000</span>
                  </div>
                  <div className="px-3 py-2 flex justify-between">
                    <span className="truncate pr-2">ADMIN BANK BRI</span>
                    <span>Rp 6.500</span>
                  </div>
                  <div className="px-3 py-2 flex justify-between opacity-40">
                    <span className="truncate pr-2">Honorarium relawan minggu ke-3</span>
                    <span>Rp 7.500.000</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Cara Kerja (3 Langkah) — DESIGN.md §6 */}
      <section id="cara-kerja" className="border-t border-[var(--line)] bg-[var(--surface)] py-16 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-left space-y-2">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--ink)]">
              Cara kerja tiga langkah
            </h2>
            <p className="text-xs text-[var(--ink-muted)]">
              Alur terstruktur yang membebaskan maker dari pengetikan ulang berulang kali.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {/* Langkah 1 */}
            <div className="rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-white">
                  1
                </span>
                <h3 className="text-sm font-semibold text-[var(--ink)]">
                  Unggah bukti transfer
                </h3>
              </div>
              <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                Tarik dan lepaskan hingga 20 berkas sekaligus (PDF, JPG, PNG). Sistem
                secara otomatis membersihkan EXIF dan mendeteksi nomor rekening pengirim.
              </p>
            </div>

            {/* Langkah 2 */}
            <div className="rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-white">
                  2
                </span>
                <h3 className="text-sm font-semibold text-[var(--ink)]">
                  Periksa dan simpan
                </h3>
              </div>
              <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                AI mengekstrak tanggal, referensi, dan nominal ke layar draf. Maker
                memeriksa dan mengonfirmasi dengan sekali tekan Ctrl+Enter.
              </p>
            </div>

            {/* Langkah 3 */}
            <div className="rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-white">
                  3
                </span>
                <h3 className="text-sm font-semibold text-[var(--ink)]">
                  Unduh Excel persis
                </h3>
              </div>
              <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                Buku kas terisi otomatis dengan rumus saldo berantai. Unduh file
                .xlsx berformat persis lembar kerja baku yayasan.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Saldo Terpisah per Dapur — DESIGN.md §6 */}
      <section className="border-t border-[var(--line)] py-16 px-4 sm:px-8 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center text-left">
          <div className="lg:col-span-5 space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--ink)]">
              Saldo tiap dapur dijaga terpisah
            </h2>
            <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
              Setiap SPPG memiliki buku kas dan saldo berjalan independen. Tidak ada
              angka yang dicampur atau dijumlahkan lintas dapur. Strip persamaan
              menjadi cermin dari baris SISA UANG di Excel yang dapat Anda percaya.
            </p>
          </div>

          <div className="lg:col-span-7">
            <PeriodEquation
              kitchenId="10000000-0000-4000-8000-000000000001"
              periodStatus="open"
              openingBalance={115000000n}
              totalIncoming={300000000n}
              totalOutgoing={287450000n}
              closingBalance={127550000n}
              incomingCount={2}
              outgoingCount={120}
              variant="full"
            />
          </div>
        </div>
      </section>

      {/* 5. Keamanan Nyata (Terimplementasi Penuh) — DESIGN.md §6 & SECURITY.md */}
      <section id="keamanan" className="border-t border-[var(--line)] bg-[var(--surface)] py-16 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto space-y-8 text-left">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--ok-subtle)] text-[var(--ok)] border border-[var(--ok)]/30 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Standar Keamanan Enterprise</span>
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--ink)]">
              Keamanan yang benar-benar diterapkan
            </h2>
            <p className="text-xs text-[var(--ink-muted)] mt-1">
              Daftar perlindungan nyata sesuai arsitektur sistem. Tanpa klaim kosong.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
            <div className="p-4 rounded-md border border-[var(--line)] bg-[var(--canvas)] space-y-2">
              <div className="font-semibold text-[var(--ink)] flex items-center gap-1.5">
                <Check className="w-4 h-4 text-[var(--ok)]" />
                <span>Autentikasi Dua Langkah (AAL2)</span>
              </div>
              <p className="text-[var(--ink-muted)] leading-relaxed">
                Seluruh akun maker dan admin wajib mengaktifkan MFA via aplikasi
                autentikator (TOTP) untuk mengakses sistem.
              </p>
            </div>

            <div className="p-4 rounded-md border border-[var(--line)] bg-[var(--canvas)] space-y-2">
              <div className="font-semibold text-[var(--ink)] flex items-center gap-1.5">
                <Check className="w-4 h-4 text-[var(--ok)]" />
                <span>Isolasi Basis Data (RLS)</span>
              </div>
              <p className="text-[var(--ink-muted)] leading-relaxed">
                Tabel dilindungi Row Level Security ketat. Pengguna Dapur A diblokir
                di tingkat database dari membaca data Dapur B.
              </p>
            </div>

            <div className="p-4 rounded-md border border-[var(--line)] bg-[var(--canvas)] space-y-2">
              <div className="font-semibold text-[var(--ink)] flex items-center gap-1.5">
                <Check className="w-4 h-4 text-[var(--ok)]" />
                <span>Enkripsi Rekening AES-256-GCM</span>
              </div>
              <p className="text-[var(--ink-muted)] leading-relaxed">
                Nomor rekening tersimpan terenkripsi. Antarmuka hanya menampilkan 4
                digit terakhir untuk verifikasi.
              </p>
            </div>

            <div className="p-4 rounded-md border border-[var(--line)] bg-[var(--canvas)] space-y-2">
              <div className="font-semibold text-[var(--ink)] flex items-center gap-1.5">
                <Check className="w-4 h-4 text-[var(--ok)]" />
                <span>Jejak Audit Append-Only</span>
              </div>
              <p className="text-[var(--ink-muted)] leading-relaxed">
                Setiap aksi simpan, ubah, void, dan kunci periode dicatat permanen di
                audit_logs dan tidak dapat dihapus.
              </p>
            </div>

            <div className="p-4 rounded-md border border-[var(--line)] bg-[var(--canvas)] space-y-2">
              <div className="font-semibold text-[var(--ink)] flex items-center gap-1.5">
                <Check className="w-4 h-4 text-[var(--ok)]" />
                <span>Kunci Periode di Database</span>
              </div>
              <p className="text-[var(--ink-muted)] leading-relaxed">
                Trigger database menolak seluruh mutasi pada periode yang telah
                dikunci, bahkan dari sesi administrator.
              </p>
            </div>

            <div className="p-4 rounded-md border border-[var(--line)] bg-[var(--canvas)] space-y-2">
              <div className="font-semibold text-[var(--ink)] flex items-center gap-1.5">
                <Check className="w-4 h-4 text-[var(--ok)]" />
                <span>AI Terkendali & Manusia Memeriksa</span>
              </div>
              <p className="text-[var(--ink-muted)] leading-relaxed">
                Hasil AI selalu draf sampai dikonfirmasi maker. Mode manual tersedia
                tanpa panggilan jaringan keluar sama sekali.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Tanya Jawab (Akordeon Bersih) — DESIGN.md §6 */}
      <section id="tanya-jawab" className="border-t border-[var(--line)] py-16 px-4 sm:px-8 max-w-4xl mx-auto">
        <div className="space-y-8 text-left">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--ink)]">
              Pertanyaan yang sering diajukan
            </h2>
            <p className="text-xs text-[var(--ink-muted)] mt-1">
              Jawaban transparan untuk maker dan pengurus yayasan.
            </p>
          </div>

          <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className="py-4">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between text-left text-xs font-semibold text-[var(--ink)] hover:text-[var(--accent)] transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-[var(--ink-muted)] transition-transform duration-150 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="mt-2 text-xs text-[var(--ink-muted)] leading-relaxed">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. Penutup & Footer — DESIGN.md §6 */}
      <footer className="border-t border-[var(--line)] bg-[var(--surface)] py-10 px-4 sm:px-8 text-xs text-[var(--ink-muted)]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <div className="font-semibold text-[var(--ink)]">Kasdapur</div>
            <div>Pembukuan otomatis bukti transfer ke buku kas Excel per dapur (SPPG).</div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--accent)] px-4 font-semibold text-[var(--ink-on-accent,#fff)] hover:bg-[var(--accent-hover)] transition-colors"
            >
              Masuk ke Aplikasi
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
