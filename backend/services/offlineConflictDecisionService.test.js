const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertApprovedPayloadMatchesOriginal,
  assertApprovedItemsMatch,
  assertAuthorizedDecisionRole,
  assertPayloadFingerprint,
  claimOfflineInvoice,
  createApproval,
  createPendingDecision,
  consumeApprovedDecision,
  executeInvoiceOnce,
  fingerprintOfflinePayload,
  normalizeOfflineId,
  rejectDecision,
  runFinancialEffectsAtomically
} = require('./offlineConflictDecisionService');

class MemoryDecisionModel {
  constructor(initial = []) {
    this.records = new Map(initial.map(record => [record.offlineId, { ...record }]));
  }

  findOne({ offlineId }) {
    return { session: async () => this.records.get(offlineId) || null };
  }

  find(filter) {
    const records = () => Array.from(this.records.values())
      .filter(record => filter.offlineId.test(record.offlineId));
    return {
      session: async () => records(),
      then: (resolve, reject) => Promise.resolve(records()).then(resolve, reject)
    };
  }

  async create([record]) {
    if (this.records.has(record.offlineId)) {
      throw Object.assign(new Error('duplicate key'), { code: 11000 });
    }
    const stored = { ...record };
    this.records.set(record.offlineId, stored);
    return [stored];
  }

  async findOneAndUpdate(filter, update) {
    const record = this.records.get(filter.offlineId);
    if (!record) return null;
    if (typeof filter.state === 'string' && record.state !== filter.state) return null;
    if (filter.state?.$in && !filter.state.$in.includes(record.state)) return null;
    if (filter.payloadFingerprint && record.payloadFingerprint !== filter.payloadFingerprint) return null;
    if (filter.approvedAt && record.approvedAt !== filter.approvedAt) return null;
    Object.assign(record, update.$set);
    return record;
  }
}

const payload = () => ({
  offlineId: 'offline-1',
  offlineCreatedAt: '2026-11-10T09:00:00.000Z',
  items: [{
    productId: 'PRODUCT-1',
    quantity: 2,
    expectedUnitPrice: 10,
    discount: 1
  }],
  taxRate: 7.5,
  customerId: 'CUSTOMER-1',
  paymentMethod: 'Cash',
  amountPaid: 19,
  cashReceived: 20,
  note: 'Offline checkout'
});

const user = { _id: 'manager-1', name: 'Manager' };
const fingerprint = () => fingerprintOfflinePayload(payload());
const approvedRecord = () => ({
  offlineId: 'offline-1',
  state: 'approved',
  payloadFingerprint: fingerprint(),
  approvedAt: new Date('2026-11-10T09:30:00Z'),
  items: [{
    product: 'product-1',
    quantity: 2,
    offlineQuotedUnitPrice: 8,
    reviewedUnitPrice: 10
  }]
});

test('canonical fingerprints are stable across key order, item order, and monetary formatting', () => {
  const first = payload();
  first.items.push({
    productId: 'PRODUCT-2',
    quantity: 1,
    unitPrice: 25,
    discount: 0
  });
  const second = {
    ...first,
    amountPaid: 19.001,
    items: [
      { discount: 0, unitPrice: 25.001, quantity: 1, productId: 'product-2' },
      { discount: 1.004, expectedUnitPrice: 10.001, quantity: 2, productId: 'product-1' }
    ]
  };
  assert.equal(fingerprintOfflinePayload(first), fingerprintOfflinePayload(second));
  assert.doesNotThrow(() => fingerprintOfflinePayload({
    items: [{ productId: 'product', quantity: 1e+21, unitPrice: 1e+21 }]
  }));
});

test('unit and expected prices are fingerprinted independently', async () => {
  const original = {
    ...payload(),
    items: [{ ...payload().items[0], unitPrice: 9, expectedUnitPrice: 10 }]
  };
  const changedExpectedPrice = {
    ...original,
    items: [{ ...original.items[0], expectedUnitPrice: 11 }]
  };
  const originalFingerprint = fingerprintOfflinePayload(original);
  const changedFingerprint = fingerprintOfflinePayload(changedExpectedPrice);

  assert.notEqual(changedFingerprint, originalFingerprint);
  await assert.rejects(executeInvoiceOnce({
    findExistingInvoice: async () => ({ offlinePayloadFingerprint: originalFingerprint }),
    incomingFingerprint: changedFingerprint,
    createFinancialEffects: async () => assert.fail('Changed expected price must not create another invoice')
  }), { statusCode: 409, code: 'OFFLINE_IDENTITY_CONFLICT' });
});

test('offline IDs are normalized and invalid present IDs are rejected', () => {
  assert.equal(normalizeOfflineId(undefined), undefined);
  assert.equal(normalizeOfflineId(null), undefined);
  assert.equal(normalizeOfflineId('  checkout-1  '), 'checkout-1');
  assert.equal(
    fingerprintOfflinePayload({ ...payload(), offlineId: ' offline-1 ' }),
    fingerprintOfflinePayload(payload())
  );
  for (const invalid of ['', ' ', '\t\n']) {
    assert.throws(() => normalizeOfflineId(invalid), { statusCode: 400 });
  }
});

test('approved checkout preserves original identity while allowing approved item-price transformation', () => {
  const original = payload();
  const submitted = {
    ...original,
    items: [{
      productId: original.items[0].productId,
      quantity: original.items[0].quantity,
      unitPrice: 8,
      expectedUnitPrice: 10,
      discount: original.items[0].discount
    }]
  };
  assert.doesNotThrow(() => assertApprovedPayloadMatchesOriginal(original, submitted));
  assert.throws(
    () => assertApprovedPayloadMatchesOriginal(original, { ...submitted, paymentMethod: 'Credit' }),
    { statusCode: 409, code: 'OFFLINE_IDENTITY_CONFLICT' }
  );
});

test('padded duplicate IDs share one decision and historical padded IDs are not rewritten', async () => {
  const Decision = new MemoryDecisionModel();
  const saleFingerprint = fingerprintOfflinePayload({
    ...payload(),
    offlineId: ' checkout-1 '
  });
  const first = await createPendingDecision({
    Decision,
    pending: {
      offlineId: ' checkout-1 ',
      payloadFingerprint: saleFingerprint
    }
  });
  const duplicate = await createPendingDecision({
    Decision,
    pending: {
      offlineId: 'checkout-1',
      payloadFingerprint: saleFingerprint
    }
  });
  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(Decision.records.size, 1);
  assert.equal(Array.from(Decision.records.values())[0].offlineId, 'checkout-1');

  const historical = new MemoryDecisionModel([{
    offlineId: ' checkout-1 ',
    state: 'rejected',
    payloadFingerprint: saleFingerprint
  }]);
  await assert.rejects(claimOfflineInvoice({
    Decision: historical,
    offlineId: 'checkout-1',
    fingerprint: saleFingerprint,
    invoiceId: 'invoice-1',
    user,
    approved: false
  }), { statusCode: 409, code: 'OFFLINE_ID_LEGACY_ALIAS' });
  assert.equal(historical.records.has(' checkout-1 '), true);
  assert.equal(historical.records.has('checkout-1'), false);
});

test('same offline ID returns an exact retry without repeating financial effects', async () => {
  let invoice = null;
  let effects = 0;
  const run = () => executeInvoiceOnce({
    findExistingInvoice: async () => invoice,
    incomingFingerprint: fingerprint(),
    consumeApproval: async () => {},
    createFinancialEffects: async () => {
      effects++;
      invoice = { _id: 'invoice-1', offlinePayloadFingerprint: fingerprint() };
      return invoice;
    }
  });

  assert.equal((await run()).duplicate, false);
  assert.equal((await run()).duplicate, true);
  assert.equal(effects, 1);
});

test('legacy invoices without a fingerprint fail closed instead of being treated as retries', async () => {
  await assert.rejects(executeInvoiceOnce({
    findExistingInvoice: async () => ({ _id: 'legacy-invoice' }),
    incomingFingerprint: fingerprint(),
    createFinancialEffects: async () => assert.fail('Legacy identity must not create another invoice')
  }), { statusCode: 409, code: 'OFFLINE_IDENTITY_UNVERIFIABLE' });
});

test('same offline ID rejects payload changes to product, quantity, price, discount, customer, or payment', async () => {
  const original = fingerprint();
  const mutations = [
    value => { value.items[0].productId = 'product-2'; },
    value => { value.items[0].quantity = 3; },
    value => { value.items[0].expectedUnitPrice = 11; },
    value => { value.items[0].discount = 2; },
    value => { value.customerId = 'customer-2'; },
    value => { value.paymentMethod = 'Credit'; value.amountPaid = 0; }
  ];

  for (const mutate of mutations) {
    const changed = payload();
    mutate(changed);
    assert.throws(
      () => assertPayloadFingerprint(fingerprintOfflinePayload(changed), original),
      { statusCode: 409, code: 'OFFLINE_IDENTITY_CONFLICT' }
    );
    await assert.rejects(executeInvoiceOnce({
      findExistingInvoice: async () => ({ offlinePayloadFingerprint: original }),
      incomingFingerprint: fingerprintOfflinePayload(changed),
      createFinancialEffects: async () => assert.fail('Conflicting retry must not create an invoice')
    }), { statusCode: 409, code: 'OFFLINE_IDENTITY_CONFLICT' });
  }
});

test('manager approval is bound to the exact pending-sale fingerprint', async () => {
  const Decision = new MemoryDecisionModel([{
    offlineId: 'offline-1',
    state: 'pending',
    payloadFingerprint: fingerprint()
  }]);

  await assert.rejects(createApproval({
    Decision,
    session: {},
    approval: { offlineId: 'offline-1', payloadFingerprint: 'f'.repeat(64) }
  }), { statusCode: 409, code: 'OFFLINE_IDENTITY_CONFLICT' });

  const result = await createApproval({
    Decision,
    session: {},
    approval: { offlineId: 'offline-1', payloadFingerprint: fingerprint(), approvedBy: user._id }
  });
  assert.equal(result.decision.state, 'approved');
});

test('normal invoice claim wins before a concurrent rejection', async () => {
  const Decision = new MemoryDecisionModel();
  await claimOfflineInvoice({
    Decision,
    offlineId: 'offline-1',
    fingerprint: fingerprint(),
    invoiceId: 'invoice-1',
    user,
    approved: false
  });
  await assert.rejects(rejectDecision({
    Decision,
    offlineId: 'offline-1',
    fingerprint: fingerprint(),
    rejection: { rejectedBy: 'manager-2', rejectedAt: new Date() }
  }), { statusCode: 409 });
  assert.equal(Decision.records.get('offline-1').state, 'consumed');
});

test('rejection wins before a concurrent ordinary invoice claim', async () => {
  const Decision = new MemoryDecisionModel();
  await rejectDecision({
    Decision,
    offlineId: 'offline-1',
    fingerprint: fingerprint(),
    rejection: { rejectedBy: 'manager-2', rejectedAt: new Date() }
  });
  await assert.rejects(claimOfflineInvoice({
    Decision,
    offlineId: 'offline-1',
    fingerprint: fingerprint(),
    invoiceId: 'invoice-1',
    user,
    approved: false
  }), { statusCode: 409 });
  assert.equal(Decision.records.get('offline-1').state, 'rejected');
});

test('concurrent invoice claim and rejection commit exactly one outcome', async () => {
  const Decision = new MemoryDecisionModel();
  const outcomes = await Promise.allSettled([
    claimOfflineInvoice({
      Decision,
      offlineId: 'offline-1',
      fingerprint: fingerprint(),
      invoiceId: 'invoice-1',
      user,
      approved: false
    }),
    rejectDecision({
      Decision,
      offlineId: 'offline-1',
      fingerprint: fingerprint(),
      rejection: { rejectedBy: 'manager-2', rejectedAt: new Date() }
    })
  ]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.ok(['consumed', 'rejected'].includes(Decision.records.get('offline-1').state));
});

test('approved-to-consumed and pending/approved-to-rejected transitions are terminal', async () => {
  const Decision = new MemoryDecisionModel([approvedRecord()]);
  await consumeApprovedDecision({
    Decision,
    offlineId: 'offline-1',
    fingerprint: fingerprint(),
    invoiceId: 'invoice-1',
    user
  });
  await assert.rejects(rejectDecision({
    Decision,
    offlineId: 'offline-1',
    fingerprint: fingerprint(),
    rejection: { rejectedBy: 'manager-2', rejectedAt: new Date() }
  }), { statusCode: 409 });
  await assert.rejects(consumeApprovedDecision({
    Decision,
    offlineId: 'offline-1',
    fingerprint: fingerprint(),
    invoiceId: 'invoice-2',
    user
  }), { statusCode: 409 });

  const rejected = new MemoryDecisionModel();
  await rejectDecision({
    Decision: rejected,
    offlineId: 'offline-2',
    fingerprint: fingerprint(),
    rejection: { rejectedBy: 'manager-2', rejectedAt: new Date() }
  });
  await assert.rejects(claimOfflineInvoice({
    Decision: rejected,
    offlineId: 'offline-2',
    fingerprint: fingerprint(),
    invoiceId: 'invoice-2',
    user,
    approved: false
  }), { statusCode: 409 });
});

test('staff cannot approve or reject conflicts', () => {
  assert.throws(() => assertAuthorizedDecisionRole('staff'), { statusCode: 403 });
  assert.doesNotThrow(() => assertAuthorizedDecisionRole('manager'));
  assert.doesNotThrow(() => assertAuthorizedDecisionRole('admin'));
});

test('stale catalog price after approval is rejected', () => {
  assert.throws(() => assertApprovedItemsMatch(
    [{
      product: 'product-1',
      quantity: 2,
      offlineQuotedUnitPrice: 8,
      reviewedUnitPrice: 10
    }],
    [{
      productId: 'product-1',
      quantity: 2,
      unitPrice: 8,
      expectedUnitPrice: 10
    }],
    new Map([['product-1', { price: 11 }]])
  ), { statusCode: 409 });
});

test('transaction failure aborts staged financial effects', async () => {
  const durable = [];
  let staged = [];
  let active = true;
  const session = {
    inTransaction: () => active,
    abortTransaction: async () => {
      staged = [];
      active = false;
    }
  };

  await assert.rejects(runFinancialEffectsAtomically({
    session,
    operation: async () => {
      staged.push('invoice', 'stock', 'customer', 'audit');
      throw new Error('injected transaction failure');
    }
  }), /injected transaction failure/);

  durable.push(...staged);
  assert.deepEqual(durable, []);
});
