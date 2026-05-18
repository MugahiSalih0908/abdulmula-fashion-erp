// src/pages/SuppliersPage.jsx

import { useState }                          from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm }                           from 'react-hook-form';
import { motion, AnimatePresence }           from 'framer-motion';
import toast                                 from 'react-hot-toast';
import api                                   from '../services/api';
import { Plus, Trash2, X, Truck, Phone, Mail } from 'lucide-react';

export default function SuppliersPage() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn:  async () => { const { data } = await api.get('/suppliers'); return data.data; },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/suppliers/${id}`),
    onSuccess:  () => { queryClient.invalidateQueries(['suppliers']); toast.success('Supplier deleted.'); },
    onError:    (e) => toast.error(e?.response?.data?.message || 'Delete failed.'),
  });

  const suppliers   = data || [];
  const totalDebt   = suppliers.reduce((s, sup) => s + sup.debtBalance, 0);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="font-black text-xl text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500">{suppliers.length} registered</p>
        </div>
        <button onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 bg-brand text-white px-4 py-2.5 rounded-xl font-semibold text-sm">
          <Plus size={16} /> Add
        </button>
      </div>

      {totalDebt > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3">
          <Truck size={20} className="text-orange-600 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-orange-700 uppercase">Total Supplier Debt</p>
            <p className="text-2xl font-black text-orange-600">${totalDebt.toFixed(2)}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-2xl animate-pulse" />)}
        </div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Truck size={48} className="mx-auto mb-3 opacity-25" />
          <p className="font-semibold">No suppliers yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {suppliers.map(s => (
            <div key={s._id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-sm text-gray-900">{s.name}</p>
                  {s.company && <p className="text-xs text-gray-500">{s.company}</p>}
                  {s.phone && (
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                      <Phone size={11} /> {s.phone}
                    </p>
                  )}
                  {s.email && (
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Mail size={11} /> {s.email}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {s.debtBalance > 0 && (
                    <span className="text-sm font-black text-orange-600">${s.debtBalance.toFixed(2)}</span>
                  )}
                  <button onClick={() => { if (window.confirm(`Delete supplier "${s.name}"?`)) deleteMutation.mutate(s._id); }}
                          className="p-2 text-gray-300 hover:text-red-400">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="h-4" />

      <AnimatePresence>
        {showForm && (
          <AddSupplierSheet
            onClose={() => setShowForm(false)}
            onSaved={() => { queryClient.invalidateQueries(['suppliers']); setShowForm(false); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AddSupplierSheet({ onClose, onSaved }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async (data) => {
    try {
      await api.post('/suppliers', data);
      toast.success('Supplier added.');
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
          <h2 className="font-bold text-lg">Add Supplier</h2>
          <button onClick={onClose} className="p-1 bg-gray-100 rounded-full"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Supplier Name *</label>
            <input {...register('name', { required: 'Name is required' })}
                   className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold"
                   placeholder="e.g. Al-Nour Textiles" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Company</label>
            <input {...register('company')} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold" placeholder="Optional company name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Phone</label>
              <input {...register('phone')} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold" placeholder="+211…" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Email</label>
              <input type="email" {...register('email')} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold" placeholder="Optional" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Address</label>
            <input {...register('address')} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold" placeholder="Location" />
          </div>

          <button type="submit" disabled={isSubmitting}
                  className="w-full bg-brand text-white py-4 rounded-2xl font-bold disabled:opacity-60 flex items-center justify-center gap-2">
            {isSubmitting && <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Add Supplier
          </button>
        </form>
      </motion.div>
    </>
  );
}
