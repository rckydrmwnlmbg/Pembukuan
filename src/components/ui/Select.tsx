'use client';

import React from 'react';
import { ChevronDown, AlertTriangle } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  errorText?: string;
  options?: SelectOption[];
}

/**
 * Komponen Select Enterprise (DESIGN.md §5.2).
 * Tinggi 36px, radius 6px, chevron bawaan, label kalimat biasa.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      label,
      helperText,
      errorText,
      options,
      children,
      id,
      className = '',
      ...props
    },
    ref,
  ) {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;
    const errorId = errorText ? `${selectId}-error` : undefined;
    const helperId = helperText ? `${selectId}-helper` : undefined;

    return (
      <div className="flex flex-col gap-1.5 w-full text-left">
        {label ? (
          <label
            htmlFor={selectId}
            className="text-[13px] font-medium text-[var(--ink)]"
          >
            {label}
          </label>
        ) : null}

        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={Boolean(errorText)}
            aria-describedby={errorId ?? helperId}
            className={`h-9 w-full appearance-none rounded-md border bg-[var(--surface)] pl-3 pr-8 text-sm text-[var(--ink)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--focus-ring)] disabled:bg-[var(--surface-muted)] disabled:text-[var(--ink-muted)] ${
              errorText ? 'border-[var(--danger)]' : 'border-[var(--line-strong)]'
            } ${className}`.trim()}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                  >
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 w-4 h-4 text-[var(--ink-muted)]"
            aria-hidden="true"
          />
        </div>

        {errorText ? (
          <p id={errorId} className="text-xs text-[var(--danger)] flex items-center gap-1" role="alert">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>{errorText}</span>
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
