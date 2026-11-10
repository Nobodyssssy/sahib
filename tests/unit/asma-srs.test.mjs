// Spaced-repetition rules for the 99 Names. Run: node --test tests/unit/asma-srs.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ctx = vm.createContext({ Date, Math, Object, Array, Number });
vm.runInContext(fs.readFileSync(path.join(root, 'js', 'asma-srs.js'), 'utf8'), ctx);
const S = ctx;
const ALL = Array.from({ length: 99 }, (_, i) => i + 1);
const D0 = S.srsDay(new Date(2026, 10, 10, 12));

test('day numbers are whole local days and DST-safe', () => {
  assert.equal(S.srsDay(new Date(2026, 10, 11, 0, 5)) - S.srsDay(new Date(2026, 10, 10, 23, 55)), 1);
  assert.equal(S.srsDay(new Date(2026, 2, 29, 12)) - S.srsDay(new Date(2026, 2, 28, 12)), 1);
  assert.equal(S.srsDay(new Date(2026, 9, 25, 12)) - S.srsDay(new Date(2026, 9, 24, 12)), 1);
});

test('legacy memorised names become learned and due today', () => {
  const st = S.srsMigrate([1, 5, 9], D0);
  assert.deepEqual(S.srsLearnedIds(st), [1, 5, 9]);
  assert.deepEqual(S.srsDueIds(st, D0), [1, 5, 9]);
  assert.equal(JSON.stringify(S.srsMigrate(null, D0)), "{}");
});

test('correct answers climb boxes and push the due date out', () => {
  let st = {};
  const seen = [];
  for (let i = 0; i < 6; i++) { st = S.srsGrade(st, 7, true, D0); seen.push([st[7].box, st[7].due - D0]); }
  assert.deepEqual(seen, [[1, 1], [2, 2], [3, 4], [4, 8], [5, 16], [6, 32]]);
  st = S.srsGrade(st, 7, true, D0);
  assert.equal(st[7].box, 6, 'capped at the top box');
});

test('a miss drops two boxes (not to zero), is due again today and is counted', () => {
  let st = { 3: { box: 5, due: D0 + 9, seen: 4, miss: 0, last: D0 } };
  st = S.srsGrade(st, 3, false, D0);
  assert.equal(st[3].box, 3);
  assert.equal(st[3].due, D0);
  assert.equal(st[3].miss, 1);
  st = S.srsGrade(st, 3, false, D0);
  assert.equal(st[3].box, 1);
  st = S.srsGrade(st, 3, false, D0);
  assert.equal(st[3].box, 1, 'never below box 1');
});

test('learned starts at box 3', () => {
  let st = {};
  st = S.srsGrade(st, 2, true, D0); assert.equal(S.srsIsLearned(st[2]), false);
  st = S.srsGrade(st, 2, true, D0); assert.equal(S.srsIsLearned(st[2]), false);
  st = S.srsGrade(st, 2, true, D0); assert.equal(S.srsIsLearned(st[2]), true);
});

test('new names arrive in order, five per day, and do not refill after being introduced', () => {
  let st = {};
  assert.deepEqual(S.srsNewIds(st, ALL, D0), [1, 2, 3, 4, 5]);
  for (const id of [1, 2, 3, 4, 5]) st = S.srsGrade(st, id, true, D0);
  assert.deepEqual(S.srsNewIds(st, ALL, D0), [], 'daily limit reached');
  assert.deepEqual(S.srsNewIds(st, ALL, D0 + 1), [6, 7, 8, 9, 10], 'next day continues in order');
  assert.deepEqual(S.srsNewIds(st, ALL, D0, 8), [6, 7, 8], 'custom limit');
});

test('queue: due first (weakest box, then oldest), new names after', () => {
  const st = {
    10: { box: 4, due: D0 - 1, seen: 3, miss: 0, last: D0 - 9 },
    11: { box: 1, due: D0, seen: 2, miss: 1, last: D0 - 1 },
    12: { box: 1, due: D0 - 3, seen: 2, miss: 1, last: D0 - 4 },
    13: { box: 5, due: D0 + 5, seen: 6, miss: 0, last: D0 - 2 },
  };
  const q = S.srsBuildQueue(st, ALL, D0);
  assert.deepEqual(q.due, [12, 11, 10]);
  assert.equal(q.fresh.length, 5);
  assert.ok(!q.due.includes(13), 'not due yet');
});

test('manual learned/forget and counts', () => {
  let st = S.srsSetLearned({}, 4, true, D0);
  assert.equal(S.srsIsLearned(st[4]), true);
  assert.equal(st[4].due, D0 + 4);
  st = S.srsSetLearned(st, 4, false, D0);
  assert.equal(st[4], undefined);
  st = S.srsGrade(S.srsMigrate([1, 2], D0), 3, true, D0);
  const c = S.srsCounts(st, ALL, D0);
  assert.deepEqual([c.learned, c.learning, c.due, c.untouched], [2, 1, 2, 96]);
});

test('a missed name recalled on the in-session retry keeps its box and moves to tomorrow', () => {
  let st = S.srsGrade(S.srsMigrate([5], D0), 5, false, D0);
  assert.equal(st[5].box, 1);
  assert.deepEqual(S.srsDueIds(st, D0), [5]);
  st = S.srsRetryPassed(st, 5, D0);
  assert.equal(st[5].box, 1);
  assert.deepEqual(S.srsDueIds(st, D0), []);
  assert.deepEqual(S.srsDueIds(st, D0 + 1), [5]);
  assert.equal(S.srsRetryPassed({}, 9, D0)[9], undefined);
});

test('grading does not mutate the previous state', () => {
  const before = { 1: { box: 2, due: D0, seen: 1, miss: 0, last: D0 } };
  const snap = JSON.stringify(before);
  S.srsGrade(before, 1, true, D0);
  assert.equal(JSON.stringify(before), snap);
});
