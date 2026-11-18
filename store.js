// Data layer: pure functions over a plain state object, persisted to localStorage.
const STORE_KEY = 'flashcards.v1';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function emptyState() {
  return { decks: [] };
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

function addCard(state, deckId, front, back) {
  const deck = getDeck(state, deckId);
  if (!deck) throw new Error('Deck not found');
  front = (front || '').trim();
  back = (back || '').trim();
  if (!front || !back) throw new Error('Card needs a front and a back');
  const card = { id: uid(), front, back, created: Date.now() };
  deck.cards.push(card);
  return card;
}

function loadState(storage) {
  try {
    const raw = storage && storage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && Array.isArray(parsed.decks) ? parsed : emptyState();
  } catch (e) {
    return emptyState();
  }
}

function saveState(storage, state) {
  try { storage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
}

if (typeof module !== 'undefined') {
  module.exports = { emptyState, createDeck, deleteDeck, getDeck, addCard, loadState, saveState, STORE_KEY };
}
