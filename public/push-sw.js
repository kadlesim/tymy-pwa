// Web Push handlers, imported by the generated Workbox service worker
// (vite.config.ts → workbox.importScripts). The server payload is
// { userId, teamId, title, message, image?, url?, badge? }; `url` is the legacy web URL.

self.addEventListener('push', event => {
  let payload = {}
  if (event.data) {
    try {
      payload = event.data.json()
    } catch {
      payload = { message: event.data.text() }
    }
  }

  const title = payload.title || 'tymy.cz'
  const options = {
    body: payload.message || '',
    icon: '/icons/icon-192.png',
    badge: '/favicon-32.png',
    data: { url: payload.url || '/' },
    tag: payload.url || title
  }
  if (payload.image) options.image = payload.image
  if (payload.badge) options.badge = payload.badge

  event.waitUntil(self.registration.showNotification(title, options))
})

/** Maps a legacy web URL (e.g. /discussion/3-oznameni) to the SPA route. */
function toAppUrl(raw) {
  try {
    const url = new URL(raw, self.location.origin)
    let match = url.pathname.match(/^\/discussion\/(\d+)/)
    if (match) return `/discussions/${match[1]}`
    match = url.pathname.match(/^\/event\/(\d+)/)
    if (match) return `/events/${match[1]}`
    return '/events'
  } catch {
    return '/events'
  }
}

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const data = event.notification.data || {}
  const target = toAppUrl(data.url)

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) return client.navigate(target)
          return undefined
        }
      }
      return self.clients.openWindow(target)
    })()
  )
})
