import { useEffect, useState } from 'react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import PaginationBar from '../components/ui/PaginationBar';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  Edit3,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Truck,
  Users,
  Wallet,
  X
} from 'lucide-react';
import api from '../services/api';
import useSettingsStore from '../store/settingsStore';
import { useRole } from '../hooks/useRole';
import PageHeader from '../components/ui/PageHeader';
import Sheet from '../components/ui/Sheet';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import CardBody from '../components/ui/CardBody';
import Badge from '../components/ui/Badge';
import {
  getSupplierInitials,
  normalizeSupplierPayload,
  summarizeSuppliers
} from './supplierManagement.mjs';

const inputClass = 'input min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-gold)] focus:outline-none focus:ring-2 focus:ring-[rgba(197,164,109,0.2)]';

function money(value, fmt) {
  const amount = Number(value);
  return fmt(Number.isFinite(amount) ? amount : 0);
}

function dateLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_META = {
  draft: { label: 'Draft', variant: 'info' },
  ordered: { label: 'Ordered', variant: 'warning' },
  received: { label: 'Received', variant: 'success' },
  partial: { label: 'Partially paid', variant: 'warning' },
  paid: { label: 'Paid', variant: 'success' }
};

function Metric({ label, value, detail, Icon, tone = 'gold' }) {
  const tones = {
    gold: 'bg-[#f4eee3] text-[#80622e]',
    green: 'bg-[#eaf3ed] text-[#216442]',
    orange: 'bg-[#fbf1e3] text-[#8c5a19]',
    slate: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
  };
  return (
    <Card className="min-w-0">
      <CardBody className="flex h-full items-start gap-3 p-4 sm:p-5">
        <span className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ' + tones[tone]}>
          <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)] sm:text-[11px]">{label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--color-text)] sm:text-2xl">{value}</p>
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{detail}</p>
        </div>
      </CardBody>
    </Card>
  );
}

function SupplierIdentity({ supplier }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-gold-light)] bg-[#f8f5ef] text-xs font-bold tracking-wide text-[#70582e]">
        {getSupplierInitials(supplier.name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[var(--color-text)]">{supplier.name}</span>
        <span className="mt-1 block truncate text-xs text-[var(--color-text-muted)]">{supplier.company || 'Independent supplier'}</span>
      </span>
    </div>
  );
}

function ContactLine({ Icon, children }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
      <Icon size={13} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </span>
  );
}

function SupplierActions({ supplier, canDelete, onView, onEdit, onDelete }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => onView(supplier)}
        aria-label={'View ' + supplier.name}
        title="View supplier"
        className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]"
      >
        <ArrowUpRight size={17} />
      </button>
      <button
        type="button"
        onClick={() => onEdit(supplier)}
        aria-label={'Edit ' + supplier.name}
        title="Edit supplier"
        className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]"
      >
        <Edit3 size={16} />
      </button>
      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete(supplier)}
          aria-label={'Delete ' + supplier.name}
          title="Delete supplier"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-danger)] transition hover:bg-[#f8ecea]"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

function SupplierForm({ supplier, onSave, onClose, saving }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      name: supplier?.name || '',
      company: supplier?.company || '',
      email: supplier?.email || '',
      phone: supplier?.phone || '',
      address: supplier?.address || '',
      notes: supplier?.notes || ''
    }
  });
  const submit = values => onSave(normalizeSupplierPayload(values));

  const fieldError = name => errors[name]
    ? <p id={name + '-error'} role="alert" className="mt-1 text-xs text-[var(--color-danger)]">{errors[name].message}</p>
    : null;

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4 p-4 sm:p-5" noValidate>
      <div className="rounded-xl border border-[var(--color-gold-light)] bg-[#fbf8f1] p-3">
        <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
          Keep supplier contact details current for purchasing, receiving and accounts follow-up.
        </p>
      </div>

      <div>
        <label htmlFor="supplier-name" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">
          Supplier name <span className="text-[var(--color-danger)]">*</span>
        </label>
        <input
          id="supplier-name"
          autoComplete="organization"
          maxLength={100}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'name-error' : undefined}
          className={inputClass + (errors.name ? ' border-[var(--color-danger)]' : '')}
          placeholder="e.g. Al Nour Textiles"
          {...register('name', {
            required: 'Enter the supplier name.',
            maxLength: { value: 100, message: 'Name must be 100 characters or fewer.' },
            validate: value => Boolean(String(value || '').trim()) || 'Enter the supplier name.'
          })}
        />
        {fieldError('name')}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="supplier-company" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">Company</label>
          <input id="supplier-company" autoComplete="organization" maxLength={120} className={inputClass} placeholder="Company or trading name" {...register('company')} />
        </div>
        <div>
          <label htmlFor="supplier-phone" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">Phone number</label>
          <input id="supplier-phone" type="tel" autoComplete="tel" maxLength={40} className={inputClass} placeholder="+211 ..." {...register('phone')} />
        </div>
        <div>
          <label htmlFor="supplier-email" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">Email address</label>
          <input
            id="supplier-email"
            type="email"
            autoComplete="email"
            maxLength={254}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            className={inputClass + (errors.email ? ' border-[var(--color-danger)]' : '')}
            placeholder="orders@example.com"
            {...register('email', {
              validate: value => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Enter a valid email address.'
            })}
          />
          {fieldError('email')}
        </div>
        <div>
          <label htmlFor="supplier-address" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">Address</label>
          <input id="supplier-address" autoComplete="street-address" maxLength={180} className={inputClass} placeholder="Area, market or city" {...register('address')} />
        </div>
      </div>

      <div>
        <label htmlFor="supplier-notes" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">Internal notes</label>
        <textarea id="supplier-notes" rows={3} maxLength={1000} className={inputClass + ' min-h-24 resize-y'} placeholder="Optional supplier details for your team" {...register('notes')} />
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-border-light)] pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
        <Button type="submit" loading={saving || isSubmitting} className="w-full sm:w-auto">
          {supplier ? 'Save changes' : 'Add supplier'}
        </Button>
      </div>
    </form>
  );
}

function SupplierDetails({ supplierId, fmt }) {
  const supplierQuery = useQuery({
    queryKey: ['supplier-detail', supplierId],
    queryFn: async () => {
      const response = await api.get('/suppliers/' + supplierId);
      return response.data.data;
    },
    enabled: Boolean(supplierId)
  });
  const ordersQuery = useQuery({
    queryKey: ['supplier-orders', supplierId],
    queryFn: async () => {
      const response = await api.get('/purchase-orders', { params: { supplier: supplierId, limit: 50 } });
      return Array.isArray(response.data?.data) ? response.data.data : [];
    },
    enabled: Boolean(supplierId)
  });

  if (supplierQuery.isLoading || ordersQuery.isLoading) {
    return <div className="space-y-3 p-5" aria-label="Loading supplier details"><div className="h-24 animate-pulse rounded-2xl bg-[var(--color-bg-secondary)]" /><div className="h-40 animate-pulse rounded-2xl bg-[var(--color-bg-secondary)]" /></div>;
  }

  if (supplierQuery.isError || !supplierQuery.data) {
    return (
      <div className="space-y-3 p-5" role="alert">
        <p className="text-sm text-[var(--color-danger)]">
          {supplierQuery.error?.response?.data?.message || supplierQuery.error?.message || 'Supplier details could not be loaded.'}
        </p>
        <Button variant="secondary" size="sm" onClick={() => supplierQuery.refetch()}>Try again</Button>
      </div>
    );
  }

  const supplier = supplierQuery.data;
  const orders = ordersQuery.data || [];

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <Card>
        <CardBody className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <SupplierIdentity supplier={supplier} />
            <Badge variant={Number(supplier.debtBalance) > 0 ? 'warning' : 'success'}>
              {Number(supplier.debtBalance) > 0 ? 'Balance outstanding' : 'No outstanding balance'}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-[var(--color-border-light)] pt-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Supplier balance</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{money(supplier.debtBalance, fmt)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Purchase orders</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{orders.length}</p>
            </div>
          </div>
          <div className="space-y-2 border-t border-[var(--color-border-light)] pt-3">
            {supplier.phone && <ContactLine Icon={Phone}>{supplier.phone}</ContactLine>}
            {supplier.email && <ContactLine Icon={Mail}>{supplier.email}</ContactLine>}
            {supplier.address && <ContactLine Icon={MapPin}>{supplier.address}</ContactLine>}
            {!supplier.phone && !supplier.email && !supplier.address && <p className="text-xs text-[var(--color-text-muted)]">No contact details have been added.</p>}
          </div>
          {supplier.notes && <p className="rounded-xl bg-[var(--color-bg-secondary)] p-3 text-xs leading-5 text-[var(--color-text-secondary)]">{supplier.notes}</p>}
          <p className="text-[11px] text-[var(--color-text-muted)]">Supplier record created {dateLabel(supplier.createdAt)}</p>
        </CardBody>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Purchase order history</h3>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Latest 50 orders linked to this supplier</p>
          </div>
          <Badge>{orders.length} orders</Badge>
        </div>
        {ordersQuery.isError ? (
          <div className="rounded-xl border border-[var(--color-border)] p-3 text-xs text-[var(--color-text-muted)]">
            Purchase-order history is currently unavailable. Supplier details are still shown above.
            <button type="button" onClick={() => ordersQuery.refetch()} className="ml-2 font-semibold text-[#80622e] underline">Retry</button>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-8 text-center">
            <FileText size={22} className="mx-auto text-[var(--color-text-muted)]" />
            <p className="mt-2 text-sm font-medium text-[var(--color-text)]">No purchase orders yet</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">Orders created for this supplier will appear here.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white">
            <div className="divide-y divide-[var(--color-border-light)]">
              {orders.map(order => (
                <div key={order._id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[var(--color-text)]">{order.poNumber}</p>
                    <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{dateLabel(order.createdAt)} · {order.items?.length || 0} line item(s)</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold tabular-nums text-[var(--color-text)]">{money(order.grandTotal, fmt)}</p>
                    <Badge variant={STATUS_META[order.status]?.variant || 'info'}>{STATUS_META[order.status]?.label || order.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default function SuppliersPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [debouncedSearch, hasDebt]);
  const [hasDebt, setHasDebt] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const { fmt } = useSettingsStore();
  const { isAdmin, isManager } = useRole();
  const canManage = isAdmin || isManager;
  const queryClient = useQueryClient();

  const { data: supplierResponse, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['suppliers', { page, search: debouncedSearch, hasDebt }],
    queryFn: async () => {
      const params = { page, limit: 25 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (hasDebt) params.hasDebt = 'true';
      const response = await api.get('/suppliers', { params });
      return response.data;
    },
    enabled: canManage,
    placeholderData: previousData => previousData,
    staleTime: 30000
  });

  const suppliers = Array.isArray(supplierResponse?.data) ? supplierResponse.data : [];
  const filtered = suppliers;
  const total = Number(supplierResponse?.total) || suppliers.length;
  const totalPages = Math.max(1, Number(supplierResponse?.totalPages) || 1);
  const summary = supplierResponse?.summary || summarizeSuppliers(suppliers);

  const saveMutation = useMutation({
    mutationFn: ({ id, values }) => id
      ? api.put('/suppliers/' + id, values)
      : api.post('/suppliers', values),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      if (variables.id) await queryClient.invalidateQueries({ queryKey: ['supplier-detail', variables.id] });
      toast.success(variables.id ? 'Supplier details updated.' : 'Supplier added.');
      setFormOpen(false);
      setEditing(null);
    },
    onError: error => toast.error(error?.response?.data?.message || 'Supplier could not be saved.')
  });

  const deleteMutation = useMutation({
    mutationFn: id => api.delete('/suppliers/' + id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier removed from the active supplier list. Historical purchase orders are retained.');
      setDeleting(null);
      setSelected(null);
    },
    onError: error => toast.error(error?.response?.data?.message || 'Supplier could not be deleted.')
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = supplier => {
    setSelected(null);
    setEditing(supplier);
    setFormOpen(true);
  };
  const closeForm = () => {
    if (saveMutation.isPending) return;
    setFormOpen(false);
    setEditing(null);
  };

  const pageSummary = filtered.length === suppliers.length
    ? suppliers.length + ' suppliers'
    : filtered.length + ' of ' + suppliers.length + ' suppliers';

  return (
    <main className="space-y-5 p-4 pb-8 sm:space-y-6 sm:p-6 lg:p-7">
      <PageHeader
        title="Supplier management"
        sub="Manage supplier relationships, contact information and purchase obligations"
        action={canManage ? <Button onClick={openCreate}><Plus size={16} /> Add supplier</Button> : null}
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Supplier overview">
        <Metric label="Suppliers" value={summary.count.toLocaleString('en-IN')} detail="Active supplier records" Icon={Truck} tone="gold" />
        <Metric label="Outstanding balances" value={money(summary.totalDebt, fmt)} detail={summary.withDebt + ' suppliers with a balance'} Icon={Wallet} tone="orange" />
        <Metric label="Contact coverage" value={summary.count ? Math.round((summary.withPhone / summary.count) * 100) + '%' : '—'} detail={summary.withPhone + ' suppliers with phone numbers'} Icon={Users} tone="green" />
      </section>

      {summary.withDebt > 0 && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-[#ead8ad] bg-[#fbf8f1] p-3.5">
          <ShieldAlert size={17} className="mt-0.5 shrink-0 text-[#80622e]" />
          <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
            Supplier balances represent amounts owed by the business. Record supplier payments from the relevant purchase order so its balance and the supplier account stay aligned.
          </p>
        </div>
      )}

      <section className="space-y-3" aria-label="Supplier filters">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden="true" />
          <label className="sr-only" htmlFor="supplier-search">Search suppliers</label>
          <input
            id="supplier-search"
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search supplier, company, phone or email…"
            className={inputClass + ' min-h-12 pl-10 pr-10'}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear supplier search" className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
              <X size={15} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-white p-1" role="group" aria-label="Filter suppliers by outstanding balance">
            <button type="button" aria-pressed={!hasDebt} onClick={() => setHasDebt(false)} className={'min-h-9 rounded-lg px-3 text-xs font-semibold transition ' + (!hasDebt ? 'bg-[#171717] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]')}>All suppliers</button>
            <button type="button" aria-pressed={hasDebt} onClick={() => setHasDebt(true)} className={'min-h-9 rounded-lg px-3 text-xs font-semibold transition ' + (hasDebt ? 'bg-[#171717] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]')}>Outstanding balance</button>
          </div>
          <p className="text-xs tabular-nums text-[var(--color-text-muted)]">{pageSummary}</p>
        </div>
      </section>

      {isError && (
        <Card role="alert">
          <CardBody className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-[var(--color-danger)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">Suppliers could not be loaded</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{error?.response?.data?.message || error?.message || 'Check your connection and try again.'}</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => refetch()} loading={isFetching}>Try again</Button>
          </CardBody>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading suppliers">
          {[0, 1, 2, 3, 4, 5].map(index => <div key={index} className="h-40 animate-pulse rounded-2xl border border-[var(--color-border)] bg-white" />)}
        </div>
      ) : !isError && filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white px-5 py-14 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4eee3] text-[#80622e]"><Truck size={22} /></span>
          <h2 className="mt-3 text-sm font-semibold text-[var(--color-text)]">{suppliers.length ? 'No matching suppliers' : 'Your supplier directory is ready'}</h2>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[var(--color-text-muted)]">
            {suppliers.length ? 'Try another search or clear the outstanding-balance filter.' : 'Add a supplier to organise purchasing and accounts follow-up.'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {(search || hasDebt) && <Button variant="secondary" size="sm" onClick={() => { setSearch(''); setHasDebt(false); }}>Clear filters</Button>}
            {!suppliers.length && canManage && <Button size="sm" onClick={openCreate}><Plus size={15} /> Add supplier</Button>}
          </div>
        </div>
      ) : !isError && (
        <section className="space-y-3" aria-label="Supplier results">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Supplier directory</h2>
            <span className="text-xs text-[var(--color-text-muted)]">Live supplier records</span>
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white lg:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-[var(--color-bg-secondary)] text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Supplier</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Phone / Email</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Added</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Amount owed</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-light)]">
                  {filtered.map(supplier => (
                    <tr key={supplier._id} className="transition hover:bg-[var(--color-bg-secondary)]/60">
                      <td className="px-4 py-3"><SupplierIdentity supplier={supplier} /></td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {supplier.phone && <ContactLine Icon={Phone}>{supplier.phone}</ContactLine>}
                          {supplier.email && <ContactLine Icon={Mail}>{supplier.email}</ContactLine>}
                          {!supplier.phone && !supplier.email && <span className="text-xs text-[var(--color-text-muted)]">No contact details</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{dateLabel(supplier.createdAt)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-[var(--color-text)]">{money(supplier.debtBalance, fmt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end"><SupplierActions supplier={supplier} canDelete={isAdmin} onView={setSelected} onEdit={supplier => { setSelected(null); setEditing(supplier); setFormOpen(true); }} onDelete={setDeleting} /></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            {filtered.map(supplier => (
              <Card key={supplier._id} className="overflow-hidden transition hover:border-[var(--color-gold-light)] hover:shadow-sm">
                <CardBody className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <SupplierIdentity supplier={supplier} />
                    <SupplierActions supplier={supplier} canDelete={isAdmin} onView={setSelected} onEdit={supplier => { setSelected(null); setEditing(supplier); setFormOpen(true); }} onDelete={setDeleting} />
                  </div>
                  <div className="space-y-2 border-t border-[var(--color-border-light)] pt-3">
                    {supplier.phone && <ContactLine Icon={Phone}>{supplier.phone}</ContactLine>}
                    {supplier.email && <ContactLine Icon={Mail}>{supplier.email}</ContactLine>}
                    {supplier.address && <ContactLine Icon={MapPin}>{supplier.address}</ContactLine>}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Amount owed by business</span>
                      <span className="text-sm font-semibold tabular-nums">{money(supplier.debtBalance, fmt)}</span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      <PaginationBar page={page} total={total} totalPages={totalPages} onPageChange={setPage} />

      <Sheet open={formOpen} title={editing ? 'Edit supplier' : 'Add supplier'} subtitle={editing ? 'Update supplier details' : 'Create a supplier record for purchasing'} onClose={closeForm} maxH="94dvh">
        <SupplierForm
          key={editing?._id || 'new-supplier'}
          supplier={editing}
          saving={saveMutation.isPending}
          onClose={closeForm}
          onSave={values => saveMutation.mutate({ id: editing?._id, values })}
        />
      </Sheet>

      <Sheet open={Boolean(selected)} title={selected?.name || 'Supplier details'} subtitle="Supplier account and purchase history" onClose={() => setSelected(null)} maxH="94dvh">
        {selected && <SupplierDetails supplierId={selected._id} fmt={fmt} />}
      </Sheet>

      <Sheet open={Boolean(deleting)} title="Remove supplier?" subtitle="This removes the supplier from the active directory" onClose={() => deleteMutation.isPending ? null : setDeleting(null)} maxH="auto">
        {deleting && (
          <div className="space-y-4 p-5">
            <div className="rounded-xl border border-[#f0d6d2] bg-[#fff7f5] p-3">
              <p className="text-sm font-semibold text-[var(--color-text)]">{deleting.name}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                This supplier will be soft-deleted and hidden from the active directory. Historical purchase orders will be retained. The admin API also restricts this action.
              </p>
              {Number(deleting.debtBalance) > 0 && (
                <p className="mt-2 text-xs font-semibold text-[var(--color-danger)]">
                  Outstanding balance: {money(deleting.debtBalance, fmt)}. Reconcile this balance before removing the supplier.
                </p>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setDeleting(null)} disabled={deleteMutation.isPending}>Cancel</Button>
              <Button variant="danger" loading={deleteMutation.isPending} disabled={Number(deleting.debtBalance) > 0} onClick={() => deleteMutation.mutate(deleting._id)}>
                <Trash2 size={15} /> Remove supplier
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </main>
  );
}
