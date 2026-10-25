'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';
import { PeriodEquation } from '@/components/domain/PeriodEquation';
import { setDemoSessionAction } from '@/server/auth/actions';

export default function LoginPage() {
  // Mode: 'credentials' -> 'mfa' -> 'success'
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');

  // Credentials state
  const [email, setEmail] = useState('maker@sintetis.example');
  const [password, setPassword] = useState('demo1234');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // MFA 6 digits state
  const [mfaDigits, setMfaDigits] = useState(['', '', '', '', '', '']);
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (step === 'mfa') {
      digitRefs.current[0]?.focus();
    }
  }, [step]);

  function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!email || !password) {
      setErrorMsg('Email dan kata sandi wajib diisi.');
      return;
    }

    setIsLoading(true);
    // Simulasi verifikasi langkah 1 (Kata sandi)
    setTimeout(() => {
      setIsLoading(false);
      setStep('mfa');
    }, 300);
  }

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
      {/* Kolom Kiri: Formulir (Maks 360px di Tengah) */}
      <div className="flex flex-col justify-between p-6 sm:p-12 lg:p-16">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] font-medium transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Beranda</span>
          </Link>
        </div>

        <div className="w-full max-w-[360px] mx-auto py-8 text-left">
          {/* Logo / Brand */}
          <div className="mb-6">
            <span className="text-sm font-semibold tracking-tight text-[var(--accent)]">
              Kasdapur
            </span>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-md bg-[var(--danger-subtle)] border border-[var(--danger)] text-xs text-[var(--danger)] flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 'credentials' ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
                  Masuk ke Kasdapur
                </h1>
                <p className="mt-1 text-xs text-[var(--ink-muted)] leading-relaxed">
                  Masukkan email dan kata sandi Anda untuk mengakses buku kas dapur.
                </p>
              </div>

              {/* Kartu Petunjuk Akun Demo */}
              <div className="rounded border border-[var(--line-subtle)] bg-[var(--surface-muted)] p-3 text-xs text-[var(--ink-muted)] leading-relaxed">
                <span className="font-semibold text-[var(--ink)]">Akun Demo Siap Pakai:</span>
                <div className="mt-1">
                  Email: <strong className="font-mono text-[var(--ink)]">maker@sintetis.example</strong>
                  <br />
                  Sandi: <strong className="font-mono text-[var(--ink)]">demo1234</strong>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email-input"
                  className="text-[13px] font-medium text-[var(--ink)]"
                >
                  Email
                </label>
                <input
                  id="email-input"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                  placeholder="maker@sintetis.example"
                />
              </div>

              {/* Kata Sandi */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password-input"
                    className="text-[13px] font-medium text-[var(--ink)]"
                  >
                    Kata Sandi
                  </label>
                </div>
                <div className="relative">
                  <input
                    id="password-input"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3 pr-10 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] hover:text-[var(--ink)]"
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="h-10 w-full rounded-md bg-[var(--accent)] text-sm font-semibold text-[var(--ink-on-accent,#fff)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-press)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-2 disabled:opacity-50"
              >
                {isLoading ? 'Memeriksa...' : 'Masuk'}
              </button>

              <div className="pt-2 text-center text-xs text-[var(--ink-muted)] border-t border-[var(--line)]">
                Akses hanya dengan undangan admin.
              </div>
            </form>
          ) : (
            /* Langkah MFA (DESIGN.md §7) */
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
                <button
                  type="button"
                  onClick={() => setStep('credentials')}
                  className="text-[var(--accent)] hover:underline"
                >
                  Kembali ke formulir login
                </button>
                <span className="text-[var(--ink-subtle)]">Mode demo: ketik angka apa saja</span>
              </div>
            </form>
          )}
        </div>

        <div className="text-xs text-[var(--ink-muted)] text-left">
          © 2026 Kasdapur. Khusus maker keuangan yayasan.
        </div>
      </div>

      {/* Kolom Kanan: Petrol Solid (#0B4F6C) (DESIGN.md §7) */}
      <div className="hidden lg:flex flex-col justify-between p-12 lg:p-16 bg-[#0B4F6C] text-white">
        <div className="flex justify-end">
          <span className="px-2.5 py-1 rounded text-xs bg-white/10 text-white border border-white/20">
            Data contoh sintetis
          </span>
        </div>

        <div className="max-w-lg space-y-6">
          <blockquote className="text-2xl font-medium tracking-tight text-white leading-snug">
            &ldquo;Setiap dapur punya buku dan saldonya sendiri.&rdquo;
          </blockquote>

          {/* Strip Persamaan Nyata dari Data Contoh */}
          <div className="rounded-lg bg-white p-5 text-[var(--ink)] border border-white/20">
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
              variant="full"
            />
          </div>

          <p className="text-xs text-white/80 leading-relaxed">
            Sistem tidak pernah menjumlahkan saldo lintas dapur. Angka saldo akhir
            dihitung otomatis melalui fungsi matematis murni.
          </p>
        </div>

        <div className="text-xs text-white/60">
          Keamanan ditegakkan di tingkat database (Row Level Security & Kunci Periode).
        </div>
      </div>
    </div>
  );
}
