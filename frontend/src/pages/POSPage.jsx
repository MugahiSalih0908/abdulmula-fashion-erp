// src/pages/POSPage.jsx – complete real-world POS cashier workflow (fixed barcode scanner)
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../services/api';
import useCartStore from '../store/cartStore';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { saveSaleOffline, getOfflineProducts, cacheProducts } from '../offline/syncManager';
import CartDrawer from '../components/pos/CartDrawer';
import ReceiptModal from '../components/pos/ReceiptModal';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Search, ScanLine, ShoppingCart, X, Wifi, WifiOff } from 'lucide-react';

const CATEGORIES = ['All', 'Men', 'Women', 'Girls', 'Boys', 'Kids', 'Sudanese Silk Toub Wraps', 'Accessories', 'Other'];

export default function POSPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [cartOpen, setCartOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [scanning, setScanning] = useState(false);

  const cart = useCartStore();
  const { isOnline } = useOnlineStatus();
  const queryClient = useQueryClient();

  // ── Load products ────────────────────────────────────────────
  const { data: apiProducts = [], isLoading } = useQuery({
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
  useEffect(() => {
    if (!isOnline) getOfflineProducts().then(setOfflineProds);
  }, [isOnline]);

  const allProducts = isOnline ? apiProducts : offlineProds;

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
  const filtered = allProducts.filter((p) => {
    if (!p) return false;
    const q = (search || '').toLowerCase();
    const name = p.name || '';
    const sku = p.sku || '';
    const barcode = p.barcode || '';
    const productCategory = p.category || 'Other';

    const matchSearch =
      !search ||
      name.toLowerCase().includes(q) ||
      sku.toLowerCase().includes(q) ||
      barcode.includes(search);

    const matchCat = category === 'All' || productCategory === category;

    return matchSearch && matchCat && (p.quantity || 0) > 0;
  });

  // ── Checkout mutation ────────────────────────────────────────
  const { mutate: checkout, isPending: isCheckingOut } = useMutation({
    mutationFn: async (payload) => {
      if (isOnline) {
        const { data } = await api.post('/invoices', payload);
        return data.data;
      }
      const offlineId = await saveSaleOffline(payload);
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
      const change = cart.changeAmount();
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
    checkout({ ...cart.toInvoicePayload() });
  };

  // ── Barcode scan result (now uses stable scanner) ────────────
  const handleBarcode = useCallback(
    (code) => {
      const product = allProducts.find(p => p.barcode === code || p.sku === code);
      if (product) {
        cart.addItem(product);
        toast.success(`Added: ${product.name}`, { duration: 1500 });
      } else {
        toast.error(`No product found: ${code}`);
      }
      setScanning(false);
    },
    [allProducts, cart]
  );

  const itemCount = cart.itemCount();
  const grandTotal = cart.grandTotal();

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* ── Search + scan ────────────────────────────────────── */}
      <div className="bg-white px-4 pt-3 pb-2 shadow-sm z-10 border-b border-gray-100">
        <div className="flex gap-2 items-center mb-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product, SKU or barcode…"
              className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition bg-gray-50"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => setScanning(true)}
            className="p-3 rounded-lg text-white flex items-center justify-center hover:opacity-90 transition flex-shrink-0"
            style={{ background: '#16a34a' }}
            title="Scan barcode"
          >
            <ScanLine size={20} />
          </button>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 mb-3">
          <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full ${isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {isOnline ? (
              <>
                <Wifi size={12} />
                Online
              </>
            ) : (
              <>
                <WifiOff size={12} />
                Offline Mode
              </>
            )}
          </div>
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto py-2 no-scrollbar">
          {CATEGORIES.map((cat) => (
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
      </div>

      {/* ── Product grid ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📦</p>
            <p className="font-semibold text-gray-500">No products found</p>
            {search && <p className="text-sm mt-2 text-gray-400">Try a different search term</p>}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {filtered.map((product) => {
              const inCart = cart.items.find((i) => i?.product?._id === product?._id);
              return (
                <motion.button
                  key={product._id}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => {
                    if (!product) return;
                    cart.addItem(product);
                    toast.success(`+ ${product.name || 'Product'}`, {
                      duration: 800,
                      style: { fontSize: '13px' }
                    });
                  }}
                  className={`bg-white rounded-lg p-3 text-left shadow-sm transition-all relative overflow-hidden border-2 ${
                    inCart ? 'border-emerald-500 ring-1 ring-emerald-200' : 'border-transparent hover:shadow-md'
                  }`}
                >
                  {/* In-cart badge */}
                  {inCart && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white bg-emerald-600">
                      {inCart.quantity}
                    </div>
                  )}

                  <div className="mb-2">
                    <Badge variant="secondary" className="text-xs">
                      {product.category || 'Other'}
                    </Badge>
                  </div>

                  <p className="font-semibold text-sm text-gray-900 leading-tight mb-1 pr-6 line-clamp-2">
                    {product.name}
                  </p>

                  {product.sku && <p className="text-xs text-gray-500 font-mono mb-2">{product.sku}</p>}

                  <div className="flex items-end justify-between mt-2 pt-2 border-t border-gray-100">
                    <p className="font-bold text-base text-emerald-600">${(product.price || 0).toFixed(2)}</p>
                    <p
                      className={`text-xs font-medium ${
                        product.quantity <= product.lowStockThreshold ? 'text-red-600' : 'text-gray-500'
                      }`}
                    >
                      {product.quantity} left
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Bottom spacer for the sticky cart button */}
        <div className="h-24" />
      </div>

      {/* ── Sticky cart button ─────────────────────────────────── */}
      {itemCount > 0 && (
        <div className="sticky bottom-0 px-4 pb-4 bg-gradient-to-t from-white via-white to-transparent">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full text-white py-4 rounded-lg flex items-center justify-between px-5 font-bold text-base shadow-lg hover:shadow-xl transition-shadow"
            style={{ background: '#16a34a' }}
          >
            <div className="flex items-center gap-3">
              <ShoppingCart size={20} />
              <Badge variant="secondary" className="bg-white text-emerald-700 font-bold">
                {itemCount}
              </Badge>
            </div>
            <span>View Cart</span>
            <span className="text-emerald-100 font-mono">${(grandTotal || 0).toFixed(2)}</span>
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
      {scanning && <BarcodeScanner onResult={handleBarcode} onClose={() => setScanning(false)} />}
    </div>
  );
}

/* ── Fixed Barcode Scanner with camera selection & fallback ── */
function BarcodeScanner({ onResult, onClose }) {
  const [error, setError] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const scannerRef = useRef(null);

  useEffect(() => {
    let html5QrCode = null;
    let mounted = true;

    async function initScanner() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');

        // Ensure DOM element exists
        const element = document.getElementById('qr-reader');
        if (!element) throw new Error('Scanner container not found');

        html5QrCode = new Html5Qrcode('qr-reader');

        // Get available cameras
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) {
          toast.error('No camera found on this device');
          if (mounted) setError('No camera available');
          return;
        }

        // Prefer rear/back camera on phones
        const backCamera = cameras.find(
          (c) =>
            c.label.toLowerCase().includes('back') ||
            c.label.toLowerCase().includes('rear')
        ) || cameras[0];

        // Small delay to ensure DOM is ready
        setTimeout(async () => {
          if (!mounted) return;
          try {
            await html5QrCode.start(
              backCamera.id,
              {
                fps: 10,
                qrbox: { width: 250, height: 120 },
                aspectRatio: 1.777
              },
              (decodedText) => {
                html5QrCode.stop().catch(console.error);
                if (mounted) onResult(decodedText);
              },
              () => {} // ignore scanning errors
            );
          } catch (err) {
            console.error('Start error:', err);
            if (mounted) setError(err.message || 'Failed to start camera');
          }
        }, 300);
      } catch (err) {
        console.error('Init error:', err);
        if (mounted) setError(err.message || 'Could not access camera');
      }
    }

    initScanner();

    return () => {
      mounted = false;
      if (html5QrCode && typeof html5QrCode.stop === 'function') {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [onResult]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onResult(manualCode.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-xl p-4 w-full max-w-sm shadow-2xl"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg text-gray-900">Scan Barcode / QR</h3>
          <button
            onClick={onClose}
            className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="text-center p-6">
            <p className="text-red-600 text-sm mb-4 font-medium">{error}</p>
            <p className="text-gray-600 text-xs mb-3">Enter the barcode manually:</p>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Enter barcode / SKU"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                autoFocus
              />
              <Button type="submit" variant="primary" size="sm">
                Add
              </Button>
            </form>
          </div>
        ) : (
          <>
            {/* Fixed scanner container with black background and min height */}
            <div
              id="qr-reader"
              className="rounded-lg overflow-hidden bg-black"
              style={{ width: '100%', minHeight: '300px' }}
              ref={scannerRef}
            />
            <p className="text-xs text-center text-gray-600 mt-3 font-medium">
              Position the barcode inside the frame
            </p>
            <p className="text-xs text-center text-gray-500 mt-2">Or enter manually:</p>
            <form onSubmit={handleManualSubmit} className="flex gap-2 mt-3">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Enter barcode / SKU"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
              <Button type="submit" variant="primary" size="sm">
                Add
              </Button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}