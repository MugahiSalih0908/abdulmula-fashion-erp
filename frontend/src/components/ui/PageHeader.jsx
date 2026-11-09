// src/components/ui/PageHeader.jsx
export default function PageHeader({ title, sub, action }) {
  return (
    <div className="page-title flex flex-wrap items-center justify-between gap-3 pt-2 pb-1">
      <div className="min-w-0 flex-1">
        <h1 className="font-bold text-xl text-gray-900 leading-tight">{title}</h1>
        {sub && <p className="text-sm text-gray-500 mt-1">{sub}</p>}
      </div>
      {action && <div className="page-title-action shrink-0">{action}</div>}
    </div>
  );
}
