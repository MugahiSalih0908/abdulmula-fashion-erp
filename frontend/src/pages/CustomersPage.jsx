// src/pages/CustomersPage.jsx – v3 with loyalty points and WhatsApp

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../services/api';
import useSettingsStore from '../store/settingsStore';
import PageHeader from '../components/ui/PageHeader';
import Sheet from '../components/ui/Sheet';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import CardBody from '../components/ui/CardBody';
import Badge from '../components/ui/Badge';
import {
  Plus, Search, Trash2, X, CreditCard, Phone,
  MapPin, MessageCircle, Star, ChevronRight, Users
} from 'lucide-react';

export default function CustomersPage() {
  const [search,    setSearch]    = useState('');
  const [showForm,  setShowForm]  = useState(false);
  const [selected,  setSelected]  = useState(null);
  const [payFor,    setPayFor]    = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const { fmt } = useSettingsStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn:  async () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const { data } = await api.get(`/customers${params}`);
      return data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/customers/${id}`),
    onSuccess:  () => { queryClient.invalidateQueries(['customers']); toast.success('Customer deleted.'); },
    onError:    (e) => toast.error(e?.response?.data?.message || 'Delete failed.'),
  });

  const payMutation = useMutation({
    mutationFn: ({ id, amount }) => api.post(`/customers/${id}/pay`, { amount }),
    onSuccess:  (res) => { queryClient.invalidateQueries(['customers']); toast.success(res.data.message); setPayFor(null); setPayAmount(''); },
    onError:    (e) => toast.error(e?.response?.data?.message || 'Payment failed.'),
  });

  const customers  = data || [];
  const creditTotal = customers.reduce((s, c) => s + c.creditBalance, 0);

  const openWhatsApp = (phone) => {
    if (!phone) { toast.error('No phone number on record.'); return; }
    window.open(`https://wa.me/${phone.replace(/\D/g,'')}`, '_blank');
  };

  return (
    <div className="p-4 space-y-5">
      <PageHeader
        title="Customers"
        sub={`${customers.length} registered`}
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

      {/* Credit summary */}
      {creditTotal > 0 && (
        <Card className="border-l-4 border-l-red-500">
          <CardBody className="p-4 flex items-center gap-3">
            <CreditCard size={24} className="text-red-500 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-gray-600 text-sm">Total Outstanding Credit</p>
              <p className="text-2xl font-bold text-red-600">{fmt(creditTotal)}</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition bg-white"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16">
          <Users size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-500">No customers yet</p>
          <p className="text-xs text-gray-400 mt-1">Add your first customer to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {customers.map((c) => (
            <motion.div key={c._id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <CardBody className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center font-bold shrink-0 text-sm text-white"
                        style={{ background: '#16a34a' }}
                      >
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                          {c.totalPurchases > 500 && (
                            <Star size={14} className="shrink-0 text-amber-500 fill-amber-500" title="VIP Customer" />
                          )}
                        </div>
                        {c.phone && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <Phone size={12} /> {c.phone}
                          </p>
                        )}
                        {c.address && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 truncate mt-0.5">
                            <MapPin size={12} /> {c.address}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      {c.phone && (
                        <button
                          onClick={() => openWhatsApp(c.phone)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                          title="Open WhatsApp"
                        >
                          <MessageCircle size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => setSelected(c)}
                        className="p-2 text-gray-400 hover:text-gray-700 rounded-lg transition"
                        title="View details"
                      >
                        <ChevronRight size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete "${c.name}"?`)) deleteMutation.mutate(c._id);
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg transition disabled:opacity-50"
                        disabled={deleteMutation.isPending}
                        title="Delete customer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Total purchases */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-600">
                      Total purchases: <span className="font-semibold">{fmt(c.totalPurchases || 0)}</span>
                    </p>
                    {c.creditBalance > 0 ? (
                      <Badge variant="danger" className="text-xs font-bold">
                        Owes {fmt(c.creditBalance)}
                      </Badge>
                    ) : (
                      <Badge variant="success" className="text-xs font-bold">
                        ✓ Clear
                      </Badge>
                    )}
                  </div>

                  {/* Pay credit inline */}
                  {c.creditBalance > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      {payFor?._id === c._id ? (
                        <div className="flex gap-2 items-center">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">$</span>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              max={c.creditBalance}
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              className="pl-7 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                              placeholder={c.creditBalance.toFixed(2)}
                              autoFocus
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() =>
                              payMutation.mutate({ id: c._id, amount: parseFloat(payAmount) })
                            }
                            disabled={!payAmount || payMutation.isPending}
                          >
                            Pay
                          </Button>
                          <button
                            onClick={() => {
                              setPayFor(null);
                              setPayAmount('');
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <Button
                          variant="secondary"
                          className="w-full text-emerald-700 border-emerald-200"
                          onClick={() => setPayFor(c)}
                        >
                          Record Payment
                        </Button>
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <div className="h-4" />

      <Sheet open={showForm} title="Add Customer" onClose={() => setShowForm(false)}>
        <AddCustomerForm
          onClose={() => setShowForm(false)}
          onSaved={() => { queryClient.invalidateQueries(['customers']); setShowForm(false); }}
        />
      </Sheet>

      <Sheet open={!!selected} title={selected?.name} subtitle={selected?.phone} onClose={() => setSelected(null)}>
        {selected && <CustomerDetail customer={selected} fmt={fmt} />}
      </Sheet>
    </div>
  );
}

function AddCustomerForm({ onClose, onSaved }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
  const onSubmit = async (data) => {
    try {
      await api.post('/customers', data);
      toast.success('Customer added.');
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed.');
    }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Full Name *</label>
        <input
          {...register('name', { required: 'Name required' })}
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          placeholder="e.g. Ali Hassan"
        />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Phone</label>
        <input
          {...register('phone')}
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          placeholder="+211 …"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Address</label>
        <input
          {...register('address')}
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          placeholder="e.g. Konyo-Konyo"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Notes</label>
        <textarea
          {...register('notes')}
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition resize-none"
        />
      </div>
      <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
        {isSubmitting && <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />}
        Add Customer
      </Button>
    </form>
  );
}

function CustomerDetail({ customer, fmt }) {
  return (
    <div className="px-5 py-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded-2xl p-3 text-center">
          <p className="font-black text-lg text-blue-600">{fmt(customer.totalPurchases||0)}</p>
          <p className="text-xs text-gray-500">Total Purchases</p>
        </div>
        <div className={`rounded-2xl p-3 text-center ${customer.creditBalance>0?'bg-red-50':'bg-green-50'}`}>
          <p className={`font-black text-lg ${customer.creditBalance>0?'text-red-500':'text-green-600'}`}>
            {fmt(customer.creditBalance||0)}
          </p>
          <p className="text-xs text-gray-500">Credit Balance</p>
        </div>
      </div>
      <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
        {customer.phone   && <div className="flex items-center gap-2 text-sm"><Phone size={14} className="text-gray-400"/><span>{customer.phone}</span></div>}
        {customer.email   && <div className="flex items-center gap-2 text-sm"><span className="text-gray-400 text-xs">Email:</span><span>{customer.email}</span></div>}
        {customer.address && <div className="flex items-center gap-2 text-sm"><MapPin size={14} className="text-gray-400"/><span>{customer.address}</span></div>}
        {customer.notes   && <div className="text-sm text-gray-500 italic">{customer.notes}</div>}
      </div>
      {customer.totalPurchases > 500 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <Star size={16} style={{color:'#d4a017'}}/>
          <span className="text-sm font-semibold text-amber-700">VIP Customer — high value shopper</span>
        </div>
      )}
    </div>
  );
}
