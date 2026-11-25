'use strict';
// tests/harness.safety.test.js – proves the integration-test harness is isolated:
// no .env loading, no credential environment variables, no Atlas or other
// external network access, no real email, and an in-memory MongoDB replica set
// bound only to 127.0.0.1.

const harness = require('./helpers/harness'); // must be first: applies isolation guards

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const dns = require('node:dns');
const fs = require('node:fs');
const https = require('node:https');
const net = require('node:net');
const path = require('node:path');

const blocked = { code: 'TEST_MODULE_BLOCKED' };
const isNetworkBlocked = error =>
  error?.code === 'TEST_NETWORK_BLOCKED' || error?.cause?.code === 'TEST_NETWORK_BLOCKED';

let db;

test.before(async () => {
  db = await harness.startTestDatabase();
});

test.after(async () => {
  await harness.stopTestDatabase();
});

test('credential-like environment variables are removed before app code loads (planted values)', () => {
  // A child process starts with deliberately planted FAKE credentials and then
  // loads the harness, proving they are scrubbed or replaced before any app code.
  const childEnv = {
    ...process.env,
    MONGO_URI: 'mongodb+srv://planted-user:planted-pass@planted-cluster.example.invalid/abdulmula_erp',
    RESEND_API_KEY: 're_planted_fake_value',
    RESEND_WEBHOOK_SECRET: 'whsec_planted_fake_value',
    JWT_SECRET: 'planted-fake-jwt-secret',
    JWT_REFRESH_SECRET: 'planted-fake-refresh-secret',
    ADMIN_PASSWORD: 'planted-fake-admin-password',
    EMAIL_DELIVERY_MODE: 'live',
    EMAIL_FROM: 'planted@example.invalid',
    NODE_ENV: 'production',
    CLIENT_PREVIEW_URL: 'https://planted.example.invalid',
    MONGOMS_VERSION: '0.0.1',
    MONGOMS_RUNTIME_DOWNLOAD: 'true',
    SOME_SERVICE_API_KEY: 'planted-fake-api-key'
  };
  delete childEnv.NODE_TEST_CONTEXT;

  const script = `
    const harness = require(${JSON.stringify(path.join(__dirname, 'helpers', 'harness.js'))});
    const env = process.env;
    let dotenv = 'loaded';
    try { require('dotenv'); } catch (error) { dotenv = error.code; }
    process.stdout.write(JSON.stringify({
      MONGO_URI: env.MONGO_URI ?? null,
      RESEND_API_KEY: env.RESEND_API_KEY ?? null,
      RESEND_WEBHOOK_SECRET: env.RESEND_WEBHOOK_SECRET ?? null,
      ADMIN_PASSWORD: env.ADMIN_PASSWORD ?? null,
      EMAIL_FROM: env.EMAIL_FROM ?? null,
      CLIENT_PREVIEW_URL: env.CLIENT_PREVIEW_URL ?? null,
      SOME_SERVICE_API_KEY: env.SOME_SERVICE_API_KEY ?? null,
      jwtSecretIsPlanted: env.JWT_SECRET === 'planted-fake-jwt-secret',
      jwtRefreshSecretIsPlanted: env.JWT_REFRESH_SECRET === 'planted-fake-refresh-secret',
      jwtSecretMatchesHarness: env.JWT_SECRET === harness.TEST_ENV.JWT_SECRET,
      EMAIL_DELIVERY_MODE: env.EMAIL_DELIVERY_MODE,
      NODE_ENV: env.NODE_ENV,
      MONGOMS_VERSION: env.MONGOMS_VERSION,
      MONGOMS_RUNTIME_DOWNLOAD: env.MONGOMS_RUNTIME_DOWNLOAD,
      dotenv
    }));
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: harness.BACKEND_ROOT,
    env: childEnv,
    encoding: 'utf8',
    timeout: 30000
  });
  assert.equal(result.status, 0, 'harness child process should exit cleanly');
  const report = JSON.parse(result.stdout);

  assert.deepEqual(report, {
    MONGO_URI: null,
    RESEND_API_KEY: null,
    RESEND_WEBHOOK_SECRET: null,
    ADMIN_PASSWORD: null,
    EMAIL_FROM: null,
    CLIENT_PREVIEW_URL: null,
    SOME_SERVICE_API_KEY: null,
    jwtSecretIsPlanted: false,
    jwtRefreshSecretIsPlanted: false,
    jwtSecretMatchesHarness: true,
    EMAIL_DELIVERY_MODE: 'disabled',
    NODE_ENV: 'test',
    MONGOMS_VERSION: harness.MONGODB_TEST_VERSION,
    MONGOMS_RUNTIME_DOWNLOAD: 'false',
    dotenv: 'TEST_MODULE_BLOCKED'
  });
});

test('only generated test values remain for credential-like environment variables', () => {
  for (const name of Object.keys(process.env)) {
    if (!harness.SENSITIVE_ENV_NAME.test(name)) continue;
    assert.ok(Object.hasOwn(harness.TEST_ENV, name), `unexpected credential-like variable remains: ${name}`);
    assert.equal(process.env[name], harness.TEST_ENV[name], `${name} must hold the generated test value`);
  }
  assert.equal(process.env.MONGO_URI, undefined);
  assert.equal(process.env.RESEND_API_KEY, undefined);
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.EMAIL_DELIVERY_MODE, 'disabled');
  assert.match(process.env.JWT_SECRET, /^[0-9a-f]{96}$/);
  assert.notEqual(process.env.JWT_SECRET, process.env.JWT_REFRESH_SECRET);
});

test('.env loaders, the database connector and production entry points cannot be loaded', () => {
  assert.throws(() => require('dotenv'), blocked);
  assert.throws(() => require('dotenv/config'), blocked);
  assert.throws(() => require('../config/db'), blocked);
  assert.throws(() => require('../server'), blocked);
  assert.throws(() => require('../scripts/create-admin'), blocked);
  if (typeof process.loadEnvFile === 'function') {
    assert.throws(() => process.loadEnvFile(), blocked);
  }

  harness.createTestApp();
  const loaded = Object.keys(require.cache).map(file => file.toLowerCase());
  const sep = path.sep;
  assert.ok(!loaded.some(file => file.includes(`${sep}node_modules${sep}dotenv${sep}`)), 'dotenv must not be loaded');
  for (const forbidden of ['server.js', path.join('config', 'db.js'), path.join('scripts', 'create-admin.js')]) {
    const forbiddenPath = path.join(harness.BACKEND_ROOT, forbidden).toLowerCase();
    assert.ok(!loaded.includes(forbiddenPath), `${forbidden} must not be loaded`);
  }
});

test('app.js builds the application without loading .env, connecting or listening', () => {
  const source = fs.readFileSync(path.join(harness.BACKEND_ROOT, 'app.js'), 'utf8');
  const code = source.replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /dotenv/);
  assert.doesNotMatch(code, /config\/db|connectDB|mongoose\.connect/);
  assert.doesNotMatch(code, /\.listen\(/);
  assert.match(code, /module\.exports = \{ createApp \}/);
});

test('loopback detection accepts only the loopback interface', () => {
  for (const host of ['127.0.0.1', '127.10.20.30', 'localhost', 'LOCALHOST', '::1', '[::1]', '::ffff:127.0.0.1', undefined, '']) {
    assert.equal(harness.isLoopbackHost(host), true, `${host} should be loopback`);
  }
  for (const host of ['0.0.0.0', '10.0.0.1', '192.0.2.10', '198.18.0.1', 'api.resend.com',
    'cluster0.mongodb.net', '127.0.0.1.example.invalid', 'localhost.example.invalid', '::ffff:192.0.2.10']) {
    assert.equal(harness.isLoopbackHost(host), false, `${host} must not be treated as loopback`);
  }
});

test('outbound TCP, TLS, HTTPS and fetch connections to non-loopback hosts are blocked', async () => {
  // Reserved, non-resolvable names (.invalid) and documentation addresses (192.0.2.0/24)
  // are used so that nothing could leave the machine even if a guard failed.
  assert.throws(() => net.connect({ host: 'api.resend.invalid', port: 443 }), isNetworkBlocked);
  assert.throws(() => net.connect(27017, '192.0.2.10'), isNetworkBlocked);

  await new Promise((resolve, reject) => {
    try {
      const request = https.request('https://api.resend.invalid/emails', { method: 'POST' });
      request.on('error', error => (isNetworkBlocked(error) ? resolve() : reject(error)));
      request.end();
    } catch (error) {
      if (isNetworkBlocked(error)) resolve(); else reject(error);
    }
  });

  await assert.rejects(fetch('https://api.resend.invalid/emails'), isNetworkBlocked);

  const report = harness.getIsolationReport();
  assert.ok(report.blockedConnections.includes('api.resend.invalid:443'));
  assert.ok(report.blockedConnections.includes('192.0.2.10:27017'));
});

test('DNS lookups and SRV queries for non-loopback names (e.g. Atlas mongodb+srv) are blocked', async () => {
  await assert.rejects(dns.promises.resolveSrv('_mongodb._tcp.planted-cluster.example.invalid'), isNetworkBlocked);
  await assert.rejects(dns.promises.lookup('planted-cluster.example.invalid'), isNetworkBlocked);
  await new Promise((resolve, reject) => {
    dns.lookup('api.resend.invalid', error => (isNetworkBlocked(error) ? resolve() : reject(error)));
  });
  await new Promise((resolve, reject) => {
    dns.lookup('localhost', error => (error ? reject(error) : resolve()));
  });
});

test('a MongoDB client cannot reach Atlas, any remote server, or a local MongoDB on the default port', async () => {
  const { mongoose } = db;
  const before = harness.getIsolationReport().blockedConnections.length;

  const remote = mongoose.createConnection('mongodb://planted-shard-00.example.invalid:27017/abdulmula_erp', {
    serverSelectionTimeoutMS: 1500
  });
  await assert.rejects(remote.asPromise());
  await remote.close().catch(() => {});

  const srv = mongoose.createConnection('mongodb+srv://planted-cluster.example.invalid/abdulmula_erp', {
    serverSelectionTimeoutMS: 1500
  });
  await assert.rejects(srv.asPromise());
  await srv.close().catch(() => {});

  // A local MongoDB service on the developer machine (default port) must be unreachable too.
  assert.throws(() => net.connect({ host: '127.0.0.1', port: 27017 }), isNetworkBlocked);
  const local = mongoose.createConnection('mongodb://127.0.0.1:27017/abdulmula_erp', {
    serverSelectionTimeoutMS: 1500
  });
  await assert.rejects(local.asPromise());
  await local.close().catch(() => {});

  const report = harness.getIsolationReport();
  assert.ok(report.blockedConnections.includes('127.0.0.1:27017'), 'the local default-port MongoDB must be blocked');
  assert.ok(report.blockedConnections.length > before, 'the direct host connection attempt must be blocked');
  assert.ok(report.blockedConnections.includes('planted-shard-00.example.invalid:27017'));
  assert.ok(report.blockedDnsQueries.some(query => query.includes('planted-cluster.example.invalid')),
    'the SRV lookup must be blocked');
});

test(`the test database is an in-memory MongoDB ${harness.MONGODB_TEST_VERSION} replica set bound to 127.0.0.1`, async () => {
  const { mongoose, uri } = db;
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\/abdulmula_test_[0-9a-f]{12}\?/);
  assert.equal(mongoose.connection.readyState, 1);
  assert.equal(mongoose.connection.host, '127.0.0.1');
  assert.match(mongoose.connection.name, /^abdulmula_test_[0-9a-f]{12}$/);
  for (const connection of mongoose.connections) {
    if (connection.readyState === 1) assert.equal(connection.host, '127.0.0.1');
  }

  const admin = mongoose.connection.db.admin();
  const buildInfo = await admin.command({ buildInfo: 1 });
  assert.equal(buildInfo.version, harness.MONGODB_TEST_VERSION);
  // Production Atlas runs 8.0.39, which MongoDB has not published as a Community
  // download; the pin is the newest public 8.0 release. Keep it in the 8.0 series.
  assert.match(harness.MONGODB_TEST_VERSION, /^8\.0\.\d+$/);

  const cmdLine = await admin.command({ getCmdLineOpts: 1 });
  assert.equal(cmdLine.parsed.net.bindIp, '127.0.0.1');

  const hello = await admin.command({ hello: 1 });
  assert.ok(hello.setName, 'must be a replica set member');
  assert.ok(hello.isWritablePrimary);
  assert.ok(hello.hosts.length >= 1);
  for (const member of hello.hosts) assert.match(member, /^127\.0\.0\.1:\d+$/);

  const probe = mongoose.connection.db.collection('harness_transaction_probe');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await probe.insertOne({ ok: true }, { session });
    });
  } finally {
    await session.endSession();
  }
  assert.equal(await probe.countDocuments({ ok: true }), 1, 'transactions must be supported');
});

test('no real email can be sent', async () => {
  const { validateEmailDelivery } = require('../utils/emailConfig');
  assert.throws(
    () => validateEmailDelivery({ recipient: 'person@example.com', env: process.env }),
    { code: 'EMAIL_DELIVERY_DISABLED' }
  );

  const before = harness.getIsolationReport().blockedConnections.length;
  const { sendEmail } = require('../utils/sendEmail');
  const result = await sendEmail({ to: 'person@example.com', subject: 'Harness check', html: '<p>Harness check</p>' });
  assert.equal(result.skipped, true);
  assert.equal(process.env.RESEND_API_KEY, undefined);
  assert.equal(harness.getIsolationReport().blockedConnections.length, before, 'no email network attempt is made');
});

test('the harness never downloads MongoDB binaries at test time', () => {
  assert.equal(process.env.MONGOMS_RUNTIME_DOWNLOAD, 'false');
  assert.equal(process.env.MONGOMS_VERSION, harness.MONGODB_TEST_VERSION);
  assert.equal(process.env.MONGOMS_DOWNLOAD_DIR, harness.MONGODB_DOWNLOAD_DIR);
  assert.ok(harness.MONGODB_DOWNLOAD_DIR.startsWith(path.join(harness.BACKEND_ROOT, 'node_modules')),
    'binaries are cached inside the git-ignored backend/node_modules folder');
});
