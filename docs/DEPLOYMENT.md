# Deployment

**Live: <https://tymy-pwa.pages.dev>** — Cloudflare Pages, `TYMY_DEFAULT_TEAM=pd`,
deployed 2026-11-11. **The Pages project is Git-connected to
`github.com/kadlesim/tymy-pwa`: every push to `master` builds and deploys automatically**
— no manual `wrangler` step is needed for a normal release.

The app is a **static SPA** (`dist/`) that must talk to the Tymy API **same-origin**,
because the API sends no CORS headers. That is why a deploy needs two extra pieces, both
already in this repo:

| Piece | File | Purpose |
|---|---|---|
| API proxy | `functions/api/[[path]].ts` | `/api/*` → `https://<team>.tymy.cz/api/*`, turns `X-Session-Key` into `Cookie: PHPSESSID=…` |
| Asset proxy | `functions/user_pics/[[path]].ts` | `/user_pics/*?team=…` → team host (an `<img>` cannot send headers) |
| SPA fallback | `public/_redirects` | every unknown path → `index.html` (client routing) |
| Config | `wrangler.toml` | `TYMY_DEFAULT_TEAM` + `dist` as the Pages output |

They are Cloudflare **Pages Functions** — the fastest free host that can proxy. The same
two handlers port to Netlify/Vercel with minor changes if you prefer those.

---

## A. Git-connected project (in use)

The live project is already set up this way: GitHub `github.com/kadlesim/tymy-pwa`
(`master`) → Cloudflare Pages, **auto-deploy on every push to `master`**. A release is
therefore `git push origin master` (watch the build in the dashboard); nothing has to be
uploaded by hand, and `dist/` stays out of git.

Build settings configured on the Pages project:

- Framework preset: *None*
- Build command: `npm run build` (runs `tsc` first, so a type error fails the deploy)
- Build output directory: `dist`
- Environment variable: `TYMY_DEFAULT_TEAM = pd` (the team this deployment serves)

To do it again for another team: **Workers & Pages → Create → Pages → Connect to Git**,
same settings with that team's `TYMY_DEFAULT_TEAM`.

## B. From the CLI

```bash
npm run build
npx wrangler pages deploy dist --project-name tymy-pwa
```

`wrangler.toml` already points at `dist` and sets `TYMY_DEFAULT_TEAM`.

---

## One deployment per team (or map the header)

The `/team` screen stores the subdomain in `tymy:team` and sends it as `X-Team-Subdomain`;
the Pages Function honours that header, so a single deployment *can* serve several teams.
In practice deploys are simpler **one per team**: set `TYMY_DEFAULT_TEAM` and leave the
team field prefilled. Cross-team API calls are impossible anyway (cookies + no CORS).

---

## After the first deploy — checklist

Verified from outside on 2026-11-11: `/` and `/team` answer 200 (SPA fallback serves
`index.html`), `/api/eventTypes` with `X-Team-Subdomain: pd` answers `401 Unauthorized`
(the function reached the team's API without a session) and an unknown subdomain answers
`404 Team not found` (the upstream 302 is turned into a plain error). The items below were
confirmed against pd through `wrangler pages dev`, but **not yet by hand on the live host**:

- [ ] `/` redirects to `/team`, prefilled with the team; wrong subdomain shows
      "Tým … nebyl nalezen."
- [ ] Login works and survives a reload (session in `localStorage` + `X-Session-Key`).
- [ ] Avatars load (`/user_pics/...`) — if they 404, `TYMY_DEFAULT_TEAM` is wrong.
- [ ] Events list, month view, RSVP + note (writes go through `POST /api/attendance`).
- [ ] Chat opens on the newest message and loads older pages when scrolling up.
- [ ] Reporty → XLSX downloads a file (binary passes through the proxy).
- [ ] Reload with DevTools offline: the app shell still loads (service worker).
- [ ] Notifications: Profile → Nastavení → Notifikace → "Zapnout notifikace" prompts for
      permission and registers a subscription; a push from **another account** (new post,
      event create/reschedule/delete) appears and clicking it opens the mapped route.
      DevTools → Application → Service Workers must show the worker importing `push-sw.js`.
      iOS only pushes to an installed PWA; Firefox private windows block service workers.

## Known production behaviour

- Browser push is sent by the Tymy server itself (VAPID key is global, same on dev/pd); the
  client only stores the subscription. Push history/read state does not exist server-side —
  the bell derives unread items itself. The author of a post/event is never notified.
- The API host has no `/captions` endpoint, and `/loginPhp` answers with a redirect; both
  are called only in production builds and fail silently (built-in Czech captions are used).
- `/api/*` is **not** cached by the service worker (`NetworkOnly`) — a stale session or
  stale RSVPs would be worse than an extra round-trip.
- Missing pictures redirect to `www.tymy.cz/404.html` upstream; the function turns that
  into a plain 404 so the UI can show its generic avatar glyph.
- The events payload is heavy (each event embeds its full attendance, ~11 kB): pd's
  upcoming tab is ~550 kB and takes a few seconds over a slow link. If that hurts, the
  follow-up is to request fewer events per tab or deny-list the embedded attendance.
- After deploying a new build the old service worker may serve the previous bundle once;
  a hard reload clears it.
- The Pages domain is `*.pages.dev` (this deployment: `tymy-pwa.pages.dev`); add a custom
  team domain later if wanted. It must stay same-origin with the API, i.e. proxied through
  the Pages Functions rather than pointed straight at the upstream host.

## Local rehearsal (what was verified)

The built bundle was run through `wrangler pages dev dist --compatibility-date=2026-11-01`
against the real team and confirmed end to end: `/` → `/team` → login → `/events` (51
events, nearest first), event detail (RSVP note, grouped attendance, 53 avatars, 0 broken),
and a reload that restores the session without the team step. Only `captions`/`loginPhp`
return 404 and a handful of users genuinely have no picture.
