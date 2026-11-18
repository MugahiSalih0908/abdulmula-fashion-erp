function safeNonNegativeNumber(value, label) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) throw new TypeError(`${label} must be a finite non-negative number.`);
  return number;
}

function safeCount(value, label) {
  const number = Number(value ?? 0);
  if (!Number.isSafeInteger(number) || number < 0) throw new TypeError(`${label} must be a non-negative integer.`);
  return number;
}

/**
 * Only report gross profit when every invoice in the selected period has a
 * trusted cost snapshot for every line. Historical invoices remain uncosted.
 */
function buildGrossProfitSummary({ salesCount = 0, costedInvoiceCount = 0, netSales = 0, costOfGoodsSold = 0 } = {}) {
  const sales = safeCount(salesCount, 'salesCount');
  const costed = safeCount(costedInvoiceCount, 'costedInvoiceCount');
  const net = safeNonNegativeNumber(netSales, 'netSales');
  const cogs = safeNonNegativeNumber(costOfGoodsSold, 'costOfGoodsSold');
  if (costed > sales) throw new RangeError('Costed invoice count cannot exceed sales count.');
  const uncostedInvoiceCount = sales - costed;
  const grossProfitAvailable = uncostedInvoiceCount === 0;
  return {
    netSales: net,
    costOfGoodsSold: grossProfitAvailable ? cogs : null,
    grossProfitAvailable,
    grossProfit: grossProfitAvailable ? net - cogs : null,
    costedInvoiceCount: costed,
    uncostedInvoiceCount
  };
}

module.exports = { buildGrossProfitSummary };
