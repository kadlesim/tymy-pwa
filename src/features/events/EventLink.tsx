import { Show } from 'solid-js'
import { ICONS } from '../../lib/icons'
import { tr } from '../../lib/i18n'

export interface EventLinkProps {
  link?: string
}

export default function EventLink(props: EventLinkProps) {
  return (
    <Show when={props.link}>
      <a
        href={props.link}
        target="_blank"
        rel="noopener noreferrer"
        class="event-link inline-flex items-center gap-2 text-primary hover:underline text-sm"
      >
        <span class="icon" innerHTML={ICONS['chat']} />
        {tr('Otevřít odkaz')}
      </a>
    </Show>
  )
}
