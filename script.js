// UI layer
let state = loadState(window.localStorage);
let currentDeckId = null;

const $ = sel => document.querySelector(sel);

function persist() { saveState(window.localStorage, state); }

function showError(msg) {
  const el = $('#error');
  el.textContent = msg;
  el.hidden = !msg;
}

function render() {
  showError('');
  const deck = currentDeckId ? getDeck(state, currentDeckId) : null;
  $('#view-decks').hidden = !!deck;
  $('#view-deck').hidden = !deck;
  if (deck) renderDeck(deck); else renderDecks();
}

function emptyItem(text) {
  const li = document.createElement('li');
  li.className = 'empty';
  li.textContent = text;
  return li;
}

function renderDecks() {
  const list = $('#deck-list');
  list.innerHTML = '';
  if (!state.decks.length) {
    list.append(emptyItem('No decks yet. Create one above.'));
    return;
  }
  for (const deck of state.decks) {
    const li = document.createElement('li');
    li.className = 'deck-item';
    const open = document.createElement('button');
    open.className = 'deck-open';
    const name = document.createElement('strong');
    name.textContent = deck.name;
    const count = document.createElement('span');
    count.textContent = deck.cards.length + (deck.cards.length === 1 ? ' card' : ' cards');
    open.append(name, count);
    open.onclick = () => { currentDeckId = deck.id; render(); };
    const del = document.createElement('button');
    del.className = 'danger';
    del.textContent = 'Delete';
    del.onclick = () => {
      if (confirm('Delete deck "' + deck.name + '" and its ' + deck.cards.length + ' cards?')) {
        deleteDeck(state, deck.id); persist(); render();
      }
    };
    li.append(open, del);
    list.append(li);
  }
}

function renderDeck(deck) {
  $('#deck-title').textContent = deck.name;
  const list = $('#card-list');
  list.innerHTML = '';
  if (!deck.cards.length) {
    list.append(emptyItem('No cards yet. Add one above.'));
    return;
  }
  for (const card of deck.cards) {
    const li = document.createElement('li');
    li.className = 'card-item';
    const f = document.createElement('div'); f.className = 'front'; f.textContent = card.front;
    const b = document.createElement('div'); b.className = 'back'; b.textContent = card.back;
    li.append(f, b);
    list.append(li);
  }
}

$('#new-deck-form').addEventListener('submit', e => {
  e.preventDefault();
  try {
    createDeck(state, $('#new-deck-name').value);
    $('#new-deck-name').value = '';
    persist(); render();
  } catch (err) { showError(err.message); }
});

$('#new-card-form').addEventListener('submit', e => {
  e.preventDefault();
  try {
    addCard(state, currentDeckId, $('#card-front').value, $('#card-back').value);
    $('#card-front').value = ''; $('#card-back').value = '';
    persist(); render();
    $('#card-front').focus();
  } catch (err) { showError(err.message); }
});

$('#back-to-decks').addEventListener('click', () => { currentDeckId = null; render(); });

render();
