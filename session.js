// Review session: a queue of {deckId, cardId} items worked through in order.
// Cards graded "again" are re-queued at the end so they come back in the same session.
const MAX_REQUEUE = 3; // stop re-showing a card after this many "again"s in one session

function createSession(items, now) {
  return {
    queue: items.map(it => ({ deckId: it.deckId, cardId: it.cardId, tries: 0 })),
    index: 0,
    revealed: false,
    results: { again: 0, hard: 0, good: 0, easy: 0 },
    seen: {},          // cardId -> true, unique cards reviewed
    startedAt: now || Date.now(),
    finishedAt: null,
  };
}

function sessionCurrent(s) {
  return s.index < s.queue.length ? s.queue[s.index] : null;
}

function sessionDone(s) {
  return s.index >= s.queue.length;
}

function sessionReveal(s) {
  if (!sessionDone(s)) s.revealed = true;
}

// Record a grade for the current item and advance. Returns the graded item.
function sessionGrade(s, grade, now) {
  const item = sessionCurrent(s);
  if (!item) throw new Error('Session is finished');
  if (!(grade in s.results)) throw new Error('Unknown grade: ' + grade);
  s.results[grade]++;
  s.seen[item.cardId] = true;
  if (grade === 'again' && item.tries < MAX_REQUEUE) {
    s.queue.push({ deckId: item.deckId, cardId: item.cardId, tries: item.tries + 1 });
  }
  s.index++;
  s.revealed = false;
  if (sessionDone(s)) s.finishedAt = now || Date.now();
  return item;
}

function sessionSummary(s) {
  const r = s.results;
  const total = r.again + r.hard + r.good + r.easy;
  const end = s.finishedAt || Date.now();
  return {
    total,
    unique: Object.keys(s.seen).length,
    results: Object.assign({}, r),
    correctPct: total ? Math.round(((total - r.again) / total) * 100) : 0,
    seconds: Math.max(0, Math.round((end - s.startedAt) / 1000)),
    remaining: s.queue.length - s.index,
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createSession, sessionCurrent, sessionDone, sessionReveal, sessionGrade, sessionSummary, MAX_REQUEUE };
}
