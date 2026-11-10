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
  - The API paginates **oldest → newest**, so page 1 is the *old end*. The chat calls
    page 1 once to read `paging.numberOfPages`, then starts at the last page (~20 posts)
    and walks backwards; the page number is the infinite-query `pageParam` and the
    `NEWEST_PAGE` sentinel triggers the discovery request.
  - Newest messages at the bottom, composer pinned to the bottom of a full-height
    `.chat-shell` (CSS var based height, see `index.css`). Scrolling up loads older
    pages and restores `scrollHeight - anchor` so the reading position stays put.
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
- Discussion detail rebuilt as a chat (see §5). Checked in Edge against a throwaway
  local mock of `/api/discussion/{id}/bb/{page}`: opens scrolled to the newest posts,
  scrolling up loads older pages without jumping, day dividers render, sending clears
  the composer and scrolls to the new message, no console errors at 1280×800 and
  390×844. Not yet exercised against the real API (needs credentials).

---

## 7. Open items / next steps (priority order)

1. **Verify write endpoints** with one real action each (currently docs-based only):
   `POST /attendance`, `POST /discussions/{id}/post`, `POST /polls/{id}/votes`,
   `PUT /user/{id}`, `POST /user/{id}/avatar`, `POST /events/create`,
   `PUT /event/{id}`, `DELETE /event/{id}`.
2. **Discussion post edit/delete** not in UI. Note the API shape: URL segment is the
   **discussion** id, post id goes in the body (`PUT|DELETE /discussions/{discussionId}/post`).
   Current helpers in `api.ts` are wrong-shaped and unused — fix before wiring UI.
3. **Confirm chat pagination against the live server** with a real session: the chat
   assumes `/discussion/{id}/bb/1` returns the *oldest* ~20 posts and the last page the
   newest (matches the API Blueprint example, 277 posts / 14 pages). Not yet verified
   live — mock-tested only.
4. **Pagination**: Event lists cap at 40/60 with no “load more”. Discussions now
   load older pages on scroll.
5. **Notes**: `NotesPage` exists but has no route, and `/notes/html` 404s on dev.
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
- **Icon sizing**: `.icon` = 20 px, `.icon-sm` = 16 px, `.icon-lg` = 40 px. Text
  utilities like `text-4xl` do **not** resize glyphs (the svg has a fixed size).
