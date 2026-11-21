// Data layer: pure functions over a plain state object, persisted to localStorage.
const STORE_KEY = 'flashcards.v1';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function emptyState() {
  return { decks: [], log: [] };
}

function createDeck(state, name) {
  name = (name || '').trim();
  if (!name) throw new Error('Deck name required');
  if (state.decks.some(d => d.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('A deck with that name already exists');
  }
  const deck = { id: uid(), name, created: Date.now(), cards: [] };
  state.decks.push(deck);
  return deck;
}

function deleteDeck(state, deckId) {
  state.decks = state.decks.filter(d => d.id !== deckId);
}

function getDeck(state, deckId) {
  return state.decks.find(d => d.id === deckId) || null;
}

function addCard(state, deckId, front, back, tags) {
  const deck = getDeck(state, deckId);
  if (!deck) throw new Error('Deck not found');
  front = (front || '').trim();
  back = (back || '').trim();
  if (!front || !back) throw new Error('Card needs a front and a back');
  const now = Date.now();
  const card = { id: uid(), front, back, created: now, sched: newSchedule(now), tags: parseTags(tags) };
  deck.cards.push(card);
  return card;
}

function getCard(state, deckId, cardId) {
  const deck = getDeck(state, deckId);
  return deck ? deck.cards.find(c => c.id === cardId) || null : null;
}

function updateCard(state, deckId, cardId, front, back) {
  const card = getCard(state, deckId, cardId);
  if (!card) throw new Error('Card not found');
  front = (front || '').trim();
  back = (back || '').trim();
  if (!front || !back) throw new Error('Card needs a front and a back');
  card.front = front;
  card.back = back;
  return card;
}

function deleteCard(state, deckId, cardId) {
  const deck = getDeck(state, deckId);
  if (deck) deck.cards = deck.cards.filter(c => c.id !== cardId);
}

// Apply an SM-2 grade to a card and store the new schedule.
function gradeCard(state, deckId, cardId, grade, now) {
  const card = getCard(state, deckId, cardId);
  if (!card) throw new Error('Card not found');
  const before = schedOf(card);
  card.sched = review(before, grade, now);
  // Review log feeds the stats view (retention, history, streak).
  if (!Array.isArray(state.log)) state.log = [];
  state.log.push({ t: card.sched.last, deckId, cardId, grade, wasNew: before.last === null, interval: card.sched.interval });
  return card;
}

// Tags: lowercase words, split on commas/whitespace, leading '#' dropped, deduped.
function parseTags(input) {
  const list = Array.isArray(input) ? input : String(input || '').split(/[\s,]+/);
  const out = [];
  for (let t of list) {
    t = String(t).trim().replace(/^#+/, '').toLowerCase().slice(0, 30);
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

function setCardTags(state, deckId, cardId, input) {
  const card = getCard(state, deckId, cardId);
  if (!card) throw new Error('Card not found');
  card.tags = parseTags(input);
  return card;
}

function allTags(state) {
  const counts = {};
  for (const d of state.decks) for (const c of d.cards) for (const t of c.tags || []) counts[t] = (counts[t] || 0) + 1;
  return counts;
}

// Search every deck. Query tokens are ANDed: "#tag" must be a card tag, other words must
// appear in the front or back (case-insensitive). Returns [{deck, card}].
function searchCards(state, query) {
  const tokens = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const tags = tokens.filter(t => t.startsWith('#') && t.length > 1).map(t => t.slice(1));
  const words = tokens.filter(t => !t.startsWith('#'));
  const hits = [];
  for (const deck of state.decks) for (const card of deck.cards) {
    const text = (card.front + '\n' + card.back).toLowerCase();
    const ctags = card.tags || [];
    if (tags.every(t => ctags.includes(t)) && words.every(w => text.includes(w))) hits.push({ deck, card });
  }
  return hits;
}

// "Study all due": due reviews from every deck, most overdue first, then new cards (shared limit).
function allDueItems(state, now, newLimit) {
  now = now || Date.now();
  if (newLimit === undefined) newLimit = 20;
  const owner = new Map();
  const cards = [];
  for (const d of state.decks) for (const c of d.cards) { owner.set(c, d.id); cards.push(c); }
  return dueQueue(cards, now, newLimit).map(c => ({ deckId: owner.get(c), cardId: c.id }));
}

function deckCounts(deck, now) {
  return countsFor(deck.cards, now);
}

function loadState(storage) {
  try {
    const raw = storage && storage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || !Array.isArray(parsed.decks)) return emptyState();
    if (!Array.isArray(parsed.log)) parsed.log = [];
    // Migrate skeleton-era cards that have no schedule yet.
    for (const d of parsed.decks) for (const c of d.cards) if (!c.sched) c.sched = newSchedule(c.created);
    return parsed;
  } catch (e) {
    return emptyState();
  }
}

function saveState(storage, state) {
  try { storage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
}

if (typeof module !== 'undefined') {
  // Node: pull scheduler functions in as globals so the code above resolves them.
  Object.assign(globalThis, require('./sm2.js'));
  module.exports = { emptyState, createDeck, deleteDeck, getDeck, addCard, getCard, updateCard, deleteCard,
    gradeCard, deckCounts, parseTags, setCardTags, allTags, searchCards, allDueItems, loadState, saveState, STORE_KEY };
}
