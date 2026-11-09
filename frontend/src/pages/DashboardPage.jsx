import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  AlertCircle, AlertTriangle, ArrowRight,
  BarChart3, CalendarDays, CircleDollarSign, Clock3,
  CreditCard, Package, RefreshCw, ReceiptText, ShoppingBag, TrendingUp,
  Wallet, XCircle,
} from 'lucide-react';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useSettingsStore from '../store/settingsStore';
import { useRole } from '../hooks/useRole';
import { Button, Card, CardBody, CardHeader, EmptyState, KpiCard, Skeleton } from '@/components/ui';
import './DashboardPage.css';

const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7days', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom range' },
];

const CHART_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function toLocalDateInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getRangeDates(range, customStart, customEnd, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'custom') return { startDate: customStart, endDate: customEnd };
  if (range === 'today') {
    const date = toLocalDateInput(today);
    return { startDate: date, endDate: date };
  }
  if (range === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const date = toLocalDateInput(yesterday);
    return { startDate: date, endDate: date };
  }
  if (range === '7days') {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { startDate: toLocalDateInput(start), endDate: toLocalDateInput(today) };
  }
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  return { startDate: toLocalDateInput(monthStart), endDate: toLocalDateInput(today) };
}

function safeNumber(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function rangeLabel(range) {
  return RANGE_OPTIONS.find(option => option.value === range)?.label || 'Selected range';
}

function dateLabel(date, options = { month: 'short', day: 'numeric' }) {
  if (!date) return '';
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString(undefined, options);
}

function monthLabel(row) {
  const month = Number(row?._id?.month);
  const year = Number(row?._id?.year);
  if (!month || month > 12) return '—';
  return new Date(year || new Date().getFullYear(), month - 1, 1)
    .toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

function getChartData(view, dailyRows, monthlyRows, startDate, endDate) {
  const inRange = value => (!startDate || value >= startDate) && (!endDate || value <= endDate);

  if (view === 'monthly') {
    return monthlyRows
      .filter(row => {
        const month = Number(row?._id?.month);
        const year = Number(row?._id?.year);
        if (!month || !year) return false;
        const value = `${year}-${pad(month)}-01`;
        const monthEnd = toLocalDateInput(new Date(year, month, 0));
        return (!startDate || monthEnd >= startDate) && (!endDate || value <= endDate);
      })
      .map(row => ({ label: monthLabel(row), revenue: safeNumber(row.revenue) }))
      .filter(row => row.revenue !== null);
  }

  const selectedDays = dailyRows.filter(row => inRange(row?._id));
  if (view === 'daily') {
    return selectedDays.map(row => ({
      label: dateLabel(row._id),
      revenue: safeNumber(row.revenue),
    })).filter(row => row.revenue !== null);
  }

  const weeks = new Map();
  selectedDays.forEach(row => {
    const revenue = safeNumber(row.revenue);
    if (revenue === null) return;
    const day = new Date(`${row._id}T00:00:00Z`);
    if (Number.isNaN(day.getTime())) return;
    const weekday = (day.getUTCDay() + 6) % 7;
    day.setUTCDate(day.getUTCDate() - weekday);
    const monday = day.toISOString().slice(0, 10);
    const current = weeks.get(monday) || { label: dateLabel(monday), revenue: 0 };
    current.revenue += revenue;
    weeks.set(monday, current);
  });
  return Array.from(weeks.values());
}

function formatStatus(status) {
  if (!status) return 'Status unavailable';
  return status.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());
}

function statusClass(status) {
  if (status === 'paid' || status === 'approved') return 'is-positive';
  if (status === 'partial' || status === 'pending_approval') return 'is-pending';
  if (status === 'unpaid' || status === 'disputed') return 'is-negative';
  return 'is-neutral';
}

function ErrorNotice({ title, onRetry }) {
  return (
    <div className="dashboard-error" role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <div>
        <p>{title}</p>
        <Button type="button" variant="ghost" size="sm" onClick={onRetry}>Try again</Button>
      </div>
    </div>
  );
}

function MetricSkeleton() {
  return (
    <div className="dashboard-kpi-skeleton" aria-label="Loading business metrics">
      {[0, 1, 2, 3].map(key => <Skeleton key={key} variant="card" className="h-36" />)}
    </div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore(state => state.user);
  const { fmt, currency } = useSettingsStore();
  const { isManager } = useRole();
  const queryClient = useQueryClient();
  const [range, setRange] = useState('month');
  const [chartView, setChartView] = useState('daily');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [cashbookOpenMessage, setCashbookOpenMessage] = useState('');

  const { startDate, endDate } = getRangeDates(range, customStart, customEnd);
  const validRange = Boolean(startDate && endDate && startDate <= endDate);
  const periodQuery = new URLSearchParams({ startDate: startDate || '', endDate: endDate || '' }).toString();

  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard');
      return data.data;
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const managerQueries = useQueries({
    queries: [
      {
        queryKey: ['dashboard-period-summary', startDate, endDate],
        queryFn: async () => {
          const { data } = await api.get(`/reports/summary?${periodQuery}`);
          return data.data;
        },
        enabled: isManager && validRange,
        staleTime: 30000,
      },
      {
        queryKey: ['dashboard-daily-sales'],
        queryFn: async () => {
          const { data } = await api.get('/reports/daily');
          return data.data;
        },
        enabled: isManager,
        staleTime: 60000,
      },
      {
        queryKey: ['dashboard-monthly-sales'],
        queryFn: async () => {
          const { data } = await api.get('/reports/monthly');
          return data.data;
        },
        enabled: isManager,
        staleTime: 60000,
      },
      {
        queryKey: ['dashboard-inventory'],
        queryFn: async () => {
          const { data } = await api.get('/reports/inventory');
          return data.data;
        },
        enabled: isManager,
        staleTime: 60000,
      },
      {
        queryKey: ['dashboard-cashbook-today'],
        queryFn: async () => {
          const { data } = await api.get('/cashbook/today');
          return data.data;
        },
        enabled: isManager,
        staleTime: 30000,
      },
      {
        queryKey: ['dashboard-cashbook-closings'],
        queryFn: async () => {
          const { data } = await api.get('/cashbook/closings');
          return data.data;
        },
        enabled: isManager,
        staleTime: 30000,
      },
    ],
  });

  const [summaryQuery, dailyQuery, monthlyQuery, inventoryQuery, cashbookQuery, closingsQuery] = managerQueries;
  const openCashbookMutation = useMutation({
    mutationFn: () => api.post('/cashbook/open'),
    onMutate: () => setCashbookOpenMessage(''),
    onSuccess: ({ data }) => {
      setCashbookOpenMessage(data.message || "Today's cashbook is open.");
      queryClient.setQueryData(['dashboard-cashbook-today'], data.data);
      queryClient.invalidateQueries({ queryKey: ['cashbook-today'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-cashbook-closings'] });
    },
  });
  const stats = dashboardQuery.data?.stats || {};
  const summary = summaryQuery?.data;
  const inventory = inventoryQuery?.data;
  const dailyRows = Array.isArray(dailyQuery?.data?.salesByDay) ? dailyQuery.data.salesByDay : [];
  const monthlyRows = isManager
    ? (Array.isArray(monthlyQuery?.data) ? monthlyQuery.data : [])
    : (Array.isArray(dashboardQuery.data?.monthlyRevenue) ? dashboardQuery.data.monthlyRevenue : []);
  const recentInvoices = Array.isArray(dashboardQuery.data?.recentInvoices)
    ? dashboardQuery.data.recentInvoices
    : [];
  const lowStock = Array.isArray(inventory?.lowStock)
    ? inventory.lowStock
    : Array.isArray(dashboardQuery.data?.lowStock) ? dashboardQuery.data.lowStock : [];
  const outOfStock = Array.isArray(inventory?.deadStock) ? inventory.deadStock : [];

  const effectiveChartView = isManager ? chartView : 'monthly';
  const chartData = useMemo(
    () => getChartData(
      effectiveChartView,
      dailyRows,
      monthlyRows,
      isManager ? startDate : undefined,
      isManager ? endDate : undefined,
    ),
    [effectiveChartView, dailyRows, monthlyRows, startDate, endDate, isManager],
  );

  const dateRangeText = useMemo(() => {
    if (!startDate || !endDate) return '';
    if (startDate === endDate) return dateLabel(startDate, { month: 'long', day: 'numeric', year: 'numeric' });
    return `${dateLabel(startDate)} – ${dateLabel(endDate)}`;
  }, [startDate, endDate]);

  const todayRevenue = safeNumber(stats.todayRevenue);
  const selectedRevenue = isManager ? safeNumber(summary?.revenue) : safeNumber(stats.monthRevenue);
  const selectedExpenses = isManager ? safeNumber(summary?.expenses) : null;
  const todayCount = safeNumber(stats.todayCount);
  const currencyFormat = value => {
    if (value === null) return '—';
    const formatted = fmt(value);
    if (currency !== 'USD') return formatted;
    return formatted.replace(/-?[\d,]+(?:\.\d+)?$/, Number(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }));
  };
  const summarySalesCount = safeNumber(summary?.salesCount);
  const summaryMetricSub = summary
    ? `${summarySalesCount === null ? 'Count unavailable' : `${summarySalesCount} invoices`} · discount ${currencyFormat(safeNumber(summary.totalDiscount))}`
    : 'Period summary unavailable';

  const today = new Date();
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const chartLoading = isManager
    ? (chartView === 'monthly' ? monthlyQuery?.isLoading : dailyQuery?.isLoading)
    : dashboardQuery.isLoading;
  const chartError = isManager
    ? (chartView === 'monthly' ? monthlyQuery?.isError : dailyQuery?.isError)
    : dashboardQuery.isError;
  const managerSummaryError = isManager && validRange && summaryQuery?.isError;

  const refetchDashboard = () => {
    dashboardQuery.refetch();
    if (isManager) {
      managerQueries.forEach((query, index) => {
        if (index !== 0 || validRange) query.refetch();
      });
    }
  };

  const periodRevenueTitle = range === 'month' ? 'Monthly Revenue' : `Revenue · ${rangeLabel(range)}`;
  const isCustomRangeInvalid = range === 'custom' && startDate && endDate && startDate > endDate;
  const currentBusinessDate = toLocalDateInput(today);
  const closing = Array.isArray(closingsQuery?.data)
    ? closingsQuery.data.find(item => item.date === cashbookQuery?.data?.date)
    : null;
  const cashbook = cashbookQuery?.data;
  const openingCash = safeNumber(cashbook?.openingCash);
  const cashReceived = safeNumber(cashbook?.livesCashSales);
  const cashExpenses = safeNumber(cashbook?.liveExpenses);
  const calculatedExpectedCash = openingCash !== null && cashReceived !== null && cashExpenses !== null
    ? openingCash + cashReceived - cashExpenses
    : null;
  const expectedCash = safeNumber(closing?.expectedCash)
    ?? calculatedExpectedCash;
  const actualCash = safeNumber(closing?.actualCash)
    ?? (cashbook?.isClosed ? safeNumber(cashbook.closingCash) : null);
  const cashDifference = actualCash !== null && expectedCash !== null ? actualCash - expectedCash : null;

  const latestSalesUrl = isManager ? '/reports' : '/pos';
  const salesLinkLabel = isManager ? 'View reports' : 'Open point of sale';

  return (
    <div className="dashboard-page">
      <div className="dashboard-content">
        <header className="dashboard-executive-header">
          <div className="dashboard-welcome">
            <p className="dashboard-eyebrow">{greeting}, {user?.name || 'there'}</p>
            <h1>Executive overview</h1>
            <div className="dashboard-business-line">
              <span>Abdulmula Fashion</span>
              <span className="dashboard-role">{user?.role || 'User'}</span>
              <span className="dashboard-header-date">
                <CalendarDays size={14} aria-hidden="true" />
                {today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
          <div className="dashboard-header-actions">
            {isManager && (
              <div className="dashboard-range-control">
                <label htmlFor="dashboard-range">Reporting period</label>
                <select
                  id="dashboard-range"
                  value={range}
                  onChange={event => setRange(event.target.value)}
                >
                  {RANGE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={refetchDashboard}
              aria-label="Refresh dashboard data"
            >
              Refresh
            </Button>
          </div>
          {isManager && range === 'custom' && (
            <div className="dashboard-custom-range" aria-label="Custom reporting dates">
              <label>
                <span>From</span>
                <input type="date" value={customStart} max={customEnd || currentBusinessDate} onChange={event => setCustomStart(event.target.value)} />
              </label>
              <label>
                <span>To</span>
                <input type="date" value={customEnd} min={customStart || undefined} max={currentBusinessDate} onChange={event => setCustomEnd(event.target.value)} />
              </label>
            </div>
          )}
        </header>

        {dashboardQuery.isError && (
          <ErrorNotice title="Dashboard data could not be loaded." onRetry={() => dashboardQuery.refetch()} />
        )}

        {isManager && range === 'custom' && (!startDate || !endDate) && (
          <p className="dashboard-inline-note" role="status">Choose both dates to load the custom reporting period.</p>
        )}
        {isCustomRangeInvalid && (
          <p className="dashboard-inline-error" role="alert">The start date must be on or before the end date.</p>
        )}
        {managerSummaryError && (
          <ErrorNotice title="The selected-period summary could not be loaded." onRetry={() => summaryQuery.refetch()} />
        )}

        <section className="dashboard-section" aria-labelledby="dashboard-metrics-heading">
          <div className="dashboard-section-heading">
            <div>
              <h2 id="dashboard-metrics-heading">Business performance</h2>
              <p>{isManager ? dateRangeText : 'Today and current-month figures'}</p>
            </div>
          </div>
          {dashboardQuery.isLoading || (isManager && validRange && summaryQuery?.isLoading) ? (
            <MetricSkeleton />
          ) : (
            <div className="dashboard-kpi-grid">
              <KpiCard
                icon={<CircleDollarSign size={19} />}
                label="Today's Revenue"
                value={currencyFormat(todayRevenue)}
                sub={todayCount === null ? 'Today' : `${todayCount} invoices today`}
                color="gold"
                className="dashboard-kpi"
              />
              <KpiCard
                icon={<ShoppingBag size={19} />}
                label={periodRevenueTitle}
                value={currencyFormat(selectedRevenue)}
                sub={isManager
                  ? summaryMetricSub
                  : 'Current month'}
                color="gray"
                className="dashboard-kpi"
              />
              <KpiCard
                icon={<TrendingUp size={19} />}
                label="Net Profit"
                value="Unavailable"
                sub="Current backend figure excludes cost of goods sold"
                color="gray"
                className="dashboard-kpi dashboard-kpi-unavailable"
              />
              <KpiCard
                icon={<Wallet size={19} />}
                label={`Total Expenses · ${rangeLabel(range)}`}
                value={isManager ? currencyFormat(selectedExpenses) : 'Unavailable'}
                sub={isManager ? 'Recorded expenses in selected period' : 'Not available for this role'}
                color="gray"
                className="dashboard-kpi"
              />
            </div>
          )}
          {isManager && (
            <p className="dashboard-financial-note">
              Figures use the system currency display setting. Historical invoices do not include a stored currency or exchange-rate snapshot.
            </p>
          )}
        </section>

        <section className="dashboard-section" aria-labelledby="dashboard-sales-heading">
          <Card className="dashboard-panel">
            <CardHeader
              title="Sales performance"
              subtitle={isManager
                ? `${dateRangeText} · revenue from recorded invoices`
                : 'Monthly revenue · last 6 months'}
              icon={<BarChart3 size={18} />}
              action={isManager && (
                <div className="dashboard-segmented-control" role="group" aria-label="Sales chart interval">
                  {CHART_OPTIONS.map(option => (
                    <button
                      type="button"
                      key={option.value}
                      className={chartView === option.value ? 'is-selected' : ''}
                      aria-pressed={chartView === option.value}
                      onClick={() => setChartView(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            />
            {chartError ? (
              <ErrorNotice
                title="Sales trend data could not be loaded."
                onRetry={() => (chartView === 'monthly' ? monthlyQuery.refetch() : dailyQuery.refetch())}
              />
            ) : chartLoading ? (
              <div className="dashboard-chart-skeleton"><Skeleton variant="card" className="h-56" /></div>
            ) : chartData.length === 0 ? (
              <EmptyState
                icon={<BarChart3 size={22} />}
                title="No sales in this chart window"
                description={chartView === 'monthly'
                  ? 'No monthly revenue records are available for this period.'
                  : 'The existing daily sales endpoint covers the most recent 30 days.'}
                className="dashboard-empty"
              />
            ) : (
              <div className="dashboard-chart" role="img" aria-label={`${effectiveChartView} revenue chart in ${currency}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 2, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dashboardRevenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c5a46d" stopOpacity={0.24} />
                        <stop offset="95%" stopColor="#c5a46d" stopOpacity={0.015} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#eeeae2" strokeDasharray="3 5" vertical={false} />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      minTickGap={20}
                      tick={{ fill: '#77736b', fontSize: 11 }}
                    />
                    <YAxis
                      width={64}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#77736b', fontSize: 10 }}
                      tickFormatter={value => {
                        const numeric = safeNumber(value) ?? 0;
                        return numeric >= 1000 ? `${currency} ${(numeric / 1000).toFixed(0)}k` : `${currency} ${numeric}`;
                      }}
                    />
                    <Tooltip
                      formatter={value => [currencyFormat(safeNumber(value)), 'Revenue']}
                      labelStyle={{ color: '#252525', fontWeight: 600 }}
                      contentStyle={{ border: '1px solid #eae7e0', borderRadius: 8, boxShadow: '0 4px 16px rgb(37 37 37 / 0.08)' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke="#9d7d48"
                      strokeWidth={2}
                      fill="url(#dashboardRevenueFill)"
                      activeDot={{ r: 4, strokeWidth: 0, fill: '#9d7d48' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {isManager && (chartView !== 'monthly') && (
              <p className="dashboard-chart-footnote">Daily and weekly views use the latest 30 days returned by the existing reports API.</p>
            )}
          </Card>
        </section>

        <div className="dashboard-overview-grid">
          <section className="dashboard-section" aria-labelledby="dashboard-inventory-heading">
            <Card className="dashboard-panel">
              <CardHeader
                title="Inventory overview"
                subtitle="Current catalogue and stock alerts"
                icon={<Package size={18} />}
                action={<Link className="dashboard-text-link" to="/products">Products <ArrowRight size={14} /></Link>}
              />
              {isManager && inventoryQuery?.isError ? (
                <ErrorNotice title="Inventory overview could not be loaded." onRetry={() => inventoryQuery.refetch()} />
              ) : isManager && inventoryQuery?.isLoading ? (
                <div className="dashboard-list-skeleton"><Skeleton variant="card" className="h-24" /></div>
              ) : (
                <>
                  <div className="dashboard-inventory-count">
                    <span className="dashboard-inventory-icon"><Package size={19} /></span>
                    <span><strong>{safeNumber(inventory?.totalProducts ?? stats.totalProducts) ?? '—'}</strong><small>Total products</small></span>
                  </div>
                  {isManager ? (
                    <div className="dashboard-stock-groups">
                      <div>
                        <h3><AlertTriangle size={15} /> Low stock <span>Up to 20 shown</span></h3>
                        {lowStock.length ? (
                          <ul>{lowStock.slice(0, 20).map(product => (
                            <li key={product._id}>
                              <Link to={`/products?search=${encodeURIComponent(product.name || '')}`}>
                                <span>{product.name || 'Unnamed product'}</span>
                                <span>{product.quantity ?? '—'} left</span>
                              </Link>
                            </li>
                          ))}</ul>
                        ) : <p className="dashboard-muted">No low-stock products returned.</p>}
                      </div>
                      <div>
                        <h3><XCircle size={15} /> Out of stock <span>Up to 20 shown</span></h3>
                        {outOfStock.length ? (
                          <ul>{outOfStock.slice(0, 20).map(product => (
                            <li key={product._id}>
                              <Link to={`/products?search=${encodeURIComponent(product.name || '')}`}>
                                <span>{product.name || 'Unnamed product'}</span>
                                <span>0 left</span>
                              </Link>
                            </li>
                          ))}</ul>
                        ) : <p className="dashboard-muted">No out-of-stock products returned.</p>}
                      </div>
                    </div>
                  ) : (
                    <div className="dashboard-stock-groups">
                      <div>
                        <h3><AlertTriangle size={15} /> Low-stock alerts <span>Up to 8 shown</span></h3>
                        {lowStock.length ? (
                          <ul>{lowStock.slice(0, 8).map(product => (
                            <li key={product._id}>
                              <Link to={`/products?search=${encodeURIComponent(product.name || '')}`}>
                                <span>{product.name || 'Unnamed product'}</span>
                                <span>{product.quantity ?? '—'} left</span>
                              </Link>
                            </li>
                          ))}</ul>
                        ) : <p className="dashboard-muted">No low-stock alerts returned.</p>}
                      </div>
                      <p className="dashboard-muted">Out-of-stock totals and inventory activity are not available in the staff dashboard response.</p>
                    </div>
                  )}
                  {isManager && <p className="dashboard-chart-footnote">The inventory endpoint caps each alert list at 20; complete alert totals are not provided.</p>}
                </>
              )}
            </Card>
          </section>

          <section className="dashboard-section" aria-labelledby="dashboard-cashbook-heading">
            <Card className="dashboard-panel">
              <CardHeader
                title="Today’s cashbook"
                subtitle={cashbook?.date ? dateLabel(cashbook.date, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Daily cash position'}
                icon={<Wallet size={18} />}
                action={<Link className="dashboard-text-link" to="/cashbook">Open cashbook <ArrowRight size={14} /></Link>}
              />
              {!isManager ? (
                <EmptyState
                  icon={<Wallet size={20} />}
                  title="Cashbook access restricted"
                  description="The cashbook is available to authorized managers and administrators."
                  className="dashboard-empty dashboard-empty-compact"
                />
              ) : cashbookQuery?.isError || closingsQuery?.isError ? (
                <ErrorNotice title="Today’s cashbook could not be loaded." onRetry={() => {
                  cashbookQuery.refetch();
                  closingsQuery.refetch();
                }} />
              ) : cashbookQuery?.isLoading || closingsQuery?.isLoading ? (
                <div className="dashboard-list-skeleton"><Skeleton variant="card" className="h-24" /></div>
              ) : !cashbook ? (
                <div className="dashboard-cashbook-empty">
                  <p className="dashboard-muted">No cashbook record is open for today. Opening it starts the daily cash record.</p>
                  {openCashbookMutation.isError && (
                    <ErrorNotice
                      title={openCashbookMutation.error?.response?.data?.message || 'Today’s cashbook could not be opened.'}
                      onRetry={() => openCashbookMutation.mutate()}
                    />
                  )}
                  {cashbookOpenMessage && <p className="dashboard-inline-note" role="status">{cashbookOpenMessage}</p>}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={Wallet}
                    loading={openCashbookMutation.isPending}
                    onClick={() => openCashbookMutation.mutate()}
                  >
                    Open today’s cashbook
                  </Button>
                </div>
              ) : (
                <>
                  <dl className="dashboard-cashbook-grid">
                    <div><dt>Opening balance</dt><dd>{currencyFormat(safeNumber(cashbook.openingCash))}</dd></div>
                    <div><dt>Cash received from sales</dt><dd>{currencyFormat(safeNumber(cashbook.livesCashSales))}</dd></div>
                    <div><dt>Expenses</dt><dd>{currencyFormat(safeNumber(cashbook.liveExpenses))}</dd></div>
                    <div><dt>Expected closing</dt><dd>{currencyFormat(expectedCash)}</dd></div>
                    <div><dt>Actual closing</dt><dd>{currencyFormat(actualCash)}</dd></div>
                    <div>
                      <dt>{cashDifference === null ? 'Difference' : cashDifference < 0 ? 'Shortage' : cashDifference > 0 ? 'Excess' : 'Difference'}</dt>
                      <dd>{cashDifference === null ? '—' : currencyFormat(Math.abs(cashDifference))}</dd>
                    </div>
                  </dl>
                  {cashbookOpenMessage && <p className="dashboard-inline-note" role="status">{cashbookOpenMessage}</p>}
                  <div className="dashboard-cashbook-status">
                    {closing
                      ? <span className={`dashboard-status ${statusClass(closing.status)}`}>{formatStatus(closing.status)}</span>
                      : <span className={`dashboard-status ${cashbook.isClosed ? 'is-positive' : 'is-pending'}`}>{cashbook.isClosed ? 'Closed' : 'Open'}</span>}
                    {cashDifference !== null && (
                      <span className={cashDifference < 0 ? 'dashboard-text-negative' : cashDifference > 0 ? 'dashboard-text-positive' : ''}>
                        {cashDifference === 0 ? 'Balanced' : cashDifference < 0 ? 'Shortage' : 'Excess'}
                      </span>
                    )}
                  </div>
                  <p className="dashboard-chart-footnote">Expected cash follows the backend closing formula: opening cash + cash sales − expenses.</p>
                </>
              )}
            </Card>
          </section>
        </div>

        <section className="dashboard-section" aria-labelledby="dashboard-recent-sales-heading">
          <Card className="dashboard-panel">
            <CardHeader
              title="Recent sales"
              subtitle="Latest invoices recorded"
              icon={<ReceiptText size={18} />}
              action={<Link className="dashboard-text-link" to={latestSalesUrl}>{salesLinkLabel} <ArrowRight size={14} /></Link>}
            />
            {dashboardQuery.isLoading ? (
              <div className="dashboard-list-skeleton"><Skeleton variant="card" className="h-56" /></div>
            ) : recentInvoices.length === 0 ? (
              <EmptyState
                icon={<ReceiptText size={20} />}
                title="No recent invoices"
                description="Completed sales will appear here when recorded."
                className="dashboard-empty dashboard-empty-compact"
              />
            ) : (
              <div className="dashboard-sales-list">
                {recentInvoices.slice(0, 5).map(invoice => {
                  const paymentStatus = invoice.paymentStatus;
                  return (
                    <article className="dashboard-sale-row" key={invoice._id}>
                      <div className="dashboard-sale-primary">
                        <span className="dashboard-sale-icon"><ReceiptText size={17} /></span>
                        <div className="dashboard-sale-invoice">
                          <strong>{invoice.invoiceNumber || 'Invoice'}</strong>
                          <span><Clock3 size={13} /> {invoice.date ? new Date(invoice.date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Date unavailable'}</span>
                        </div>
                      </div>
                      <div className="dashboard-sale-detail">
                        <span className="dashboard-sale-label">Customer</span>
                        <span>{invoice.customer?.name || invoice.customerName || 'Walk-in customer'}</span>
                      </div>
                      <div className="dashboard-sale-detail">
                        <span className="dashboard-sale-label">Payment</span>
                        <span><CreditCard size={13} /> {invoice.paymentMethod || 'Not recorded'}</span>
                      </div>
                      <span className={`dashboard-status ${statusClass(paymentStatus)}`}>{formatStatus(paymentStatus)}</span>
                      <strong className="dashboard-sale-amount">{currencyFormat(safeNumber(invoice.grandTotal))}</strong>
                    </article>
                  );
                })}
              </div>
            )}
          </Card>
        </section>

        {isManager && (
          <section className="dashboard-section" aria-labelledby="dashboard-insights-heading">
            <Card className="dashboard-panel">
              <CardHeader
                title="Sales insights"
                subtitle={`Recorded sales · ${dateRangeText}`}
                icon={<TrendingUp size={18} />}
              />
              {summaryQuery?.isError ? (
                <ErrorNotice title="Sales insights could not be loaded." onRetry={() => summaryQuery.refetch()} />
              ) : summaryQuery?.isLoading ? (
                <div className="dashboard-insights-skeleton">
                  <Skeleton variant="card" className="h-32" />
                  <Skeleton variant="card" className="h-32" />
                </div>
              ) : summary ? (
                <div className="dashboard-insights-grid">
                  <div>
                    <h3><ShoppingBag size={15} /> Best-selling products</h3>
                    {Array.isArray(summary.topProducts) && summary.topProducts.length ? (
                      <ol className="dashboard-ranking-list">
                        {summary.topProducts.slice(0, 5).map((product, index) => (
                          <li key={product._id || `${product.name}-${index}`}>
                            <span className="dashboard-ranking-index">{index + 1}</span>
                            <span className="dashboard-ranking-name">{product.name || 'Product'}</span>
                            <span className="dashboard-ranking-value">{product.qty ?? '—'} sold</span>
                          </li>
                        ))}
                      </ol>
                    ) : <p className="dashboard-muted">No product sales returned for this period.</p>}
                  </div>
                  <div>
                    <h3><CreditCard size={15} /> Sales by payment method</h3>
                    {Array.isArray(summary.byPayment) && summary.byPayment.length ? (
                      <ul className="dashboard-payment-list">
                        {summary.byPayment.map(payment => (
                          <li key={payment._id || 'unspecified'}>
                            <span>{payment._id || 'Unspecified'}</span>
                            <span>{safeNumber(payment.count) === null ? 'Count unavailable' : `${safeNumber(payment.count)} sales`}</span>
                            <strong>{currencyFormat(safeNumber(payment.total))}</strong>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="dashboard-muted">No payment breakdown returned for this period.</p>}
                  </div>
                </div>
              ) : (
                <p className="dashboard-muted">Sales insights are unavailable until both reporting dates are selected.</p>
              )}
            </Card>
          </section>
        )}

        {!isManager && (
          <p className="dashboard-role-note">
            {safeNumber(stats.totalProducts) !== null
              ? `${stats.totalProducts} products in the catalogue.`
              : 'Catalogue totals are unavailable.'}
            {' '}Detailed reporting and cashbook information require manager access.
          </p>
        )}
      </div>
    </div>
  );
}
