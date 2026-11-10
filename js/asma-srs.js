'use strict';
/* Asma al-Husna spaced repetition (Leitner boxes). Pure logic, no DOM, no storage.
   State: { [nameId]: { box, due, seen, miss, last } } with day numbers from srsDay().
   A name counts as "learned" from box 3. Boxes 1-2 are still being learned. */
(function(root){
  const INTERVALS = [0, 1, 2, 4, 8, 16, 32];   /* days until next review, indexed by box (1..6) */
  const LEARNED_BOX = 3, MAX_BOX = 6, DEFAULT_NEW_PER_DAY = 5;

  /* Whole local calendar days since the epoch; stable across DST and timezones. */
  function srsDay(date){
    const d = date || new Date();
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }

  function srsIsLearned(entry){ return !!entry && entry.box >= LEARNED_BOX; }

  /* One-time import of the old yes/no memorised list: they start as learned and are reviewed soon. */
  function srsMigrate(memorizedIds, today){
    const state = {};
    for(const id of (Array.isArray(memorizedIds) ? memorizedIds : [])){
      state[id] = { box: LEARNED_BOX, due: today, seen: 1, miss: 0, last: today };
    }
    return state;
  }

  /* Grade one answer. Correct: next box. Missed: two boxes back (never below 1), due again today. */
  function srsGrade(state, id, correct, today){
    const next = { ...state };
    const cur = next[id] || { box: 0, due: today, seen: 0, miss: 0, last: today };
    let box;
    if(correct) box = Math.min(MAX_BOX, Math.max(1, cur.box + 1));
    else box = Math.max(1, cur.box - 2);
    next[id] = {
      box,
      due: correct ? today + INTERVALS[box] : today,
      seen: cur.seen + 1,
      miss: cur.miss + (correct ? 0 : 1),
      last: today,
    };
    return next;
  }

  /* A name missed earlier in this session and then recalled: keep its box, review it tomorrow. */
  function srsRetryPassed(state, id, today){
    if(!state[id]) return state;
    return { ...state, [id]: { ...state[id], due: today + 1, last: today } };
  }

  /* Manual "I know this" / "forget" from the detail sheet. */
  function srsSetLearned(state, id, learned, today){
    const next = { ...state };
    if(learned) next[id] = { box: LEARNED_BOX, due: today + INTERVALS[LEARNED_BOX], seen: (next[id]?.seen || 0), miss: (next[id]?.miss || 0), last: today };
    else delete next[id];
    return next;
  }

  function srsDueIds(state, today){
    return Object.keys(state).map(Number).filter(id => state[id].box > 0 && state[id].due <= today).sort((a, b) => a - b);
  }

  /* New names are introduced in the traditional order, a few per day. */
  function srsNewIds(state, allIds, today, limit){
    const introducedToday = Object.values(state).filter(e => e.seen === 1 && e.last === today && e.box <= 1).length;
    const room = Math.max(0, (limit == null ? DEFAULT_NEW_PER_DAY : limit) - introducedToday);
    return allIds.filter(id => !state[id]).slice(0, room);
  }

  /* Today's session: due reviews (hardest boxes first, then oldest due) followed by new names. */
  function srsBuildQueue(state, allIds, today, limit){
    const due = srsDueIds(state, today).sort((a, b) => state[a].box - state[b].box || state[a].due - state[b].due || a - b);
    return { due, fresh: srsNewIds(state, allIds, today, limit) };
  }

  function srsCounts(state, allIds, today){
    const ids = Object.keys(state).map(Number);
    return {
      learned: ids.filter(id => srsIsLearned(state[id])).length,
      learning: ids.filter(id => state[id].box > 0 && !srsIsLearned(state[id])).length,
      due: srsDueIds(state, today).length,
      fresh: srsNewIds(state, allIds, today).length,
      untouched: allIds.filter(id => !state[id]).length,
    };
  }

  function srsLearnedIds(state){
    return Object.keys(state).map(Number).filter(id => srsIsLearned(state[id])).sort((a, b) => a - b);
  }

  const api = { INTERVALS, LEARNED_BOX, MAX_BOX, DEFAULT_NEW_PER_DAY, srsDay, srsIsLearned, srsMigrate, srsGrade, srsRetryPassed, srsSetLearned, srsDueIds, srsNewIds, srsBuildQueue, srsCounts, srsLearnedIds };
  Object.assign(root, api);
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
