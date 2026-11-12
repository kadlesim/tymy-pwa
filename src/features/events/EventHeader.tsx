import { Show } from 'solid-js'
import { ICONS } from '../../lib/icons'
import { tr } from '../../lib/i18n'
import { eventTypeCaption } from '../../lib/event-labels'
import { formatDisplayDate, formatDisplayTime, getEventStatus } from '../../lib/date-filters'
import type { Event } from '../../lib/api'
import EventLink from './EventLink'

const TYPE_COLORS: Record<string, string> = {
  TRA: 'primary',
  RUN: 'success',
  MEE: 'info',
  TOU: 'warning',
  CMP: 'danger'
}

function statusLabel(status: string): string {
  switch (status) {
    case 'upcoming': return tr('Přicházející')
    case 'open': return tr('Otevřeno pro přihlášky')
    case 'ongoing': return tr('Právě teď')
    case 'closed': return tr('Uzavřeno')
    case 'past': return tr('Minulé')
    default: return status
  }
}

export interface EventHeaderProps {
  event: Event
  canPlan: boolean
  onEdit: () => void
  onDelete: () => void
}

export default function EventHeader(props: EventHeaderProps) {
  const color = () => TYPE_COLORS[props.event.type] || 'primary'
  const iconColor = () =>
    color() === 'primary' ? 'var(--color-text)' : `var(--color-${color()})`
  const status = () => getEventStatus(props.event)
  const canEdit = () => props.canPlan && (props.event.canPlan || props.event.canPlanOthers)

  return (
    <div class="event-header mb-4">
      <div class="flex items-start justify-between gap-4 mb-5">
        <div class="flex-1">
          <div class="flex items-center gap-3 mb-2">
            <span
              class="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
              style={`background-color: var(--color-${color()}-light)`}
            >
              <span class="icon" style={`color: ${iconColor()}`} innerHTML={ICONS['calendar']} />
            </span>
            <div class="min-w-0">
              <h1 class="text-2xl font-bold text-text">{props.event.caption}</h1>
              <span
                class="badge type-badge text-xs"
                style={`background-color: var(--color-${color()}-light); color: var(--color-${color()})`}
              >
                {eventTypeCaption(props.event.type, props.event.eventType?.caption)}
              </span>
            </div>
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border-light bg-50 px-3.5 py-2.5 text-base">
            <span class="flex items-center gap-2">
              <span class="icon text-muted" innerHTML={ICONS['calendar']} />
              <span class="font-semibold text-text">
                {formatDisplayDate(props.event.startTime, { weekday: 'long' })}
              </span>
              <span class="text-text-secondary">
                {formatDisplayTime(props.event.startTime)}–{formatDisplayTime(props.event.endTime)}
              </span>
            </span>
            <Show when={props.event.place}>
              <span class="flex items-center gap-2">
                <span class="icon text-muted" innerHTML={ICONS['location']} />
                <span class="text-text">{props.event.place}</span>
              </span>
            </Show>
            <span class="badge bg-secondary-light text-secondary">{statusLabel(status())}</span>
          </div>

          <EventLink link={props.event.link} />
        </div>

        {/* Icon-only actions, shown only when the user may actually change the event. */}
        <div class="flex items-center gap-1 flex-shrink-0">
          <Show when={canEdit()}>
            <button
              type="button"
              class="header-btn p-2 rounded-md hover:bg-100"
              onClick={props.onEdit}
              title={tr('Upravit událost')}
              aria-label={tr('Upravit událost')}
            >
              <span class="icon" innerHTML={ICONS['edit']} />
            </button>
          </Show>
          <Show when={canEdit()}>
            <button
              type="button"
              class="header-btn p-2 rounded-md hover:bg-danger-light hover:text-danger"
              onClick={props.onDelete}
              title={tr('Smazat událost')}
              aria-label={tr('Smazat událost')}
            >
              <span class="icon" innerHTML={ICONS['delete']} />
            </button>
          </Show>
        </div>
      </div>

      <Show when={props.event.description}>
        <div class="event-description bg-50 rounded-lg p-4">
          <p class="text-text whitespace-pre-line">{props.event.description}</p>
        </div>
      </Show>
    </div>
  )
}
