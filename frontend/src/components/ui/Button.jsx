import React from 'react';

/**
 * Modern Button Component
 * Variant-based button with smooth animations and touch-friendly sizing
 * @param {string} variant - 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {boolean} loading - Show loading state
 * @param {boolean} disabled - Disable button
 * @param {string} className - Additional classes
 * @param {ReactNode} children - Button content
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  children,
  ...props
}) {
  const variantClasses = {
    primary: 'btn btn-primary',
    secondary: 'btn btn-secondary',
    ghost: 'btn btn-ghost',
    danger: 'btn btn-danger',
    success: 'btn btn-success',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${variantClasses[variant]} btn-${size} transition-smooth hover:scale-105 active:scale-95 ${className}`}
      {...props}
    >
      {loading && (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
