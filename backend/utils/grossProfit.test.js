const test = require('node:test');
const assert = require('node:assert/strict');
const { buildGrossProfitSummary } = require('./grossProfit');

test('reports gross profit when all invoices have complete cost snapshots', () => {
  assert.deepEqual(buildGrossProfitSummary({ salesCount: 3, costedInvoiceCount: 3, netSales: 500, costOfGoodsSold: 310 }), {
    netSales: 500, costOfGoodsSold: 310, grossProfitAvailable: true, grossProfit: 190, costedInvoiceCount: 3, uncostedInvoiceCount: 0
  });
});

test('withholds gross profit when any historical invoice is uncosted', () => {
  assert.deepEqual(buildGrossProfitSummary({ salesCount: 4, costedInvoiceCount: 2, netSales: 800, costOfGoodsSold: 420 }), {
    netSales: 800, costOfGoodsSold: null, grossProfitAvailable: false, grossProfit: null, costedInvoiceCount: 2, uncostedInvoiceCount: 2
  });
});

test('returns zero gross profit for an empty period', () => {
  const result = buildGrossProfitSummary();
  assert.equal(result.grossProfitAvailable, true);
  assert.equal(result.grossProfit, 0);
});

test('rejects impossible coverage and invalid amounts', () => {
  assert.throws(() => buildGrossProfitSummary({ salesCount: 1, costedInvoiceCount: 2 }), RangeError);
  assert.throws(() => buildGrossProfitSummary({ netSales: -1 }), TypeError);
});
