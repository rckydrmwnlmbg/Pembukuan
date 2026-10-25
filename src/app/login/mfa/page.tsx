'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react';
import { PeriodEquation } from '@/components/domain/PeriodEquation';

export default function MfaVerificationPage() {
  const router = useRouter();

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

  function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const code = mfaDigits.join('');
    if (code.length < 6) {
      setErrorMsg('Masukkan 6 digit kode autentikator lengkap.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      document.cookie = 'kasdapur_session=authenticated; path=/; samesite=lax';
      setIsLoading(false);
      router.push('/dashboard');
    }, 500);
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
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--ok-subtle)] text-[var(--ok)] border border-[var(--ok)]/30 mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Autentikasi Dua Langkah (AAL2)</span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
                Masukkan kode verifikasi
              </h1>
              <p className="mt-1 text-xs text-[var(--ink-muted)] leading-relaxed">
                Buka aplikasi autentikator Anda dan masukkan kode 6 digit.
              </p>
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
          <span className="text-xs font-semibold tracking-wider uppercase opacity-80">
            Standar Keamanan S-01
          </span>
          <span className="text-xs bg-white/10 px-2 py-0.5 rounded border border-white/20">
            AAL2 Required
          </span>
        </div>

        <div className="max-w-md space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">
              Verifikasi Berlapis Setiap Sesi
            </h2>
            <p className="text-sm opacity-85 leading-relaxed">
              Setiap maker dan admin wajib mengaktifkan autentikasi dua faktor (TOTP). Seluruh transaksi keuangan dilindungi dari kebocoran kata sandi tunggal.
            </p>
          </div>

          <div className="rounded-lg bg-black/20 p-4 border border-white/15 backdrop-blur-none">
            <div className="text-xs font-mono mb-2 opacity-75">
              Live Equation Monitor (Data Contoh)
            </div>
            <PeriodEquation
              openingBalance={50_000_000n}
              incoming={12_500_000n}
              outgoing={8_200_000n}
              closingBalance={54_300_000n}
              isLocked={false}
              draftCount={0}
              variant="compact"
            />
          </div>
        </div>

        <div className="text-xs opacity-70">
          Kasdapur &bull; Perlindungan Integritas Buku Kas &bull; Versi 0.2
        </div>
      </div>
    </div>
  );
}
