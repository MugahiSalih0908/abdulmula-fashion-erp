import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Archive, ArrowRight, Package, RefreshCw, Search, ShieldAlert, Tag, Truck } from 'lucide-react';
import api from '../services/api';
import { useRole } from '../hooks/useRole';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import CardBody from '../components/ui/CardBody';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { PRODUCT_CATEGORIES, filterOutOfStockProducts, getSafeProductImageUrl } from './productManagement.mjs';

const INPUT_CLASS = 'w-full min-h-11 rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 pl-10 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-gold)] focus:outline-none focus:ring-2 focus:ring-[rgba(197,164,109,0.2)]';

function ProductImage({ product }) {
  const src = getSafeProductImageUrl(product.imageUrl);
  if (!src) {
    return <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]"><Package size={25} aria-hidden="true" /></div>;
  }
  return <img src={src} alt={product.name} loading="lazy" className="h-20 w-20 shrink-0 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] object-cover" onError={event => { event.currentTarget.style.display = 'none'; }} />;
}

function ProductRow({ product, canManage }) {
  const supplierName = typeof product.supplier === 'object' ? product.supplier?.name : '';
  return (
    <Card className="overflow-hidden">
      <CardBody className="flex min-w-0 flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:p-4">
        <div className="flex min-w-0 items-start gap-3">
          <ProductImage product={product} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-[var(--color-text)] sm:text-base">{product.name}</h2>
              <Badge variant="danger">Out of stock</Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge>{product.category || 'Other'}</Badge>
              {product.sku && <span className="rounded-lg bg-[var(--color-bg-secondary)] px-2 py-1 font-mono text-[10px] text-[var(--color-text-secondary)]">{product.sku}</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
              {product.barcode && <span>Barcode: {product.barcode}</span>}
              {(product.size || product.color) && <span>{[product.size && ('Size ' + product.size), product.color].filter(Boolean).join(' · ')}</span>}
              {supplierName && <span className="inline-flex items-center gap-1"><Truck size={12} aria-hidden="true" />{supplierName}</span>}
              {!supplierName && <span className="text-[var(--color-warning)]">No supplier assigned</span>}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--color-border-light)] pt-3 sm:ml-auto sm:border-0 sm:pt-0">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Available quantity</p>
            <p className="text-lg font-semibold tabular-nums text-[var(--color-danger)]">0 units</p>
          </div>
          {canManage && (
            <Link to="/products" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-white px-3 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-gold-light)] hover:bg-[var(--color-bg-secondary)]">
              Manage product <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

export default function OutOfStockPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const { can } = useRole();
  const { data: response, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['out-of-stock-products'],
    queryFn: async () => {
      const { data } = await api.get('/products?outOfStock=true&limit=500');
      return {
        items: Array.isArray(data?.data) ? data.data : [],
        total: Number.isFinite(Number(data?.total)) ? Number(data.total) : (Array.isArray(data?.data) ? data.data.length : 0)
      };
    },
    staleTime: 30000
  });

  const products = response?.items || [];
  const total = response?.total ?? products.length;
  const filtered = useMemo(() => filterOutOfStockProducts(products, search, category), [products, search, category]);
  const categories = ['All', ...PRODUCT_CATEGORIES.filter(item => products.some(product => product.category === item))];
  const missingSupplierCount = products.filter(product => !product.supplier).length;

  return (
    <main className="space-y-5 p-4 pb-8 sm:space-y-6 sm:p-6 lg:p-7">
      <PageHeader
        title="Out of stock"
        sub="Products with zero units available — review replenishment needs"
        action={<Link to="/products" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition hover:opacity-90"><Package size={16} aria-hidden="true" />Products catalogue</Link>}
      />

      {isError && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-danger)]/20 bg-[#fff7f5] p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <div className="flex items-start gap-3">
            <ShieldAlert size={19} className="mt-0.5 shrink-0 text-[var(--color-danger)]" aria-hidden="true" />
            <div><p className="text-sm font-semibold text-[var(--color-text)]">Out-of-stock products could not be loaded</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">{error?.response?.data?.message || error?.message || 'Check your connection and try again.'}</p></div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => refetch()} loading={isFetching}><RefreshCw size={14} />Try again</Button>
        </div>
      )}

      {!isError && total > products.length && (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--color-gold-light)] bg-[#fbf8f1] p-3 text-xs text-[var(--color-text-secondary)]">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          Showing {products.length.toLocaleString()} of {total.toLocaleString()} out-of-stock products. The API currently returns up to 500 items on this screen.
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Out-of-stock summary">
        <Card><CardBody className="p-4 sm:p-5"><span className="kpi-icon kpi-icon-red"><Archive size={19} aria-hidden="true" /></span><p className="mt-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Out-of-stock products</p><p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-text)]">{total.toLocaleString()}</p></CardBody></Card>
        <Card><CardBody className="p-4 sm:p-5"><span className="kpi-icon kpi-icon-gold"><Tag size={19} aria-hidden="true" /></span><p className="mt-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Categories affected</p><p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-text)]">{new Set(products.map(product => product.category).filter(Boolean)).size.toLocaleString()}</p></CardBody></Card>
        <Card><CardBody className="p-4 sm:p-5"><span className="kpi-icon kpi-icon-gray"><Truck size={19} aria-hidden="true" /></span><p className="mt-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Missing supplier</p><p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-text)]">{missingSupplierCount.toLocaleString()}</p></CardBody></Card>
      </section>

      <section className="space-y-3" aria-label="Out-of-stock filters">
        <div className="relative">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden="true" />
          <input value={search} onChange={event => setSearch(event.target.value)} type="search" placeholder="Search product, SKU, barcode, size or colour…" aria-label="Search out-of-stock products" className={INPUT_CLASS} />
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by category">
          {categories.map(item => (
            <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={'min-h-10 shrink-0 rounded-full border px-3.5 text-xs font-semibold ' + (category === item ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white' : 'border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]')}>
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3" aria-label="Out-of-stock product list">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-sm font-semibold text-[var(--color-text)]">Needs replenishment</h2><p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{filtered.length.toLocaleString()} products shown</p></div>
          {isFetching && !isLoading && <span className="text-xs text-[var(--color-text-muted)]" role="status">Refreshing…</span>}
        </div>
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(item => <div key={item} className="h-28 animate-pulse rounded-2xl border border-[var(--color-border)] bg-white" />)}</div>
        ) : isError ? null : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white px-5 py-14 text-center">
            <Package size={27} className="mx-auto text-[var(--color-success)]" aria-hidden="true" />
            <h3 className="mt-4 text-sm font-semibold text-[var(--color-text)]">{products.length === 0 ? 'Your inventory is fully stocked' : 'No matching products'}</h3>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{products.length === 0 ? 'There are no active products with zero stock right now.' : 'Try another search or select a different category.'}</p>
            {(search || category !== 'All') && <button type="button" onClick={() => { setSearch(''); setCategory('All'); }} className="mt-4 rounded-xl border border-[var(--color-border)] px-4 py-2 text-xs font-semibold text-[var(--color-text-secondary)]">Clear filters</button>}
          </div>
        ) : (
          <div className="space-y-3">{filtered.map(product => <ProductRow key={product._id} product={product} canManage={can.editProducts} />)}</div>
        )}
      </section>
    </main>
  );
}
