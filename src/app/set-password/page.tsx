'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, Lock, ShieldCheck } from 'lucide-react';
import { setPasswordAction } from '@/server/auth/actions';
import { validatePassword } from '@/lib/validation/password';

export default function SetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Kata sandi tidak memenuhi kriteria keamanan.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await setPasswordAction({ password });
      setIsLoading(false);

      if (result.error) {
        setErrorMsg(result.error);
        return;
      }

      // Berhasil, alihkan ke dasbor
      window.location.href = '/dashboard';
    } catch (err: unknown) {
      setIsLoading(false);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Terjadi galat saat menetapkan kata sandi.',
      );
    }
  }

  const isLengthValid = password.length >= 12;

  return (
    <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-2.5 border-b border-[var(--line)] pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)]">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[var(--ink)]">
              Tetapkan Kata Sandi Baru
            </h1>
            <p className="text-xs text-[var(--ink-muted)]">
              Undangan resmi akun Kasdapur.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2.5 rounded-lg border border-[var(--danger)] bg-[var(--danger-subtle,#fce8e6)] p-3 text-xs text-[var(--danger,#c5221f)]">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="new-password"
              className="text-xs font-semibold text-[var(--ink)]"
            >
              Kata Sandi Baru <span className="text-[var(--danger)]">*</span>
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 pr-10 text-xs text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                placeholder="Minimal 12 karakter"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] hover:text-[var(--ink)]"
                aria-label={showPassword ? 'Sembunyikan' : 'Tampilkan'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="confirm-password"
              className="text-xs font-semibold text-[var(--ink)]"
            >
              Konfirmasi Kata Sandi <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-10 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-xs text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              placeholder="Ulangi kata sandi baru"
            />
          </div>

          {/* Indikator Aturan Keamanan Sandi */}
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-3 text-xs space-y-1.5">
            <div className="font-semibold text-[var(--ink)] flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>Standar Keamanan Kata Sandi (FR-F1.3)</span>
            </div>
            <ul className="space-y-1 text-[11px] text-[var(--ink-muted)] pl-5 list-disc">
              <li className={isLengthValid ? 'text-[var(--ok,#137333)] font-medium' : ''}>
                Panjang minimal 12 karakter
              </li>
              <li>
                Mengandung kombinasi huruf dan angka atau simbol
              </li>
              <li>
                Bukan kata sandi umum atau urutan angka sederhana (seperti 123456)
              </li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="h-10 w-full rounded-lg bg-[var(--accent)] text-xs font-semibold text-white shadow-2xs hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Menyimpan Sandi...' : 'Simpan Kata Sandi & Lanjutkan'}
          </button>
        </form>
      </div>
    </div>
  );
}
