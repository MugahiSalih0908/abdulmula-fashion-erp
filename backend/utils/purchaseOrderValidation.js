const PAYMENT_METHODS = Object.freeze([
  'Cash',
  'Bank Transfer',
  'Mobile Transfer',
  'Other'
]);

const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function createValidationError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function calculatePurchaseOrderTotals(items, discount = 0) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
    throw createValidationError('A purchase order must contain between 1 and 100 items.');
  }

  const normalizedItems = items.map((item, index) => {
    const productId = String(item?.productId || item?.product || '').trim();
    const quantity = Number(item?.quantity);
    const unitCost = Number(item?.unitCost);

    if (!productId) throw createValidationError('Select a product for each line item.');
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      throw createValidationError('Item quantity must be a whole number greater than zero.');
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      throw createValidationError('Item unit cost must be zero or greater.');
    }

    return {
      productId,
      quantity,
      unitCost: roundMoney(unitCost)
    };
  });

  const subtotal = roundMoney(
    normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
  );
  const parsedDiscount = Number(discount ?? 0);

  if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0) {
    throw createValidationError('Discount must be a valid non-negative amount.');
  }
  if (roundMoney(parsedDiscount) > subtotal) {
    throw createValidationError('Discount cannot exceed the purchase order subtotal.');
  }

  const normalizedDiscount = roundMoney(parsedDiscount);
  const grandTotal = roundMoney(subtotal - normalizedDiscount);

  return {
    items: normalizedItems,
    subtotal,
    discount: normalizedDiscount,
    grandTotal
  };
}

function normalizeSupplierPayment(values, { balanceDue, status, now = new Date() } = {}) {
  const amount = Number(values?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw createValidationError('Payment amount must be greater than zero.');
  }

  if (!['received', 'partial'].includes(status)) {
    throw createValidationError('Supplier payments can only be recorded after goods are received.', 409);
  }

  const due = Number(balanceDue);
  if (!Number.isFinite(due) || due <= 0) {
    throw createValidationError('This purchase order has no outstanding balance.', 409);
  }

  const roundedAmount = roundMoney(amount);
  if (roundedAmount > roundMoney(due)) {
    throw createValidationError('Payment cannot exceed the outstanding balance.', 409);
  }

  const paymentMethod = String(values?.paymentMethod || 'Cash');
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    throw createValidationError('Choose a supported supplier payment method.');
  }

  const date = values?.date ? new Date(values.date) : new Date(now);
  if (Number.isNaN(date.getTime())) {
    throw createValidationError('Enter a valid payment date.');
  }

  const reference = String(values?.reference || '').trim();
  const note = String(values?.note || '').trim();
  if (reference.length > 100) throw createValidationError('Payment reference must be 100 characters or fewer.');
  if (note.length > 300) throw createValidationError('Payment note must be 300 characters or fewer.');

  return {
    amount: roundedAmount,
    paymentMethod,
    date,
    ...(reference ? { reference } : {}),
    ...(note ? { note } : {})
  };
}

module.exports = {
  PAYMENT_METHODS,
  calculatePurchaseOrderTotals,
  normalizeSupplierPayment,
  roundMoney
};
