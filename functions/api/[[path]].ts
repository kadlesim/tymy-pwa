// Cloudflare Pages Function: same-origin proxy for the Tymy API.
//
// The Tymy API sends no CORS headers, so the SPA cannot call it cross-origin. This
// function forwards `/api/*` to `https://<team>.tymy.cz/api/*`, converting the
// `X-Session-Key` header (set by the client from localStorage) into the `PHPSESSID`
// cookie the API actually authenticates with — the same trick the Vite dev proxy uses.
//
// Team resolution order:
//   1. `X-Team-Subdomain` request header (the /team screen sends it)
//   2. `?team=` query parameter (used by <img> tags, see /user_pics)
//   3. `TYMY_DEFAULT_TEAM` environment variable (one deployment per team)

interface Env {
  TYMY_DEFAULT_TEAM?: string
}

const TEAM_PATTERN = /^[a-z0-9-]+$/

function resolveTeam(request: Request, env: Env, url: URL): string | null {
  const fromHeader = request.headers.get('x-team-subdomain')
  const fromQuery = url.searchParams.get('team')
  const candidate = (fromHeader ?? fromQuery ?? env.TYMY_DEFAULT_TEAM ?? '').trim().toLowerCase()
  return TEAM_PATTERN.test(candidate) ? candidate : null
}

export async function onRequest(context: {
  request: Request
  env: Env
  params: { path?: string | string[] }
}): Promise<Response> {
  const { request, env, params } = context
  const url = new URL(request.url)

  const team = resolveTeam(request, env, url)
  if (!team) {
    return new Response(
      JSON.stringify({ status: 'ERROR', statusMessage: 'Missing team', data: null }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    )
  }

  const rest = Array.isArray(params.path) ? params.path.join('/') : (params.path ?? '')
  const upstreamUrl = new URL(
    `https://${team}.tymy.cz/api/${rest}${url.search}`
  )

  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)
  headers.set('accept', request.headers.get('accept') ?? 'application/json')

  // The session lives in localStorage on the client; the API wants it as a cookie.
  const sessionKey = request.headers.get('x-session-key')
  if (sessionKey) headers.set('cookie', `PHPSESSID=${sessionKey}`)

  const init: RequestInit = {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual'
  }

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl.toString(), init)
  } catch {
    return new Response(
      JSON.stringify({ status: 'ERROR', statusMessage: 'Upstream unavailable', data: null }),
      { status: 502, headers: { 'content-type': 'application/json' } }
    )
  }

  // Unknown subdomains answer with a redirect to the 404 page; treat that as "not found".
  if (upstream.status >= 300 && upstream.status < 400) {
    return new Response(
      JSON.stringify({ status: 'ERROR', statusMessage: 'Team not found', data: null }),
      { status: 404, headers: { 'content-type': 'application/json' } }
    )
  }

  const responseHeaders = new Headers()
  const upstreamType = upstream.headers.get('content-type')
  if (upstreamType) responseHeaders.set('content-type', upstreamType)
  responseHeaders.set('cache-control', 'no-store')

  // Binary payloads (XLSX exports) are streamed through untouched.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders
  })
}
