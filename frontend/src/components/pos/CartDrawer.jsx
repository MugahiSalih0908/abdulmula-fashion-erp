// src/components/pos/CartDrawer.jsx
// Full mobile cart drawer: items, qty controls, discount, payment, cash/change, checkout

import { useState }       from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast              from 'react-hot-toast';
import useCartStore       from '../../store/cartStore';
import {
  X, Plus, Minus, Trash2, User, ChevronRight,
  Banknote, CreditCard, Smartphone, Tag, Percent
} from 'lucide-react';

const PAYMENT_METHODS = [
  { id: 'Cash',            icon: Banknote,    label: 'Cash'   },
  { id: 'Credit',          icon: CreditCard,  label: 'Credit' },
  { id: 'Mobile Transfer', icon: Smartphone,  label: 'Mobile' },
];

export default function CartDrawer({ open, onClose, customers, onCheckout, isCheckingOut }) {
  const cart         = useCartStore();
  const [step, setStep] = useState('items'); // 'items' | 'payment'

  const items        = cart.items;
  const itemCount    = cart.itemCount();
  const subtotal     = cart.subtotal();
  const discTotal    = cart.discountTotal();
  const taxAmt       = cart.taxAmount();
  const grandTotal   = cart.grandTotal();
  const changeAmt    = cart.changeAmount();

  const handleClose = () => { setStep('items'); onClose(); };

  const handleCheckout = () => {
    if (!items.length) { toast.error('Cart is empty.'); return; }
    if (cart.paymentMethod === 'Cash' && cart.cashReceived < grandTotal) {
      toast.error(`Cash received ($${cart.cashReceived.toFixed(2)}) is less than total ($${grandTotal.toFixed(2)})`);
      return;
    }
    onCheckout();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={handleClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b bg-white"
                 style={{ borderBottom: '2px solid #d4a017' }}>
              <div className="flex items-center gap-2">
                <button onClick={handleClose} className="p-1.5 bg-gray-100 rounded-full">
                  <X size={18} />
                </button>
                <h2 className="font-bold text-lg">Cart</h2>
                {itemCount > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-black"
                        style={{ background: '#d4a017' }}>
                    {itemCount}
                  </span>
                )}
              </div>
              {items.length > 0 && (
                <button onClick={cart.clearCart} className="text-red-400 text-xs font-semibold">
                  Clear all
                </button>
              )}
            </div>

            {/* Step tabs */}
            {items.length > 0 && (
              <div className="flex bg-gray-100 mx-4 mt-3 rounded-xl p-1">
                <button
                  onClick={() => setStep('items')}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                    step === 'items' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  Items ({items.length})
                </button>
                <button
                  onClick={() => setStep('payment')}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                    step === 'payment' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  Payment
                </button>
              </div>
            )}

            {/* ── Items step ──────────────────────────────────── */}
            {step === 'items' && (
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {items.length === 0 ? (
                  <div className="text-center py-20 text-gray-400">
                    <p className="text-4xl mb-3">🛒</p>
                    <p className="font-semibold">Cart is empty</p>
                    <p className="text-sm mt-1">Tap products to add them</p>
                  </div>
                ) : (
                  items.map(item => (
                    <CartItem key={item.product._id} item={item} cart={cart} />
                  ))
                )}
              </div>
            )}

            {/* ── Payment step ────────────────────────────────── */}
            {step === 'payment' && (
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

                {/* Customer selector */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                    Customer (optional)
                  </label>
                  <select
                    value={cart.customer?._id || ''}
                    onChange={e => {
                      const c = customers?.find(c => c._id === e.target.value) || null;
                      cart.setCustomer(c);
                    }}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none"
                    style={{ focusBorderColor: '#d4a017' }}
                  >
                    <option value="">Walk-in customer</option>
                    {customers?.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.name} {c.creditBalance > 0 ? `(owes $${c.creditBalance.toFixed(2)})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment method */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map(({ id, icon: Icon, label }) => (
                      <button
                        key={id}
                        onClick={() => cart.setPaymentMethod(id)}
                        className={`flex flex-col items-center py-3 rounded-2xl border-2 transition-all text-sm font-semibold ${
                          cart.paymentMethod === id
                            ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                            : 'border-gray-200 bg-white text-gray-500'
                        }`}
                      >
                        <Icon size={20} className="mb-1" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cash received + change (only for Cash) */}
                {cart.paymentMethod === 'Cash' && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                      Cash Received
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={cart.cashReceived || ''}
                        onChange={e => cart.setCashReceived(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl pl-8 pr-4 py-3 text-lg font-bold focus:outline-none"
                        placeholder={grandTotal.toFixed(2)}
                        style={{ borderColor: cart.cashReceived >= grandTotal ? '#d4a017' : undefined }}
                      />
                    </div>
                    {/* Quick amount buttons */}
                    <div className="flex gap-2 mt-2">
                      {[grandTotal, Math.ceil(grandTotal/5)*5, Math.ceil(grandTotal/10)*10, Math.ceil(grandTotal/50)*50]
                        .filter((v, i, a) => a.indexOf(v) === i)
                        .slice(0, 4)
                        .map(amt => (
                          <button
                            key={amt}
                            onClick={() => cart.setCashReceived(amt)}
                            className="flex-1 py-2 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700"
                          >
                            ${amt.toFixed(0)}
                          </button>
                        ))
                      }
                    </div>

                    {/* Change */}
                    {cart.cashReceived >= grandTotal && (
                      <div className="mt-3 p-3 rounded-2xl flex items-center justify-between"
                           style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <span className="font-semibold text-green-700 text-sm">Change Due</span>
                        <span className="font-black text-2xl text-green-600">
                          ${changeAmt.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tax rate */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block flex items-center gap-1">
                    <Percent size={12} /> Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={cart.taxRate || ''}
                    onChange={e => cart.setTaxRate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none"
                    placeholder="0"
                  />
                </div>

                {/* Note */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                    Note (optional)
                  </label>
                  <input
                    type="text"
                    value={cart.note}
                    onChange={e => cart.setNote(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none"
                    placeholder="e.g. wholesale order"
                  />
                </div>
              </div>
            )}

            {/* ── Order summary + CTA ──────────────────────────── */}
            {items.length > 0 && (
              <div className="border-t bg-white px-4 pt-3 pb-4"
                   style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>

                {/* Totals */}
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  {discTotal > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>−${discTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {taxAmt > 0 && (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Tax ({cart.taxRate}%)</span>
                      <span>${taxAmt.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-xl pt-1 border-t border-gray-100">
                    <span>Total</span>
                    <span style={{ color: '#d4a017' }}>${grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                {step === 'items' ? (
                  <button
                    onClick={() => setStep('payment')}
                    className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-between px-5 text-black"
                    style={{ background: '#d4a017' }}
                  >
                    <span>Proceed to Payment</span>
                    <ChevronRight size={20} />
                  </button>
                ) : (
                  <button
                    onClick={handleCheckout}
                    disabled={isCheckingOut}
                    className="w-full text-white py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{ background: '#111' }}
                  >
                    {isCheckingOut
                      ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : `Complete Sale — $${grandTotal.toFixed(2)}`
                    }
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Single cart item row ─────────────────────────────────────── */
function CartItem({ item, cart }) {
  const [showDiscount, setShowDiscount] = useState(false);

  return (
    <div className="bg-gray-50 rounded-2xl p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{item.product.name}</p>
          <p className="text-xs text-gray-400">${item.unitPrice.toFixed(2)} each</p>
        </div>
        <button onClick={() => cart.removeItem(item.product._id)} className="text-gray-300 hover:text-red-400 mt-0.5">
          <Trash2 size={15} />
        </button>
      </div>

      <div className="flex items-center justify-between mt-2.5">
        {/* Qty controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => cart.setQty(item.product._id, item.quantity - 1)}
            className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm"
          >
            <Minus size={14} />
          </button>
          <input
            type="number"
            min="1"
            max={item.product.quantity}
            value={item.quantity}
            onChange={e => cart.setQty(item.product._id, parseInt(e.target.value) || 1)}
            className="w-10 text-center font-bold text-sm border-0 bg-transparent focus:outline-none"
          />
          <button
            onClick={() => cart.setQty(item.product._id, item.quantity + 1)}
            disabled={item.quantity >= item.product.quantity}
            className="w-8 h-8 rounded-full text-white flex items-center justify-center shadow-sm disabled:opacity-40"
            style={{ background: '#111' }}
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Line total + discount toggle */}
        <div className="text-right">
          <p className="font-bold text-sm">${(item.unitPrice * item.quantity - (item.discount || 0)).toFixed(2)}</p>
          <button
            onClick={() => setShowDiscount(!showDiscount)}
            className="text-xs flex items-center gap-0.5"
            style={{ color: '#d4a017' }}
          >
            <Tag size={11} />
            {item.discount > 0 ? `−$${item.discount.toFixed(2)}` : 'Discount'}
          </button>
        </div>
      </div>

      {/* Inline discount input */}
      <AnimatePresence>
        {showDiscount && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-xs text-gray-500">Discount $</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.discount || ''}
                onChange={e => cart.setDiscount(item.product._id, e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                placeholder="0.00"
                autoFocus
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
