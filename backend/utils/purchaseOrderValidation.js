const PAYMENT_METHODS = Object.freeze([
  'Cash',
  'Bank Transfer',
  'Mobile Transfer',
  'Other'
]);

const roundMoney = value => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw createValidationError('Currency amount must be a finite number.');
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  if (!Number.isSafeInteger(Math.round(rounded * 100))) {
    throw createValidationError('Currency amount is outside the supported range.');
  }
  return rounded;
};

function createValidationError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function parseFiniteAmount(value, label) {
  if (typeof value === 'boolean' || value === null || value === undefined ||
      (typeof value === 'string' && value.trim() === '') ||
      !['number', 'string'].includes(typeof value)) {
    throw createValidationError(`${label} must be a valid number.`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw createValidationError(`${label} must be a valid number.`);
  return parsed;
}

function calculatePurchaseOrderTotals(items, discount = 0) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
    throw createValidationError('A purchase order must contain between 1 and 100 items.');
  }

  const normalizedItems = items.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw createValidationError('Each purchase order line must be an object.');
    }
    const rawProductId = item.productId ?? item.product;
    if (typeof rawProductId !== 'string' || !rawProductId.trim()) {
      throw createValidationError('Select a valid product for each line item.');
    }
    const quantity = parseFiniteAmount(item.quantity, 'Item quantity');
    const unitCost = parseFiniteAmount(item.unitCost, 'Item unit cost');

    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      throw createValidationError('Item quantity must be a whole number greater than zero.');
    }
    if (unitCost < 0) {
      throw createValidationError('Item unit cost must be zero or greater.');
    }

    return {
      productId: rawProductId.trim(),
      quantity,
      unitCost: roundMoney(unitCost)
    };
  });

  const subtotal = roundMoney(
    normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
  );
  const parsedDiscount = parseFiniteAmount(discount ?? 0, 'Discount');

  if (parsedDiscount < 0) throw createValidationError('Discount must be a valid non-negative amount.');
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
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    throw createValidationError('A supplier payment object is required.');
  }
  const amount = parseFiniteAmount(values.amount, 'Payment amount');
  if (amount <= 0) throw createValidationError('Payment amount must be greater than zero.');

  if (!['received', 'partial'].includes(status)) {
    throw createValidationError('Supplier payments can only be recorded after goods are received.', 409);
  }

  const due = Number(balanceDue);
  if (!Number.isFinite(due) || due <= 0) {
    throw createValidationError('This purchase order has no outstanding balance.', 409);
  }

  const roundedAmount = roundMoney(amount);
  if (roundedAmount <= 0 || roundedAmount > roundMoney(due)) {
    throw createValidationError('Payment cannot exceed the outstanding balance.', 409);
  }

  const paymentMethod = values.paymentMethod === undefined ? 'Cash' : values.paymentMethod;
  if (typeof paymentMethod !== 'string' || !PAYMENT_METHODS.includes(paymentMethod)) {
    throw createValidationError('Choose a supported supplier payment method.');
  }

  const date = values.date === undefined || values.date === null || values.date === ''
    ? new Date(now)
    : typeof values.date === 'string' ? new Date(values.date) : new Date(Number.NaN);
  if (Number.isNaN(date.getTime())) {
    throw createValidationError('Enter a valid payment date.');
  }

  const reference = values.reference === undefined ? '' : values.reference;
  const note = values.note === undefined ? '' : values.note;
  if (typeof reference !== 'string' || typeof note !== 'string') {
    throw createValidationError('Payment reference and note must be text.');
  }
  const normalizedReference = reference.trim();
  const normalizedNote = note.trim();
  if (normalizedReference.length > 100) throw createValidationError('Payment reference must be 100 characters or fewer.');
  if (normalizedNote.length > 300) throw createValidationError('Payment note must be 300 characters or fewer.');

  return {
    amount: roundedAmount,
    paymentMethod,
    date,
    ...(normalizedReference ? { reference: normalizedReference } : {}),
    ...(normalizedNote ? { note: normalizedNote } : {})
  };
}

module.exports = {
  PAYMENT_METHODS,
  calculatePurchaseOrderTotals,
  normalizeSupplierPayment,
  roundMoney
};
