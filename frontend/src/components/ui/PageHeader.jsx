// src/components/ui/PageHeader.jsx
export default function PageHeader({ title, sub, action }) {
  return (
    <div className="flex items-center justify-between pt-2 pb-1">
      <div>
        <h1 className="font-black text-xl text-gray-900 leading-tight">{title}</h1>
        {sub && <p className="text-sm text-gray-500 mt-0.5">{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
