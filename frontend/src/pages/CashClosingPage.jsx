import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useRole } from '../hooks/useRole';
import useSettingsStore from '../store/settingsStore';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import CardBody from '../components/ui/CardBody';
import Badge from '../components/ui/Badge';
import Sheet from '../components/ui/Sheet';
import {
  AlertCircle,
  ArrowLeftRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet
} from 'lucide-react';

const inputClass = 'input min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-gold)] focus:outline-none focus:ring-2 focus:ring-[rgba(197,164,109,0.2)]';

const STATUS_STYLES = {
  pending_approval: { badge: 'warning', label: 'Pending approval' },
  approved: { badge: 'success', label: 'Approved' },
  disputed: { badge: 'danger', label: 'Disputed' }
};

function money(value, fmt) {
  const amount = Number(value);
  return fmt(Number.isFinite(amount) ? amount : 0);
}

function Metric({ label, value, detail, Icon, tone = 'gold' }) {
  const tones = {
    gold: 'bg-[#f4eee3] text-[#80622e]',
    green: 'bg-[#eaf3ed] text-[#216442]',
    red: 'bg-[#f8ecea] text-[#963b3b]',
    slate: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
  };
  return (
    <Card className="min-w-0">
      <CardBody className="flex items-start gap-3 p-4 sm:p-5">
        <span className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ' + tones[tone]}>
          <Icon size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--color-text)] sm:text-2xl">{value}</p>
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{detail}</p>
        </div>
      </CardBody>
    </Card>
  );
}

function dateLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function CloseDayForm({ openingCash, netCash, fmt, onSave, onClose, saving }) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: { actualCash: Number.isFinite(netCash) ? netCash.toFixed(2) : '', notes: '' }
  });
  const actualCash = Number(watch('actualCash'));
  const diff = Number.isFinite(actualCash) ? actualCash - netCash : null;

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4 p-4 sm:p-5" noValidate>
      <Card>
        <CardBody className="space-y-2 p-3">
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-[var(--color-text-muted)]">Opening cash</span>
            <strong className="tabular-nums">{fmt(openingCash || 0)}</strong>
          </div>
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-[var(--color-text-muted)]">Expected closing cash</span>
            <strong className="tabular-nums">{fmt(netCash || 0)}</strong>
          </div>
        </CardBody>
      </Card>

      <div>
        <label htmlFor="actual-cash" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">
          Actual cash counted <span className="text-[var(--color-danger)]">*</span>
        </label>
        <input
          id="actual-cash"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          className={inputClass + (errors.actualCash ? ' border-[var(--color-danger)]' : '')}
          aria-invalid={Boolean(errors.actualCash)}
          aria-describedby={errors.actualCash ? 'actual-cash-error' : undefined}
          {...register('actualCash', {
            required: 'Enter the actual cash count.',
            valueAsNumber: true,
            min: { value: 0, message: 'Cash count cannot be negative.' },
            validate: value => Number.isFinite(value) || 'Enter a valid cash amount.'
          })}
        />
        {errors.actualCash && <p id="actual-cash-error" role="alert" className="mt-1 text-xs text-[var(--color-danger)]">{errors.actualCash.message}</p>}
      </div>

      {diff !== null && (
        <Card>
          <CardBody className="flex items-center justify-between gap-3 p-3">
            <span className="text-sm font-semibold text-[var(--color-text)]">
              {Math.abs(diff) < 0.01 ? 'Balanced' : diff < 0 ? 'Cash shortage' : 'Cash excess'}
            </span>
            <strong className={'text-lg tabular-nums ' + (Math.abs(diff) < 0.01 ? 'text-[var(--color-success)]' : diff < 0 ? 'text-[var(--color-danger)]' : 'text-[#80622e]')}>
              {diff >= 0 ? '+' : '−'}{fmt(Math.abs(diff))}
            </strong>
          </CardBody>
        </Card>
      )}

      <div>
        <label htmlFor="closing-notes" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">Notes for the approving admin</label>
        <textarea id="closing-notes" rows={3} maxLength={500} className={inputClass + ' min-h-24 resize-y'} placeholder="Explain any shortage or excess…" {...register('notes')} />
      </div>

      <div className="rounded-xl border border-[#ead8ad] bg-[#fbf8f1] p-3">
        <p className="text-xs leading-5 text-[var(--color-text-secondary)]">The closing is submitted for review. The day is marked closed only after an admin approves it.</p>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
        <Button type="submit" loading={saving} className="w-full sm:w-auto"><LockKeyhole size={15} /> Submit closing</Button>
      </div>
    </form>
  );
}

function RateForm({ currentRate, onSave, onClose, saving }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { usdToSsp: currentRate }
  });
  return (
    <form onSubmit={handleSubmit(values => onSave(Number(values.usdToSsp)))} className="space-y-4 p-4 sm:p-5" noValidate>
      <Card>
        <CardBody className="p-3">
          <p className="text-xs text-[var(--color-text-muted)]">Current exchange rate</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">1 USD = {Number(currentRate).toLocaleString('en-US')} SSP</p>
        </CardBody>
      </Card>
      <div>
        <label htmlFor="usd-to-ssp" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">New rate (SSP per 1 USD)</label>
        <input
          id="usd-to-ssp"
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          className={inputClass + (errors.usdToSsp ? ' border-[var(--color-danger)]' : '')}
          aria-invalid={Boolean(errors.usdToSsp)}
          {...register('usdToSsp', {
            required: 'Enter the exchange rate.',
            valueAsNumber: true,
            min: { value: 1, message: 'Exchange rate must be at least 1.' },
            validate: value => Number.isFinite(value) || 'Enter a valid rate.'
          })}
        />
        {errors.usdToSsp && <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">{errors.usdToSsp.message}</p>}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
        <Button type="submit" loading={saving} className="w-full sm:w-auto"><ArrowLeftRight size={15} /> Update rate</Button>
      </div>
    </form>
  );
}

export default function CashClosingPage() {
  const [closeOpen, setCloseOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const { can, isAdmin } = useRole();
  const { fmt, setCurrency, currency, usdToSsp, setRate } = useSettingsStore();
  const queryClient = useQueryClient();

  const todayQuery = useQuery({
    queryKey: ['cashbook-today'],
    queryFn: async () => {
      const response = await api.get('/cashbook/today');
      return response.data.data;
    },
    refetchInterval: 30000
  });
  const closingsQuery = useQuery({
    queryKey: ['cash-closings'],
    queryFn: async () => {
      const response = await api.get('/cashbook/closings');
      return Array.isArray(response.data?.data) ? response.data.data : [];
    }
  });
  const historyQuery = useQuery({
    queryKey: ['cashbook-history'],
    queryFn: async () => {
      const response = await api.get('/cashbook/history');
      return Array.isArray(response.data?.data) ? response.data.data : [];
    }
  });
  const rateQuery = useQuery({
    queryKey: ['exchange-rate'],
    queryFn: async () => {
      const response = await api.get('/cashbook/rate');
      return response.data.data;
    }
  });

  useEffect(() => {
    if (rateQuery.data?.usdToSsp && Number(rateQuery.data.usdToSsp) !== usdToSsp) {
      setRate(Number(rateQuery.data.usdToSsp));
    }
  }, [rateQuery.data?.usdToSsp, usdToSsp, setRate]);

  const openMutation = useMutation({
    mutationFn: () => api.post('/cashbook/open'),
    onSuccess: async response => {
      queryClient.setQueryData(['cashbook-today'], response.data.data);
      await queryClient.invalidateQueries({ queryKey: ['cashbook-history'] });
      toast.success(response.data.message || 'Cashbook opened.');
    },
    onError: error => toast.error(error?.response?.data?.message || 'Cashbook could not be opened.')
  });
  const closeMutation = useMutation({
    mutationFn: values => api.post('/cashbook/close', values),
    onSuccess: async response => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['cashbook-today'] }),
        queryClient.invalidateQueries({ queryKey: ['cash-closings'] }),
        queryClient.invalidateQueries({ queryKey: ['cashbook-history'] })
      ]);
      toast.success(response.data.message || 'Closing submitted for approval.');
      setCloseOpen(false);
    },
    onError: error => toast.error(error?.response?.data?.message || 'Cash closing could not be submitted.')
  });
  const approveMutation = useMutation({
    mutationFn: id => api.post('/cashbook/approve/' + id),
    onSuccess: async response => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['cash-closings'] }),
        queryClient.invalidateQueries({ queryKey: ['cashbook-today'] }),
        queryClient.invalidateQueries({ queryKey: ['cashbook-history'] })
      ]);
      toast.success(response.data.message || 'Cash closing approved.');
    },
    onError: error => toast.error(error?.response?.data?.message || 'Closing approval failed.')
  });
  const rateMutation = useMutation({
    mutationFn: usdToSsp => api.post('/cashbook/rate', { usdToSsp }),
    onSuccess: async response => {
      const savedRate = Number(response.data?.data?.usdToSsp);
      if (savedRate > 0) setRate(savedRate);
      await queryClient.invalidateQueries({ queryKey: ['exchange-rate'] });
      toast.success(response.data.message || 'Exchange rate updated.');
      setRateOpen(false);
    },
    onError: error => toast.error(error?.response?.data?.message || 'Exchange rate could not be updated.')
  });

  const today = todayQuery.data;
  const closings = closingsQuery.data || [];
  const history = historyQuery.data || [];
  const netCash = (Number(today?.openingCash) || 0) + (Number(today?.livesCashSales) || 0) - (Number(today?.liveExpenses) || 0);
  const todayString = today?.date || new Date().toISOString().slice(0, 10);
  const todayClosing = closings.find(item => item.date === todayString);
  const pendingApprovals = useMemo(() => closings.filter(item => item.status === 'pending_approval'), [closings]);
  const loading = todayQuery.isLoading;
  const hasError = todayQuery.isError || closingsQuery.isError || historyQuery.isError || rateQuery.isError;

  return (
    <main className="space-y-5 p-4 pb-8 sm:space-y-6 sm:p-6 lg:p-7">
      <PageHeader
        title="Cashbook"
        sub={new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setRateOpen(true)}><ArrowLeftRight size={15} /> Rate: {Number(usdToSsp).toLocaleString('en-US')} SSP</Button>
            {can.closeCashbook && !loading && !today && !todayQuery.isError && (
              <Button size="sm" onClick={() => openMutation.mutate()} loading={openMutation.isPending}><BookOpen size={15} /> Open today</Button>
            )}
            {can.closeCashbook && today && !today.isClosed && todayClosing?.status !== 'pending_approval' && (
              <Button size="sm" onClick={() => setCloseOpen(true)}><LockKeyhole size={15} /> Close day</Button>
            )}
          </div>
        }
      />

      <div className="flex items-start gap-2.5 rounded-2xl border border-[#ead8ad] bg-[#fbf8f1] p-3.5">
        <AlertCircle size={17} className="mt-0.5 shrink-0 text-[#80622e]" />
        <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
          Cashbook expected cash currently subtracts all recorded expenses from cash sales. Expense records do not store a payment method, so this figure should be reviewed against the actual cash count before approval.
        </p>
      </div>

      {hasError && (
        <Card role="alert">
          <CardBody className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--color-danger)]">Some cashbook information could not be loaded. Refresh the affected sections to try again.</p>
            <Button size="sm" variant="secondary" onClick={() => {
              todayQuery.refetch();
              closingsQuery.refetch();
              historyQuery.refetch();
              rateQuery.refetch();
            }}><RefreshCw size={14} /> Retry</Button>
          </CardBody>
        </Card>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Today's cash position">
        <Metric label="Opening cash" value={money(today?.openingCash, fmt)} detail="Balance carried into the day" Icon={BookOpen} tone="slate" />
        <Metric label="Cash sales" value={money(today?.livesCashSales, fmt)} detail="Cash-paid invoices today" Icon={TrendingUp} tone="green" />
        <Metric label="Recorded expenses" value={money(today?.liveExpenses, fmt)} detail="All expenses recorded today" Icon={TrendingDown} tone="red" />
        <Metric label="Expected cash" value={money(netCash, fmt)} detail="Opening + sales − expenses" Icon={Wallet} tone="gold" />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-3">
        <div>
          <p className="text-xs font-semibold text-[var(--color-text)]">Display currency</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">Stored amounts remain in USD base values</p>
        </div>
        <div className="flex rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-1" role="group" aria-label="Display currency">
          {['USD', 'SSP'].map(value => (
            <button key={value} type="button" aria-pressed={currency === value} onClick={() => setCurrency(value)} className={'min-h-9 rounded-lg px-4 text-xs font-semibold ' + (currency === value ? 'bg-white text-[#80622e] shadow-sm' : 'text-[var(--color-text-secondary)]')}>{value}</button>
          ))}
        </div>
      </section>

      {!loading && !today && !todayQuery.isError && (
        <Card>
          <CardBody className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)]">No cashbook is open for today</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">Open today’s cashbook before recording the daily cash position.</p>
            </div>
            {can.closeCashbook && <Button onClick={() => openMutation.mutate()} loading={openMutation.isPending}><BookOpen size={15} /> Open cashbook</Button>}
          </CardBody>
        </Card>
      )}

      {today && todayClosing && (
        <Card>
          <CardBody className="space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {todayClosing.status === 'approved' ? <CheckCircle2 size={18} className="text-[var(--color-success)]" /> : <Clock3 size={18} className="text-[#80622e]" />}
                <h2 className="text-sm font-semibold text-[var(--color-text)]">Today's closing status</h2>
              </div>
              <Badge variant={STATUS_STYLES[todayClosing.status]?.badge || 'info'}>{STATUS_STYLES[todayClosing.status]?.label || todayClosing.status}</Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><p className="text-xs text-[var(--color-text-muted)]">Expected</p><p className="mt-1 text-base font-semibold tabular-nums">{money(todayClosing.expectedCash, fmt)}</p></div>
              <div><p className="text-xs text-[var(--color-text-muted)]">Counted</p><p className="mt-1 text-base font-semibold tabular-nums">{money(todayClosing.actualCash, fmt)}</p></div>
              <div><p className="text-xs text-[var(--color-text-muted)]">{Number(todayClosing.shortage) > 0 ? 'Shortage' : 'Excess'}</p><p className={'mt-1 text-base font-semibold tabular-nums ' + (Number(todayClosing.shortage) > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]')}>{Number(todayClosing.shortage) > 0 ? '−' + money(todayClosing.shortage, fmt) : '+' + money(todayClosing.excess, fmt)}</p></div>
            </div>
            {todayClosing.notes && <p className="rounded-xl bg-[var(--color-bg-secondary)] p-3 text-xs text-[var(--color-text-secondary)]">{todayClosing.notes}</p>}
            {isAdmin && todayClosing.status === 'pending_approval' && <div className="flex justify-end"><Button size="sm" onClick={() => approveMutation.mutate(todayClosing._id)} loading={approveMutation.isPending}><ShieldCheck size={15} /> Approve closing</Button></div>}
          </CardBody>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardBody className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="text-sm font-semibold text-[var(--color-text)]">Pending closing approvals</h2><p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Manager submissions requiring admin review</p></div>
              <Badge variant={pendingApprovals.length ? 'warning' : 'success'}>{pendingApprovals.length} pending</Badge>
            </div>
            {pendingApprovals.length === 0 ? (
              <p className="rounded-xl bg-[var(--color-bg-secondary)] p-4 text-center text-xs text-[var(--color-text-muted)]">No pending approvals.</p>
            ) : (
              <div className="divide-y divide-[var(--color-border-light)]">
                {pendingApprovals.map(item => (
                  <div key={item._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0"><p className="text-sm font-semibold text-[var(--color-text)]">{item.date} · {item.closedByName || 'Manager'}</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">Expected {money(item.expectedCash, fmt)} · Counted {money(item.actualCash, fmt)}</p></div>
                    <Button size="sm" onClick={() => approveMutation.mutate(item._id)} loading={approveMutation.isPending}><CheckCircle2 size={14} /> Approve</Button>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-sm font-semibold text-[var(--color-text)]">Daily cashbook history</h2><p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Most recent 30 business days</p></div>
            {historyQuery.isFetching && <span className="text-[11px] text-[var(--color-text-muted)]">Updating…</span>}
          </div>
          {history.length === 0 ? (
            <p className="rounded-xl bg-[var(--color-bg-secondary)] p-4 text-center text-xs text-[var(--color-text-muted)]">No cashbook history yet.</p>
          ) : (
            <div className="divide-y divide-[var(--color-border-light)]">
              {history.map(entry => (
                <div key={entry._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]"><BookOpen size={17} /></span>
                    <div><p className="text-sm font-semibold text-[var(--color-text)]">{entry.date}</p><p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Opening balance {money(entry.openingCash, fmt)}</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    {entry.isClosed ? <Badge variant="success">Closed</Badge> : <Badge variant="warning">Open</Badge>}
                    <div className="text-right"><p className="text-xs font-semibold tabular-nums text-[var(--color-text)]">{entry.isClosed ? money(entry.closingCash, fmt) : '—'}</p><p className="text-[10px] text-[var(--color-text-muted)]">Closing balance</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Sheet open={closeOpen && Boolean(today)} title="Close the day" subtitle="Enter the actual cash count in the register" onClose={() => closeMutation.isPending ? null : setCloseOpen(false)} maxH="94dvh">
        <CloseDayForm
          key={today?.date || 'closing'}
          openingCash={today?.openingCash}
          netCash={netCash}
          fmt={fmt}
          saving={closeMutation.isPending}
          onClose={() => setCloseOpen(false)}
          onSave={values => closeMutation.mutate(values)}
        />
      </Sheet>

      <Sheet open={rateOpen} title="Update exchange rate" subtitle="Set the display conversion from USD to SSP" onClose={() => rateMutation.isPending ? null : setRateOpen(false)} maxH="auto">
        <RateForm currentRate={usdToSsp} saving={rateMutation.isPending} onClose={() => setRateOpen(false)} onSave={value => rateMutation.mutate(value)} />
      </Sheet>
    </main>
  );
}
