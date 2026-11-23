# Flashcards (Spaced Repetition)

A browser flashcard app: build decks of cards and review them with an SM-2 spaced-repetition scheduler. Plain HTML/CSS/JS, no dependencies, data saved in localStorage.

**Live:** https://lewis-p-t.github.io/flashcards-spaced-repetition/

Run locally: clone and open `index.html`. See `PROGRESS.md` for the build plan.

## Reviewing
Open a deck and press **Study** to review due cards (then up to 20 new ones).
Keyboard: `Space` show answer, `1`-`4` grade Again/Hard/Good/Easy (`Enter` = Good), `Esc` end session.
Cards marked Again come back later in the same session; a summary shows accuracy and time at the end.

## Stats
**Stats** (on the deck list) shows cards, reviews today, retention (share of non-new reviews not graded Again), daily streak, a 14-day due forecast and a 14-day review history chart.

## Import / export
- **Export all (JSON)** / **Import JSON** on the deck list: full decks including schedules. Decks merge by name; duplicate front+back cards are skipped.
- In a deck: **Export JSON**, **Export CSV** (`front,back`), **Import CSV** (header row optional, quoted fields supported).
- Imports are validated on a copy first, so a bad file changes nothing.

## Tags & search
Add space/comma-separated tags to a card. On the deck list, search all cards by words and `#tags` (terms are ANDed), click a tag chip to filter, and **Study all due** reviews due cards from every deck at once.

## Getting started & themes
- With no decks yet, click **load a sample deck** (World Capitals, tagged by continent) to try it immediately.
- **Dark mode / Light mode** button (top right) overrides the OS colour scheme; the choice is remembered. Layout adapts to phone widths.

## Files
`sm2.js` scheduler · `store.js` data/persistence · `session.js` review queue · `stats.js` forecast/retention/streak · `io.js` JSON/CSV · `script.js` UI.
