# Mobile Web App

A mobile-first, installable Progressive Web App (PWA) that runs on Android, iPhone, iPad and desktop browsers, hosted on Netlify.

**Stack:** React 19 · TypeScript (strict) · Vite 8 · Tailwind CSS 4 · React Router 8 · vite-plugin-pwa (Workbox) · Lucide icons · ESLint.

---

## Requirements

- **Node.js 22.22 or newer** (required by React Router 8). Check with `node -v`.
- npm 10+

## Setup

```bash
npm install
```

## Scripts

| Command                  | What it does                                                   |
| ------------------------ | -------------------------------------------------------------- |
| `npm run dev`            | Development server at http://localhost:5173 (service worker off) |
| `npm run build`          | Type-check and build for production into `dist/`               |
| `npm run preview`        | Serve the production build at http://localhost:4173            |
| `npm run lint`           | Run ESLint (strict, type-aware rules)                          |
| `npm run lint:fix`       | ESLint with auto-fix                                           |
| `npm run typecheck`      | TypeScript only                                                |
| `npm run generate-icons` | Regenerate PNG/ICO icons from `public/icons/logo.svg`          |

## Testing

There is no unit-test suite yet. Before each release, run:

```bash
npm run lint && npm run build && npm run preview
```

Then open http://localhost:4173 and check:

1. **Routes:** go to `/settings/install` directly and refresh. It should load, not show a 404.
2. **Service worker:** DevTools → Application → Service workers shows `sw.js` as *activated*. The Home screen's “Updates” tile shows **Active**.
3. **Manifest:** DevTools → Application → Manifest shows the name and icons with no errors.
4. **Offline:** DevTools → Network → *Offline*, then load a new URL. You should see the “You're offline” page.
5. **Update prompt:** change any text, run `npm run build` again and restart preview, then reload the open tab. An “Update available” toast should appear.
6. **Lighthouse:** run a PWA/best-practices audit on the preview URL.

> The service worker is turned off in `npm run dev` on purpose, so caching doesn't hide your code changes. Always test PWA behaviour with `build` + `preview`.

## Project structure

```
├── netlify.toml            # Netlify build, SPA rewrite, security + cache headers
├── pwa-assets.config.ts    # Icon generator config
├── vite.config.ts          # Vite, Tailwind, PWA manifest + Workbox config
├── eslint.config.js
├── index.html              # Meta tags, iOS tags, boot splash
├── public/
│   ├── icons/              # logo.svg + generated PNG/ICO icons
│   ├── offline.html        # Shown for navigations while offline
│   ├── theme-init.js       # Applies saved theme before first paint
│   └── favicon.svg
└── src/
    ├── main.tsx
    ├── app/                # App root, router, Theme + PWA providers
    ├── components/
    │   ├── common/         # Button, Card, PageHeader, StatusBadge, state views, error boundary
    │   ├── layout/         # AppLayout, Sidebar (desktop), BottomNav + TopBar (mobile)
    │   └── pwa/            # InstallButton, InstallHelp, UpdatePrompt, OfflineBanner
    ├── features/
    │   ├── home/           # Dashboard, device status, API status, 404
    │   ├── about/
    │   └── settings/       # Theme, updates, stored data, install guide
    ├── hooks/              # useInstallPrompt, useOnlineStatus, useTheme, usePwa, useApiHealth
    ├── services/           # config, apiClient (fetch wrapper), healthService, installPrompt store
    ├── types/
    ├── utils/
    └── styles/index.css    # Tailwind + design tokens (light/dark)
```

## How the PWA works

- **Manifest** (built from `vite.config.ts`): name, short name, theme/background colours, standalone display, and 64/192/512 px icons plus a maskable 512 px icon.
- **iOS:** `apple-touch-icon` (180 px), `apple-mobile-web-app-*` meta tags and safe-area padding for the notch and home indicator.
- **Install:**
  - **Chromium** (Android Chrome, desktop Chrome/Edge): the `beforeinstallprompt` event is caught and an **Install app** button appears.
  - **iOS Safari:** this event doesn't exist there, so an **Install** button links to the manual Add to Home Screen steps (`/settings/install`).
  - **Other browsers** (Firefox, for example): the button is hidden.
- **Caching (Workbox `generateSW`) is deliberately conservative:**
  - Hashed JS/CSS, icons and `offline.html` are precached. Their revision hashes change with every deploy.
  - `index.html` is **not** cached. Page loads always go to the network, so users never get stuck on stale HTML. When offline, they see `offline.html`.
  - API requests are **never** cached by the service worker.
- **Updates:** `registerType: 'prompt'`. A new deployment is detected on load, every hour, and whenever the app comes back to the foreground. The user then sees an **Update available → Reload** toast. Settings → Updates also has a manual **Check for updates** button.

## Environment variables

Copy `.env.example` to `.env.local` for local development, or set the variables in Netlify (Site configuration → Environment variables).

| Variable               | Purpose                                      |
| ---------------------- | -------------------------------------------- |
| `VITE_API_BASE_URL`    | Backend base URL. Leave empty for no backend. |
| `VITE_API_HEALTH_PATH` | Health-check path (default `/health`)        |

> ⚠️ **Every `VITE_*` variable is compiled into the public JavaScript bundle and can be read by anyone who opens the site.** Never put API keys, tokens or other secrets in them. Keep secrets on a server, such as your backend or a Netlify Function.

When `VITE_API_BASE_URL` is set, the home screen calls `GET {base}{healthPath}` and shows a loading, error or success state. To call the API from new features, use `apiRequest<T>()` in `src/services/apiClient.ts`. It handles timeouts, aborts, JSON parsing and typed `ApiError`s.

If your API is on another origin, it must allow CORS from your Netlify domain. Once your API's origin is known, also tighten `connect-src` in `netlify.toml`.

## Deploying to Netlify

1. Push this project to a GitHub repository.
2. In Netlify: **Add new project → Import an existing project → GitHub**, then pick the repo.
3. The build settings are read from `netlify.toml`:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Node version:** 22 (`NODE_VERSION` in `netlify.toml`)
4. (Optional) Add `VITE_API_BASE_URL` under Environment variables, then redeploy.
5. Deploy. Every push to the production branch redeploys automatically, and installed apps show the update prompt.

Netlify serves every site over HTTPS, which service workers and installation require. `netlify.toml` also sets up:

- **SPA rewrite:** `/*` → `/index.html` (status 200), so deep links and refreshes work. Real files are never shadowed.
- **Security headers:** CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy.
- **Cache headers:**
  - `/assets/*` is cached for a year (immutable).
  - `sw.js`, `workbox-*.js`, the manifest, `index.html`, `offline.html` and `theme-init.js` use `no-cache`, so updates always reach users.

## Installing on a phone

**Android (Chrome):** open the HTTPS URL, then tap **Install app** in the app, or use ⋮ → **Install app** / **Add to Home screen**.

**iPhone / iPad (Safari):** open the URL, then tap Share (on recent iOS it may be inside the ••• menu) → **Add to Home Screen** → keep **Open as Web App** on → **Add**.

Installation behaviour varies by browser and OS version. For example, Firefox desktop doesn't support installation, and iOS has no install prompt.

## Changing the name, colours or icon

- **Name and colours:** edit `APP_NAME`, `APP_SHORT_NAME` and `THEME_COLOR` in `vite.config.ts`, the `<title>` and meta tags in `index.html`, and the tokens in `src/styles/index.css`.
- **Icon:** replace `public/icons/logo.svg` (and `public/favicon.svg`), then run `npm run generate-icons`.
