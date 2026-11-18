// SM-2 spaced repetition scheduler (pure functions, no DOM).
// Each card carries a `sched` object: { ease, interval (days), reps, due (ms), last (ms|null), lapses }.
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_EASE = 1.3;

// UI grades -> SM-2 quality (0-5). Quality < 3 counts as a failed recall.
const GRADES = { again: 1, hard: 3, good: 4, easy: 5 };

function newSchedule(now) {
  return { ease: 2.5, interval: 0, reps: 0, due: now || Date.now(), last: null, lapses: 0 };
}

function schedOf(card) {
  return card.sched || newSchedule(card.created || 0);
}

// Returns a NEW schedule after grading a review; does not mutate input.
function review(sched, grade, now) {
  now = now || Date.now();
  const q = typeof grade === 'number' ? grade : GRADES[grade];
  if (q === undefined || q < 0 || q > 5) throw new Error('Unknown grade: ' + grade);
  const s = Object.assign({}, sched);

  // Ease update from the original SM-2 formula, clamped at MIN_EASE.
  s.ease = Math.max(MIN_EASE, s.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  if (q < 3) {
    s.reps = 0;
    s.interval = 1;
    s.lapses = (s.lapses || 0) + 1;
  } else {
    s.reps += 1;
    if (s.reps === 1) s.interval = 1;
    else if (s.reps === 2) s.interval = 6;
    else s.interval = Math.round(s.interval * s.ease);
    if (q === 3) s.interval = Math.max(1, Math.round(s.interval * 0.8)); // Hard: shorter step
    if (q === 5 && s.reps > 1) s.interval = Math.round(s.interval * 1.3); // Easy: bonus
  }
  // "Again" is re-shown in 10 minutes within the same session; others land on whole days.
  s.due = q < 3 ? now + 10 * 60 * 1000 : now + s.interval * DAY_MS;
  s.last = now;
  return s;
}

// Status: 'new' (never reviewed), 'due' (reviewed, due now), 'learned' (reviewed, not yet due).
function cardStatus(card, now) {
  const s = schedOf(card);
  if (s.last === null) return 'new';
  return s.due <= (now || Date.now()) ? 'due' : 'learned';
}

function countsFor(cards, now) {
  const c = { new: 0, due: 0, learned: 0 };
  for (const card of cards) c[cardStatus(card, now)]++;
  return c;
}

// Study queue: due reviews first (most overdue first), then up to `newLimit` new cards in creation order.
function dueQueue(cards, now, newLimit) {
  now = now || Date.now();
  if (newLimit === undefined) newLimit = 20;
  const due = cards.filter(c => cardStatus(c, now) === 'due')
    .sort((a, b) => schedOf(a).due - schedOf(b).due);
  const fresh = cards.filter(c => cardStatus(c, now) === 'new')
    .sort((a, b) => (a.created || 0) - (b.created || 0))
    .slice(0, newLimit);
  return due.concat(fresh);
}

// Human-readable interval preview for grade buttons, e.g. "10m", "1d", "6d", "3mo".
function formatInterval(ms) {
  const min = ms / 60000;
  if (min < 60) return Math.max(1, Math.round(min)) + 'm';
  const days = ms / DAY_MS;
  if (min < 23.5 * 60) return Math.round(min / 60) + 'h';
  if (days < 30) return Math.round(days) + 'd';
  if (days < 365) return Math.round(days / 30) + 'mo';
  return (days / 365).toFixed(1) + 'y';
}

if (typeof module !== 'undefined') {
  module.exports = { DAY_MS, GRADES, newSchedule, schedOf, review, cardStatus, countsFor, dueQueue, formatInterval };
}
