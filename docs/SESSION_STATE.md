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

Design tokens (2026-11-10): the UI is **neutral grey** — `--color-primary` and friends are
greys (`#495057` / `#343a40` / `#e9ecef`), so buttons, active nav, links and focus rings
carry no blue. Radii are deliberately tight (`--radius-lg` = 4 px, `--radius-xl` = 6 px);
circles are reserved for avatars. Status colours (success/warning/danger/info) are
unchanged and still semantic. **Only buttons with a text label are filled**: icon-only
controls (send, header, drawer) and the decorative list icons are flat glyphs with a
hover background at most.

Bundle ≈ **65 kB gzipped** (JS ~47 kB + CSS ~9 kB + vendor ~15 kB).

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
`users/status/{status}`, `user/{id}`, `live`, `user_pics/{id}.png`,
`event/export/report?year=YYYY&page=N`, `event/export/attendance?from=…&until=…`.

Not available on this host: `captions` (404), `notes/html` (404), and **any file
endpoint** — `/files`, `/file`, `/media`, `/documents`, `/attachments` all 404. File
storage lives only in the legacy server-rendered page `/file` (see §7).

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
│   ├── team.ts         team (subdomain) selection, stored as `tymy:team`
│   ├── bbcode.ts       safe BBCode ↔ HTML
│   ├── date-filters.ts API date formatting + display helpers
│   ├── icons.ts        MDI Light inline SVG set (shared by layout and features)
│   ├── queryClient.ts  QueryClient, persistence, query keys, invalidators
│   ├── pwa.ts          SW update listeners, install prompt, push helpers
│   └── types.ts        API types aligned to live payloads
├── features/
│   ├── auth/           TeamPage, Login, Register, ForgotPassword, ResetPassword
│   ├── events/         EventsPage, EventDetailPage, EventCreatePage,
│   │                   EventHeader, EventRsvp, EventAttendance, EventLink, constants
│   ├── discussions/    DiscussionsPage, DiscussionDetailPage
│   ├── polls/          PollsPage, PollDetailPage
│   ├── users/          UsersPage, UserDetailPage
│   ├── profile/        ProfilePage, SettingsPage
│   ├── files/          FilesPage (explains the missing file API, links to legacy /file)
│   ├── reports/        ReportsPage (players × events attendance matrix + XLSX export)
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
    header/bottom-nav CSS vars in `index.css`); the shell deliberately does not subtract
    the page's bottom padding, so the composer sits flush above the bottom nav on phones.
    The page itself is **borderless** and centred (`max-w-3xl mx-auto`), separated only by
    hairlines under the header and above the composer. Scrolling up restores
    `scrollHeight - anchor` so the position stays put.
  - One day divider per day (`Dnes` / `Včera` / date), one separator per message,
    consecutive posts by the same author within 5 min are grouped (no repeated avatar).
  - Message text never widens the column: `.chat-bubble` uses `overflow-wrap: anywhere`,
    so a long unbroken URL/hash wraps instead of causing horizontal scroll; `[code]`
    blocks keep their own scrollbar (`.prose pre`).
  - Enter sends, Shift+Enter inserts a newline; BBCode toolbar above the composer
    (the client-side preview toggle was removed on request).
- **Nav** is not role-filtered (accounts may have `roles: []`); per-action rights come
  from API flags (`canPlan`, `canWrite`, `canView`, …).
- **Guards** wait for `initAuth()` (`useIsLoading`) so deep links survive reload.
- **Team selection** (`/team`, `src/features/auth/TeamPage.tsx`): every team lives on
  `<subdomain>.tymy.cz`, so the address is chosen *before* login and stored in
  `tymy:team`. It is skipped whenever a valid session exists; `/team` is where the guards
  send an unauthenticated user (after logout, after an expiry, or on a cold start), and
  the login screen offers "změnit tým".
  - Every API call sends `X-Team-Subdomain`; the **dev proxy** turns it into a `Host`
    header (all team vhosts share the Apache box — `Host: nope.tymy.cz` answers the
    wildcard 302, `Host: dev.tymy.cz` answers the API). Avatars carry the team as
    `?team=…` because an `<img>` cannot set headers.
  - `checkTeam()` probes `/api/eventTypes`: 200/401 = the team exists, a 3xx (redirect to
    `www.tymy.cz/404.html`) = unknown subdomain.
  - In production the app must be served **on the team's own domain** (same-origin API).
- **Session validation** (`src/lib/auth.ts`, `onUnauthorized` in `src/lib/api.ts`):
  - On start-up a stored session is verified with `GET /user/{id}` *before* the guard
    lets anyone in; a 401/403 drops the token, the cached user `tymy:user`, the
    persisted query cache and shows the login page with "Platnost přihlášení vypršela".
    Network errors keep the session (offline tolerance).
  - `revalidateSession()` re-checks on `visibilitychange` (throttled to 5 min), so
    returning to a suspended tab does not start with a 401.
  - **Any** 401 from the API triggers the same drop via the `onUnauthorized` hook, so
    an expiry mid-session lands on the login screen instead of erroring on every page.
- **Sections**: Události, Chat, Ankety, Tým, Soubory, Reporty, Profil. Only the five
  with `primary: true` are shown in the mobile bottom bar; the other two live in the
  drawer (7 items would not fit at 390 px).
- **Reporty** = the legacy "Report docházky": players × events matrix from
  `events/withMyAttendance` (fetched per year) + `users/status/PLAYER`, plus the official
  XLSX via `GET /event/export/report?year=…&page=…` (binary, **not** a JSON envelope).
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

### 2026-11-10 (sections + session)

- Nav gained **Soubory** (`/files`) and **Reporty** (`/reports`); drawer close is now a
  chevron-double-left, the chat send glyph is `upload`.
- Session check verified in Edge: a stale token in `tymy:tsid` + reload of `/events`
  lands on `/login` with the "Platnost přihlášení vypršela" notice, no console errors.
- Reports verified live: year auto-selects the newest year with data (2022), matrix shows
  26 players × 5 events, XLSX export returns a 7 520-byte `PK` zip through the proxy.
- Files page verified: renders the explanation + link to the legacy `/file` page.
- Team flow verified in Edge: fresh start → `/team` (prefilled `dev`), unknown subdomain
  → "Tým „nope12345.tymy.cz“ nebyl nalezen.", `dev` → `/login` (shows `dev.tymy.cz` +
  "změnit tým"), login → `/events`, reload while logged in skips `/team`, logout and a
  stale token both land on `/team`.
- All `⏳` / `✓` glyphs replaced with MDI icons (splash, page loaders, button spinners,
  success screens).

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
5. **Soubory**: no file API exists (the legacy module is server-rendered). `FilesPage`
   explains this and links to `/file`; replace it once an endpoint appears.
6. **Poll UX**: `minItems`/`maxItems` not enforced; only filled options are submitted;
   TEXT/NUMBER semantics could differ from server expectations.
7. **Tests**: none. Suggested — Vitest for `bbcode`, `date-filters`, filter builder;
   Playwright/Vitest browser for login → events → RSVP.
8. **App icons** are procedural placeholders (`npm run icons`) — replace with real
   artwork. (The in-app UI icons are already Material Design Light, see §2.)
9. **Push notifications** need a backend VAPID key + subscription endpoint.
10. **Production hosting** must serve the app **same-origin with the API** (no CORS) and
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
- **Icon sizing**: `.icon` = 20 px, `.icon-sm` = 16 px, `.icon-md` = 24 px,
  `.icon-lg` = 40 px. Text utilities like `text-4xl` do **not** resize glyphs (the svg
  has a fixed size).
- **Radius/colour utilities live in `index.css`, not in Tailwind's theme.** The custom
  block after `@tailwind utilities` redefines `.rounded-md/.rounded-lg/.rounded-xl/.rounded-2xl`,
  so the values in `tailwind.config.cjs` are ignored — change the `--radius-*` vars (and
  `--color-primary*` for the grey palette) instead.
- **Trust the live API over `tymy.apib` for ordering/paging.** The Blueprint shows
  discussion page 1 containing the oldest posts; the server actually returns the newest
  first. Always probe with one real request before wiring pagination.
- **Don't assume embedded relations exist** (`createdBy`, `pictureUrl`…). A null
  `createdBy` used to throw inside the chat's render effect and blank the page. Each chat
  message is now wrapped in a Solid `ErrorBoundary` so one bad record can't take the
  conversation down.
- **Expired sessions must be handled once, centrally.** Any request can 401; handling it
  per-screen means every screen needs its own error UI. `onUnauthorized` in `api.ts`
  fires once and `auth.ts` tears the session down, so the guards do the redirecting.
- **Binary endpoints break the envelope assumption.** `event/export/*` returns an XLSX
  (`application/octet-stream`, `PK` magic), not `{status, data}` — use `requestBlob()`,
  never `request()`.
- **One icon set only** (Material Design Light). No emoji/unicode glyphs in the UI — the
  old `⏳` splash and `✓` screens have been replaced by `ICONS['spinner']` / `ICONS['check']`.
- **Vite's proxy has no `router` option** in 5.4 (it is silently ignored, so every request
  quietly hit the default host). Multi-team dev routing therefore overrides the `Host`
  header in `proxyReq`; verify with
  `curl -H "X-Team-Subdomain: nope12345" localhost:3000/api/eventTypes` → 302.
