import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  Download,
  Package,
  Printer,
  RefreshCw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet
} from 'lucide-react';
import api from '../services/api';
import useSettingsStore from '../store/settingsStore';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import CardBody from '../components/ui/CardBody';
import Badge from '../components/ui/Badge';
import {
  buildMonthlySeries,
  getRevenueLessExpenses,
  isInvalidReportDateRange,
  mergeDailySeries
} from './reportCalculations.mjs';

const TABS = ['Overview', 'Daily', 'Monthly', 'Inventory', 'Staff', 'Categories'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CHART_COLORS = ['#b58d4c', '#202020', '#4b8066', '#a64d4d', '#526c8d', '#8b7355', '#6e687c', '#6e8a8a'];
const inputClass = 'input min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)] focus:border-[var(--color-gold)] focus:outline-none focus:ring-2 focus:ring-[rgba(197,164,109,0.2)]';

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function dateStart() {
  const date = new Date();
  date.setDate(1);
  return toDateInputValue(date);
}

function dateToday() {
  return toDateInputValue(new Date());
}

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
      <CardBody className="flex items-start gap-3 p-4 sm:p-5">
        <span className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ' + tones[tone]}>
          <Icon size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--color-text)] sm:text-2xl">{value}</p>
          <p className="mt-1 text-[11px] leading-4 text-[var(--color-text-muted)]">{detail}</p>
        </div>
      </CardBody>
    </Card>
  );
}

function LoadingCards({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading report">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-2xl border border-[var(--color-border)] bg-white" />
      ))}
    </div>
  );
}

function ReportError({ message, onRetry, retrying }) {
  return (
    <Card role="alert">
      <CardBody className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-[var(--color-danger)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">Report data could not be loaded</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{message || 'Check your connection and try again.'}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onRetry} loading={retrying}><RefreshCw size={14} /> Try again</Button>
      </CardBody>
    </Card>
  );
}

function EmptyReport({ title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white px-5 py-12 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4eee3] text-[#80622e]"><BarChart3 size={22} /></span>
      <h3 className="mt-3 text-sm font-semibold text-[var(--color-text)]">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[var(--color-text-muted)]">{description}</p>
    </div>
  );
}

function Table({ headings, rows, emptyLabel = 'No records to display.' }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white">
      {rows.length === 0 ? (
        <p className="p-6 text-center text-xs text-[var(--color-text-muted)]">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-[var(--color-bg-secondary)] text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
              <tr>{headings.map(heading => <th scope="col" key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-light)]">
              {rows.map((row, index) => <tr key={row.key || index}>{row.cells.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{cell}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState('Overview');
  const [startDate, setStartDate] = useState(dateStart);
  const [endDate, setEndDate] = useState(dateToday);
  const fmt = useSettingsStore(state => state.fmt);
  const invalidRange = isInvalidReportDateRange(startDate, endDate);

  const summaryQuery = useQuery({
    queryKey: ['rpt-summary', startDate, endDate],
    enabled: tab === 'Overview' && !invalidRange,
    queryFn: async () => {
      const response = await api.get('/reports/summary', { params: { startDate, endDate } });
      return response.data.data;
    }
  });

  const dailyQuery = useQuery({
    queryKey: ['rpt-daily'],
    queryFn: async () => {
      const response = await api.get('/reports/daily');
      return response.data.data;
    },
    enabled: tab === 'Daily'
  });

  const monthlyQuery = useQuery({
    queryKey: ['rpt-monthly'],
    queryFn: async () => {
      const response = await api.get('/reports/monthly');
      return response.data.data;
    },
    enabled: tab === 'Monthly'
  });

  const inventoryQuery = useQuery({
    queryKey: ['rpt-inventory'],
    queryFn: async () => {
      const response = await api.get('/reports/inventory');
      return response.data.data;
    },
    enabled: tab === 'Inventory'
  });

  const staffQuery = useQuery({
    queryKey: ['rpt-staff', startDate, endDate],
    queryFn: async () => {
      const response = await api.get('/reports/staff-performance', { params: { startDate, endDate } });
      return response.data.data;
    },
    enabled: tab === 'Staff' && !invalidRange
  });

  const categoriesQuery = useQuery({
    queryKey: ['rpt-categories', startDate, endDate],
    queryFn: async () => {
      const response = await api.get('/reports/categories', { params: { startDate, endDate } });
      return response.data.data;
    },
    enabled: tab === 'Categories' && !invalidRange
  });

  const dailyChart = useMemo(
    () => mergeDailySeries(dailyQuery.data?.salesByDay, dailyQuery.data?.expByDay),
    [dailyQuery.data]
  );
  const monthlyChart = useMemo(
    () => buildMonthlySeries(monthlyQuery.data, MONTHS),
    [monthlyQuery.data]
  );

  const quickRange = label => {
    const end = new Date();
    const start = new Date();
    if (label === 'Today') {
      const today = toDateInputValue(end);
      setStartDate(today);
      setEndDate(today);
      return;
    }
    if (label === 'Week') start.setDate(start.getDate() - 6);
    if (label === 'Month') start.setDate(1);
    if (label === 'Year') {
      start.setMonth(0);
      start.setDate(1);
    }
    setStartDate(toDateInputValue(start));
    setEndDate(toDateInputValue(end));
  };

  const rangeAffected = ['Overview', 'Staff', 'Categories'].includes(tab);

  return (
    <main className="space-y-5 p-4 pb-8 sm:space-y-6 sm:p-6 lg:p-7">
      <PageHeader
        title="Reports & analytics"
        sub="Explore real sales, expenses, stock and team performance"
        action={<Button variant="secondary" onClick={() => window.print()}><Printer size={15} /> Print report</Button>}
      />

      <Card>
        <CardBody className="space-y-3 p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-[#80622e]" />
            <div>
              <p className="text-xs font-semibold text-[var(--color-text)]">Reporting period</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {rangeAffected ? 'Applies to this report.' : tab === 'Inventory' ? 'Inventory shows the current stock position.' : tab === 'Daily' ? 'Daily view always shows the most recent 30 days.' : 'Monthly view always shows the most recent 12 months.'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">From date</span>
              <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className={inputClass} aria-label="Report start date" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">To date</span>
              <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className={inputClass} aria-label="Report end date" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {['Today', 'Week', 'Month', 'Year'].map(label => (
              <button key={label} type="button" onClick={() => quickRange(label)} className="min-h-9 rounded-full border border-[var(--color-border)] bg-white px-3.5 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-gold-light)] hover:bg-[#fbf8f1]">
                {label}
              </button>
            ))}
          </div>
          {invalidRange && <p className="text-xs font-medium text-[var(--color-danger)]" role="alert">The start date must be on or before the end date.</p>}
        </CardBody>
      </Card>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Report sections">
        {TABS.map(value => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-current={tab === value ? 'page' : undefined}
            className={'min-h-10 shrink-0 rounded-xl border px-4 text-xs font-semibold transition ' + (tab === value
              ? 'border-[#171717] bg-[#171717] text-white shadow-sm'
              : 'border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:border-[var(--color-gold-light)]')}
          >
            {value}
          </button>
        ))}
      </nav>

      {tab === 'Overview' && (
        invalidRange ? null : summaryQuery.isLoading ? (
          <LoadingCards count={5} />
        ) : summaryQuery.isError ? (
          <ReportError message={summaryQuery.error?.response?.data?.message || summaryQuery.error?.message} onRetry={() => summaryQuery.refetch()} retrying={summaryQuery.isFetching} />
        ) : summaryQuery.data ? (
          <section className="space-y-4" aria-label="Business overview">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <Metric label="Revenue" value={money(summaryQuery.data.revenue, fmt)} detail={(summaryQuery.data.salesCount || 0) + ' recorded sales'} Icon={TrendingUp} tone="green" />
              <Metric label="Recorded expenses" value={money(summaryQuery.data.expenses, fmt)} detail="Expenses in the selected period" Icon={TrendingDown} tone="red" />
              <Metric label="Revenue less expenses" value={money(getRevenueLessExpenses(summaryQuery.data.revenue, summaryQuery.data.expenses), fmt)} detail="Before product cost / cost of goods sold" Icon={Wallet} tone="gold" />
              <Metric
                label="Gross profit"
                value={summaryQuery.data.grossProfitAvailable ? money(summaryQuery.data.grossProfit, fmt) : 'Unavailable'}
                detail={summaryQuery.data.grossProfitAvailable
                  ? 'Sales less recorded product cost, before operating expenses'
                  : `${Number(summaryQuery.data.uncostedInvoiceCount || 0)} invoice(s) need product cost data`}
                Icon={Wallet}
                tone="gold"
              />
              <Metric label="Average sale" value={money(summaryQuery.data.salesCount ? summaryQuery.data.revenue / summaryQuery.data.salesCount : 0, fmt)} detail="Revenue divided by sales count" Icon={ShoppingBag} tone="slate" />
              <Metric label="Sales count" value={Number(summaryQuery.data.salesCount || 0).toLocaleString('en-IN')} detail="Invoices in the selected period" Icon={BarChart3} tone="slate" />
            </div>

            <div className="rounded-2xl border border-[#ead8ad] bg-[#fbf8f1] p-3.5">
              <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
                “Revenue less expenses” is before product cost and is not net profit. Gross profit is calculated from server-recorded product cost snapshots on new invoices; historical invoices are not backfilled. It remains unavailable for a period until every invoice in that period has complete cost data.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card>
                <CardBody className="space-y-3 p-4">
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--color-text)]">Sales by payment method</h2>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">Invoice value in the selected period</p>
                  </div>
                  {(summaryQuery.data.byPayment || []).length ? (
                    <>
                      <div role="img" aria-label="Pie chart showing sales value by payment method" className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={summaryQuery.data.byPayment} dataKey="total" nameKey="_id" cx="50%" cy="50%" outerRadius={78} label={({ _id, percent }) => _id + ' ' + (percent * 100).toFixed(0) + '%'} labelLine={false}>
                              {summaryQuery.data.byPayment.map((item, index) => <Cell key={item._id || index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={value => money(value, fmt)} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <Table
                        headings={['Method', 'Sales', 'Value']}
                        rows={summaryQuery.data.byPayment.map(item => ({
                          key: item._id,
                          cells: [item._id || 'Unspecified', item.count, money(item.total, fmt)]
                        }))}
                      />
                    </>
                  ) : <EmptyReport title="No payment data" description="Payment method totals will appear when invoices exist in this reporting period." />}
                </CardBody>
              </Card>

              <Card>
                <CardBody className="space-y-3 p-4">
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--color-text)]">Top-selling products</h2>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">Ranked by units sold in the selected period</p>
                  </div>
                  {(summaryQuery.data.topProducts || []).length ? (
                    <Table
                      headings={['Product', 'Units', 'Revenue']}
                      rows={summaryQuery.data.topProducts.slice(0, 8).map((product, index) => ({
                        key: product._id || index,
                        cells: [
                          <span className="font-medium text-[var(--color-text)]">{product.name || 'Unknown product'}</span>,
                          product.qty,
                          <span className="font-semibold tabular-nums text-[var(--color-text)]">{money(product.revenue, fmt)}</span>
                        ]
                      }))}
                    />
                  ) : <EmptyReport title="No product sales" description="Top products appear after sales invoices are recorded." />}
                </CardBody>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Metric label="Customer credit balances" value={money(summaryQuery.data.totalCreditOwed, fmt)} detail="Current balance owed by customers · all dates" Icon={Users} tone="red" />
              <Metric label="Supplier balances" value={money(summaryQuery.data.totalSupplierDebt, fmt)} detail="Current amount owed to suppliers · all dates" Icon={Package} tone="gold" />
            </div>
          </section>
        ) : <EmptyReport title="No report summary available" description="No summary data was returned for this period." />
      )}

      {tab === 'Daily' && (
        dailyQuery.isLoading ? <LoadingCards count={3} /> :
        dailyQuery.isError ? <ReportError message={dailyQuery.error?.response?.data?.message || dailyQuery.error?.message} onRetry={() => dailyQuery.refetch()} retrying={dailyQuery.isFetching} /> :
        dailyChart.length === 0 ? <EmptyReport title="No daily activity" description="Sales and recorded expenses for the last 30 days will appear here." /> : (
          <section className="space-y-4">
            <Card>
              <CardBody className="space-y-3 p-4">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--color-text)]">Revenue vs recorded expenses</h2>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">Last 30 days · expense-only dates are included</p>
                </div>
                <div role="img" aria-label="Area chart comparing daily revenue and recorded expenses for the last 30 days" className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyChart} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e9e4da" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={value => value.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip labelFormatter={value => value} formatter={value => money(value, fmt)} />
                      <Legend />
                      <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#b58d4c" fill="#b58d4c" fillOpacity={0.16} strokeWidth={2} />
                      <Area type="monotone" dataKey="expenses" name="Recorded expenses" stroke="#a64d4d" fill="#a64d4d" fillOpacity={0.12} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-3 p-4">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--color-text)]">Revenue less recorded expenses</h2>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">This is before product cost / cost of goods sold, not net profit.</p>
                </div>
                <div role="img" aria-label="Bar chart showing daily revenue less recorded expenses before product cost" className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyChart} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e9e4da" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={value => value.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={value => money(value, fmt)} />
                      <Bar dataKey="revenueLessExpenses" name="Revenue less expenses" fill="#b58d4c" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Table
                  headings={['Date', 'Revenue', 'Expenses', 'Difference']}
                  rows={dailyChart.slice(-10).reverse().map(item => ({
                    key: item.date,
                    cells: [item.date, money(item.revenue, fmt), money(item.expenses, fmt), money(item.revenueLessExpenses, fmt)]
                  }))}
                  emptyLabel="No daily data."
                />
              </CardBody>
            </Card>
          </section>
        )
      )}

      {tab === 'Monthly' && (
        monthlyQuery.isLoading ? <LoadingCards count={3} /> :
        monthlyQuery.isError ? <ReportError message={monthlyQuery.error?.response?.data?.message || monthlyQuery.error?.message} onRetry={() => monthlyQuery.refetch()} retrying={monthlyQuery.isFetching} /> :
        monthlyChart.length === 0 ? <EmptyReport title="No monthly sales yet" description="Monthly revenue appears after invoices are recorded." /> : (
          <Card>
            <CardBody className="space-y-3 p-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-text)]">Monthly revenue</h2>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">Most recent 12 months · all payment methods</p>
              </div>
              <div role="img" aria-label="Bar chart of monthly revenue over the last 12 months" className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyChart} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e9e4da" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={value => money(value, fmt)} />
                    <Bar dataKey="revenue" name="Revenue" fill="#b58d4c" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Table
                headings={['Month', 'Invoices', 'Revenue']}
                rows={monthlyChart.slice().reverse().map(item => ({
                  key: item.key,
                  cells: [item.name, item.count, money(item.revenue, fmt)]
                }))}
              />
            </CardBody>
          </Card>
        )
      )}

      {tab === 'Inventory' && (
        inventoryQuery.isLoading ? <LoadingCards count={4} /> :
        inventoryQuery.isError ? <ReportError message={inventoryQuery.error?.response?.data?.message || inventoryQuery.error?.message} onRetry={() => inventoryQuery.refetch()} retrying={inventoryQuery.isFetching} /> :
        inventoryQuery.data ? (
          <section className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Active products" value={Number(inventoryQuery.data.totalProducts || 0).toLocaleString('en-IN')} detail="Current catalogue" Icon={Package} tone="slate" />
              <Metric label="Low stock" value={(inventoryQuery.data.lowStock || []).length} detail="Up to 20 lowest-stock items" Icon={AlertCircle} tone="red" />
              <Metric label="Inventory at cost" value={money(inventoryQuery.data.inventoryValue?.atCost, fmt)} detail="Current quantity × current cost price" Icon={Wallet} tone="gold" />
              <Metric label="Inventory at retail" value={money(inventoryQuery.data.inventoryValue?.atRetail, fmt)} detail="Current quantity × current selling price" Icon={ShoppingBag} tone="green" />
            </div>

            <Card>
              <CardBody className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-[var(--color-text)]">Low-stock items</h2>
                  <Badge variant="warning">{(inventoryQuery.data.lowStock || []).length} shown</Badge>
                </div>
                <Table
                  headings={['Product', 'Category', 'Available']}
                  rows={(inventoryQuery.data.lowStock || []).map(item => ({
                    key: item._id,
                    cells: [item.name, item.category, <span className="font-semibold text-[var(--color-danger)]">{item.quantity}</span>]
                  }))}
                  emptyLabel="No low-stock items."
                />
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-[var(--color-text)]">Out-of-stock items</h2>
                  <Badge variant="danger">{(inventoryQuery.data.deadStock || []).length} shown</Badge>
                </div>
                <Table
                  headings={['Product', 'Category', 'Last updated']}
                  rows={(inventoryQuery.data.deadStock || []).map(item => ({
                    key: item._id,
                    cells: [item.name, item.category, dateLabel(item.updatedAt)]
                  }))}
                  emptyLabel="No out-of-stock items."
                />
              </CardBody>
            </Card>
          </section>
        ) : <EmptyReport title="Inventory report unavailable" description="No inventory report data was returned." />
      )}

      {tab === 'Staff' && (
        invalidRange ? null :
        staffQuery.isLoading ? <LoadingCards count={3} /> :
        staffQuery.isError ? <ReportError message={staffQuery.error?.response?.data?.message || staffQuery.error?.message} onRetry={() => staffQuery.refetch()} retrying={staffQuery.isFetching} /> :
        !(staffQuery.data || []).length ? <EmptyReport title="No staff sales for this period" description="Staff performance is based on sales invoices in the selected date range." /> : (
          <Card>
            <CardBody className="space-y-3 p-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-text)]">Staff sales performance</h2>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">Ranked by invoice revenue in the selected date range</p>
              </div>
              <Table
                headings={['Staff member', 'Sales', 'Average sale', 'Revenue']}
                rows={(staffQuery.data || []).map((item, index) => ({
                  key: item._id || index,
                  cells: [
                    <span className="font-medium text-[var(--color-text)]">{item.name || 'Unknown staff'}</span>,
                    item.count,
                    money(item.avgSale, fmt),
                    <span className="font-semibold text-[var(--color-text)]">{money(item.revenue, fmt)}</span>
                  ]
                }))}
              />
            </CardBody>
          </Card>
        )
      )}

      {tab === 'Categories' && (
        invalidRange ? null :
        categoriesQuery.isLoading ? <LoadingCards count={3} /> :
        categoriesQuery.isError ? <ReportError message={categoriesQuery.error?.response?.data?.message || categoriesQuery.error?.message} onRetry={() => categoriesQuery.refetch()} retrying={categoriesQuery.isFetching} /> :
        !(categoriesQuery.data || []).length ? <EmptyReport title="No category sales for this period" description="Category results are based on invoice items joined to the products' current category." /> : (
          <section className="space-y-4">
            <div className="rounded-2xl border border-[#ead8ad] bg-[#fbf8f1] p-3.5">
              <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
                Category reporting uses each product's current catalogue category. If a product's category was changed, older sales may appear under the new category because invoice items do not store a category snapshot.
              </p>
            </div>
            <Card>
              <CardBody className="space-y-3 p-4">
                <h2 className="text-sm font-semibold text-[var(--color-text)]">Revenue by category</h2>
                <div role="img" aria-label="Pie chart of sales revenue grouped by current product category" className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoriesQuery.data} dataKey="revenue" nameKey="_id" cx="50%" cy="50%" outerRadius={84} label={({ _id, percent }) => (percent >= 0.06 ? (_id || 'Unknown') + ' ' + (percent * 100).toFixed(0) + '%' : '')} labelLine={false}>
                        {categoriesQuery.data.map((item, index) => <Cell key={item._id || index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={value => money(value, fmt)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <Table
                  headings={['Category', 'Units sold', 'Revenue']}
                  rows={categoriesQuery.data.map((item, index) => ({
                    key: item._id || index,
                    cells: [item._id || 'Unknown', item.qty, money(item.revenue, fmt)]
                  }))}
                />
              </CardBody>
            </Card>
          </section>
        )
      )}

      <p className="text-[11px] leading-5 text-[var(--color-text-muted)]">
        Reports are based on the records returned by the ERP API. Inventory and account balances are current snapshots; daily/monthly reports use their own fixed periods.
      </p>
    </main>
  );
}
