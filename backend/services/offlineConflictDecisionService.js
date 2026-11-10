const { createHash } = require('node:crypto');

const conflict = (message, code = 'OFFLINE_DECISION_CONFLICT') =>
  Object.assign(new Error(message), { statusCode: 409, code });

const badPayload = (message) => Object.assign(new Error(message), { statusCode: 400 });

const normalizeOfflineId = (value, { required = false } = {}) => {
  if (value === undefined || value === null) {
    if (required) throw badPayload('A non-empty offline ID is required.');
    return undefined;
  }
  if (typeof value !== 'string') throw badPayload('Offline ID must be a string.');
  const normalized = value.trim();
  if (!normalized) throw badPayload('Offline ID cannot be empty or whitespace-only.');
  if (normalized.length > 200) throw badPayload('Offline ID must be at most 200 characters.');
  return normalized;
};

const offlineIdMatchRegex = (offlineId) =>
  new RegExp(`^\\s*${offlineId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);

const findOfflineIdRecords = async (Model, field, value, session, extra = {}) => {
  const offlineId = normalizeOfflineId(value, { required: true });
  let query = Model.find({
    ...extra,
    [field]: offlineIdMatchRegex(offlineId)
  });
  if (session) query = query.session(session);
  const records = await query;
  const legacyAlias = records.find(record => record[field] !== offlineId);
  if (legacyAlias) {
    throw conflict(
      'A historical record uses a padded offline ID. Resolve it through the approved migration process before retrying.',
      'OFFLINE_ID_LEGACY_ALIAS'
    );
  }
  return records;
};

const expandDecimal = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw badPayload(`${label} must be a finite number.`);
  }
  const [, sign, whole, fraction = '', exponentText = '0'] =
    value.toString().match(/^(-?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i) || [];
  if (whole === undefined) throw badPayload(`${label} must be a finite number.`);
  const exponent = Number(exponentText);
  const digits = `${whole}${fraction}`;
  const point = whole.length + exponent;
  const integer = point <= 0
    ? '0'
    : point >= digits.length
      ? `${digits}${'0'.repeat(point - digits.length)}`
      : digits.slice(0, point) || '0';
  const decimal = point >= digits.length
    ? ''
    : point <= 0
      ? `${'0'.repeat(-point)}${digits}`
      : digits.slice(point);
  const normalizedInteger = integer.replace(/^0+(?=\d)/, '');
  const normalizedDecimal = decimal.replace(/0+$/, '');
  const normalized = `${normalizedInteger}${normalizedDecimal ? `.${normalizedDecimal}` : ''}`;
  return sign && normalized !== '0' ? `-${normalized}` : normalized;
};

const canonicalMoney = (value, label) => {
  if (value === undefined || value === null) return null;
  const decimal = expandDecimal(value, label);
  const negative = decimal.startsWith('-');
  const unsigned = negative ? decimal.slice(1) : decimal;
  const [whole, fraction = ''] = unsigned.split('.');
  const cents = BigInt(whole) * 100n + BigInt((fraction.slice(0, 2) + '00').slice(0, 2));
  const thirdDigit = Number(fraction[2] || 0);
  const rounded = cents + (thirdDigit >= 5 ? 1n : 0n);
  return (negative && rounded !== 0n ? -rounded : rounded).toString();
};

const canonicalTimestamp = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) throw badPayload('Offline sale timestamp is invalid.');
  return timestamp.toISOString();
};

const normalizeProductId = (item) => {
  const value = item?.productId ?? item?.product;
  if (value === undefined || value === null || !String(value).trim()) {
    throw badPayload('Every offline sale item must include a product identifier.');
  }
  return String(value).trim().toLowerCase();
};

const canonicalizeOfflinePayload = (payload = {}) => {
  if (!Array.isArray(payload.items) || !payload.items.length) {
    throw badPayload('An offline sale must include at least one item.');
  }
  const items = payload.items.map((item) => ({
    productId: normalizeProductId(item),
    quantity: expandDecimal(item.quantity, 'Quantity'),
    unitPrice: {
      supplied: item.unitPrice !== undefined,
      cents: item.unitPrice === undefined ? null : canonicalMoney(item.unitPrice, 'Unit price')
    },
    expectedUnitPrice: {
      supplied: item.expectedUnitPrice !== undefined,
      cents: item.expectedUnitPrice === undefined
        ? null
        : canonicalMoney(item.expectedUnitPrice, 'Expected unit price')
    },
    discountCents: canonicalMoney(item.discount ?? 0, 'Discount')
  }));
  items.sort((a, b) => {
    const left = JSON.stringify(a);
    const right = JSON.stringify(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });

  const currencyInputs = {};
  for (const key of ['currency', 'currencyCode', 'exchangeRate', 'exchangeRateSnapshot', 'usdToSsp']) {
    if (payload[key] !== undefined) {
      currencyInputs[key] = typeof payload[key] === 'number'
        ? expandDecimal(payload[key], key)
        : String(payload[key]);
    }
  }

  return {
    offlineId: normalizeOfflineId(payload.offlineId) ?? null,
    items,
    paymentMethod: payload.paymentMethod || 'Cash',
    amountPaidCents: canonicalMoney(payload.amountPaid, 'Amount paid'),
    cashReceivedCents: canonicalMoney(payload.cashReceived, 'Cash received'),
    taxRate: payload.taxRate === undefined || payload.taxRate === null
      ? null
      : expandDecimal(payload.taxRate, 'Tax rate'),
    customerId: payload.customerId ? String(payload.customerId).trim().toLowerCase() : null,
    note: typeof payload.note === 'string' ? payload.note.trim() : null,
    offlineCreatedAt: canonicalTimestamp(
      payload.offlineCreatedAt ?? payload.createdAt ?? payload.clientReportedOfflineAt
    ),
    currencyInputs
  };
};

const assertApprovedPayloadMatchesOriginal = (originalPayload, submittedPayload) => {
  if (!originalPayload || typeof originalPayload !== 'object') {
    throw conflict('The original offline sale payload is required for an approved checkout.');
  }
  const original = canonicalizeOfflinePayload(originalPayload);
  const submitted = canonicalizeOfflinePayload(submittedPayload);
  if (
    JSON.stringify({ ...original, items: [] }) !==
      JSON.stringify({ ...submitted, items: [] }) ||
    original.items.length !== submitted.items.length
  ) {
    throw identityConflict('The approved invoice payload differs from the original offline sale.');
  }
  for (const [index, originalItem] of original.items.entries()) {
    const submittedItem = submitted.items[index];
    if (
      originalItem.productId !== submittedItem.productId ||
      originalItem.quantity !== submittedItem.quantity ||
      originalItem.discountCents !== submittedItem.discountCents
    ) {
      throw identityConflict('The approved invoice items differ from the original offline sale.');
    }
  }
};

const fingerprintOfflinePayload = (payload) =>
  createHash('sha256')
    .update(JSON.stringify(canonicalizeOfflinePayload(payload)))
    .digest('hex');

const identityConflict = (message = 'This offline ID is already bound to a different sale payload.') =>
  conflict(message, 'OFFLINE_IDENTITY_CONFLICT');
const decisionConflict = (message) => conflict(message, 'OFFLINE_DECISION_CONFLICT');

const createDecisionRecord = async (Decision, record, session) => {
  try {
    const [decision] = await Decision.create([{
      ...record,
      offlineId: normalizeOfflineId(record.offlineId, { required: true })
    }], { session });
    return decision;
  } catch (error) {
    if (error.code === 11000) {
      throw decisionConflict('A decision for this offline sale was recorded concurrently. Refresh and retry.');
    }
    throw error;
  }
};

const assertPayloadFingerprint = (storedFingerprint, incomingFingerprint) => {
  if (!storedFingerprint) {
    throw conflict(
      'This legacy offline sale has no verifiable payload fingerprint.',
      'OFFLINE_IDENTITY_UNVERIFIABLE'
    );
  }
  if (storedFingerprint !== incomingFingerprint) throw identityConflict();
};

const assertAuthorizedDecisionRole = (role) => {
  if (!['admin', 'manager'].includes(role)) {
    throw Object.assign(new Error('Only admins and managers can resolve offline price conflicts.'), {
      statusCode: 403,
      code: 'OFFLINE_DECISION_FORBIDDEN'
    });
  }
};

const assertApprovedItemsMatch = (approvedItems, submittedItems, productsById) => {
  if (!Array.isArray(approvedItems) || approvedItems.length !== submittedItems.length) {
    throw conflict('The approved offline sale does not match the submitted items.');
  }

  for (const [index, item] of submittedItems.entries()) {
    const approved = approvedItems[index];
    const productId = String(item.productId);
    const product = productsById.get(productId);
    if (
      !approved ||
      String(approved.product) !== productId ||
      approved.quantity !== item.quantity ||
      approved.offlineQuotedUnitPrice !== item.unitPrice ||
      approved.reviewedUnitPrice !== item.expectedUnitPrice ||
      !product ||
      product.price !== approved.reviewedUnitPrice
    ) {
      throw conflict('A catalog price or approved item changed. Refresh the conflict review before continuing.');
    }
  }
};

const executeInvoiceOnce = async ({
  findExistingInvoice,
  incomingFingerprint,
  consumeApproval,
  createFinancialEffects
}) => {
  const existing = await findExistingInvoice();
  if (existing) {
    assertPayloadFingerprint(existing.offlinePayloadFingerprint, incomingFingerprint);
    return { invoice: existing, duplicate: true };
  }

  if (consumeApproval) await consumeApproval();
  return { invoice: await createFinancialEffects(), duplicate: false };
};

const consumeApprovedDecision = async ({
  Decision,
  offlineId,
  fingerprint,
  invoiceId,
  user,
  session
}) => {
  offlineId = normalizeOfflineId(offlineId, { required: true });
  const consumed = await Decision.findOneAndUpdate(
    { offlineId, state: 'approved', payloadFingerprint: fingerprint },
    {
      $set: {
        state: 'consumed',
        consumedBy: user._id,
        consumedByName: user.name,
        consumedAt: new Date(),
        invoice: invoiceId
      }
    },
    { new: true, session }
  );
  if (!consumed) throw conflict('This offline price decision is no longer approved for this payload.');
  return consumed;
};

const createPendingDecision = async ({ Decision, pending, session }) => {
  pending = {
    ...pending,
    offlineId: normalizeOfflineId(pending.offlineId, { required: true })
  };
  const [existing] = await findOfflineIdRecords(Decision, 'offlineId', pending.offlineId, session);
  if (existing) {
    assertPayloadFingerprint(existing.payloadFingerprint, pending.payloadFingerprint);
    if (existing.state === 'pending') return { decision: existing, created: false };
    if (existing.state === 'rejected') throw conflict('This offline sale was rejected.');
    if (existing.state === 'approved') return { decision: existing, created: false };
    throw conflict('This offline sale has already been consumed.');
  }
  const decision = await createDecisionRecord(Decision, {
    ...pending,
    state: 'pending'
  }, session);
  return { decision, created: true };
};

const claimOfflineInvoice = async ({
  Decision,
  offlineId,
  fingerprint,
  invoiceId,
  user,
  approved,
  session
}) => {
  offlineId = normalizeOfflineId(offlineId, { required: true });
  const [existing] = await findOfflineIdRecords(Decision, 'offlineId', offlineId, session);
  if (!existing) {
    if (approved) throw conflict('No approved offline price decision exists for this sale.');
    const decision = await createDecisionRecord(Decision, {
      offlineId,
      state: 'consumed',
      decisionType: 'accepted',
      payloadFingerprint: fingerprint,
      consumedBy: user._id,
      consumedByName: user.name,
      consumedAt: new Date(),
      invoice: invoiceId
    }, session);
    return decision;
  }

  assertPayloadFingerprint(existing.payloadFingerprint, fingerprint);
  if (existing.state === 'rejected') throw conflict('This offline sale was rejected and cannot be invoiced.');
  if (existing.state === 'pending') throw conflict('This offline price conflict requires manager approval.');
  if (existing.state === 'consumed') throw conflict('This offline decision was already consumed without a matching invoice.');
  if (!approved) throw conflict('This offline sale requires its approved decision to be consumed.');
  return consumeApprovedDecision({
    Decision,
    offlineId,
    fingerprint,
    invoiceId,
    user,
    session
  });
};

const rejectDecision = async ({
  Decision,
  offlineId,
  fingerprint,
  rejection,
  session
}) => {
  offlineId = normalizeOfflineId(offlineId, { required: true });
  const [decision] = await findOfflineIdRecords(Decision, 'offlineId', offlineId, session);
  const { items: rejectionItems, ...rejectionFields } = rejection;
  if (!decision) {
    const rejected = await createDecisionRecord(Decision, {
      offlineId,
      state: 'rejected',
      decisionType: 'rejected',
      payloadFingerprint: fingerprint,
      ...rejectionFields,
      rejectionItems
    }, session);
    return { decision: rejected, changed: true };
  }
  assertPayloadFingerprint(decision.payloadFingerprint, fingerprint);
  if (decision.state === 'rejected') return { decision, changed: false };
  if (decision.state === 'consumed') {
    throw conflict('This offline sale has already been consumed into an invoice and cannot be rejected.');
  }

  const rejected = await Decision.findOneAndUpdate(
    { offlineId, state: { $in: ['pending', 'approved'] }, payloadFingerprint: fingerprint },
    { $set: { state: 'rejected', decisionType: 'rejected', ...rejectionFields, rejectionItems } },
    { new: true, session }
  );
  if (!rejected) {
    throw conflict('The offline price decision changed concurrently. Refresh and try again.');
  }
  return { decision: rejected, changed: true };
};

const createApproval = async ({ Decision, approval, session }) => {
  approval = {
    ...approval,
    offlineId: normalizeOfflineId(approval.offlineId, { required: true })
  };
  const [existing] = await findOfflineIdRecords(Decision, 'offlineId', approval.offlineId, session);
  if (!existing) throw conflict('The offline sale has not been recorded as a price conflict.');
  assertPayloadFingerprint(existing.payloadFingerprint, approval.payloadFingerprint);
  if (existing.state === 'approved') {
    const refreshed = await Decision.findOneAndUpdate(
      {
        offlineId: approval.offlineId,
        state: 'approved',
        payloadFingerprint: approval.payloadFingerprint,
        approvedAt: existing.approvedAt
      },
      { $set: approval },
      { new: true, session }
    );
    if (!refreshed) throw conflict('The offline price decision changed concurrently. Refresh and retry.');
    return { decision: refreshed, created: false, changed: true };
  }
  if (existing.state !== 'pending') {
    throw conflict(`This offline sale is already ${existing.state}.`);
  }

  const approved = await Decision.findOneAndUpdate(
    { offlineId: approval.offlineId, state: 'pending', payloadFingerprint: approval.payloadFingerprint },
    { $set: { ...approval, state: 'approved', decisionType: 'approved' } },
    { new: true, session }
  );
  if (!approved) throw conflict('The offline price decision changed concurrently. Refresh and retry.');
  return { decision: approved, created: false, changed: true };
};

const runFinancialEffectsAtomically = async ({ session, operation }) => {
  try {
    return await operation();
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    throw error;
  }
};

const payloadIdentityResponse = (existing, incomingFingerprint) => {
  assertPayloadFingerprint(existing?.offlinePayloadFingerprint, incomingFingerprint);
  return { invoice: existing, duplicate: true };
};

module.exports = {
  assertApprovedItemsMatch,
  assertApprovedPayloadMatchesOriginal,
  assertAuthorizedDecisionRole,
  assertPayloadFingerprint,
  canonicalizeOfflinePayload,
  claimOfflineInvoice,
  consumeApprovedDecision,
  createApproval,
  createPendingDecision,
  executeInvoiceOnce,
  fingerprintOfflinePayload,
  findOfflineIdRecords,
  identityConflict,
  normalizeOfflineId,
  payloadIdentityResponse,
  rejectDecision,
  runFinancialEffectsAtomically
};
