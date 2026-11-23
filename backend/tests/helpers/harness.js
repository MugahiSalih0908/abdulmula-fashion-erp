'use strict';
// tests/helpers/harness.js – isolated backend integration-test harness
//
// Require this module FIRST in every integration test file. Loading it applies
// the isolation guarantees below immediately, before any application module is
// loaded. tests/harness.safety.test.js proves each guarantee.
//
//  1. No .env loading: `dotenv`, config/db.js, server.js and
//     scripts/create-admin.js cannot be required, and process.loadEnvFile()
//     is disabled.
//  2. Credential-like environment variables (MongoDB URIs, JWT secrets, email
//     provider keys, admin passwords, tokens, ...) are deleted, then replaced by
//     generated, test-only values. Values are never printed.
//  3. Every outbound TCP/TLS connection and DNS query that is not for the
//     loopback interface is refused with code TEST_NETWORK_BLOCKED. This covers
//     MongoDB Atlas, Resend and any other external service. Loopback connections
//     to the standard MongoDB ports (27017-27019) are refused as well, so a local
//     MongoDB installation on the developer machine can never be reached.
//  4. MongoDB is mongodb-memory-server running as a single-node replica set
//     (needed for transactions) bound to 127.0.0.1, using the version pinned in
//     backend/package.json "config.mongodbMemoryServer". Runtime binary
//     downloads are disabled, so tests never download anything.
//  5. NODE_ENV=test and EMAIL_DELIVERY_MODE=disabled, so no email can be sent.
//
// This file lives in tests/helpers/ (not tests/test/) and is not named *.test.js,
// so `node --test` does not execute it as a test file.

const crypto = require('node:crypto');
const dns = require('node:dns');
const fs = require('node:fs');
const Module = require('node:module');
const net = require('node:net');
const path = require('node:path');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..');
const LOOPBACK_BIND_IP = '127.0.0.1';

// ── Pinned MongoDB test binary ───────────────────────────────────────────────
const packageJson = JSON.parse(fs.readFileSync(path.join(BACKEND_ROOT, 'package.json'), 'utf8'));
const mongomsConfig = (packageJson.config && packageJson.config.mongodbMemoryServer) || {};
if (!mongomsConfig.version || !mongomsConfig.downloadDir) {
  throw new Error('backend/package.json must pin config.mongodbMemoryServer.version and downloadDir.');
}
const MONGODB_TEST_VERSION = mongomsConfig.version;
const MONGODB_DOWNLOAD_DIR = path.resolve(BACKEND_ROOT, mongomsConfig.downloadDir);

// ── Error helpers ────────────────────────────────────────────────────────────
const blockedModules = [];
const blockedConnections = [];
const blockedDnsQueries = [];

const harnessError = (code, message) => Object.assign(new Error(message), { code });
const networkBlocked = target =>
  harnessError('TEST_NETWORK_BLOCKED', `Test harness blocked non-loopback network access: ${target}`);

// ── Loopback detection ───────────────────────────────────────────────────────
const isLoopbackHost = host => {
  // Node's net/tls default an omitted host to "localhost".
  if (host === undefined || host === null || host === '') return true;
  const value = String(host).trim().toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (value === 'localhost' || value === '::1' || value === '0:0:0:0:0:0:0:1') return true;
  const ipv4 = value.startsWith('::ffff:') ? value.slice('::ffff:'.length) : value;
  return net.isIPv4(ipv4) && ipv4.split('.')[0] === '127';
};

// ── 1. Block .env loading and production entry points ────────────────────────
const normalizePath = filePath => {
  const normalized = path.normalize(filePath);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
};
const BLOCKED_MODULE_FILES = new Set([
  path.join(BACKEND_ROOT, 'server.js'),
  path.join(BACKEND_ROOT, 'config', 'db.js'),
  path.join(BACKEND_ROOT, 'scripts', 'create-admin.js'),
].map(normalizePath));

const originalModuleLoad = Module._load;
Module._load = function harnessGuardedLoad(request, parent, isMain) {
  if (request === 'dotenv' || request.startsWith('dotenv/')) {
    blockedModules.push(request);
    throw harnessError('TEST_MODULE_BLOCKED', `Test harness blocked loading "${request}" (.env must never be loaded in tests).`);
  }
  if (request.startsWith('.') || path.isAbsolute(request)) {
    let filename = null;
    try { filename = Module._resolveFilename(request, parent, isMain); } catch { filename = null; }
    if (filename && BLOCKED_MODULE_FILES.has(normalizePath(filename))) {
      blockedModules.push(path.relative(BACKEND_ROOT, filename));
      throw harnessError('TEST_MODULE_BLOCKED', `Test harness blocked loading "${path.relative(BACKEND_ROOT, filename)}" (it loads .env or connects to the real database).`);
    }
  }
  return originalModuleLoad.apply(this, arguments);
};

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile = () => {
    throw harnessError('TEST_MODULE_BLOCKED', 'Test harness blocked process.loadEnvFile().');
  };
}

// ── 2. Scrub credential-like environment variables ───────────────────────────
const SENSITIVE_ENV_NAME =
  /(^MONGO|^JWT|^RESEND|^EMAIL|^SMTP|^ADMIN_|^CLIENT_|^FRONTEND_|^DATABASE|^ATLAS|^RENDER|^VERCEL|SECRET|TOKEN|PASSWORD|PASSWD|API_?KEY|PRIVATE_?KEY|CREDENTIAL|_URI$|_DSN$)/i;

let scrubbedEnvCount = 0;
for (const name of Object.keys(process.env)) {
  if (SENSITIVE_ENV_NAME.test(name)) {
    delete process.env[name];
    scrubbedEnvCount += 1;
  }
}

const TEST_ENV = Object.freeze({
  NODE_ENV: 'test',
  EMAIL_DELIVERY_MODE: 'disabled',
  JWT_SECRET: crypto.randomBytes(48).toString('hex'),
  JWT_REFRESH_SECRET: crypto.randomBytes(48).toString('hex'),
  // Public, non-secret origins (mirror the documented production values).
  CLIENT_URL: 'https://app.abdulmulafashion.com,https://www.abdulmulafashion.com',
  FRONTEND_URL: 'https://app.abdulmulafashion.com',
  // mongodb-memory-server: pinned binary, local cache only, never download at test time.
  MONGOMS_VERSION: MONGODB_TEST_VERSION,
  MONGOMS_DOWNLOAD_DIR: MONGODB_DOWNLOAD_DIR,
  MONGOMS_RUNTIME_DOWNLOAD: 'false',
  MONGOMS_PREFER_GLOBAL_PATH: 'false'
});
Object.assign(process.env, TEST_ENV);

// ── 3. Block non-loopback network access ─────────────────────────────────────
const describeConnectTarget = args => {
  // net.connect()/tls.connect() pass a normalized [options, callback] array.
  let options = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (options === undefined || options === null) return { kind: 'tcp', host: undefined, port: undefined };
  if (typeof options === 'object') {
    if (options.path) return { kind: 'ipc' };
    return { kind: 'tcp', host: options.host, port: options.port };
  }
  if (typeof options === 'string' && !/^\d+$/.test(options)) return { kind: 'ipc' };
  return { kind: 'tcp', host: typeof args[1] === 'string' ? args[1] : undefined, port: options };
};

// A developer machine may also run its own MongoDB (for example the Windows
// "MongoDB" service on 127.0.0.1:27017). Loopback connections to the standard
// MongoDB ports are refused too. The harness's in-memory instances never use
// them: mongodb-memory-server takes random ports from the OS ephemeral range.
const STANDARD_MONGODB_PORTS = new Set([27017, 27018, 27019]);

const originalSocketConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function harnessGuardedConnect(...args) {
  const target = describeConnectTarget(args);
  if (target.kind === 'tcp' &&
      (!isLoopbackHost(target.host) || STANDARD_MONGODB_PORTS.has(Number(target.port)))) {
    const description = `${target.host}:${target.port}`;
    blockedConnections.push(description);
    throw networkBlocked(description);
  }
  return originalSocketConnect.apply(this, args);
};

const DNS_FUNCTIONS = ['lookup', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCname', 'resolveSrv', 'resolveTxt'];
for (const name of DNS_FUNCTIONS) {
  const original = dns[name];
  if (typeof original !== 'function') continue;
  dns[name] = function harnessGuardedDns(hostname, ...rest) {
    if (!isLoopbackHost(hostname)) {
      blockedDnsQueries.push(`${name}:${hostname}`);
      const error = networkBlocked(`DNS ${name} ${hostname}`);
      const callback = rest[rest.length - 1];
      if (typeof callback === 'function') {
        process.nextTick(callback, error);
        return undefined;
      }
      throw error;
    }
    return original.call(this, hostname, ...rest);
  };
}
for (const name of DNS_FUNCTIONS) {
  const original = dns.promises[name];
  if (typeof original !== 'function') continue;
  dns.promises[name] = async function harnessGuardedDnsPromise(hostname, ...rest) {
    if (!isLoopbackHost(hostname)) {
      blockedDnsQueries.push(`promises.${name}:${hostname}`);
      throw networkBlocked(`DNS ${name} ${hostname}`);
    }
    return original.call(this, hostname, ...rest);
  };
}

// ── 4. In-memory MongoDB replica set on 127.0.0.1 ────────────────────────────
const assertLoopbackMongoUri = uri => {
  const match = /^mongodb:\/\/([^/?]+)/.exec(String(uri));
  if (!match) throw harnessError('TEST_DATABASE_REFUSED', 'Test harness only accepts a plain mongodb:// loopback URI.');
  for (const hostPort of match[1].split(',')) {
    const host = hostPort.replace(/:\d+$/, '');
    if (host !== LOOPBACK_BIND_IP) {
      throw harnessError('TEST_DATABASE_REFUSED', 'Test harness refused a MongoDB URI that is not bound to 127.0.0.1.');
    }
  }
};

let replSet = null;
let database = null;

const startTestDatabase = async () => {
  if (database) return database;
  const { MongoMemoryReplSet } = require('mongodb-memory-server');
  const mongoose = require('mongoose');

  try {
    replSet = await MongoMemoryReplSet.create({
      binary: { version: MONGODB_TEST_VERSION, downloadDir: MONGODB_DOWNLOAD_DIR },
      instanceOpts: [{ ip: LOOPBACK_BIND_IP }],
      replSet: { count: 1, ip: LOOPBACK_BIND_IP, storageEngine: 'wiredTiger' }
    });
  } catch (error) {
    throw harnessError(
      'TEST_DATABASE_UNAVAILABLE',
      `Could not start the in-memory MongoDB ${MONGODB_TEST_VERSION} replica set (${error.message}). ` +
      'If the binary is missing, download it once from backend/ with: node node_modules/mongodb-memory-server/postinstall.js'
    );
  }

  const dbName = `abdulmula_test_${crypto.randomBytes(6).toString('hex')}`;
  const uri = replSet.getUri(dbName);
  assertLoopbackMongoUri(uri);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  database = { uri, dbName, mongoose };
  return database;
};

const stopTestDatabase = async () => {
  const mongoose = require('mongoose');
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
  replSet = null;
  database = null;
};

// ── Application and request helpers ──────────────────────────────────────────
// Note: route modules and middleware/invitationLimiter.js are cached singletons,
// so invitation rate-limit counters are shared by every app created in one
// test process. The /api and /api/auth/login limiters are created per app.
const createTestApp = () => {
  const { createApp } = require(path.join(BACKEND_ROOT, 'app.js'));
  return createApp();
};

// Distinct client IPs (RFC 2544 benchmark range, never routed) let tests keep
// the real per-IP rate limits without sharing counters. Used only as an
// X-Forwarded-For header value; nothing connects to these addresses.
let clientIpCounter = 0;
const uniqueClientIp = () => {
  clientIpCounter += 1;
  return `198.18.${Math.floor(clientIpCounter / 250) % 250}.${(clientIpCounter % 250) + 1}`;
};

const getIsolationReport = () => ({
  scrubbedEnvCount,
  blockedModules: [...blockedModules],
  blockedConnections: [...blockedConnections],
  blockedDnsQueries: [...blockedDnsQueries]
});

module.exports = {
  BACKEND_ROOT,
  LOOPBACK_BIND_IP,
  MONGODB_TEST_VERSION,
  MONGODB_DOWNLOAD_DIR,
  SENSITIVE_ENV_NAME,
  TEST_ENV,
  isLoopbackHost,
  startTestDatabase,
  stopTestDatabase,
  createTestApp,
  uniqueClientIp,
  getIsolationReport
};
