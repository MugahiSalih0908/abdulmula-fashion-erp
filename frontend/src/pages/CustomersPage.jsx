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
  CalendarDays,
  CreditCard,
  Edit3,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  Star,
  Trash2,
  UserRound,
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
  getCustomerInitials,
  normalizeCustomerPayload,
  summarizeCustomers
} from './customerManagement.mjs';

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

function Metric({ label, value, detail, Icon, tone = 'gold' }) {
  const tones = {
    gold: 'bg-[#f4eee3] text-[#80622e]',
    green: 'bg-[#eaf3ed] text-[#216442]',
    red: 'bg-[#f8ecea] text-[#963b3b]',
    slate: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
  };

  return (
    <Card className="min-w-0">
      <CardBody className="flex h-full items-start gap-3 p-4 sm:p-5">
        <span className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ' + tones[tone]}>
          <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)] sm:text-[11px]">
            {label}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--color-text)] sm:text-2xl">{value}</p>
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{detail}</p>
        </div>
      </CardBody>
    </Card>
  );
}

function CustomerIdentity({ customer, compact = false }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-gold-light)] bg-[#f8f5ef] text-xs font-bold tracking-wide text-[#70582e]">
        {getCustomerInitials(customer.name)}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="block max-w-full truncate text-sm font-semibold text-[var(--color-text)]">{customer.name}</span>
          {Number(customer.totalPurchases) > 500 && (
            <span title="High-value customer" aria-label="High-value customer">
              <Star size={13} className="fill-[#c79b45] text-[#c79b45]" />
            </span>
          )}
        </span>
        {!compact && (
          <span className="mt-1 block truncate text-xs text-[var(--color-text-muted)]">
            {customer.email || 'No email address'}
          </span>
        )}
      </span>
    </div>
  );
}

function CreditBadge({ balance, fmt }) {
  const amount = Number(balance) || 0;
  return amount > 0
    ? <Badge variant="danger">Outstanding {money(amount, fmt)}</Badge>
    : <Badge variant="success">No outstanding credit</Badge>;
}

function ContactLine({ Icon, children }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
      <Icon size={13} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </span>
  );
}

function CustomerActions({ customer, canManage, onView, onEdit, onDelete }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {customer.phone && (
        <a
          href={'https://wa.me/' + customer.phone.replace(/\D/g, '')}
          target="_blank"
          rel="noreferrer"
          aria-label={'Open WhatsApp chat with ' + customer.name}
          title="WhatsApp"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-[#28744b] transition hover:bg-[#eaf3ed] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#80622e]"
        >
          <MessageCircle size={17} />
        </a>
      )}
      <button
        type="button"
        onClick={() => onView(customer)}
        aria-label={'View ' + customer.name}
        title="View customer"
        className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]"
      >
        <ArrowUpRight size={17} />
      </button>
      <button
        type="button"
        onClick={() => onEdit(customer)}
        aria-label={'Edit ' + customer.name}
        title="Edit customer"
        className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]"
      >
        <Edit3 size={16} />
      </button>
      {canManage && (
        <button
          type="button"
          onClick={() => onDelete(customer)}
          aria-label={'Delete ' + customer.name}
          title="Delete customer"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-danger)] transition hover:bg-[#f8ecea]"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

function CustomerMobileCard({ customer, fmt, canManage, onView, onEdit, onDelete }) {
  return (
    <motion.article layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="overflow-hidden transition hover:border-[var(--color-gold-light)] hover:shadow-sm">
        <CardBody className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <CustomerIdentity customer={customer} />
            <CustomerActions
              customer={customer}
              canManage={canManage}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-[var(--color-border-light)] pt-3">
            <div className="min-w-0 space-y-2">
              {customer.phone && <ContactLine Icon={Phone}>{customer.phone}</ContactLine>}
              {customer.address && <ContactLine Icon={MapPin}>{customer.address}</ContactLine>}
              <p className="text-[11px] text-[var(--color-text-muted)]">Added {dateLabel(customer.createdAt)}</p>
            </div>
            <div className="space-y-2 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Lifetime purchases</p>
              <p className="text-sm font-semibold tabular-nums text-[var(--color-text)]">{money(customer.totalPurchases, fmt)}</p>
              <div className="flex justify-end"><CreditBadge balance={customer.creditBalance} fmt={fmt} /></div>
            </div>
          </div>
        </CardBody>
      </Card>
    </motion.article>
  );
}

function CustomerForm({ customer, onSave, onClose, saving }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      name: customer?.name || '',
      email: customer?.email || '',
      phone: customer?.phone || '',
      address: customer?.address || '',
      notes: customer?.notes || ''
    }
  });

  const submit = values => onSave(normalizeCustomerPayload(values));

  const fieldError = (name, message) => (
    errors[name] ? <p id={name + '-error'} role="alert" className="mt-1 text-xs text-[var(--color-danger)]">{errors[name].message}</p> :
      message ? <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{message}</p> : null
  );

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4 p-4 sm:p-5" noValidate>
      <div className="rounded-xl border border-[var(--color-gold-light)] bg-[#fbf8f1] p-3">
        <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
          Keep customer contact details accurate so staff can identify the right customer at checkout and follow up when needed.
        </p>
      </div>

      <div>
        <label htmlFor="customer-name" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">
          Customer name <span className="text-[var(--color-danger)]">*</span>
        </label>
        <input
          id="customer-name"
          autoComplete="name"
          maxLength={100}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'name-error' : undefined}
          className={inputClass + (errors.name ? ' border-[var(--color-danger)]' : '')}
          placeholder="e.g. Amina Hassan"
          {...register('name', {
            required: 'Enter the customer name.',
            maxLength: { value: 100, message: 'Name must be 100 characters or fewer.' },
            validate: value => Boolean(String(value || '').trim()) || 'Enter the customer name.'
          })}
        />
        {fieldError('name')}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="customer-email" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">Email address</label>
          <input
            id="customer-email"
            type="email"
            autoComplete="email"
            maxLength={254}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            className={inputClass + (errors.email ? ' border-[var(--color-danger)]' : '')}
            placeholder="name@example.com"
            {...register('email', {
              validate: value => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Enter a valid email address.'
            })}
          />
          {fieldError('email')}
        </div>

        <div>
          <label htmlFor="customer-phone" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">Phone number</label>
          <input
            id="customer-phone"
            type="tel"
            autoComplete="tel"
            maxLength={40}
            className={inputClass}
            placeholder="+211 ..."
            {...register('phone')}
          />
          {fieldError('phone', 'Include the country code when available.')}
        </div>
      </div>

      <div>
        <label htmlFor="customer-address" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">Address</label>
        <input
          id="customer-address"
          autoComplete="street-address"
          maxLength={180}
          className={inputClass}
          placeholder="Area, market or neighbourhood"
          {...register('address')}
        />
      </div>

      <div>
        <label htmlFor="customer-notes" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">Internal notes</label>
        <textarea
          id="customer-notes"
          rows={3}
          maxLength={1000}
          className={inputClass + ' min-h-24 resize-y'}
          placeholder="Optional notes for your team"
          {...register('notes')}
        />
        <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">Notes are for staff reference, not customer-facing messages.</p>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-border-light)] pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
        <Button type="submit" loading={saving || isSubmitting} className="w-full sm:w-auto">
          {customer ? 'Save changes' : 'Add customer'}
        </Button>
      </div>
    </form>
  );
}

function CustomerDetails({ customerId, fmt, onEdit }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['customer-detail', customerId],
    queryFn: async () => {
      const response = await api.get('/customers/' + customerId);
      return response.data;
    },
    enabled: Boolean(customerId)
  });

  if (isLoading) {
    return (
      <div className="space-y-3 p-5" aria-label="Loading customer details">
        <div className="h-20 animate-pulse rounded-2xl bg-[var(--color-bg-secondary)]" />
        <div className="h-32 animate-pulse rounded-2xl bg-[var(--color-bg-secondary)]" />
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="space-y-3 p-5" role="alert">
        <p className="text-sm text-[var(--color-danger)]">{error?.response?.data?.message || error?.message || 'Customer details could not be loaded.'}</p>
        <Button variant="secondary" size="sm" onClick={() => refetch()} loading={isFetching}>Try again</Button>
      </div>
    );
  }

  const record = data.data;
  const invoices = Array.isArray(data.invoices) ? data.invoices : [];

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <Card>
        <CardBody className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <CustomerIdentity customer={record} />
            <Button variant="secondary" size="sm" onClick={() => onEdit(record)}><Edit3 size={14} /> Edit</Button>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-[var(--color-border-light)] pt-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Total purchases</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{money(record.totalPurchases, fmt)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Outstanding credit</p>
              <p className={'mt-1 text-lg font-semibold tabular-nums ' + (Number(record.creditBalance) > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]')}>
                {money(record.creditBalance, fmt)}
              </p>
            </div>
          </div>
          <div className="space-y-2 border-t border-[var(--color-border-light)] pt-3">
            {record.phone && <ContactLine Icon={Phone}>{record.phone}</ContactLine>}
            {record.email && <ContactLine Icon={Mail}>{record.email}</ContactLine>}
            {record.address && <ContactLine Icon={MapPin}>{record.address}</ContactLine>}
            {!record.phone && !record.email && !record.address && (
              <p className="text-xs text-[var(--color-text-muted)]">No contact details have been added.</p>
            )}
          </div>
          {record.notes && <p className="rounded-xl bg-[var(--color-bg-secondary)] p-3 text-xs leading-5 text-[var(--color-text-secondary)]">{record.notes}</p>}
          <p className="text-[11px] text-[var(--color-text-muted)]">Customer since {dateLabel(record.createdAt)}</p>
        </CardBody>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Recent invoices</h3>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Latest 20 invoices linked to this customer</p>
          </div>
          <Badge>{invoices.length} records</Badge>
        </div>
        {invoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-8 text-center">
            <CreditCard size={22} className="mx-auto text-[var(--color-text-muted)]" />
            <p className="mt-2 text-sm font-medium text-[var(--color-text)]">No invoices yet</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">Sales linked to this customer will appear here.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white">
            <div className="divide-y divide-[var(--color-border-light)]">
              {invoices.map(invoice => (
                <div key={invoice._id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[var(--color-text)]">{invoice.invoiceNumber || 'Invoice'}</p>
                    <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{dateLabel(invoice.date)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold tabular-nums text-[var(--color-text)]">{money(invoice.grandTotal, fmt)}</p>
                    <Badge variant={invoice.paymentStatus === 'paid' ? 'success' : invoice.paymentStatus === 'partial' ? 'warning' : 'danger'}>
                      {invoice.paymentStatus || 'Unknown'}
                    </Badge>
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

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [page, setPage] = useState(1);
  const [hasCredit, setHasCredit] = useState(false);
  useEffect(() => setPage(1), [debouncedSearch, hasCredit]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const { fmt } = useSettingsStore();
  const { isAdmin, isManager } = useRole();
  const canDelete = isAdmin || isManager;
  const queryClient = useQueryClient();

  const { data: customerResponse, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['customers', { page, search: debouncedSearch, hasCredit }],
    queryFn: async () => {
      const params = { page, limit: 25 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (hasCredit) params.hasCredit = 'true';
      const response = await api.get('/customers', { params });
      return response.data;
    },
    placeholderData: previousData => previousData,
    staleTime: 30000
  });

  const customers = Array.isArray(customerResponse?.data) ? customerResponse.data : [];
  const filtered = customers;
  const total = Number(customerResponse?.total) || customers.length;
  const totalPages = Math.max(1, Number(customerResponse?.totalPages) || 1);
  const summary = customerResponse?.summary || summarizeCustomers(customers);

  const saveMutation = useMutation({
    mutationFn: ({ id, values }) => id
      ? api.put('/customers/' + id, values)
      : api.post('/customers', values),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      if (variables.id) {
        await queryClient.invalidateQueries({ queryKey: ['customer-detail', variables.id] });
      }
      toast.success(variables.id ? 'Customer details updated.' : 'Customer added.');
      setFormOpen(false);
      setEditing(null);
    },
    onError: error => toast.error(error?.response?.data?.message || 'Customer could not be saved.')
  });

  const deleteMutation = useMutation({
    mutationFn: id => api.delete('/customers/' + id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer removed from the active customer list.');
      setDeleting(null);
      setSelected(null);
    },
    onError: error => toast.error(error?.response?.data?.message || 'Customer could not be deleted.')
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = customer => {
    setSelected(null);
    setEditing(customer);
    setFormOpen(true);
  };
  const closeForm = () => {
    if (saveMutation.isPending) return;
    setFormOpen(false);
    setEditing(null);
  };

  const pageSummary = filtered.length === customers.length
    ? customers.length + ' customers'
    : filtered.length + ' of ' + customers.length + ' customers';

  return (
    <main className="space-y-5 p-4 pb-8 sm:space-y-6 sm:p-6 lg:p-7">
      <PageHeader
        title="Customer management"
        sub="Build customer relationships, track lifetime purchases and monitor outstanding credit"
        action={<Button onClick={openCreate}><Plus size={16} /> Add customer</Button>}
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Customer overview">
        <Metric label="Customers" value={summary.count.toLocaleString('en-IN')} detail="Active customer records" Icon={Users} tone="gold" />
        <Metric label="Lifetime purchases" value={money(summary.totalPurchases, fmt)} detail="Across all loaded customers" Icon={Wallet} tone="green" />
        <Metric label="Outstanding credit" value={money(summary.outstandingCredit, fmt)} detail={summary.withCredit + ' customers with a balance'} Icon={CreditCard} tone="red" />
        <Metric label="Contact coverage" value={summary.count ? Math.round((summary.withPhone / summary.count) * 100) + '%' : '—'} detail={summary.withPhone + ' customers with phone numbers'} Icon={Phone} tone="slate" />
      </section>

      {summary.withCredit > 0 && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-[#ead8ad] bg-[#fbf8f1] p-3.5">
          <ShieldAlert size={17} className="mt-0.5 shrink-0 text-[#80622e]" />
          <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
            Outstanding balances are shown from customer records. Repayment posting is not enabled in this screen because the current backend endpoint adjusts the balance without creating a payment ledger or cashbook entry.
          </p>
        </div>
      )}

      <section className="space-y-3" aria-label="Customer filters">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden="true" />
          <label className="sr-only" htmlFor="customer-search">Search customers</label>
          <input
            id="customer-search"
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search name, phone, email or address…"
            className={inputClass + ' min-h-12 pl-10 pr-10'}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear customer search"
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-white p-1" role="group" aria-label="Filter customers by credit">
            <button
              type="button"
              aria-pressed={!hasCredit}
              onClick={() => setHasCredit(false)}
              className={'min-h-9 rounded-lg px-3 text-xs font-semibold transition ' + (!hasCredit ? 'bg-[#171717] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]')}
            >
              All customers
            </button>
            <button
              type="button"
              aria-pressed={hasCredit}
              onClick={() => setHasCredit(true)}
              className={'min-h-9 rounded-lg px-3 text-xs font-semibold transition ' + (hasCredit ? 'bg-[#171717] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]')}
            >
              Outstanding credit
            </button>
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
                <p className="text-sm font-semibold text-[var(--color-text)]">Customers could not be loaded</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{error?.response?.data?.message || error?.message || 'Check your connection and try again.'}</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => refetch()} loading={isFetching}>Try again</Button>
          </CardBody>
        </Card>
      )}

      {isLoading && !isError ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading customers">
          {[0, 1, 2, 3, 4, 5].map(index => (
            <div key={index} className="h-44 animate-pulse rounded-2xl border border-[var(--color-border)] bg-white" />
          ))}
        </div>
      ) : !isError && filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white px-5 py-14 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4eee3] text-[#80622e]">
            <Users size={22} />
          </span>
          <h2 className="mt-3 text-sm font-semibold text-[var(--color-text)]">
            {customers.length ? 'No matching customers' : 'Your customer list is ready'}
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[var(--color-text-muted)]">
            {customers.length
              ? 'Try another search or clear the outstanding-credit filter.'
              : 'Add your first customer to make checkout and customer records easier to manage.'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {(search || hasCredit) && (
              <Button variant="secondary" size="sm" onClick={() => { setSearch(''); setHasCredit(false); }}>
                Clear filters
              </Button>
            )}
            {!customers.length && <Button size="sm" onClick={openCreate}><Plus size={15} /> Add customer</Button>}
          </div>
        </div>
      ) : !isError && (
        <section className="space-y-3" aria-label="Customer results">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Customer directory</h2>
            <span className="text-xs text-[var(--color-text-muted)]">Updated from your live customer records</span>
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white lg:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[var(--color-bg-secondary)] text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Customer</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Phone</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Joined</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Purchases</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Credit</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-light)]">
                  {filtered.map(customer => (
                    <tr key={customer._id} className="transition hover:bg-[var(--color-bg-secondary)]/60">
                      <td className="px-4 py-3"><CustomerIdentity customer={customer} /></td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{customer.phone || '—'}</td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{dateLabel(customer.createdAt)}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-[var(--color-text)]">{money(customer.totalPurchases, fmt)}</td>
                      <td className="px-4 py-3"><CreditBadge balance={customer.creditBalance} fmt={fmt} /></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <CustomerActions customer={customer} canManage={canDelete} onView={setSelected} onEdit={openEdit} onDelete={setDeleting} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            {filtered.map(customer => (
              <CustomerMobileCard
                key={customer._id}
                customer={customer}
                fmt={fmt}
                canManage={canDelete}
                onView={setSelected}
                onEdit={openEdit}
                onDelete={setDeleting}
              />
            ))}
          </div>
        </section>
      )}

      <PaginationBar page={page} total={total} totalPages={totalPages} onPageChange={setPage} />

      <Sheet
        open={formOpen}
        title={editing ? 'Edit customer' : 'Add customer'}
        subtitle={editing ? 'Update customer contact and account details' : 'Create a customer record for your store'}
        onClose={closeForm}
        maxH="94dvh"
      >
        <CustomerForm
          key={editing?._id || 'new-customer'}
          customer={editing}
          saving={saveMutation.isPending}
          onClose={closeForm}
          onSave={values => saveMutation.mutate({ id: editing?._id, values })}
        />
      </Sheet>

      <Sheet
        open={Boolean(selected)}
        title={selected?.name || 'Customer details'}
        subtitle="Customer account and recent purchase history"
        onClose={() => setSelected(null)}
        maxH="94dvh"
      >
        {selected && (
          <CustomerDetails customerId={selected._id} fmt={fmt} onEdit={openEdit} />
        )}
      </Sheet>

      <Sheet
        open={Boolean(deleting)}
        title="Delete customer?"
        subtitle="This removes the customer from the active directory"
        onClose={() => deleteMutation.isPending ? null : setDeleting(null)}
        maxH="auto"
      >
        {deleting && (
          <div className="space-y-4 p-5">
            <div className="rounded-xl border border-[#f0d6d2] bg-[#fff7f5] p-3">
              <p className="text-sm font-semibold text-[var(--color-text)]">{deleting.name}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                This customer will be soft-deleted and hidden from the active directory. Existing invoices are retained.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setDeleting(null)} disabled={deleteMutation.isPending}>Cancel</Button>
              <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleting._id)}>
                <Trash2 size={15} /> Delete customer
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </main>
  );
}
