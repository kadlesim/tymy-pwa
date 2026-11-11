# Notifications — implementation plan

> **Status: plan only.** Nothing in this document is implemented yet. The bell in the
> header is still decorative, the Profile → Notifikace toggles are placeholders, and there
> is no notification code in the app.

This plan is based on the repository (`tymy.apib`, `src/`, `docs/`) and the endpoints that
have actually been exercised against `dev.tymy.cz` / `pd.tymy.cz`. The vendored API
blueprint has **no notification, push or webhook section at all**; the browser-side push
helpers in `src/lib/pwa.ts` are scaffolding without a sender.

---

## 1. Recommendation

Ship notifications in two phases:

| Phase | What | Backend work | Effort |
|---|---|---|---|
| **1. In-app notification centre** | Derive "what's new for me" from endpoints the app already calls; bell badge + dropdown; seen-state in `localStorage`. | **none** | ~1–1.5 days |
| **2. Server feed + Web Push** | Real notifications table, read flags, push subscriptions and VAPID sending. | **required** (vendor side) | client ~1 day + server 2–3 days |

Phase 1 is useful on its own and can ship now. Phase 2 is the only way to get notifications
while the app is closed, and it needs API work that cannot be done from this repo.

---

## 2. What exists today

### Client

| Piece | Location | State |
|---|---|---|
| Bell button | `src/features/layout/Layout.tsx` | Icon only, no handler, no badge |
| Push helpers | `src/lib/pwa.ts` | `requestNotificationPermission()`, `subscribeToPush()` (reads `VITE_VAPID_PUBLIC_KEY`), no subscriber storage, no sender |
| Service worker | `vite-plugin-pwa` (`autoUpdate`) | No `push` / `notificationclick` handlers |
| Notification settings | `Profile → Nastavení → Notifikace` | Three inert toggles |
| Data queries | `queryClient.ts` | `discussions/withNew`, `polls/menu`, events, `live` already cached |

### API (verified endpoints only)

| Endpoint | Useful field(s) | Notification use |
|---|---|---|
| `GET /discussions/withNew` | `newPosts`, `newInfo.lastVisit` | Unread chat posts per discussion |
| `GET /discussions/newOnly` | `{id, newPosts}` | Cheaper unread-only poll (if it works on our hosts) |
| `GET /events` | `created?`, `createdUserId?`, `startTime`, `closeTime` | Newly created events |
| `GET /events/withMyAttendance` | attendance array (heavy: ~11 kB/event) | Avoid for notifications |
| `GET /polls/menu` | `status`, `voted`, `createdAt` | Polls waiting for your vote |
| `GET /live` | currently online users | Not a notification source |

**Not available:** any `/notifications`, `/push`, `/subscriptions`, webhook or mail
endpoint; no documented `SYS:NOTIF_*` right; no server-side "unread" counter except
`discussions/withNew`.

### What the dev.tymy.cz discussion must answer

The API/discussion board requires a login, so these could not be checked from this
environment. They change the design:

1. Does the **legacy app** send notifications at all (e-mail, in-app, browser)? Which
   events trigger them (new post, new event, poll opened, attendance changed, comment on
   my post)?
2. Is there a **notifications table/API** behind the legacy UI (even if undocumented), and
   a right that gates it?
3. Does **reading a discussion** reset `newPosts` server-side, and at which call (fetching
   `/discussion/{id}/bb/1`, opening the discussion detail, or an explicit "mark read")?
4. Is `event.created` / `createdUserId` reliably populated, and can `created` be used in
   `?filter=` (the query builder is generic, but this field was never exercised)?
5. Does the server support **outbound** notifications for a team (webhook or mail), or
   would the PWA have to provide the whole push pipeline?
6. Is there a **per-user notification settings** API, or are the legacy settings stored
   server-side only?
7. Does `/polls/menu` return only open polls and a correct `voted` flag per user (it is
   used by the poll list today)?

---

## 3. Options considered

| Option | Works offline/closed | Backend | Pros | Cons |
|---|---|---|---|---|
| **A. Derived in-app feed** | No | none | Ships now, no new API surface, respects existing rights | Only while the app is open/periodically polling; "new" semantics are approximations |
| **B. Foreground `Notification`** | No | none | Native-looking toasts while the app runs | Needs permission for little benefit; duplicates A |
| **C. Server feed + Web Push** | Yes | yes | Real unread state, works with the app closed, cross-device | Vendor work: table, endpoints, triggers, VAPID sender, subscription storage |
| **D. Cron worker polling the API** | Partial | no | No server changes | Needs every user's session/server credentials — **not acceptable** (see §6.4) |

Choose **A now**, **C later**. B and D are rejected.

---

## 4. Phase 1 — in-app notification centre (no backend)

### 4.1 Sources and rules

| Type | Source | Rule | Link | Id |
|---|---|---|---|---|
| `discussion` | `discussions/withNew` | `newPosts > 0` | `/discussions/{id}` | `discussion:{id}` |
| `event` | `GET /events?order=created__desc&limit=20` | `created > eventsSeenAt` and `createdUserId !== me` (fallback: `startTime` in the future when `created` is missing) | `/events/{id}` | `event:{id}` |
| `poll` | `polls/menu` | `status === 'OPENED' && !voted` (attention item, no unread state) and `createdAt > pollsSeenAt` | `/polls/{id}` | `poll:{id}` |
| `attendance` | pending-events query (already used by the events tab) | `closeTime - now < 48 h` and no own `preStatus`, keep the 3 nearest | `/events/{id}` | `attendance:{eventId}` |

Notes:

- **No event payloads with attendance** — notifications must not reuse
  `events/withMyAttendance` (2 MB on pd). `/events` is the lightweight collection.
- Unread count = sum of discussion `newPosts` + unseen events + unseen polls. Attendance
  items are "to do", shown with a clock icon, not counted as unread.
- Reading a discussion counts as reading it (the server resets `newPosts` on the first
  page fetch — confirm point 3 above). Also drop it locally immediately.

### 4.2 Seen state (`localStorage`)

```ts
// tymy:notifications:seen
{
  version: 1,
  eventsAt: '2026-11-11T08:00:00.000Z', // events created after this are "new"
  pollsAt: '2026-11-11T08:00:00.000Z',
  discussions: { '12': '2026-11-10T19:20:00.000Z' },
  dismissed: ['discussion:12'] // optional "mark all read" until a newer post
}
```

All writes go through one module (`src/lib/notifications.ts`) so the storage shape can be
migrated later. Keep it small and versioned (`version` field) and never store user content.

### 4.3 Data flow

```
useNotifications()                        (src/features/notifications/useNotifications.ts)
  ├── useQuery(['discussions','withNew'],  stale 30 s, refetch 60 s)   ← shared key with Chat
  ├── useQuery(['events','latest-created'], limit 20, refetch 120 s)   ← new, lightweight
  ├── useQuery(queryKeys.menuPolls(),       refetch 120 s)             ← shared key with Polls
  └── reads the pending-events cache from EventsPage when available
        ↓
  buildNotifications({ discussions, events, polls, pending, seen, me })  (pure, unit-testable)
        ↓
  { items: NotificationItem[], unreadCount }
```

- `refetchInterval: 60_000`, and rely on TanStack's default pause while the tab is hidden;
  the existing `visibilitychange` revalidation refreshes the session on return.
- Reuse query keys that other screens already use so switching screens costs nothing.
- Whole feature is client-only; no new API calls in the critical path beyond the small
  `/events` query.

### 4.4 UI

- **Bell** (header, already rendered): badge with `unreadCount`, `aria-label` "Notifikace
  (N)", `aria-expanded`; opens a dropdown on `md+`, a full-width sheet under the header on
  phones.
- **Item**: type icon (`chat`, `calendar`, `poll`, `clock`), title, one-line subtitle
  (discussion caption / event date+place / poll caption), relative time, chevron. Click →
  navigate + mark read. The whole row is a button, not a nested link.
- **Footer**: "Označit vše jako přečtené" and a hint when there is nothing new.
- **Empty state**: check icon, "Žádné nové notifikace".
- Reuse the layout's outside-click/Escape handling (`data-toggle` attribute!) and the
  existing `.header-btn`, `.badge`, tokens. Dark mode and text size work automatically.
- i18n: every string through `tr()`; English labels included.

### 4.5 Rights, privacy, edge cases

- `discussions/withNew` only returns discussions the user may read — no extra filtering.
- `polls/menu` is already the public/open poll list.
- Events: hide items the user `canView: false`.
- Don't notify about your own actions (own posts bump `newPosts`? the server excludes own
  posts from `newPosts` — verify; own events are filtered by `createdUserId`).
- First run: initialise `eventsAt`/`pollsAt` to "now" so a fresh install is not flooded.

### 4.6 Tests

- Unit (Vitest): `buildNotifications()` with fixtures — new posts, unseen event, own event,
  voted poll, pending attendance window, empty state, malformed `created`.
- Storage: read/write/migrate `tymy:notifications:seen`.
- Browser smoke (headless Edge + mocked API, same harness as the other checks): badge
  count, opening the dropdown, click-through marks read, reload keeps state, mobile sheet.

### 4.7 Files (planned)

```
src/lib/notifications.ts              state, ids, buildNotifications()
src/features/notifications/           NotificationsMenu.tsx, useNotifications.ts
src/features/layout/Layout.tsx        bell -> menu + badge
src/lib/i18n.ts                       new strings
src/lib/queryClient.ts                query keys for the lightweight source
```

### 4.8 Acceptance criteria

- Bell shows the correct count within 60 s of new data, and 0 after "mark all read".
- Opening a discussion from the menu clears its badge (locally and after refetch).
- Works in light/dark, CZ/EN, normal/large text, 390 px and 1280 px.
- No request to `events/withMyAttendance` for notifications.
- No console errors; offline shows the last known list.

---

## 5. Phase 2 — server feed + Web Push (needs API work)

### 5.1 Proposed API contract

```
GET    /notifications?since=ISO&limit=50
       → { data: [{ id, type, title, body, url, createdAt, read }] }
POST   /notifications/read        { ids: number[] } | { until: ISO }
GET    /notifications/state       → { unread: number }        (cheap badge poll)
POST   /push/subscriptions        { endpoint, keys: { p256dh, auth }, userAgent }
DELETE /push/subscriptions        { endpoint }
PUT    /user/{id}/notifications   { newPosts: bool, newEvents: bool, attendance: bool, push: bool }
```

- Notifications are per user **and** per team (host/subdomain).
- Type codes: `discussion_post`, `event_created`, `event_changed`, `poll_opened`,
  `attendance_reminder`, `post_reply`.
- `url` is app-relative (`/discussions/12`) so the SW can open/focus the right screen.

### 5.2 Push pipeline

1. Client: enable in settings → `Notification.requestPermission()` **on a user gesture** →
   `subscribeToPush()` (exists) → `POST /push/subscriptions`.
2. Server: store subscription per user/team; on a trigger, render the payload and send with
   VAPID (`web-push` or equivalent); drop subscriptions on `404/410`.
3. Service worker: `push` → `showNotification(title, { body, icon, badge, data: { url } })`;
   `notificationclick` → focus an existing window or `clients.openWindow(url)`.
   (Workbox `generateSW` needs `importScripts` or a custom SW entry.)
4. Payload stays minimal (title/body/url/tag); no personal data beyond what the item shows.

### 5.3 Security / operations

- VAPID key pair per deployment; public key exposed as `VITE_VAPID_PUBLIC_KEY`; private key
  only on the server.
- Subscriptions belong to the authenticated user — bind them to the session, never to a
  cookie stored in a queue.
- Team isolation: a subscription is only addressable for the team it was created under.
- Rate-limit subscriptions per user; expire stale endpoints; cap notifications per event
  (e.g. one per discussion per 5 min).

### 5.4 Rejected alternative

A Cloudflare Worker cron that polls Tymy with stored user sessions would require keeping
`PHPSESSID` values server-side — unacceptable. Push must be sent by (or with) the Tymy
backend.

### 5.5 Platform caveats

- iOS Safari supports Web Push only for **installed** PWAs (16.4+) — the install prompt
  matters.
- Permission must be requested from a user gesture after explaining the benefit.
- Test matrix: Android Chrome, iOS installed PWA, desktop Chrome/Edge/Firefox, in-app
  browser (no push).

---

## 6. Roadmap

1. **Verify the open questions** (§2) in the dev.tymy.cz discussion; adjust Phase 1 rules
   if the server already tracks read state.
2. **Phase 1**: `notifications.ts` + hook + menu + badge + tests (≈1–1.5 days).
3. **Phase 2 client**: settings wiring, permission flow, SW handlers, subscription API
   calls (≈1 day).
4. **Phase 2 server**: notifications table, read endpoints, triggers, VAPID sender,
   subscription endpoints (vendor, ≈2–3 days).
5. Rollout: Phase 1 immediately; Phase 2 behind a build flag, enabled after the server
   endpoints exist.

## 7. Risks

- `newPosts` semantics are the only server-side "unread" signal — if reading a discussion
  doesn't reset it, Phase 1 needs its own high-water mark per discussion.
- `event.created` may be missing on older records → those events appear "new" once; the
  `eventsAt` initialisation mitigates it.
- Poll "waiting for your vote" items are attention items, not events — keep them out of the
  badge count so it does not look permanently unread.
- Push depends entirely on server work; Phase 1 must not pretend to notify when the app is
  closed.

## 8. Sources

- `tymy.apib` — no notification/push/webhook endpoint; poll votes/attendance/discussion
  payloads quoted in §2.
- `docs/SESSION_STATE.md` — verified endpoints, data quirks, `newPosts` note.
- `src/lib/pwa.ts` — existing permission/subscription scaffolding.
- `src/features/layout/Layout.tsx` — bell placement and menu patterns.
- dev.tymy.cz discussion board — **not accessible from this environment**; §2 lists the
  exact questions to resolve there.
