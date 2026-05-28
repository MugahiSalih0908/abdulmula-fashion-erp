// src/pages/SuppliersPage.jsx

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
    <div className="p-4 space-y-5">
      <PageHeader
        title="Suppliers"
        sub={`${suppliers.length} registered`}
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

      {totalDebt > 0 && (
        <Card className="border-l-4 border-l-orange-500">
          <CardBody className="p-5 flex items-center gap-4">
            <div className="w-14 h-14 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
              <Truck size={24} className="text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Total Supplier Debt</p>
              <p className="text-3xl font-bold text-orange-600">${totalDebt.toFixed(2)}</p>
            </div>
          </CardBody>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-lg animate-pulse" />)}
        </div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-16">
          <Truck size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-500">No suppliers yet</p>
          <p className="text-xs text-gray-400 mt-1">Add your first supplier to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suppliers.map(s => (
            <motion.div key={s._id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <CardBody className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{s.name}</p>
                      {s.company && <p className="text-xs text-gray-500 mt-0.5">{s.company}</p>}
                      {s.phone && (
                        <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                          <Phone size={12} /> {s.phone}
                        </p>
                      )}
                      {s.email && (
                        <p className="text-xs text-gray-600 flex items-center gap-1">
                          <Mail size={12} /> {s.email}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.debtBalance > 0 && (
                        <span className="text-sm font-bold text-orange-600">${s.debtBalance.toFixed(2)}</span>
                      )}
                      <button
                        onClick={() => { if (window.confirm(`Delete supplier "${s.name}"?`)) deleteMutation.mutate(s._id); }}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg transition disabled:opacity-50"
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
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
                  className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50">

        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="font-bold text-lg text-gray-900">Add Supplier</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Supplier Name *</label>
            <input {...register('name', { required: 'Name is required' })}
                   className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                   placeholder="e.g. Al-Nour Textiles" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Company</label>
            <input {...register('company')} className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" placeholder="Optional company name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Phone</label>
              <input {...register('phone')} className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" placeholder="+211…" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Email</label>
              <input type="email" {...register('email')} className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" placeholder="Optional" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Address</label>
            <input {...register('address')} className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" placeholder="Location" />
          </div>

          <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
            {isSubmitting && <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />}
            Add Supplier
          </Button>
        </form>
      </motion.div>
    </>
  );
}
