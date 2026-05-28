// src/pages/ExpensesPage.jsx

import { useState }                          from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm }                           from 'react-hook-form';
import { motion, AnimatePresence }           from 'framer-motion';
import toast                                 from 'react-hot-toast';
import api                                   from '../services/api';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import CardBody from '../components/ui/CardBody';
import Badge from '../components/ui/Badge';
import { Plus, Trash2, X, Wallet, TrendingDown } from 'lucide-react';

const CATEGORIES = ['Rent','Transport','Salaries','Electricity','Stock Purchase','Marketing','Maintenance','Other'];

const CAT_COLORS = {
  Rent:            'bg-purple-100 text-purple-700',
  Transport:       'bg-blue-100 text-blue-700',
  Salaries:        'bg-emerald-100 text-emerald-700',
  Electricity:     'bg-yellow-100 text-yellow-700',
  'Stock Purchase':'bg-orange-100 text-orange-700',
  Marketing:       'bg-pink-100 text-pink-700',
  Maintenance:     'bg-gray-100 text-gray-600',
  Other:           'bg-slate-100 text-slate-600',
};

export default function ExpensesPage() {
  const [showForm,  setShowForm]  = useState(false);
  const [category,  setCategory]  = useState('All');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', category],
    queryFn:  async () => {
      const params = category !== 'All' ? `?category=${category}` : '';
      const { data } = await api.get(`/expenses${params}`);
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/expenses/${id}`),
    onSuccess:  () => { queryClient.invalidateQueries(['expenses']); toast.success('Expense deleted.'); },
    onError:    (e) => toast.error(e?.response?.data?.message || 'Delete failed.'),
  });

  const expenses = data?.data  || [];
  const total    = data?.total || 0;

  // Build category breakdown for mini chart
  const catBreakdown = CATEGORIES.map(cat => ({
    cat,
    amount: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0)
  })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);

  return (
    <div className="p-4 space-y-5">

      <PageHeader
        title="Expenses"
        sub="Business costs tracker"
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5"
          >
            <Plus size={16} /> Add
          </Button>
        }
      />

      {/* Total card */}
      <Card className="border-l-4 border-l-red-500">
        <CardBody className="p-5 flex items-center gap-4">
          <div className="w-14 h-14 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
            <TrendingDown size={24} className="text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-red-600 font-semibold uppercase tracking-wide">Total Expenses</p>
            <p className="text-3xl font-bold text-red-700">${total.toFixed(2)}</p>
          </div>
        </CardBody>
      </Card>

      {/* Category breakdown */}
      {catBreakdown.length > 0 && (
        <Card>
          <CardBody className="p-5">
            <p className="text-xs font-semibold text-gray-600 uppercase mb-4 tracking-wide">Breakdown by Category</p>
            <div className="space-y-3">
              {catBreakdown.map(({ cat, amount }) => {
                const pct = total > 0 ? (amount / total) * 100 : 0;
                return (
                  <div key={cat}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-gray-700">{cat}</span>
                      <span className="text-xs font-medium text-gray-600">${amount.toFixed(2)} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.1, duration: 0.6 }}
                        className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {['All', ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
              category === cat
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Expense list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16">
          <Wallet size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-500">No expenses recorded</p>
          <p className="text-xs text-gray-400 mt-1">Add your first expense to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map((e) => (
            <motion.div key={e._id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <CardBody className="p-4 flex items-center gap-3">
                  <Badge variant="secondary" className={`shrink-0 ${CAT_COLORS[e.category] || 'bg-gray-100 text-gray-600'}`}>
                    {e.category}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{e.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{new Date(e.date).toLocaleDateString()}</p>
                  </div>
                  <p className="font-bold text-red-600 shrink-0 text-right">${e.amount.toFixed(2)}</p>
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this expense?')) deleteMutation.mutate(e._id);
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg transition disabled:opacity-50 shrink-0"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 size={16} />
                  </button>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <div className="h-4" />

      <AnimatePresence>
        {showForm && (
          <AddExpenseSheet
            onClose={() => setShowForm(false)}
            onSaved={() => { queryClient.invalidateQueries(['expenses']); setShowForm(false); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AddExpenseSheet({ onClose, onSaved }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { date: new Date().toISOString().split('T')[0] }
  });

  const onSubmit = async (data) => {
    try {
      await api.post('/expenses', data);
      toast.success('Expense recorded.');
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed.');
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50"
      >

        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="font-bold text-lg text-gray-900">Add Expense</h2>
          <button
            onClick={onClose}
            className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Title *</label>
            <input
              {...register('title', { required: 'Title is required' })}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              placeholder="e.g. Monthly Rent"
            />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Amount ($) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                {...register('amount', { required: 'Amount required', valueAsNumber: true })}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                placeholder="0.00"
              />
              {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Date</label>
              <input
                type="date"
                {...register('date')}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Category *</label>
            <select
              {...register('category', { required: 'Category required' })}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            >
              <option value="">— Select —</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Description</label>
            <textarea
              {...register('description')}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition resize-none"
              placeholder="Optional notes…"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting && (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            )}
            Record Expense
          </Button>
        </form>
      </motion.div>
    </>
  );
}
