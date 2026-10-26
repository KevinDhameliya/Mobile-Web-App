# Money Tracker

A personal money tracker for your phone, built as an installable PWA. It tracks purchases, credit card bills, money you lend and borrow, refunds and cashback. All data stays in your browser on your device: there is no server and no login.

**Stack:** React 19 · TypeScript (strict) · Vite 8 · Tailwind CSS 4 · React Router 8 · Dexie (IndexedDB) · vite-plugin-pwa · Netlify.

## Run locally

Requires **Node.js 22.22 or newer** (`node -v`).

```bash
npm install          # first time, and after pulling changes (adds dexie + dexie-react-hooks)
npm run dev          # http://localhost:5173 (service worker off)
npm test             # balance-calculation tests (Node's built-in test runner, no extra deps)
npm run lint
npm run build        # type-check + production build into dist/
npm run preview      # http://localhost:4173, test PWA/offline here
npm run check        # lint + test + build in one go
```

**Sample data (development only):** in `npm run dev`, open Settings → *Developer preview* → *Preview with sample data*. This switches to a separate IndexedDB database (`money-tracker-dev-sample`), so sample entries never mix with your real records. Production builds don't include this option.

## Deploy to Netlify

`netlify.toml` already contains everything Netlify needs:

- Build command `npm test && npm run build` (a failing calculation test blocks the deploy), publish dir `dist`, Node 22.
- SPA rewrite `/* → /index.html`, so refreshing on any screen works.
- Security headers (CSP allows only same-origin requests) and cache headers that keep `sw.js`, `index.html` and the manifest always fresh.

With the site linked to the Git repo, push to the deploy branch and Netlify builds it. To deploy by hand: `npx netlify deploy --prod --dir=dist` after `npm run build`.

## How money is calculated

Every number comes from one file: `src/domain/finance.ts`. Each transaction is converted into its effect on separate balances that never mix:

| Type | My spending | Card balance | Person balance | Other |
|---|---|---|---|---|
| Purchase | + (minus the part to recover) | + if paid by card | + part someone owes back | |
| Fee/Interest | + | + if on card | | |
| Refund | − | − if refunded to card | | refunds |
| Credit Card Payment | **not spending** | − | | transfer |
| Money Received | | | | income |
| Cashback | | − if credited to card | | cashback (not income) |
| Money Lent | **not spending** | + if paid by card | + | |
| Money Borrowed | | | − (you owe) | **not income** |
| Money Returned → to me | | | − | recovered |
| Money Returned → by me | | | + | |
| Adjustment | | ± (card) | ± (person) | only its target balance |

Safeguards against double counting and data errors:

- Amounts are stored as whole **paise** (integers), so there are no rounding errors.
- Fields that don't apply to a type are cleared before saving. A card left selected after switching type cannot affect a balance.
- Repayments are linked to the original debt. You can't repay more than is left on it, or link a repayment to another person's debt.
- Refunds can't exceed what remains of the linked purchase.
- The form warns before saving an entry with the same type, amount, date, card and person as an existing one. Each form has a fixed ID, so a double-tap on Save can't create two entries.
- Restoring a backup in "add missing" mode skips records that already exist, so restoring twice never doubles anything.
- Cards and people that have transactions can't be deleted (archive the card instead).

**Card bills are estimates.** The statement balance, due date and paid/pending/overdue status come only from the entries you made here. Check them against your bank statement, and record an *Adjustment* for any difference.

Tests for all of this are in `src/domain/finance.test.ts`.

## Data storage and backup

- Data lives in **IndexedDB** (via Dexie) in this browser on this device. It survives closing the browser and works offline. The app asks the browser for *persistent storage* so the data isn't cleaned up automatically.
- **It is not synced between devices.** Use Settings → *Download backup (JSON)* regularly and keep the file somewhere safe. To move to a new phone, open the app there and use *Restore from backup*.
- Restore validates the whole file before writing anything. *Replace everything* first downloads a backup of your current data, then replaces it in one transaction (all or nothing).
- Reports → **CSV** exports every transaction for Excel or Google Sheets.
- App updates never erase data. Schema changes must be added as a new `db.version(n)` with an upgrade (see `src/data/db.ts`).
- Clearing site data in browser settings deletes your records. Keep backups.

## Project structure

```
src/
  domain/       pure logic, no React: types, money, dates, finance (balances), validation, reports, backup + tests
  data/         Dexie database, repository (save/delete/restore), live data hook, dev-only sample data
  features/     dashboard, transactions, cards, people, reports, settings
  components/   shared UI (Button, Card, Field, ConfirmDialog, Amount…), layout, PWA prompts
  app/          router, theme and PWA providers
```

## PWA

- Manifest, icons (including `apple-touch-icon`) and standalone display are configured in `vite.config.ts`.
- The whole app shell, including `index.html`, is precached, so the app opens and works fully offline on any screen.
- Updates use **prompt** mode: a new version waits until you tap *Reload*, so it never swaps code under a half-filled form.
- Test with `npm run build && npm run preview`. Check DevTools → Application → Service workers / Manifest, then go offline and reload.
