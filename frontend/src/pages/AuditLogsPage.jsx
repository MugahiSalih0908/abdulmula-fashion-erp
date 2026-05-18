// src/pages/AuditLogsPage.jsx – admin-only audit log viewer

import { useState }   from 'react';
import { useQuery }   from '@tanstack/react-query';
import api            from '../services/api';
import PageHeader     from '../components/ui/PageHeader';
import { ShieldCheck, Search } from 'lucide-react';

const ACTION_COLORS = {
  LOGIN:           'bg-green-100 text-green-700',
  LOGOUT:          'bg-gray-100 text-gray-600',
  LOGIN_FAILED:    'bg-red-100 text-red-700',
  PRODUCT_CREATE:  'bg-blue-100 text-blue-700',
  PRODUCT_UPDATE:  'bg-amber-100 text-amber-700',
  PRODUCT_DELETE:  'bg-red-100 text-red-700',
  INVOICE_CREATE:  'bg-green-100 text-green-700',
  INVOICE_DELETE:  'bg-red-100 text-red-700',
  EXPENSE_CREATE:  'bg-orange-100 text-orange-700',
  EXPENSE_DELETE:  'bg-red-100 text-red-700',
  USER_CREATE:     'bg-purple-100 text-purple-700',
  USER_UPDATE:     'bg-purple-100 text-purple-700',
  STOCK_ADJUST:    'bg-teal-100 text-teal-700',
  SUPPLIER_CREATE: 'bg-amber-100 text-amber-700',
  SUPPLIER_UPDATE: 'bg-amber-100 text-amber-700',
  SUPPLIER_DELETE: 'bg-red-100 text-red-700',
};

const ALL_ACTIONS = [
  'all','LOGIN','LOGOUT','LOGIN_FAILED',
  'PRODUCT_CREATE','PRODUCT_UPDATE','PRODUCT_DELETE',
  'INVOICE_CREATE','INVOICE_DELETE',
  'EXPENSE_CREATE','EXPENSE_DELETE',
  'USER_CREATE','USER_UPDATE',
  'STOCK_ADJUST',
  'SUPPLIER_CREATE','SUPPLIER_UPDATE','SUPPLIER_DELETE',
];

export default function AuditLogsPage() {
  const [page,   setPage]   = useState(1);
  const [action, setAction] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, action],
    queryFn:  async () => {
      const params = new URLSearchParams({ page, limit: 50 });
      if (action !== 'all') params.set('action', action);
      const { data } = await api.get(`/staff/system/audit-logs?${params}`);
      return data;
    },
    keepPreviousData: true,
  });

  const logs  = data?.data  || [];
  const total = data?.total || 0;
  const pages = Math.ceil(total / 50);

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="Audit Logs"
        sub={`${total} total records`}
        action={
          <div className="flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg bg-red-100 text-red-700">
            <ShieldCheck size={14}/> Admin Only
          </div>
        }
      />

      {/* Action filter */}
      <div className="overflow-x-auto pb-1 no-scrollbar">
        <div className="flex gap-2">
          {ALL_ACTIONS.map(a => (
            <button key={a} onClick={() => { setAction(a); setPage(1); }}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      action===a ? 'text-black' : 'bg-white text-gray-500 border border-gray-200'
                    }`}
                    style={action===a ? { background:'#d4a017' } : {}}>
              {a === 'all' ? 'All' : a.replace(/_/g,' ')}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(8)].map((_,i)=><div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse"/>)}</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShieldCheck size={48} className="mx-auto mb-3 opacity-25"/>
          <p className="font-semibold">No audit logs found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <div key={log._id} className="bg-white rounded-2xl px-4 py-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action]||'bg-gray-100 text-gray-600'}`}>
                      {log.action}
                    </span>
                    {log.entity && (
                      <span className="text-xs text-gray-500">{log.entity}</span>
                    )}
                  </div>
                  <p className="font-semibold text-sm mt-1">
                    {log.user?.name || log.userName || 'Unknown user'}
                    <span className="text-gray-400 font-normal text-xs ml-2">{log.user?.role}</span>
                  </p>
                  {log.details && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {JSON.stringify(log.details).slice(0, 120)}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleDateString()}</p>
                  <p className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</p>
                  {log.ip && <p className="text-xs text-gray-300 font-mono">{log.ip}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                  className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold disabled:opacity-40">
            ← Previous
          </button>
          <span className="text-sm text-gray-500">Page {page} of {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page===pages}
                  className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold disabled:opacity-40">
            Next →
          </button>
        </div>
      )}

      <div className="h-4"/>
    </div>
  );
}
