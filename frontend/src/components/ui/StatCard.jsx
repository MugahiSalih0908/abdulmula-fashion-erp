import React from 'react';
import Card from './Card';

/**
 * KPI / Statistic Card Component
 * Display key metrics with icons, values, and trend indicators
 * @param {string} label - Stat label
 * @param {string|number} value - Stat value
 * @param {ReactNode} icon - Icon component
 * @param {number} change - Percentage change
 * @param {boolean} positive - Is change positive
 * @param {string} unit - Optional unit (%, $, etc.)
 */
export default function StatCard({
  label,
  value,
  icon,
  change,
  positive,
  unit = '',
  className = '',
}) {
  return (
    <Card className={`p-4 sm:p-6 ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wide">
            {label}
          </p>
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
            {value}
            {unit && <span className="text-sm text-gray-500">{unit}</span>}
          </h3>
        </div>

        {icon && (
          <div className="flex-shrink-0 p-2 sm:p-3 bg-green-50 rounded-lg text-green-600">
            {icon}
          </div>
        )}
      </div>

      {change !== undefined && (
        <div className="flex items-center gap-1 text-xs">
          <span className={`font-semibold ${positive ? 'text-green-600' : 'text-red-600'}`}>
            {positive ? '+' : '-'}{Math.abs(change)}%
          </span>
          <span className="text-gray-500">vs last month</span>
        </div>
      )}
    </Card>
  );
}
