// Cloudflare Pages Function: same-origin proxy for avatars and uploads.
//
// An <img> cannot send the `X-Team-Subdomain` header, so `apiAssetUrl()` puts the team
// in the query string (`/user_pics/31.png?team=pd`). Everything else mirrors
// `functions/api/[[path]].ts`.

interface Env {
  TYMY_DEFAULT_TEAM?: string
}

const TEAM_PATTERN = /^[a-z0-9-]+$/

export async function onRequest(context: {
  request: Request
  env: Env
  params: { path?: string | string[] }
}): Promise<Response> {
  const { request, env, params } = context
  const url = new URL(request.url)

  const candidate = (url.searchParams.get('team') ?? env.TYMY_DEFAULT_TEAM ?? '')
    .trim()
    .toLowerCase()
  if (!TEAM_PATTERN.test(candidate)) {
    return new Response('Not found', { status: 404 })
  }

  const rest = Array.isArray(params.path) ? params.path.join('/') : (params.path ?? '')
  const upstreamUrl = new URL(`https://${candidate}.tymy.cz/user_pics/${rest}`)

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl.toString(), {
      headers: { accept: request.headers.get('accept') ?? 'image/*' },
      redirect: 'manual'
    })
  } catch {
    return new Response('Upstream unavailable', { status: 502 })
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    // Missing pictures redirect to the site 404 page — report a plain 404 so the
    // client can fall back to its generic avatar.
    return new Response('Not found', { status: 404 })
  }
  if (!upstream.ok) {
    return new Response('Not found', { status: 404 })
  }

  const headers = new Headers()
  const type = upstream.headers.get('content-type')
  if (type) headers.set('content-type', type)
  headers.set('cache-control', 'public, max-age=86400')

  return new Response(upstream.body, { status: 200, headers })
}
