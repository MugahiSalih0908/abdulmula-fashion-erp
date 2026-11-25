'use strict';
// tests/app.contract.test.js – characterization tests for the server.js → app.js
// refactor. They pin the CURRENT behaviour of middleware ordering, CORS, rate
// limiting, webhook raw-body routing, body parsing, 404/error handling and route
// registration. Assertions marked "current behaviour" are expected to change only
// through a later, reviewed security change (e.g. removing localhost from
// production CORS in Phase A4).

const harness = require('./helpers/harness'); // must be first: applies isolation guards

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const APP_ORIGIN = 'https://app.abdulmulafashion.com';
const WWW_ORIGIN = 'https://www.abdulmulafashion.com';
const PREVIEW_ORIGIN = 'https://abdulmula-fashion-git-security-mugahid-s-projects.vercel.app';

let app;

test.before(async () => {
  await harness.startTestDatabase();
  app = harness.createTestApp();
});

test.after(async () => {
  await harness.stopTestDatabase();
});

test('middleware order is preserved: CORS → webhooks (raw body) → JSON → urlencoded → logging → routes → 404 → error handler', () => {
  const stack = app._router.stack;
  const indexOf = predicate => stack.findIndex(predicate);
  const byName = name => layer => layer.name === name;
  const mountedAt = mountPath => layer => layer.name === 'router' && layer.regexp.test(mountPath);

  const cors = indexOf(byName('corsMiddleware'));
  const webhooks = indexOf(mountedAt('/api/webhooks/resend'));
  const json = indexOf(byName('jsonParser'));
  const urlencoded = indexOf(byName('urlencodedParser'));
  const logger = indexOf(byName('logger'));
  const authRoutes = indexOf(mountedAt('/api/auth/login'));

  for (const [name, index] of Object.entries({ cors, webhooks, json, urlencoded, logger, authRoutes })) {
    assert.notEqual(index, -1, `${name} layer must be registered`);
  }
  assert.ok(cors < webhooks, 'CORS runs before the webhook router');
  assert.ok(webhooks < json, 'webhook router is registered before express.json() (raw body for signatures)');
  assert.ok(json < urlencoded && urlencoded < logger && logger < authRoutes);
  assert.equal(stack[stack.length - 1].name, 'errorHandler', 'error handler is registered last');
  assert.equal(app.get('trust proxy'), 1);
});

test('root and health routes keep their response contracts', async () => {
  const root = await request(app).get('/');
  assert.equal(root.status, 200);
  assert.deepEqual(root.body, { success: true, message: 'Abdulmula Fashion ERP API running' });

  const health = await request(app).get('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.success, true);
  assert.equal(health.body.version, '5.0');
  assert.equal(health.body.env, 'test');
  assert.equal(health.body.service, 'Abdulmula Fashion ERP');
  assert.ok(!Number.isNaN(Date.parse(health.body.time)));
});

test('helmet security headers are applied', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.match(response.headers['strict-transport-security'], /max-age=\d+/);
  assert.ok(response.headers['content-security-policy']);
  assert.equal(response.headers['x-powered-by'], undefined);
});

test('general /api rate limit (500 per 15 minutes) sends standard headers', async () => {
  const response = await request(app).get('/api/health').set('X-Forwarded-For', harness.uniqueClientIp());
  assert.equal(response.headers['ratelimit-limit'], '500');
  assert.ok(response.headers['ratelimit-remaining']);
  const root = await request(app).get('/');
  assert.equal(root.headers['ratelimit-limit'], undefined, 'the root route is outside /api');
});

test('login rate limit allows 20 attempts per IP and then returns 429 with the existing message', async () => {
  const ip = harness.uniqueClientIp();
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const response = await request(app).post('/api/auth/login').set('X-Forwarded-For', ip).send({});
    assert.equal(response.status, 400, `attempt ${attempt} reaches the route`);
  }
  const limited = await request(app).post('/api/auth/login').set('X-Forwarded-For', ip).send({});
  assert.equal(limited.status, 429);
  assert.deepEqual(limited.body, { success: false, message: 'Too many login attempts. Wait 15 minutes.' });

  const otherIp = await request(app).post('/api/auth/login').set('X-Forwarded-For', harness.uniqueClientIp()).send({});
  assert.equal(otherIp.status, 400, 'the limit is per client IP (trust proxy = 1)');
});

test('JSON and urlencoded bodies are parsed for API routes', async () => {
  const json = await request(app).post('/api/auth/login')
    .set('X-Forwarded-For', harness.uniqueClientIp())
    .send({ email: 'not-an-email', password: 'irrelevant' });
  assert.equal(json.status, 400);
  assert.equal(json.body.message, 'Enter a valid email address.');

  const form = await request(app).post('/api/auth/login')
    .set('X-Forwarded-For', harness.uniqueClientIp())
    .type('form')
    .send('email=not-an-email&password=irrelevant');
  assert.equal(form.status, 400);
  assert.equal(form.body.message, 'Enter a valid email address.');
});

test('webhook route still receives the raw body for signature verification', async () => {
  const unconfigured = await request(app).post('/api/webhooks/resend')
    .set('Content-Type', 'application/json')
    .send('{"type":"email.delivered"}');
  assert.equal(unconfigured.status, 503);
  assert.deepEqual(unconfigured.body, { success: false, message: 'Email webhook is not configured.' });

  // A FAKE, test-only signing secret. If express.json() had consumed the body first,
  // the route would answer "Raw webhook body is required." instead.
  process.env.RESEND_WEBHOOK_SECRET = `whsec_${Buffer.from('test-only-not-a-real-secret').toString('base64')}`;
  try {
    const badSignature = await request(app).post('/api/webhooks/resend')
      .set('Content-Type', 'application/json')
      .set('svix-id', 'msg_test')
      .set('svix-timestamp', String(Math.floor(Date.now() / 1000)))
      .set('svix-signature', 'v1,invalid')
      .send('{"type":"email.delivered","data":{}}');
    assert.equal(badSignature.status, 400);
    assert.deepEqual(badSignature.body, { success: false, message: 'Invalid email webhook signature.' });
  } finally {
    delete process.env.RESEND_WEBHOOK_SECRET;
  }
});

test('CORS behaviour is unchanged (current behaviour)', async () => {
  const preflight = origin => request(app)
    .options('/api/auth/login')
    .set('Origin', origin)
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'content-type');

  for (const origin of [APP_ORIGIN, WWW_ORIGIN, PREVIEW_ORIGIN, 'http://localhost:5173']) {
    const response = await preflight(origin);
    assert.equal(response.status, 204, `${origin} preflight`);
    assert.equal(response.headers['access-control-allow-origin'], origin);
    assert.equal(response.headers['access-control-allow-credentials'], 'true');
    assert.equal(response.headers['access-control-allow-methods'], 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    assert.equal(response.headers['access-control-allow-headers'], 'Content-Type,Authorization');
  }

  const blocked = await preflight('https://evil.example');
  assert.equal(blocked.status, 500, 'current behaviour: CORS rejection reaches the error handler');
  assert.deepEqual(blocked.body, { success: false, message: 'CORS blocked: https://evil.example' });
  assert.equal(blocked.headers['access-control-allow-origin'], undefined);

  const lookalike = await preflight('https://abdulmula-fashion-git-x-mugahid-s-projects.vercel.app.evil.example');
  assert.equal(lookalike.status, 500);

  const noOrigin = await request(app).get('/api/health');
  assert.equal(noOrigin.status, 200, 'requests without Origin are allowed (current behaviour)');
  assert.equal(noOrigin.headers['access-control-allow-origin'], undefined);
});

test('unknown routes keep the 404 JSON contract', async () => {
  const response = await request(app).get('/api/does-not-exist');
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { success: false, message: 'GET /api/does-not-exist not found.' });
});

test('every existing API router is still mounted behind authentication', async () => {
  const protectedPaths = [
    '/api/auth/me',
    '/api/dashboard',
    '/api/invitations',
    '/api/products',
    '/api/invoices',
    '/api/customers',
    '/api/suppliers',
    '/api/expenses',
    '/api/staff',
    '/api/email-logs',
    '/api/purchase-orders',
    '/api/cashbook/today',
    '/api/reports/summary'
  ];
  for (const path of protectedPaths) {
    const response = await request(app).get(path).set('X-Forwarded-For', harness.uniqueClientIp());
    assert.equal(response.status, 401, `${path} must be mounted and require authentication`);
    assert.deepEqual(response.body, { success: false, message: 'Not authenticated. Please log in.' });
  }
});
