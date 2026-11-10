# Tymy PWA

Progressive Web App for sports team management, built on the existing **Tymy REST API**
(`tymy.apib`). Events with RSVP attendance, discussions (BBCode chat), polls, team roster
and profile management.

> **Resuming work?** Read [`docs/SESSION_STATE.md`](docs/SESSION_STATE.md) — current
> status, verified backend contract, open tasks and pitfalls. Agent rules live in
> [`AGENTS.md`](AGENTS.md).

## Features

- **Events** – list with filters (upcoming / past / mine), optimistic RSVP, detail with
  attendance + history
- **Discussions** – paginated posts, BBCode rendering, post creation with preview
- **Polls** – voting with TEXT / NUMBER / BOOLEAN options and result bars
- **Team roster** – filter by member status, search, user detail
- **Profile** – edit personal data, upload avatar (base64)
- **Auth** – login, registration, password reset, session (TSID) persistence
- **PWA** – installable, offline cache (Workbox stale-while-revalidate for the API),
  auto-update handling, push-ready scaffolding

## Tech stack

| Concern | Choice |
|---|---|
| UI framework | SolidJS (fine-grained reactivity, no virtual DOM) |
| Build | Vite + TypeScript |
| Data / cache | TanStack Query v5 (with localStorage persistence) |
| Routing | @solidjs/router |
| PWA | vite-plugin-pwa + Workbox |
| Styling | Tailwind CSS + design tokens (`src/index.css`) |
| BBCode | Self-contained parser in `src/lib/bbcode.ts` |

Production bundle is roughly **63 kB gzipped** (JS + CSS).

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000 — proxied to https://dev.tymy.cz
```

Log in with your Tymy account; the session cookie is established through the proxy.

Other scripts:

```bash
npm run typecheck  # tsc --noEmit
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
npm run icons      # regenerate the PNG app icons
```

## API integration

The backend is **`https://dev.tymy.cz/api`** (HTTPS only, no CORS headers).

All requests go through `src/lib/api.ts`.

- **Dev proxy**: `vite.config.ts` proxies `/api` and `/user_pics` to
  `https://dev.tymy.cz`. Direct browser calls are impossible because the API does not
  send `Access-Control-Allow-Origin`.
- **Auth**: `POST /login` with a **form-urlencoded** body (`login`, `password`) — JSON is
  rejected. The response contains `sessionKey`, which is the `PHPSESSID` value; the API
  authenticates via that cookie (`X-TSID` and query-param keys are *not* accepted).
  Because JS cannot set an `HttpOnly` cookie, the dev proxy relays the stored key from an
  `X-Session-Key` request header into a `Cookie: PHPSESSID=…` upstream. In production the
  cookie is set normally on the same origin.
- **Envelope**: `{ status: "OK" | "ERROR", data?, statusMessage? }`. `request()` unwraps
  `data`; `requestEnvelope()` is used where top-level fields matter (`sessionKey`).
- **Errors**: the server's message is in `statusMessage`.

Key endpoints used:

| Feature | Endpoint |
|---|---|
| Events + attendance | `GET /events/withMyAttendance?filter=…&order=…&limit=…` |
| Event detail / history | `GET /event/{id}`, `GET /event/{id}/history` |
| RSVP | `POST /attendance` |
| Discussions | `GET /discussions/withNew` |
| Posts | `GET /discussion/{id}/bb/{page}`, `POST /discussions/{id}/post` |
| Polls | `GET /polls/menu`, `GET /polls/{id}`, `POST /polls/{id}/votes` |
| Roster | `GET /users/status/{status}` |
| Profile | `GET /user/{id}`, `PUT /user/{id}`, `POST /user/{id}/avatar` |
| Avatars | `GET /user_pics/{id}.png` (proxied in dev) |

Notes:

- The API does **not** return `myAttendance`; the app derives the current user's RSVP from
  the event's `attendance` array (`preStatus`).
- Status sets (`eventTypes[].preStatusSet`) include a `color` (raw RGB hex) which the UI
  uses for the RSVP buttons.
- `GET /events/withMyAttendance` returns every event (~2 MB) unless filtered, so the list
  queries per tab: upcoming (`startTime >= now`), past (`endTime < now`, desc, limit 40)
  and "mine" (desc, limit 60, filtered client-side).
- `/captions` and `/notes/html` are not available on the API host; the app falls back to
  built-in Czech captions.

## Project structure

```
src/
├── lib/
│   ├── api.ts           # typed client, TSID auth, filter builder
│   ├── auth.ts          # reactive auth store + actions
│   ├── captions.ts      # i18n with built-in Czech defaults
│   ├── bbcode.ts        # safe BBCode <-> HTML
│   ├── date-filters.ts  # API date formats + display helpers
│   ├── icons.ts         # inline SVG icon set
│   ├── queryClient.ts   # QueryClient, persistence, query keys
│   └── pwa.ts           # SW updates, install prompt, push helpers
├── features/
│   ├── auth/            # login, register, password reset
│   ├── events/          # list, detail, create/edit, sub-components
│   ├── discussions/     # list + detail
│   ├── polls/           # list + detail/voting
│   ├── users/           # roster + detail
│   ├── profile/         # profile + settings
│   ├── notes/           # public notes
│   └── layout/          # app shell (header, sidebar, bottom nav)
├── app.tsx              # routes + auth guards
├── main.tsx             # entry
└── index.css            # design tokens + utilities
```

## PWA notes

- Icons are generated with `npm run icons` (dependency-free PNG encoder). Replace the
  generated placeholders with real artwork before shipping.
- Runtime caching: API GETs use `StaleWhileRevalidate` (24 h, 200 entries); images
  `CacheFirst`; hashed assets are precached.
- `initPWA()` attaches update/offline listeners once the injected service worker is ready.

## Deployment

Build output is a static SPA in `dist/`. Serve with an SPA fallback to `index.html`
(Netlify `_redirects`, Vercel rewrites, Nginx `try_files`). Requires HTTPS for the
service worker and install prompt.

## Configuration notes

- **Styling**: Tailwind (`tailwind.config.cjs`) maps colour utilities to the CSS
  variables in `src/index.css`, so design tokens and dark mode work through the same
  palette. Component primitives (`.btn`, `.input`, `.badge`, `.label`, `.icon`) live at
  the end of `src/index.css`.
- **Avatars/uploads** are served from the API host. In dev, `/user_pics` is proxied;
  in production set `VITE_ASSET_ORIGIN` if assets live on another origin.
- **Icons**: `npm run icons` regenerates PNGs from the dependency-free encoder in
  `scripts/generate-icons.mjs`. Swap in real artwork before release.
