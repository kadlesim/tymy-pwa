// Google-Calendar-like month grid for events.

import { createMemo, For, Show } from 'solid-js'
import { formatDisplayTime } from '../../lib/date-filters'
import { ICONS } from '../../lib/icons'
import type { Event } from '../../lib/api'

const TYPE_COLORS: Record<string, string> = {
  TRA: 'primary',
  RUN: 'success',
  MEE: 'info',
  TOU: 'warning',
  CMP: 'danger'
}

const WEEKDAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']
const MAX_PILLS = 3

const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

/** Monday of the week containing the 1st of the month. */
function gridStart(month: Date): Date {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - offset)
  return start
}

export interface EventMonthViewProps {
  month: Date
  events: Event[]
  onOpen: (eventId: number) => void
  onMonthChange: (month: Date) => void
}

export default function EventMonthView(props: EventMonthViewProps) {
  const cells = createMemo(() => {
    const start = gridStart(props.month)
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      return date
    })
  })

  const eventsByDay = createMemo(() => {
    const map = new Map<string, Event[]>()
    for (const event of props.events) {
      const key = dayKey(new Date(event.startTime))
      const list = map.get(key) ?? []
      list.push(event)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    }
    return map
  })

  const today = new Date()
  const isToday = (date: Date) =>
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()

  const isCurrentMonth = (date: Date) =>
    date.getFullYear() === props.month.getFullYear() && date.getMonth() === props.month.getMonth()

  const shiftMonth = (delta: number) => {
    const next = new Date(props.month.getFullYear(), props.month.getMonth() + delta, 1)
    props.onMonthChange(next)
  }

  const monthLabel = () =>
    props.month.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })

  return (
    <div class="bg-elevated rounded-xl border border-border overflow-hidden">
      <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="header-btn p-1.5 rounded-md hover:bg-100"
            onClick={() => shiftMonth(-1)}
            aria-label="Předchozí měsíc"
          >
            <span class="icon" innerHTML={ICONS['chevronLeft']} />
          </button>
          <button
            type="button"
            class="header-btn p-1.5 rounded-md hover:bg-100"
            onClick={() => shiftMonth(1)}
            aria-label="Následující měsíc"
          >
            <span class="icon" innerHTML={ICONS['chevronRight']} />
          </button>
        </div>

        <h2 class="text-base font-semibold text-text capitalize">{monthLabel()}</h2>

        <button
          type="button"
          class="btn btn-secondary btn-sm"
          onClick={() => props.onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1))}
        >
          Dnes
        </button>
      </div>

      <div class="grid grid-cols-7 border-b border-border bg-50">
        <For each={WEEKDAYS}>
          {day => (
            <div class="px-1 py-1.5 text-center text-xs font-medium text-muted">{day}</div>
          )}
        </For>
      </div>

      <div class="grid grid-cols-7">
        <For each={cells()}>
          {date => {
            const dayEvents = () => eventsByDay().get(dayKey(date)) ?? []
            return (
              <div
                class="min-h-[76px] sm:min-h-[112px] p-1 border-r border-b border-border-light last:border-r-0"
                classList={{ 'bg-50': !isCurrentMonth(date) }}
              >
                <div class="flex justify-center mb-0.5">
                  <span
                    class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs"
                    classList={{
                      'bg-primary text-white font-semibold': isToday(date),
                      'text-text': !isToday(date) && isCurrentMonth(date),
                      'text-muted': !isToday(date) && !isCurrentMonth(date)
                    }}
                  >
                    {date.getDate()}
                  </span>
                </div>

                <div class="space-y-0.5">
                  <For each={dayEvents().slice(0, MAX_PILLS)}>
                    {event => {
                      const color = () => TYPE_COLORS[event.type] || 'primary'
                      return (
                        <button
                          type="button"
                          class="flex items-baseline gap-1 w-full overflow-hidden text-left text-[11px] leading-tight px-1 py-0.5 rounded-sm transition-opacity hover:opacity-80"
                          style={`background-color: var(--color-${color()}-light); color: var(--color-${color()})`}
                          title={`${formatDisplayTime(event.startTime)} ${event.caption}`}
                          onClick={() => props.onOpen(event.id)}
                        >
                          <span class="font-medium shrink-0">{formatDisplayTime(event.startTime)}</span>
                          <span class="truncate min-w-0">{event.caption}</span>
                        </button>
                      )
                    }}
                  </For>

                  <Show when={dayEvents().length > MAX_PILLS}>
                    <p class="text-[11px] text-muted px-1">
                      +{dayEvents().length - MAX_PILLS} další
                    </p>
                  </Show>
                </div>
              </div>
            )
          }}
        </For>
      </div>
    </div>
  )
}
