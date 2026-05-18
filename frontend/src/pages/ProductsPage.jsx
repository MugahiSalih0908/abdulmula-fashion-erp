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
import { Plus, Search, Pencil, Trash2, BarChart3, X, AlertTriangle, Package, Eye } from 'lucide-react';

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
    <div className="p-4 space-y-4">
      <PageHeader
        title="Products"
        sub={`${products.length} items`}
        action={
          can.editProducts ? (
            <button onClick={openAdd}
                    className="flex items-center gap-1.5 text-black px-4 py-2.5 rounded-xl font-semibold text-sm"
                    style={{ background:'#d4a017' }}>
              <Plus size={16}/> Add
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg bg-gray-100 text-gray-500">
              <Eye size={14}/> View only
            </span>
          )
        }
      />

      {lowStockCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <AlertTriangle size={14} className="text-amber-600 shrink-0"/>
          <span className="text-amber-800 text-sm font-medium">{lowStockCount} item(s) running low on stock</span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input value={search} onChange={e => setSearch(e.target.value)}
               placeholder="Search name, SKU, barcode…"
               className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none bg-white"/>
      </div>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {['All',...CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    category===cat ? 'text-black' : 'bg-white text-gray-500 border border-gray-200'
                  }`}
                  style={category===cat ? { background:'#d4a017' } : {}}>
            {cat}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_,i)=><div key={i} className="h-20 bg-gray-200 rounded-2xl animate-pulse"/>)}</div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={48} className="mx-auto mb-3 opacity-25"/><p className="font-semibold">No products found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map(p => (
            <div key={p._id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                p.quantity === 0 ? 'bg-red-500' : p.quantity <= p.lowStockThreshold ? 'bg-amber-400' : 'bg-green-400'
              }`}/>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">{p.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">{p.category}</span>
                  {p.sku && <span className="text-xs font-mono text-gray-400">{p.sku}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-sm" style={{ color:'#d4a017' }}>${p.price.toFixed(2)}</p>
                <p className={`text-xs font-medium ${
                  p.quantity===0 ? 'text-red-500' : p.quantity<=p.lowStockThreshold ? 'text-amber-500' : 'text-gray-400'
                }`}>{p.quantity} in stock</p>
              </div>
              {can.editProducts && (
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setMovements(p)} className="p-2 text-gray-400 hover:text-blue-500 rounded-lg"><BarChart3 size={15}/></button>
                  <button onClick={() => openEdit(p)}     className="p-2 text-gray-400 hover:text-gray-700 rounded-lg"><Pencil size={15}/></button>
                  <button onClick={() => { if(window.confirm(`Remove "${p.name}"?`)) deleteMutation.mutate(p._id); }}
                          className="p-2 text-gray-400 hover:text-red-500 rounded-lg"><Trash2 size={15}/></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="h-4"/>

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
  const { register, handleSubmit, formState:{ errors, isSubmitting } } = useForm({
    defaultValues: product || { lowStockThreshold:5, quantity:0, costPrice:0 }
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
        <input {...register('name',{required:'Name required'})} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none" placeholder="e.g. Men's Polo Shirt"/>
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs font-semibold text-gray-600 block mb-1.5">Selling Price ($)*</label>
          <input type="number" step="0.01" min="0" {...register('price',{required:true,valueAsNumber:true})} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none" placeholder="0.00"/></div>
        <div><label className="text-xs font-semibold text-gray-600 block mb-1.5">Cost Price ($)</label>
          <input type="number" step="0.01" min="0" {...register('costPrice',{valueAsNumber:true})} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none" placeholder="0.00"/></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs font-semibold text-gray-600 block mb-1.5">Quantity *</label>
          <input type="number" min="0" {...register('quantity',{required:true,valueAsNumber:true})} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none"/></div>
        <div><label className="text-xs font-semibold text-gray-600 block mb-1.5">Low Stock Alert</label>
          <input type="number" min="0" {...register('lowStockThreshold',{valueAsNumber:true})} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none" placeholder="5"/></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs font-semibold text-gray-600 block mb-1.5">Category *</label>
          <select {...register('category',{required:true})} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none">
            <option value="">— Select —</option>
            {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
          </select></div>
        <div><label className="text-xs font-semibold text-gray-600 block mb-1.5">SKU</label>
          <input {...register('sku')} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none font-mono uppercase" placeholder="MEN-001"/></div>
      </div>
      <div><label className="text-xs font-semibold text-gray-600 block mb-1.5">Barcode</label>
        <input {...register('barcode')} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none font-mono" placeholder="6001234567890"/></div>
      <div><label className="text-xs font-semibold text-gray-600 block mb-1.5">Description</label>
        <textarea {...register('description')} rows={2} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none resize-none" placeholder="Optional…"/></div>
      <button type="submit" disabled={isSubmitting}
              className="w-full py-4 rounded-2xl font-bold text-black disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background:'#d4a017' }}>
        {isSubmitting && <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"/>}
        {isEdit ? 'Save Changes' : 'Add to Inventory'}
      </button>
    </form>
  );
}

function MovementsView({ productId }) {
  const { data:movements=[], isLoading } = useQuery({
    queryKey: ['movements', productId],
    queryFn:  async () => { const { data } = await api.get(`/products/${productId}/movements`); return data.data; }
  });
  const TYPE_COLORS = { sale:'text-red-500 bg-red-50', purchase:'text-green-600 bg-green-50', adjustment:'text-blue-600 bg-blue-50', return:'text-purple-600 bg-purple-50', damage:'text-orange-600 bg-orange-50', opening:'text-gray-600 bg-gray-100' };
  return (
    <div className="px-4 py-3 space-y-2">
      {isLoading ? [...Array(5)].map((_,i)=><div key={i} className="h-14 bg-gray-200 rounded-xl animate-pulse"/>) :
       movements.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No movements recorded yet.</p> :
       movements.map((m,i) => (
         <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
           <span className={`text-xs font-bold px-2 py-1 rounded-lg uppercase shrink-0 ${TYPE_COLORS[m.type]||'text-gray-600 bg-gray-100'}`}>{m.type}</span>
           <div className="flex-1">
             <p className="text-sm font-semibold">{m.quantity>0?'+':''}{m.quantity} units <span className="text-gray-400 font-normal">{m.before} → {m.after}</span></p>
             {m.note && <p className="text-xs text-gray-400">{m.note}</p>}
           </div>
           <p className="text-xs text-gray-400 shrink-0">{new Date(m.createdAt).toLocaleDateString()}</p>
         </div>
       ))
      }
    </div>
  );
}
