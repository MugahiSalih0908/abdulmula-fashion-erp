// src/pages/POSPage.jsx – complete real-world POS cashier workflow (fixed barcode scanner)
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../services/api';
import useCartStore from '../store/cartStore';
import { calculateCashChange } from '../../../shared/invoiceCalculations.mjs';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  saveSaleOffline,
  markSaleSynced,
  getOfflineProducts,
  cacheProducts
} from '../offline/syncManager';
import db from '../offline/db';
import CartDrawer from '../components/pos/CartDrawer';
import ReceiptModal from '../components/pos/ReceiptModal';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import { filterCatalogProducts, getCatalogCategories, scanCatalogProduct } from './posCatalog.mjs';
import { createBarcodeScannerLifecycle } from './barcodeScannerLifecycle.mjs';
import {
  Search, ScanLine, ShoppingCart, Package, X, Wifi, WifiOff,
  RotateCw, Plus
} from 'lucide-react';

export default function POSPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [cartOpen, setCartOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [scanning, setScanning] = useState(false);
  const scannerTriggerRef = useRef(null);
  const scannerWasOpenedRef = useRef(false);
  const checkoutId = useRef(localStorage.getItem('pos.pendingCheckoutId'));
  const checkoutCreatedAt = useRef(localStorage.getItem('pos.pendingCheckoutCreatedAt'));

  const cart = useCartStore();
  const { isOnline } = useOnlineStatus();
  const queryClient = useQueryClient();

  // ── Load products ────────────────────────────────────────────
  const {
    data: apiProducts = [],
    isLoading,
    isError: productsError,
    error: productsErrorDetails,
    refetch: refetchProducts
  } = useQuery({
    queryKey: ['pos-products'],
    queryFn: async () => {
      const { data } = await api.get('/products?limit=500');
      await cacheProducts(data.data);
      return data.data;
    },
    enabled: isOnline,
    staleTime: 1000 * 60 * 5,
  });

  const [offlineProds, setOfflineProds] = useState([]);
  const [offlineProductsLoading, setOfflineProductsLoading] = useState(false);
  const [offlineProductsError, setOfflineProductsError] = useState(null);
  const [offlineProductsLoaded, setOfflineProductsLoaded] = useState(false);
  useEffect(() => {
    if (isOnline) return undefined;
    let active = true;
    setOfflineProductsLoading(true);
    setOfflineProductsError(null);
    getOfflineProducts()
      .then(products => {
        if (active) setOfflineProds(products);
      })
      .catch(error => {
        if (active) setOfflineProductsError(error);
      })
      .finally(() => {
        if (active) {
          setOfflineProductsLoading(false);
          setOfflineProductsLoaded(true);
        }
      });
    return () => { active = false; };
  }, [isOnline]);

  const allProducts = isOnline ? apiProducts : offlineProds;
  const catalogLoading = isOnline ? isLoading : offlineProductsLoading || !offlineProductsLoaded;
  const catalogError = isOnline ? productsError : Boolean(offlineProductsError);
  const offlineCatalogEmpty = !isOnline && !catalogLoading && !catalogError && offlineProds.length === 0;
  const categories = getCatalogCategories(allProducts);

  // ── Load customers for cart ──────────────────────────────────
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-pos'],
    queryFn: async () => {
      const { data } = await api.get('/customers');
      return data.data;
    },
    enabled: isOnline,
    staleTime: 1000 * 60 * 5,
  });

  // ── Filter ───────────────────────────────────────────────────
  const filtered = filterCatalogProducts(allProducts, search, category);

  const retryCatalog = () => {
    if (isOnline) {
      refetchProducts();
      return;
    }
    setOfflineProductsLoading(true);
    setOfflineProductsError(null);
    getOfflineProducts()
      .then(setOfflineProds)
      .catch(setOfflineProductsError)
      .finally(() => {
        setOfflineProductsLoading(false);
        setOfflineProductsLoaded(true);
      });
  };

  useEffect(() => {
    if (!scanning && scannerWasOpenedRef.current) {
      scannerWasOpenedRef.current = false;
      scannerTriggerRef.current?.focus();
    }
  }, [scanning]);

  // ── Checkout mutation ────────────────────────────────────────
  const { mutate: checkout, isPending: isCheckingOut } = useMutation({
    mutationFn: async (payload) => {
      if (isOnline) {
        const offlineId = await saveSaleOffline(payload, payload.offlineId);
        try {
          const { data } = await api.post('/invoices', payload);
          await markSaleSynced(offlineId);
          return data.data;
        } catch (err) {
          const status = err?.response?.status;
          if (status && status >= 400 && status < 500) {
            const queued = await db.pendingSales.where('offlineId').equals(offlineId).first();
            if (queued && queued.syncStatus !== 'rejected') {
              await db.pendingSales.update(queued.id, {
                syncStatus: 'blocked',
                syncError: err?.response?.data?.message || 'Sale requires review before it can sync.',
                ...(err?.response?.data?.conflictDetails
                  ? { syncConflict: err.response.data.conflictDetails }
                  : {})
              });
            }
          }
          throw err;
        }
      }
      const offlineId = await saveSaleOffline(payload, payload.offlineId);
      localStorage.removeItem('pos.pendingCheckoutId');
      localStorage.removeItem('pos.pendingCheckoutCreatedAt');
      checkoutId.current = null;
      checkoutCreatedAt.current = null;
      return {
        offlineId,
        isOffline: true,
        invoiceNumber: `OFFLINE-${Date.now()}`,
        items: cart.items.map(i => ({
          productName: i.product.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount,
          lineTotal: i.unitPrice * i.quantity - (i.discount || 0)
        })),
        grandTotal: cart.grandTotal(),
        paymentMethod: cart.paymentMethod,
        date: new Date()
      };
    },
    onSuccess: (invoice) => {
      const cash = cart.cashReceived;
      const change = calculateCashChange(cash, invoice.grandTotal);
      checkoutId.current = null;
      localStorage.removeItem('pos.pendingCheckoutId');
      localStorage.removeItem('pos.pendingCheckoutCreatedAt');
      checkoutCreatedAt.current = null;
      queryClient.invalidateQueries(['pos-products']);
      cart.clearCart();
      setCartOpen(false);
      setReceipt({ invoice, cash, change });
      if (invoice.isOffline) {
        toast('Sale saved offline — will sync when online.', { icon: '📴', duration: 4000 });
      } else {
        toast.success(`Invoice ${invoice.invoiceNumber} — Done!`);
      }
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Checkout failed. Please try again.');
    }
  });

  const handleCheckout = () => {
    const payload = cart.toInvoicePayload();
    checkoutCreatedAt.current ||= new Date().toISOString();
    payload.offlineCreatedAt = checkoutCreatedAt.current;
    if (isOnline) {
      checkoutId.current ||= globalThis.crypto?.randomUUID?.()
        || `pos_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('pos.pendingCheckoutId', checkoutId.current);
      localStorage.setItem('pos.pendingCheckoutCreatedAt', checkoutCreatedAt.current);
      payload.offlineId = checkoutId.current;
      payload.items = payload.items.map(({ unitPrice, ...item }) => ({
        ...item,
        expectedUnitPrice: unitPrice
      }));
      delete payload.amountPaid;
      if (cart.paymentMethod !== 'Cash') delete payload.cashReceived;
    } else {
      checkoutId.current ||= globalThis.crypto?.randomUUID?.()
        || `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('pos.pendingCheckoutId', checkoutId.current);
      localStorage.setItem('pos.pendingCheckoutCreatedAt', checkoutCreatedAt.current);
      payload.offlineId = checkoutId.current;
    }
    checkout(payload);
  };

  // ── Barcode scan result (now uses stable scanner) ────────────
  const reportAddResult = useCallback((product, result) => {
    const name = product?.name || 'Product';
    if (result.status === 'not-found') {
      toast.error('No product found for that barcode or SKU.');
    } else if (result.cartReconciled === 'removed') {
      toast.error(`${name} was removed from the cart because its stock is ${result.status === 'out-of-stock' ? 'zero' : 'invalid'}.`);
    } else if (result.status === 'invalid-stock') {
      toast.error(`Cannot add ${name}: available stock is invalid.`);
    } else if (result.status === 'out-of-stock') {
      toast.error(`${name} is out of stock.`);
    } else if (result.status === 'invalid-quantity' || result.status === 'invalid-cart-quantity') {
      toast.error(`Cannot add ${name}: the requested quantity is invalid.`);
    } else if (result.status === 'stock-adjusted') {
      toast.error(`${name} was adjusted to ${result.quantity} available unit(s) in the cart.`);
    } else if (result.status === 'stock-limit') {
      toast.error(`Stock limit reached for ${name}; cart quantity is ${result.quantity}.`);
    } else if (result.ok) {
      toast.success(`Added ${name} to cart`, { duration: 1400 });
    }
  }, []);

  const handleBarcode = useCallback((code) => {
    const result = scanCatalogProduct(allProducts, code, cart.addItem);
    reportAddResult(result.product, result);
    setScanning(false);
  }, [allProducts, cart.addItem, reportAddResult]);

  const itemCount = cart.itemCount();
  const grandTotal = cart.grandTotal();
  const closeScanner = useCallback(() => setScanning(false), []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--color-bg)]">
      <section className="z-10 border-b border-[var(--color-border)] bg-white px-4 pb-3 pt-4 shadow-[var(--shadow-sm)] sm:px-6 sm:pt-5">
        <div className="mx-auto w-full max-w-[1600px]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#927746]">Abdulmula Fashion</p>
              <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text)] sm:text-2xl">Point of sale</h1>
              <p className="mt-1 text-xs text-[var(--color-text-muted)] sm:text-sm">Find an item or scan its barcode to add it to the cart.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                isOnline
                  ? 'border-[#d7e5dc] bg-[#f2f7f3] text-[#356447]'
                  : 'border-[#eadfc7] bg-[#fbf6eb] text-[#80622e]'
              }`} role="status" aria-live="polite">
                {isOnline ? <Wifi size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}
                {isOnline ? 'Online' : 'Offline catalogue'}
              </span>
              <Badge variant="primary" className="border border-[var(--color-border)] bg-white text-[var(--color-text-secondary)]">
                {allProducts.length} items
              </Badge>
            </div>
          </div>

          <div className="mt-4 flex gap-2 sm:mt-5">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search products by name, SKU, or barcode</span>
              <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search name, SKU or barcode"
                autoComplete="off"
                className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] pl-11 pr-11 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[var(--focus-ring)]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear product search"
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </label>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              icon={ScanLine}
              onClick={event => {
                scannerTriggerRef.current = event.currentTarget;
                scannerWasOpenedRef.current = true;
                setScanning(true);
              }}
              className="h-12 shrink-0 border-[var(--color-border)] px-3 sm:px-4"
              aria-label="Open barcode scanner or enter a code manually"
            >
              <span className="hidden sm:inline">Scan barcode</span>
            </Button>
          </div>

          <nav className="mt-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar" aria-label="Product categories">
            {categories.map(cat => {
              const active = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  aria-pressed={active}
                  className={`min-h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] ${
                    active
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-[var(--shadow-sm)]'
                      : 'border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:border-[var(--color-gold)] hover:text-[var(--color-text)]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </nav>
        </div>
      </section>

      <section className="min-h-0 flex-1 overflow-y-auto px-4 pb-2 pt-4 sm:px-6 sm:pt-5" aria-label="Product catalogue">
        <div className="mx-auto w-full max-w-[1600px]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text)] sm:text-base">
                {category === 'All' ? 'Available products' : category}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]" aria-live="polite">
                {catalogLoading ? 'Loading catalogue…' : `${filtered.length} ${filtered.length === 1 ? 'item' : 'items'} available`}
              </p>
            </div>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-[#80622e] transition hover:bg-[#f4eee3] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
              >
                <X size={14} aria-hidden="true" />
                Clear search
              </button>
            )}
          </div>

          {catalogError && (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[#ead4cd] bg-[#fff8f6] px-4 py-3 text-sm text-[#8d4a3e]">
              <span>
                {isOnline
                  ? productsErrorDetails?.response?.data?.message || 'The product catalogue could not be loaded.'
                  : 'The saved offline catalogue could not be opened.'}
              </span>
              <Button type="button" variant="secondary" size="sm" icon={RotateCw} onClick={retryCatalog}>
                Retry
              </Button>
            </div>
          )}

          {catalogLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5" aria-label="Loading products" aria-busy="true">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-3">
                  <Skeleton variant="card" className="!h-28 bg-[var(--color-bg-secondary)] sm:!h-36" />
                  <Skeleton variant="text" className="mt-3 !h-4 w-4/5 bg-[var(--color-bg-secondary)]" />
                  <Skeleton variant="line" className="mt-2 !h-3 w-1/2 bg-[var(--color-bg-secondary)]" />
                  <Skeleton variant="text" className="mt-4 !h-8 bg-[var(--color-bg-secondary)]" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Package size={24} strokeWidth={1.7} aria-hidden="true" />}
              title={catalogError
                ? 'Catalogue unavailable'
                : offlineCatalogEmpty
                  ? 'Offline catalogue not available'
                  : search
                    ? 'No matching products'
                    : 'No products in this category'}
              description={
                catalogError
                  ? 'Check your connection and try loading the catalogue again.'
                  : offlineCatalogEmpty
                    ? 'No saved product catalogue is available on this device. Reconnect while online to load products for offline use.'
                    : search
                      ? 'Try another product name, SKU, or barcode.'
                      : category !== 'All'
                        ? 'Choose another category to browse available items.'
                        : 'There are no in-stock products to display right now.'
              }
              action={catalogError || offlineCatalogEmpty
                ? <Button type="button" variant="secondary" icon={RotateCw} onClick={retryCatalog}>Retry loading</Button>
                : (search || category !== 'All')
                  ? <Button type="button" variant="ghost" onClick={() => { setSearch(''); setCategory('All'); }}>View all products</Button>
                  : null}
              className="my-8 rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border)] bg-white px-5 py-12"
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-4 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
              {filtered.map(product => {
                const inCart = cart.items.find(item => item?.product?._id === product?._id);
                const quantity = Number(product.quantity) || 0;
                const lowStock = quantity <= (Number(product.lowStockThreshold) || 0);
                const stockLabel = lowStock ? 'Low stock' : 'In stock';
                return (
                  <motion.button
                    key={product._id}
                    type="button"
                    whileTap={{ scale: 0.985 }}
                    onClick={() => {
                      const result = cart.addItem(product);
                      reportAddResult(product, result);
                    }}
                    aria-label={`Add ${product.name || 'product'} to cart, $${(Number(product.price) || 0).toFixed(2)}, ${quantity} in stock${inCart ? `, ${inCart.quantity} in cart` : ''}`}
                    aria-pressed={Boolean(inCart)}
                    className={`group relative min-w-0 overflow-hidden rounded-[var(--radius-lg)] border bg-white p-2.5 text-left shadow-[var(--shadow-sm)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] sm:p-3 ${
                      inCart
                        ? 'border-[var(--color-gold)] ring-1 ring-[var(--color-gold-light)]'
                        : 'border-[var(--color-border)] hover:border-[var(--color-gold-light)]'
                    }`}
                  >
                    {inCart && (
                      <span className="absolute right-3 top-3 z-10 flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--color-primary)] px-1.5 text-xs font-bold text-white shadow-[var(--shadow-md)]" aria-label={`${inCart.quantity} in cart`}>
                        {inCart.quantity}
                      </span>
                    )}
                    <ProductThumbnail product={product} />
                    <div className="flex min-w-0 items-center justify-between gap-2 pt-3">
                      <Badge variant="primary" className="max-w-[72%] truncate border border-[#eee5d5] bg-[#faf7f0] text-[10px] font-medium text-[#80622e]">
                        {product.category || 'Other'}
                      </Badge>
                      <span className={`inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold ${lowStock ? 'text-[#946a22]' : 'text-[#5f6f63]'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${lowStock ? 'bg-[var(--color-warning)]' : 'bg-[#7a927e]'}`} aria-hidden="true" />
                        {stockLabel}
                      </span>
                    </div>
                    <p className="mt-2 min-h-10 text-sm font-semibold leading-5 text-[var(--color-text)] line-clamp-2 sm:text-[15px]">
                      {product.name || 'Unnamed product'}
                    </p>
                    {(product.sku || product.barcode) && (
                      <p className="mt-1 truncate font-mono text-[10px] text-[var(--color-text-muted)]">
                        {product.sku ? `SKU ${product.sku}` : `Barcode ${product.barcode}`}
                      </p>
                    )}
                    <div className="mt-3 flex items-end justify-between gap-2 border-t border-[var(--color-border-light)] pt-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Price</p>
                        <p className="truncate text-base font-semibold tabular-nums text-[var(--color-text)] sm:text-lg">
                          ${(Number(product.price) || 0).toFixed(2)}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium tabular-nums text-[var(--color-text-secondary)]">
                        <Package size={13} aria-hidden="true" />
                        {quantity}
                      </span>
                    </div>
                    <span className="mt-2 flex min-h-8 items-center justify-center gap-1.5 rounded-md bg-[var(--color-bg)] text-xs font-semibold text-[var(--color-text-secondary)] transition group-hover:bg-[#f4eee3] group-hover:text-[#80622e]">
                      <Plus size={14} aria-hidden="true" />
                      {inCart ? 'Add another' : 'Add to cart'}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          )}
          <div className="h-24" />
        </div>
      </section>

      {/* ── Sticky cart button ─────────────────────────────────── */}
      {itemCount > 0 && (
        <div className="sticky bottom-0 z-10 border-t border-[var(--color-border)] bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-3 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="mx-auto flex min-h-12 w-full max-w-[1600px] items-center justify-between rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-md)] transition hover:bg-[var(--color-primary-light)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] sm:px-5 sm:text-base"
          >
            <div className="flex items-center gap-2.5">
              <ShoppingCart size={19} aria-hidden="true" />
              <Badge variant="primary" className="border border-white/20 bg-white/10 font-bold text-white">
                {itemCount}
              </Badge>
            </div>
            <span>View cart</span>
            <span className="font-mono tabular-nums text-[#e8d9bd]">${(grandTotal || 0).toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* ── Cart drawer ──────────────────────────────────────── */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        customers={customers}
        onCheckout={handleCheckout}
        isCheckingOut={isCheckingOut}
      />

      {/* ── Receipt modal ────────────────────────────────────── */}
      {receipt && (
        <ReceiptModal
          invoice={receipt.invoice}
          cashReceived={receipt.cash}
          changeAmount={receipt.change}
          onClose={() => setReceipt(null)}
        />
      )}

      {/* ── Barcode scanner modal (fixed) ────────────────────── */}
      {scanning && <BarcodeScanner onResult={handleBarcode} onClose={closeScanner} />}
    </div>
  );
}

function ProductThumbnail({ product }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]">
      {product.imageUrl && !imageFailed ? (
        <img
          src={product.imageUrl}
          alt=""
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <Package size={28} strokeWidth={1.4} className="text-[#b8a783]" aria-hidden="true" />
      )}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/10 to-transparent" aria-hidden="true" />
    </div>
  );
}

/* ── Fixed Barcode Scanner with camera selection & fallback ── */
function BarcodeScanner({ onResult, onClose }) {
  const [error, setError] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const scannerRef = useRef(null);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    let mounted = true;
    let lifecycle = null;

    async function initScanner() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted) return;
        const element = scannerRef.current;
        if (!element) throw new Error('Scanner container not found');

        const html5QrCode = new Html5Qrcode(element.id);
        lifecycle = createBarcodeScannerLifecycle(html5QrCode, {
          onError: err => {
            if (mounted) setError(err.message || 'Failed to start camera');
          }
        });
        const cameras = await Html5Qrcode.getCameras();
        if (!mounted) return;
        if (!cameras || cameras.length === 0) {
          toast.error('No camera found on this device');
          setError('No camera available');
          return;
        }

        const backCamera = cameras.find(
          camera => /back|rear/i.test(camera.label || '')
        ) || cameras[0];

        lifecycle.scheduleStart(backCamera.id, {
          fps: 10,
          qrbox: { width: 250, height: 120 },
          aspectRatio: 1.777
        }, decodedText => {
          if (mounted) onResultRef.current(decodedText);
        });
      } catch (err) {
        console.error('Init error:', err);
        if (mounted) setError(err.message || 'Could not access camera');
      }
    }

    initScanner();

    return () => {
      mounted = false;
      if (lifecycle) lifecycle.close();
    };
  }, []);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onResult(manualCode.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#151515]/75 p-3 backdrop-blur-sm sm:p-4" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="barcode-dialog-title"
        aria-describedby="barcode-dialog-description"
        ref={dialogRef}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
            return;
          }
          if (event.key !== 'Tab' || !dialogRef.current) return;
          const focusable = Array.from(dialogRef.current.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )).filter(element => element.tabIndex >= 0 && element.getAttribute('aria-hidden') !== 'true');
          if (focusable.length === 0) {
            event.preventDefault();
            return;
          }
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
            event.preventDefault();
            first.focus();
          }
        }}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-xl)] sm:p-5"
      >
        <p id="barcode-dialog-description" className="sr-only">
          Scan a product barcode with the camera or enter a barcode or SKU manually.
        </p>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#927746]">Product lookup</p>
            <h3 id="barcode-dialog-title" className="mt-1 text-lg font-semibold text-[var(--color-text)]">Scan barcode</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            ref={closeButtonRef}
            aria-label="Close barcode scanner"
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="text-center p-6">
            <p role="alert" className="mb-4 text-sm font-medium text-[var(--color-danger)]">{error}</p>
            <p className="mb-3 text-xs text-[var(--color-text-secondary)]">Enter the barcode or SKU manually:</p>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Barcode or SKU"
                aria-label="Enter barcode or SKU"
                className="h-11 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm outline-none transition focus:border-[var(--color-gold)] focus:shadow-[var(--focus-ring)]"
                autoFocus
              />
              <Button type="submit" variant="primary" size="sm">
                Find
              </Button>
            </form>
          </div>
        ) : (
          <>
            {/* Fixed scanner container with black background and min height */}
            <div
              id="qr-reader"
              className="min-h-[240px] overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-primary)] sm:min-h-[300px]"
              ref={scannerRef}
            />
            <p className="mt-3 text-center text-xs font-medium text-[var(--color-text-secondary)]">
              Position the barcode inside the frame
            </p>
            <p className="mt-2 text-center text-xs text-[var(--color-text-muted)]">Or enter a barcode or SKU:</p>
            <form onSubmit={handleManualSubmit} className="mt-3 flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Barcode or SKU"
                aria-label="Enter barcode or SKU"
                className="h-11 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm outline-none transition focus:border-[var(--color-gold)] focus:shadow-[var(--focus-ring)]"
              />
              <Button type="submit" variant="primary" size="sm">
                Find
              </Button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}