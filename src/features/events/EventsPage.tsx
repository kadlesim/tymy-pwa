// Events page - list with filtering and optimistic RSVP

import { createSignal, createMemo, For, Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/solid-query'
import {
  getEventsWithMyAttendance,
  getEventTypes,
  setAttendance,
  type Event,
  type EventType,
  type AttendanceStatus,
  type EventsQueryOptions
} from '../../lib/api'
import { queryKeys, invalidateEvents } from '../../lib/queryClient'
import { useCommonCaptions } from '../../lib/captions'
import { useAuth } from '../../lib/auth'
import { formatDisplayDate, formatDisplayTime, getEventStatus } from '../../lib/date-filters'
import { ICONS } from '../../lib/icons'
import { STATUS_COLORS, STATUS_LABELS } from './constants'

type EventFilter = 'upcoming' | 'past' | 'my'

const TYPE_ICON: Record<string, string> = {
  TRA: 'calendar',
  RUN: 'calendar',
  MEE: 'calendar',
  TOU: 'calendar',
  CMP: 'calendar'
}

const TYPE_COLOR: Record<string, string> = {
  TRA: 'primary',
  RUN: 'success',
  MEE: 'info',
  TOU: 'warning',
  CMP: 'danger'
}

export default function EventsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const auth = useAuth()
  const { tEvents, tCommon } = useCommonCaptions()

  const [filter, setFilter] = createSignal<EventFilter>('upcoming')
  const [selectedType, setSelectedType] = createSignal<string>('all')

  // Per-tab server-side queries keep payloads small and results accurate.
  const eventQueryOptions = (): EventsQueryOptions => {
    const now = new Date()
    switch (filter()) {
      case 'upcoming':
        return { filters: [{ field: 'startTime', operator: '>=', value: now }], order: 'startTime' }
      case 'past':
        return {
          filters: [{ field: 'endTime', operator: '<', value: now }],
          order: 'startTime__desc',
          limit: 40
        }
      case 'my':
      default:
        return { order: 'startTime__desc', limit: 60 }
    }
  }

  const eventsQuery = useQuery<Event[], Error>(() => ({
    queryKey: queryKeys.eventsWithAttendance(filter()),
    queryFn: () => getEventsWithMyAttendance(eventQueryOptions()),
    staleTime: 1000 * 60 * 2
  }))

  const eventTypesQuery = useQuery<EventType[], Error>(() => ({
    queryKey: queryKeys.eventTypes(),
    queryFn: getEventTypes,
    staleTime: 1000 * 60 * 60
  }))

  const rsvpMutation = useMutation<
    void,
    Error,
    { eventId: number; status: string },
    { previous?: Event[]; key?: readonly unknown[] }
  >(() => ({
    mutationFn: ({ eventId, status }) =>
      setAttendance([
        {
          userId: auth().user?.id ?? 0,
          eventId,
          preStatus: status,
          preDescription: ''
        }
      ]),
    onMutate: async ({ eventId, status }) => {
      const key = queryKeys.eventsWithAttendance(filter())
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Event[]>(key)
      queryClient.setQueryData<Event[]>(key, old =>
        (old ?? []).map(e =>
          e.id === eventId
            ? {
                ...e,
                myAttendance: {
                  userId: auth().user?.id ?? 0,
                  eventId,
                  preStatus: status,
                  preDescription: '',
                  preUserMod: 0,
                  preDatMod: new Date().toISOString()
                }
              }
            : e
        )
      )
      return { previous, key }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous && ctx.key) {
        queryClient.setQueryData(ctx.key, ctx.previous)
      }
    },
    onSettled: () => {
      invalidateEvents()
    }
  }))

  const eventTypes = () => eventTypesQuery.data ?? []
  const events = () => eventsQuery.data ?? []

  const statusOptionsFor = (event: Event): AttendanceStatus[] => {
    const type = eventTypes().find(t => t.code === event.type)
    return type?.preStatusSet ?? []
  }

  // The API has no `myAttendance`; derive it from the attendance array.
  const myStatusOf = (event: Event): string | undefined =>
    event.myAttendance?.preStatus ??
    event.attendance?.find(a => a.userId === auth().user?.id)?.preStatus ??
    undefined

  const filteredEvents = createMemo(() => {
    // Date windows are applied server-side; only type and "mine" are client-side.
    let result = [...events()]

    if (filter() === 'my') {
      result = result.filter(e => !!myStatusOf(e))
    }

    if (selectedType() !== 'all') {
      result = result.filter(e => e.type === selectedType())
    }

    return result
  })

  const groupedEvents = createMemo(() => {
    const groups = new Map<string, Event[]>()
    for (const event of filteredEvents()) {
      const key = formatDisplayDate(event.startTime, { weekday: 'long', day: 'numeric', month: 'long' })
      const arr = groups.get(key) ?? []
      arr.push(event)
      groups.set(key, arr)
    }
    return Array.from(groups.entries()).map(([date, dayEvents]) => ({ date, events: dayEvents }))
  })

  return (
    <div class="events-page">
      <div class="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 class="text-xl font-semibold text-text">{tEvents('title')}</h1>

        <div class="flex flex-wrap items-center gap-2">
          <div class="flex gap-1 bg-100 rounded-lg p-1" role="tablist">
            <For each={[
              { value: 'upcoming' as EventFilter, label: tEvents('upcoming') },
              { value: 'past' as EventFilter, label: tEvents('past') },
              { value: 'my' as EventFilter, label: tEvents('myEvents') }
            ]}>
              {(tab) => (
                <button
                  role="tab"
                  aria-selected={filter() === tab.value}
                  class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                  classList={{
                    'bg-white text-primary shadow-sm': filter() === tab.value,
                    'text-text-secondary hover:text-text': filter() !== tab.value
                  }}
                  onClick={() => setFilter(tab.value)}
                >
                  {tab.label}
                </button>
              )}
            </For>
          </div>

          <select
            class="input py-2 px-3 text-sm"
            value={selectedType()}
            onChange={e => setSelectedType(e.currentTarget.value)}
          >
            <option value="all">Všechny typy</option>
            <For each={eventTypes()}>
              {(type) => <option value={type.code}>{type.caption}</option>}
            </For>
          </select>
        </div>
      </div>

      <Show
        when={!eventsQuery.isPending}
        fallback={
          <div class="flex items-center justify-center h-64">
            <div class="flex flex-col items-center gap-4">
              <span class="icon icon-lg text-muted animate-spin" innerHTML={ICONS['spinner']} />
              <p class="text-muted">{tCommon('loading')}</p>
            </div>
          </div>
        }
      >
        <Show
          when={!eventsQuery.isError}
          fallback={
            <div class="text-center p-8">
              <p class="text-danger mb-4">Chyba při načítání událostí.</p>
              <button class="btn btn-primary" onClick={() => eventsQuery.refetch()}>
                {tCommon('retry')}
              </button>
            </div>
          }
        >
          <Show
            when={groupedEvents().length > 0}
            fallback={
              <div class="text-center py-12">
                <div class="icon icon-lg text-muted mb-3" innerHTML={ICONS['calendar']} />
                <h3 class="text-lg font-medium text-text mb-1">Žádné události</h3>
                <p class="text-muted">
                  {filter() === 'upcoming'
                    ? 'Zatím nejsou naplánované žádné události.'
                    : filter() === 'past'
                      ? 'Zatím nejsou žádné minulé události.'
                      : 'Nemáte potvrzenou účast na žádné události.'}
                </p>
                <Show when={filter() === 'upcoming'}>
                  <button class="btn btn-secondary mt-4" onClick={() => setFilter('past')}>
                    Zobrazit minulé události
                  </button>
                </Show>
              </div>
            }
          >
            <div class="space-y-6">
              <For each={groupedEvents()}>
                {(group) => (
                  <div>
                    <div class="flex items-center gap-3 mb-3">
                      <div class="flex-1 h-px bg-border" />
                      <span class="text-sm font-medium text-text-secondary px-3">{group.date}</span>
                      <div class="flex-1 h-px bg-border" />
                    </div>

                    <div class="space-y-2">
                      <For each={group.events}>
                        {(event) => (
                          <EventCard
                            event={event}
                            statusOptions={statusOptionsFor(event)}
                            myStatus={myStatusOf(event)}
                            isPending={rsvpMutation.isPending}
                            onOpen={() => navigate(`/events/${event.id}`)}
                            onRsvp={(status) => rsvpMutation.mutate({ eventId: event.id, status })}
                          />
                        )}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  )
}

interface EventCardProps {
  event: Event
  statusOptions: AttendanceStatus[]
  myStatus?: string
  isPending: boolean
  onOpen: () => void
  onRsvp: (status: string) => void
}

function EventCard(props: EventCardProps) {
  const status = () => getEventStatus(props.event)
  const canRsvp = () => status() !== 'past' && props.statusOptions.length > 0
  const color = () => TYPE_COLOR[props.event.type] || 'primary'
  const myStatus = () => props.myStatus

  return (
    <article
      class="bg-elevated rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={props.onOpen}
    >
      <div class="p-4">
        <div class="flex items-start gap-3">
          <div
            class="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
            style={`background-color: var(--color-${color()}-light)`}
          >
            <span class="icon" style={`color: var(--color-${color()})`} innerHTML={ICONS[TYPE_ICON[props.event.type] || 'calendar']} />
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <h3 class="font-semibold text-text truncate">{props.event.caption}</h3>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted">
                  <span>
                    {formatDisplayDate(props.event.startTime)} {formatDisplayTime(props.event.startTime)}–{formatDisplayTime(props.event.endTime)}
                  </span>
                  <Show when={props.event.place}>
                    <span>• {props.event.place}</span>
                  </Show>
                </div>
              </div>
              <span class="badge bg-100 text-text-secondary text-xs flex-shrink-0">
                {props.event.eventType?.caption || props.event.type}
              </span>
            </div>

            <Show when={props.event.description}>
              <p class="text-sm text-muted mt-2 line-clamp-2">{props.event.description}</p>
            </Show>

            <Show when={canRsvp()}>
              <div class="mt-3 pt-3 border-t border-border-light" onClick={e => e.stopPropagation()}>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs text-muted">Účast:</span>
                  <For each={props.statusOptions}>
                    {(option) => {
                      const selected = () => myStatus() === option.code
                      const cls = () =>
                        'rsvp-btn px-3 py-1.5 rounded-md text-xs font-medium transition-all ' +
                        (selected() ? 'text-white' : 'bg-100 text-text-secondary hover:bg-200') +
                        (props.isPending ? ' opacity-50 cursor-wait' : '')
                      const background = () =>
                        option.color
                          ? `background-color: #${option.color}`
                          : `background-color: var(--color-${STATUS_COLORS[option.code] || 'secondary'})`
                      return (
                        <button
                          class={cls()}
                          style={selected() ? background() : undefined}
                          disabled={props.isPending || selected()}
                          aria-pressed={selected()}
                          onClick={() => props.onRsvp(option.code)}
                        >
                          {STATUS_LABELS[option.code] || option.caption}
                        </button>
                      )
                    }}
                  </For>
                </div>
              </div>
            </Show>

            <Show when={!canRsvp() && myStatus()}>
              <div class="mt-3 pt-3 border-t border-border-light text-xs text-muted">
                Vaše účast:{' '}
                <span class="badge bg-100 text-text-secondary">
                  {STATUS_LABELS[myStatus()!] || myStatus()}
                </span>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </article>
  )
}
