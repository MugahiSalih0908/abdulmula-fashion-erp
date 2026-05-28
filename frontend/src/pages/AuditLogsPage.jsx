// src/pages/AuditLogsPage.jsx – admin-only audit log viewer

import { useState }   from 'react';
import { useQuery }   from '@tanstack/react-query';
import api            from '../services/api';
import PageHeader     from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import CardBody from '../components/ui/CardBody';
import Badge from '../components/ui/Badge';
import { ShieldCheck, Search } from 'lucide-react';

const ACTION_BADGES = {
  LOGIN:           'success',
  LOGOUT:          'secondary',
  LOGIN_FAILED:    'danger',
  PRODUCT_CREATE:  'info',
  PRODUCT_UPDATE:  'warning',
  PRODUCT_DELETE:  'danger',
  INVOICE_CREATE:  'success',
  INVOICE_DELETE:  'danger',
  EXPENSE_CREATE:  'warning',
  EXPENSE_DELETE:  'danger',
  USER_CREATE:     'info',
  USER_UPDATE:     'info',
  STOCK_ADJUST:    'info',
  SUPPLIER_CREATE: 'warning',
  SUPPLIER_UPDATE: 'warning',
  SUPPLIER_DELETE: 'danger',
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
    <div className="p-4 space-y-5">
      <PageHeader
        title="Audit Logs"
        sub={`${total} total records`}
        action={
          <Badge variant="danger" className="flex items-center gap-1.5">
            <ShieldCheck size={14}/> Admin Only
          </Badge>
        }
      />

      {/* Action filter */}
      <div className="overflow-x-auto pb-1 no-scrollbar">
        <div className="flex gap-2">
          {ALL_ACTIONS.map(a => (
            <button key={a} onClick={() => { setAction(a); setPage(1); }}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      action===a ? 'text-white bg-emerald-600 shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                    }`}>
              {a === 'all' ? 'All' : a.replace(/_/g,' ')}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(8)].map((_,i)=><div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse"/>)}</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16">
          <ShieldCheck size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-500">No audit logs found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map(log => (
            <Card key={log._id}>
              <CardBody className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <Badge variant={ACTION_BADGES[log.action] || 'secondary'}>
                        {log.action.replace(/_/g,' ')}
                      </Badge>
                      {log.entity && (
                        <span className="text-xs text-gray-500">{log.entity}</span>
                      )}
                    </div>
                    <p className="font-semibold text-sm text-gray-900">
                      {log.user?.name || log.userName || 'Unknown user'}
                      <span className="text-gray-500 font-normal text-xs ml-2">{log.user?.role}</span>
                    </p>
                    {log.details && (
                      <p className="text-xs text-gray-600 mt-1 truncate">
                        {JSON.stringify(log.details).slice(0, 120)}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-600">{new Date(log.createdAt).toLocaleDateString()}</p>
                    <p className="text-xs text-gray-500">{new Date(log.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</p>
                    {log.ip && <p className="text-xs text-gray-400 font-mono">{log.ip}</p>}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p-1))}
            disabled={page===1}
          >
            ← Previous
          </Button>
          <span className="text-sm text-gray-600">Page {page} of {pages}</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage(p => Math.min(pages, p+1))}
            disabled={page===pages}
          >
            Next →
          </Button>
        </div>
      )}

      <div className="h-4"/>
    </div>
  );
}
