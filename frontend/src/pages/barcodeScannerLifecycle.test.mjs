import assert from 'node:assert/strict';
import test from 'node:test';
import { createBarcodeScannerLifecycle } from './barcodeScannerLifecycle.mjs';

function createTimers() {
  let nextId = 0;
  const callbacks = new Map();
  return {
    setTimer(callback) {
      const id = ++nextId;
      callbacks.set(id, callback);
      return id;
    },
    clearTimer(id) {
      callbacks.delete(id);
    },
    runNext() {
      const entry = callbacks.entries().next().value;
      if (!entry) return false;
      const [id, callback] = entry;
      callbacks.delete(id);
      callback();
      return true;
    },
    get size() {
      return callbacks.size;
    }
  };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test('closing during delayed start cancels startup and clears once', async () => {
  const timers = createTimers();
  let starts = 0;
  let clears = 0;
  const scanner = {
    start: async () => { starts += 1; },
    clear: async () => { clears += 1; }
  };
  const lifecycle = createBarcodeScannerLifecycle(scanner, timers);

  lifecycle.scheduleStart('camera', {}, () => {});
  await lifecycle.close();
  assert.equal(timers.size, 0);
  assert.equal(timers.runNext(), false);
  assert.equal(starts, 0);
  assert.equal(clears, 1);
});

test('unmount during an in-progress start stops after start resolves', async () => {
  const timers = createTimers();
  let resolveStart;
  let stops = 0;
  let clears = 0;
  const scanner = {
    start: () => new Promise(resolve => { resolveStart = resolve; }),
    stop: async () => { stops += 1; },
    clear: async () => { clears += 1; }
  };
  const lifecycle = createBarcodeScannerLifecycle(scanner, timers);

  lifecycle.scheduleStart('camera', {}, () => {});
  timers.runNext();
  await flush();
  const closing = lifecycle.close();
  resolveStart();
  await closing;

  assert.equal(stops, 1);
  assert.equal(clears, 1);
});

test('repeated close and start completion clean up exactly once', async () => {
  const timers = createTimers();
  let resolveStart;
  let stops = 0;
  let clears = 0;
  const scanner = {
    start: () => new Promise(resolve => { resolveStart = resolve; }),
    stop: async () => { stops += 1; },
    clear: async () => { clears += 1; }
  };
  const lifecycle = createBarcodeScannerLifecycle(scanner, timers);

  lifecycle.scheduleStart('camera', {}, () => {});
  timers.runNext();
  await flush();
  const firstClose = lifecycle.close();
  const secondClose = lifecycle.close();
  resolveStart();
  await Promise.all([firstClose, secondClose]);

  assert.equal(stops, 1);
  assert.equal(clears, 1);
});
