import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Eye,
  FileText,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Truck,
  Wallet,
  X
} from 'lucide-react';
import api from '../services/api';
import useSettingsStore from '../store/settingsStore';
import { useRole } from '../hooks/useRole';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import CardBody from '../components/ui/CardBody';
import Badge from '../components/ui/Badge';
import Sheet from '../components/ui/Sheet';
import {
  calculateOrderPreview,
  filterPurchaseOrders,
  isValidPurchaseOrderPayload,
  isValidSupplierPaymentPayload,
  normalizePurchaseOrderPayload,
  normalizeSupplierPaymentPayload,
  summarizePurchaseOrders
} from './purchaseOrderManagement.mjs';

const PAGE_SIZE = 50;
const inputClass = 'input min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-gold)] focus:outline-none focus:ring-2 focus:ring-[rgba(197,164,109,0.2)]';

const STATUS_META = {
  draft: { label: 'Draft', variant: 'info' },
  ordered: { label: 'Ordered', variant: 'warning' },
  received: { label: 'Received', variant: 'success' },
  partial: { label: 'Partially paid', variant: 'warning' },
  paid: { label: 'Paid', variant: 'success' }
};

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Mobile Transfer', 'Other'];

function money(value, fmt) {
  const amount = Number(value);
  return fmt(Number.isFinite(amount) ? amount : 0);
}

function dateLabel(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' });
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status || 'Unknown', variant: 'info' };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function Metric({ label, value, detail, Icon, tone = 'gold' }) {
  const tones = {
    gold: 'bg-[#f4eee3] text-[#80622e]',
    green: 'bg-[#eaf3ed] text-[#216442]',
    orange: 'bg-[#fbf1e3] text-[#8c5a19]',
    red: 'bg-[#f8ecea] text-[#963b3b]'
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

function PurchaseOrderForm({ order, onSave, onClose, saving }) {
  const [supplierError, setSupplierError] = useState('');
  const [productError, setProductError] = useState('');

  const suppliersQuery = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const response = await api.get('/suppliers');
      return Array.isArray(response.data?.data) ? response.data.data : [];
    }
  });

  const productsQuery = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => {
      const response = await api.get('/products?limit=500');
      return Array.isArray(response.data?.data) ? response.data.data.filter(product => !product.isDeleted) : [];
    }
  });

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm({
    defaultValues: {
      supplierId: String(order?.supplier?._id || order?.supplier || ''),
      items: order?.items?.length
        ? order.items.map(item => ({
            productId: String(item.product?._id || item.product || ''),
            quantity: Number(item.quantity) || 1,
            unitCost: Number(item.unitCost) || 0
          }))
        : [{ productId: '', quantity: 1, unitCost: '' }],
      discount: Number(order?.discount) || 0,
      note: order?.note || ''
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items') || [];
  const discount = watch('discount');
  const preview = useMemo(() => calculateOrderPreview(watchedItems, discount), [watchedItems, discount]);
  const isBusy = saving || suppliersQuery.isLoading || productsQuery.isLoading;

  const submit = values => {
    const payload = normalizePurchaseOrderPayload(values);
    if (!isValidPurchaseOrderPayload(payload)) {
      toast.error('Check supplier, item quantities, unit costs and discount.');
      return;
    }
    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4 p-4 sm:p-5" noValidate>
      {(suppliersQuery.isError || productsQuery.isError) && (
        <div className="rounded-xl border border-red-200 bg-[#fff7f5] p-3 text-xs text-[var(--color-danger)]" role="alert">
          Supplier or product options could not be loaded. Close and retry the form.
          <button type="button" className="ml-2 font-semibold underline" onClick={() => { suppliersQuery.refetch(); productsQuery.refetch(); }}>Retry</button>
        </div>
      )}

      <div className="rounded-xl border border-[var(--color-gold-light)] bg-[#fbf8f1] p-3">
        <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
          New purchase orders start as drafts. Stock is not changed until an ordered purchase is received and confirmed.
        </p>
      </div>

      <div>
        <label htmlFor="po-supplier" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">
          Supplier <span className="text-[var(--color-danger)]">*</span>
        </label>
        <select id="po-supplier" className={inputClass} aria-invalid={Boolean(errors.supplierId)} {...register('supplierId', { required: 'Choose a supplier.' })}>
          <option value="">Select supplier</option>
          {(suppliersQuery.data || []).map(supplier => <option key={supplier._id} value={supplier._id}>{supplier.name}</option>)}
        </select>
        {errors.supplierId && <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">{errors.supplierId.message}</p>}
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Order items</h3>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Enter the quantity and agreed unit cost</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => append({ productId: '', quantity: 1, unitCost: '' })}>
            <Plus size={14} /> Add line
          </Button>
        </div>

        {fields.map((field, index) => (
          <Card key={field.id}>
            <CardBody className="space-y-3 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Item {index + 1}</span>
                {fields.length > 1 && (
                  <button type="button" aria-label={'Remove item ' + (index + 1)} onClick={() => remove(index)} className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-danger)] hover:bg-[#f8ecea]">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <div>
                <label htmlFor={'po-product-' + index} className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">Product</label>
                <select
                  id={'po-product-' + index}
                  className={inputClass}
                  aria-invalid={Boolean(errors.items?.[index]?.productId)}
                  {...register('items.' + index + '.productId', { required: 'Choose a product.' })}
                >
                  <option value="">Select product</option>
                  {(productsQuery.data || []).map(product => (
                    <option key={product._id} value={product._id}>{product.name}{product.sku ? ' · ' + product.sku : ''}</option>
                  ))}
                </select>
                {errors.items?.[index]?.productId && <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">{errors.items[index].productId.message}</p>}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={'po-qty-' + index} className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">Quantity</label>
                  <input
                    id={'po-qty-' + index}
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    className={inputClass}
                    aria-invalid={Boolean(errors.items?.[index]?.quantity)}
                    {...register('items.' + index + '.quantity', {
                      required: 'Enter the quantity.',
                      valueAsNumber: true,
                      min: { value: 1, message: 'Quantity must be at least 1.' },
                      validate: value => Number.isSafeInteger(value) || 'Quantity must be a whole number.'
                    })}
                  />
                  {errors.items?.[index]?.quantity && <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">{errors.items[index].quantity.message}</p>}
                </div>
                <div>
                  <label htmlFor={'po-cost-' + index} className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">Unit cost (USD)</label>
                  <input
                    id={'po-cost-' + index}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    className={inputClass}
                    aria-invalid={Boolean(errors.items?.[index]?.unitCost)}
                    {...register('items.' + index + '.unitCost', {
                      required: 'Enter the unit cost (use 0 if no cost applies).',
                      valueAsNumber: true,
                      min: { value: 0, message: 'Unit cost cannot be negative.' },
                      validate: value => Number.isFinite(value) || 'Enter a valid unit cost.'
                    })}
                  />
                  {errors.items?.[index]?.unitCost && <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">{errors.items[index].unitCost.message}</p>}
                </div>
              </div>
              <div className="flex justify-end border-t border-[var(--color-border-light)] pt-2 text-xs text-[var(--color-text-muted)]">
                Line total <strong className="ml-2 tabular-nums text-[var(--color-text)]">{money((Number(watchedItems[index]?.quantity) || 0) * (Number(watchedItems[index]?.unitCost) || 0), amount => fmt(amount))}</strong>
              </div>
            </CardBody>
          </Card>
        ))}
        {productError && <p role="alert" className="text-xs text-[var(--color-danger)]">{productError}</p>}
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="po-discount" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">Discount (USD)</label>
          <input
            id="po-discount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            className={inputClass}
            {...register('discount', { valueAsNumber: true, min: { value: 0, message: 'Discount cannot be negative.' } })}
          />
          {Number(discount) > preview.subtotal && <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">Discount cannot exceed the subtotal.</p>}
        </div>
        <div>
          <label htmlFor="po-note" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">Order note</label>
          <input id="po-note" maxLength={400} className={inputClass} placeholder="Optional delivery or reference note" {...register('note')} />
        </div>
      </div>

      <Card>
        <CardBody className="space-y-2 p-4">
          <div className="flex justify-between gap-3 text-sm"><span className="text-[var(--color-text-muted)]">Subtotal</span><span className="font-medium tabular-nums">{fmt(preview.subtotal)}</span></div>
          <div className="flex justify-between gap-3 text-sm"><span className="text-[var(--color-text-muted)]">Discount</span><span className="font-medium tabular-nums">−{fmt(preview.discount)}</span></div>
          <div className="flex justify-between gap-3 border-t border-[var(--color-border-light)] pt-2 text-base font-bold"><span>Total</span><span className="tabular-nums">{fmt(preview.grandTotal)}</span></div>
        </CardBody>
      </Card>

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-border-light)] pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
        <Button type="submit" loading={isBusy} disabled={isBusy || suppliersQuery.isError || productsQuery.isError} className="w-full sm:w-auto">
          <FileText size={15} /> {order ? 'Save draft changes' : 'Create draft order'}
        </Button>
      </div>
    </form>
  );
}

function SupplierPaymentForm({ order, onSave, onClose, saving, fmt }) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      amount: Number(order?.balanceDue || 0).toFixed(2),
      paymentMethod: 'Cash',
      date: new Date().toISOString().slice(0, 10),
      reference: '',
      note: ''
    }
  });
  const amount = watch('amount');

  return (
    <form onSubmit={handleSubmit(values => {
      const payload = normalizeSupplierPaymentPayload(values);
      if (!isValidSupplierPaymentPayload(payload, order.balanceDue)) {
        toast.error('Check the payment amount, method, date and reference.');
        return;
      }
      onSave(payload);
    })} className="space-y-4 p-4 sm:p-5" noValidate>
      <Card>
        <CardBody className="space-y-2 p-3">
          <div className="flex justify-between gap-3 text-sm"><span className="text-[var(--color-text-muted)]">Outstanding balance</span><strong className="tabular-nums">{fmt(order.balanceDue)}</strong></div>
          <div className="flex justify-between gap-3 text-sm"><span className="text-[var(--color-text-muted)]">Remaining after payment</span><strong className="tabular-nums">{fmt(Math.max(0, Number(order.balanceDue) - (Number(amount) || 0)))}</strong></div>
        </CardBody>
      </Card>

      <div>
        <label htmlFor="po-payment-amount" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">Payment amount (USD)</label>
        <input id="po-payment-amount" type="number" inputMode="decimal" min="0.01" max={order.balanceDue} step="0.01" className={inputClass} aria-invalid={Boolean(errors.amount)} {...register('amount', {
          required: 'Enter a payment amount.',
          valueAsNumber: true,
          min: { value: 0.01, message: 'Payment must be greater than zero.' },
          max: { value: Number(order.balanceDue), message: 'Payment cannot exceed the outstanding balance.' },
          validate: value => Number.isFinite(value) || 'Enter a valid payment amount.'
        })} />
        {errors.amount && <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">{errors.amount.message}</p>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="po-payment-method" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">Payment method</label>
          <select id="po-payment-method" className={inputClass} {...register('paymentMethod', { required: true })}>
            {PAYMENT_METHODS.map(method => <option key={method} value={method}>{method}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="po-payment-date" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">Payment date</label>
          <input id="po-payment-date" type="date" className={inputClass} {...register('date', { required: 'Select the payment date.' })} />
          {errors.date && <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">{errors.date.message}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="po-payment-reference" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">Reference</label>
        <input id="po-payment-reference" maxLength={100} className={inputClass} placeholder="Receipt or transfer reference" {...register('reference')} />
      </div>

      <div>
        <label htmlFor="po-payment-note" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">Internal note</label>
        <textarea id="po-payment-note" rows={2} maxLength={300} className={inputClass + ' min-h-20 resize-y'} placeholder="Optional payment note" {...register('note')} />
      </div>

      <div className="rounded-xl border border-[#ead8ad] bg-[#fbf8f1] p-3">
        <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
          Payments are saved to this purchase order and reduce the supplier account balance. Cash payments are also included in cashbook expected cash.
        </p>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-border-light)] pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
        <Button type="submit" loading={saving} className="w-full sm:w-auto"><Banknote size={15} /> Record payment</Button>
      </div>
    </form>
  );
}

function PurchaseOrderDetails({ orderId, fmt }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['purchase-order-detail', orderId],
    queryFn: async () => {
      const response = await api.get('/purchase-orders/' + orderId);
      return response.data.data;
    },
    enabled: Boolean(orderId)
  });

  if (isLoading) {
    return <div className="space-y-3 p-5" aria-label="Loading purchase order"><div className="h-24 animate-pulse rounded-2xl bg-[var(--color-bg-secondary)]" /><div className="h-40 animate-pulse rounded-2xl bg-[var(--color-bg-secondary)]" /></div>;
  }

  if (isError || !data) {
    return (
      <div className="space-y-3 p-5" role="alert">
        <p className="text-sm text-[var(--color-danger)]">{error?.response?.data?.message || error?.message || 'Purchase order details could not be loaded.'}</p>
        <Button variant="secondary" size="sm" loading={isFetching} onClick={() => refetch()}><RefreshCw size={14} /> Try again</Button>
      </div>
    );
  }

  const payments = Array.isArray(data.payments) ? data.payments : [];
  const supplierName = data.supplier?.name || data.supplierName || 'Supplier';

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <Card>
        <CardBody className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Purchase order</p>
              <h3 className="mt-1 text-base font-bold text-[var(--color-text)]">{data.poNumber}</h3>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{supplierName}</p>
            </div>
            <StatusBadge status={data.status} />
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-[var(--color-border-light)] pt-3 sm:grid-cols-3">
            <div><p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Order total</p><p className="mt-1 text-base font-semibold tabular-nums">{fmt(data.grandTotal)}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Paid</p><p className="mt-1 text-base font-semibold tabular-nums text-[var(--color-success)]">{fmt(data.amountPaid)}</p></div>
            <div className="col-span-2 sm:col-span-1"><p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Balance due</p><p className="mt-1 text-base font-semibold tabular-nums text-[var(--color-danger)]">{fmt(data.balanceDue)}</p></div>
          </div>
          <div className="grid grid-cols-1 gap-2 text-xs text-[var(--color-text-secondary)] sm:grid-cols-2">
            <p>Created {dateLabel(data.createdAt, true)}</p>
            {data.receivedAt && <p>Received {dateLabel(data.receivedAt, true)}</p>}
          </div>
          {data.note && <p className="rounded-xl bg-[var(--color-bg-secondary)] p-3 text-xs leading-5 text-[var(--color-text-secondary)]">{data.note}</p>}
        </CardBody>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Items ordered</h3>
          <Badge>{(data.items || []).length} line(s)</Badge>
        </div>
        <Card>
          <CardBody className="divide-y divide-[var(--color-border-light)] p-0">
            {(data.items || []).map((item, index) => (
              <div key={item.product || index} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)]">{item.productName}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">{item.quantity} × {fmt(item.unitCost)}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-[var(--color-text)]">{fmt(item.lineTotal)}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Payment history</h3>
          <Badge>{payments.length} payment(s)</Badge>
        </div>
        {payments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-8 text-center">
            <CreditCard size={22} className="mx-auto text-[var(--color-text-muted)]" />
            <p className="mt-2 text-sm font-medium text-[var(--color-text)]">No payments recorded</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">Payments will appear here after the order is received.</p>
          </div>
        ) : (
          <Card>
            <CardBody className="divide-y divide-[var(--color-border-light)] p-0">
              {payments.map(payment => (
                <div key={payment._id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text)]">{payment.paymentMethod}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">{dateLabel(payment.date)}{payment.reference ? ' · ' + payment.reference : ''}</p>
                    {payment.note && <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{payment.note}</p>}
                    {payment.recordedBy?.name && <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">Recorded by {payment.recordedBy.name}</p>}
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-[var(--color-success)]">{fmt(payment.amount)}</p>
                </div>
              ))}
            </CardBody>
          </Card>
        )}
      </section>
    </div>
  );
}

function PurchaseOrderCard({ order, fmt, isAdmin, onView, onEdit, onDelete, onPlace, onReceive, onPay, pending }) {
  const supplierName = order.supplier?.name || order.supplierName || 'Supplier';
  const lineCount = (order.items || []).length;
  return (
    <motion.article layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="h-full transition hover:border-[var(--color-gold-light)] hover:shadow-sm">
        <CardBody className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--color-text)]">{order.poNumber}</p>
              <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">{supplierName}</p>
              <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{dateLabel(order.createdAt)} · {lineCount} line(s)</p>
            </div>
            <StatusBadge status={order.status} />
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-[var(--color-border-light)] pt-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Order total</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--color-text)]">{money(order.grandTotal, fmt)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Balance due</p>
              <p className={'mt-1 text-lg font-semibold tabular-nums ' + (Number(order.balanceDue) > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]')}>{money(order.balanceDue, fmt)}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border-light)] pt-3">
            {order.status === 'draft' && (
              <Button size="sm" onClick={() => onPlace(order)}><ArrowUpRight size={14} /> Place order</Button>
            )}
            {order.status === 'ordered' && (
              <Button size="sm" onClick={() => onReceive(order)}><PackageCheck size={14} /> Receive goods</Button>
            )}
            {['received', 'partial'].includes(order.status) && Number(order.balanceDue) > 0 && (
              <Button size="sm" onClick={() => onPay(order)}><Banknote size={14} /> Record payment</Button>
            )}
            {isAdmin && order.status === 'draft' && (
              <>
                <Button size="sm" variant="secondary" onClick={() => onEdit(order)}>Edit draft</Button>
                <button type="button" aria-label={'Delete draft ' + order.poNumber} onClick={() => onDelete(order)} disabled={pending} className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-danger)] hover:bg-[#f8ecea] disabled:opacity-50"><Trash2 size={15} /></button>
              </>
            )}
            <button type="button" onClick={() => onView(order)} aria-label={'View ' + order.poNumber} className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]">
              <Eye size={17} />
            </button>
          </div>
        </CardBody>
      </Card>
    </motion.article>
  );
}

export default function PurchaseOrdersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [formOrder, setFormOrder] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [action, setAction] = useState(null);
  const { fmt } = useSettingsStore();
  const { isAdmin } = useRole();
  const queryClient = useQueryClient();

  const suppliersQuery = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const response = await api.get('/suppliers');
      return Array.isArray(response.data?.data) ? response.data.data : [];
    }
  });

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['purchase-orders', { page, status, supplierFilter }],
    queryFn: async () => {
      const params = { page, limit: PAGE_SIZE };
      if (status !== 'all') params.status = status;
      if (supplierFilter !== 'all') params.supplier = supplierFilter;
      const response = await api.get('/purchase-orders', { params });
      return response.data;
    }
  });

  const orders = Array.isArray(data?.data) ? data.data : [];
  const total = Number(data?.total) || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = useMemo(() => filterPurchaseOrders(orders, search), [orders, search]);
  const summary = useMemo(() => summarizePurchaseOrders(orders), [orders]);

  const invalidatePurchasing = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }),
      queryClient.invalidateQueries({ queryKey: ['purchase-order-detail'] }),
      queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
      queryClient.invalidateQueries({ queryKey: ['suppliers-list'] }),
      queryClient.invalidateQueries({ queryKey: ['products'] }),
      queryClient.invalidateQueries({ queryKey: ['products-list'] }),
      queryClient.invalidateQueries({ queryKey: ['cashbook-today'] }),
      queryClient.invalidateQueries({ queryKey: ['cash-closings'] }),
      queryClient.invalidateQueries({ queryKey: ['cashbook-history'] })
    ]);
  };

  const createMutation = useMutation({
    mutationFn: payload => api.post('/purchase-orders', payload),
    onSuccess: async () => {
      await invalidatePurchasing();
      toast.success('Draft purchase order created.');
      setFormOpen(false);
      setFormOrder(null);
    },
    onError: error => toast.error(error?.response?.data?.message || 'Purchase order could not be created.')
  });

  const editMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put('/purchase-orders/' + id, payload),
    onSuccess: async () => {
      await invalidatePurchasing();
      toast.success('Draft purchase order updated.');
      setFormOpen(false);
      setFormOrder(null);
    },
    onError: error => toast.error(error?.response?.data?.message || 'Purchase order could not be updated.')
  });

  const actionMutation = useMutation({
    mutationFn: ({ type, id }) => {
      if (type === 'order') return api.patch('/purchase-orders/' + id + '/order');
      if (type === 'receive') return api.patch('/purchase-orders/' + id + '/receive');
      return api.delete('/purchase-orders/' + id);
    },
    onSuccess: async response => {
      await invalidatePurchasing();
      toast.success(response.data.message || 'Purchase order updated.');
      setAction(null);
    },
    onError: error => toast.error(error?.response?.data?.message || 'Purchase order action failed.')
  });

  const paymentMutation = useMutation({
    mutationFn: ({ id, payload }) => api.patch('/purchase-orders/' + id + '/pay', payload),
    onSuccess: async response => {
      await invalidatePurchasing();
      toast.success(response.data.message || 'Supplier payment recorded.');
      setPaymentOrder(null);
    },
    onError: error => toast.error(error?.response?.data?.message || 'Supplier payment could not be recorded.')
  });

  const clearFilters = () => {
    setSearch('');
    setStatus('all');
    setSupplierFilter('all');
    setPage(1);
  };

  const openCreate = () => {
    setFormOrder(null);
    setFormOpen(true);
  };

  const openEdit = order => {
    setFormOrder(order);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (createMutation.isPending || editMutation.isPending) return;
    setFormOpen(false);
    setFormOrder(null);
  };

  const submitOrderForm = payload => {
    if (formOrder?._id) editMutation.mutate({ id: formOrder._id, payload });
    else createMutation.mutate(payload);
  };

  const actionTitle = action?.type === 'order'
    ? 'Place this purchase order?'
    : action?.type === 'receive'
      ? 'Confirm goods received?'
      : 'Delete draft purchase order?';

  return (
    <main className="space-y-5 p-4 pb-8 sm:space-y-6 sm:p-6 lg:p-7">
      <PageHeader
        title="Purchase orders"
        sub="Create supplier orders, receive stock and record supplier payments"
        action={<Button onClick={openCreate}><Plus size={16} /> New purchase order</Button>}
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Purchase order summary">
        <Metric label="Orders" value={total.toLocaleString('en-IN')} detail="Matching current status and supplier filters" Icon={ClipboardList} />
        <Metric label="Page value" value={money(summary.value, fmt)} detail="Order value in the loaded page" Icon={Wallet} tone="green" />
        <Metric label="Balance due" value={money(summary.balanceDue, fmt)} detail="Outstanding in the loaded page" Icon={ArrowDownRight} tone="orange" />
        <Metric label="Awaiting receipt" value={summary.awaitingReceipt.toLocaleString('en-IN')} detail="Orders marked as ordered" Icon={PackageCheck} tone="red" />
      </section>

      <section className="space-y-3" aria-label="Purchase order filters">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden="true" />
          <label className="sr-only" htmlFor="po-search">Search purchase orders</label>
          <input id="po-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search PO number, supplier or item…" className={inputClass + ' min-h-12 pl-10 pr-10'} />
          {search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg"><X size={15} /></button>}
        </div>

        <Card>
          <CardBody className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Status</span>
              <select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className={inputClass}>
                <option value="all">All statuses</option>
                {Object.entries(STATUS_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Supplier</span>
              <select value={supplierFilter} onChange={event => { setSupplierFilter(event.target.value); setPage(1); }} className={inputClass}>
                <option value="all">All suppliers</option>
                {(suppliersQuery.data || []).map(supplier => <option key={supplier._id} value={supplier._id}>{supplier.name}</option>)}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <Button variant="secondary" className="flex-1" onClick={clearFilters}>Clear filters</Button>
              <Button variant="secondary" size="md" onClick={() => refetch()} loading={isFetching} aria-label="Refresh purchase orders"><RefreshCw size={15} /></Button>
            </div>
          </CardBody>
        </Card>
      </section>

      {suppliersQuery.isError && (
        <Card role="alert">
          <CardBody className="flex items-center justify-between gap-3 p-4">
            <p className="text-xs text-[var(--color-danger)]">Supplier filter options could not be loaded.</p>
            <Button size="sm" variant="secondary" onClick={() => suppliersQuery.refetch()}>Retry</Button>
          </CardBody>
        </Card>
      )}

      {isError && (
        <Card role="alert">
          <CardBody className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)]">Purchase orders could not be loaded</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{error?.response?.data?.message || error?.message || 'Check your connection and try again.'}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => refetch()} loading={isFetching}>Try again</Button>
          </CardBody>
        </Card>
      )}

      {isLoading && !isError ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading purchase orders">
          {[0, 1, 2, 3, 4, 5].map(index => <div key={index} className="h-52 animate-pulse rounded-2xl border border-[var(--color-border)] bg-white" />)}
        </div>
      ) : !isError && filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white px-5 py-14 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4eee3] text-[#80622e]"><Truck size={22} /></span>
          <h2 className="mt-3 text-sm font-semibold text-[var(--color-text)]">{orders.length ? 'No matching purchase orders' : 'No purchase orders yet'}</h2>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[var(--color-text-muted)]">{orders.length ? 'Try a different search or clear your filters.' : 'Create a draft order for a supplier to begin the purchasing workflow.'}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {(search || status !== 'all' || supplierFilter !== 'all') && <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>}
            {!orders.length && <Button size="sm" onClick={openCreate}><Plus size={15} /> New purchase order</Button>}
          </div>
        </div>
      ) : !isError && (
        <section className="space-y-3" aria-label="Purchase order results">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Order directory</h2>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{total === 0 ? 'No orders' : 'Showing ' + ((page - 1) * PAGE_SIZE + 1) + '–' + Math.min(page * PAGE_SIZE, total) + ' of ' + total}{search ? ' · search applies to this page' : ''}</p>
            </div>
            {isFetching && <span className="text-xs text-[var(--color-text-muted)]">Updating…</span>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map(order => (
              <PurchaseOrderCard
                key={order._id}
                order={order}
                fmt={fmt}
                isAdmin={isAdmin}
                onView={item => setSelectedId(item._id)}
                onEdit={openEdit}
                onDelete={item => setAction({ type: 'delete', order: item })}
                onPlace={item => setAction({ type: 'order', order: item })}
                onReceive={item => setAction({ type: 'receive', order: item })}
                onPay={setPaymentOrder}
                pending={actionMutation.isPending}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5">
            <Button variant="secondary" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft size={15} /> Previous</Button>
            <span className="text-xs font-medium tabular-nums text-[var(--color-text-muted)]">Page {page} of {totalPages}</span>
            <Button variant="secondary" size="sm" disabled={page >= totalPages || isFetching} onClick={() => setPage(value => Math.min(totalPages, value + 1))}>Next <ChevronRight size={15} /></Button>
          </div>
        </section>
      )}

      <Sheet open={formOpen} title={formOrder ? 'Edit draft order' : 'Create purchase order'} subtitle="Supplier, items, quantities and agreed unit costs" onClose={closeForm} maxH="96dvh">
        <PurchaseOrderForm
          key={formOrder?._id || 'new-purchase-order'}
          order={formOrder}
          saving={createMutation.isPending || editMutation.isPending}
          onClose={closeForm}
          onSave={submitOrderForm}
        />
      </Sheet>

      <Sheet open={Boolean(selectedId)} title="Purchase order details" subtitle="Order items and supplier payment history" onClose={() => setSelectedId(null)} maxH="96dvh">
        {selectedId && <PurchaseOrderDetails orderId={selectedId} fmt={fmt} />}
      </Sheet>

      <Sheet open={Boolean(paymentOrder)} title="Record supplier payment" subtitle={paymentOrder?.poNumber + ' · ' + (paymentOrder?.supplierName || paymentOrder?.supplier?.name || 'Supplier')} onClose={() => paymentMutation.isPending ? null : setPaymentOrder(null)} maxH="96dvh">
        {paymentOrder && (
          <SupplierPaymentForm
            key={paymentOrder._id}
            order={paymentOrder}
            fmt={fmt}
            saving={paymentMutation.isPending}
            onClose={() => setPaymentOrder(null)}
            onSave={payload => paymentMutation.mutate({ id: paymentOrder._id, payload })}
          />
        )}
      </Sheet>

      <Sheet open={Boolean(action)} title={actionTitle} subtitle="This action updates the purchase order workflow" onClose={() => actionMutation.isPending ? null : setAction(null)} maxH="auto">
        {action && (
          <div className="space-y-4 p-5">
            <div className="rounded-xl border border-[var(--color-gold-light)] bg-[#fbf8f1] p-3">
              <p className="text-sm font-semibold text-[var(--color-text)]">{action.order.poNumber} · {action.order.supplierName || action.order.supplier?.name}</p>
              {action.type === 'order' && <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">This changes the draft to Ordered. It does not add stock. The goods must be received separately.</p>}
              {action.type === 'receive' && <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">Confirm that all items and quantities have arrived. Stock quantities and the supplier account balance will be updated.</p>}
              {action.type === 'delete' && <p className="mt-1 text-xs leading-5 text-[var(--color-danger)]">Only unpaid draft orders can be deleted. This action is permanent and audit logged.</p>}
              <p className="mt-2 text-sm font-semibold tabular-nums">{money(action.order.grandTotal, fmt)}</p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setAction(null)} disabled={actionMutation.isPending}>Cancel</Button>
              <Button
                variant={action.type === 'delete' ? 'danger' : 'primary'}
                loading={actionMutation.isPending}
                onClick={() => actionMutation.mutate({ type: action.type, id: action.order._id })}
              >
                {action.type === 'order' ? 'Place order' : action.type === 'receive' ? 'Confirm received' : 'Delete draft'}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </main>
  );
}
