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
export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <div>
        {title && <h3 className="font-semibold text-gray-900">{title}</h3>}
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
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
    <div className={`flex gap-2 mt-4 pt-4 border-t border-gray-100 ${className}`}>
      {children}
    </div>
  );
}
