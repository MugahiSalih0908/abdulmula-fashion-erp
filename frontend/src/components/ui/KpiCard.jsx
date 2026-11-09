// src/components/ui/KpiCard.jsx

export default function KpiCard({
  icon,
  label,
  value,
  sub,
  loading,
  color = 'gold',
  className = '',
}) {
  const supportedColors = ['gold', 'green', 'red', 'blue', 'purple', 'gray'];
  const colorToken = supportedColors.includes(color) ? color : 'gray';

  return (
    <div className={`kpi-card min-w-0 ${className}`}>
      <div
        className={`kpi-icon kpi-icon-${colorToken}`}
        aria-hidden="true"
      >
        {icon}
      </div>

      {loading ? (
        <div className="skeleton h-7 w-3/4 mb-1" aria-hidden="true" />
      ) : (
        <p className="font-bold text-xl text-gray-900 leading-tight break-words">
          {value}
        </p>
      )}

      <p className="text-xs font-semibold text-gray-500 mt-0.5">
        {label}
      </p>

      {sub && (
        <p className="text-xs text-gray-400">
          {sub}
        </p>
      )}
    </div>
  );
}