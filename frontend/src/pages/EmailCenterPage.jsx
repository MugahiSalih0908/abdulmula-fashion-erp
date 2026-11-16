import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertCircle, AlertTriangle, CheckCircle2, Clock3, Mail, RefreshCw, Search, Send, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import api from '../services/api';

const STATUS_META = {
  queued: { label: 'Queued', tone: 'bg-slate-100 text-slate-700' },
  sending: { label: 'Sending', tone: 'bg-blue-100 text-blue-700' },
  sent: { label: 'Accepted by provider', tone: 'bg-sky-100 text-sky-700' },
  delivered: { label: 'Delivered', tone: 'bg-emerald-100 text-emerald-700' },
  delivery_delayed: { label: 'Delayed', tone: 'bg-amber-100 text-amber-800' },
  bounced: { label: 'Bounced', tone: 'bg-rose-100 text-rose-700' },
  complained: { label: 'Spam complaint', tone: 'bg-rose-100 text-rose-700' },
  blocked: { label: 'Blocked — not sent', tone: 'bg-amber-100 text-amber-800' },
  failed: { label: 'Provider failed', tone: 'bg-red-100 text-red-700' },
  unknown: { label: 'Status unknown', tone: 'bg-orange-100 text-orange-800' }
};
const CATEGORIES = [
  ['all', 'All types'], ['staff_activation', 'Staff activation'],
  ['staff_invitation', 'Staff invitation'], ['password_reset', 'Password reset'],
  ['password_changed', 'Password changed'], ['security_alert', 'Security alerts'],
  ['business_notification', 'Business notifications'], ['system', 'System']
];
const STATUSES = [
  ['all', 'All statuses'], ['queued', 'Queued'], ['sending', 'Sending'],
  ['sent', 'Accepted'], ['delivered', 'Delivered'], ['delivery_delayed', 'Delayed'],
  ['bounced', 'Bounced'], ['complained', 'Complaints'], ['blocked', 'Blocked (not sent)'], ['failed', 'Provider failed'],
  ['unknown', 'Unknown']
];

function SummaryCard({ label, value, icon: Icon, tone = 'text-slate-700' }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
        <Icon size={18} className={tone} aria-hidden="true" />
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-[var(--color-text)]">{Number(value || 0).toLocaleString()}</p>
    </div>
  );
}
function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.unknown;
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.tone}`}>{meta.label}</span>;
}
function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

export default function EmailCenterPage() {
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/email-logs/test');
      return response.data;
    },
    onSuccess: result => {
      toast.success(result.message || 'Test email accepted by provider.');
      queryClient.invalidateQueries(['email-logs']);
    },
    onError: error => toast.error(error?.response?.data?.message || 'Test email could not be sent.')
  });
  const query = useQuery({
    queryKey: ['email-logs', status, category, search, page],
    queryFn: async () => {
      const params = { page, limit: 25 };
      if (status !== 'all') params.status = status;
      if (category !== 'all') params.category = category;
      if (search.trim()) params.search = search.trim();
      const response = await api.get('/email-logs', { params });
      return response.data;
    },
    keepPreviousData: true
  });

  const rows = query.data?.data || [];
  const summary = query.data?.summary || {};
  const total = Number(query.data?.total || 0);
  const pages = Math.max(1, Math.ceil(total / 25));
  const deliveryConfig = query.data?.emailConfig || {};
  const canSendTest = deliveryConfig.providerReady && (deliveryConfig.mode === 'test' || (deliveryConfig.mode === 'live' && deliveryConfig.domainVerified));
  const cards = useMemo(() => [
    { label: 'Accepted by provider', value: summary.sent, icon: Send, tone: 'text-sky-700' },
    { label: 'Delivered', value: summary.delivered, icon: CheckCircle2, tone: 'text-emerald-700' },
    { label: 'Delayed', value: summary.delivery_delayed, icon: Clock3, tone: 'text-amber-700' },
    { label: 'Blocked — not sent', value: summary.blocked, icon: AlertCircle, tone: 'text-amber-700' },
    { label: 'Needs attention', value: (summary.bounced || 0) + (summary.complained || 0) + (summary.failed || 0) + (summary.unknown || 0), icon: AlertTriangle, tone: 'text-rose-700' }
  ], [summary]);

  return (
    <main className="space-y-5 p-4 pb-10 sm:space-y-6 sm:p-6 lg:p-7">
      <PageHeader title="Email Center" sub="Transactional email activity and delivery status" />
      <div className="flex justify-end">
        <button type="button" onClick={() => testMutation.mutate()} disabled={!canSendTest || testMutation.isPending} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
          <Send size={14} aria-hidden="true" />{testMutation.isPending ? 'Sending test…' : 'Send test to my email'}
        </button>
      </div>
      <div className="rounded-2xl border border-[var(--color-gold-light)] bg-[#fbf8f1] p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck size={19} className="mt-0.5 shrink-0 text-[#8b6b35]" aria-hidden="true" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-[var(--color-text)]">Email delivery configuration</p>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${query.data?.emailConfig?.mode === 'live' ? 'bg-emerald-100 text-emerald-800' : query.data?.emailConfig?.mode === 'test' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}`}>
                {String(query.data?.emailConfig?.mode || 'loading').toUpperCase()}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
              {query.data?.emailConfig?.mode === 'live'
                ? 'Live sending mode is enabled. The test button sends only to the signed-in administrator.'
                : query.data?.emailConfig?.mode === 'test'
                  ? 'Test mode is active. Messages can be sent only to the exact recipients in the backend test allow-list.'
                  : 'Sending is disabled by default. No staff or customer email will be sent until test or verified live mode is deliberately enabled. The test button sends only to the signed-in administrator.'}
            </p>
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
              Resend credentials: {query.data?.emailConfig?.providerReady ? 'configured' : 'not configured'} · Sender: {query.data?.emailConfig?.senderConfigured ? 'configured' : 'not configured'} · Verified domain: {query.data?.emailConfig?.domainVerified ? 'confirmed in environment' : 'not confirmed'}
            </p>
          </div>
        </div>
      </div>
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5" aria-label="Email delivery summary">
        {cards.map(card => <SummaryCard key={card.label} {...card} />)}
      </section>
      <section className="rounded-2xl border border-[var(--color-border)] bg-white p-3 shadow-sm sm:p-4" aria-label="Email filters">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_200px_200px_auto]">
          <label className="relative block">
            <span className="sr-only">Search recipient</span>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden="true" />
            <input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search recipient email…" className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-white pl-9 pr-3 text-sm outline-none focus:border-[var(--color-gold)] focus:ring-2 focus:ring-[rgba(197,164,109,0.2)]" />
          </label>
          <label><span className="sr-only">Filter by category</span><select value={category} onChange={event => { setCategory(event.target.value); setPage(1); }} className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm">{CATEGORIES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span className="sr-only">Filter by status</span><select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm">{STATUSES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"><RefreshCw size={15} className={query.isFetching ? 'animate-spin' : ''} aria-hidden="true" />Refresh</button>
        </div>
      </section>
      {query.isError && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" /><div><p className="font-semibold">Email activity could not be loaded.</p><p className="mt-1 text-xs">{query.error?.response?.data?.message || query.error?.message || 'Check your connection and try again.'}</p></div></div>}
      <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm" aria-label="Email activity">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-light)] px-4 py-3">
          <div><h2 className="text-sm font-semibold text-[var(--color-text)]">Recent email activity</h2><p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{total.toLocaleString()} records</p></div>
          {query.isFetching && <span className="text-xs text-[var(--color-text-muted)]" role="status">Updating…</span>}
        </div>
        {query.isLoading ? (
          <div className="space-y-3 p-4">{[1,2,3].map(item => <div key={item} className="h-16 animate-pulse rounded-xl bg-[var(--color-bg-secondary)]" />)}</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-14 text-center"><Mail size={28} className="mx-auto text-[var(--color-text-muted)]" aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-[var(--color-text)]">No email activity yet</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">Delivery records will appear here after a message is submitted.</p></div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[var(--color-bg-secondary)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]"><tr><th className="px-4 py-3 font-semibold">Recipient</th><th className="px-4 py-3 font-semibold">Message</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Attempts</th><th className="px-4 py-3 font-semibold">Created</th></tr></thead>
                <tbody className="divide-y divide-[var(--color-border-light)]">
                  {rows.map(row => <tr key={row._id} className="align-top"><td className="min-w-[230px] whitespace-nowrap px-4 py-3 text-xs font-medium text-[var(--color-text)]">{row.recipient}</td><td className="px-4 py-3"><p className="max-w-[310px] truncate text-xs font-medium text-[var(--color-text)]">{row.subject}</p><p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{String(row.category || 'system').replaceAll('_',' ')}</p></td><td className="px-4 py-3"><StatusPill status={row.status}/>{row.lastErrorMessage && <p className="mt-1 max-w-[220px] text-[11px] text-red-700">{row.lastErrorMessage}</p>}</td><td className="px-4 py-3 text-xs tabular-nums text-[var(--color-text-secondary)]">{row.attempts || 0}</td><td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--color-text-muted)]">{formatDate(row.createdAt)}</td></tr>)}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 p-3 md:hidden">
              {rows.map(row => <article key={row._id} className="rounded-xl border border-[var(--color-border-light)] p-3"><div className="flex items-start justify-between gap-3"><p className="break-all text-xs font-semibold text-[var(--color-text)]">{row.recipient}</p><StatusPill status={row.status}/></div><p className="mt-2 text-sm font-medium text-[var(--color-text)]">{row.subject}</p><p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{String(row.category || 'system').replaceAll('_',' ')} · {row.attempts || 0} attempt(s)</p><p className="mt-2 text-[11px] text-[var(--color-text-muted)]">{formatDate(row.createdAt)}</p>{row.lastErrorMessage && <p className="mt-2 text-xs text-red-700">{row.lastErrorMessage}</p>}</article>)}
            </div>
          </>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border-light)] px-4 py-3"><p className="text-xs text-[var(--color-text-muted)]">Page {page} of {pages}</p><div className="flex gap-2"><button type="button" onClick={() => setPage(value => Math.max(1,value-1))} disabled={page<=1 || query.isFetching} className="min-h-9 rounded-lg border border-[var(--color-border)] px-3 text-xs font-semibold disabled:opacity-40">Previous</button><button type="button" onClick={() => setPage(value => Math.min(pages,value+1))} disabled={page>=pages || query.isFetching} className="min-h-9 rounded-lg border border-[var(--color-border)] px-3 text-xs font-semibold disabled:opacity-40">Next</button></div></div>
      </section>
    </main>
  );
}
