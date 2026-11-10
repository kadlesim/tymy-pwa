# Project state — Tymy PWA

_Last updated: 2026-11-10_

Handoff notes so work can resume without re-discovering the backend or the
earlier pitfalls. Keep this file current when significant things change.

---

## 1. What this project is

A Progressive Web App for sports-team management built on the existing **Tymy REST
API**. Client-only SPA; no backend code lives here.

Repo: `C:\devel\tymy-pwa` · API spec: `tymy.apib` (API Blueprint, vendor docs).

Sections: **Events** (RSVP), **Discussions** (BBCode chat), **Polls**, **Roster**,
**Profile/Settings**.

---

## 2. Stack (decided)

| Concern | Choice |
|---|---|
| UI | SolidJS 1.8 (fine-grained reactivity, no VDOM) |
| Build | Vite 5 + TypeScript 5 (`noEmit`) |
| Data/cache | TanStack Query v5 for Solid + localStorage persistence |
| Router | `@solidjs/router` 0.14 |
| PWA | `vite-plugin-pwa` 0.17 + Workbox |
| Styling | Tailwind 3.4 + `@tailwindcss/typography`, colours mapped to CSS vars in `src/index.css` |
| BBCode | Hand-written safe parser `src/lib/bbcode.ts` (escape → whitelist tags) |
| Icons | Material Design Light (`@mdi/light-js`, Pictogrammers) inlined as SVG strings |

Bundle ≈ **65 kB gzipped** (JS ~40 kB + CSS ~8 kB + vendor ~15 kB).

---

## 3. Backend contract (verified against the live dev server)

**Base URL:** `https://dev.tymy.cz/api` — **HTTPS only** (port 80 returns 301) and
**no CORS headers**, so the browser must always go through the Vite proxy (dev) or a
same-origin reverse proxy (prod).

### Auth

- **Login:** `POST /login` with `Content-Type: application/x-www-form-urlencoded` and
  body `login=…&password=…`. → `200 {status:"OK", sessionKey, data:{…user}}`.
  - JSON body returns `400 {"statusMessage":"Invalid request data"}`.
  - `GET /login/{user}/{password}` also works (not used).
- **Session:** the API authenticates with the **`PHPSESSID` cookie**, whose value is the
  returned `sessionKey`. `X-TSID` header and query-param keys are **rejected**.
- JS cannot set an `HttpOnly` cookie, so the dev proxy converts an `X-Session-Key`
  request header into `Cookie: PHPSESSID=…` upstream (see `vite.config.ts`).
- `GET /loginPhp` → 301 on this host; only attempted in production.
- Test account used for verification: login `simon`, user id **31**, `roles: []`.
  **The password is not stored in this repo.**

### Response envelope

`{ "status": "OK" | "ERROR", "data": …, "statusMessage": "…" }`
Errors put the message in **`statusMessage`** (not `message`).

### Verified endpoints (200)

`eventTypes`, `events/withMyAttendance`, `event/{id}`, `event/{id}/history`,
`discussions/withNew`, `discussion/{id}/bb/{page}`, `polls/menu`, `polls/{id}`,
`users/status/{status}`, `user/{id}`, `live`, `user_pics/{id}.png`.

Not available on this host: `captions` (404), `notes/html` (404).

### Query syntax (works)

`?filter=endTime<20261109000000&order=startTime__desc&limit=40`
- operators: `>`, `<`, `=`, `!=`, `>=`, `<=`
- multiple conditions joined by `~`
- dates as `YYYYMMDDHHmmss` (UTC, produced by `formatFilterValue`)
- order `<field>` asc / `<field>__desc`

### Data quirks

- `events/withMyAttendance` has **no `myAttendance`** field. The current user's RSVP is
  derived from `event.attendance.find(a => a.userId === me)?.preStatus`.
- Each event embeds its full `attendance[]` (~11 kB/event), so the unfiltered list is
  ~2 MB. The app queries per tab instead (see §5).
- `eventTypes[].preStatusSet[]` carries `code`, `caption`, `icon` and `color`
  (raw RGB hex, no `#`) — the UI uses those colours.
- **Dev dataset:** events span **2013 → 2022**, so “Upcoming” is legitimately empty.
- **Discussion pages are newest-first:** `/discussion/{id}/bb/{page}` returns ~20 posts in
  *descending* order, page 1 = newest, last page = oldest (verified on discussion 1:
  127 posts, 7 pages). The Blueprint example is misleading.
- **`DiscussionPost.createdBy` can be `null`** when the author account was deleted
  (`createdById: null`, only `userName` survives — e.g. `Autocreator135`, `AUTOTEST`).
  Discussion 1 has 2 such posts (page 6), discussion 2 has 68. Both fields are typed
  nullable now.

---

## 4. Source map

```
src/
├── lib/
│   ├── api.ts          typed client, envelope unwrap, login, filters, apiAssetUrl
│   ├── auth.ts         reactive auth store (login/register/logout/reset, guards)
│   ├── captions.ts     i18n with built-in Czech defaults
│   ├── bbcode.ts       safe BBCode ↔ HTML
│   ├── date-filters.ts API date formatting + display helpers
│   ├── icons.ts        MDI Light inline SVG set (shared by layout and features)
│   ├── queryClient.ts  QueryClient, persistence, query keys, invalidators
│   ├── pwa.ts          SW update listeners, install prompt, push helpers
│   └── types.ts        API types aligned to live payloads
├── features/
│   ├── auth/           Login, Register, ForgotPassword, ResetPassword
│   ├── events/         EventsPage, EventDetailPage, EventCreatePage,
│   │                   EventHeader, EventRsvp, EventAttendance, EventLink, constants
│   ├── discussions/    DiscussionsPage, DiscussionDetailPage
│   ├── polls/          PollsPage, PollDetailPage
│   ├── users/          UsersPage, UserDetailPage
│   ├── profile/        ProfilePage, SettingsPage
│   ├── notes/          NotesPage (implemented, **not routed**)
│   └── layout/         Layout (header desktop nav + drawer + mobile bottom nav)
├── app.tsx             routes + auth guards (incl. loading splash)
├── main.tsx            entry
└── index.css           tokens + Tailwind directives + component classes
```

Config: `vite.config.ts` (proxy + PWA), `tailwind.config.cjs`, `postcss.config.cjs`,
`tsconfig.json` (`noEmit: true`), `scripts/generate-icons.mjs`.

---

## 5. Behaviour decisions worth remembering

- **Events list = one server query per tab:**
  - Upcoming: `startTime >= now`, order `startTime`
  - Past: `endTime < now`, order `startTime__desc`, **limit 40**
  - Mine: order `startTime__desc`, **limit 60**, filtered client-side by derived RSVP
  - Empty “Upcoming” shows a button that switches to “Past”.
- **RSVP** uses optimistic cache updates on the active tab key; payload
  `[{userId: <me>, eventId, preStatus, preDescription}]`.
- **Discussion detail = chat view** (`DiscussionDetailPage`):
  - The API is **newest-first**: `/discussion/{id}/bb/1` returns the newest ~20 posts in
    *descending* order, page N+1 the next older batch (verified live 2026-11-10 on
    discussion 1: 127 posts / 7 pages, page 1 = 2022-10-28…2021-05-12, page 7 =
    2013-04). The Blueprint example that shows page 1 holding 2014 dates is misleading.
  - The chat therefore starts at **page 1** and walks forward (`pageParam` 1 → 2 → 3…)
    when the user scrolls up. Pages are reversed and sorted ascending before rendering,
    so the newest message sits at the bottom.
  - Composer pinned to the bottom of a full-height `.chat-shell` (height derived from the
    header/bottom-nav CSS vars in `index.css`); the page itself is **borderless** and
    centred (`max-w-3xl mx-auto`), separated only by hairlines under the header and above
    the composer. Scrolling up restores `scrollHeight - anchor` so the position stays put.
  - One day divider per day (`Dnes` / `Včera` / date), one separator per message,
    consecutive posts by the same author within 5 min are grouped (no repeated avatar).
  - Enter sends, Shift+Enter inserts a newline; BBCode toolbar + client-side preview.
- **Nav** is not role-filtered (accounts may have `roles: []`); per-action rights come
  from API flags (`canPlan`, `canWrite`, `canView`, …).
- **Guards** wait for `initAuth()` (`useIsLoading`) so deep links survive reload.
- **Captions** only fetched in production; dev uses defaults (avoids 404 noise).
- **Avatars** go through `apiAssetUrl()`; `/user_pics` is proxied in dev, or set
  `VITE_ASSET_ORIGIN` in production.

---

## 6. Verified working (2026-11-09)

Type-check and production build clean. Automated Edge (puppeteer-core, since removed)
smoke test confirmed:

- login `/login → /events`
- desktop header nav shows all 5 sections; active highlight works
- `/profile` reachable via nav and via the title link back to `/events`
- direct load of `/profile/settings` stays put (no bounce to login)
- mobile 390 px: 5 bottom-nav items; hamburger opens the drawer
- Events “Past” renders 40 items; Discussions (4), Polls, Users render
- no console page errors; no 404s

**Read paths are verified. Write paths are not** (see §7).

### 2026-11-10 — icons + chat view

- Icon set replaced with Material Design Light throughout (nav, headers, empty states,
  BBCode toolbar, drawer close).
- Discussion detail rebuilt as a chat (see §5). First checked against a throwaway local
  mock, then against the live API — see below.

### 2026-11-10 (later) — live API check

- Logged into `dev.tymy.cz` with the real test account and confirmed the pagination
  order (see §5) — the chat initially loaded the *oldest* page because of the Blueprint
  example; fixed to start at page 1 (newest).
- Verified live at 1280×800 and 390×844: opens scrolled to the newest message with real
  avatars/names, scrolling up prepends the previous 20 posts (2018 → 2022) without
  moving the reader, day dividers correct, no console errors.
- Still not exercised live: sending a post (avoided posting into the shared dev data).

---

## 7. Open items / next steps (priority order)

1. **Verify write endpoints** with one real action each (currently docs-based only):
   `POST /attendance`, `POST /discussions/{id}/post`, `POST /polls/{id}/votes`,
   `PUT /user/{id}`, `POST /user/{id}/avatar`, `POST /events/create`,
   `PUT /event/{id}`, `DELETE /event/{id}`.
2. **Discussion post edit/delete** not in UI. Note the API shape: URL segment is the
   **discussion** id, post id goes in the body (`PUT|DELETE /discussions/{discussionId}/post`).
   Current helpers in `api.ts` are wrong-shaped and unused — fix before wiring UI.
3. **Pagination**: Event lists cap at 40/60 with no “load more”. Discussions now
   load older pages on scroll.
4. **Notes**: `NotesPage` exists but has no route, and `/notes/html` 404s on dev.
5. **Poll UX**: `minItems`/`maxItems` not enforced; only filled options are submitted;
   TEXT/NUMBER semantics could differ from server expectations.
6. **Tests**: none. Suggested — Vitest for `bbcode`, `date-filters`, filter builder;
   Playwright/Vitest browser for login → events → RSVP.
7. **App icons** are procedural placeholders (`npm run icons`) — replace with real
   artwork. (The in-app UI icons are already Material Design Light, see §2.)
8. **Push notifications** need a backend VAPID key + subscription endpoint.
9. **Production hosting** must serve the app **same-origin with the API** (no CORS) and
   over HTTPS; SPA fallback to `index.html`.

---

## 8. Commands

```bash
npm install
npm run dev        # http://localhost:3000 (proxies /api and /user_pics to dev.tymy.cz)
npm run typecheck  # tsc --noEmit
npm run build      # type-check + dist/
npm run preview    # serve dist/
npm run icons      # regenerate PNG app icons
```

---

## 9. Pitfalls already hit (do not repeat)

- **Stale emitted JS shadows sources.** `tsc` used to emit `.js/.jsx` next to `.ts/.tsx`
  and Vite resolves `.js` first. `noEmit: true` is now set — never remove it. If weird
  “config not applied” behaviour appears, check for `vite.config.js`.
- **Vite prefers `vite.config.js` over `.ts`** — delete any generated copy.
- **PowerShell text rewriting mangles UTF-8** (Czech strings). Use the editor tools for
  edits, not `Get-Content | Set-Content`.
- **Tailwind JIT and dynamic classes**: `bg-${color}` is not detected. Use inline
  `style` with CSS variables (done for status colours).
- **Solid: do not destructure `useQuery` results** — they are getters. Use
  `useQuery(() => ({…}))` and read `query.data` / `query.isPending`.
- **`@solidjs/router` 0.14**: use `A` (not `NavLink`), no `<Outlet>` (nested routes pass
  `props.children`), `Navigate` takes `href` (not `to`, no `replace`).
- **TanStack Solid Query v5**: options must be an accessor; mutation context is the 4th
  generic.
- **Outside-click menus**: ignore clicks whose path contains `data-toggle` or the menu
  closes on the opening click.
- **Icons (MDI Light)**: `src/lib/icons.ts` imports path data from `@mdi/light-js` and
  wraps it in `<svg fill="currentColor">`. Import it from `@mdi/light-js/mdil.js` — the
  package root is CommonJS-interop and would pull all 263 glyphs into the bundle (about
  +8 kB gzip). Verify tree-shaking with a dist grep after adding icons. MDI Light has
  **no `send` glyph** (a round `arrow-up` button is used) and **no `mdilLoading`** even
  though it exists at runtime — the spinner is a spinning `refresh`.
- **Icon sizing**: `.icon` = 20 px, `.icon-sm` = 16 px, `.icon-lg` = 40 px. Text
  utilities like `text-4xl` do **not** resize glyphs (the svg has a fixed size).
- **Trust the live API over `tymy.apib` for ordering/paging.** The Blueprint shows
  discussion page 1 containing the oldest posts; the server actually returns the newest
  first. Always probe with one real request before wiring pagination.
- **Don't assume embedded relations exist** (`createdBy`, `pictureUrl`…). A null
  `createdBy` used to throw inside the chat's render effect and blank the page. Each chat
  message is now wrapped in a Solid `ErrorBoundary` so one bad record can't take the
  conversation down.
