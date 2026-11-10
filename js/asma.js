'use strict';

/* ═══════════════════════════════════════════════════════════
   Asma al-Husna — helpers
   • Search by any field
   • Memorized tracking (IndexedDB via store.meta)
   • Shuffled order for flashcards
   ═══════════════════════════════════════════════════════════ */

/* ── Get a name by ID ── */
function getAsmaById(id){
  return ASMA_NAMES.find(n => n.id === id) || null;
}

/* ── Search names ── */
function searchAsma(query){
  const q = (query || '').trim();
  if(!q) return ASMA_NAMES;

  const nqAr = (typeof normalizeAr === 'function') ? normalizeAr(q) : q.toLowerCase();
  const nqEn = (typeof normalizeEn === 'function') ? normalizeEn(q) : q.toLowerCase();

  return ASMA_NAMES.filter(n => {
    const hayAr = [
      n.ar,
      n.transliteration || '',
      n.tafsirAr || '',
    ].join(' ');
    const hayEn = [
      n.transliteration || '',
      n.meaningEn || '',
      n.tafsirEn || '',
    ].join(' ');

    const normHayAr = (typeof normalizeAr === 'function') ? normalizeAr(hayAr) : hayAr.toLowerCase();
    const normHayEn = (typeof normalizeEn === 'function') ? normalizeEn(hayEn) : hayEn.toLowerCase();

    return (nqAr && normHayAr.includes(nqAr)) || (nqEn && normHayEn.includes(nqEn));
  });
}

/* ═══════════════════════════════════════════════════════════
   Memorized tracking
   Stored as a Set in memory + persisted to IndexedDB meta
   ═══════════════════════════════════════════════════════════ */

let _memorizedSet = null;
let _asmaSrs = null;

/* "Memorised" now means "learned" in the spaced-repetition state (box 3 or higher). The old
   asma-memorized list is kept in sync so older code and backups keep working. */
async function loadMemorized(){
  if(_memorizedSet) return _memorizedSet;
  const [saved, legacy] = await Promise.all([store.getMeta('asma-srs'), store.getMeta('asma-memorized')]);
  _asmaSrs = (saved && typeof saved === 'object' && !Array.isArray(saved)) ? saved : srsMigrate(legacy, srsDay());
  _memorizedSet = new Set(srsLearnedIds(_asmaSrs));
  if(!saved) await _persistAsmaSrs();
  return _memorizedSet;
}

async function _persistAsmaSrs(){
  _memorizedSet = new Set(srsLearnedIds(_asmaSrs));
  await Promise.all([store.setMeta('asma-srs', _asmaSrs), store.setMeta('asma-memorized', [..._memorizedSet])]);
}

function getAsmaSrs(){ return _asmaSrs || {}; }

/* Record one flashcard answer. */
async function gradeAsma(id, correct){
  if(!_memorizedSet) await loadMemorized();
  _asmaSrs = srsGrade(_asmaSrs, id, !!correct, srsDay());
  await _persistAsmaSrs();
  return srsIsLearned(_asmaSrs[id]);
}

async function retryPassedAsma(id){
  if(!_memorizedSet) await loadMemorized();
  _asmaSrs = srsRetryPassed(_asmaSrs, id, srsDay());
  await _persistAsmaSrs();
}

function asmaSrsCounts(){
  return srsCounts(getAsmaSrs(), ASMA_NAMES.map(n => n.id), srsDay());
}

function isMemorized(id){
  return _memorizedSet ? _memorizedSet.has(id) : false;
}

async function toggleMemorized(id){
  if(!_memorizedSet) await loadMemorized();
  _asmaSrs = srsSetLearned(_asmaSrs, id, !_memorizedSet.has(id), srsDay());
  await _persistAsmaSrs();
  return _memorizedSet.has(id);
}

function getMemorizedCount(){
  return _memorizedSet ? _memorizedSet.size : 0;
}

/* ── Filter helpers ── */
function filterMemorized(names){
  return names.filter(n => isMemorized(n.id));
}

function filterNotMemorized(names){
  return names.filter(n => !isMemorized(n.id));
}

/* ═══════════════════════════════════════════════════════════
   Flashcards — shuffled order
   ═══════════════════════════════════════════════════════════ */

function shuffleArray(arr){
  const a = [...arr];
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Build a deck for the flashcard mode */
function buildFlashcardDeck(mode){
  /* mode: 'due' | 'all' | 'not-memorized' | 'memorized' */
  if(mode === 'due'){
    const q = srsBuildQueue(getAsmaSrs(), ASMA_NAMES.map(n => n.id), srsDay());
    return [...shuffleArray(q.due), ...q.fresh].map(id => getAsmaById(id)).filter(Boolean);
  }
  let pool = ASMA_NAMES;
  if(mode === 'not-memorized') pool = filterNotMemorized(ASMA_NAMES);
  if(mode === 'memorized')     pool = filterMemorized(ASMA_NAMES);
  return shuffleArray(pool);
}