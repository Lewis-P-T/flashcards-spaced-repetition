// Import/export: JSON (full decks incl. schedules) and CSV (front,back). Pure, no DOM.
const MAX_IMPORT_CARDS = 10000;

function exportJSON(decks) {
  return JSON.stringify({
    format: 'flashcards', version: 1,
    decks: decks.map(d => ({ name: d.name, cards: d.cards.map(c => ({ front: c.front, back: c.back, sched: c.sched })) })),
  }, null, 2);
}

function csvField(s) {
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function exportCSV(deck) {
  return ['front,back'].concat(deck.cards.map(c => csvField(c.front) + ',' + csvField(c.back))).join('\r\n') + '\r\n';
}

// RFC 4180-style parser: quoted fields, "" escapes, newlines inside quotes.
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', i = 0, quoted = false;
  text = text.replace(/^﻿/, '');
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
    i++;
  }
  if (quoted) throw new Error('CSV has an unclosed quote');
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(f => f.trim() !== ''));
}

function validSched(s) {
  return s && typeof s === 'object' && [s.ease, s.interval, s.reps, s.due].every(Number.isFinite) &&
    (s.last === null || Number.isFinite(s.last)) ? s : null;
}

// Merge cards into the deck named `name` (created if missing). Duplicate front+back pairs are skipped.
function mergeCards(state, name, cards, report) {
  let deck = state.decks.find(d => d.name.toLowerCase() === name.trim().toLowerCase());
  if (!deck) { deck = createDeck(state, name); report.decks++; }
  const seen = new Set(deck.cards.map(c => c.front + '\u0000' + c.back));
  for (const raw of cards) {
    const front = String(raw.front || '').trim(), back = String(raw.back || '').trim();
    if (!front || !back) { report.invalid++; continue; }
    const key = front + '\u0000' + back;
    if (seen.has(key)) { report.skipped++; continue; }
    seen.add(key);
    const card = addCard(state, deck.id, front, back);
    const s = validSched(raw.sched);
    if (s) card.sched = Object.assign({ lapses: 0 }, s);
    report.cards++;
  }
  return deck;
}

function newReport() { return { decks: 0, cards: 0, skipped: 0, invalid: 0 }; }

// Accepts our export format, a bare array of decks, or a single {name, cards} deck.
function importJSON(state, text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('Not valid JSON'); }
  const decks = Array.isArray(data) ? data : Array.isArray(data && data.decks) ? data.decks : data && data.cards ? [data] : null;
  if (!decks) throw new Error('JSON has no decks');
  for (const d of decks) {
    if (!d || typeof d.name !== 'string' || !d.name.trim() || !Array.isArray(d.cards)) throw new Error('Each deck needs a name and a cards array');
  }
  if (decks.reduce((n, d) => n + d.cards.length, 0) > MAX_IMPORT_CARDS) throw new Error('Too many cards (max ' + MAX_IMPORT_CARDS + ')');
  const report = newReport();
  for (const d of decks) mergeCards(state, d.name, d.cards, report);
  return report;
}

// CSV rows of front,back; an optional "front,back" header row is ignored.
function importCSV(state, deckName, text) {
  const rows = parseCSV(text);
  if (rows.length && rows[0][0].trim().toLowerCase() === 'front' && (rows[0][1] || '').trim().toLowerCase() === 'back') rows.shift();
  if (!rows.length) throw new Error('CSV has no cards');
  if (rows.length > MAX_IMPORT_CARDS) throw new Error('Too many cards (max ' + MAX_IMPORT_CARDS + ')');
  if (rows.some(r => r.length < 2)) throw new Error('Every CSV row needs two columns: front,back');
  const report = newReport();
  mergeCards(state, deckName, rows.map(r => ({ front: r[0], back: r[1] })), report);
  return report;
}

if (typeof module !== 'undefined') {
  Object.assign(globalThis, require('./store.js'));
  module.exports = { exportJSON, exportCSV, parseCSV, importJSON, importCSV };
}
