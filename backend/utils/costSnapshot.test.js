const test = require('node:test');
const assert = require('node:assert/strict');
const { buildLineCostSnapshot } = require('./costSnapshot');

test('captures positive cost from the server product record', () => {
  assert.deepEqual(buildLineCostSnapshot({ costPrice: 12.5 }), { unitCost: 12.5, costKnown: true });
});

test('does not treat missing, null or zero cost as a recorded cost', () => {
  assert.deepEqual(buildLineCostSnapshot({ costPrice: 0 }), { costKnown: false });
  assert.deepEqual(buildLineCostSnapshot({}), { costKnown: false });
  assert.deepEqual(buildLineCostSnapshot({ costPrice: null }), { costKnown: false });
});

test('does not trust or copy a client-supplied amount', () => {
  assert.deepEqual(buildLineCostSnapshot({ costPrice: 4.25, unitCost: 999 }), { unitCost: 4.25, costKnown: true });
});
