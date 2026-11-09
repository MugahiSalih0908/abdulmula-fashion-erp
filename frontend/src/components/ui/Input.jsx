import React, { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const Input = forwardRef(
  (
    {
      type = 'text',
      label,
      error,
      hint,
      required = false,
      id,
      'aria-describedby': describedBy,
      className = '',
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const generatedId = useId();
    const inputId = id || `field-${generatedId}`;
    const messageIds = [
      error ? `${inputId}-error` : null,
      hint && !error ? `${inputId}-hint` : null,
    ].filter(Boolean);
    const ariaDescribedBy = [describedBy, ...messageIds].filter(Boolean).join(' ') || undefined;

    const inputType =
      type === 'password' && showPassword
        ? 'text'
        : type;

    const hasError = !!error;

    return (
      <div className={`input-group ${className}`}>
        {label && (
          <label htmlFor={inputId} className={`input-label ${required ? 'required' : ''}`}>
            {label}
          </label>
        )}

        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            className={`input ${hasError ? 'error' : ''}`}
            required={required}
            aria-required={required || undefined}
            aria-invalid={hasError || undefined}
            aria-describedby={ariaDescribedBy}
            {...props}
          />

          {type === 'password' && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 min-w-10 min-h-10 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors rounded-lg"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <EyeOff size={18} strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Eye size={18} strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>
          )}
        </div>

        {error && <span id={`${inputId}-error`} className="input-error">{error}</span>}
        {hint && !error && <span id={`${inputId}-hint`} className="input-hint">{hint}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;