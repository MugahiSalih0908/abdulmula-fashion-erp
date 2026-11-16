export const PURCHASE_ORDER_STATUSES = [
  'draft',
  'ordered',
  'received',
  'partial',
  'paid'
];

export function filterPurchaseOrders(orders = [], search = '') {
  const query = String(search || '').trim().toLocaleLowerCase();
  if (!query) return orders;

  return orders.filter(order => [
    order.poNumber,
    order.supplierName,
    order.supplier?.name,
    order.status,
    ...(order.items || []).map(item => item.productName)
  ].filter(Boolean).join(' ').toLocaleLowerCase().includes(query));
}

export function summarizePurchaseOrders(orders = []) {
  return orders.reduce((summary, order) => {
    const grandTotal = Number(order.grandTotal);
    const balanceDue = Number(order.balanceDue);
    summary.count += 1;
    summary.value += Number.isFinite(grandTotal) ? grandTotal : 0;
    summary.balanceDue += Number.isFinite(balanceDue) ? balanceDue : 0;
    if (order.status === 'draft') summary.drafts += 1;
    if (order.status === 'ordered') summary.awaitingReceipt += 1;
    if (order.status === 'received') summary.received += 1;
    if (order.status === 'partial') summary.partiallyPaid += 1;
    if (order.status === 'paid') summary.paid += 1;
    return summary;
  }, {
    count: 0,
    value: 0,
    balanceDue: 0,
    drafts: 0,
    awaitingReceipt: 0,
    received: 0,
    partiallyPaid: 0,
    paid: 0
  });
}

export function calculateOrderPreview(items = [], discount = 0) {
  const subtotal = items.reduce((sum, item) => {
    const quantity = Number(item?.quantity);
    const unitCost = Number(item?.unitCost);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || !Number.isFinite(unitCost) || unitCost < 0) return sum;
    return sum + quantity * unitCost;
  }, 0);
  const safeSubtotal = Math.round((subtotal + Number.EPSILON) * 100) / 100;
  const parsedDiscount = Number(discount);
  const safeDiscount = Number.isFinite(parsedDiscount) && parsedDiscount > 0
    ? Math.min(Math.round((parsedDiscount + Number.EPSILON) * 100) / 100, safeSubtotal)
    : 0;
  return {
    subtotal: safeSubtotal,
    discount: safeDiscount,
    grandTotal: Math.max(0, Math.round((safeSubtotal - safeDiscount + Number.EPSILON) * 100) / 100)
  };
}

export function normalizePurchaseOrderPayload(values = {}) {
  const note = String(values.note ?? '').trim();
  return {
    supplierId: String(values.supplierId || ''),
    items: (Array.isArray(values.items) ? values.items : []).map(item => ({
      productId: String(item.productId || ''),
      quantity: Number(item.quantity),
      unitCost: Number(item.unitCost)
    })),
    discount: Number(values.discount || 0),
    ...(note ? { note } : {})
  };
}

export function isValidPurchaseOrderPayload(values = {}) {
  const payload = normalizePurchaseOrderPayload(values);
  if (!payload.supplierId || payload.items.length < 1 || payload.items.length > 100) return false;
  if (!payload.items.every(item =>
    item.productId &&
    Number.isSafeInteger(item.quantity) &&
    item.quantity > 0 &&
    Number.isFinite(item.unitCost) &&
    item.unitCost >= 0
  )) return false;
  const totals = calculateOrderPreview(payload.items, payload.discount);
  return Number.isFinite(payload.discount) && payload.discount >= 0 && payload.discount <= totals.subtotal && String(payload.note || '').length <= 400;
}

export function normalizeSupplierPaymentPayload(values = {}) {
  const reference = String(values.reference ?? '').trim();
  const note = String(values.note ?? '').trim();
  return {
    amount: Number(values.amount),
    paymentMethod: String(values.paymentMethod || 'Cash'),
    date: String(values.date || ''),
    ...(reference ? { reference } : {}),
    ...(note ? { note } : {})
  };
}

export function isValidSupplierPaymentPayload(values = {}, balanceDue = 0) {
  const payload = normalizeSupplierPaymentPayload(values);
  return Number.isFinite(payload.amount) &&
    payload.amount > 0 &&
    payload.amount <= Number(balanceDue) + 0.000001 &&
    ['Cash', 'Bank Transfer', 'Mobile Transfer', 'Other'].includes(payload.paymentMethod) &&
    /^\d{4}-\d{2}-\d{2}$/.test(payload.date) &&
    (payload.reference || '').length <= 100 &&
    (payload.note || '').length <= 300;
}
