'use strict';
// Stage 0, S0-5a – audit actions, log() and the error handler (ADR-0001 §12.5, §12.7):
// A1–A8 in §12.14.
//
// Synthetic data only, on the harness's in-memory MongoDB replica set. SECRETS holds invented
// stand-ins for personal data and credentials; the tests put them into errors and requests and
// prove that no safe log line contains them. Only the JSON lines that the error handler and the
// audit logger write are checked: the request log on stdout and the other existing log lines are
// outside S0-5 (§12.5).

const harness = require('../helpers/harness'); // must be first: applies isolation guards

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const fx = require('./fixtures');

const backend = (...parts) => require(path.join(harness.BACKEND_ROOT, ...parts));

let m;
let users;
let auditActions;
let auditLogger;
let corsBlockedError;
let errorHandler;
let transactions;

// Application modules load after startSuite() freezes the clock, as in the other Stage 0 files.
test.before(async () => {
  m = await fx.startSuite();
  users = await fx.createUsers();
  auditActions = backend('utils', 'auditActions');
  auditLogger = backend('utils', 'auditLogger');
  corsBlockedError = backend('utils', 'corsBlockedError');
  errorHandler = backend('middleware', 'errorHandler');
  transactions = backend('utils', 'transactions');
});
test.after(fx.stopSuite);

const GENERIC_500 = { success: false, message: 'Something went wrong. Check the result before trying again.' };
const SECRETS = Object.freeze({
  email: 'stage0.sentinel.person@example.invalid',
  phone: '+211 900 000 123',
  password: 'Stage0-Sentinel-Password-71',
  token: 'stage0-sentinel-token-value',
  ip: '203.0.113.77',
  userAgent: 'Stage0SentinelAgent/7.1',
  bodyValue: 'stage0-sentinel-body-value'
});
const SENSITIVE = Object.values(SECRETS);
const ERROR_HANDLER_FIELDS = ['error', 'event', 'method', 'route', 'status'];

const APPROVED_ACTIONS = [
  'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRODUCT_DELETE',
  'INVOICE_CREATE', 'INVOICE_DELETE', 'OFFLINE_CONFLICT_APPROVE', 'OFFLINE_CONFLICT_REJECT',
  'EXPENSE_CREATE', 'EXPENSE_DELETE', 'CUSTOMER_CREATE', 'CUSTOMER_UPDATE', 'CUSTOMER_DELETE',
  'SUPPLIER_CREATE', 'SUPPLIER_UPDATE', 'SUPPLIER_DELETE', 'STOCK_ADJUST', 'USER_CREATE',
  'USER_UPDATE', 'CASHBOOK_CREATE',
  'CASHBOOK_CLOSING_SUBMIT', 'CASHBOOK_CLOSING_APPROVE', 'INVITATION_CREATED',
  'USER_CREATED_FROM_INVITATION', 'INVITATION_RESENT', 'INVITATION_DELETED',
  'PURCHASE_ORDER_CREATE', 'PURCHASE_ORDER_UPDATE', 'PURCHASE_ORDER_DELETE',
  'PURCHASE_ORDER_ORDERED', 'PURCHASE_ORDER_RECEIVE', 'SUPPLIER_PAYMENT',
  'INVOICE_DELETE_REFUSED', 'CUSTOMER_UPDATE_REJECTED', 'CUSTOMER_PAYMENT_RECORD',
  'CUSTOMER_PAYMENT_REVERSE', 'EXCHANGE_RATE_UPDATE'
];

// ── Helpers ──────────────────────────────────────────────────────────────────

// Captures console.error: every raw line, and the JSON lines that have an event.
const captureLines = t => {
  const consoleError = t.mock.method(console, 'error', () => {});
  const raw = () => consoleError.mock.calls.map(call => call.arguments.map(String).join(' '));
  const parsed = () => raw()
    .map(text => { try { return JSON.parse(text); } catch { return null; } })
    .filter(line => line !== null && typeof line === 'object' && typeof line.event === 'string');
  return { consoleError, raw, parsed };
};

// A logged line holds no sensitive value, no raw error message and no stack trace.
const assertSafeText = (text, ...alsoSensitive) => {
  for (const value of [...SENSITIVE, ...alsoSensitive]) {
    assert.ok(!text.includes(value), `a log line contains "${value}"`);
  }
  assert.doesNotMatch(text, /Injected|Stage 0 detail/, 'a log line contains a raw error message');
  assert.doesNotMatch(text, /\n|\\n|\bat \S+:\d+:\d+/, 'a log line contains a stack trace');
};

// A request object that carries sensitive values everywhere, for direct calls to the handler.
const sensitiveRequest = () => ({
  method: 'POST',
  originalUrl: `/api/stage0?email=${encodeURIComponent(SECRETS.email)}&phone=${encodeURIComponent(SECRETS.phone)}`,
  query: { email: SECRETS.email, phone: SECRETS.phone },
  headers: {
    'user-agent': SECRETS.userAgent,
    'x-forwarded-for': SECRETS.ip,
    authorization: `Bearer ${SECRETS.token}`,
    cookie: `sid=${SECRETS.token}`
  },
  body: { password: SECRETS.password, value: SECRETS.bodyValue },
  ip: SECRETS.ip
});

const fakeResponse = ({ headersSent = false, writableEnded = false, statusCode = 200 } = {}) => ({
  statusCode, headersSent, writableEnded, body: undefined, calls: [],
  status(code) { this.calls.push('status'); this.statusCode = code; return this; },
  json(body) { this.calls.push('json'); this.body = body; this.headersSent = true; this.writableEnded = true; return this; },
  destroy() { this.calls.push('destroy'); }
});

// Calls the real error handler directly. It must not throw and must never pass the error on.
const handle = (error, { req = sensitiveRequest(), res = fakeResponse() } = {}) => {
  let passedOn = 0;
  assert.doesNotThrow(() => errorHandler(error, req, res, () => { passedOn += 1; }));
  assert.equal(passedOn, 0, 'the error handler passed the error on to Express');
  return res;
};

// A small app with chosen failing routes in front of the real error handler. The spy behind the
// handler records any error passed on to Express's default handler.
const failingApp = routes => {
  const app = express();
  const escaped = [];
  for (const [routePath, handler] of Object.entries(routes)) app.get(routePath, handler);
  app.use(errorHandler);
  app.use((err, req, res, next) => { escaped.push(err); next(err); });
  return { app, escaped };
};

const tokenFor = user => jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '15m' });
const newPassword = () => crypto.randomBytes(18).toString('base64url');
const newEmail = label => `stage0-${label}-${crypto.randomBytes(4).toString('hex')}@example.invalid`;
const preflight = origin => request(fx.app()).options('/api/auth/login')
  .set('Origin', origin).set('Access-Control-Request-Method', 'POST');
const withEnvironment = async (environment, run) => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = environment;
  try {
    return await run();
  } finally {
    process.env.NODE_ENV = previous;
  }
};

// ── A1–A8 ────────────────────────────────────────────────────────────────────

test('A1 the AuditLog schema enum equals the list of 39 unique UPPER_SNAKE_CASE actions', () => {
  const { AUDIT_ACTIONS, isAuditAction } = auditActions;
  assert.deepEqual([...AUDIT_ACTIONS], APPROVED_ACTIONS);
  assert.equal(new Set(AUDIT_ACTIONS).size, 39);
  assert.ok(Object.isFrozen(AUDIT_ACTIONS));
  for (const action of AUDIT_ACTIONS) assert.match(action, /^[A-Z]+(?:_[A-Z]+)*$/);
  assert.deepEqual(m.AuditLog.schema.path('action').enumValues, APPROVED_ACTIONS);
  assert.equal(isAuditAction('SUPPLIER_PAYMENT'), true);
  for (const value of ['supplier_payment', 'NOT_AN_AUDIT_ACTION', '', undefined, null, 7, {}]) {
    assert.equal(isAuditAction(value), false, String(value));
  }
});

test('A2 every literal audit action in the backend source is on the list (the C14 scanner)', () => {
  const { actions } = fx.scanAuditActions();
  assert.ok(actions.size > 0);
  assert.deepEqual([...actions.keys()].filter(action => !auditActions.isAuditAction(action)), []);
});

test('A3 log() never throws: an unlisted action, a failing write and a failing console each leave at most one safe line', async t => {
  const { consoleError, raw, parsed } = captureLines(t);
  const entityId = fx.objectId();
  const entry = {
    user: users.admin, action: 'EXPENSE_CREATE', entity: 'Expense', entityId,
    details: { email: SECRETS.email, phone: SECRETS.phone, password: SECRETS.password },
    req: sensitiveRequest()
  };

  await assert.doesNotReject(auditLogger.log({ ...entry, action: 'NOT_AN_AUDIT_ACTION' }));
  const failingWrite = t.mock.method(m.AuditLog, 'create', async () => {
    throw Object.assign(new Error(`Injected write failure for ${SECRETS.email} from ${SECRETS.ip} using ${SECRETS.userAgent} with ${SECRETS.token}`), { code: 'ESTAGE0WRITE' });
  });
  await assert.doesNotReject(auditLogger.log(entry));
  assert.equal(failingWrite.mock.callCount(), 1);

  assert.deepEqual(parsed(), [
    { event: 'audit.action_rejected', entity: 'Expense', entityId },
    { event: 'audit.write_failed', action: 'EXPENSE_CREATE', entity: 'Expense', entityId, error: { name: 'Error', code: 'ESTAGE0WRITE' } }
  ]);
  for (const text of raw()) assertSafeText(text, users.admin.name, users.admin.email);

  consoleError.mock.mockImplementation(() => { throw new Error('console unavailable'); });
  await assert.doesNotReject(auditLogger.log(entry));
  await assert.doesNotReject(auditLogger.log({ action: 'NOT_AN_AUDIT_ACTION' }));
  await assert.doesNotReject(auditLogger.log(undefined));
  assert.equal(await m.AuditLog.countDocuments({ entityId }), 0);
});

test('A3 an audit failure line keeps only a listed action, a valid entity name and an ObjectId-shaped entity ID', async t => {
  const { raw, parsed } = captureLines(t);
  t.mock.method(m.AuditLog, 'create', async () => { throw new Error('Injected Stage 0 detail.'); });
  const validId = new mongoose.Types.ObjectId();
  const unreadableId = { toString() { throw new Error(`Injected ${SECRETS.email}`); } };
  const cases = [
    [{ action: 'EXPENSE_CREATE', entity: 'Expense', entityId: validId },
      { event: 'audit.write_failed', action: 'EXPENSE_CREATE', entity: 'Expense', entityId: String(validId), error: { name: 'Error' } }],
    [{ action: 'EXPENSE_CREATE', entity: SECRETS.email, entityId: SECRETS.phone },
      { event: 'audit.write_failed', action: 'EXPENSE_CREATE', error: { name: 'Error' } }],
    [{ action: 'EXPENSE_CREATE', entity: 'Has space', entityId: 'not-an-object-id' },
      { event: 'audit.write_failed', action: 'EXPENSE_CREATE', error: { name: 'Error' } }],
    [{ action: 'EXPENSE_CREATE', entity: 42, entityId: unreadableId },
      { event: 'audit.write_failed', action: 'EXPENSE_CREATE', error: { name: 'Error' } }],
    [{ action: SECRETS.email, entity: 'Expense', entityId: `${validId}0` },
      { event: 'audit.action_rejected', entity: 'Expense' }]
  ];
  for (const [entry, expected] of cases) {
    await assert.doesNotReject(auditLogger.log({ user: users.admin, details: { email: SECRETS.email }, req: sensitiveRequest(), ...entry }));
    assert.deepEqual(parsed().at(-1), expected);
  }
  assert.equal(parsed().length, cases.length);
  for (const text of raw()) assertSafeText(text, users.admin.name, users.admin.email);
});

test('A4 with every audit write failing, sign-in, a wrong password, an unknown email and sign-out still work', async t => {
  captureLines(t);
  const password = newPassword();
  const email = newEmail('a4');
  const user = await m.User.create({ name: 'Stage 0 A4 user', email, password, role: 'staff', isActive: true, isVerified: true });
  const failingWrite = t.mock.method(m.AuditLog, 'create', async () => { throw new Error('Injected audit write failure.'); });

  const signedIn = await fx.api(null).post('/api/auth/login', { email, password });
  assert.equal(signedIn.status, 200);
  assert.equal(typeof signedIn.body.data.accessToken, 'string');
  assert.equal(typeof signedIn.body.data.refreshToken, 'string');

  const wrong = await fx.api(null).post('/api/auth/login', { email, password: `${password}-wrong` });
  assert.equal(wrong.status, 401);
  assert.equal((await m.User.findById(user._id).select('+loginAttempts')).loginAttempts, 1); // the attempt is counted

  const unknown = await fx.api(null).post('/api/auth/login', { email: newEmail('a4-unknown'), password });
  assert.equal(unknown.status, 401);

  const signedOut = await fx.api(user).post('/api/auth/logout', { refreshToken: signedIn.body.data.refreshToken });
  assert.equal(signedOut.status, 200);

  assert.equal(failingWrite.mock.callCount(), 4);
  assert.equal(await m.AuditLog.countDocuments({ user: user._id }), 0);
});

test('A5 a normal sign-in stores LOGIN exactly once', async () => {
  const password = newPassword();
  const email = newEmail('a5');
  const user = await m.User.create({ name: 'Stage 0 A5 user', email, password, role: 'staff', isActive: true, isVerified: true });

  const signedIn = await fx.api(null).post('/api/auth/login', { email, password });

  assert.equal(signedIn.status, 200);
  assert.equal(await m.AuditLog.countDocuments({ action: 'LOGIN', user: user._id }), 1);
});

test('A6 an unexpected 500 returns only the generic message, and every response §12.7 keeps unchanged keeps its body', async t => {
  captureLines(t);
  const admin = fx.api(users.admin);
  const product = await fx.seedProduct();

  // An unexpected error on a real route.
  const failingLookup = t.mock.method(m.Product, 'findOne', () => { throw new Error('Injected Stage 0 detail.'); });
  const unexpected = await admin.get(`/api/products/${product._id}`);
  failingLookup.mock.restore();
  assert.deepEqual([unexpected.status, unexpected.body], [500, GENERIC_500]);

  // Unchanged, through real routes: a validation error, an invalid ID and the auth middleware's own 500.
  const invalid = await admin.post('/api/expenses', { title: 'Stage 0 A6 expense', amount: 5, category: 'Not a category' });
  assert.deepEqual([invalid.status, invalid.body],
    [400, { success: false, message: '`Not a category` is not a valid enum value for path `category`.' }]);
  const cast = await admin.get('/api/products/not-an-id');
  assert.deepEqual([cast.status, cast.body], [400, { success: false, message: 'Invalid ID format: not-an-id' }]);
  const failingUser = t.mock.method(m.User, 'findById', () => { throw new Error('Injected lookup failure.'); });
  const authFailure = await admin.get('/api/products');
  failingUser.mock.restore();
  assert.deepEqual([authFailure.status, authFailure.body], [500, { success: false, message: 'Server error during authentication.' }]);

  // Unchanged, through direct calls: each kind of error the existing mappings handle.
  const { getEmailDeliveryError } = backend('utils', 'emailDeliveryError');
  const duplicate = await m.User.create({ name: 'Stage 0 A6 duplicate', email: users.staff.email, password: newPassword() })
    .then(() => assert.fail('expected a duplicate key'), error => error);
  const unchanged = [
    [Object.assign(new Error('Stage 0 refusal.'), { statusCode: 409 }), 409, { success: false, message: 'Stage 0 refusal.' }],
    [new transactions.TransactionUnavailableError('TRANSACTION_RETRY_EXHAUSTED'), 503,
      { success: false, message: 'The system is busy. Please try again.' }],
    [new transactions.TransactionUnavailableError('TRANSACTION_COMMIT_UNKNOWN'), 503,
      { success: false, message: 'This change could not be confirmed. Check before trying again.' }],
    [Object.assign(new Error('Raw provider text.'), { statusCode: 403, code: 'EMAIL_DELIVERY_DISABLED' }), 403,
      { success: false, ...getEmailDeliveryError({ code: 'EMAIL_DELIVERY_DISABLED' }) }],
    [Object.assign(new Error('Stage 0 offline conflict.'), { statusCode: 409, code: 'OFFLINE_IDENTITY_CONFLICT', conflictDetails: { items: [{ line: 1 }] } }), 409,
      { success: false, message: 'Stage 0 offline conflict.', code: 'OFFLINE_IDENTITY_CONFLICT', conflictDetails: { items: [{ line: 1 }] } }],
    [duplicate, 400, { success: false, message: 'Email already exists.' }],
    [Object.assign(new Error('jwt malformed'), { name: 'JsonWebTokenError' }), 401, { success: false, message: 'Invalid token.' }]
  ];
  for (const [error, status, body] of unchanged) {
    const res = handle(error);
    assert.deepEqual([res.statusCode, res.body], [status, body], error.message);
  }

  // Unchanged (decision 3): outside the generic 500 and D18, a development response keeps its stack field.
  await withEnvironment('development', () => {
    const refusal = Object.assign(new Error('Stage 0 refusal.'), { statusCode: 409 });
    assert.deepEqual(handle(refusal).body, { success: false, message: 'Stage 0 refusal.', stack: refusal.stack });
  });

  // Unchanged: fixed 500 messages that routes send directly, never through the error handler.
  const route = file => fs.readFileSync(path.join(harness.BACKEND_ROOT, 'routes', file), 'utf8');
  assert.match(route('auth.js'), /return res\.status\(500\)\.json\(\{ success:false, message:'Could not send reset email\. Please contact admin\.' \}\);/);
  assert.match(route('webhooks.js'), /return res\.status\(500\)\.json\(\{ success: false, message: 'Could not store webhook event\.' \}\);/);
  assert.match(route('webhooks.js'), /return res\.status\(500\)\.json\(\{ success: false, message: 'Could not update email delivery status\.' \}\);/);

  // Unchanged (D18): the blocked-CORS response through the real app.
  const blocked = await preflight('https://evil.example');
  assert.deepEqual([blocked.status, blocked.body], [500, { success: false, message: 'CORS blocked: https://evil.example' }]);
});

test('A7 direct calls: whatever an error or request carries, the line holds only the event, status, method, route and safe error fields', async t => {
  const { raw, parsed } = captureLines(t);
  await m.User.create({ name: 'Stage 0 A7 user', email: SECRETS.email, password: newPassword() });
  const duplicate = await m.User.create({ name: 'Stage 0 A7 duplicate', email: SECRETS.email, password: newPassword() })
    .then(() => assert.fail('expected a duplicate key'), error => error);
  const validation = new m.Expense({ title: 'Stage 0 A7', amount: 5, category: SECRETS.email }).validateSync();
  const cast = await m.Product.findOne({ _id: SECRETS.email }).then(() => assert.fail('expected a cast error'), error => error);
  const labelled = new mongoose.mongo.MongoServerError({
    message: `Injected failure for ${SECRETS.email}`, code: 112, codeName: 'WriteConflict',
    errorLabels: ['TransientTransactionError', 'RetryableWriteError', 'NotAnAllowListedLabel', SECRETS.email]
  });
  const crafted = Object.assign(new Error(`Injected ${SECRETS.password}`), { name: SECRETS.email, code: SECRETS.phone, codeName: `Bad ${SECRETS.token}` });
  const unexpected = new Error(`Injected failure: ${SENSITIVE.join(' ')}`);
  // Not a driver error: its labels are read from an errorLabels array.
  const plainLabelled = Object.assign(new Error(`Injected failure for ${SECRETS.email}`), {
    errorLabels: ['TransientTransactionError', 'NotAnAllowListedLabel', SECRETS.email]
  });

  const cases = [
    [unexpected, 500, { name: 'Error' }],
    [duplicate, 400, { name: 'MongoServerError', code: 11000 }, 'at least'],
    [validation, 400, { name: 'ValidationError' }],
    [cast, 400, { name: 'CastError' }],
    [labelled, 500, { name: 'MongoServerError', code: 112, codeName: 'WriteConflict', labels: ['RetryableWriteError', 'TransientTransactionError'] }],
    [plainLabelled, 500, { name: 'Error', labels: ['TransientTransactionError'] }],
    [crafted, 500, {}]
  ];
  for (const [error, status, description, comparison] of cases) {
    const before = parsed().length;
    const res = handle(error);
    assert.equal(res.statusCode, status);
    if (status === 500) assert.deepEqual(res.body, GENERIC_500);
    const lines = parsed().slice(before);
    assert.equal(lines.length, 1);
    const [line] = lines;
    assert.deepEqual(Object.keys(line).sort(), ERROR_HANDLER_FIELDS);
    assert.deepEqual([line.event, line.status, line.method, line.route], ['http.error_handled', status, 'POST', 'unmatched']);
    if (comparison === 'at least') {
      for (const [field, value] of Object.entries(description)) assert.deepEqual(line.error[field], value);
      assert.ok(Object.keys(line.error).every(field => ['name', 'code', 'codeName', 'labels'].includes(field)));
    } else {
      assert.deepEqual(line.error, description);
    }
  }
  for (const text of raw()) assertSafeText(text);
});

test('A7 real requests: a malformed body, an invalid ID, a validation failure and an unexpected error log no sensitive value, and the lines name the route pattern', async t => {
  const { raw, parsed } = captureLines(t);
  const product = await fx.seedProduct();
  const query = `?email=${encodeURIComponent(SECRETS.email)}&phone=${encodeURIComponent(SECRETS.phone)}`;
  const tokens = [];
  const call = (method, url) => {
    const token = tokenFor(users.admin);
    tokens.push(token);
    return request(fx.app())[method](url)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Forwarded-For', SECRETS.ip)
      .set('User-Agent', SECRETS.userAgent)
      .set('Cookie', `sid=${SECRETS.token}`);
  };

  const malformed = await call('post', `/api/expenses${query}`)
    .set('Content-Type', 'application/json')
    .send(`{"password":"${SECRETS.password}","value":"${SECRETS.bodyValue}"`);
  assert.equal(malformed.status, 400);
  const invalidId = await call('get', `/api/products/${encodeURIComponent(SECRETS.email)}${query}`);
  assert.deepEqual([invalidId.status, invalidId.body], [400, { success: false, message: `Invalid ID format: ${SECRETS.email}` }]);
  const invalidBody = await call('post', `/api/expenses${query}`)
    .send({ title: 'Stage 0 A7 expense', amount: 5, category: SECRETS.email, description: SECRETS.bodyValue, password: SECRETS.password });
  assert.equal(invalidBody.status, 400);
  const failingLookup = t.mock.method(m.Product, 'findOne', () => { throw new Error(`Injected failure: ${SENSITIVE.join(' ')}`); });
  const unexpected = await call('get', `/api/products/${product._id}${query}`);
  failingLookup.mock.restore();
  assert.deepEqual([unexpected.status, unexpected.body], [500, GENERIC_500]);

  const lines = parsed().filter(line => line.event === 'http.error_handled');
  assert.deepEqual(lines.map(line => [line.status, line.method, line.route, line.error.name]), [
    [400, 'POST', 'unmatched', 'SyntaxError'],
    [400, 'GET', '/api/products/:id', 'CastError'],
    [400, 'POST', '/api/expenses', 'ValidationError'],
    [500, 'GET', '/api/products/:id', 'Error']
  ]);
  for (const line of lines) assert.deepEqual(Object.keys(line).sort(), ERROR_HANDLER_FIELDS);
  for (const text of raw()) assertSafeText(text, ...tokens, String(product._id), 'phone=');
});

test('A7 a generic 500 has no stack even in development, and a blocked CORS request from an IP-address origin logs no Origin value', async t => {
  const { raw, parsed } = captureLines(t);
  const product = await fx.seedProduct();

  await withEnvironment('development', async () => {
    const failingLookup = t.mock.method(m.Product, 'findOne', () => { throw new Error('Injected Stage 0 detail.'); });
    const unexpected = await fx.api(users.admin).get(`/api/products/${product._id}`);
    failingLookup.mock.restore();
    assert.deepEqual([unexpected.status, unexpected.body], [500, GENERIC_500]);
    assert.deepEqual(handle(new Error('Injected Stage 0 detail.')).body, GENERIC_500);
  });

  const origin = `http://${SECRETS.ip}:5173`;
  const blocked = await preflight(origin);
  // D18 is an explicit exception: its unchanged body carries the Origin value, which can be an IP address.
  assert.deepEqual([blocked.status, blocked.body], [500, { success: false, message: `CORS blocked: ${origin}` }]);
  assert.deepEqual(parsed().filter(line => line.event === 'http.error_handled').at(-1),
    { event: 'http.error_handled', status: 500, method: 'OPTIONS', route: 'unmatched', error: { name: 'CorsBlockedError' } });
  for (const text of raw()) assertSafeText(text);
});

test('A7 the fallback: when an existing mapping or the response body fails, the generic 500 is sent, the line stays safe and nothing reaches Express', async t => {
  const { raw, parsed } = captureLines(t);

  // A duplicate-key error without keyValue makes the existing mapping throw.
  const noKeyValue = Object.assign(new Error(`Injected E11000 duplicate key ${SECRETS.email}`), { code: 11000 });
  // A status getter that throws while the mappings are evaluated.
  const throwingStatus = new Error('Injected Stage 0 detail.');
  Object.defineProperty(throwingStatus, 'statusCode', { get() { throw new Error(`Injected getter failure ${SECRETS.token}`); } });
  // A response body that cannot be serialized.
  const circular = { items: [] };
  circular.self = circular;
  const unserializable = Object.assign(new Error('Injected Stage 0 detail.'), { statusCode: 409, code: 'OFFLINE_IDENTITY_CONFLICT', conflictDetails: circular });
  for (const error of [noKeyValue, throwingStatus, unserializable]) {
    const res = handle(error);
    assert.deepEqual([res.statusCode, res.body], [500, GENERIC_500]);
  }

  // A response that was already sent: nothing more is sent, and an unfinished one is closed.
  const finished = handle(new Error(`Injected late failure ${SECRETS.email}`), { res: fakeResponse({ headersSent: true, writableEnded: true, statusCode: 201 }) });
  assert.deepEqual(finished.calls, []);
  const unfinished = handle(new Error('Injected Stage 0 detail.'), { res: fakeResponse({ headersSent: true, writableEnded: false, statusCode: 200 }) });
  assert.deepEqual(unfinished.calls, ['destroy']);

  const lines = parsed();
  assert.deepEqual(lines.map(line => line.status), [500, 500, 500, 201, 200]);
  assert.deepEqual(lines.map(line => line.error), [
    { name: 'Error', code: 11000 }, { name: 'Error' }, { name: 'Error', code: 'OFFLINE_IDENTITY_CONFLICT' }, { name: 'Error' }, { name: 'Error' }
  ]);

  // The same through a real Express app: the client gets the generic JSON 500, a response sent
  // before the error reaches the client intact, and the spy behind the handler sees no error.
  const { app, escaped } = failingApp({
    '/stage0/mapping-fails': (req, res, next) => next(Object.assign(new Error(`Injected E11000 ${SECRETS.email}`), { code: 11000 })),
    '/stage0/sent-then-failed': (req, res, next) => {
      res.status(201).json({ success: true });
      next(new Error(`Injected late failure ${SECRETS.email}`));
    }
  });
  const mapped = await request(app).get('/stage0/mapping-fails');
  assert.deepEqual([mapped.status, mapped.body], [500, GENERIC_500]);
  const late = await request(app).get('/stage0/sent-then-failed');
  assert.deepEqual([late.status, late.body], [201, { success: true }]);
  assert.deepEqual(escaped, []);
  assert.deepEqual(parsed().slice(lines.length).map(line => [line.status, line.route]),
    [[500, '/stage0/mapping-fails'], [201, '/stage0/sent-then-failed']]);
  for (const text of raw()) assertSafeText(text);
});

test('A7 every line has exactly the five fields and a status, even when the response and its fallback both fail, the request is unreadable or the sent status is unknown', async t => {
  const { raw, parsed } = captureLines(t);
  const unsendable = () => ({
    ...fakeResponse(),
    json() { this.calls.push('json'); throw new Error(`Injected send failure ${SECRETS.email}`); }
  });
  const unstatusable = () => ({
    ...fakeResponse(),
    status() { this.calls.push('status'); throw new Error(`Injected status failure ${SECRETS.token}`); }
  });
  const unreadableRequest = Object.defineProperty({}, 'method', { get() { throw new Error(`Injected request failure ${SECRETS.ip}`); } });

  // The response and the generic 500 fallback both fail: the line still records 500, and the
  // open response is closed rather than left hanging.
  const bothFail = handle(Object.assign(new Error('Injected Stage 0 detail.'), { statusCode: 409 }), { res: unsendable() });
  assert.deepEqual(bothFail.calls, ['status', 'json', 'status', 'json', 'destroy']);
  const statusFails = handle(new Error('Injected Stage 0 detail.'), { res: unstatusable() });
  assert.deepEqual(statusFails.calls, ['status', 'status', 'destroy']);
  // A missing or unreadable request, and an already-sent response whose status cannot be read.
  handle(new Error('Injected Stage 0 detail.'), { req: null });
  handle(new Error('Injected Stage 0 detail.'), { req: unreadableRequest });
  const unknownSent = handle(new Error('Injected Stage 0 detail.'),
    { res: { ...fakeResponse({ headersSent: true, writableEnded: true }), statusCode: undefined } });
  assert.deepEqual(unknownSent.calls, []);
  // Reading the response's state fails before any status is known: the 500 set before any
  // attempt is logged, and the response is closed.
  const unreadableResponse = Object.defineProperty(fakeResponse(), 'headersSent',
    { get() { throw new Error(`Injected response failure ${SECRETS.email}`); } });
  const unreadable = handle(new Error('Injected Stage 0 detail.'), { res: unreadableResponse });
  assert.deepEqual(unreadable.calls, ['destroy']);
  assert.deepEqual(parsed().map(line => [line.status, line.method, line.route]), [
    [500, 'POST', 'unmatched'], [500, 'POST', 'unmatched'],
    [500, 'UNKNOWN', 'unmatched'], [500, 'UNKNOWN', 'unmatched'],
    [500, 'POST', 'unmatched'], [500, 'POST', 'unmatched']
  ]);

  // Through a real Express app whose response cannot be sent: the connection is closed without a
  // response, the line records 500, and the spy behind the handler sees no error.
  const { app, escaped } = failingApp({
    '/stage0/unsendable': (req, res, next) => {
      res.json = () => { throw new Error(`Injected send failure ${SECRETS.email}`); };
      next(new Error('Injected Stage 0 detail.'));
    }
  });
  const closed = await request(app).get(`/stage0/unsendable?email=${encodeURIComponent(SECRETS.email)}`)
    .then(() => assert.fail('expected the connection to close without a response'), error => error);
  assert.equal(closed.response, undefined);
  assert.deepEqual(escaped, []);
  assert.deepEqual(parsed().at(-1),
    { event: 'http.error_handled', status: 500, method: 'GET', route: '/stage0/unsendable', error: { name: 'Error' } });

  assert.equal(parsed().length, 7);
  for (const line of parsed()) {
    assert.deepEqual(Object.keys(line).sort(), ERROR_HANDLER_FIELDS);
    assert.ok(Number.isInteger(line.status));
  }
  for (const text of raw()) assertSafeText(text);
});

test('A7 route templates: full templates for static mounts and app routes; "unmatched" for parameterized, wildcard, nested, non-static or non-string routes', async t => {
  const { raw, parsed } = captureLines(t);
  const fail = (req, res, next) => next(new Error('Injected Stage 0 detail.'));
  const app = express();
  const things = express.Router();
  things.get('/', fail);
  things.get(/^\/pattern-(\d+)$/, fail); // a RegExp route path
  things.get(['/list-a', '/list-b'], fail); // an array route path
  things.get('/:id', fail);
  app.use('/api/things', things);
  const scoped = express.Router();
  scoped.get('/:id', fail);
  app.use('/api/shops/:shopId', scoped); // a mount with a parameter
  const wildcard = express.Router();
  wildcard.get('/', fail);
  app.use('/api/any/*', wildcard); // a wildcard mount
  const outer = express.Router();
  const inner = express.Router();
  inner.get('/:id', fail);
  outer.use('/inner', inner); // a router inside a router
  app.use('/api/outer', outer);
  const dotted = express.Router();
  dotted.get('/:id', fail);
  app.use('/api/v1.0', dotted); // a static mount the template check does not recognise
  app.get('/stage0/direct/:id', fail);
  app.use(errorHandler);
  const escaped = [];
  app.use((err, req, res, next) => { escaped.push(err); next(err); });

  const cases = [
    ['/api/things', '/api/things'],
    ['/api/things/sentinel-id-1', '/api/things/:id'],
    ['/stage0/direct/sentinel-id-2', '/stage0/direct/:id'],
    ['/api/things/pattern-77', 'unmatched'],
    ['/api/things/list-b', 'unmatched'],
    ['/api/shops/sentinel-shop/sentinel-id-3', 'unmatched'],
    ['/api/any/sentinel-path/sentinel-id-4', 'unmatched'],
    ['/api/outer/inner/sentinel-id-5', 'unmatched'],
    ['/api/v1.0/sentinel-id-6', 'unmatched']
  ];
  for (const [url, route] of cases) {
    const res = await request(app).get(`${url}?email=${encodeURIComponent(SECRETS.email)}`);
    assert.deepEqual([res.status, res.body], [500, GENERIC_500], url);
    assert.deepEqual(parsed().at(-1), { event: 'http.error_handled', status: 500, method: 'GET', route, error: { name: 'Error' } }, url);
  }
  assert.equal(parsed().length, cases.length);
  assert.deepEqual(escaped, []);

  // Direct calls with route information that does not belong to the app.
  for (const req of [
    { method: 'GET', route: { path: '/x' } },
    { method: 'GET', route: { path: '/x' }, app: { _router: { stack: [] } } },
    { method: 'GET', route: { path: '/:id' }, app: { _router: { stack: [{ handle: { stack: 'not a stack' } }] } } }
  ]) {
    handle(new Error('Injected Stage 0 detail.'), { req });
    assert.equal(parsed().at(-1).route, 'unmatched');
  }
  for (const text of raw()) assertSafeText(text, 'sentinel-id', 'sentinel-shop', 'sentinel-path', 'pattern-77', 'list-b');
});

test('A8 only the error from app.js’s CORS check gets the exact D18 body, with no stack field in test or development', async t => {
  const { raw } = captureLines(t);
  const { createCorsBlockedError, isCorsBlockedError } = corsBlockedError;
  const D18 = { success: false, message: 'CORS blocked: https://evil.example' };

  for (const environment of ['test', 'development']) {
    await withEnvironment(environment, async () => {
      // The real CORS check, through the real app.
      const blocked = await preflight('https://evil.example');
      assert.deepEqual([blocked.status, blocked.body], [500, D18], environment);
      // The marked error, directly.
      assert.deepEqual(handle(createCorsBlockedError('https://evil.example')).body, D18, environment);
      // Unmarked errors with exactly the CORS message, or only its prefix, get the generic 500.
      for (const message of ['CORS blocked: https://evil.example', 'CORS blocked: https://evil.example/elsewhere']) {
        assert.deepEqual(handle(new Error(message)).body, GENERIC_500, `${environment}: ${message}`);
      }
      // A copy of a marked error is not marked.
      const marked = createCorsBlockedError('https://evil.example');
      assert.deepEqual(handle(Object.assign(new Error(marked.message), marked)).body, GENERIC_500, environment);
    });
  }

  // Through test routes in front of the real handler.
  const { app, escaped } = failingApp({
    '/stage0/cors-message': () => { throw new Error('CORS blocked: https://evil.example'); },
    '/stage0/cors-prefix': () => { throw new Error('CORS blocked: https://evil.example/elsewhere'); }
  });
  for (const url of ['/stage0/cors-message', '/stage0/cors-prefix']) {
    const res = await request(app).get(url);
    assert.deepEqual([res.status, res.body], [500, GENERIC_500], url);
  }
  assert.deepEqual(escaped, []);
  assert.equal(isCorsBlockedError(new Error('CORS blocked: https://evil.example')), false);
  assert.equal(isCorsBlockedError(null), false);
  assert.deepEqual(Object.keys(corsBlockedError).sort(), ['createCorsBlockedError', 'isCorsBlockedError']);
  for (const text of raw()) assert.ok(!text.includes('evil.example'), 'a log line contains the Origin');

  // Source scan: app.js's CORS check is the only code that creates the marked error, the marker
  // symbol exists only in corsBlockedError.js, and no code recognises the error by its message.
  const { files } = fx.scanAuditActions();
  const code = file => fs.readFileSync(path.join(harness.BACKEND_ROOT, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.deepEqual(files.filter(file => /createCorsBlockedError\s*\(/.test(code(file))), ['app.js']);
  assert.equal(code('app.js').match(/createCorsBlockedError\s*\(/g).length, 1);
  assert.match(code('app.js'), /^\s*cb\(createCorsBlockedError\(origin\)\);$/m);
  assert.deepEqual(files.filter(file => /Symbol\s*\(/.test(code(file))), ['utils/corsBlockedError.js']);
  assert.deepEqual(files.filter(file => /CORS blocked/.test(code(file))), ['utils/corsBlockedError.js']);
});
