import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Modern Input Component
 * Touch-friendly input with floating labels, focus states, and validation
 * @param {string} type - Input type (text, email, password, etc.)
 * @param {string} label - Input label
 * @param {string} error - Error message
 * @param {string} hint - Helper text
 * @param {boolean} required - Required indicator
 * @param {string} className - Additional classes
 */
export default function Input({
  type = 'text',
  label,
  error,
  hint,
  required = false,
  className = '',
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);
  const inputType = type === 'password' && showPassword ? 'text' : type;
  const hasError = !!error;

  return (
    <div className={`input-group ${className}`}>
      {label && (
        <label className={`input-label ${required ? 'required' : ''}`}>
          {label}
        </label>
      )}
      
      <div className="relative">
        <input
          type={inputType}
          className={`input ${hasError ? 'error' : ''}`}
          {...props}
        />
        
        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            tabIndex="-1"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>

      {error && <span className="input-error">{error}</span>}
      {hint && !error && <span className="input-hint">{hint}</span>}
    </div>
  );
}
