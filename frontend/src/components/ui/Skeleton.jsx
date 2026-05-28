import React from 'react';

/**
 * Skeleton Loader Component
 * Animated skeleton for loading states
 * @param {string} variant - 'text' | 'card' | 'avatar' | 'line'
 * @param {string} className - Additional classes
 */
export default function Skeleton({ variant = 'text', className = '' }) {
  const variants = {
    text: 'h-4 w-full rounded',
    card: 'h-32 w-full rounded-lg',
    avatar: 'h-10 w-10 rounded-full',
    line: 'h-3 w-3/4 rounded',
  };

  return <div className={`skeleton ${variants[variant]} ${className}`} />;
}

/**
 * Skeleton Card Component - useful for lists
 */
export function SkeletonCard() {
  return (
    <div className="card p-4 space-y-3">
      <Skeleton variant="text" className="h-5" />
      <Skeleton variant="text" className="w-5/6" />
      <div className="pt-2 space-y-2">
        <Skeleton variant="line" />
        <Skeleton variant="line" className="w-4/5" />
      </div>
    </div>
  );
}

/**
 * Multiple skeleton loaders
 */
export function SkeletonGrid({ count = 3, variant = 'card' }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant={variant} />
      ))}
    </div>
  );
}
