const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStaffSalesLookup } = require('./staffSalesSummary');

test('staff sales aggregation produces a single lookup with stable defaults', () => {
  const lookup = buildStaffSalesLookup([
    { _id: 'staff-1', salesCount: 3, salesTotal: 120 },
    { _id: 'staff-2', salesCount: 0, salesTotal: 0 },
    { _id: 'staff-3', salesCount: 'invalid', salesTotal: null },
    { _id: null, salesCount: 1, salesTotal: 50 }
  ]);

  assert.equal(lookup.size, 3);
  assert.deepEqual(lookup.get('staff-1'), { salesCount: 3, salesTotal: 120 });
  assert.deepEqual(lookup.get('staff-2'), { salesCount: 0, salesTotal: 0 });
  assert.deepEqual(lookup.get('staff-3'), { salesCount: 0, salesTotal: 0 });
});
