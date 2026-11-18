// UI layer
// localStorage can throw (private mode, sandboxed pages); fall back to in-memory only.
const storage = (() => { try { return window.localStorage; } catch (e) { return null; } })();
let state = loadState(storage);
let currentDeckId = null;

const $ = sel => document.querySelector(sel);

function persist() { if (storage) saveState(storage, state); }

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
    const c = deckCounts(deck);
    count.textContent = deck.cards.length + (deck.cards.length === 1 ? ' card' : ' cards') +
      ' · ' + c.new + ' new · ' + c.due + ' due';
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

let editingCardId = null;

function countsBadges(c) {
  const wrap = document.createDocumentFragment();
  for (const [key, label] of [['new', 'New'], ['due', 'Due'], ['learned', 'Learned']]) {
    const b = document.createElement('span');
    b.className = 'badge ' + key;
    b.textContent = label + ': ' + c[key];
    wrap.append(b);
  }
  return wrap;
}

function dueText(card) {
  const st = cardStatus(card);
  if (st === 'new') return 'new';
  if (st === 'due') return 'due now';
  return 'due in ' + formatInterval(schedOf(card).due - Date.now());
}

function renderDeck(deck) {
  $('#deck-title').textContent = deck.name;
  const countsEl = $('#deck-counts');
  countsEl.innerHTML = '';
  countsEl.append(countsBadges(deckCounts(deck)));
  const list = $('#card-list');
  list.innerHTML = '';
  if (!deck.cards.length) {
    list.append(emptyItem('No cards yet. Add one above.'));
    return;
  }
  for (const card of deck.cards) {
    const li = document.createElement('li');
    li.className = 'card-item';
    if (card.id === editingCardId) {
      li.classList.add('editing');
      const f = document.createElement('textarea'); f.value = card.front; f.rows = 2;
      const b = document.createElement('textarea'); b.value = card.back; b.rows = 2;
      const actions = document.createElement('div'); actions.className = 'actions';
      const save = document.createElement('button'); save.textContent = 'Save';
      save.onclick = () => {
        try {
          updateCard(state, deck.id, card.id, f.value, b.value);
          editingCardId = null; persist(); render();
        } catch (err) { showError(err.message); }
      };
      const cancel = document.createElement('button'); cancel.className = 'secondary'; cancel.textContent = 'Cancel';
      cancel.onclick = () => { editingCardId = null; render(); };
      actions.append(save, cancel);
      li.append(f, b, actions);
      list.append(li);
      setTimeout(() => f.focus(), 0);
      continue;
    }
    const f = document.createElement('div'); f.className = 'front'; f.textContent = card.front;
    const b = document.createElement('div'); b.className = 'back'; b.textContent = card.back;
    const meta = document.createElement('div'); meta.className = 'meta';
    const status = document.createElement('span');
    status.className = 'badge ' + cardStatus(card);
    status.textContent = dueText(card);
    const edit = document.createElement('button'); edit.className = 'link'; edit.textContent = 'Edit';
    edit.onclick = () => { editingCardId = card.id; render(); };
    const del = document.createElement('button'); del.className = 'link danger-text'; del.textContent = 'Delete';
    del.onclick = () => {
      if (confirm('Delete this card?')) { deleteCard(state, deck.id, card.id); persist(); render(); }
    };
    meta.append(status, edit, del);
    li.append(f, b, meta);
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

$('#back-to-decks').addEventListener('click', () => { currentDeckId = null; editingCardId = null; render(); });

render();
