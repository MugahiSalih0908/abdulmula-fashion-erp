// src/pages/ProductsPage.jsx – v5 role-aware (staff = view only)

import { useState }                          from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray }            from 'react-hook-form';
import { motion, AnimatePresence }           from 'framer-motion';
import toast                                 from 'react-hot-toast';
import api                                   from '../services/api';
import { useRole }                           from '../hooks/useRole';
import PageHeader from '../components/ui/PageHeader';
import Sheet      from '../components/ui/Sheet';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import CardBody from '../components/ui/CardBody';
import Badge from '../components/ui/Badge';
import { Plus, Search, Pencil, Trash2, BarChart3, X, AlertTriangle, Package, Eye, TrendingUp } from 'lucide-react';

const CATEGORIES = ['Men','Women','Girls','Boys','Kids','Sudanese Silk Toub Wraps','Accessories','Other'];

export default function ProductsPage() {
  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editProd, setEditProd] = useState(null);
  const [movements, setMovements] = useState(null);
  const { can } = useRole();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, category],
    queryFn:  async () => {
      const params = new URLSearchParams({ limit:500 });
      if (search)             params.set('search',   search);
      if (category !== 'All') params.set('category', category);
      const { data } = await api.get(`/products?${params}`);
      return data.data;
    },
    staleTime: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/products/${id}`),
    onSuccess:  () => { queryClient.invalidateQueries(['products']); toast.success('Product removed.'); },
    onError:    (e) => toast.error(e?.response?.data?.message || 'Delete failed.'),
  });

  const products      = data || [];
  const lowStockCount = products.filter(p => p.quantity <= p.lowStockThreshold).length;

  const openEdit = (p) => { setEditProd(p); setShowForm(true); };
  const openAdd  = ()  => { setEditProd(null); setShowForm(true); };

  return (
    <div className="p-4 space-y-5">
      <PageHeader
        title="Products"
        sub={`${products.length} items in stock`}
        action={
          can.editProducts ? (
            <Button
              variant="primary"
              size="sm"
              onClick={openAdd}
              className="flex items-center gap-1.5"
            >
              <Plus size={16} /> Add
            </Button>
          ) : (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Eye size={14} /> View only
            </Badge>
          )
        }
      />

      {lowStockCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <span className="text-amber-800 text-sm font-medium">
            {lowStockCount} item(s) running low on stock
          </span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, SKU, barcode…"
          className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition bg-white"
        />
      </div>

      {/* Category pills */}
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

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <Package size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-500">No products found</p>
          {can.editProducts && <p className="text-xs text-gray-400 mt-1">Add your first product to get started</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <motion.div key={p._id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <CardBody className="p-4">
                  <div className="flex items-center gap-3">
                    {/* Stock indicator */}
                    <div
                      className={`w-3 h-3 rounded-full shrink-0 ${
                        p.quantity === 0
                          ? 'bg-red-500'
                          : p.quantity <= p.lowStockThreshold
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      title={p.quantity === 0 ? 'Out of stock' : p.quantity <= p.lowStockThreshold ? 'Low stock' : 'In stock'}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {p.category}
                        </Badge>
                        {p.sku && (
                          <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {p.sku}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-emerald-600">${p.price.toFixed(2)}</p>
                      <p
                        className={`text-xs font-medium ${
                          p.quantity === 0
                            ? 'text-red-600'
                            : p.quantity <= p.lowStockThreshold
                            ? 'text-amber-600'
                            : 'text-gray-500'
                        }`}
                      >
                        {p.quantity} in stock
                      </p>
                    </div>
                    {can.editProducts && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => setMovements(p)}
                          className="p-2 text-gray-400 hover:text-emerald-600 rounded-lg transition"
                          title="View stock history"
                        >
                          <BarChart3 size={16} />
                        </button>
                        <button
                          onClick={() => openEdit(p)}
                          className="p-2 text-gray-400 hover:text-blue-600 rounded-lg transition"
                          title="Edit product"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Remove "${p.name}"?`)) deleteMutation.mutate(p._id);
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 rounded-lg transition disabled:opacity-50"
                          disabled={deleteMutation.isPending}
                          title="Delete product"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <div className="h-4" />

      {/* Product Form Sheet */}
      {can.editProducts && (
        <Sheet open={showForm} title={editProd ? 'Edit Product' : 'Add Product'} onClose={() => { setShowForm(false); setEditProd(null); }}>
          <ProductForm product={editProd} onClose={() => { setShowForm(false); setEditProd(null); }}
                       onSaved={() => { queryClient.invalidateQueries(['products']); setShowForm(false); setEditProd(null); }}/>
        </Sheet>
      )}

      {/* Stock movements sheet */}
      <Sheet open={!!movements} title="Stock History" subtitle={movements?.name} onClose={() => setMovements(null)}>
        {movements && <MovementsView productId={movements._id}/>}
      </Sheet>
    </div>
  );
}

function ProductForm({ product, onClose, onSaved }) {
  const isEdit = !!product;
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: product || { lowStockThreshold: 5, quantity: 0, costPrice: 0 }
  });
  const onSubmit = async (data) => {
    try {
      if (isEdit) { await api.put(`/products/${product._id}`, data); toast.success('Product updated.'); }
      else        { await api.post('/products', data);               toast.success('Product added.'); }
      onSaved();
    } catch (e) { toast.error(e?.response?.data?.message || 'Save failed.'); }
  };
  return (
    <form id="prodForm" onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Product Name *</label>
        <input
          {...register('name', { required: 'Name required' })}
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          placeholder="e.g. Men's Polo Shirt"
        />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1.5">Selling Price ($)*</label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('price', { required: true, valueAsNumber: true })}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1.5">Cost Price ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('costPrice', { valueAsNumber: true })}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            placeholder="0.00"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1.5">Quantity *</label>
          <input
            type="number"
            min="0"
            {...register('quantity', { required: true, valueAsNumber: true })}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1.5">Low Stock Alert</label>
          <input
            type="number"
            min="0"
            {...register('lowStockThreshold', { valueAsNumber: true })}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            placeholder="5"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1.5">Category *</label>
          <select
            {...register('category', { required: true })}
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
          <label className="text-xs font-semibold text-gray-600 block mb-1.5">SKU</label>
          <input
            {...register('sku')}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition font-mono uppercase"
            placeholder="MEN-001"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Barcode</label>
        <input
          {...register('barcode')}
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition font-mono"
          placeholder="6001234567890"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Description</label>
        <textarea
          {...register('description')}
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition resize-none"
          placeholder="Optional…"
        />
      </div>
      <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
        {isSubmitting && <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />}
        {isEdit ? 'Save Changes' : 'Add to Inventory'}
      </Button>
    </form>
  );
}

function MovementsView({ productId }) {
  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['movements', productId],
    queryFn: async () => {
      const { data } = await api.get(`/products/${productId}/movements`);
      return data.data;
    }
  });
  const TYPE_COLORS = {
    sale: 'bg-red-50 text-red-700',
    purchase: 'bg-emerald-50 text-emerald-700',
    adjustment: 'bg-blue-50 text-blue-700',
    return: 'bg-purple-50 text-purple-700',
    damage: 'bg-orange-50 text-orange-700',
    opening: 'bg-gray-100 text-gray-700'
  };
  return (
    <div className="px-4 py-3 space-y-3">
      {isLoading ? (
        [...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-200 rounded-lg animate-pulse" />)
      ) : movements.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No movements recorded yet.</p>
      ) : (
        movements.map((m, i) => (
          <Card key={i}>
            <CardBody className="p-3 flex items-start gap-3">
              <Badge variant={m.type === 'sale' ? 'danger' : m.type === 'purchase' ? 'success' : 'info'} className="text-xs font-bold shrink-0 uppercase">
                {m.type}
              </Badge>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  {m.quantity > 0 ? '+' : ''}{m.quantity} units{' '}
                  <span className="text-gray-500 font-normal">
                    {m.before} → {m.after}
                  </span>
                </p>
                {m.note && <p className="text-xs text-gray-500 mt-1">{m.note}</p>}
              </div>
              <p className="text-xs text-gray-500 shrink-0 whitespace-nowrap">
                {new Date(m.createdAt).toLocaleDateString()}
              </p>
            </CardBody>
          </Card>
        ))
      )}
    </div>
  );
}
