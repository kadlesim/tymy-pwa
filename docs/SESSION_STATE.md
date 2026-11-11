# Project state — Tymy PWA

_Last updated: 2026-11-11_

Handoff notes so work can resume without re-discovering the backend or the
earlier pitfalls. Keep this file current when significant things change.

---

## 0. Where we left off (resume here)

**Everything below is committed and pushed; the working tree is clean.**
Latest commit: dark mode, English UI, text size, logo icons and the event-management
polish (run `git log -1` for the hash).
Remote: `github.com/kadlesim/tymy-pwa`, `master` in sync with `origin/master`.

State of the app (all working against **dev.tymy.cz** and **pd.tymy.cz**):

- Sections: Události, Chat, Ankety, Tým, Soubory, Reporty, Profil.
- **Events**: list (closest first, `order=startTime__asc`), month grid, "Nevyplněná
  docházka" tab with count, detail with icon-only edit/delete, RSVP + note, attendance
  grouped by answer (§5). Management page at `/events/manage` (bulk delete + series
  builder, §5).
- **Chat**: bottom composer, newest at the bottom, older pages on scroll-up, per-message
  hover menu (react/copy/edit/pin/delete) with server-mirroring rights. "Nová diskuze" is
  shown only when the user can write in some discussion (§5 — the API exposes no
  `canCreate` flag).
- **Chat view is intentionally borderless**; **UI is neutral grey**, tight radii, MDI Light
  icons only (no emoji) (§2).
- **Preferences**: dark mode, Czech/English UI and a larger text size — icons next to the
  bell on desktop, the same controls in the drawer on phones, plus Profile → Nastavení →
  Vzhled (§5).
- **Team selection** before login (`/team`), **central session validation** (§5).
- **Reporty** = attendance matrix + XLSX export; **Soubory** = placeholder (no file API).
- **App/PWA icons and the favicon are generated from `logo2.png`** (`npm run icons`).

**Deployment is live: <https://tymy-pwa.pages.dev>** — Cloudflare Pages, `TYMY_DEFAULT_TEAM=pd`.
`functions/` (Pages Functions for `/api` and `/user_pics`), `public/_redirects` (SPA
fallback) and `wrangler.toml` are in the repo; see **`docs/DEPLOYMENT.md`**.
Re-verified 2026-11-11 from outside: `/` and `/team` answer 200, `/api/eventTypes` through
the Pages Function answers `401 Unauthorized` for `pd` (upstream reached, no session) and
`404 Team not found` for an unknown subdomain. Redeploy with
`npx wrangler pages deploy dist --project-name tymy-pwa` (or by pushing to `master` if the
project is Git-connected).

**Next likely tasks** (see §7 for the full list): verify the remaining write
endpoints (`POST /polls/{id}/votes`, `PUT /user/{id}`, `POST /user/{id}/avatar`,
`POST /events/create`, `PUT /event/{id}`, `DELETE /event/{id}`) — the new
`/events/manage` page calls `POST /events/create` (array) and `DELETE /event/{id}`, but
neither has been run against a live team yet — then a real login on the live deployment.

---

## 1. What this project is

A Progressive Web App for sports-team management built on the existing **Tymy REST
API**. Client-only SPA; no backend code lives here.

Repo: `C:\devel\tymy-pwa` · API spec: `tymy.apib` (API Blueprint, vendor docs).

Sections: **Events** (RSVP), **Chat/Discussions** (BBCode, chat view), **Polls**,
**Roster**, **Soubory**, **Reporty**, **Profile/Settings**.

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

Theme + text size (2026-11-11): `.dark` remaps the neutral scale (50–200 = surfaces,
500–900 = text) and lifts `text-primary`; the root font size becomes 18 px when
`<html data-text-size="large">`. The language lives on `<html lang>`.

Bundle ≈ **75 kB gzipped** (JS ~56 kB + CSS ~10 kB + vendor ~15 kB); the i18n dictionary
is the biggest recent addition.

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

`?filter=endTime<20261109000000&order=startTime__asc&limit=40`
- operators: `>`, `<`, `=`, `!=`, `>=`, `<=`
- multiple conditions joined by `~`
- dates as `YYYYMMDDHHmmss` (UTC, produced by `formatFilterValue`)
- **sorting: a bare field name sorts DESCENDING** (verified on pd.tymy.cz:
  `order=startTime` and `order=startTime__desc` both return the newest first).
  Ascending needs the explicit `__asc` suffix: `order=startTime__asc`.
  Same for `id`.

### Data quirks

- `events/withMyAttendance` has **no `myAttendance`** field. The current user's RSVP is
  derived from `event.attendance.find(a => a.userId === me)?.preStatus`.
- Each event embeds its full `attendance[]` (~11 kB/event), so the unfiltered list is
  ~2 MB. The app queries per tab instead (see §5).
- `eventTypes[].preStatusSet[]` carries `code`, `caption`, `icon` and `color`
  (raw RGB hex, no `#`) — the UI uses those colours.
- **Dev dataset:** events span **2013 → 2022**, so “Upcoming” is legitimately empty.
  On **pd.tymy.cz** there is real data (hundreds of upcoming trainings/events, 175
  attendance entries on one event) — use the `/team` screen with `pd` to test there.
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
│   ├── i18n.ts         `tr()` for hard-coded UI strings (Czech source → English)
│   ├── prefs.ts        theme / language / text size (localStorage + <html>)
│   ├── team.ts         team (subdomain) selection, stored as `tymy:team`
│   ├── bbcode.ts       safe BBCode ↔ HTML
│   ├── date-filters.ts API date formatting + display helpers
│   ├── event-labels.ts localised event-type / attendance captions (EN fallback map)
│   ├── user-status.ts  user categories shared by the roster and reports
│   ├── icons.ts        MDI Light inline SVG set (shared by layout and features)
│   ├── queryClient.ts  QueryClient, persistence, query keys, invalidators
│   ├── pwa.ts          SW update listeners, install prompt, push helpers
│   └── types.ts        API types aligned to live payloads
├── features/
│   ├── auth/           TeamPage, Login, Register, ForgotPassword, ResetPassword
│   ├── events/         EventsPage, EventDetailPage, EventCreatePage (also edit),
│   │                   EventsManagePage (bulk, `/events/manage`),
│   │                   EventMonthView, EventHeader, EventRsvp, EventAttendance,
│   │                   EventLink, constants
│   ├── discussions/    DiscussionsPage, DiscussionDetailPage, ChatMessage
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
`tsconfig.json` (`noEmit: true`), `scripts/generate-icons.mjs` (sharp, reads `logo2.png`).

---

## 5. Behaviour decisions worth remembering

- **Event management** (`/events/manage`, `EventsManagePage`): the PWA counterpart of the
  legacy `/setting/event` screen. Year + type + text filters over `GET /events` — the
  lightweight collection, which embeds no attendance — shown as a row table with
  checkboxes and per-row edit/delete icons. Multi-select delete calls `DELETE /event/{id}`
  per row and aggregates the results with `Promise.allSettled`; rows are selectable only
  when `canPlan`/`canPlanOthers` is set, and the server still enforces `SYS:EVE_DELETE`.
  Below the filters sits a **series builder**: caption/type/place/link/description, weekday
  chips, date range, start time, duration and close offset; it previews the generated
  dates and posts an **array** to `POST /events/create` (the endpoint is natively bulk)
  with a 200-event cap. The events page links to it via "Správa"; the single-event
  "Nová událost" button next to it is admin-only (§5).
- **Creating a discussion is admin-only**: the "Nová diskuze" button (and the empty-state
  "create the first discussion" button) render only for `isAdmin()` (the user's `roles`
  contain `SUPER`). Event creation is **not** gated — "Nová událost" is shown to everyone
  again; the server enforces `SYS:EVE_*` either way.
- **Event type / attendance labels are localised client-side** (`src/lib/event-labels.ts`):
  API requests carry `Accept-Language: en|cs`, so the server may return translated
  captions; if it returns an empty caption or one of the built-in Czech defaults
  (`Trénink`, `Přijdu`, …), the English map (`Training`, `Attending`, …) fills in. Custom
  captions and custom codes are left untouched.
- **Preferences** (`src/lib/prefs.ts`): `tymy:theme` (`light|dark`), `tymy:lang`
  (`cs|en`) and `tymy:text-size` (`normal|large`), applied to `<html>` by `initPrefs()`
  before the first render (no flash of the wrong theme). Controls: three icon buttons next
  to the bell on `md+`; the same three as labelled segmented controls in the drawer on
  phones (the header hides them below `md`); Profile → Nastavení → Vzhled repeats them.
- **i18n**: `tr()` in `src/lib/i18n.ts` is keyed by the **Czech source string** — no
  separate keys, and anything missing from the English dictionary falls back to Czech
  instead of rendering a key. `{name}` placeholders are filled through the second
  argument. Dates use `getLocale()`; the `captions.ts` domains keep their codes and now
  also have English defaults. Server-provided text (event type captions, discussion
  posts, status captions) stays in the team's language.
- **Events view switch**: icons only (list / calendar), 24 px glyphs in 40 px square
  buttons; the active half is filled with `--color-primary`. Accessible names come from
  `aria-label`/`title` (no visible text). The views are the list (grouped by day, closest
  to now first) and a Google-Calendar style month grid (`EventMonthView`) with month
  navigation, today highlighted and event pills that open `/events/:id`; the grid queries
  the visible month only.
- **Events list = one server query per tab:**
  - Upcoming: `startTime >= now`, order `startTime__asc` (closest first)
  - Pending attendance ("Nevyplněná docházka"): `endTime >= now`, order `startTime__asc`,
    then client-filtered to `closeTime >= now` and no own `preStatus`; the tab shows the
    count. Its query runs independently so the badge is right on every tab.
  - Past: `endTime < now`, order `startTime__desc`, **limit 40**
  - Empty “Upcoming” shows a button that switches to “Past”.
- **Event detail actions** are icon-only (pencil = `/events/:id/edit`, trash = delete) and
  only rendered when `event.canPlan` and `canPlan`/`canPlanOthers` allow it.
- **Event attendance** (`EventRsvp` + `EventAttendance`):
  - Status buttons are compact and use the **event type's own captions** (`Přijdu`,
    `Omlouvám se`, `Přijdu později` on pd) instead of the built-in label map.
  - The note lives in `attendance.preDescription` and is saved with `POST /attendance`
    together with the current status (the API requires a pre- or post-status, so the
    field is disabled until a status exists). Saves on blur/Enter.
  - The list is grouped by answer (status order from the event type, then "Bez odpovědi")
    and only shows **active players** (`user.status === 'PLAYER'`) plus anyone who actually
    answered — 175 raw entries became 59 rows on pd. Each row: avatar (with a generic glyph
    fallback when the picture 404s), the display name as returned (`displayName ?? callName`)
    and the note underneath. The uppercase login is gone.
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
  - Message actions appear on hover (always on touch) behind a `⋯` button — the menu
    opens upwards when the message sits near the bottom of the pane, because it lives
    inside the scrolling container. Rights mirror the server (`PostManager`):
    `react`/`copy` for everyone, `Upravit` for own posts (also needs
    `discussion.editablePosts`), `Připnout` for `canStick`, `Smazat` for `canDelete` —
    and **own post only when `editablePosts` is false**; with `editablePosts` the API
    answers 403 "Nedostatečná práva" even for your own post.
  - Reactions are optimistic: the cached page is patched locally, then
    `POST|DELETE /discussions/{id}/post/{postId}/react` (body = bare JSON string) is sent
    and the cache invalidated on error. Existing reactions render as badges under the
    message and toggle on click.
  - Editing swaps the bubble for a textarea holding the raw BBCode (Uložit / Zrušit).
  - Enter sends, Shift+Enter inserts a newline; BBCode toolbar above the composer
    (the client-side preview toggle was removed on request).
  - **Posting is optimistic**: the composer clears immediately, a placeholder post
    (negative id) is prepended to the chat cache, and the request runs in the background.
    On success the placeholder is replaced by the returned post — the conversation is only
    marked stale (`refetchType: 'none'`), so nothing jumps — and the "new posts" badges
    refetch; on failure the placeholder is removed, the error shows above the composer and
    the text is put back into the input.
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
- **Reporty** = the legacy "Report docházky": a players × events matrix from
  `events/withMyAttendance` + `users/status/{category}`, with three filters — **date range**
  (defaults to Jan 1 – Dec 31 of the newest event's year), **event type** (client-side on
  the matrix columns) and **user category** (same list as Tým, default PLAYER). The
  official XLSX still comes from `GET /event/export/report?year=…&page=…` (binary, **not**
  a JSON envelope): it is server-side and year-based, so the button exports the year of
  the range start and shows it (`XLSX 2026`).
- **Tým** = a table (avatar, display name, jersey number, phone, e-mail) instead of cards;
  phone hides below `md`, e-mail below `sm`, and the hidden values reappear as a second
  line under the name on phones. Broken/missing avatars fall back to the user glyph.
- **Ankety**: the list keeps the compact summary. The detail shows the per-option bars
  **and who voted for each option** (avatar + name + the value for TEXT/NUMBER/BOOLEAN
  options). Votes carry only `userId`, so names come from the roster via one query that
  merges all five `users/status/*` categories. `anonymousResults` hides the names.
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
- **Events verified against pd.tymy.cz** (real team, same account): upcoming list now
  starts with the nearest event (11. 11. 2026 → 16. 11. → 18. 11. → 21. 11.) instead of
  2027; the "Nevyplněná docházka" tab shows a live count (49) and its list; the month grid
  renders November 2026 with 14 event pills and opens `/events/{id}` when clicked; the
  detail header shows only the pencil and trash icons (no text) and `/events/:id/edit`
  renders the prefilled form.
- Event detail (pd, event 4851): compact RSVP buttons using the team's own captions, note
  field saving through `POST /attendance` (persisted across a reload, then cleared), and an
  attendance list grouped Přijdu 17 / Omlouvám se 10 / Přijdu později 2 / Bez odpovědi 30
  out of 175 raw entries.
- Team-aware avatars: the `/user_pics` proxy keeps `?team=…` (Vite's `rewrite` ran before
  we could read it, so every avatar fell back to the wrong host).
- All `⏳` / `✓` glyphs replaced with MDI icons (splash, page loaders, button spinners,
  success screens).

### 2026-11-11 — production deployment

- Live at **<https://tymy-pwa.pages.dev>** (Cloudflare Pages, `TYMY_DEFAULT_TEAM=pd`).
- Probed from outside: `/` → 200, `/team` → 200 (SPA fallback serves `index.html`),
  `/api/eventTypes` with `X-Team-Subdomain: pd` → `401 {"status":"ERROR","statusMessage":
  "Unauthorized"}` (the function reached the team's API and forwarded no session), same
  request with `nope12345` → `404 {"statusMessage":"Team not found"}` (upstream 302
  detected). Proxy, team resolution and fallback all confirmed in production.
- Not yet exercised on the live host: login and any write (only the read-only probes above
  were run from here).

### 2026-11-11 — event management page (mock-verified)

- `/events/manage` and the reworked events header were rendered in headless Edge against a
  **mocked API** (fetch override injected before boot, session seeded in `localStorage`) —
  no real team data touched. Checked at 1280×900 and 390×844: table, selection bar
  ("Vybráno 2" → "Smazat vybrané (2)"), series builder (9 Wednesdays previewed) and the
  events header ("Správa", admin-only "Nová událost") all render; select
  bindings resolve to `2026` / `all`; **0 console errors**.
- Fixed during the check: the search field's magnifier overlapped the placeholder because
  `.input` (defined after `@tailwind utilities`) overrides `pl-8` — padding is now inline.
- Not exercised: the actual `POST /events/create` and `DELETE /event/{id}` calls (mock only).

### 2026-11-11 — preferences, English UI, logo icons (mock-verified)

- Headless Edge against the mocked API with `tymy:theme=dark`, `tymy:lang=en` and
  `tymy:text-size=large`: `<html class="dark" lang="en">`, root font 18 px, "Event
  management" / "Bulk deletion and creation of events…" in English, drawer block
  "Appearance and language" with Light/Dark, CS/EN and A/A, "New discussion" visible
  (mock discussion has `canWrite`), **0 console errors**.
- Light/Czech regression pass on `/events` and `/events/manage`: selects bind, icon-only
  view switch reachable through `aria-label`, **0 console errors**.
- `npm run build` clean; `npm run icons` generated every manifest size plus
  `favicon-32.png`, `favicon-192.png` and `apple-touch-icon.png` from `logo2.png`.
- Also fixed while there: the two remaining emoji glyphs (🔑, 👁) became MDI `lock`/`eye`.
- After switching the icon source to the square `logo2.png`, the icons were regenerated
  (flattened onto white, maskable padded).
- English labels: with a mock that returns Czech captions, the EN UI showed **Training /
  Match** type badges and **Attending / Not attending / Arriving late** RSVP buttons.
- Optimistic chat post, checked against a mock with a **1.5 s delayed POST**: the message
  was on screen 250 ms after submit with the composer already empty; after the response
  exactly one copy remained; with a failing POST the placeholder disappeared, the error
  appeared and the text was restored. **0 console errors**.
- Discussion creation is admin-only now: with `roles: []` the "New discussion" button is
  absent; the event "Nová událost" buttons are back for everyone.

### 2026-11-11 — roster table, report filters, poll voters (mock-verified)

- Headless Edge, mocked API in English: `/users` renders the table with Member / Number /
  Phone / E-mail columns (phone hidden below `md`, e-mail below `sm`) and a generic glyph
  when an avatar 404s; `/reports` shows From / Until / Event type / Group and a matrix of
  the filtered events (3 events × 4 people); `/polls/1` shows the bars plus voter chips
  ("Šimon Test · Yes", "Petr Dlouhý · No", "Šimon Test · 4"). **0 console errors**.
- Reminder from the check: the poll detail endpoint is `/polls/{id}` (plural). A stub for
  `/poll/1` silently produced "Poll not found".

---

## 7. Open items / next steps (priority order)

1. **Verify write endpoints** with one real action each (currently docs-based only):
   `POST /polls/{id}/votes`, `PUT /user/{id}`,
   `POST /user/{id}/avatar`, `POST /events/create`, `PUT /event/{id}`, `DELETE /event/{id}`.
   The new `/events/manage` page exercises `POST /events/create` (array body) and
   `DELETE /event/{id}`, so a series of one throwaway event plus its deletion is now a
   single-screen check — do it on dev, not on pd.
   `POST /attendance` is **verified** (200, returns the saved record; a note written on pd
   survived a reload).
   Discussion writes are **done**: `POST /discussions/{id}/post` (201),
   `PUT` (200, sets `updatedAt`), `POST|DELETE …/post/{postId}/react` (200) — all verified
   on discussion 2. `DELETE /discussions/{id}/post` answers 403 for this account because
   the discussion has `editablePosts: true` (see §5).
2. **Discussion post edit/delete** is wired up (hover menu, see §5). Note the API shape:
   URL segment is the **discussion** id, post id goes in the body
   (`PUT|DELETE /discussions/{discussionId}/post`) — the old helpers were wrong-shaped
   and have been fixed. Reactions use `/discussions/{id}/post/{postId}/react`.
3. **Pagination**: Past events cap at 40 and pending at 100 with no “load more”.
   Discussions already load older pages on scroll.
4. **Notes**: `NotesPage` exists but has no route, and `/notes/html` 404s on dev.
5. **Soubory**: no file API exists (the legacy module is server-rendered). `FilesPage`
   explains this and links to `/file`; replace it once an endpoint appears.
6. **Poll UX**: `minItems`/`maxItems` not enforced; only filled options are submitted;
   TEXT/NUMBER semantics could differ from server expectations.
7. **Tests**: none. Suggested — Vitest for `bbcode`, `date-filters`, filter builder;
   Playwright/Vitest browser for login → events → RSVP.
8. **App icons** are generated from `logo2.png` (`npm run icons`, sharp); the procedural
   placeholders and `favicon.svg` are gone.
9. **Push notifications** need a backend VAPID key + subscription endpoint.
10. **Production hosting** — **done, live at <https://tymy-pwa.pages.dev>** (§0, §6).
    Cloudflare Pages + the two Pages Functions, `TYMY_DEFAULT_TEAM=pd`. Remaining follow-ups:
    log in there once for real (writes were only tested against dev/pd locally), add a
    custom team domain if wanted (the app must stay **same-origin with the API**: no CORS,
    HTTPS, SPA fallback, proxy turning `X-Session-Key` into `Cookie: PHPSESSID=…`).
11. **Legacy typo**: the first events tab uses the caption `Přicházející`
    (`captions.ts:45`, `EventHeader.tsx:16`); the usual Czech is `Nadcházející`.
12. **Discussion create right** is a heuristic: `canCreateDiscussion()` shows the button
    when any discussion has `canWrite` (admins implicitly may). The API exposes no
    `canCreate`/`SYS:DIS_CREATE` flag — swap the heuristic once one appears.
13. **i18n** covers the UI; server data (event type captions, status captions, discussion
    posts, names) stays in the team's language. Missing `tr()` keys fall back to Czech
    silently, so add entries to `src/lib/i18n.ts` with every new string.
14. **`npm run icons` needs `logo2.png`** (square) in the repo root and the `sharp`
    devDependency; it rewrites `public/icons/*` plus the favicons.
15. **Discussion creation is gated by `isAdmin()`** (`SUPER` role), not by the real
    `SYS:DIS_CREATE` right — the API exposes no flag. Replace the predicate if one appears
    (or if planners should be allowed too).
16. **Reports export is year-based** while the matrix filter is a free date range: the
    XLSX button exports the range's start year (shown on the button). Switch to a range
    export if the server ever offers one.
17. **Poll voter names cost five `users/status/*` requests** — the API has no all-users
    GET. Cached for 10 minutes under `['users','poll-voters']`; collapse to one request if
    an endpoint appears.

---

## 8. Commands

```bash
npm install
npm run dev        # http://localhost:3000 (proxies /api and /user_pics to dev.tymy.cz)
npm run typecheck  # tsc --noEmit
npm run build      # type-check + dist/
npm run preview    # serve dist/
npm run icons      # regenerate PWA icons + favicons from logo2.png (sharp)
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
  old `⏳` splash and `✓` screens have been replaced by `ICONS['spinner']` / `ICONS['check']`;
  🔑/👁 became `ICONS['lock']`/`ICONS['eye']`. (Chat *reactions* are deliberately emoji.)
- **The bundled MDI Light package only ships 263 glyphs** — there is no moon, globe or
  text-size icon, so those three preference glyphs are hand-written SVGs in `icons.ts`.
- **`tr()` is keyed by the Czech source string**, so two identical Czech words share one
  entry (`Ne` was both "No" and "Sunday" — the weekday now wins). TypeScript rejects
  duplicate object keys, which is the guard against accidental collisions.
- **`.dark` remaps the neutral scale**: `--color-50…200` become surfaces and `--color-500…900`
  become text. A component that hard-codes `bg-white` (instead of `bg-elevated`) will
  break in dark mode; the two remaining tab bars were switched to `bg-elevated`.
- **`.input` (in index.css) overrides Tailwind padding utilities** because it is defined
  after `@tailwind utilities`; a search field that needs room for an icon must set
  `padding-left` inline (the manage page does).
- **`npm run icons` is no longer dependency-free** — it uses `sharp` and reads `logo2.png`.
- **Optimistic chat posts** carry a negative id and live at the front of `pages[0].posts`
  (page 1 is newest-first). Replace the placeholder in `onSuccess` and mark the chat query
  stale with `refetchType: 'none'` — a full invalidation refetches every loaded page and
  the list jumps.
- **`Accept-Language` is sent on every API request** based on the UI language. Event type
  captions are usually still Czech, so `event-labels.ts` fills in English for the standard
  codes; the `eventTypes` query key includes the language to refetch if the server localises.
- **Poll detail is `/polls/{id}`** (plural). `/poll/{id}` answers empty and the page
  silently shows "Poll not found". Votes embed only `userId`; anonymity is
  `poll.anonymousResults`, so never render voter names without checking it.
- **Vite's proxy has no `router` option** in 5.4 (it is silently ignored, so every request
  quietly hit the default host). Multi-team dev routing therefore overrides the `Host`
  header in `proxyReq`; verify with
  `curl -H "X-Team-Subdomain: nope12345" localhost:3000/api/eventTypes` → 302.
