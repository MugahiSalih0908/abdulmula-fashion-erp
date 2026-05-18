// src/store/cartStore.js – full POS cart with cash/change logic

import { create } from 'zustand';

const useCartStore = create((set, get) => ({
  items:         [],
  customer:      null,
  paymentMethod: 'Cash',
  taxRate:       0,
  note:          '',
  cashReceived:  0,

  addItem: (product, qty = 1) => {
    const items    = get().items;
    const existing = items.find(i => i.product._id === product._id);
    if (existing) {
      set({ items: items.map(i =>
        i.product._id === product._id
          ? { ...i, quantity: Math.min(i.quantity + qty, i.product.quantity) }
          : i
      )});
    } else {
      set({ items: [...items, { product, quantity: qty, unitPrice: product.price, discount: 0 }] });
    }
  },

  setQty: (productId, qty) => {
    if (qty <= 0) { get().removeItem(productId); return; }
    const product = get().items.find(i => i.product._id === productId)?.product;
    const capped  = product ? Math.min(qty, product.quantity) : qty;
    set({ items: get().items.map(i => i.product._id === productId ? { ...i, quantity: capped } : i) });
  },

  setDiscount: (productId, discount) =>
    set({ items: get().items.map(i =>
      i.product._id === productId ? { ...i, discount: Math.max(0, parseFloat(discount) || 0) } : i
    ) }),

  removeItem: (productId) =>
    set({ items: get().items.filter(i => i.product._id !== productId) }),

  clearCart: () =>
    set({ items: [], customer: null, paymentMethod: 'Cash', taxRate: 0, note: '', cashReceived: 0 }),

  setCustomer:      (c)  => set({ customer: c }),
  setPaymentMethod: (pm) => set({ paymentMethod: pm }),
  setTaxRate:       (r)  => set({ taxRate: parseFloat(r) || 0 }),
  setNote:          (n)  => set({ note: n }),
  setCashReceived:  (v)  => set({ cashReceived: parseFloat(v) || 0 }),

  itemCount:    () => get().items.reduce((s, i) => s + i.quantity, 0),
  subtotal:     () => get().items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
  discountTotal:() => get().items.reduce((s, i) => s + (i.discount || 0), 0),
  taxAmount:    () => {
    const net = get().subtotal() - get().discountTotal();
    return net * (get().taxRate / 100);
  },
  grandTotal:   () => get().subtotal() - get().discountTotal() + get().taxAmount(),
  changeAmount: () => Math.max(0, get().cashReceived - get().grandTotal()),

  toInvoicePayload: () => ({
    items: get().items.map(i => ({
      productId: i.product._id,
      quantity:  i.quantity,
      unitPrice: i.unitPrice,
      discount:  i.discount || 0
    })),
    paymentMethod: get().paymentMethod,
    taxRate:       get().taxRate,
    customerId:    get().customer?._id,
    note:          get().note,
    amountPaid:    get().paymentMethod === 'Cash'
                     ? Math.min(get().cashReceived, get().grandTotal())
                     : get().grandTotal()
  })
}));

export default useCartStore;
