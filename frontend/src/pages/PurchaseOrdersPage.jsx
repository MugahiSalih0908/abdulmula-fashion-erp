// src/pages/PurchaseOrdersPage.jsx – purchase orders from suppliers

import { useState }                          from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray }            from 'react-hook-form';
import toast                                 from 'react-hot-toast';
import api                                   from '../services/api';
import PageHeader from '../components/ui/PageHeader';
import Sheet      from '../components/ui/Sheet';
import { Plus, Truck, ChevronRight, CheckCircle, DollarSign, X, Trash2 } from 'lucide-react';

const STATUS_COLORS = {
  draft:    'bg-gray-100 text-gray-600',
  ordered:  'bg-blue-100 text-blue-700',
  received: 'bg-green-100 text-green-700',
  partial:  'bg-amber-100 text-amber-700',
  paid:     'bg-emerald-100 text-emerald-700',
};

export default function PurchaseOrdersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [selected,   setSelected]   = useState(null);
  const [payFor,     setPayFor]     = useState(null);
  const [payAmt,     setPayAmt]     = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn:  async () => { const { data } = await api.get('/purchase-orders?limit=50'); return data.data; }
  });

  const receiveMutation = useMutation({
    mutationFn: (id) => api.patch(`/purchase-orders/${id}/receive`),
    onSuccess:  (res) => { queryClient.invalidateQueries(['purchase-orders']); queryClient.invalidateQueries(['products']); toast.success(res.data.message); setSelected(null); },
    onError:    (e)   => toast.error(e?.response?.data?.message || 'Failed.')
  });

  const payMutation = useMutation({
    mutationFn: ({ id, amount }) => api.patch(`/purchase-orders/${id}/pay`, { amount }),
    onSuccess:  (res) => { queryClient.invalidateQueries(['purchase-orders']); toast.success(res.data.message); setPayFor(null); setPayAmt(''); },
    onError:    (e)   => toast.error(e?.response?.data?.message || 'Payment failed.')
  });

  const orders = data || [];
  const totalDebt = orders.filter(o => o.status !== 'paid').reduce((s,o) => s + o.balanceDue, 0);

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="Purchase Orders"
        sub={`${orders.length} orders`}
        action={
          <button onClick={() => setShowCreate(true)}
                  className="flex items-center gap-1.5 text-black px-4 py-2.5 rounded-xl font-semibold text-sm"
                  style={{ background: '#d4a017' }}>
            <Plus size={16} /> New PO
          </button>
        }
      />

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
        <div className="space-y-2">{[...Array(4)].map((_,i) => <div key={i} className="h-20 bg-gray-200 rounded-2xl animate-pulse"/>)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Truck size={48} className="mx-auto mb-3 opacity-25"/>
          <p className="font-semibold">No purchase orders yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map(po => (
            <div key={po._id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm">{po.poNumber}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[po.status]}`}>
                      {po.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{po.supplierName}</p>
                  <p className="text-xs text-gray-400">{new Date(po.createdAt).toLocaleDateString()} · {po.items?.length} item(s)</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-base">${po.grandTotal.toFixed(2)}</p>
                  {po.balanceDue > 0 && <p className="text-xs text-red-500 font-semibold">Owes ${po.balanceDue.toFixed(2)}</p>}
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                {po.status === 'ordered' && (
                  <button onClick={() => receiveMutation.mutate(po._id)}
                          disabled={receiveMutation.isPending}
                          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                    <CheckCircle size={14}/> Receive Goods
                  </button>
                )}
                {po.balanceDue > 0 && po.status !== 'draft' && (
                  payFor?._id === po._id ? (
                    <div className="flex-1 flex gap-2">
                      <input type="number" min="0.01" step="0.01" max={po.balanceDue}
                             value={payAmt} onChange={e => setPayAmt(e.target.value)}
                             className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                             placeholder="Amount" autoFocus />
                      <button onClick={() => payMutation.mutate({ id: po._id, amount: parseFloat(payAmt) })}
                              disabled={!payAmt || payMutation.isPending}
                              className="px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-bold disabled:opacity-50">
                        Pay
                      </button>
                      <button onClick={() => setPayFor(null)} className="p-2 text-gray-400"><X size={14}/></button>
                    </div>
                  ) : (
                    <button onClick={() => setPayFor(po)}
                            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      <DollarSign size={14}/> Pay Supplier
                    </button>
                  )
                )}
                <button onClick={() => setSelected(po)} className="p-2 text-gray-400">
                  <ChevronRight size={16}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="h-4" />

      <CreatePOSheet open={showCreate} onClose={() => setShowCreate(false)}
                     onSaved={() => { queryClient.invalidateQueries(['purchase-orders']); setShowCreate(false); }} />

      <Sheet open={!!selected} title={selected?.poNumber} subtitle={selected?.supplierName}
             onClose={() => setSelected(null)}>
        {selected && (
          <div className="px-5 py-4 space-y-3">
            <div className="space-y-2">
              {selected.items?.map((item, i) => (
                <div key={i} className="flex justify-between items-center bg-gray-50 rounded-xl px-3 py-2.5">
                  <div>
                    <p className="font-semibold text-sm">{item.productName}</p>
                    <p className="text-xs text-gray-400">{item.quantity} × ${item.unitCost?.toFixed(2)}</p>
                  </div>
                  <p className="font-bold text-sm">${item.lineTotal?.toFixed(2)}</p>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span>${selected.subtotal?.toFixed(2)}</span></div>
              {selected.discount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>-${selected.discount?.toFixed(2)}</span></div>}
              <div className="flex justify-between font-black text-base border-t pt-1"><span>Total</span><span>${selected.grandTotal?.toFixed(2)}</span></div>
              {selected.amountPaid > 0 && <div className="flex justify-between text-sm text-green-600"><span>Paid</span><span>${selected.amountPaid?.toFixed(2)}</span></div>}
              {selected.balanceDue > 0 && <div className="flex justify-between text-sm text-red-600 font-bold"><span>Balance Due</span><span>${selected.balanceDue?.toFixed(2)}</span></div>}
            </div>
            {selected.note && <p className="text-sm text-gray-500 italic">Note: {selected.note}</p>}
          </div>
        )}
      </Sheet>
    </div>
  );
}

function CreatePOSheet({ open, onClose, onSaved }) {
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn:  async () => { const { data } = await api.get('/suppliers'); return data.data; }
  });
  const { data: products = [] } = useQuery({
    queryKey: ['products-list'],
    queryFn:  async () => { const { data } = await api.get('/products?limit=500'); return data.data; }
  });

  const { register, handleSubmit, control, formState: { isSubmitting } } = useForm({
    defaultValues: { items: [{ productId: '', quantity: 1, unitCost: '' }] }
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const onSubmit = async (data) => {
    try {
      await api.post('/purchase-orders', { supplierId: data.supplierId, items: data.items, discount: data.discount, note: data.note });
      toast.success('Purchase order created.');
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to create PO.');
    }
  };

  return (
    <Sheet open={open} title="New Purchase Order" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1.5">Supplier *</label>
          <select {...register('supplierId', { required: true })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none">
            <option value="">— Select supplier —</option>
            {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-600">Items *</label>
            <button type="button" onClick={() => append({ productId:'', quantity:1, unitCost:'' })}
                    className="text-xs font-semibold" style={{ color: '#d4a017' }}>
              + Add Item
            </button>
          </div>
          <div className="space-y-2">
            {fields.map((field, i) => (
              <div key={field.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="flex gap-2">
                  <select {...register(`items.${i}.productId`, { required: true })}
                          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none">
                    <option value="">— Product —</option>
                    {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(i)} className="p-2 text-gray-400 hover:text-red-400">
                      <Trash2 size={15}/>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-0.5">Quantity</label>
                    <input type="number" min="1" {...register(`items.${i}.quantity`, { required:true, valueAsNumber:true })}
                           className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" placeholder="1"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-0.5">Unit Cost ($)</label>
                    <input type="number" step="0.01" min="0" {...register(`items.${i}.unitCost`, { required:true, valueAsNumber:true })}
                           className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" placeholder="0.00"/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Discount ($)</label>
            <input type="number" step="0.01" min="0" {...register('discount', { valueAsNumber:true })}
                   className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none" placeholder="0"/>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Note</label>
            <input {...register('note')} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none" placeholder="Optional"/>
          </div>
        </div>

        <button type="submit" disabled={isSubmitting}
                className="w-full py-4 rounded-2xl font-bold text-black disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: '#d4a017' }}>
          {isSubmitting && <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"/>}
          Create Purchase Order
        </button>
      </form>
    </Sheet>
  );
}
