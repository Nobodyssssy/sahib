// Regression tests for the daily Adhkar reset (js/store.js). Run: node --test tests/unit/store-daily-reset.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = fs.readFileSync(path.join(root, 'js', 'store.js'), 'utf8');

function makeStore(clock, persisted = { meta: {}, counters: {} }) {
  const events = [];
  const db = {
    meta: { get: async k => persisted.meta[k], set: async (k, v) => { persisted.meta[k] = v; } },
    counters: {
      clear: async () => { await Promise.resolve(); persisted.counters = {}; },
      set: async (id, v) => { persisted.counters[`c_${id}`] = v; },
    },
  };
  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock.now])); }
    static now() { return clock.now; }
  }
  const context = vm.createContext({
    db, console, Date: FakeDate, Promise, setTimeout,
    window: { dispatchEvent: e => { events.push(e.type); return true; } },
    Event: class { constructor(type) { this.type = type; } },
    localStorage: { getItem: () => null, removeItem: () => {} },
  });
  const store = vm.runInContext(`${source}; store`, context);
  store._cache().meta = persisted.meta;
  store._cache().counters = persisted.counters;
  return { store, persisted, events };
}

const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min, 0).getTime();
const key = ms => new Date(ms).toDateString();

test('same local day keeps counters', async () => {
  const clock = { now: at(2026, 11, 10, 9) };
  const { store, persisted, events } = makeStore(clock, { meta: { lastReset: key(clock.now) }, counters: { c_1: 33 } });
  assert.equal(await store.checkDailyReset(), false);
  assert.deepEqual(persisted.counters, { c_1: 33 });
  assert.equal(events.length, 0);
});

test('a new local day resets counters once and stores the new date', async () => {
  const clock = { now: at(2026, 11, 11, 0, 1) };
  const { store, persisted, events } = makeStore(clock, { meta: { lastReset: key(at(2026, 11, 10)) }, counters: { c_1: 33, c_2: 5 } });
  assert.equal(await store.checkDailyReset(), true);
  assert.deepEqual(persisted.counters, {});
  assert.equal(persisted.meta.lastReset, key(clock.now));
  assert.deepEqual(events, ['sahib:counters-reset']);
});

test('concurrent checks reset exactly once', async () => {
  const clock = { now: at(2026, 11, 11, 7) };
  const { store, events } = makeStore(clock, { meta: { lastReset: key(at(2026, 11, 10)) }, counters: { c_1: 9 } });
  const results = await Promise.all([store.checkDailyReset(), store.checkDailyReset(), store.checkDailyReset()]);
  assert.equal(results.filter(Boolean).length, 3, 'every caller observes the in-flight reset');
  assert.equal(events.length, 1);
});

test('midnight while the app stays open: 23:59 keeps, 00:01 resets', async () => {
  const clock = { now: at(2026, 11, 10, 23, 59) };
  const { store, persisted } = makeStore(clock, { meta: { lastReset: key(clock.now) }, counters: { c_1: 4 } });
  assert.equal(await store.checkDailyReset(), false);
  clock.now = at(2026, 11, 11, 0, 1);
  assert.equal(await store.checkDailyReset(), true);
  assert.deepEqual(persisted.counters, {});
});

test('sleep/resume across several days resets once, then keeps new progress', async () => {
  const clock = { now: at(2026, 11, 10, 22) };
  const { store, persisted } = makeStore(clock, { meta: { lastReset: key(clock.now) }, counters: { c_1: 12 } });
  clock.now = at(2026, 11, 14, 8);
  assert.equal(await store.checkDailyReset(), true);
  persisted.counters.c_1 = 3; store._cache().counters = persisted.counters;
  assert.equal(await store.checkDailyReset(), false);
  assert.equal(persisted.counters.c_1, 3);
});

test('restart on the same day does not resurrect or erase progress', async () => {
  const clock = { now: at(2026, 11, 10, 18) };
  const state = { meta: { lastReset: key(clock.now) }, counters: { c_1: 7 } };
  const first = makeStore(clock, state);
  assert.equal(await first.store.checkDailyReset(), false);
  const second = makeStore(clock, state);
  assert.equal(await second.store.checkDailyReset(), false);
  assert.deepEqual(state.counters, { c_1: 7 });
});

test('a never-initialised profile resets without error and records today', async () => {
  const clock = { now: at(2026, 11, 10, 8) };
  const { store, persisted } = makeStore(clock);
  assert.equal(await store.checkDailyReset(), true);
  assert.equal(persisted.meta.lastReset, key(clock.now));
});
