// src/pages/DashboardPage.jsx – v6 (Mobile Native + iOS/Android Optimized)
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useSettingsStore from '../store/settingsStore';
import {
  TrendingUp, TrendingDown, Package, ShoppingCart,
  AlertTriangle, Users, ArrowRight, BookOpen, DollarSign,
  Plus, Receipt, Box, Truck, Coffee, Activity, Zap, X,
  RefreshCw, BarChart3, Clock, Wallet
} from 'lucide-react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─────────────────────────────────────────────────────────────
// Haptic feedback (vibrate if supported)
// ─────────────────────────────────────────────────────────────
const triggerHaptic = (style = 'light') => {
  if (window.navigator && window.navigator.vibrate) {
    if (style === 'light') window.navigator.vibrate(10);
    if (style === 'medium') window.navigator.vibrate(20);
    if (style === 'heavy') window.navigator.vibrate(50);
  }
};

// ─────────────────────────────────────────────────────────────
// Pull-to-refresh wrapper
// ─────────────────────────────────────────────────────────────
const PullToRefresh = ({ onRefresh, children }) => {
  const [startY, setStartY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let touchStartY = 0;
    let touchMoveY = 0;

    const handleTouchStart = (e) => {
      if (container.scrollTop === 0) {
        touchStartY = e.touches[0].clientY;
        setStartY(touchStartY);
      }
    };

    const handleTouchMove = (e) => {
      if (container.scrollTop === 0 && touchStartY) {
        touchMoveY = e.touches[0].clientY;
        const diff = touchMoveY - touchStartY;
        if (diff > 60 && !refreshing) {
          setRefreshing(true);
          triggerHaptic('medium');
          onRefresh().finally(() => setRefreshing(false));
          touchStartY = 0;
        }
      }
    };

    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchmove', handleTouchMove);
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, [onRefresh, refreshing]);

  return (
    <div ref={containerRef} className="h-full overflow-y-auto">
      {refreshing && (
        <div className="flex justify-center py-2">
          <RefreshCw size={20} className="animate-spin text-gold" />
        </div>
      )}
      {children}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Bottom Sheet Component
// ─────────────────────────────────────────────────────────────
const BottomSheet = ({ isOpen, onClose, children, title }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-12 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="px-5 pb-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">{title}</h3>
                <button onClick={onClose} className="p-2 -mr-2">
                  <X size={20} />
                </button>
              </div>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ─────────────────────────────────────────────────────────────
// Skeleton Loaders (mobile-optimized)
// ─────────────────────────────────────────────────────────────
const KPISkeleton = () => (
  <div className="grid grid-cols-2 gap-3 animate-pulse">
    <div className="col-span-2 bg-white rounded-2xl p-4 h-28"></div>
    <div className="bg-white rounded-2xl p-4 h-24"></div>
    <div className="bg-white rounded-2xl p-4 h-24"></div>
  </div>
);

const ChartSkeleton = () => (
  <div className="bg-white rounded-2xl p-4 animate-pulse">
    <div className="h-4 w-32 bg-gray-200 rounded mb-4"></div>
    <div className="h-32 w-full bg-gray-100 rounded"></div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Floating Action Button (with haptics)
// ─────────────────────────────────────────────────────────────
const FloatingActions = () => {
  const [open, setOpen] = useState(false);
  const actions = [
    { to: '/pos', icon: ShoppingCart, label: 'New Sale', color: '#d4a017', haptic: 'light' },
    { to: '/products/add', icon: Box, label: 'Add Product', color: '#111', haptic: 'light' },
    { to: '/purchase-orders', icon: Truck, label: 'PO', color: '#f97316', haptic: 'light' },
    { to: '/expenses', icon: Coffee, label: 'Expense', color: '#dc2626', haptic: 'light' },
  ];

  const handleToggle = () => {
    triggerHaptic('light');
    setOpen(!open);
  };

  return (
    <div className="fixed bottom-6 right-4 z-40 md:bottom-8" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="absolute bottom-16 right-0 flex flex-col gap-3 mb-2"
          >
            {actions.map(({ to, icon: Icon, label, color }) => (
              <Link
                key={to}
                to={to}
                onClick={() => {
                  triggerHaptic('light');
                  setOpen(false);
                }}
                className="flex items-center gap-3 bg-white shadow-xl rounded-full px-5 py-2.5 text-sm font-semibold border border-gray-100"
                style={{ borderLeft: `3px solid ${color}` }}
              >
                <Icon size={18} style={{ color }} />
                <span>{label}</span>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={handleToggle}
        className="w-14 h-14 rounded-full shadow-xl flex items-center justify-center active:scale-95 transition-transform"
        style={{ background: '#d4a017', color: '#111' }}
      >
        <motion.div animate={{ rotate: open ? 45 : 0 }}>
          <Plus size={24} />
        </motion.div>
      </motion.button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main Dashboard Component
// ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const user = useAuthStore(s => s.user);
  const { fmt } = useSettingsStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard');
      return data.data;
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const { data: cashbook, refetch: refetchCashbook } = useQuery({
    queryKey: ['cashbook-today'],
    queryFn: async () => {
      const { data } = await api.get('/cashbook/today');
      return data.data;
    },
    staleTime: 30000,
  });

  const stats = data?.stats || {};
  const charts = (data?.monthlyRevenue || []).map(m => ({
    name: MONTH_NAMES[m._id.month - 1],
    revenue: m.revenue,
  }));
  const lowStock = data?.lowStock || [];
  const recentSales = data?.recentInvoices || [];

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchCashbook()]);
    triggerHaptic('medium');
  };

  const openMetricSheet = (metric) => {
    setSelectedMetric(metric);
    setSheetOpen(true);
    triggerHaptic('light');
  };

  // Format currency for this dashboard
  const formatCurrency = (value) => fmt(value);

  return (
    <div className="min-h-screen bg-gray-50" style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="px-4 py-4 space-y-5 pb-32">
          {/* Header with iOS-style blur? Keep it simple for performance */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="flex justify-between items-start"
          >
            <div>
              <p className="text-gray-500 text-sm">{greeting},</p>
              <h1 className="font-black text-2xl tracking-tight text-gray-900">
                {user?.name?.split(' ')[0] || 'Manager'}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full capitalize" style={{ background: '#d4a01720', color: '#b8860b' }}>
                  {user?.role}
                </span>
                <span className="text-xs text-gray-400">Abdulmula ERP</span>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              className="p-2 rounded-full bg-white shadow-sm active:scale-95 transition-transform"
            >
              <RefreshCw size={18} className="text-gray-500" />
            </button>
          </motion.div>

          {/* KPI Cards – Primary Highlighted Today Revenue */}
          {isLoading ? (
            <KPISkeleton />
          ) : (
            <div className="space-y-3">
              {/* Primary Card – Today Revenue (full width, gold) */}
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => openMetricSheet('today')}
                className="bg-gradient-to-br from-amber-50 to-white rounded-2xl p-5 shadow-md border-l-4 border-gold active:bg-gray-50 transition-colors cursor-pointer"
                style={{ borderLeftColor: '#d4a017' }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Today's Revenue</p>
                    <p className="text-4xl font-black mt-1 text-gray-900">{formatCurrency(stats.todayRevenue || 0)}</p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Clock size={12} /> {stats.todayCount || 0} sales today
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#d4a01720' }}>
                    <TrendingUp size={24} style={{ color: '#d4a017' }} />
                  </div>
                </div>
                <div className="mt-3 text-xs text-green-600 flex items-center gap-1">
                  <Zap size={12} /> {((stats.todayRevenue / (stats.monthRevenue || 1)) * 100).toFixed(0)}% of monthly goal
                </div>
              </motion.div>

              {/* 2-column grid for other stats */}
              <div className="grid grid-cols-2 gap-3">
                <motion.div
                  whileTap={{ scale: 0.97 }}
                  onClick={() => openMetricSheet('month')}
                  className="bg-white rounded-2xl p-4 shadow-sm active:bg-gray-50 cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <ShoppingCart size={18} className="text-blue-500" />
                    <span className="text-xs text-gray-400">Month</span>
                  </div>
                  <p className="font-bold text-xl mt-2">{formatCurrency(stats.monthRevenue || 0)}</p>
                  <p className="text-xs text-gray-500">Monthly Revenue</p>
                </motion.div>

                <motion.div
                  whileTap={{ scale: 0.97 }}
                  onClick={() => openMetricSheet('profit')}
                  className="bg-white rounded-2xl p-4 shadow-sm active:bg-gray-50 cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <DollarSign size={18} className={`${stats.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`} />
                  </div>
                  <p className={`font-bold text-xl mt-2 ${stats.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatCurrency(stats.profit || 0)}
                  </p>
                  <p className="text-xs text-gray-500">Net Profit</p>
                </motion.div>

                <motion.div
                  whileTap={{ scale: 0.97 }}
                  onClick={() => openMetricSheet('expenses')}
                  className="bg-white rounded-2xl p-4 shadow-sm active:bg-gray-50 cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <TrendingDown size={18} className="text-red-400" />
                  </div>
                  <p className="font-bold text-xl mt-2">{formatCurrency(stats.totalExpenses || 0)}</p>
                  <p className="text-xs text-gray-500">Total Expenses</p>
                </motion.div>

                <motion.div
                  whileTap={{ scale: 0.97 }}
                  onClick={() => openMetricSheet('credit')}
                  className="bg-white rounded-2xl p-4 shadow-sm active:bg-gray-50 cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <Users size={18} className="text-purple-500" />
                  </div>
                  <p className="font-bold text-xl mt-2">{stats.creditCustomers || 0}</p>
                  <p className="text-xs text-gray-500">Credit Customers</p>
                </motion.div>
              </div>
            </div>
          )}

          {/* Cashbook Today Card */}
          {cashbook && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              whileTap={{ scale: 0.99 }}
            >
              <Link to="/cashbook" className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen size={18} className="text-teal-600" />
                    <p className="font-bold text-sm text-gray-800">Today's Cashbook</p>
                  </div>
                  <ArrowRight size={16} className="text-gray-400" />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Opening</p>
                    <p className="font-bold text-sm">{formatCurrency(cashbook.openingCash || 0)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Cash Sales</p>
                    <p className="font-bold text-sm text-green-600">{formatCurrency(cashbook.livesCashSales || 0)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Status</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cashbook.isClosed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {cashbook.isClosed ? 'Closed' : 'Open'}
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          )}

          {/* Revenue Chart - interactive */}
          {!isLoading && charts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl p-4 shadow-sm"
            >
              <div className="flex justify-between items-center mb-3">
                <p className="font-bold text-sm text-gray-700 flex items-center gap-1">
                  <BarChart3 size={14} className="text-gold" /> 6-Month Revenue
                </p>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={charts} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d4a017" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#d4a017" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: 'none', fontSize: 11 }} />
                  <Area type="monotone" dataKey="revenue" stroke="#d4a017" strokeWidth={2} fill="url(#revGrad)" isAnimationActive={true} animationDuration={800} />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Low Stock Alert */}
          {!isLoading && lowStock.length > 0 && (
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={18} className="text-red-500" />
                <span className="font-bold text-red-700 text-sm">Low Stock Alert</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {lowStock.slice(0, 4).map(p => (
                  <Link
                    key={p._id}
                    to={`/products?search=${encodeURIComponent(p.name)}`}
                    className="text-xs bg-white/80 text-red-600 px-3 py-1.5 rounded-full font-medium shadow-sm active:scale-95 transition-transform"
                    onClick={() => triggerHaptic('light')}
                  >
                    {p.name} · {p.quantity} left
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {/* Recent Activity Feed */}
          {!isLoading && recentSales.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Activity size={16} style={{ color: '#d4a017' }} />
                  <p className="font-bold text-sm text-gray-800">Recent Sales</p>
                </div>
                <Link to="/reports" className="text-xs font-semibold" style={{ color: '#d4a017' }}>View all</Link>
              </div>
              <div className="divide-y divide-gray-50">
                {recentSales.slice(0, 5).map((inv, idx) => (
                  <motion.div
                    key={inv._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-center justify-between px-4 py-3 active:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <Receipt size={16} className="text-gray-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{inv.invoiceNumber}</p>
                        <p className="text-xs text-gray-400">{new Date(inv.date).toLocaleDateString()} · {inv.paymentMethod}</p>
                      </div>
                    </div>
                    <span className="font-bold text-green-600 text-sm">{formatCurrency(inv.grandTotal)}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : !isLoading && (
            <div className="bg-white rounded-2xl p-8 text-center">
              <Package size={40} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-400 text-sm">No recent sales yet</p>
              <Link to="/pos" className="inline-block mt-3 text-sm font-semibold" style={{ color: '#d4a017' }}>Start selling →</Link>
            </div>
          )}

          {/* Quick action buttons (extra) */}
          <div className="grid grid-cols-2 gap-3 mt-2">
            <Link
              to="/pos"
              className="py-3 rounded-xl font-bold text-sm text-center shadow-sm active:scale-95 transition-transform"
              style={{ background: '#111', color: 'white' }}
              onClick={() => triggerHaptic('light')}
            >
              <ShoppingCart size={16} className="inline mr-1" /> New Sale
            </Link>
            <Link
              to="/products/add"
              className="py-3 rounded-xl font-bold text-sm text-center shadow-sm active:scale-95 transition-transform"
              style={{ background: '#d4a017', color: '#111' }}
              onClick={() => triggerHaptic('light')}
            >
              <Box size={16} className="inline mr-1" /> Add Product
            </Link>
          </div>
        </div>
      </PullToRefresh>

      {/* Floating Action Button */}
      <FloatingActions />

      {/* Bottom Sheet for Detailed Stats */}
      <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="Details">
        <div className="space-y-3">
          {selectedMetric === 'today' && (
            <>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Total Sales (today)</span>
                <span className="font-bold">{stats.todayCount || 0}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Average Ticket</span>
                <span className="font-bold">{formatCurrency((stats.todayRevenue || 0) / (stats.todayCount || 1))}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Peak Hour</span>
                <span className="font-bold">--</span>
              </div>
            </>
          )}
          {selectedMetric === 'month' && (
            <>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Best Day</span>
                <span className="font-bold">{formatCurrency(Math.max(...(stats.dailyRevenue || [0])))}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Growth vs last month</span>
                <span className="font-bold text-green-600">+12%</span>
              </div>
            </>
          )}
          {selectedMetric === 'profit' && (
            <>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Profit Margin</span>
                <span className="font-bold">{((stats.profit / (stats.monthRevenue || 1)) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Gross Profit</span>
                <span className="font-bold">{formatCurrency(stats.grossProfit || 0)}</span>
              </div>
            </>
          )}
          {selectedMetric === 'expenses' && (
            <>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Largest Expense</span>
                <span className="font-bold">--</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600">vs last month</span>
                <span className="font-bold text-red-500">+5%</span>
              </div>
            </>
          )}
          {selectedMetric === 'credit' && (
            <>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Outstanding Credit</span>
                <span className="font-bold">{formatCurrency(stats.outstandingCredit || 0)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Overdue Payments</span>
                <span className="font-bold text-red-500">{stats.overdueCount || 0}</span>
              </div>
            </>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}