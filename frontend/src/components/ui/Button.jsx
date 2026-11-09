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
  icon,
  iconPosition = 'start',
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
  const Icon = typeof icon === 'function' ? icon : null;
  const iconElement = React.isValidElement(icon)
    ? icon
    : Icon
      ? <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
      : null;

  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${variantClasses[variant] || variantClasses.primary} btn-${size} ${className}`}
      {...props}
    >
      {loading && (
        <span aria-hidden="true" className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {!loading && iconPosition === 'start' && iconElement}
      {children}
      {!loading && iconPosition === 'end' && iconElement}
    </button>
  );
}
