// src/pages/ExpensesPage.jsx

import { useState }                          from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm }                           from 'react-hook-form';
import { motion, AnimatePresence }           from 'framer-motion';
import toast                                 from 'react-hot-toast';
import api                                   from '../services/api';
import { Plus, Trash2, X, Wallet } from 'lucide-react';

const CATEGORIES = ['Rent','Transport','Salaries','Electricity','Stock Purchase','Marketing','Maintenance','Other'];

const CAT_COLORS = {
  Rent:            'bg-purple-100 text-purple-700',
  Transport:       'bg-blue-100 text-blue-700',
  Salaries:        'bg-green-100 text-green-700',
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
    <div className="p-4 space-y-4">

      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="font-black text-xl text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500">Business costs tracker</p>
        </div>
        <button onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 bg-brand text-white px-4 py-2.5 rounded-xl font-semibold text-sm">
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Total card */}
      <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
          <Wallet size={22} className="text-red-600" />
        </div>
        <div>
          <p className="text-xs text-red-600 font-semibold uppercase tracking-wide">Total Expenses</p>
          <p className="text-2xl font-black text-red-700">${total.toFixed(2)}</p>
        </div>
      </div>

      {/* Category breakdown */}
      {catBreakdown.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">By Category</p>
          <div className="space-y-2">
            {catBreakdown.map(({ cat, amount }) => {
              const pct = total > 0 ? (amount / total) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{cat}</span>
                    <span className="text-gray-500">${amount.toFixed(2)} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {['All', ...CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    category === cat ? 'bg-brand text-white' : 'bg-white text-gray-500 border border-gray-200'
                  }`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Expense list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded-2xl animate-pulse" />)}
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Wallet size={40} className="mx-auto mb-3 opacity-25" />
          <p className="font-semibold">No expenses recorded</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map(e => (
            <div key={e._id} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
              <span className={`text-xs font-semibold px-2 py-1 rounded-lg shrink-0 ${CAT_COLORS[e.category] || 'bg-gray-100 text-gray-600'}`}>
                {e.category}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{e.title}</p>
                <p className="text-xs text-gray-400">{new Date(e.date).toLocaleDateString()}</p>
              </div>
              <p className="font-black text-red-500 shrink-0">${e.amount.toFixed(2)}</p>
              <button onClick={() => { if (window.confirm('Delete this expense?')) deleteMutation.mutate(e._id); }}
                      className="p-1.5 text-gray-300 hover:text-red-400 shrink-0">
                <Trash2 size={15} />
              </button>
            </div>
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 26, stiffness: 300 }}
                  className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50">

        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b">
          <h2 className="font-bold text-lg">Add Expense</h2>
          <button onClick={onClose} className="p-1 bg-gray-100 rounded-full"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Title *</label>
            <input {...register('title', { required: 'Title is required' })}
                   className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold"
                   placeholder="e.g. Monthly Rent" />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Amount ($) *</label>
              <input type="number" step="0.01" min="0.01"
                     {...register('amount', { required: 'Amount required', valueAsNumber: true })}
                     className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold"
                     placeholder="0.00" />
              {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Date</label>
              <input type="date" {...register('date')}
                     className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Category *</label>
            <select {...register('category', { required: 'Category required' })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold">
              <option value="">— Select —</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Description</label>
            <textarea {...register('description')} rows={2}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold resize-none"
                      placeholder="Optional notes…" />
          </div>

          <button type="submit" disabled={isSubmitting}
                  className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold disabled:opacity-60 flex items-center justify-center gap-2">
            {isSubmitting && <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Record Expense
          </button>
        </form>
      </motion.div>
    </>
  );
}
