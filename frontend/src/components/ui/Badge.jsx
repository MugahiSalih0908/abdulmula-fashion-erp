import React from 'react';

/**
 * Modern Status Badge Component
 * Displays status with custom variants and icon support
 * @param {string} variant - 'success' | 'warning' | 'danger' | 'info' | 'primary'
 * @param {ReactNode} icon - Optional icon component
 * @param {string} children - Badge text
 */
export default function Badge({ variant = 'primary', icon, children, className = '' }) {
  const baseClasses = 'badge';
  const variantClasses = {
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
    primary: 'badge-primary',
  };

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
}
