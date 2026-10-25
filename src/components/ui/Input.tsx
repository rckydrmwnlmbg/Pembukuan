'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatRupiahNumber } from '@/lib/format';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorText?: string;
  lowConfidence?: boolean;
}

/**
 * Komponen Input Standar (DESIGN.md §5.2).
 * Label kalimat biasa (13/18 bobot 500), teks bantu di bawah, kontrol radius 6px.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      label,
      helperText,
      errorText,
      lowConfidence = false,
      id,
      className = '',
      ...props
    },
    ref,
  ) {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const errorId = errorText ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;

    return (
      <div className="flex flex-col gap-1.5 w-full text-left">
        {label ? (
          <label
            htmlFor={inputId}
            className="text-[13px] font-medium text-[var(--ink)]"
          >
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(errorText)}
          aria-describedby={errorId ?? helperId}
          className={`h-9 w-full rounded-md border bg-[var(--surface)] px-3 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--focus-ring)] disabled:bg-[var(--surface-muted)] disabled:text-[var(--ink-muted)] ${
            errorText
              ? 'border-[var(--danger)] focus-visible:outline-[var(--danger)]'
              : lowConfidence
                ? 'border-[var(--line-strong)] border-l-2 border-l-[var(--warn)] bg-[var(--warn-subtle)]/40'
                : 'border-[var(--line-strong)]'
          } ${className}`.trim()}
          {...props}
        />
        {errorText ? (
          <p id={errorId} className="text-xs text-[var(--danger)] flex items-center gap-1" role="alert">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>{errorText}</span>
          </p>
        ) : lowConfidence ? (
          <p id={helperId} className="text-xs text-[var(--warn)] flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>Terbaca dengan keyakinan rendah. Cocokkan dengan bukti fisik.</span>
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-[var(--ink-muted)]">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);

export interface NominalInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string;
  helperText?: string;
  errorText?: string;
  lowConfidence?: boolean;
  value?: bigint | string;
  onValueChange?: (val: bigint) => void;
}

/**
 * Field Nominal Rupiah (DESIGN.md §5.2).
 * Rata kanan, awalan "Rp" tetap di dalam kontrol, angka tabular, pemisah ribuan titik.
 */
export const NominalInput = React.forwardRef<HTMLInputElement, NominalInputProps>(
  function NominalInput(
    {
      label,
      helperText,
      errorText,
      lowConfidence = false,
      value = 0n,
      onValueChange,
      id,
      className = '',
      disabled,
      ...props
    },
    ref,
  ) {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const errorId = errorText ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;

    const rawBigint =
      typeof value === 'bigint'
        ? value
        : BigInt(String(value).replace(/\D/g, '') || '0');

    const formattedDisplay =
      rawBigint === 0n ? '' : formatRupiahNumber(rawBigint);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const cleanDigits = e.target.value.replace(/\D/g, '');
      const parsedBig = cleanDigits ? BigInt(cleanDigits) : 0n;
      onValueChange?.(parsedBig);
    }

    return (
      <div className="flex flex-col gap-1.5 w-full text-left">
        {label ? (
          <label
            htmlFor={inputId}
            className="text-[13px] font-medium text-[var(--ink)]"
          >
            {label}
          </label>
        ) : null}

        <div className="relative flex items-center">
          <span
            className="absolute left-3 text-xs font-semibold text-[var(--ink-muted)] pointer-events-none select-none"
            aria-hidden="true"
          >
            Rp
          </span>
          <input
            ref={ref}
            id={inputId}
            type="text"
            inputMode="numeric"
            disabled={disabled}
            value={formattedDisplay}
            onChange={handleChange}
            placeholder="0"
            aria-invalid={Boolean(errorText)}
            aria-describedby={errorId ?? helperId}
            className={`h-9 w-full rounded-md border bg-[var(--surface)] pl-9 pr-3 text-right font-medium tabular-nums text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--focus-ring)] disabled:bg-[var(--surface-muted)] disabled:text-[var(--ink-muted)] ${
              errorText
                ? 'border-[var(--danger)] focus-visible:outline-[var(--danger)]'
                : lowConfidence
                  ? 'border-[var(--line-strong)] border-l-2 border-l-[var(--warn)] bg-[var(--warn-subtle)]/40'
                  : 'border-[var(--line-strong)]'
            } ${className}`.trim()}
            {...props}
          />
        </div>

        {errorText ? (
          <p id={errorId} className="text-xs text-[var(--danger)] flex items-center gap-1" role="alert">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>{errorText}</span>
          </p>
        ) : lowConfidence ? (
          <p id={helperId} className="text-xs text-[var(--warn)] flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>Terbaca dengan keyakinan rendah. Cocokkan dengan bukti fisik.</span>
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-[var(--ink-muted)]">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);
