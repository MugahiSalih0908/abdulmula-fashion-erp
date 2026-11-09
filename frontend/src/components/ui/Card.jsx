import React from 'react';

/**
 * Flexible Card Component
 * Base card with variants for elevated, flat, and outline styles
 * @param {string} variant - 'elevated' | 'flat' | 'outline'
 * @param {string} className - Additional classes
 * @param {ReactNode} children - Card content
 */
export default function Card({
  variant = 'elevated',
  className = '',
  children,
  ...props
}) {
  const variantClasses = {
    elevated: 'card',
    flat: 'card-flat',
    outline: 'card-flat',
  };

  return (
    <div className={`${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
}

/**
 * Card Header - for top section with title/subtitle
 */
export function CardHeader({ title, subtitle, action, icon, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-4 ${className}`}>
      <div className="flex items-start gap-2.5 min-w-0">
        {icon && (
          <span className="card-header-icon shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          {title && <h3 className="font-semibold text-gray-900 leading-snug">{title}</h3>}
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Card Body - for content section
 */
export function CardBody({ children, className = '' }) {
  return <div className={`${className}`}>{children}</div>;
}

/**
 * Card Footer - for bottom section with actions
 */
export function CardFooter({ children, className = '' }) {
  return (
    <div className={`flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100 ${className}`}>
      {children}
    </div>
  );
}
