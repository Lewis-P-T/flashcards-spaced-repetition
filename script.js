// UI layer
// localStorage can throw (private mode, sandboxed pages); fall back to in-memory only.
const storage = (() => { try { return window.localStorage; } catch (e) { return null; } })();
let state = loadState(storage);
let currentDeckId = null;
let session = null;        // active review session, or null
let showSummary = false;   // summary screen after a session ends
let showStats = false;     // stats screen

const $ = sel => document.querySelector(sel);

function persist() { if (storage) saveState(storage, state); }

function showError(msg) {
  const el = $('#error');
  el.textContent = msg;
  el.hidden = !msg;
}

function render() {
  showError('');
  $('#io-msg').hidden = $('#deck-io-msg').hidden = true;
  const deck = currentDeckId ? getDeck(state, currentDeckId) : null;
  const mode = session ? 'review' : showSummary ? 'summary' : showStats ? 'stats' : deck ? 'deck' : 'decks';
  $('#view-decks').hidden = mode !== 'decks';
  $('#view-stats').hidden = mode !== 'stats';
  $('#view-deck').hidden = mode !== 'deck';
  $('#view-review').hidden = mode !== 'review';
  $('#view-summary').hidden = mode !== 'summary';
  if (mode === 'review') renderReview();
  else if (mode === 'summary') renderSummary();
  else if (mode === 'stats') renderStats();
  else if (mode === 'deck') renderDeck(deck);
  else renderDecks();
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
  const qLen = dueQueue(deck.cards).length;
  const study = $('#study-btn');
  study.textContent = qLen ? 'Study (' + qLen + ')' : 'Nothing due';
  study.disabled = !qLen;
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

// ---- Review mode ----
let lastSummary = null; // summary of the most recent session

function startSession(deckId) {
  const deck = getDeck(state, deckId);
  if (!deck) return;
  const items = dueQueue(deck.cards).map(c => ({ deckId, cardId: c.id }));
  if (!items.length) return;
  session = createSession(items);
  showSummary = false;
  render();
}

function endSession() {
  if (!session) return;
  lastSummary = sessionSummary(session);
  session = null;
  showSummary = lastSummary.total > 0;
  render();
}

function renderReview() {
  let item = sessionCurrent(session);
  while (item && !getCard(state, item.deckId, item.cardId)) { session.index++; item = sessionCurrent(session); }
  if (!item) { endSession(); return; }
  const card = getCard(state, item.deckId, item.cardId);
  const done = session.index, total = session.queue.length;
  $('#review-progress').textContent = (done + 1) + ' / ' + total + (item.tries ? '  (again)' : '');
  $('#review-bar').style.width = Math.round((done / total) * 100) + '%';
  $('#review-front').textContent = card.front;
  $('#review-back').textContent = card.back;
  $('#review-back').hidden = !session.revealed;
  $('#reveal-btn').hidden = session.revealed;
  $('#grade-row').hidden = !session.revealed;
  if (session.revealed) {
    const now = Date.now();
    for (const btn of document.querySelectorAll('.grade')) {
      const next = review(schedOf(card), btn.dataset.grade, now);
      btn.querySelector('small').textContent = formatInterval(next.due - now);
    }
  }
}

function doReveal() {
  if (!session || session.revealed) return;
  sessionReveal(session);
  renderReview();
}

function doGrade(grade) {
  if (!session || !session.revealed) return;
  const item = sessionCurrent(session);
  gradeCard(state, item.deckId, item.cardId, grade);
  sessionGrade(session, grade);
  persist();
  if (sessionDone(session)) endSession(); else renderReview();
}

function renderSummary() {
  const s = lastSummary;
  const el = $('#summary-stats');
  el.innerHTML = '';
  const mins = Math.floor(s.seconds / 60), secs = s.seconds % 60;
  const rows = [
    ['Reviews', s.total], ['Cards', s.unique], ['Correct', s.correctPct + '%'],
    ['Time', (mins ? mins + 'm ' : '') + secs + 's'],
    ['Again', s.results.again], ['Hard', s.results.hard], ['Good', s.results.good], ['Easy', s.results.easy],
  ];
  for (const [label, val] of rows) {
    const d = document.createElement('div');
    d.className = 'stat';
    const v = document.createElement('strong'); v.textContent = val;
    const l = document.createElement('span'); l.textContent = label;
    d.append(v, l);
    el.append(d);
  }
  if (s.remaining > 0) {
    const p = document.createElement('p'); p.className = 'muted full';
    p.textContent = s.remaining + ' card(s) left in the queue — session ended early.';
    el.append(p);
  }
  const deck = getDeck(state, currentDeckId);
  const more = deck ? dueQueue(deck.cards).length : 0;
  $('#summary-again').hidden = !more;
  $('#summary-again').textContent = 'Study more (' + more + ')';
}

$('#study-btn').addEventListener('click', () => startSession(currentDeckId));
$('#reveal-btn').addEventListener('click', doReveal);
$('#review-card').addEventListener('click', doReveal);
$('#review-exit').addEventListener('click', endSession);
for (const btn of document.querySelectorAll('.grade')) btn.addEventListener('click', () => doGrade(btn.dataset.grade));
$('#summary-again').addEventListener('click', () => startSession(currentDeckId));
$('#summary-done').addEventListener('click', () => { showSummary = false; render(); });

// Keyboard: Space/Enter reveal, 1-4 grade (Enter = Good once revealed), Esc ends the session.
document.addEventListener('keydown', e => {
  if (!session || e.target.matches('input, textarea')) return;
  const keys = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (!session.revealed) doReveal(); else if (e.key === 'Enter') doGrade('good');
  } else if (keys[e.key]) {
    e.preventDefault(); doGrade(keys[e.key]);
  } else if (e.key === 'Escape') {
    endSession();
  }
});

// ---- Stats ----
function drawBars(canvas, values, labels, color) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, pad = 24, top = 16;
  ctx.clearRect(0, 0, W, H);
  const css = getComputedStyle(document.body);
  const muted = css.getPropertyValue('--muted').trim() || '#888';
  const max = Math.max(1, ...values);
  const slot = (W - pad) / values.length, bw = slot * 0.7;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  values.forEach((v, i) => {
    const h = (H - pad - top) * v / max;
    const x = pad / 2 + i * slot + (slot - bw) / 2;
    ctx.fillStyle = color;
    ctx.fillRect(x, H - pad - h, bw, h);
    ctx.fillStyle = muted;
    if (v) ctx.fillText(v, x + bw / 2, H - pad - h - 4);
    ctx.fillText(labels[i], x + bw / 2, H - 8);
  });
}

function dayLabels(startOffset, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(); d.setDate(d.getDate() + startOffset + i);
    out.push(startOffset + i === 0 ? 'today' : String(d.getDate()));
  }
  return out;
}

function renderStats() {
  const st = statsSummary(state, Date.now());
  const tiles = $('#stats-tiles');
  tiles.innerHTML = '';
  for (const [label, val] of [['Cards', st.cards], ['Reviews today', st.today],
    ['Retention', st.retention === null ? '—' : st.retention + '%'], ['Streak', st.streak + (st.streak === 1 ? ' day' : ' days')]]) {
    const d = document.createElement('div'); d.className = 'stat';
    const v = document.createElement('strong'); v.textContent = val;
    const l = document.createElement('span'); l.textContent = label;
    d.append(v, l); tiles.append(d);
  }
  const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#4f6bed';
  drawBars($('#forecast-chart'), st.forecast, dayLabels(0, 14), accent);
  drawBars($('#history-chart'), st.history, dayLabels(-13, 14), '#2f9e55');
}

$('#stats-btn').addEventListener('click', () => { showStats = true; render(); });
$('#stats-back').addEventListener('click', () => { showStats = false; render(); });

// ---- Import / export ----
function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeName(name) { return name.replace(/[^\w-]+/g, '_').slice(0, 40) || 'deck'; }

function reportText(r) {
  return 'Imported ' + r.cards + ' card(s)' + (r.decks ? ' into ' + r.decks + ' new deck(s)' : '') +
    (r.skipped ? ', ' + r.skipped + ' duplicate(s) skipped' : '') + (r.invalid ? ', ' + r.invalid + ' invalid row(s) skipped' : '') + '.';
}

function flash(sel, msg) { const el = $(sel); el.textContent = msg; el.hidden = false; }

// Import into a scratch copy so a failed import never leaves half-merged data.
function runImport(input, fn, msgSel) {
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  file.text().then(text => {
    const draft = JSON.parse(JSON.stringify(state));
    const r = fn(draft, text, file);
    state = draft; persist(); render(); flash(msgSel, reportText(r));
  }).catch(err => { render(); showError('Import failed: ' + err.message); });
}

$('#export-all').addEventListener('click', () => download('flashcards.json', exportJSON(state.decks), 'application/json'));
$('#import-json').addEventListener('change', e => runImport(e.target, (st, text) => importJSON(st, text), '#io-msg'));
$('#export-deck-json').addEventListener('click', () => {
  const d = getDeck(state, currentDeckId); download(safeName(d.name) + '.json', exportJSON([d]), 'application/json');
});
$('#export-deck-csv').addEventListener('click', () => {
  const d = getDeck(state, currentDeckId); download(safeName(d.name) + '.csv', exportCSV(d), 'text/csv');
});
$('#import-csv').addEventListener('change', e => runImport(e.target, (st, text) => importCSV(st, getDeck(st, currentDeckId).name, text), '#deck-io-msg'));

render();
