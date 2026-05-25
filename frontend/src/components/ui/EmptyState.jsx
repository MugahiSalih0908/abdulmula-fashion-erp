import React from 'react';

/**
 * Empty State Component
 * Displays when no data is available
 * @param {ReactNode} icon - Icon component
 * @param {string} title - Empty state title
 * @param {string} description - Empty state description
 * @param {ReactNode} action - Optional CTA button
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
}) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      {title && <h3 className="empty-state-title">{title}</h3>}
      {description && <p className="empty-state-description">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
