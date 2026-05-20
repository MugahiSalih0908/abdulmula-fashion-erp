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
import { Search, ScanLine, ShoppingCart, X } from 'lucide-react';

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
    <div className="flex flex-col h-full bg-gray-100 overflow-hidden">
      {/* ── Search + scan ────────────────────────────────────── */}
      <div className="bg-white px-3 pt-3 pb-2 shadow-sm z-10">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search product, SKU or barcode…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none bg-gray-50"
              style={{ '--tw-ring-color': '#d4a017' }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={15} />
              </button>
            )}
          </div>
          <button
            onClick={() => setScanning(true)}
            className="p-2.5 rounded-xl text-white flex items-center justify-center"
            style={{ background: '#111' }}
          >
            <ScanLine size={20} />
          </button>
        </div>

        {/* Category pills */}
        <div className="flex gap-1.5 overflow-x-auto py-2 no-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors"
              style={category === cat ? { background: '#111', color: '#fff' } : { background: '#f3f4f6', color: '#6b7280' }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Product grid ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-3xl mb-2">📦</p>
            <p className="font-semibold">No products found</p>
            {search && <p className="text-sm mt-1">Try a different search term</p>}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(product => {
              const inCart = cart.items.find(i => i?.product?._id === product?._id);
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
                  className="bg-white rounded-2xl p-3 text-left shadow-sm transition-all relative overflow-hidden"
                  style={inCart ? { border: '2px solid #d4a017' } : { border: '2px solid transparent' }}
                >
                  {/* In-cart badge */}
                  {inCart && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-black"
                         style={{ background: '#d4a017' }}>
                      {inCart.quantity}
                    </div>
                  )}

                  <div className="mb-1.5">
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                      {product.category || 'Other'}
                    </span>
                  </div>

                  <p className="font-semibold text-sm text-gray-900 leading-tight mb-1 pr-6">{product.name}</p>

                  {product.sku && <p className="text-xs text-gray-400 font-mono mb-1">{product.sku}</p>}

                  <div className="flex items-end justify-between mt-1">
                    <p className="font-black text-base" style={{ color: '#d4a017' }}>
                      ${(product.price || 0).toFixed(2)}
                    </p>
                    <p className={`text-xs font-medium ${product.quantity <= product.lowStockThreshold ? 'text-red-500' : 'text-gray-400'}`}>
                      {product.quantity} left
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Bottom spacer for the sticky cart button */}
        <div className="h-20" />
      </div>

      {/* ── Sticky cart button ─────────────────────────────────── */}
      {itemCount > 0 && (
        <div className="sticky bottom-0 px-3 pb-3 bg-transparent">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full text-white py-4 rounded-2xl flex items-center justify-between px-5 font-bold text-base shadow-xl"
            style={{ background: '#111' }}
          >
            <div className="flex items-center gap-2">
              <ShoppingCart size={20} />
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-black text-black"
                    style={{ background: '#d4a017' }}>
                {itemCount}
              </span>
            </div>
            <span>View Cart</span>
            <span style={{ color: '#d4a017' }}>${(grandTotal || 0).toFixed(2)}</span>
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

/* ── Fixed Barcode Scanner using Html5Qrcode (direct camera) ── */
function BarcodeScanner({ onResult, onClose }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    let html5QrCode = null;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        html5QrCode = new Html5Qrcode('qr-reader');

        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) {
          throw new Error('No camera found on this device');
        }

        const cameraId = cameras[0].id; // Use first camera (usually back camera on phones)

        await html5QrCode.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 280, height: 180 },
          },
          (decodedText) => {
            // Stop scanner after successful scan
            html5QrCode.stop().catch(console.error);
            onResult(decodedText);
          },
          (errorMessage) => {
            // Silent ignore – scanning continues
          }
        );
      } catch (err) {
        console.error('Scanner error:', err);
        toast.error('Could not start camera. Please check permissions.');
        onClose(); // Close scanner modal on fatal error
      }
    }

    startScanner();

    return () => {
      if (html5QrCode && typeof html5QrCode.stop === 'function') {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [onResult, onClose]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-4 w-full max-w-sm">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-gray-900">Scan Barcode / QR</h3>
          <button onClick={onClose} className="p-1.5 bg-gray-100 rounded-full hover:bg-gray-200 transition">
            <X size={16} />
          </button>
        </div>
        <div id="qr-reader" ref={scannerRef} className="rounded-xl overflow-hidden" />
        <p className="text-xs text-center text-gray-500 mt-3">Position the barcode inside the frame</p>
      </div>
    </div>
  );
}