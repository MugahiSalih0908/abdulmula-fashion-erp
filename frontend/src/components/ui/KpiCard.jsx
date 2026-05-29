// src/components/ui/KpiCard.jsx
export default function KpiCard({ icon, label, value, sub, loading, color = 'gold' }) {
  const bg = {
    gold:   'bg-amber-50',
    green:  'bg-green-50',
    red:    'bg-red-50',
    blue:   'bg-blue-50',
    purple: 'bg-purple-50',
    gray:   'bg-gray-100',
  }[color];

  const text = {
    gold:   'text-amber-600',
    green:  'text-green-600',
    red:    'text-red-600',
    blue:   'text-blue-600',
    purple: 'text-purple-600',
    gray:   'text-gray-600',
  }[color];

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className={`w-10 h-10 ${bg} ${text} rounded-xl flex items-center justify-center mb-3`}>
        {icon}
      </div>
      {loading ? (
        <div className="h-7 bg-gray-200 rounded animate-pulse mb-1" />
      ) : (
        <p className={`font-black text-xl ${text} leading-tight`}>{value}</p>
      )}
      <p className="text-xs font-semibold text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
export default function KpiCard({
  icon,
  label,
  value,
  sub,
  loading,
  color = 'gold'
}) {
  // code...

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      {/* content */}
    </div>
  );
}