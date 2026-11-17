const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 });

const requireFiniteNumber = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw badRequest(`${label} must be a valid number.`);
  }
  return value;
};

const decimalRational = (value) => {
  if (!Number.isFinite(value)) return null;
  const [, sign, whole, fraction = '', exponentText = '0'] =
    value.toString().match(/^(-?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i) || [];
  if (whole === undefined) return null;

  const exponent = Number(exponentText);
  const decimalPlaces = fraction.length - exponent;
  let numerator = BigInt(`${whole}${fraction}`);
  let denominator = 1n;
  if (decimalPlaces > 0) denominator = 10n ** BigInt(decimalPlaces);
  else if (decimalPlaces < 0) numerator *= 10n ** BigInt(-decimalPlaces);
  if (sign) numerator = -numerator;
  return { numerator, denominator };
};

const roundRatio = (numerator, denominator) => {
  const negative = numerator < 0n;
  const magnitude = negative ? -numerator : numerator;
  let rounded = magnitude / denominator;
  if ((magnitude % denominator) * 2n >= denominator) rounded += 1n;
  return negative ? -rounded : rounded;
};

const toCents = (value) => {
  const rational = decimalRational(value);
  if (!rational) return Number.NaN;
  const result = Number(roundRatio(rational.numerator * 100n, rational.denominator));
  return Number.isSafeInteger(result) ? result : Number.NaN;
};
const fromCents = (value) => value / 100;

export function assertExpectedUnitPrice(expectedPrice, catalogPrice) {
  const expectedCents = toCents(requireFiniteNumber(expectedPrice, 'Expected unit price'));
  const catalogCents = toCents(requireFiniteNumber(catalogPrice, 'Product price'));
  if (expectedCents !== catalogCents) {
    throw Object.assign(
      new Error('Product price changed since this sale was saved offline. Manager review is required.'),
      { statusCode: 409 }
    );
  }
}

export function buildInvoiceLine(item, product, role, previouslyRequested = 0) {
  if (!item || typeof item !== 'object') {
    throw badRequest('Each invoice item must be valid.');
  }
  if (!product || product.isDeleted) {
    throw Object.assign(new Error('Product not found.'), { statusCode: 404 });
  }

  const quantity = requireFiniteNumber(item.quantity, 'Quantity');
  if (quantity <= 0) throw badRequest('Quantity must be greater than zero.');

  const availableStock = requireFiniteNumber(product.quantity, 'Product stock');
  if (availableStock < 0 || quantity + previouslyRequested > availableStock) {
    throw badRequest(`Insufficient stock for "${product.name}". Available: ${Math.max(0, availableStock - previouslyRequested)}`);
  }

  const rawCatalogPrice = requireFiniteNumber(product.price, 'Product price');
  if (rawCatalogPrice < 0) throw badRequest('Product price cannot be negative.');
  const catalogPriceCents = toCents(rawCatalogPrice);

  const hasSubmittedPrice = item.unitPrice !== undefined && item.unitPrice !== null;
  const rawSubmittedPrice = hasSubmittedPrice
    ? requireFiniteNumber(item.unitPrice, 'Unit price')
    : fromCents(catalogPriceCents);
  if (rawSubmittedPrice < 0) throw badRequest('Unit price cannot be negative.');
  const submittedPriceCents = toCents(rawSubmittedPrice);

  const hasOverride = hasSubmittedPrice && submittedPriceCents !== catalogPriceCents;
  if (hasOverride && !['admin', 'manager'].includes(role)) {
    throw Object.assign(new Error('Only admins and managers can override product prices.'), { statusCode: 403 });
  }

  const unitPriceCents = hasOverride ? submittedPriceCents : catalogPriceCents;
  const lineSubtotalCents = Math.round(unitPriceCents * quantity);
  if (!Number.isSafeInteger(lineSubtotalCents)) throw badRequest('Invoice line total is invalid.');

  const rawDiscount = item.discount == null ? 0 : requireFiniteNumber(item.discount, 'Discount');
  if (rawDiscount < 0) throw badRequest('Discount cannot be negative.');
  const discountCents = toCents(rawDiscount);
  if (discountCents > lineSubtotalCents) throw badRequest('Discount cannot exceed the line amount.');

  return {
    quantity,
    unitPrice: fromCents(unitPriceCents),
    discount: fromCents(discountCents),
    lineTotal: fromCents(lineSubtotalCents - discountCents),
    hasOverride
  };
}

export function calculateInvoiceTotals(items, taxRate = 0) {
  if (!Array.isArray(items)) throw badRequest('Invoice items must be a list.');

  const rate = taxRate == null ? 0 : requireFiniteNumber(taxRate, 'Tax rate');
  if (rate < 0 || rate > 100) throw badRequest('Tax rate must be between 0 and 100.');

  let subtotalCents = 0;
  let discountTotalCents = 0;
  for (const item of items) {
    const unitPrice = requireFiniteNumber(item.unitPrice, 'Unit price');
    const quantity = requireFiniteNumber(item.quantity, 'Quantity');
    const discount = requireFiniteNumber(item.discount ?? 0, 'Discount');
    if (unitPrice < 0) throw badRequest('Unit price cannot be negative.');
    if (quantity <= 0) throw badRequest('Quantity must be greater than zero.');
    if (discount < 0) throw badRequest('Discount cannot be negative.');

    const lineSubtotalCents = Math.round(toCents(unitPrice) * quantity);
    const discountCents = toCents(discount);
    if (!Number.isSafeInteger(lineSubtotalCents)) throw badRequest('Invoice line total is invalid.');
    if (discountCents > lineSubtotalCents) throw badRequest('Discount cannot exceed the line amount.');
    subtotalCents += lineSubtotalCents;
    discountTotalCents += discountCents;
  }

  const taxableSubtotalCents = subtotalCents - discountTotalCents;
  if (!Number.isSafeInteger(subtotalCents) || !Number.isSafeInteger(discountTotalCents) || taxableSubtotalCents < 0) {
    throw badRequest('Invoice totals are invalid.');
  }

  const rateRational = decimalRational(rate);
  const taxAmountCents = Number(roundRatio(
    BigInt(taxableSubtotalCents) * rateRational.numerator,
    rateRational.denominator * 100n
  ));
  const grandTotalCents = taxableSubtotalCents + taxAmountCents;
  if (!Number.isSafeInteger(taxAmountCents) || !Number.isSafeInteger(grandTotalCents) || grandTotalCents < 0) {
    throw badRequest('Invoice totals are invalid.');
  }

  return {
    subtotal: fromCents(subtotalCents),
    discountTotal: fromCents(discountTotalCents),
    taxAmount: fromCents(taxAmountCents),
    taxRate: rate,
    grandTotal: fromCents(grandTotalCents)
  };
}

export function calculatePayment(grandTotal, paymentMethod, amountPaid, cashReceived) {
  const total = requireFiniteNumber(grandTotal, 'Invoice total');
  if (total < 0) throw badRequest('Invoice total cannot be negative.');
  if (!['Cash', 'Credit', 'Mobile Transfer', 'Mixed'].includes(paymentMethod)) {
    throw badRequest('Payment method is invalid.');
  }

  let paidCents;
  if (paymentMethod === 'Cash' && cashReceived != null) {
    const tenderCents = toCents(requireFiniteNumber(cashReceived, 'Cash received'));
    const totalCents = toCents(total);
    if (tenderCents < totalCents) throw badRequest('Cash received is less than the invoice total.');
    paidCents = totalCents;
  } else {
    const paid = amountPaid == null
      ? (paymentMethod === 'Credit' ? 0 : total)
      : requireFiniteNumber(amountPaid, 'Amount paid');
    if (paid < 0) throw badRequest('Amount paid must be between zero and the invoice total.');
    paidCents = toCents(paid);
  }
  const totalCents = toCents(total);
  if (paidCents < 0 || paidCents > totalCents) {
    throw badRequest('Amount paid must be between zero and the invoice total.');
  }

  const balanceDueCents = totalCents - paidCents;
  return {
    paid: fromCents(paidCents),
    balanceDue: fromCents(balanceDueCents),
    change: paymentMethod === 'Cash' && cashReceived != null
      ? fromCents(toCents(cashReceived) - totalCents)
      : 0,
    paymentStatus: balanceDueCents === 0 ? 'paid' : paidCents > 0 ? 'partial' : 'unpaid'
  };
}

export function calculateCashChange(cashReceived, grandTotal) {
  const tenderCents = toCents(requireFiniteNumber(cashReceived, 'Cash received'));
  const totalCents = toCents(requireFiniteNumber(grandTotal, 'Invoice total'));
  if (!Number.isSafeInteger(tenderCents) || !Number.isSafeInteger(totalCents)) {
    throw badRequest('Cash or invoice total is outside the supported range.');
  }
  return fromCents(Math.max(0, tenderCents - totalCents));
}

export function addCurrency(...values) {
  const cents = values.reduce((total, value) => {
    const amount = toCents(requireFiniteNumber(value, 'Currency amount'));
    if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(total + amount)) {
      throw badRequest('Currency total is outside the supported range.');
    }
    return total + amount;
  }, 0);
  return fromCents(cents);
}

export function subtractCurrency(total, amount) {
  const difference = toCents(requireFiniteNumber(total, 'Currency total'))
    - toCents(requireFiniteNumber(amount, 'Currency amount'));
  if (!Number.isSafeInteger(difference)) throw badRequest('Currency total is outside the supported range.');
  return fromCents(Math.max(0, difference));
}

export function customerPurchaseDeltas(grandTotal, balanceDue) {
  return {
    totalPurchases: fromCents(toCents(grandTotal)),
    creditBalance: fromCents(toCents(balanceDue))
  };
}

export function shouldReverseCustomerPurchases(invoice) {
  return invoice.customerPurchaseRecorded === true
    || (invoice.customerPurchaseRecorded == null && invoice.balanceDue > 0);
}
