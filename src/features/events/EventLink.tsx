import { Show } from 'solid-js'
import { ICONS } from '../../lib/icons'
import { tr } from '../../lib/i18n'

export interface EventLinkProps {
  link?: string
}

/** Short readable form of the URL: host + path, without the scheme. */
function shortLink(link: string): string {
  try {
    const url = new URL(link)
    const path = decodeURIComponent(url.pathname).replace(/\/$/, '')
    const text = `${url.host}${path === '/' ? '' : path}`
    return text.length > 64 ? `${text.slice(0, 61)}…` : text
  } catch {
    return link.length > 64 ? `${link.slice(0, 61)}…` : link
  }
}

export default function EventLink(props: EventLinkProps) {
  return (
    <Show when={props.link}>
      <a
        href={props.link}
        target="_blank"
        rel="noopener noreferrer"
        class="event-link inline-flex items-center gap-1.5 text-primary hover:underline text-sm mt-2 max-w-full"
        title={props.link}
        aria-label={tr('odkaz')}
      >
        <span class="icon-sm flex-shrink-0" innerHTML={ICONS['link']} />
        <span class="truncate">{shortLink(props.link!)}</span>
      </a>
    </Show>
  )
}
