import React from 'react';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    { label, helperText, errorText, id, className = '', ...props },
    ref,
  ) {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const errorId = errorText ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;

    return (
      <div className="flex flex-col gap-1">
        {label ? (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-ink-secondary"
          >
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(errorText)}
          aria-describedby={errorId ?? helperId}
          className={`h-9 w-full rounded-md border bg-surface px-3 text-sm text-ink-primary placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring disabled:bg-surface-subtle disabled:text-ink-muted ${
            errorText ? 'border-danger' : 'border-line-strong'
          } ${className}`.trim()}
          {...props}
        />
        {errorText ? (
          <p id={errorId} className="text-xs text-danger" role="alert">
            {errorText}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-ink-muted">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);
