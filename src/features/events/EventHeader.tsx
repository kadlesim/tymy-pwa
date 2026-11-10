import { Show } from 'solid-js'
import { ICONS } from '../../lib/icons'
import { formatDisplayDate, formatDisplayTime, getEventStatus } from '../../lib/date-filters'
import type { Event } from '../../lib/api'

const TYPE_COLORS: Record<string, string> = {
  TRA: 'primary',
  RUN: 'success',
  MEE: 'info',
  TOU: 'warning',
  CMP: 'danger'
}

function statusLabel(status: string): string {
  switch (status) {
    case 'upcoming': return 'Přicházející'
    case 'open': return 'Otevřeno pro přihlášky'
    case 'ongoing': return 'Právě teď'
    case 'closed': return 'Uzavřeno'
    case 'past': return 'Minulé'
    default: return status
  }
}

export interface EventHeaderProps {
  event: Event
  canPlan: boolean
  onDelete: () => void
}

export default function EventHeader(props: EventHeaderProps) {
  const color = () => TYPE_COLORS[props.event.type] || 'primary'
  const status = () => getEventStatus(props.event)

  return (
    <div class="event-header mb-4">
      <div class="flex items-start justify-between gap-4 mb-5">
        <div class="flex-1">
          <div class="flex items-center gap-3 mb-2">
            <span
              class="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
              style={`background-color: var(--color-${color()}-light)`}
            >
              <span class="icon" style={`color: var(--color-${color()})`} innerHTML={ICONS['calendar']} />
            </span>
            <div class="min-w-0">
              <h1 class="text-2xl font-bold text-text">{props.event.caption}</h1>
              <span
                class="badge text-xs"
                style={`background-color: var(--color-${color()}-light); color: var(--color-${color()})`}
              >
                {props.event.eventType?.caption || props.event.type}
              </span>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-4 text-sm text-muted mt-3">
            <span class="flex items-center gap-1.5">
              <span class="icon" innerHTML={ICONS['calendar']} />
              {formatDisplayDate(props.event.startTime, { weekday: 'long' })},{' '}
              {formatDisplayTime(props.event.startTime)}–{formatDisplayTime(props.event.endTime)}
            </span>
            <Show when={props.event.place}>
              <span class="flex items-center gap-1.5">
                <span class="icon" innerHTML={ICONS['chat']} />
                {props.event.place}
              </span>
            </Show>
            <span class="badge bg-secondary-light text-secondary">{statusLabel(status())}</span>
          </div>
        </div>

        <Show when={props.canPlan}>
          <button class="btn btn-danger flex-shrink-0" onClick={props.onDelete}>
            Smazat
          </button>
        </Show>
      </div>

      <Show when={props.event.description}>
        <div class="event-description bg-50 rounded-lg p-4">
          <p class="text-text whitespace-pre-line">{props.event.description}</p>
        </div>
      </Show>
    </div>
  )
}
