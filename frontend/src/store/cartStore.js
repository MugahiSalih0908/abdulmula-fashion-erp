// src/store/cartStore.js – full POS cart with cash/change logic

import { create } from 'zustand';
import { calculateCashChange, calculateInvoiceTotals } from '../../../shared/invoiceCalculations.mjs';
import { getSellableUnitCount, getStockStatus } from '../utils/posStock.mjs';

const getTotals = (state) => calculateInvoiceTotals(
  state.items.map(item => ({
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    discount: item.discount || 0
  })),
  state.taxRate
);

const useCartStore = create((set, get) => ({
  items:         [],
  customer:      null,
  paymentMethod: 'Cash',
  taxRate:       0,
  note:          '',
  cashReceived:  0,

  addItem: (product, qty = 1) => {
    if (!product || !Number.isInteger(qty) || qty <= 0) {
      return { ok: false, status: 'invalid-quantity' };
    }
    const stockStatus = getStockStatus(product.quantity);
    if (stockStatus !== 'available') {
      const existing = get().items.find(item => item.product._id === product._id);
      if (existing) get().removeItem(product._id);
      return {
        ok: false,
        status: stockStatus,
        cartReconciled: existing ? 'removed' : 'unchanged'
      };
    }

    const maxQuantity = getSellableUnitCount(product.quantity);
    const items    = get().items;
    const existing = items.find(i => i.product._id === product._id);
    if (existing) {
      const currentQuantity = Number(existing.quantity);
      if (!Number.isInteger(currentQuantity) || currentQuantity < 1) {
        set({ items: items.filter(item => item.product._id !== product._id) });
        return { ok: false, status: 'invalid-cart-quantity' };
      }
      if (currentQuantity > maxQuantity) {
        set({ items: items.map(item => item.product._id === product._id
          ? { ...item, product, quantity: maxQuantity }
          : item) });
        return { ok: true, status: 'stock-adjusted', quantity: maxQuantity };
      }
      const nextQuantity = Math.min(currentQuantity + qty, maxQuantity);
      set({ items: items.map(item => item.product._id === product._id
        ? { ...item, product, quantity: nextQuantity }
        : item) });
      return {
        ok: true,
        status: nextQuantity < currentQuantity + qty ? 'stock-limit' : 'added',
        quantity: nextQuantity
      };
    } else {
      const quantity = Math.min(qty, maxQuantity);
      set({ items: [...items, { product, quantity, unitPrice: product.price, discount: 0 }] });
      return {
        ok: true,
        status: quantity < qty ? 'stock-limit' : 'added',
        quantity
      };
    }
  },

  setQty: (productId, qty) => {
    if (qty <= 0) { get().removeItem(productId); return; }
    const product = get().items.find(i => i.product._id === productId)?.product;
    if (!Number.isInteger(qty)) return { ok: false, status: 'invalid-quantity' };
    const maxQuantity = product ? getSellableUnitCount(product.quantity) : 0;
    if (maxQuantity < 1) {
      get().removeItem(productId);
      return { ok: false, status: getStockStatus(product?.quantity) };
    }
    const capped  = Math.min(qty, maxQuantity);
    set({ items: get().items.map(i => i.product._id === productId ? { ...i, quantity: capped } : i) });
    return { ok: true, status: capped < qty ? 'stock-limit' : 'updated', quantity: capped };
  },

  setDiscount: (productId, discount) => {
    const amount = Number(discount);
    const item = get().items.find(i => i.product._id === productId);
    if (!item || !Number.isFinite(amount) || amount < 0 || amount > item.unitPrice * item.quantity) return false;
    set({ items: get().items.map(i =>
      i.product._id === productId ? { ...i, discount: amount } : i
    ) });
    return true;
  },

  removeItem: (productId) =>
    set({ items: get().items.filter(i => i.product._id !== productId) }),

  clearCart: () =>
    set({ items: [], customer: null, paymentMethod: 'Cash', taxRate: 0, note: '', cashReceived: 0 }),

  setCustomer:      (c)  => set({ customer: c }),
  setPaymentMethod: (pm) => set({ paymentMethod: pm }),
  setTaxRate:       (r)  => {
    const rate = Number(r);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return false;
    set({ taxRate: rate });
    return true;
  },
  setNote:          (n)  => set({ note: n }),
  setCashReceived:  (v)  => set({ cashReceived: parseFloat(v) || 0 }),

  itemCount:    () => get().items.reduce((s, i) => s + i.quantity, 0),
  subtotal:     () => getTotals(get()).subtotal,
  discountTotal:() => getTotals(get()).discountTotal,
  taxAmount:    () => getTotals(get()).taxAmount,
  grandTotal:   () => getTotals(get()).grandTotal,
  changeAmount: () => calculateCashChange(get().cashReceived, get().grandTotal()),

  toInvoicePayload: () => ({
    items: get().items.map(i => ({
      productId: i.product._id,
      productName: i.product.name,
      quantity:  i.quantity,
      unitPrice: i.unitPrice,
      discount:  i.discount || 0
    })),
    paymentMethod: get().paymentMethod,
    taxRate:       get().taxRate,
    customerId:    get().customer?._id,
    note:          get().note,
    cashReceived:  get().paymentMethod === 'Cash' ? get().cashReceived : undefined,
    amountPaid:    get().paymentMethod === 'Credit'
                     ? 0
                     : get().paymentMethod === 'Cash'
                       ? Math.max(0, Math.min(get().cashReceived, get().grandTotal()))
                       : get().grandTotal()
  })
}));

export default useCartStore;
