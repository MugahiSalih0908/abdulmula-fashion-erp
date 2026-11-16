import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  RefreshCw,
  Search,
  X
} from 'lucide-react';
import api from '../services/api';
import useSettingsStore from '../store/settingsStore';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import CardBody from '../components/ui/CardBody';
import Badge from '../components/ui/Badge';
import Sheet from '../components/ui/Sheet';
import ReceiptModal from '../components/pos/ReceiptModal';

const PAGE_SIZE = 25;

const PAYMENT_METHODS = ['Cash', 'Credit', 'Mobile Transfer', 'Mixed'];
const PAYMENT_STATUSES = ['paid', 'partial', 'unpaid'];

const STATUS_META = {
  paid: { label: 'Paid', variant: 'success' },
  partial: { label: 'Partially paid', variant: 'warning' },
  unpaid: { label: 'Unpaid', variant: 'danger' }
};

const inputClass =
  'input min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)]';

function formatDate(value, includeTime = true) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' });
}

function formatMoney(value, fmt) {
  const amount = Number(value);
  return fmt(Number.isFinite(amount) ? amount : 0);
}

function getItemCount(invoice) {
  return (invoice.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

function PaymentStatus({ status }) {
  const meta = STATUS_META[status] || { label: status || 'Unknown', variant: 'info' };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function InvoiceSummary({ invoice, fmt, onView }) {
  const customerName = invoice.customerName || invoice.customer?.name || 'Walk-in customer';
  return (
    <Card className="transition hover:border-[var(--color-gold-light)] hover:shadow-sm">
      <CardBody className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--color-text)]">
              {invoice.invoiceNumber || 'Invoice'}
            </p>
            <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">{customerName}</p>
          </div>
          <PaymentStatus status={invoice.paymentStatus} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-[var(--color-text-muted)]">Date</p>
            <p className="mt-1 font-medium text-[var(--color-text)]">{formatDate(invoice.date, false)}</p>
          </div>
          <div>
            <p className="text-[var(--color-text-muted)]">Items</p>
            <p className="mt-1 font-medium text-[var(--color-text)]">
              {getItemCount(invoice)} unit(s)
            </p>
          </div>
          <div>
            <p className="text-[var(--color-text-muted)]">Payment</p>
            <p className="mt-1 font-medium text-[var(--color-text)]">{invoice.paymentMethod || '—'}</p>
          </div>
          <div>
            <p className="text-[var(--color-text-muted)]">Total</p>
            <p className="mt-1 font-semibold tabular-nums text-[var(--color-text)]">
              {formatMoney(invoice.grandTotal, fmt)}
            </p>
          </div>
        </div>
        <div className="flex justify-end border-t border-[var(--color-border-light)] pt-2">
          <Button variant="secondary" size="sm" onClick={() => onView(invoice)}>
            <Eye size={15} /> View invoice
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export default function InvoicesPage() {
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [receiptInvoice, setReceiptInvoice] = useState(null);
  const fmt = useSettingsStore(state => state.fmt);

  const dateRangeInvalid = Boolean(startDate && endDate && startDate > endDate);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['invoices', { page, startDate, endDate, paymentMethod, paymentStatus }],
    enabled: !dateRangeInvalid,
    queryFn: async () => {
      const params = { page, limit: PAGE_SIZE };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (paymentMethod !== 'all') params.paymentMethod = paymentMethod;
      if (paymentStatus !== 'all') params.paymentStatus = paymentStatus;
      const response = await api.get('/invoices', { params });
      return response.data;
    }
  });

  const invoices = Array.isArray(data?.data) ? data.data : [];
  const total = Number(data?.total) || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totalRevenue = Number(data?.totalRevenue) || 0;

  const visibleInvoices = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return invoices;
    return invoices.filter(invoice => [
      invoice.invoiceNumber,
      invoice.customerName,
      invoice.customer?.name,
      invoice.soldByName,
      invoice.paymentMethod
    ].filter(Boolean).join(' ').toLocaleLowerCase().includes(query));
  }, [invoices, search]);

  const updateFilter = setter => value => {
    setter(value);
    setPage(1);
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setPaymentMethod('all');
    setPaymentStatus('all');
    setSearch('');
    setPage(1);
  };

  const openInvoice = invoice => setSelectedInvoiceId(invoice._id);

  return (
    <main className="space-y-5 p-4 pb-8 sm:space-y-6 sm:p-6 lg:p-7">
      <PageHeader
        title="Invoice history"
        sub="Review completed sales, payment status and printable receipts"
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Invoice summary">
        <Card>
          <CardBody className="p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Invoices
            </p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[var(--color-text)]">
              {total.toLocaleString('en-IN')}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Matching the selected date and payment filters
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Revenue
            </p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[var(--color-text)]">
              {formatMoney(totalRevenue, fmt)}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Total for the selected server-side filters
            </p>
          </CardBody>
        </Card>
      </section>

      <Card>
        <CardBody className="space-y-4 p-4">
          <div className="flex items-center gap-2">
            <Filter size={17} className="text-[var(--color-text-muted)]" />
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Filter invoices</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="min-w-0 space-y-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">From date</span>
              <span className="relative block">
                <CalendarDays size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  type="date"
                  value={startDate}
                  onChange={event => updateFilter(setStartDate)(event.target.value)}
                  className={`${inputClass} pl-10`}
                  aria-label="Filter invoices from date"
                />
              </span>
            </label>
            <label className="min-w-0 space-y-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">To date</span>
              <span className="relative block">
                <CalendarDays size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  type="date"
                  value={endDate}
                  onChange={event => updateFilter(setEndDate)(event.target.value)}
                  className={`${inputClass} pl-10`}
                  aria-label="Filter invoices to date"
                />
              </span>
            </label>
            <label className="min-w-0 space-y-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Payment method</span>
              <select
                value={paymentMethod}
                onChange={event => updateFilter(setPaymentMethod)(event.target.value)}
                className={inputClass}
              >
                <option value="all">All methods</option>
                {PAYMENT_METHODS.map(method => <option key={method} value={method}>{method}</option>)}
              </select>
            </label>
            <label className="min-w-0 space-y-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Payment status</span>
              <select
                value={paymentStatus}
                onChange={event => updateFilter(setPaymentStatus)(event.target.value)}
                className={inputClass}
              >
                <option value="all">All statuses</option>
                {PAYMENT_STATUSES.map(status => (
                  <option key={status} value={status}>{STATUS_META[status].label}</option>
                ))}
              </select>
            </label>
          </div>

          {dateRangeInvalid && (
            <p className="flex items-center gap-2 text-xs font-medium text-[var(--color-danger)]" role="alert">
              <AlertCircle size={15} /> The start date must be before the end date.
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block min-w-0 flex-1 sm:max-w-md">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Find in the loaded page by invoice or customer…"
                aria-label="Search invoices on the loaded page"
                className={`${inputClass} pl-10 pr-10`}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear invoice search"
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
                >
                  <X size={15} />
                </button>
              )}
            </label>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
              <Button variant="secondary" size="sm" onClick={() => refetch()} loading={isFetching} disabled={dateRangeInvalid}>
                <RefreshCw size={14} /> Refresh
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            The search field filters the currently loaded page. Date and payment filters apply to the full invoice history.
          </p>
        </CardBody>
      </Card>

      {isError && (
        <Card role="alert">
          <CardBody className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-[var(--color-danger)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">Invoices could not be loaded</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {error?.response?.data?.message || error?.message || 'Check your connection and try again.'}
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => refetch()} loading={isFetching}>
              <RefreshCw size={14} /> Try again
            </Button>
          </CardBody>
        </Card>
      )}

      {isLoading && !isError ? (
        <div className="space-y-3" aria-label="Loading invoices">
          {[0, 1, 2, 3, 4].map(index => (
            <div key={index} className="h-20 animate-pulse rounded-2xl border border-[var(--color-border)] bg-white" />
          ))}
        </div>
      ) : !isError && !dateRangeInvalid && (
        <section className="space-y-3" aria-label="Invoice results">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Sales invoices</h2>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {total === 0 ? 'No invoices found' : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total.toLocaleString('en-IN')}`}
                {isFetching && <span className="ml-2">Updating…</span>}
              </p>
            </div>
            <Badge variant="info">Page {page} of {totalPages}</Badge>
          </div>

          {visibleInvoices.length === 0 ? (
            <Card>
              <CardBody className="px-5 py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-bg-secondary)] text-[#8a6a37]">
                  <Search size={21} />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-[var(--color-text)]">
                  {invoices.length ? 'No invoices match this search' : 'No invoices for these filters'}
                </h3>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {invoices.length ? 'Try a different invoice number or customer name.' : 'Change the date or payment filters to see more results.'}
                </p>
                {search && (
                  <Button variant="secondary" size="sm" className="mt-4" onClick={() => setSearch('')}>
                    Clear search
                  </Button>
                )}
              </CardBody>
            </Card>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white lg:block">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="bg-[var(--color-bg-secondary)] text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Invoice</th>
                        <th className="px-4 py-3 font-semibold">Customer</th>
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">Items</th>
                        <th className="px-4 py-3 font-semibold">Payment</th>
                        <th className="px-4 py-3 text-right font-semibold">Total</th>
                        <th className="px-4 py-3 text-right font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-light)]">
                      {visibleInvoices.map(invoice => (
                        <tr key={invoice._id} className="transition hover:bg-[var(--color-bg-secondary)]/60">
                          <td className="px-4 py-3 font-semibold text-[var(--color-text)]">{invoice.invoiceNumber || '—'}</td>
                          <td className="px-4 py-3 text-[var(--color-text-secondary)]">{invoice.customerName || invoice.customer?.name || 'Walk-in customer'}</td>
                          <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{formatDate(invoice.date, false)}</td>
                          <td className="px-4 py-3 tabular-nums text-[var(--color-text-secondary)]">{getItemCount(invoice)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs text-[var(--color-text-secondary)]">{invoice.paymentMethod || '—'}</span>
                              <PaymentStatus status={invoice.paymentStatus} />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-[var(--color-text)]">
                            {formatMoney(invoice.grandTotal, fmt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="ghost" size="sm" onClick={() => openInvoice(invoice)}>
                              <Eye size={15} /> View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
                {visibleInvoices.map(invoice => (
                  <InvoiceSummary key={invoice._id} invoice={invoice} fmt={fmt} onView={openInvoice} />
                ))}
              </div>
            </>
          )}

          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage(value => Math.max(1, value - 1))}
            >
              <ChevronLeft size={15} /> Previous
            </Button>
            <span className="text-xs font-medium tabular-nums text-[var(--color-text-muted)]">
              {page} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages || isFetching}
              onClick={() => setPage(value => Math.min(totalPages, value + 1))}
            >
              Next <ChevronRight size={15} />
            </Button>
          </div>
        </section>
      )}

      <Sheet
        open={Boolean(selectedInvoiceId)}
        title="Invoice details"
        subtitle="Review line items, payment and customer information"
        onClose={() => setSelectedInvoiceId(null)}
        maxH="94dvh"
      >
        {selectedInvoiceId && (
          <InvoiceDetails
            invoiceId={selectedInvoiceId}
            fmt={fmt}
            onPrint={invoice => setReceiptInvoice({
              ...invoice,
              customerName: invoice.customerName || invoice.customer?.name,
              customerPhone: invoice.customer?.phone || ''
            })}
          />
        )}
      </Sheet>

      {receiptInvoice && (
        <ReceiptModal
          invoice={receiptInvoice}
          cashReceived={0}
          changeAmount={0}
          onClose={() => setReceiptInvoice(null)}
        />
      )}
    </main>
  );
}

function InvoiceDetails({ invoiceId, fmt, onPrint }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['invoice-detail', invoiceId],
    queryFn: async () => {
      const response = await api.get(`/invoices/${invoiceId}`);
      return response.data.data;
    },
    enabled: Boolean(invoiceId)
  });

  if (isLoading) {
    return <div className="space-y-3 p-5">{[0, 1, 2].map(index => <div key={index} className="h-16 animate-pulse rounded-xl bg-[var(--color-bg-secondary)]" />)}</div>;
  }

  if (isError || !data) {
    return (
      <div className="space-y-3 p-5">
        <p className="text-sm text-[var(--color-danger)]">
          {error?.response?.data?.message || error?.message || 'Invoice details could not be loaded.'}
        </p>
        <Button variant="secondary" size="sm" onClick={() => refetch()} loading={isFetching}>
          <RefreshCw size={14} /> Try again
        </Button>
      </div>
    );
  }

  const customerName = data.customerName || data.customer?.name || 'Walk-in customer';
  const soldBy = data.soldByName || data.soldBy?.name || '—';

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <Card>
        <CardBody className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Invoice number</p>
              <p className="mt-1 text-base font-bold text-[var(--color-text)]">{data.invoiceNumber || '—'}</p>
            </div>
            <PaymentStatus status={data.paymentStatus} />
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-[var(--color-border-light)] pt-3 sm:grid-cols-3">
            <div>
              <p className="text-[11px] text-[var(--color-text-muted)]">Invoice total</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">{formatMoney(data.grandTotal, fmt)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--color-text-muted)]">Amount paid</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">{formatMoney(data.amountPaid, fmt)}</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[11px] text-[var(--color-text-muted)]">Balance due</p>
              <p className={`mt-1 text-sm font-semibold tabular-nums ${Number(data.balanceDue) > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>
                {formatMoney(data.balanceDue, fmt)}
              </p>
            </div>
          </div>
          <Button className="w-full" onClick={() => onPrint(data)}>
            <Eye size={15} /> Open printable receipt
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3 p-4">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Sale information</h3>
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div><p className="text-xs text-[var(--color-text-muted)]">Customer</p><p className="mt-1 font-medium">{customerName}</p></div>
            <div><p className="text-xs text-[var(--color-text-muted)]">Cashier</p><p className="mt-1 font-medium">{soldBy}</p></div>
            <div><p className="text-xs text-[var(--color-text-muted)]">Date</p><p className="mt-1 font-medium">{formatDate(data.date)}</p></div>
            <div><p className="text-xs text-[var(--color-text-muted)]">Payment method</p><p className="mt-1 font-medium">{data.paymentMethod || '—'}</p></div>
          </div>
          {data.note && <p className="rounded-xl bg-[var(--color-bg-secondary)] p-3 text-xs text-[var(--color-text-secondary)]">{data.note}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Items sold</h3>
            <Badge>{getItemCount(data)} unit(s)</Badge>
          </div>
          <div className="divide-y divide-[var(--color-border-light)]">
            {(data.items || []).map((item, index) => (
              <div key={`${item.product || item.productName}-${index}`} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)]">{item.productName}</p>
                  {item.sku && <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">SKU: {item.sku}</p>}
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {item.quantity} × {formatMoney(item.unitPrice, fmt)}
                    {Number(item.discount) > 0 && ` · Discount ${formatMoney(item.discount, fmt)}`}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-[var(--color-text)]">
                  {formatMoney(item.lineTotal, fmt)}
                </p>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-[var(--color-border-light)] pt-3 text-sm">
            <div className="flex justify-between gap-3"><span className="text-[var(--color-text-muted)]">Subtotal</span><span className="tabular-nums">{formatMoney(data.subtotal, fmt)}</span></div>
            {Number(data.discountTotal) > 0 && <div className="flex justify-between gap-3"><span className="text-[var(--color-text-muted)]">Discount</span><span className="tabular-nums">−{formatMoney(data.discountTotal, fmt)}</span></div>}
            {Number(data.taxAmount) > 0 && <div className="flex justify-between gap-3"><span className="text-[var(--color-text-muted)]">Tax ({data.taxRate || 0}%)</span><span className="tabular-nums">{formatMoney(data.taxAmount, fmt)}</span></div>}
            <div className="flex justify-between gap-3 border-t border-[var(--color-border-light)] pt-2 font-bold">
              <span>Total</span><span className="tabular-nums">{formatMoney(data.grandTotal, fmt)}</span>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
