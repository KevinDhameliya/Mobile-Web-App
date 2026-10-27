# Money Tracker

A personal money tracker for your phone, built as an installable PWA. It tracks purchases, credit card bills, money you lend and borrow, refunds and cashback. Data is kept on the device (works fully offline) and, once you sign in, synced to the cloud so it is backed up and the same on all your devices.

**Stack:** React 19 · TypeScript (strict) · Vite 8 · Tailwind CSS 4 · React Router 8 · Dexie (IndexedDB) · Supabase (cloud sync) · vite-plugin-pwa · Netlify.

## Run locally

Requires **Node.js 22.22 or newer** (`node -v`).

```bash
npm install          # first time, and after pulling changes (adds dexie + dexie-react-hooks)
npm run dev          # http://localhost:5173 (service worker off)
npm test             # balance-calculation tests (Node's built-in test runner, no extra deps)
npm run lint
npm run build        # type-check + production build into dist/
npm run preview      # http://localhost:4173, test PWA/offline here
npm run check        # lint + test + build in one go (all must pass)
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
| Refund | − (my share) | − if refunded to card | − their share, if the purchase was for them | refunds |
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
- A refund on something bought for someone is split in the same proportion as the purchase: their share reduces what they owe you, only your share reduces your spending. Several partial refunds that add up to the full price clear their debt exactly (no stray paise).
- Entries that others are linked to are protected: you can't lower a loan or purchase below what has already been repaid or refunded, or change its type or person, while repayments or refunds point at it.
- The form warns before saving an entry with the same type, amount, date, card and person as an existing one. Each form has a fixed ID, so a double-tap on Save can't create two entries.
- Restoring a backup in "add missing" mode skips records that already exist, so restoring twice never doubles anything.
- Cards and people that have transactions can't be deleted (archive the card instead).

**Card bills are estimates.** The statement balance, due date and paid/pending/overdue status come only from the entries you made here. Check them against your bank statement, and record an *Adjustment* for any difference.

Tests for all of this are in `src/domain/finance.test.ts`.

## Cloud sync (Supabase)

- **Sign in:** Settings → *Cloud sync* → enter your email → open the emailed link. No password. On an iPhone home-screen app, press and hold the link in the email → *Copy Link* → paste it into the app (iOS keeps home-screen apps' storage separate from Safari, so tapping the link would sign in Safari instead).
- **How it works:** every card, person and transaction is one row in the `records` table (`supabase/schema.sql`). Each save or delete on the phone is queued (`pending` table in IndexedDB) and uploaded a few seconds later; changes from other devices are downloaded on launch, when the app comes back to the foreground, when the connection returns, and every 5 minutes. If the same entry is changed on two devices, the later change wins. Deletions sync too.
- **Offline:** everything keeps working; queued changes upload when you're back online.
- **First sign-in on a device:** entries already on it are uploaded, then everything from the cloud is downloaded. Nothing on the device is deleted.
- **Security:** row-level security means a signed-in user can only read and write their own rows; signed-out requests are refused. The publishable key in `src/data/cloud.ts` is designed to be public.
- **Supabase project:** `money-tracker` (region ap-south-1, Mumbai). Site URL and redirect URL point to https://mobilewebapplication.netlify.app. To recreate the database, run `supabase/schema.sql` in the SQL editor (it is safe to run more than once).
- **Email limits:** the free plan's built-in email allows only a few sign-in emails per hour. Each device stays signed in, so this only matters when signing in.
- Build without sync: set `VITE_CLOUD_SYNC=off`.

## Data storage and backup

- Data lives in **IndexedDB** (via Dexie) in this browser on this device. It survives closing the browser and works offline. The app asks the browser for *persistent storage* so the data isn't cleaned up automatically.
- Without signing in, data is **not** synced between devices. Use Settings → *Download backup (JSON)* regularly. Backups still work with sync on, as an extra copy.
- Restore validates the whole file before writing anything. *Replace everything* first downloads a backup of your current data, then replaces it in one transaction (all or nothing).
- Reports → **CSV** exports every transaction for Excel or Google Sheets.
- App updates never erase data. Schema changes must be added as a new `db.version(n)` with an upgrade (see `src/data/db.ts`). Version 2 (app 2.1.0) recalculates the person's share on existing linked refunds once; nothing else is changed.
- Restoring an older backup recalculates refund shares too, so old files restore correctly.
- Clearing site data in browser settings deletes your records. Keep backups.

## Project structure

```
src/
  domain/       pure logic, no React: types, money, dates, finance (balances), validation, reports, backup + tests
  data/         Dexie database, repository (save/delete/restore), cloud client + sync engine, live data hook, dev-only sample data
  features/     dashboard, transactions, cards, people, reports, settings
  components/   shared UI (Button, Card, Field, ConfirmDialog, Amount…), layout, PWA prompts
  app/          router, theme, PWA and sync providers
supabase/       cloud database schema (table, security rules, push function)
```

## PWA

- Manifest, icons (including `apple-touch-icon`) and standalone display are configured in `vite.config.ts`.
- The whole app shell, including `index.html` and every lazily loaded screen, is precached, so the app opens and works fully offline on any screen.
- Updates use **prompt** mode: a new version waits until you tap *Reload*, so it never swaps code under a half-filled form.
- Test with `npm run build && npm run preview`. Check DevTools → Application → Service workers / Manifest, then go offline and reload.
