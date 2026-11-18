import { useEffect, useState } from 'react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import PaginationBar from '../components/ui/PaginationBar';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  AlertCircle, CircleDollarSign, FileText, Plus, Search,
  Trash2, TrendingDown, Wallet, X
} from 'lucide-react';
import api from '../services/api';
import useSettingsStore from '../store/settingsStore';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import CardBody from '../components/ui/CardBody';
import Badge from '../components/ui/Badge';
import Sheet from '../components/ui/Sheet';
import {
  EXPENSE_CATEGORIES,
  normalizeExpensePayload,
  summarizeExpenses
} from './expenseManagement.mjs';

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
    gold: 'bg-[#f4eee3] text-[#74511d]',
    red: 'bg-[#f8ecea] text-[#963b3b]',
    slate: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]',
    green: 'bg-[#eaf3ed] text-[#216442]'
  };
  return (
    <Card className="min-w-0">
      <CardBody className="flex h-full items-start gap-3 p-4 sm:p-5">
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

function ExpenseForm({ onSave, onClose, saving }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      title: '',
      amount: '',
      category: '',
      date: new Date().toISOString().slice(0, 10),
      description: ''
    }
  });

  return (
    <form onSubmit={handleSubmit(values => onSave(normalizeExpensePayload(values)))} className="space-y-4 p-4 sm:p-5" noValidate>
      <div className="rounded-xl border border-[var(--color-gold-light)] bg-[#fbf8f1] p-3">
        <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
          Expense entries are recorded in the business base currency. The selected display currency only changes how totals are shown.
        </p>
      </div>

      <div>
        <label htmlFor="expense-title" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">
          Expense title <span className="text-[var(--color-danger)]">*</span>
        </label>
        <input
          id="expense-title"
          maxLength={120}
          className={inputClass + (errors.title ? ' border-[var(--color-danger)]' : '')}
          placeholder="e.g. Monthly shop rent"
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'expense-title-error' : undefined}
          {...register('title', {
            required: 'Enter an expense title.',
            maxLength: { value: 120, message: 'Title must be 120 characters or fewer.' },
            validate: value => Boolean(String(value || '').trim()) || 'Enter an expense title.'
          })}
        />
        {errors.title && <p id="expense-title-error" role="alert" className="mt-1 text-xs text-[var(--color-danger)]">{errors.title.message}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="expense-amount" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">
            Amount (business base currency) <span className="text-[var(--color-danger)]">*</span>
          </label>
          <input
            id="expense-amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            className={inputClass + (errors.amount ? ' border-[var(--color-danger)]' : '')}
            placeholder="0.00"
            aria-invalid={Boolean(errors.amount)}
            aria-describedby={errors.amount ? 'expense-amount-error' : undefined}
            {...register('amount', {
              required: 'Enter an expense amount.',
              valueAsNumber: true,
              min: { value: 0.01, message: 'Amount must be greater than zero.' },
              validate: value => Number.isFinite(value) || 'Enter a valid amount.'
            })}
          />
          {errors.amount && <p id="expense-amount-error" role="alert" className="mt-1 text-xs text-[var(--color-danger)]">{errors.amount.message}</p>}
        </div>

        <div>
          <label htmlFor="expense-date" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">
            Expense date <span className="text-[var(--color-danger)]">*</span>
          </label>
          <input
            id="expense-date"
            type="date"
            className={inputClass}
            {...register('date', { required: 'Select the expense date.' })}
          />
          {errors.date && <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">{errors.date.message}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="expense-category" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">
          Category <span className="text-[var(--color-danger)]">*</span>
        </label>
        <select id="expense-category" className={inputClass} {...register('category', { required: 'Choose an expense category.' })}>
          <option value="">Select a category</option>
          {EXPENSE_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
        </select>
        {errors.category && <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">{errors.category.message}</p>}
      </div>

      <div>
        <label htmlFor="expense-description" className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">Description</label>
        <textarea
          id="expense-description"
          rows={3}
          maxLength={300}
          className={inputClass + ' min-h-24 resize-y'}
          placeholder="Optional supporting details"
          {...register('description', { maxLength: { value: 300, message: 'Description must be 300 characters or fewer.' } })}
        />
        {errors.description && <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">{errors.description.message}</p>}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-border-light)] pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
        <Button type="submit" loading={saving || isSubmitting} className="w-full sm:w-auto"><Plus size={15} /> Record expense</Button>
      </div>
    </form>
  );
}

export default function ExpensesPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const { fmt } = useSettingsStore();
  const queryClient = useQueryClient();

  const dateRangeInvalid = Boolean(startDate && endDate && startDate > endDate);

  useEffect(() => setPage(1), [debouncedSearch, category, startDate, endDate]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['expenses', { page, search: debouncedSearch, category, startDate, endDate }],
    enabled: !dateRangeInvalid,
    queryFn: async () => {
      const params = { page, limit: 25 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (category !== 'All') params.category = category;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const response = await api.get('/expenses', { params });
      return response.data;
    },
    placeholderData: previousData => previousData,
    staleTime: 30000
  });

  const expenses = Array.isArray(data?.data) ? data.data : [];
  const filtered = expenses;
  const total = Number(data?.totalCount) || expenses.length;
  const totalPages = Math.max(1, Number(data?.totalPages) || 1);
  const summary = data?.summary || summarizeExpenses(expenses);

  const deleteMutation = useMutation({
    mutationFn: id => api.delete('/expenses/' + id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense removed. The action has been audit logged.');
      setDeleting(null);
    },
    onError: error => toast.error(error?.response?.data?.message || 'Expense could not be deleted.')
  });

  const saveMutation = useMutation({
    mutationFn: values => api.post('/expenses', values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense recorded.');
      setFormOpen(false);
    },
    onError: error => toast.error(error?.response?.data?.message || 'Expense could not be recorded.')
  });

  const clearFilters = () => {
    setSearch('');
    setPage(1);
    setCategory('All');
    setStartDate('');
    setEndDate('');
  };

  return (
    <main className="space-y-5 p-4 pb-8 sm:space-y-6 sm:p-6 lg:p-7">
      <PageHeader title="Expense management" sub="Track operating costs and review business spending" action={<Button onClick={() => setFormOpen(true)}><Plus size={16} /> Add expense</Button>} />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Expense summary">
        <Metric label="Expenses" value={summary.count.toLocaleString('en-IN')} detail="Entries in the selected view" Icon={FileText} tone="slate" />
        <Metric label="Total spending" value={money(summary.total, fmt)} detail="Selected dates and filters" Icon={TrendingDown} tone="red" />
        <Metric label="Average entry" value={money(summary.average, fmt)} detail="Mean amount per expense" Icon={CircleDollarSign} tone="gold" />
        <Metric label="Largest expense" value={money(summary.largest, fmt)} detail="Highest single entry in view" Icon={Wallet} tone="green" />
      </section>

      <section className="space-y-3" aria-label="Expense filters">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden="true" />
          <label htmlFor="expense-search" className="sr-only">Search expenses</label>
          <input id="expense-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search title, category or description…" className={inputClass + ' min-h-12 pl-10 pr-10'} />
          {search && <button type="button" aria-label="Clear expense search" onClick={() => setSearch('')} className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg"><X size={15} /></button>}
        </div>

        <Card>
          <CardBody className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Category</span>
              <select value={category} onChange={event => setCategory(event.target.value)} className={inputClass}>
                <option value="All">All categories</option>
                {EXPENSE_CATEGORIES.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">From date</span>
              <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className={inputClass} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">To date</span>
              <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className={inputClass} />
            </label>
            <div className="flex items-end"><Button variant="secondary" className="w-full" onClick={clearFilters}>Clear filters</Button></div>
          </CardBody>
        </Card>
        {dateRangeInvalid && <p role="alert" className="text-xs font-medium text-[var(--color-danger)]">The start date must be on or before the end date.</p>}
      </section>

      {summary.categoryBreakdown.length > 0 && (
        <Card>
          <CardBody className="space-y-4 p-4 sm:p-5">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Expense breakdown</h2>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">Share of expenses in the selected view</p>
            </div>
            {summary.categoryBreakdown.map(item => (
              <div key={item.category}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">{item.category}</span>
                  <span className="shrink-0 text-xs tabular-nums text-[var(--color-text)]">{money(item.amount, fmt)} <span className="text-[var(--color-text-muted)]">({item.share.toFixed(0)}%)</span></span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
                  <motion.div initial={{ width: 0 }} animate={{ width: item.share + '%' }} transition={{ duration: 0.45 }} className="h-full rounded-full bg-[#b58d4c]" />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {isError && (
        <Card role="alert">
          <CardBody className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-[var(--color-danger)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">Expenses could not be loaded</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{error?.response?.data?.message || error?.message || 'Check your connection and try again.'}</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => refetch()} loading={isFetching}>Try again</Button>
          </CardBody>
        </Card>
      )}

      {isLoading && !isError ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading expenses">
          {[0, 1, 2, 3, 4, 5].map(index => <div key={index} className="h-36 animate-pulse rounded-2xl border border-[var(--color-border)] bg-white" />)}
        </div>
      ) : !isError && !dateRangeInvalid && filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white px-5 py-14 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4eee3] text-[#74511d]"><Wallet size={22} /></span>
          <h2 className="mt-3 text-sm font-semibold text-[var(--color-text)]">{expenses.length ? 'No matching expenses' : 'No expenses for this view'}</h2>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[var(--color-text-muted)]">{expenses.length ? 'Try a different search or clear the selected filters.' : 'Record a business expense to start building your cost history.'}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {(search || category !== 'All' || startDate || endDate) && <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>}
            {!expenses.length && <Button size="sm" onClick={() => setFormOpen(true)}><Plus size={15} /> Add expense</Button>}
          </div>
        </div>
      ) : !isError && (
        <section className="space-y-3" aria-label="Expense results">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Expense ledger</h2>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{filtered.length} entries shown{isFetching ? ' · Updating…' : ''}</p>
            </div>
            <Badge variant="info">Audit logged</Badge>
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white lg:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-[var(--color-bg-secondary)] text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Expense</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Category</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Description</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Amount</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-light)]">
                  {filtered.map(expense => (
                    <tr key={expense._id} className="transition hover:bg-[var(--color-bg-secondary)]/60">
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{dateLabel(expense.date)}</td>
                      <td className="px-4 py-3 font-semibold text-[var(--color-text)]">{expense.title}</td>
                      <td className="px-4 py-3"><Badge>{expense.category}</Badge></td>
                      <td className="max-w-[260px] truncate px-4 py-3 text-xs text-[var(--color-text-secondary)]">{expense.description || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-[var(--color-danger)]">{money(expense.amount, fmt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" aria-label={'Delete expense ' + expense.title} onClick={() => setDeleting(expense)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-danger)] hover:bg-[#f8ecea]"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            {filtered.map(expense => (
              <Card key={expense._id}>
                <CardBody className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--color-text)]">{expense.title}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{dateLabel(expense.date)}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-[var(--color-danger)]">{money(expense.amount, fmt)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border-light)] pt-3">
                    <Badge>{expense.category}</Badge>
                    <button type="button" aria-label={'Delete expense ' + expense.title} onClick={() => setDeleting(expense)} className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-danger)] hover:bg-[#f8ecea]"><Trash2 size={16} /></button>
                  </div>
                  {expense.description && <p className="text-xs leading-5 text-[var(--color-text-secondary)]">{expense.description}</p>}
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      <PaginationBar page={page} total={total} totalPages={totalPages} onPageChange={setPage} />

      <Sheet open={formOpen} title="Add expense" subtitle="Record a business cost with its category and date" onClose={() => saveMutation.isPending ? null : setFormOpen(false)} maxH="94dvh">
        <ExpenseForm onSave={values => saveMutation.mutate(values)} saving={saveMutation.isPending} onClose={() => setFormOpen(false)} />
      </Sheet>

      <Sheet open={Boolean(deleting)} title="Permanently delete expense?" subtitle="This action cannot be undone" onClose={() => deleteMutation.isPending ? null : setDeleting(null)} maxH="auto">
        {deleting && (
          <div className="space-y-4 p-5">
            <div className="rounded-xl border border-[#f0d6d2] bg-[#fff7f5] p-3">
              <p className="text-sm font-semibold text-[var(--color-text)]">{deleting.title}</p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{dateLabel(deleting.date)} · {deleting.category} · {money(deleting.amount, fmt)}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--color-danger)]">The current API permanently removes this expense and records an audit event. Keep supporting documents separately according to your business record policy.</p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setDeleting(null)} disabled={deleteMutation.isPending}>Cancel</Button>
              <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleting._id)}><Trash2 size={15} /> Permanently delete</Button>
            </div>
          </div>
        )}
      </Sheet>
    </main>
  );
}
