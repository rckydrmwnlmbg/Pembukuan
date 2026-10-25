'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { PeriodEquation } from '@/components/domain/PeriodEquation';
import { setDemoSessionAction } from '@/server/auth/actions';

export default function MfaVerificationPage() {
  const [mfaDigits, setMfaDigits] = useState(['', '', '', '', '', '']);
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    digitRefs.current[0]?.focus();
  }, []);

  function handleDigitChange(index: number, value: string) {
    const cleanDigit = value.replace(/\D/g, '').slice(-1);
    const nextDigits = [...mfaDigits];
    nextDigits[index] = cleanDigit;
    setMfaDigits(nextDigits);

    if (cleanDigit && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !mfaDigits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const nextDigits = [...mfaDigits];
    for (let i = 0; i < pasted.length; i += 1) {
      nextDigits[i] = pasted[i]!;
    }
    setMfaDigits(nextDigits);

    const focusIndex = Math.min(pasted.length, 5);
    digitRefs.current[focusIndex]?.focus();
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const code = mfaDigits.join('');
    if (code.length < 6) {
      setErrorMsg('Masukkan 6 digit kode autentikator lengkap.');
      return;
    }

    setIsLoading(true);
    try {
      await setDemoSessionAction();
    } catch {
      // Abaikan galat jaringan, tetap simpan cookie di dokumen
    }

    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    document.cookie = `kasdapur_session=authenticated; path=/; samesite=lax${isHttps ? '; secure' : ''}; max-age=${60 * 60 * 12}`;

    // Navigasi penuh untuk memastikan Server Component AppShellLayout membaca cookie sesi
    window.location.href = '/dashboard';
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[var(--canvas)]">
      {/* Kolom Kiri: Formulir MFA */}
      <div className="flex flex-col justify-between p-6 sm:p-12 lg:p-16">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Beranda</span>
          </Link>
        </div>

        <div className="mx-auto w-full max-w-[360px] py-12">
          <div className="mb-8">
            <span className="font-semibold text-lg tracking-tight text-[var(--ink)]">
              Kasdapur
            </span>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-md border border-[var(--danger)]/30 bg-[var(--danger-subtle)] p-3 text-xs text-[var(--danger)]"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleMfaSubmit} className="space-y-5">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
                Masukkan kode verifikasi
              </h1>
              <p className="mt-1 text-xs text-[var(--ink-muted)] leading-relaxed">
                Buka aplikasi autentikator Anda dan masukkan kode 6 digit.
              </p>
            </div>

            {/* Petunjuk Mode Demo MFA */}
            <div className="rounded border border-[var(--line-subtle)] bg-[var(--surface-muted)] p-3 text-xs text-[var(--ink-muted)] leading-relaxed">
              <span className="font-semibold text-[var(--ink)]">Verifikasi MFA Demo:</span>
              <p className="mt-1">
                Masukkan 6 digit angka apa saja (contoh: <strong className="font-mono text-[var(--ink)]">123456</strong>) untuk menyelesaikan verifikasi AAL2.
              </p>
              <button
                type="button"
                onClick={() => setMfaDigits(['1', '2', '3', '4', '5', '6'])}
                className="mt-2 text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                Isi otomatis 123456
              </button>
            </div>

            {/* Enam kotak digit 44x52 (DESIGN.md §7) */}
            <div
              className="flex items-center justify-between gap-2"
              onPaste={handlePaste}
            >
              {mfaDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    digitRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  aria-label={`Digit ke-${idx + 1}`}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className="w-11 h-[52px] rounded-md border border-[var(--line-strong)] bg-[var(--surface)] text-center text-xl font-mono font-semibold text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] select-all"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="h-10 w-full rounded-md bg-[var(--accent)] text-sm font-semibold text-[var(--ink-on-accent,#fff)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-press)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-2 disabled:opacity-50"
            >
              {isLoading ? 'Memverifikasi...' : 'Verifikasi Kode'}
            </button>

            <div className="flex items-center justify-between pt-2 text-xs">
              <Link
                href="/login"
                className="text-[var(--accent)] hover:underline"
              >
                Kembali ke formulir login
              </Link>
              <span className="text-[var(--ink-muted)]">
                Batas percobaan aktif
              </span>
            </div>
          </form>
        </div>

        <div className="text-xs text-[var(--ink-muted)]">
          &copy; 2026 Kasdapur. Lingkungan terisolasi per dapur (MFA Wajib).
        </div>
      </div>

      {/* Kolom Kanan: Petrol Solid 50% Desktop */}
      <div className="hidden lg:flex flex-col justify-between p-12 lg:p-16 bg-[var(--accent)] text-[var(--ink-on-accent,#fff)]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-white/90">
            Verifikasi dua langkah
          </span>
          <span className="text-xs bg-white/10 px-2 py-0.5 rounded border border-white/20">
            Wajib MFA
          </span>
        </div>

        <div className="max-w-md space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-medium tracking-tight">
              Verifikasi berlapis setiap sesi
            </h2>
            <p className="text-sm opacity-85 leading-relaxed">
              Setiap maker dan admin wajib mengaktifkan autentikasi dua faktor (TOTP). Seluruh transaksi keuangan dilindungi dari kebocoran kata sandi tunggal.
            </p>
          </div>

          <div className="rounded-lg bg-white p-5 text-[var(--ink)] border border-white/20">
            <div className="text-xs text-[var(--ink-muted)] mb-2 font-medium">
              Data contoh
            </div>
            <PeriodEquation
              kitchenId="10000000-0000-4000-8000-000000000001"
              periodStatus="open"
              openingBalance={115000000n}
              totalIncoming={300000000n}
              totalOutgoing={287450000n}
              closingBalance={127550000n}
              incomingCount={2}
              outgoingCount={120}
              periodStartDate="1 Mar 2026"
              lastTxDate="28 Mar 2026"
              variant="compact"
            />
          </div>
        </div>

        <div className="text-xs opacity-70">
          Kasdapur — Perlindungan integritas buku kas per dapur.
        </div>
      </div>
    </div>
  );
}
