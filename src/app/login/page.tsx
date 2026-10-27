'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { PeriodEquation } from '@/components/domain/PeriodEquation';
import { signInAction, verifyMfaAction } from '@/server/auth/actions';

export default function LoginPage() {
  // Mode: 'credentials' -> 'mfa' -> 'success'
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');

  // Credentials state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // MFA 6 digits state
  const [mfaDigits, setMfaDigits] = useState(['', '', '', '', '', '']);
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (step === 'mfa') {
      digitRefs.current[0]?.focus();
    }
  }, [step]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('confirmed') === 'true') {
        setSuccessMsg('Email berhasil dikonfirmasi! Silakan masuk dengan akun Anda.');
      } else if (params.get('password_updated') === 'true') {
        setSuccessMsg('Kata sandi berhasil diperbarui! Silakan masuk dengan kata sandi baru Anda.');
      }
    }
  }, []);

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !password) {
      setErrorMsg('Email dan kata sandi wajib diisi.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signInAction({ email, password });
      setIsLoading(false);

      if (result.error) {
        setErrorMsg(result.error);
        return;
      }

      if (result.needMfa) {
        setStep('mfa');
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err: unknown) {
      setIsLoading(false);
      setErrorMsg(
        err instanceof Error ? err.message : 'Terjadi galat autentikasi.',
      );
    }
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
      const result = await verifyMfaAction(code);
      if (result.error) {
        setIsLoading(false);
        setErrorMsg(result.error);
        return;
      }

      window.location.href = '/dashboard';
    } catch (err: unknown) {
      setIsLoading(false);
      setErrorMsg(
        err instanceof Error ? err.message : 'Terjadi galat verifikasi kode.',
      );
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[var(--canvas)]">
      {/* Kolom Kiri: Formulir (Maks 380px di Tengah) */}
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

        <div className="w-full max-w-[380px] mx-auto py-8 text-left">
          {/* Logo / Brand */}
          <div className="mb-6">
            <span className="text-base font-bold tracking-tight text-[var(--accent)]">
              Kasdapur
            </span>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-lg bg-[var(--danger-subtle)] border border-[var(--danger)] text-xs text-[var(--danger)] flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-lg bg-[var(--ok-subtle)] border border-[var(--ok)] text-xs text-[var(--ok)] flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {step === 'credentials' ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
                  Masuk ke Kasdapur
                </h1>
                <p className="mt-1 text-xs text-[var(--ink-muted)] leading-relaxed">
                  Gunakan email dan kata sandi akun Anda.
                </p>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email-input"
                  className="text-xs font-semibold text-[var(--ink)]"
                >
                  Email
                </label>
                <input
                  id="email-input"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-xs text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                  placeholder="nama@organisasi.id"
                />
              </div>

              {/* Kata Sandi */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password-input"
                    className="text-xs font-semibold text-[var(--ink)]"
                  >
                    Kata Sandi
                  </label>
                </div>
                <div className="relative">
                  <input
                    id="password-input"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 pr-10 text-xs text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                    placeholder="Masukkan kata sandi"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] hover:text-[var(--ink)]"
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="h-10 w-full rounded-lg bg-[var(--accent)] text-xs font-semibold text-white shadow-2xs hover:bg-[var(--accent-hover)] active:bg-[var(--accent-press)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-2 disabled:opacity-50"
              >
                {isLoading ? 'Memproses...' : 'Masuk ke Sistem'}
              </button>

              <div className="pt-2 text-center text-[11px] text-[var(--ink-muted)] border-t border-[var(--line)]">
                Akses khusus staf terotorisasi. Pendaftaran hanya melalui undangan Administrator.
              </div>
            </form>
          ) : (
            /* Langkah MFA */
            <form onSubmit={handleMfaSubmit} className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
                  Verifikasi Autentikator
                </h1>
                <p className="mt-1 text-xs text-[var(--ink-muted)] leading-relaxed">
                  Masukkan 6 digit kode dari aplikasi autentikator (TOTP) Anda.
                </p>
              </div>

              {/* 6 Digit Input Boxes */}
              <div className="flex justify-between gap-2">
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
                    onPaste={handlePaste}
                    className="h-12 w-11 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] text-center text-lg font-bold tabular-nums text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="h-10 w-full rounded-lg bg-[var(--accent)] text-xs font-semibold text-white shadow-2xs hover:bg-[var(--accent-hover)] active:bg-[var(--accent-press)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-2 disabled:opacity-50"
              >
                {isLoading ? 'Memverifikasi...' : 'Verifikasi & Masuk'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep('credentials')}
                  className="text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] underline"
                >
                  Kembali ke email & kata sandi
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="text-xs text-[var(--ink-muted)]">
          &copy; 2026 Kasdapur &bull; Khusus Pembukuan SPPG Yayasan
        </div>
      </div>

      {/* Kolom Kanan: Ilustrasi Pratinjau Produk Nyata */}
      <div className="hidden lg:flex flex-col justify-center items-center bg-[var(--surface-muted)] p-12 border-l border-[var(--line)]">
        <div className="w-full max-w-md space-y-6">
          <div className="text-left space-y-2">
            <span className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider">
              Pembukuan Terisolasi Per Dapur
            </span>
            <h2 className="text-xl font-bold tracking-tight text-[var(--ink)]">
              Dari bukti transfer ke buku kas Excel secara otomatis.
            </h2>
            <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
              Setiap dapur memiliki buku kas, saldo, dan rekening terpisah. Didukung verifikasi manusia sebelum posting dan ekspor Excel format Plombokan.
            </p>
          </div>

          {/* Strip Persamaan Pratinjau */}
          <PeriodEquation
            kitchenId="demo"
            periodStatus="open"
            openingBalance={15000000n}
            totalIncoming={32500000n}
            totalOutgoing={18750000n}
            closingBalance={28750000n}
            incomingCount={4}
            outgoingCount={12}
            draftCount={0}
            variant="compact"
          />
        </div>
      </div>
    </div>
  );
}
