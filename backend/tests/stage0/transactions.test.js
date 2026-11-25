'use strict';
// Stage 0, S0-5a – the transaction helper (ADR-0001 §12.4) and transactional audit recording
// (§12.5): T1–T9 in §12.14.
//
// Everything runs against the harness's in-memory MongoDB replica set with synthetic data. The
// harness cannot inject server failures, so commit outcomes are scripted at the helper boundary,
// on the real sessions runTransaction() starts and with real driver error classes; counts are
// taken at that boundary and never rely on driver-internal retries (§12.4). The injected sleep
// records each delay and returns at once, and the injected random returns fixed values, so every
// run is deterministic and no test waits.

const harness = require('../helpers/harness'); // must be first: applies isolation guards

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const fx = require('./fixtures');

const { MongoServerError } = mongoose.mongo;
const backend = (...parts) => require(path.join(harness.BACKEND_ROOT, ...parts));

let m;
let users;
let tx;
let audit;
let mail;
let errorHandler;
let EmailLog;

// Application modules load after startSuite() freezes the clock, as in the other Stage 0 files.
test.before(async () => {
  m = await fx.startSuite();
  users = await fx.createUsers();
  tx = backend('utils', 'transactions');
  audit = backend('utils', 'auditLogger');
  mail = backend('utils', 'sendEmail');
  errorHandler = backend('middleware', 'errorHandler');
  EmailLog = backend('models', 'EmailLog');
});
test.after(fx.stopSuite);

const APPROVED_SETTINGS = {
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
  readPreference: 'primary'
};
const PUBLIC_503 = {
  TRANSACTION_RETRY_EXHAUSTED: 'The system is busy. Please try again.',
  TRANSACTION_COMMIT_UNKNOWN: 'This change could not be confirmed. Check before trying again.'
};
const GENERIC_500 = { success: false, message: 'Something went wrong. Check the result before trying again.' };

// Real driver errors carrying the labels the helper reacts to.
const injected = (errorLabels, code, codeName) =>
  new MongoServerError({ message: 'Injected test failure.', errorLabels, code, codeName });
const transientError = () => injected(['TransientTransactionError'], 112, 'WriteConflict');
const unknownResultError = (extraLabels = []) =>
  injected(['UnknownTransactionCommitResult', ...extraLabels], 91, 'ShutdownInProgress');
// An error that is not a driver error but carries an errorLabels array.
const nonDriverError = errorLabels => Object.assign(new Error('Injected test failure.'), { errorLabels });
const TRANSIENT_DESCRIPTION = { name: 'MongoServerError', code: 112, codeName: 'WriteConflict', labels: ['TransientTransactionError'] };
const UNKNOWN_DESCRIPTION = { name: 'MongoServerError', code: 91, codeName: 'ShutdownInProgress', labels: ['UnknownTransactionCommitResult'] };

// Wraps every session runTransaction() starts: it records each startTransaction() options object,
// counts the helper's commitTransaction() calls, and lets script(call, commit) decide each
// commit's outcome (by default the real commit).
const wrapSessions = (t, { script = (call, commit) => commit(), source } = {}) => {
  const startSession = source || mongoose.startSession.bind(mongoose);
  const record = { sessions: [], settings: [], commitCalls: 0 };
  t.mock.method(mongoose, 'startSession', async (...args) => {
    const session = await startSession(...args);
    record.sessions.push(session);
    const startTransaction = session.startTransaction.bind(session);
    session.startTransaction = options => {
      record.settings.push(structuredClone(options));
      return startTransaction(options);
    };
    const commitTransaction = session.commitTransaction.bind(session);
    session.commitTransaction = async (...commitArgs) => {
      record.commitCalls += 1;
      return script(record.commitCalls, () => commitTransaction(...commitArgs));
    };
    return session;
  });
  return record;
};

// The injected sleep records each delay; the injected random returns the given values in turn.
const injectedWaits = (values = [0.5]) => {
  const delays = [];
  let draws = 0;
  return {
    delays,
    options: {
      sleep: async ms => { delays.push(ms); },
      random: () => values[Math.min(draws++, values.length - 1)]
    }
  };
};

// Captures console.error and returns its JSON lines.
const captureLines = t => {
  const consoleError = t.mock.method(console, 'error', () => {});
  return () => consoleError.mock.calls
    .map(call => { try { return JSON.parse(call.arguments.join(' ')); } catch { return null; } })
    .filter(line => line !== null && typeof line === 'object');
};

// The response the real error handler gives an error, from a direct call.
const respond = error => {
  const res = {
    statusCode: 200, body: undefined, headersSent: false, writableEnded: false,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; this.headersSent = true; this.writableEnded = true; return this; },
    destroy() { assert.fail('the error handler must not destroy an unsent response'); }
  };
  errorHandler(error, { method: 'POST', originalUrl: '/api/stage0', headers: {}, body: {} }, res,
    () => assert.fail('the error handler must not pass an error on'));
  return res;
};

const createExpense = async (session, label) => {
  const [expense] = await m.Expense.create([{
    title: `Stage 0 transaction ${label}`, amount: 5, category: 'Other', addedBy: users.admin._id
  }], { session });
  return expense;
};
const auditExpense = (session, expense) => audit.recordAudit({
  user: users.admin, action: 'EXPENSE_CREATE', entity: 'Expense', entityId: expense._id,
  details: { title: expense.title }
}, { session });
const expenses = label => m.Expense.countDocuments({ title: `Stage 0 transaction ${label}` });
const audits = label => m.AuditLog.countDocuments({ 'details.title': `Stage 0 transaction ${label}` });

// Every attempt asked for the approved settings, and the driver holds them for the transaction.
const assertRequestedSettings = (record, attempts) => {
  assert.equal(record.settings.length, attempts);
  for (const settings of record.settings) assert.deepEqual(settings, APPROVED_SETTINGS);
};
const assertDriverSettings = session => {
  const { readConcern, writeConcern, readPreference } = session.transaction.options;
  assert.deepEqual([readConcern.level, writeConcern.w, readPreference.mode], ['snapshot', 'majority', 'primary']);
};

test('T1 a successful callback commits once, returns its result and ends the session; every transaction asks for snapshot reads, majority writes and the primary', async t => {
  const record = wrapSessions(t);
  const { delays, options } = injectedWaits();

  const result = await tx.runTransaction(async (session, { attempt }) => {
    assert.equal(tx.isInsideTransaction(), true);
    assertDriverSettings(session);
    const expense = await createExpense(session, 'T1');
    await auditExpense(session, expense);
    return { attempt, id: String(expense._id) };
  }, options);

  assert.equal(result.attempt, 1);
  assert.equal(record.sessions.length, 1);
  assert.equal(record.commitCalls, 1);
  assert.deepEqual(delays, []);
  assert.equal(record.sessions[0].hasEnded, true);
  assertRequestedSettings(record, 1);
  assert.equal(await expenses('T1'), 1);
  assert.equal(await audits('T1'), 1);
  assert.equal(await m.AuditLog.countDocuments({ action: 'EXPENSE_CREATE', entityId: result.id }), 1);
  assert.equal(tx.isInsideTransaction(), false);
});

test('T1 the server receives snapshot read concern, and majority write concern on the first commit and on a commit-only retry, all on the primary', async t => {
  // A second connection to the same in-memory replica set, with command monitoring, so the test
  // sees the commands the server receives. The helper's session comes from this connection.
  const { uri } = await harness.startTestDatabase();
  const monitored = await mongoose.createConnection(uri, { monitorCommands: true, serverSelectionTimeoutMS: 15000 }).asPromise();
  try {
    const started = [];
    monitored.getClient().on('commandStarted', event => started.push(event));
    const record = wrapSessions(t, {
      source: (...args) => monitored.startSession(...args),
      script: async (call, commit) => {
        await commit();
        if (call === 1) throw unknownResultError(); // the first commit applies, but its result is lost
      }
    });
    const { options } = injectedWaits();
    const probe = monitored.collection('stage0_transaction_settings');

    await tx.runTransaction(async session => {
      assertDriverSettings(session);
      await probe.insertOne({ label: 'T1-wire' }, { session });
    }, options);

    assert.equal(record.commitCalls, 2);
    assertRequestedSettings(record, 1);
    const sent = started.filter(event => ['insert', 'commitTransaction', 'abortTransaction'].includes(event.commandName));
    assert.deepEqual(sent.map(event => event.commandName), ['insert', 'commitTransaction', 'commitTransaction']);
    const [insert, ...commits] = sent;
    assert.equal(insert.command.startTransaction, true);
    assert.equal(insert.command.readConcern.level, 'snapshot');
    for (const commit of commits) assert.equal(commit.command.writeConcern.w, 'majority');
    const { primary } = await monitored.db.admin().command({ hello: 1 });
    for (const event of sent) assert.equal(event.address, primary);
    assert.equal(await probe.countDocuments({ label: 'T1-wire' }), 1);
  } finally {
    await monitored.close();
  }
});

test('T1 the helper uses neither session.withTransaction() nor connection.transaction()', () => {
  const code = fs.readFileSync(path.join(harness.BACKEND_ROOT, 'utils', 'transactions.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /withTransaction\s*\(/);
  assert.doesNotMatch(code, /\.transaction\s*\(/);
});

for (const [variant, makeError] of [
  ['a driver error', transientError],
  ['a non-driver error with an errorLabels array', () => nonDriverError(['TransientTransactionError'])]
]) {
  test(`T2 a transient error on attempt 1 (${variant}) is retried, leaving one business record and one audit entry`, async t => {
    const record = wrapSessions(t);
    const { delays, options } = injectedWaits([0.5]);
    const label = `T2 ${variant}`;
    const attempts = [];

    const id = await tx.runTransaction(async (session, { attempt }) => {
      attempts.push(attempt);
      assertDriverSettings(session);
      const expense = await createExpense(session, label);
      await auditExpense(session, expense);
      if (attempt === 1) throw makeError();
      return String(expense._id);
    }, options);

    assert.deepEqual(attempts, [1, 2]);
    assert.deepEqual(delays, [38]);
    assert.equal(record.commitCalls, 1);
    assertRequestedSettings(record, 2);
    assert.equal(await expenses(label), 1);
    assert.equal(await audits(label), 1);
    assert.equal(await m.AuditLog.countDocuments({ entityId: id }), 1);
    assert.equal(record.sessions[0].hasEnded, true);
  });
}

test('T3 a real write conflict is retried with freshly loaded documents, leaving one audit entry', async t => {
  const supplier = await fx.seedSupplier({ debtBalance: 100 });
  const record = wrapSessions(t);
  const { options } = injectedWaits([0]);
  const loaded = [];
  const conflicts = [];

  await tx.runTransaction(async (session, { attempt }) => {
    const current = await m.Supplier.findById(supplier._id).session(session); // starts the snapshot
    loaded.push(current.debtBalance);
    if (attempt === 1) {
      // An outside write, after the snapshot and before the transaction writes the same document.
      await m.Supplier.updateOne({ _id: supplier._id }, { $inc: { debtBalance: 5 } });
    }
    current.debtBalance += 10;
    try {
      await current.save({ session });
    } catch (error) {
      conflicts.push(tx.describeError(error));
      throw error;
    }
    await audit.recordAudit({ user: users.admin, action: 'SUPPLIER_UPDATE', entity: 'Supplier', entityId: supplier._id }, { session });
  }, options);

  assert.deepEqual(conflicts.map(conflict => [conflict.code, conflict.labels]), [[112, ['TransientTransactionError']]]);
  assert.deepEqual(loaded, [100, 105]); // attempt 2 reloaded the document
  assert.equal((await m.Supplier.findById(supplier._id)).debtBalance, 115); // a stale value would give 110
  assert.equal(await m.AuditLog.countDocuments({ action: 'SUPPLIER_UPDATE', entityId: String(supplier._id) }), 1);
  assertRequestedSettings(record, 2);
});

for (const [variant, makeError] of [
  ['the unknown label alone', () => unknownResultError()],
  ['both labels', () => unknownResultError(['TransientTransactionError'])],
  ['a non-driver error with an errorLabels array', () => nonDriverError(['UnknownTransactionCommitResult'])]
]) {
  test(`T4 an unknown commit result (${variant}) retries only the commit: work runs once, two commit calls, one audit entry`, async t => {
    const record = wrapSessions(t, {
      script: async (call, commit) => {
        await commit(); // the commit reaches the server ...
        if (call === 1) throw makeError(); // ... but its result is lost
      }
    });
    const { delays, options } = injectedWaits([0.5]);
    const label = `T4 ${variant}`;
    let runs = 0;

    const id = await tx.runTransaction(async session => {
      runs += 1;
      const expense = await createExpense(session, label);
      await auditExpense(session, expense);
      return String(expense._id);
    }, options);

    assert.equal(runs, 1);
    assert.equal(record.commitCalls, 2);
    assert.deepEqual(delays, [38]);
    assert.equal(await expenses(label), 1);
    assert.equal(await audits(label), 1);
    assert.equal(await m.AuditLog.countDocuments({ entityId: id }), 1);
  });
}

test('T5 a business error is not retried, and nothing is written', async t => {
  const record = wrapSessions(t);
  const { delays, options } = injectedWaits();
  const refusal = Object.assign(new Error('Stage 0 business refusal.'), { statusCode: 409 });
  let runs = 0;

  await assert.rejects(tx.runTransaction(async session => {
    runs += 1;
    await auditExpense(session, await createExpense(session, 'T5'));
    throw refusal;
  }, options), error => error === refusal);

  assert.equal(runs, 1);
  assert.equal(record.commitCalls, 0);
  assert.deepEqual(delays, []);
  assert.equal(await expenses('T5'), 0);
  assert.equal(await audits('T5'), 0);
  assert.equal(record.sessions[0].hasEnded, true);
});

// The exact limits in §12.4, counted at the helper boundary (U = unknown commit result,
// T = TransientTransactionError). The delays follow from the injected random values: the ceiling
// for wait n is min(250, 25 × 2^n), and the delay is 25 + r × (ceiling − 25), r clamped to 0–1.
const T6_CASES = [
  { id: 'a', title: 'work throws TransientTransactionError every time: 3 runs, 2 waits, nothing written', workFails: true,
    commits: [], runs: 3, random: [-1, 5], delays: [25, 100], code: 'TRANSACTION_RETRY_EXHAUSTED', last: TRANSIENT_DESCRIPTION },
  { id: 'b', title: 'every commit reports an unknown result: 1 run, 3 commit calls, 2 waits, no second attempt',
    commits: ['U', 'U', 'U'], runs: 1, random: [0.5], delays: [38, 63], code: 'TRANSACTION_COMMIT_UNKNOWN', last: UNKNOWN_DESCRIPTION },
  { id: 'c', title: 'every commit fails with TransientTransactionError: 3 runs with one commit call each, 2 waits',
    commits: ['T', 'T', 'T'], runs: 3, random: [0], delays: [25, 25], code: 'TRANSACTION_RETRY_EXHAUSTED', last: TRANSIENT_DESCRIPTION },
  { id: 'd', title: 'unknown, unknown, transient, then unknown on every later commit: 2 runs, 6 commit calls, 5 waits',
    commits: ['U', 'U', 'T', 'U', 'U', 'U'], runs: 2, random: [0.5], delays: [38, 63, 113, 138, 138],
    code: 'TRANSACTION_COMMIT_UNKNOWN', last: UNKNOWN_DESCRIPTION },
  { id: 'e', title: 'the longest sequence: 3 runs, exactly 9 commit calls and 8 waits, never a 10th commit call',
    commits: ['U', 'U', 'T', 'U', 'U', 'T', 'U', 'U', 'U'], runs: 3, random: [0.999999],
    delays: [50, 100, 200, 250, 250, 250, 250, 250], code: 'TRANSACTION_COMMIT_UNKNOWN', last: UNKNOWN_DESCRIPTION }
];

for (const c of T6_CASES) {
  test(`T6(${c.id}) ${c.title}`, async t => {
    const lines = captureLines(t);
    const record = wrapSessions(t, {
      script: async call => {
        const outcome = c.commits[call - 1];
        if (outcome === undefined) assert.fail(`commit call ${call} must not happen`);
        throw outcome === 'U' ? unknownResultError() : transientError();
      }
    });
    const { delays, options } = injectedWaits(c.random);
    const label = `T6-${c.id}`;
    let runs = 0;

    const error = await tx.runTransaction(async session => {
      runs += 1;
      await auditExpense(session, await createExpense(session, label));
      if (c.workFails) throw transientError();
    }, options).then(() => assert.fail('expected a 503'), failure => failure);

    assert.equal(runs, c.runs);
    assert.equal(record.commitCalls, c.commits.length);
    assert.deepEqual(delays, c.delays);
    for (const delay of delays) assert.ok(delay >= 25 && delay <= 250, `${delay} ms`);
    assert.ok(delays.length <= 8 && delays.reduce((sum, delay) => sum + delay, 0) <= 2000);
    assertRequestedSettings(record, c.runs);
    assert.equal(record.sessions.length, 1);
    assert.equal(record.sessions[0].hasEnded, true);

    assert.equal(error.name, 'TransactionUnavailableError');
    assert.equal(error.statusCode, 503);
    assert.equal(error.code, c.code);
    assert.equal(error.message, PUBLIC_503[c.code]);
    assert.deepEqual(lines().filter(line => line.event === 'transaction.failed'),
      [{ event: 'transaction.failed', code: c.code, error: c.last }]);

    const res = respond(error);
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, { success: false, message: PUBLIC_503[c.code] });
    assert.doesNotMatch(JSON.stringify(res.body), /TRANSACTION_|Injected|WriteConflict|ShutdownInProgress|Mongo/);

    assert.equal(await expenses(label), 0);
    assert.equal(await audits(label), 0);
  });
}

test('T6 the limits cannot be changed, and invalid options or callbacks are refused before a session is opened', async t => {
  const record = wrapSessions(t);
  const work = async () => assert.fail('the callback must not run');
  const refused = [
    ['maxAttempts raised', work, { maxAttempts: 4 }],
    ['maxAttempts lowered', work, { maxAttempts: 2 }],
    ['maxCommitAttempts raised', work, { maxCommitAttempts: 4 }],
    ['baseDelayMs changed', work, { baseDelayMs: 10 }],
    ['maxDelayMs raised', work, { maxDelayMs: 1000 }],
    ['an unknown option', work, { retries: 9 }],
    ['sleep that is not a function', work, { sleep: 5 }],
    ['random that is not a function', work, { random: 'fixed' }],
    ['options that are null', work, null],
    ['options that are not an object', work, 'options'],
    ['a callback that is not a function', 'not a callback', {}],
    ['no callback', undefined, {}]
  ];
  for (const [label, callback, options] of refused) {
    await assert.rejects(tx.runTransaction(callback, options), { name: 'TypeError' }, label);
  }
  assert.equal(record.sessions.length, 0); // every refusal came before a session was opened

  // The approved values themselves are accepted.
  const { options } = injectedWaits();
  const approved = { ...options, maxAttempts: 3, maxCommitAttempts: 3, baseDelayMs: 25, maxDelayMs: 250 };
  assert.equal(await tx.runTransaction(async () => 'accepted', approved), 'accepted');
  assert.equal(record.sessions.length, 1);
  assert.deepEqual(tx.TRANSACTION_LIMITS, { maxAttempts: 3, maxCommitAttempts: 3, baseDelayMs: 25, maxDelayMs: 250 });
  assert.ok(Object.isFrozen(tx.TRANSACTION_LIMITS));
});

test('T7 an audit write failure rolls back the business write and is not retried', async t => {
  const lines = captureLines(t);
  const record = wrapSessions(t);
  const { delays, options } = injectedWaits();
  const { db } = mongoose.connection;
  // The in-memory test database only: a temporary validator makes the server reject every
  // audit insert, then it is removed again.
  await db.command({ collMod: 'auditlogs', validator: { $expr: { $eq: [1, 0] } }, validationLevel: 'strict', validationAction: 'error' });
  let runs = 0;
  let error;
  try {
    error = await tx.runTransaction(async session => {
      runs += 1;
      await auditExpense(session, await createExpense(session, 'T7'));
    }, options).then(() => assert.fail('expected the audit write to fail'), failure => failure);
  } finally {
    await db.command({ collMod: 'auditlogs', validator: {}, validationLevel: 'strict', validationAction: 'error' });
  }

  assert.equal(error.code, 121); // DocumentValidationFailure, from the server
  assert.equal(runs, 1);
  assert.equal(record.commitCalls, 0);
  assert.deepEqual(delays, []);
  assert.equal(await expenses('T7'), 0);
  assert.equal(await audits('T7'), 0);
  const failed = lines().filter(line => line.event === 'audit.write_failed');
  assert.equal(failed.length, 1);
  assert.deepEqual([failed[0].action, failed[0].entity, failed[0].error.code], ['EXPENSE_CREATE', 'Expense', 121]);
  assert.deepEqual(Object.keys(failed[0]).sort(), ['action', 'entity', 'entityId', 'error', 'event']);
});

test('T8 recordAudit() without an active transaction session, or with an unlisted action, fails before writing', async t => {
  const create = t.mock.method(m.AuditLog, 'create'); // calls through; only counted
  const entry = {
    user: users.admin, action: 'EXPENSE_CREATE', entity: 'Expense', entityId: fx.objectId(),
    details: { title: 'Stage 0 transaction T8' }
  };
  const refused = { name: 'AuditRecordError' };

  await assert.rejects(audit.recordAudit(entry), refused);
  await assert.rejects(audit.recordAudit(entry, {}), refused);
  await assert.rejects(audit.recordAudit(entry, { session: { inTransaction: () => true, hasEnded: false } }), refused);

  const idle = await mongoose.startSession(); // a session with no transaction
  await assert.rejects(audit.recordAudit(entry, { session: idle }), refused);
  await idle.endSession();
  await assert.rejects(audit.recordAudit(entry, { session: idle }), refused); // an ended session

  const committed = await mongoose.startSession();
  try {
    committed.startTransaction();
    await createExpense(committed, 'T8 committed');
    await committed.commitTransaction();
    await assert.rejects(audit.recordAudit(entry, { session: committed }), refused); // the transaction has ended
  } finally {
    await committed.endSession();
  }

  const active = await mongoose.startSession();
  try {
    active.startTransaction();
    await assert.rejects(audit.recordAudit({ ...entry, action: 'NOT_AN_AUDIT_ACTION' }, { session: active }), refused);
    assert.equal(active.inTransaction(), true);
    await active.abortTransaction();
  } finally {
    await active.endSession();
  }

  assert.equal(create.mock.callCount(), 0);
  assert.equal(await audits('T8'), 0);
});

test('T9 inside a callback: sendEmail() throws without sending, log() writes nothing and reports the misuse, and a nested runTransaction() is refused before a second session starts', async t => {
  const lines = captureLines(t);
  const record = wrapSessions(t);
  const { options } = injectedWaits();
  const emailLogsBefore = await EmailLog.countDocuments();
  const blockedBefore = harness.getIsolationReport().blockedConnections.length;
  const insideId = fx.objectId();
  const message = { to: 'stage0.person@example.invalid', subject: 'Stage 0', html: '<p>Stage 0</p>' };
  let innerRuns = 0;

  const error = await tx.runTransaction(async session => {
    await assert.rejects(mail.sendEmail(message), { name: 'EmailInsideTransactionError' });
    await assert.doesNotReject(audit.log({ user: users.admin, action: 'EXPENSE_CREATE', entity: 'Expense', entityId: insideId }));
    await createExpense(session, 'T9');
    // Not caught: the refusal fails the outer callback, so nothing is committed.
    await tx.runTransaction(async () => { innerRuns += 1; }, options);
  }, options).then(() => assert.fail('expected the nested call to be refused'), failure => failure);

  assert.equal(error.name, 'NestedTransactionError');
  assert.equal(innerRuns, 0);
  assert.equal(record.sessions.length, 1); // the nested call started no session
  assert.equal(record.commitCalls, 0); // and nothing was committed
  assert.equal(await expenses('T9'), 0);
  assert.equal(await m.AuditLog.countDocuments({ entityId: insideId }), 0);
  assert.equal(await EmailLog.countDocuments(), emailLogsBefore);
  assert.equal(harness.getIsolationReport().blockedConnections.length, blockedBefore);
  assert.deepEqual(lines().filter(line => line.event === 'audit.log_inside_transaction'),
    [{ event: 'audit.log_inside_transaction', action: 'EXPENSE_CREATE', entity: 'Expense', entityId: insideId }]);
  assert.deepEqual(respond(error).body, GENERIC_500); // a programming error: the generic 500

  // Outside the callback the guard is off: the test-mode email result and a normal audit write.
  const outsideId = fx.objectId();
  assert.equal(tx.isInsideTransaction(), false);
  assert.equal((await mail.sendEmail(message)).skipped, true);
  await audit.log({ user: users.admin, action: 'EXPENSE_CREATE', entity: 'Expense', entityId: outsideId });
  assert.equal(await m.AuditLog.countDocuments({ entityId: outsideId }), 1);
});
