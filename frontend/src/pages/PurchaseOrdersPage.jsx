// src/pages/PurchaseOrdersPage.jsx – purchase orders from suppliers

import { useState }                          from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray }            from 'react-hook-form';
import toast                                 from 'react-hot-toast';
import api                                   from '../services/api';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import CardBody from '../components/ui/CardBody';
import Badge from '../components/ui/Badge';
import Sheet      from '../components/ui/Sheet';
import { Plus, Truck, ChevronRight, CheckCircle, DollarSign, X, Trash2 } from 'lucide-react';

const STATUS_COLORS = {
  draft:    { badge: 'secondary', label: 'Draft' },
  ordered:  { badge: 'info', label: 'Ordered' },
  received: { badge: 'success', label: 'Received' },
  partial:  { badge: 'warning', label: 'Partial' },
  paid:     { badge: 'success', label: 'Paid' },
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
    <div className="p-4 space-y-5">
      <PageHeader
        title="Purchase Orders"
        sub={`${orders.length} orders`}
        action={
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)} className="flex items-center gap-1.5">
            <Plus size={16} /> New PO
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
        <div className="space-y-3">{[...Array(4)].map((_,i) => <div key={i} className="h-20 bg-gray-200 rounded-lg animate-pulse"/>)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <Truck size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-500">No purchase orders yet</p>
          <p className="text-xs text-gray-400 mt-1">Create your first purchase order</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(po => (
            <Card key={po._id}>
              <CardBody className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900">{po.poNumber}</p>
                      <Badge variant={STATUS_COLORS[po.status]?.badge || 'secondary'}>
                        {STATUS_COLORS[po.status]?.label || po.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{po.supplierName}</p>
                    <p className="text-xs text-gray-500">{new Date(po.createdAt).toLocaleDateString()} · {po.items?.length} item(s)</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-lg text-gray-900">${po.grandTotal.toFixed(2)}</p>
                    {po.balanceDue > 0 && <p className="text-xs text-red-600 font-semibold mt-1">Owes ${po.balanceDue.toFixed(2)}</p>}
                  </div>
                </div>

                <div className="flex gap-2">
                  {po.status === 'ordered' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => receiveMutation.mutate(po._id)}
                      disabled={receiveMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-1"
                    >
                      <CheckCircle size={14}/> Receive
                    </Button>
                  )}
                  {po.balanceDue > 0 && po.status !== 'draft' && (
                    payFor?._id === po._id ? (
                      <div className="flex-1 flex gap-2">
                        <input type="number" min="0.01" step="0.01" max={po.balanceDue}
                               value={payAmt} onChange={e => setPayAmt(e.target.value)}
                               className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                               placeholder="Amount" autoFocus />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => payMutation.mutate({ id: po._id, amount: parseFloat(payAmt) })}
                          disabled={!payAmt || payMutation.isPending}
                        >
                          Pay
                        </Button>
                        <button onClick={() => setPayFor(null)} className="p-2 text-gray-400 hover:text-gray-600"><X size={16}/></button>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPayFor(po)}
                        className="flex-1 flex items-center justify-center gap-1"
                      >
                        <DollarSign size={14}/> Pay
                      </Button>
                    )
                  )}
                  <button onClick={() => setSelected(po)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition">
                    <ChevronRight size={16}/>
                  </button>
                </div>
              </CardBody>
            </Card>
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
                <Card key={i} className="bg-gray-50">
                  <CardBody className="p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{item.productName}</p>
                        <p className="text-xs text-gray-600">{item.quantity} × ${item.unitCost?.toFixed(2)}</p>
                      </div>
                      <p className="font-bold text-sm text-gray-900">${item.lineTotal?.toFixed(2)}</p>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
            <Card className="bg-gray-50">
              <CardBody className="p-3 space-y-1.5">
                <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal</span><span className="font-semibold text-gray-900">${selected.subtotal?.toFixed(2)}</span></div>
                {selected.discount > 0 && <div className="flex justify-between text-sm text-emerald-700 font-medium"><span>Discount</span><span>-${selected.discount?.toFixed(2)}</span></div>}
                <div className="flex justify-between font-bold text-base border-t pt-1.5"><span className="text-gray-900">Total</span><span className="text-emerald-700">${selected.grandTotal?.toFixed(2)}</span></div>
                {selected.amountPaid > 0 && <div className="flex justify-between text-sm text-emerald-700"><span>Paid</span><span>${selected.amountPaid?.toFixed(2)}</span></div>}
                {selected.balanceDue > 0 && <div className="flex justify-between text-sm text-red-700 font-semibold"><span>Balance Due</span><span>${selected.balanceDue?.toFixed(2)}</span></div>}
              </CardBody>
            </Card>
            {selected.note && <p className="text-sm text-gray-600 italic">Note: {selected.note}</p>}
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
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
            <option value="">— Select supplier —</option>
            {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-600">Items *</label>
            <button type="button" onClick={() => append({ productId:'', quantity:1, unitCost:'' })}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
              + Add Item
            </button>
          </div>
          <div className="space-y-2">
            {fields.map((field, i) => (
              <Card key={field.id} className="bg-gray-50">
                <CardBody className="p-3 space-y-2">
                  <div className="flex gap-2">
                    <select {...register(`items.${i}.productId`, { required: true })}
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
                      <option value="">— Product —</option>
                      {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(i)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg transition">
                        <Trash2 size={16}/>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600 font-medium block mb-0.5">Quantity</label>
                      <input type="number" min="1" {...register(`items.${i}.quantity`, { required:true, valueAsNumber:true })}
                             className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" placeholder="1"/>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 font-medium block mb-0.5">Unit Cost ($)</label>
                      <input type="number" step="0.01" min="0" {...register(`items.${i}.unitCost`, { required:true, valueAsNumber:true })}
                             className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" placeholder="0.00"/>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Discount ($)</label>
            <input type="number" step="0.01" min="0" {...register('discount', { valueAsNumber:true })}
                   className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" placeholder="0"/>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Note</label>
            <input {...register('note')} className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" placeholder="Optional"/>
          </div>
        </div>

        <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
          {isSubmitting && <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"/>}
          Create Purchase Order
        </Button>
      </form>
    </Sheet>
  );
}
