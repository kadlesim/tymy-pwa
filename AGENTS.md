# AGENTS.md — project instructions

Tymy PWA: SolidJS + Vite SPA for a sports team, built on the Tymy REST API.
Read **`docs/SESSION_STATE.md`** first — it holds the current status, the verified
backend contract, open tasks, and a list of pitfalls already hit.

## Commands

```bash
npm install
npm run dev        # http://localhost:3000, proxies /api + /user_pics to dev.tymy.cz
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build to dist/
npm run icons      # regenerate placeholder PNG icons
```

Always finish a change with `npm run typecheck` and `npm run build`.

## Rules

- **Backend:** `https://dev.tymy.cz/api`, HTTPS only, no CORS. Never call it directly
  from the browser; go through the dev proxy (`vite.config.ts`) or a same-origin proxy
  in production.
- **Auth:** login is `POST /login` **form-urlencoded**; the session is the `PHPSESSID`
  cookie (`sessionKey`). `X-TSID`/query keys do **not** work. The dev proxy maps an
  `X-Session-Key` header to that cookie.
- **Errors:** the server message is in `statusMessage`, not `message`.
- **No `myAttendance`:** derive the current user's RSVP from
  `event.attendance.find(a => a.userId === me)?.preStatus`.
- **Keep `noEmit: true`** in `tsconfig.json`; emitted JS would shadow the TS sources.
  Delete any generated `vite.config.js`.
- **Do not commit credentials** or tokens. The test account password lives outside the
  repo.
- **Edits:** use the editor tools. Do not rewrite files with PowerShell
  (`Get-Content | Set-Content`) — it corrupts Czech UTF-8 text.
- **Tailwind:** no dynamically built class names (`bg-${x}`); use inline styles with the
  CSS variables from `src/index.css` for API-provided colours.
- **Solid Query:** pass options as an accessor (`useQuery(() => ({ … }))`); never
  destructure the result. Mutation context is the 4th generic.
- **Router (0.14):** `A` instead of `NavLink`, nested routes via `props.children`,
  `Navigate` uses `href`.
- **Styling:** Tailwind utilities + component classes (`.btn`, `.input`, `.badge`,
  `.label`, `.icon`) defined at the end of `src/index.css`.
- **Keep `docs/SESSION_STATE.md` up to date** when you change architecture, verify a new
  endpoint, or close an open item.

## Layout of the code

`src/lib` = infrastructure (api, auth, query client, pwa, bbcode, types).
`src/features/<area>` = one folder per product area, with page + sub-components.
`src/app.tsx` = routes and auth guards. `src/features/layout/Layout.tsx` = app shell and
navigation.
