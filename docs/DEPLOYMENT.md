# Deployment

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

## A. Git-connected project (recommended)

1. Push the repo to GitHub (it currently has no remote: `git remote add origin …`, `git push -u origin master`).
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Build settings:
   - Framework preset: *None*
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variable: `TYMY_DEFAULT_TEAM = pd` (the team this deployment serves)
4. Deploy. Every push to `master` redeploys.

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

- [ ] `/` redirects to `/team`, prefilled with the team; wrong subdomain shows
      "Tým … nebyl nalezen."
- [ ] Login works and survives a reload (session in `localStorage` + `X-Session-Key`).
- [ ] Avatars load (`/user_pics/...`) — if they 404, `TYMY_DEFAULT_TEAM` is wrong.
- [ ] Events list, month view, RSVP + note (writes go through `POST /api/attendance`).
- [ ] Chat opens on the newest message and loads older pages when scrolling up.
- [ ] Reporty → XLSX downloads a file (binary passes through the proxy).
- [ ] Reload with DevTools offline: the app shell still loads (service worker).

## Known production behaviour

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
- The Pages domain is `*.pages.dev`; add a custom domain later if the team wants one.

## Local rehearsal (what was verified)

The built bundle was run through `wrangler pages dev dist --compatibility-date=2026-11-01`
against the real team and confirmed end to end: `/` → `/team` → login → `/events` (51
events, nearest first), event detail (RSVP note, grouped attendance, 53 avatars, 0 broken),
and a reload that restores the session without the team step. Only `captions`/`loginPhp`
return 404 and a handful of users genuinely have no picture.
