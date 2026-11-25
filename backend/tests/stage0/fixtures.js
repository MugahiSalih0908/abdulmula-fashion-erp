'use strict';
// tests/stage0/fixtures.js – shared setup for the Stage 0 characterization tests.
//
// Each Stage 0 test file requires tests/helpers/harness.js FIRST, then this file.
// All data is synthetic: generated users and tokens, invented records, an in-memory
// MongoDB replica set and no network access (enforced by the harness).
//
// Determinism, for these test processes only (production settings are untouched):
//  * TZ is UTC, the assumed production server timezone.
//  * After the database starts, the clock is frozen with node:test mock timers BEFORE
//    any model or route loads, so schema defaults (Date.now) and every `new Date()`
//    see the same instant. Tests move it explicitly with setClock(); nothing sleeps
//    or races.

process.env.TZ = 'UTC';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { mock } = require('node:test');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const harness = require('../helpers/harness');

const FROZEN_NOW = '2026-11-23T10:00:00.000Z';
const MODEL_NAMES = ['AuditLog', 'CashBook', 'CashClosing', 'Customer', 'Expense', 'Invoice',
  'OfflineConflictDecision', 'Product', 'PurchaseOrder', 'StockMovement', 'Supplier', 'User'];

const state = { app: null, clientIp: null, models: null };
let sequence = 0;
const nextLabel = prefix => `${prefix}-${(sequence += 1)}`;

const startSuite = async () => {
  await harness.startTestDatabase();
  mock.timers.enable({ apis: ['Date'], now: Date.parse(FROZEN_NOW) });
  state.models = Object.fromEntries(MODEL_NAMES.map(name =>
    [name, require(path.join(harness.BACKEND_ROOT, 'models', name))]));
  await Promise.all(Object.values(state.models).map(model => model.init())); // collections + unique indexes
  state.app = harness.createTestApp();
  state.clientIp = harness.uniqueClientIp();
  return state.models;
};

const stopSuite = async () => {
  mock.timers.reset();
  await harness.stopTestDatabase();
};

const setClock = iso => mock.timers.setTime(Date.parse(iso));

// Users get random passwords that are never stored elsewhere or printed.
const createUser = role => state.models.User.create({
  name: `Stage 0 ${role} ${sequence + 1}`,
  email: `${nextLabel(`stage0-${role}`)}@example.invalid`,
  password: crypto.randomBytes(24).toString('base64url'),
  role,
  isActive: true,
  isVerified: true
});
const createUsers = async () => ({
  admin: await createUser('admin'),
  manager: await createUser('manager'),
  staff: await createUser('staff')
});

// protect() verifies a Bearer JWT carrying { id } with JWT_SECRET, which the harness
// generates per run. A fresh token is signed per request, so moving the frozen clock
// never expires it. Tokens are never logged.
const tokenFor = user => jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '15m' });

const api = user => {
  const send = (method, url, body) => {
    let req = request(state.app)[method](url).set('X-Forwarded-For', state.clientIp);
    if (user) req = req.set('Authorization', `Bearer ${tokenFor(user)}`);
    return body === undefined ? req : req.send(body);
  };
  return {
    get: url => send('get', url),
    post: (url, body = {}) => send('post', url, body),
    put: (url, body = {}) => send('put', url, body),
    patch: (url, body = {}) => send('patch', url, body),
    delete: url => send('delete', url)
  };
};

const seedProduct = (overrides = {}) => state.models.Product.create({
  name: nextLabel('Stage 0 product'), price: 12.5, costPrice: 8, quantity: 10,
  category: 'Other', lowStockThreshold: 2, ...overrides
});
const seedCustomer = (overrides = {}) => state.models.Customer.create({ name: nextLabel('Stage 0 customer'), ...overrides });
const seedSupplier = (overrides = {}) => state.models.Supplier.create({ name: nextLabel('Stage 0 supplier'), ...overrides });

// The body the POS sends for an online checkout (POSPage.jsx handleCheckout and
// cartStore.js toInvoicePayload): expectedUnitPrice instead of unitPrice, no amountPaid,
// cashReceived only for Cash, and a per-checkout offline ID.
const posSale = ({ lines, paymentMethod = 'Cash', customer, offlineId = nextLabel('stage0-checkout') }) => {
  const total = lines.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0);
  return {
    items: lines.map(({ product, quantity }) => ({
      productId: String(product._id), productName: product.name, quantity, discount: 0,
      expectedUnitPrice: product.price
    })),
    paymentMethod,
    taxRate: 0,
    note: '',
    ...(customer ? { customerId: String(customer._id) } : {}),
    ...(paymentMethod === 'Cash' ? { cashReceived: total } : {}),
    offlineId,
    offlineCreatedAt: new Date().toISOString()
  };
};

const collectionExists = async name =>
  (await require('mongoose').connection.db.listCollections({ name }).toArray()).length > 0;

const objectId = () => new (require('mongoose').Types.ObjectId)().toString();

const loadRoute = name => require(path.join(harness.BACKEND_ROOT, 'routes', `${name}.js`));

// Static scans: read source text only, never execute it.
//
// scanAuditActions() reads every backend application source file (.js, .cjs, .mjs),
// recursively, and classifies each `action` property it finds:
//  * actions    – string literals in single, double or backtick quotes (without ${})
//                 in audit-action form (UPPER_SNAKE_CASE), with their locations;
//  * labels     – any other string literal, e.g. details: { action: 'account_activated' };
//  * nonLiteral – every occurrence a static scan cannot read as a literal: schema and index
//                 definitions, destructuring, parameters, assignments, shorthand properties
//                 and expressions. Tests must list and explain each one.
// Skipped: node_modules, test directories, *.test.* and *.spec.* files, build output,
// dot-directories, non-JavaScript files (such as .env) and comment lines.
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'tests', 'test', '__tests__', 'coverage', 'dist', 'build']);
const listBackendSourceFiles = (dir = harness.BACKEND_ROOT) => fs.readdirSync(dir, { withFileTypes: true })
  .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  .flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return SKIPPED_DIRECTORIES.has(entry.name) || entry.name.startsWith('.') ? [] : listBackendSourceFiles(full);
    }
    return /\.[cm]?js$/.test(entry.name) && !/\.(?:test|spec)\.[cm]?js$/.test(entry.name) ? [full] : [];
  });

const scanAuditActions = () => {
  const inventory = { files: [], actions: new Map(), labels: [], nonLiteral: [] };
  for (const file of listBackendSourceFiles()) {
    const relative = path.relative(harness.BACKEND_ROOT, file).split(path.sep).join('/');
    inventory.files.push(relative);
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
      if (/^\s*(?:\/\/|\/\*|\*)/.test(line)) return; // comment line
      const location = `${relative}:${index + 1}`;
      for (const key of line.matchAll(/(?<![\w$.])action\s*:\s*/g)) {
        const rest = line.slice(key.index + key[0].length);
        const literal = /^(['"`])([^'"`$\\]*)\1/.exec(rest);
        if (literal && /^[A-Z][A-Z0-9_]*$/.test(literal[2])) {
          inventory.actions.set(literal[2], [...(inventory.actions.get(literal[2]) || []), location]);
        } else if (literal) {
          const inDetails = /\bdetails\s*:\s*\{[^}]*$/.test(line.slice(0, key.index));
          inventory.labels.push({ location, value: literal[2], inDetails });
        } else {
          const kind = rest.startsWith('{') ? 'schema' : /^-?\d/.test(rest) ? 'index' : 'expression';
          inventory.nonLiteral.push(`${location} ${kind}`);
        }
      }
      for (const name of line.matchAll(/(?<![\w$.])action\s*(?=[,}]|$)/g)) {
        if (!/(?:^|[{,])\s*$/.test(line.slice(0, name.index))) continue;
        const kind = /\b(?:const|let|var)\s*\{[^}]*\baction\b[^}]*\}\s*=/.test(line) ? 'destructuring'
          : /\(\s*\{[^}]*\baction\b[^}]*\}\s*\)\s*=>/.test(line) ? 'parameter' : 'shorthand';
        inventory.nonLiteral.push(`${location} ${kind}`);
      }
      if (/\.action\s*=(?!=)/.test(line)) inventory.nonLiteral.push(`${location} assignment`);
    });
  }
  return inventory;
};

const findFrontendReferences = needle => {
  const root = path.resolve(harness.BACKEND_ROOT, '..', 'frontend', 'src');
  return fs.readdirSync(root, { recursive: true }).map(String)
    .filter(file => /\.(?:js|jsx|mjs)$/.test(file))
    .filter(file => fs.readFileSync(path.join(root, file), 'utf8').includes(needle));
};

module.exports = {
  FROZEN_NOW,
  api,
  app: () => state.app,
  collectionExists,
  createUsers,
  findFrontendReferences,
  loadRoute,
  objectId,
  posSale,
  scanAuditActions,
  seedCustomer,
  seedProduct,
  seedSupplier,
  setClock,
  startSuite,
  stopSuite
};
