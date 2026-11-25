'use strict';
// utils/transactions.js – bounded MongoDB transactions (ADR-0001 §12.4: D1, D2, D11, O-8)
//
// runTransaction(work, options) runs work(session, { attempt }) in a transaction and commits it:
//  * at most 3 attempts (executions of work) and at most 3 commit calls in each attempt, so at
//    most 9 commit calls per runTransaction() call;
//  * an unknown commit result re-sends only the commit and never runs work again; when an error
//    carries both labels, the unknown commit result wins;
//  * a TransientTransactionError starts the whole transaction again while attempts remain;
//  * every other error, including every business refusal, propagates unchanged;
//  * before every retry it waits through the injected sleep: exponential backoff with jitter
//    from the injected random, every delay 25-250 ms, at most 8 waits;
//  * when retries run out it throws a 503 error with a generic message; its internal code
//    reaches the server log only.
// Every attempt starts its transaction with snapshot read concern, majority write concern and
// primary read preference. session.withTransaction() and Mongoose's connection.transaction()
// are not used: they retry for up to 120 seconds with no attempt limit.
//
// This module also holds the inside-a-transaction guard (D11) and the helpers that every safe
// log line uses (§12.5): describeError() keeps only an error's name, code, codeName and
// allow-listed error labels, and emitSafeLine() writes one JSON line and never throws.

const { AsyncLocalStorage } = require('node:async_hooks');
const mongoose = require('mongoose');

const TRANSACTION_LIMITS = Object.freeze({
  maxAttempts: 3,
  maxCommitAttempts: 3,
  baseDelayMs: 25,
  maxDelayMs: 250
});

// A fresh object for every attempt, so no options object is shared between transactions.
const transactionOptions = () => ({
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
  readPreference: 'primary'
});

// The error labels MongoDB Node.js driver 6.20.0 defines (MongoErrorLabel in lib/error.js),
// written out here rather than read from the driver. Only these appear in a safe log line; any
// other label is left out. A driver upgrade re-checks this list.
const SAFE_ERROR_LABELS = Object.freeze([
  'RetryableWriteError',
  'TransientTransactionError',
  'UnknownTransactionCommitResult',
  'ResumableChangeStreamError',
  'HandshakeError',
  'ResetPool',
  'PoolRequstedRetry', // the driver's spelling
  'InterruptInUseConnections',
  'NoWritesPerformed'
]);

const TRANSIENT_TRANSACTION_ERROR = 'TransientTransactionError';
const UNKNOWN_TRANSACTION_COMMIT_RESULT = 'UnknownTransactionCommitResult';

// Internal codes: server logs only, never in a response (§12.5, §12.7).
const TRANSACTION_RETRY_EXHAUSTED = 'TRANSACTION_RETRY_EXHAUSTED';
const TRANSACTION_COMMIT_UNKNOWN = 'TRANSACTION_COMMIT_UNKNOWN';
const PUBLIC_MESSAGES = Object.freeze({
  [TRANSACTION_RETRY_EXHAUSTED]: 'The system is busy. Please try again.',
  [TRANSACTION_COMMIT_UNKNOWN]: 'This change could not be confirmed. Check before trying again.'
});

const TRANSACTION_FAILED_EVENT = 'transaction.failed';

// ── Safe log lines (§12.5) ───────────────────────────────────────────────────
const SAFE_TOKEN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const safeToken = value => (typeof value === 'string' && SAFE_TOKEN.test(value) ? value : undefined);
const safeCode = value =>
  (Number.isInteger(value) && value >= 0 && value <= 999999 ? value : safeToken(value));

const hasErrorLabel = (error, label) => {
  try {
    if (error !== null && typeof error === 'object' && typeof error.hasErrorLabel === 'function') {
      return error.hasErrorLabel(label) === true;
    }
    return Array.isArray(error?.errorLabels) && error.errorLabels.includes(label);
  } catch {
    return false;
  }
};

// The only error fields a safe log line contains. Never the message or the stack (database
// messages can repeat stored values, such as a duplicate email address), stored values or the
// server's response document.
const describeError = error => {
  const description = {};
  try {
    const name = safeToken(error?.name);
    if (name !== undefined) description.name = name;
    const code = safeCode(error?.code);
    if (code !== undefined) description.code = code;
    const codeName = safeToken(error?.codeName);
    if (codeName !== undefined) description.codeName = codeName;
    const labels = SAFE_ERROR_LABELS.filter(label => hasErrorLabel(error, label));
    if (labels.length > 0) description.labels = labels;
  } catch {
    // An error whose properties cannot be read is described by what could be read.
  }
  return description;
};

// Writes one JSON line to the server log. Callers pass only documented safe fields.
// Never throws.
const emitSafeLine = line => {
  try {
    console.error(JSON.stringify(line));
  } catch {
    // Logging must never interrupt the caller.
  }
};

// ── Inside-a-transaction guard (D11, MR-8) ───────────────────────────────────
// runTransaction() runs work() in this context. sendEmail() refuses to run inside it, and log()
// writes nothing inside it. Only runTransaction() callbacks are visible: sessions started
// elsewhere are not, and neither is code that loses its async context (§12.17).
const transactionContext = new AsyncLocalStorage();
const INSIDE_TRANSACTION = Object.freeze({ insideTransaction: true });
const isInsideTransaction = () => transactionContext.getStore() === INSIDE_TRANSACTION;

// ── Errors ───────────────────────────────────────────────────────────────────
// Retries ran out, or the commit result stayed unknown: 503 with the approved public message.
// The internal code is in `code` for the server log; errorHandler.js copies only EMAIL_ and
// OFFLINE_ codes into a response. No cause is attached, so no driver message travels with it.
class TransactionUnavailableError extends Error {
  constructor(code) {
    super(PUBLIC_MESSAGES[code]);
    this.name = 'TransactionUnavailableError';
    this.statusCode = 503;
    this.code = code;
  }
}

// ── Options ──────────────────────────────────────────────────────────────────
const OPTION_NAMES = new Set([...Object.keys(TRANSACTION_LIMITS), 'sleep', 'random']);
const defaultSleep = ms => new Promise(resolve => { setTimeout(resolve, ms); });

// The limits are accepted only at their approved values, so no caller can raise them (D1).
const readOptions = options => {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('runTransaction() options must be an object.');
  }
  for (const name of Object.keys(options)) {
    if (!OPTION_NAMES.has(name)) throw new TypeError(`runTransaction() has no option "${name}".`);
  }
  for (const [name, approved] of Object.entries(TRANSACTION_LIMITS)) {
    if (options[name] !== undefined && options[name] !== approved) {
      throw new TypeError(`runTransaction() accepts ${name} only as ${approved}.`);
    }
  }
  const { sleep = defaultSleep, random = Math.random } = options;
  if (typeof sleep !== 'function' || typeof random !== 'function') {
    throw new TypeError('runTransaction() sleep and random must be functions.');
  }
  return { sleep, random };
};

// Wait number n (1-8) of one runTransaction() call: the ceiling doubles from 50 ms up to 250 ms
// (50, 100, 200, 250, ...) and the delay is drawn between 25 ms and that ceiling. Every delay is
// 25-250 ms, so 8 waits stay within 2 s (with these ceilings, at most 1.6 s).
const backoffDelay = (waitNumber, random) => {
  const { baseDelayMs, maxDelayMs } = TRANSACTION_LIMITS;
  const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** waitNumber);
  const drawn = Number(random());
  const fraction = Number.isFinite(drawn) ? Math.min(1, Math.max(0, drawn)) : 0;
  const delay = Math.round(baseDelayMs + fraction * (ceiling - baseDelayMs));
  return Math.min(maxDelayMs, Math.max(baseDelayMs, delay));
};

// ── Session clean-up ─────────────────────────────────────────────────────────
// Aborts only while the driver reports an active transaction: never after a commit call, which
// the driver forbids and which may already have applied. Abort errors are ignored, because the
// server may already have aborted the transaction (§12.4, step 3).
const abortQuietly = async session => {
  try {
    if (session.inTransaction()) await session.abortTransaction();
  } catch {
    // Ignored.
  }
};

const endQuietly = async session => {
  try {
    await session.endSession();
  } catch {
    // Ignored: ending the session never changes the outcome.
  }
};

// ── runTransaction ───────────────────────────────────────────────────────────
const runTransaction = async (work, options = {}) => {
  if (typeof work !== 'function') throw new TypeError('runTransaction() needs a callback.');
  const { sleep, random } = readOptions(options);
  if (isInsideTransaction()) {
    // A nested call would commit on its own, and a retry of the outer callback would repeat it.
    // Refused before any session starts; it has no status, so a response gets the generic 500.
    const error = new Error('runTransaction() cannot run inside a runTransaction() callback.');
    error.name = 'NestedTransactionError';
    throw error;
  }

  const session = await mongoose.startSession();
  let waits = 0;
  const pause = async () => {
    waits += 1;
    await sleep(backoffDelay(waits, random));
  };
  const unavailable = (code, lastError) => {
    emitSafeLine({ event: TRANSACTION_FAILED_EVENT, code, error: describeError(lastError) });
    return new TransactionUnavailableError(code);
  };

  try {
    for (let attempt = 1; attempt <= TRANSACTION_LIMITS.maxAttempts; attempt += 1) {
      if (attempt > 1) await pause();
      if (session.inTransaction()) await abortQuietly(session);
      session.startTransaction(transactionOptions());

      let result;
      try {
        result = await transactionContext.run(INSIDE_TRANSACTION, () => work(session, { attempt }));
      } catch (error) {
        await abortQuietly(session);
        if (!hasErrorLabel(error, TRANSIENT_TRANSACTION_ERROR)) throw error;
        if (attempt < TRANSACTION_LIMITS.maxAttempts) continue;
        throw unavailable(TRANSACTION_RETRY_EXHAUSTED, error);
      }

      for (let commitCall = 1; ; commitCall += 1) {
        try {
          await session.commitTransaction();
          return result;
        } catch (error) {
          // Checked first: an unknown result wins over TransientTransactionError (§12.4, step 4).
          if (hasErrorLabel(error, UNKNOWN_TRANSACTION_COMMIT_RESULT)) {
            if (commitCall < TRANSACTION_LIMITS.maxCommitAttempts) {
              await pause();
              continue;
            }
            throw unavailable(TRANSACTION_COMMIT_UNKNOWN, error);
          }
          if (hasErrorLabel(error, TRANSIENT_TRANSACTION_ERROR)) {
            if (attempt < TRANSACTION_LIMITS.maxAttempts) break;
            throw unavailable(TRANSACTION_RETRY_EXHAUSTED, error);
          }
          throw error;
        }
      }
    }
    throw unavailable(TRANSACTION_RETRY_EXHAUSTED); // not reached: the last attempt returns or throws
  } finally {
    await endQuietly(session);
  }
};

module.exports = {
  SAFE_ERROR_LABELS,
  TRANSACTION_LIMITS,
  TransactionUnavailableError,
  describeError,
  emitSafeLine,
  isInsideTransaction,
  runTransaction
};
