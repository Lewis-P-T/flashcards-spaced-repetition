// Stats: pure functions over decks + review log (no DOM).
// Days are local calendar days; dayIndex counts days since the epoch in local time.
function dayIndex(t) {
  const d = new Date(t);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

// Reviews due per day for the next `days` days. Day 0 also holds anything overdue.
// New (never-reviewed) cards are excluded: they are not scheduled yet.
function dueForecast(cards, now, days) {
  days = days || 14;
  const today = dayIndex(now);
  const out = new Array(days).fill(0);
  for (const c of cards) {
    const s = c.sched;
    if (!s || s.last === null) continue;
    const off = Math.max(0, dayIndex(s.due) - today);
    if (off < days) out[off]++;
  }
  return out;
}

// Reviews done per day for the last `days` days, oldest first (last entry = today).
function reviewHistory(log, now, days) {
  days = days || 14;
  const today = dayIndex(now);
  const out = new Array(days).fill(0);
  for (const e of log) {
    const back = today - dayIndex(e.t);
    if (back >= 0 && back < days) out[days - 1 - back]++;
  }
  return out;
}

// Retention = share of reviews of already-learned cards not graded "again". null if none yet.
function retentionRate(log) {
  const mature = log.filter(e => !e.wasNew);
  if (!mature.length) return null;
  return Math.round(mature.filter(e => e.grade !== 'again').length / mature.length * 100);
}

// Consecutive days with at least one review, ending today (or yesterday if not studied yet today).
function dailyStreak(log, now) {
  const days = new Set(log.map(e => dayIndex(e.t)));
  let d = dayIndex(now);
  if (!days.has(d)) d--;
  let n = 0;
  while (days.has(d)) { n++; d--; }
  return n;
}

function statsSummary(state, now) {
  const cards = [].concat(...state.decks.map(d => d.cards));
  const log = state.log || [];
  return {
    cards: cards.length,
    reviews: log.length,
    today: reviewHistory(log, now, 1)[0],
    retention: retentionRate(log),
    streak: dailyStreak(log, now),
    forecast: dueForecast(cards, now, 14),
    history: reviewHistory(log, now, 14),
  };
}

if (typeof module !== 'undefined') {
  module.exports = { dayIndex, dueForecast, reviewHistory, retentionRate, dailyStreak, statsSummary };
}
