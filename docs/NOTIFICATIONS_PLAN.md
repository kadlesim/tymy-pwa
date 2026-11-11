# Notifications — implementation plan

> **Status: implemented (phases 1 + 2).** The bell now lists derived notifications and the
> app can subscribe to Web Push (settings button / bell footer). What remains is server-side
> polish (feed/read state, badge, prefs, poll triggers) — see §3 and §6.

This plan was revised after reading the **dev.tymy.cz discussions** (account supplied by the
owner) and the **open-source server** (`github.com/KminekMatej/tymy`, branch `develop`).
The important correction to the first draft: **the server-side Web Push backend already
exists and works** — no vendor work is needed to send browser notifications. What is
missing on our side is the client (subscription + service worker), and what is missing on
the server is an in-app feed / read state (optional).

---

## 1. Summary

| Phase | Scope | Backend | Effort |
|---|---|---|---|
| **1. Bell + derived feed** | Badge/menu for "what's new for me" from existing endpoints; seen-state in `localStorage` | none | ~1–1.5 days |
| **2. Web Push** | Register for push, post the subscription, handle `push`/`notificationclick` in the SW, deep links | **already exists** | ~0.5–1 day |
| **3. Optional server upgrades** | Notification history/read state, badge count, per-user prefs, poll/attendance triggers, unsubscribe | vendor | 1–3 days |

Phase 2 is the real "notifications" and can ship without any server change. Phase 1 gives
the bell a meaning while the app is open (push has no history: nothing to list).

---

## 2. Verified backend contract (dev.tymy.cz, 2026-11-11)

### 2.1 Endpoints

All secured (`SecuredPresenter`), POST only (GET → `405 {"status":"ERROR","statusMessage":"E405"}`).

| Endpoint | Body | Behaviour |
|---|---|---|
| `POST /api/push-notification` | the **raw `PushSubscription` JSON** (`endpoint`, `expirationTime`, `keys.p256dh`, `keys.auth`) | Stores/returns a `WEB` subscriber for the logged-in user (200 existing, 201 created) |
| `POST /api/push-notification/fcm` | bare JSON **string** `deviceId` | Stores an `FCM` subscriber (native Android) |
| `POST /api/push-notification/apple` | bare JSON **string** `deviceId` | Stores an `APNS` subscriber (native iOS) |

- Subscriber table `push_notification`: `id`, `created`, `type` (`WEB|APNS|FCM`), `user_id`,
  `subscription` (web subscription JSON or device id).
- **No** `GET /notifications`, no read flags, no `/subscriptions` list, no DELETE route.
  Expired web subscriptions are deleted automatically when a send fails
  (`PushNotificationManager::processReport`).
- The web subscription is tied to the **user**, not to a team; teams are resolved when the
  recipients are computed (rights per team).

### 2.2 VAPID

- Public key (identical on `dev.tymy.cz` and `pd.tymy.cz`, read from their
  `/public/service-worker.js`):
  `BNFwVh2n9jBpGDMx3Kiz47ldm8GrSP74Ff4VL54v6AoPg01BnT2TtqdEXBm6M7C8Nx3PoqqPie7kESKgm8jkAog`
- Private key lives in the server config (`%web-push%`, `Minishlink\WebPush`); it is public
  information only as the key above.

### 2.3 Push payload

`PushNotification::jsonSerialize()` sends:

```json
{
  "userId": 14,          // the actor (author of the post / event change)
  "teamId": 522,
  "title": "Frankie posted in Oznámení",
  "message": "first 512 chars of the post",
  "image": "https://…",   // optional incl. "imageUrl" in older docs; server sends "image"
  "url": "https://dev.tymy.cz/discussion/3-oznameni",  // optional, absolute legacy URL
  "badge": 8             // optional; not populated yet (field exists, never set)
}
```

- `type` and `params` (discussionId) exist on the model but are **not serialised** — the
  client only gets the fields above.
- `message` is truncated at 512 chars because of the Web Push payload limit.

### 2.4 What triggers a notification (server code)

| Trigger | Recipients | Title / message | `url` |
|---|---|---|---|
| New discussion post (`PostManager`) | users with read access to the discussion, **author excluded** | "X posted in Y" / post excerpt | `/discussion/{webName}` |
| Event created (`EventManager`) | **players** among users allowed to view the event, author excluded | "X created new event" / "caption on date" | `/event/{webName}` |
| Event deleted | players allowed to view, author excluded | "X deleted event" / caption | `/event` |
| Event `startTime` changed | users allowed to view, author excluded | "X changed event time" / "starts on … (previously …)" | `/event/{webName}` |

- Sending is **synchronous** in the request (no queue, no retry beyond the `web-push`
  flush); a failure is logged.
- **No poll, attendance, comment-on-my-post or mention notifications.**
- Discussions where the user cannot read never reach them; event recipients honour
  `canView`/player status.
- `getAllowedReaders` is per team, so the global subscriber table does not leak across
  teams for these four triggers.

### 2.5 What the legacy web app does (for reference)

- `public/js/main.js`: registers `/public/service-worker.js` on every page and requests
  notification permission **on page load** (no explanation).
- `public/service-worker.js`: subscribes on SW `activate` with the VAPID key below, then
  `POST /api/push-notification` with the subscription JSON; handles `push` with
  `showNotification(title, {body: payload.message, icon, image: payload.image, badge})`.
- **No `notificationclick` handler** (commented out) → clicking a notification does nothing.
  The payload now contains `url`, so a click handler would work today.

### 2.6 What the discussions established

| Post | Date | Takeaway |
|---|---|---|
| #3 / 736 | 2021-11-17 | DEV release with Web Push; VAPID public key published; only new discussion posts at first |
| #1 / 737 | 2021-11-20 | Settings section restored; push can be tried on DEV |
| #3 / 738–741 | 2021-11-21/23 | Native apps use Firebase/APNS; topics/keys discussed |
| #1 / 742 | 2021-11-26 | Per-user notification settings explicitly planned as "step 2" (not done); WebPush currently notifies every accessible discussion post |
| #1 / 744 | 2021-12-05 | FCM device registration endpoint `POST api/push-notification/fcm` |
| #3 / 830 | 2022-09-16 | 2.4 added event create/update/delete notifications and fixed a broken SW path that stopped web notifications |
| #1 / 752 | 2021-12-28 | iOS side "mostly functional" at that time |

Everything above was confirmed in the code (`app/module/push-notification/*`,
`PostManager.php`, `EventManager.php`) — the discussions and the implementation agree.

---

## 3. What is still missing (and worth asking upstream)

1. **No notification feed / read state** — push only. The bell cannot show history or an
   unread count from the server; `badge` is never set.
2. **No per-user notification settings** — neither the web settings page nor the API has
   them (Profile → Notifikace in our app is a placeholder).
3. **No unsubscribe endpoint** — local `pushManager.unsubscribe()` is possible, but the
   row stays until the next failed send. Important when a *different* user logs in on the
   same browser.
4. **No poll/attendance notifications.**
5. **No `type`/`id` in the payload** — only `title`, `message`, `image?`, `url?`, so the
   client must infer routing from `url` (see §5.3).
6. **No badge count** — `badge` exists in the model but is never populated.
7. **Multi-team filtering** — the payload carries `teamId` and an absolute `url` with the
   team host, but the client has no team id in `user`.

A small upstream proposal is in §6.

---

## 4. Phase 1 — bell + derived feed (client only)

Same design as the first draft; now complementary to push (push has no history).

### 4.1 Sources

| Type | Source | Rule | Link |
|---|---|---|---|
| `discussion` | `discussions/withNew` | `newPosts > 0` | `/discussions/{id}` |
| `event` | `GET /events?order=created__desc&limit=20` | `created > eventsAt` and not mine | `/events/{id}` |
| `poll` | `polls/menu` | `OPENED && !voted` (attention, not unread) or `createdAt > pollsAt` | `/polls/{id}` |
| `attendance` | pending-events query | `closeTime - now < 48 h`, no own `preStatus`, max 3 | `/events/{id}` |

Avoid `events/withMyAttendance` (heavy). Unread = discussion `newPosts` + unseen events +
unseen polls; attendance items are "to do".

### 4.2 State and hook

`tymy:notifications:seen` (versioned): `eventsAt`, `pollsAt`, `discussions{id:ISO}`,
`dismissed[]`. One module `src/lib/notifications.ts` + `useNotifications()` (60 s
`refetchInterval`, reuses existing query keys). Pure `buildNotifications()` for unit tests.

### 4.3 UI

Bell badge + dropdown (desktop) / sheet (mobile), item icons, relative time, deep link,
"mark all read", empty state, i18n, dark mode. Reuse the layout's outside-click/Escape
handling.

### 4.4 Acceptance

- Badge updates within 60 s; opening a discussion clears it (locally + server `newPosts`).
- No `withMyAttendance` requests; no console errors; offline shows last state.

---

## 5. Phase 2 — Web Push client (uses the existing backend)

### 5.1 Subscription flow (from the page, not the SW)

1. Settings → Notifikace (or a bell-menu entry) explains the benefit; a **button** requests
   permission (never on page load, unlike the legacy app).
2. `navigator.serviceWorker.ready` → `pushManager.getSubscription()`; reuse if present.
3. Otherwise `subscribe({ userVisibleOnly: true, applicationServerKey: <VAPID> })`.
4. `POST /api/push-notification` through the app's API client with the **raw subscription
   JSON** as the body (`request('/push-notification', {method:'POST', body: JSON.stringify(sub)}`) —
   our client adds `X-Session-Key`, the Pages Function turns it into the cookie.
5. Persist `tymy:push:enabled` and the subscription endpoint for the UI state.

Note: our service worker **cannot read `localStorage`**, so the subscription must be posted
from the page (the legacy app does it in the SW only because it relies on cookies).

### 5.2 Service worker

`vite-plugin-pwa` is currently in `generateSW` mode. Options:

- keep `generateSW` and add `workbox.importScripts: ['push-sw.js']` (a small hand-written SW
  with `push`/`notificationclick`), or
- switch to `injectManifest` with a custom `src/sw.ts` (more control, keeps precache).

Handlers:

```js
self.addEventListener('push', event => {
  const payload = event.data?.json() ?? {}
  event.waitUntil(self.registration.showNotification(payload.title ?? 'tymy.cz', {
    body: payload.message ?? '',
    icon: '/icons/icon-192.png',
    image: payload.image,
    badge: '/favicon-32.png',
    data: { url: payload.url ?? '/' },
    tag: payload.url ?? undefined
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = toAppUrl(event.notification.data?.url)
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of clients) {
      await client.focus()
      return client.navigate(url)
    }
    return self.clients.openWindow(url)
  })())
})
```

### 5.3 Deep links

`url` is an absolute **legacy web** URL: `https://dev.tymy.cz/discussion/3-oznameni` or
`…/event/57-caption`. Map by path:

| Legacy path | PWA route |
|---|---|
| `/discussion/{id}-…` | `/discussions/{id}` |
| `/event/{id}-…` | `/events/{id}` |
| `/event` or `/event/` | `/events` |
| anything else | `/events` |

Only the path matters — the host is the team vhost, while the PWA may run on
`tymy-pwa.pages.dev`. Ignore `teamId` for now (see §3.7).

### 5.4 Logout / user switch

Without a DELETE endpoint:

- On logout, call `pushManager.unsubscribe()` and clear `tymy:push:enabled`, so the next
  user on that browser is not subscribed to the previous user's pushes (the server row stays
  until a failed send).
- On login, the notification UI offers to re-subscribe.

This is a behaviour decision: alternatively keep the subscription and let the server prune
it when the push fails (bad for shared devices). Recommend unsubscribe on logout.

### 5.5 Testing

- Desktop Chrome/Edge: DevTools → Application → Service Workers → "Push" with the payload
  JSON; or `web-push send-notification` with the subscription and VAPID keys.
- Real end-to-end: log in on DEV, enable push, have another account post in a discussion
  (do **not** post as the same user — the author is excluded).
- Android Chrome + iOS installed PWA (16.4+), light/dark icon rendering.
- Verify a click opens the mapped route and focuses an existing tab.

### 5.6 Acceptance

- Enabling push creates exactly one `WEB` subscriber and survives reloads (getSubscription
  reuse).
- A new post by another user produces a notification with title/message; clicking opens the
  discussion.
- Event create / time change / delete notifications arrive (server-side triggers).
- No notification for the author's own actions.
- Logout unsubscribes locally; a second login can re-enable.

---

## 6. Optional server upgrades (upstream proposal)

1. Serialise `type` and the `params` (e.g. `discussionId`) in the payload; add `badge` with
   a real unread count; include a stable `notification id`.
2. `GET /notifications` + `POST /notifications/read` (per user/team) — enables a real bell
   feed and read state.
3. `DELETE /api/push-notification/{id}` (or by endpoint) — proper unsubscribe.
4. Per-user preferences (`PUT /user/{id}/notifications`) and honouring them when sending.
5. Poll opened / attendance deadline / mention triggers.
6. Team-scope subscribers or send `teamId` + a client-visible team id, so one browser can
   filter pushes from other teams the user belongs to.
7. `notificationclick` handling in the legacy SW (it already has `url`).

---

## 7. Suggested order

1. **Phase 2 first** (0.5–1 day): it is the feature people asked for and needs no server
   changes. Ship behind the Settings toggle.
2. **Phase 1** (1–1.5 days): bell badge + derived list for when the app is open.
3. Optional upstream items, starting with payload `type`/`badge` and a DELETE route.

**Implemented in `src/`:** `lib/notifications.ts` (seen state + `buildNotifications`),
`features/notifications/` (hook, bell menu), `lib/push.ts` (subscription lifecycle),
`public/push-sw.js` (push + click handlers, merged via `workbox.importScripts`), settings
block in `Profile → Nastavení → Notifikace`. Push is unsubscribed on logout; deep links map
`/discussion/{id}-…` → `/discussions/{id}` and `/event/{id}-…` → `/events/{id}`.

## 8. Risks / caveats

- iOS Web Push works only for an **installed** PWA; the permission prompt must come from a
  user gesture.
- The subscription is per browser+user, but the server row is not tied to a device session;
  shared browsers need the logout unsubscribe.
- Push has no history: if the user misses the notification, there is nothing in the app
  (Phase 1 mitigates this).
- `message` is capped at 512 characters and the title is English-ish (server-generated).
- A staging/production PWA served from `pages.dev` gets `url`s pointing at the team host;
  route mapping ignores the host.
- The VAPID key is global; if it ever changes, every subscription must be renewed.

## 9. Sources

- dev.tymy.cz discussions (logged in): `#1` posts 737, 742, 744, 752; `#3` posts 736–741,
  830; `#2` test posts 746–751, 759; `#4` general API posts.
- `https://dev.tymy.cz/public/service-worker.js` and `/public/js/main.js` (legacy client).
- `github.com/KminekMatej/tymy` (`develop`):
  `app/module/push-notification/*`, `app/module/discussion/manager/PostManager.php`,
  `app/module/event/manager/EventManager.php`.
- Live probes: `POST /api/login`, `GET /api/push-notification*` (405 = POST-only),
  `/api/notifications` (404), `/api/user/31` (no notification fields).
