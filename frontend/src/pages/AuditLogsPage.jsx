import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle, CalendarClock, ChevronLeft, ChevronRight, ClipboardList,
  RefreshCw, Search, ShieldCheck, UserRound
} from 'lucide-react';
import api from '../services/api';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import CardBody from '../components/ui/CardBody';
import Badge from '../components/ui/Badge';
import {
  AUDIT_ACTIONS,
  filterAuditLogs,
  formatAuditDate,
  getAuditActionLabel,
  getAuditActionTone
} from './auditLogManagement.mjs';
import './adminWorkspace.css';

const PAGE_SIZE = 50;

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('all');
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: ['audit-logs', page, action],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (action !== 'all') params.set('action', action);
      const response = await api.get('/staff/system/audit-logs?' + params.toString());
      return response.data;
    },
    placeholderData: previousData => previousData
  });

  const logs = query.data?.data || [];
  const total = Number(query.data?.total || 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visibleLogs = useMemo(() => filterAuditLogs(logs, search), [logs, search]);
  const firstRecord = total === 0 ? 0 : ((page - 1) * PAGE_SIZE) + 1;
  const lastRecord = Math.min(page * PAGE_SIZE, total);

  return (
    <main className="admin-page admin-audit-page">
      <PageHeader
        title="Audit Logs"
        sub="A searchable history of important workspace and account activity"
        action={<Badge variant="danger"><ShieldCheck size={13} aria-hidden="true" /> Admin only</Badge>}
      />

      <section className="admin-audit-hero" aria-label="Audit log overview">
        <div className="admin-audit-hero-icon"><ShieldCheck size={23} aria-hidden="true" /></div>
        <div className="admin-audit-hero-copy">
          <span>SECURITY & ACCOUNTABILITY</span>
          <h2>Workspace activity trail</h2>
          <p>Review recorded sign-ins, inventory changes, invoices and other audited actions. This page is read-only.</p>
        </div>
        <div className="admin-audit-hero-stat">
          <strong>{total.toLocaleString()}</strong>
          <span>{action === 'all' ? 'Total records' : 'Matching records'}</span>
        </div>
      </section>

      <section className="admin-audit-toolbar" aria-label="Audit log filters">
        <label className="admin-audit-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search the loaded audit records</span>
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search this page by user, action, entity or IP…"
          />
          {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search">×</button>}
        </label>
        <div className="admin-audit-filter-meta">
          <span>Filter action</span>
          {query.isFetching && !query.isLoading && <span role="status">Updating…</span>}
        </div>
        <div className="admin-audit-filters" role="group" aria-label="Filter by audit action">
          <button type="button" aria-pressed={action === 'all'} className={action === 'all' ? 'is-active' : ''} onClick={() => { setAction('all'); setPage(1); }}>
            All actions
          </button>
          {AUDIT_ACTIONS.map(item => (
            <button
              type="button"
              key={item}
              aria-pressed={action === item}
              className={action === item ? 'is-active' : ''}
              onClick={() => { setAction(item); setPage(1); }}
            >
              {getAuditActionLabel(item)}
            </button>
          ))}
        </div>
        <p className="admin-audit-filter-note">Action filtering is applied by the server. Text search scans the {PAGE_SIZE} records loaded for the selected page.</p>
      </section>

      {query.isLoading ? (
        <div className="admin-audit-skeletons" aria-label="Loading audit records">
          {[1, 2, 3, 4, 5, 6].map(item => <div key={item} />)}
        </div>
      ) : query.isError ? (
        <Card className="admin-audit-error">
          <CardBody className="p-5 sm:p-6">
            <AlertCircle size={23} aria-hidden="true" />
            <div><h2>Audit logs could not be loaded</h2><p>{query.error?.response?.data?.message || query.error?.message || 'Check your connection and try again.'}</p></div>
            <Button variant="secondary" onClick={() => query.refetch()} loading={query.isFetching}><RefreshCw size={14} aria-hidden="true" /> Retry</Button>
          </CardBody>
        </Card>
      ) : visibleLogs.length === 0 ? (
        <Card className="admin-audit-empty">
          <CardBody className="p-8 sm:p-12">
            <ClipboardList size={30} aria-hidden="true" />
            <h2>{logs.length === 0 ? 'No audit records found' : 'No records match this search'}</h2>
            <p>{logs.length === 0 ? 'There are no recorded actions for this filter yet.' : 'Try another user, action or entity name, or clear the search.'}</p>
            {search && <Button variant="secondary" size="sm" onClick={() => setSearch('')}>Clear search</Button>}
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="admin-audit-results-heading">
            <div><h2>Recorded activity</h2><p>Showing {visibleLogs.length.toLocaleString()} of {logs.length.toLocaleString()} loaded records</p></div>
            <span>{query.isFetching ? 'Refreshing records…' : 'Newest first'}</span>
          </div>

          <Card className="admin-audit-table-card">
            <div className="admin-audit-table-wrap">
              <table className="admin-audit-table">
                <thead>
                  <tr><th scope="col">Activity</th><th scope="col">User</th><th scope="col">Entity</th><th scope="col">Details</th><th scope="col">Source IP</th><th scope="col">Recorded</th></tr>
                </thead>
                <tbody>
                  {visibleLogs.map(log => (
                    <tr key={log._id}>
                      <td><Badge variant={getAuditActionTone(log.action)}>{getAuditActionLabel(log.action)}</Badge></td>
                      <td><div className="admin-audit-user"><strong>{log.user?.name || log.userName || 'Unknown user'}</strong><span>{[log.user?.role, log.user?.email].filter(Boolean).join(' · ') || 'Account unavailable'}</span></div></td>
                      <td><div className="admin-audit-entity"><strong>{log.entity || '—'}</strong><span>{log.entityId || 'No entity ID'}</span></div></td>
                      <td>
                        {log.details ? (
                          <details className="admin-audit-details">
                            <summary>View details</summary>
                            <pre>{JSON.stringify(log.details, null, 2)}</pre>
                          </details>
                        ) : <span className="admin-audit-muted">No details</span>}
                      </td>
                      <td><span className="admin-audit-ip">{log.ip || '—'}</span></td>
                      <td><time dateTime={log.createdAt || undefined}>{formatAuditDate(log.createdAt)}</time></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-audit-mobile-list">
              {visibleLogs.map(log => (
                <article key={log._id} className="admin-audit-mobile-item">
                  <div className="admin-audit-mobile-top">
                    <Badge variant={getAuditActionTone(log.action)}>{getAuditActionLabel(log.action)}</Badge>
                    <time dateTime={log.createdAt || undefined}>{formatAuditDate(log.createdAt)}</time>
                  </div>
                  <div className="admin-audit-mobile-user"><UserRound size={15} aria-hidden="true" /><strong>{log.user?.name || log.userName || 'Unknown user'}</strong><span>{log.user?.role || 'User'}</span></div>
                  <p className="admin-audit-mobile-entity">{log.entity || 'General activity'}{log.entityId ? ' · ' + log.entityId : ''}</p>
                  {log.details && <details className="admin-audit-details"><summary>View event details</summary><pre>{JSON.stringify(log.details, null, 2)}</pre></details>}
                  {log.ip && <span className="admin-audit-ip">IP {log.ip}</span>}
                </article>
              ))}
            </div>
            <div className="admin-audit-pagination">
              <span>Showing {firstRecord.toLocaleString()}–{lastRecord.toLocaleString()} of {total.toLocaleString()}</span>
              <div>
                <Button variant="secondary" size="sm" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1 || query.isFetching}>
                  <ChevronLeft size={14} aria-hidden="true" /> Previous
                </Button>
                <strong>Page {page} of {pages}</strong>
                <Button variant="secondary" size="sm" onClick={() => setPage(value => Math.min(pages, value + 1))} disabled={page >= pages || query.isFetching}>
                  Next <ChevronRight size={14} aria-hidden="true" />
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}

      <p className="admin-audit-footnote"><CalendarClock size={14} aria-hidden="true" /> Audit records are displayed in the browser's local time zone. This log is read-only.</p>
    </main>
  );
}
