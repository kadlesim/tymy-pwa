// Events page - list (closest first) or month grid, per-tab server queries,
// pending-attendance tab and optimistic RSVP.

import { createSignal, createMemo, For, Show } from 'solid-js'
import { A, useNavigate } from '@solidjs/router'
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
import { tr } from '../../lib/i18n'
import { useAuth } from '../../lib/auth'
import { lang } from '../../lib/prefs'
import { formatDisplayDate, formatDisplayTime, formatWeekdayShort, getEventStatus } from '../../lib/date-filters'
import { ICONS } from '../../lib/icons'
import { STATUS_COLORS } from './constants'
import { attendanceCaption, eventTypeCaption } from '../../lib/event-labels'
import EventMonthView from './EventMonthView'

type EventTab = 'upcoming' | 'past' | 'pending'
type EventsView = 'list' | 'month'

const TYPE_COLOR: Record<string, string> = {
  TRA: 'primary',
  RUN: 'success',
  MEE: 'info',
  TOU: 'warning',
  CMP: 'danger'
}

const PENDING_KEY = queryKeys.eventsWithAttendance('pending')

export default function EventsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const auth = useAuth()
  const { tEvents, tCommon } = useCommonCaptions()

  const [tab, setTab] = createSignal<EventTab>('upcoming')
  const [view, setView] = createSignal<EventsView>('list')
  const [selectedType, setSelectedType] = createSignal<string>('all')
  const [visibleMonth, setVisibleMonth] = createSignal(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  )

  // Per-tab server-side queries keep payloads small and results accurate.
  // NOTE: this server sorts descending by default; ascending needs the `__asc` suffix.
  const listQueryOptions = (): EventsQueryOptions => {
    const now = new Date()
    if (tab() === 'past') {
      return {
        filters: [{ field: 'endTime', operator: '<', value: now }],
        order: 'startTime__desc',
        limit: 40
      }
    }
    return { filters: [{ field: 'startTime', operator: '>=', value: now }], order: 'startTime__asc' }
  }

  const eventsQuery = useQuery<Event[], Error>(() => ({
    queryKey: queryKeys.eventsWithAttendance(tab() === 'pending' ? 'pending' : tab()),
    queryFn: () => getEventsWithMyAttendance(listQueryOptions()),
    staleTime: 1000 * 60 * 2,
    refetchOnMount: 'always',
    enabled: tab() !== 'pending'
  }))

  // Unanswered RSVPs: running events and later that are still open for sign-up.
  const pendingQuery = useQuery<Event[], Error>(() => ({
    queryKey: PENDING_KEY,
    queryFn: () =>
      getEventsWithMyAttendance({
        filters: [{ field: 'endTime', operator: '>=', value: new Date() }],
        order: 'startTime__asc',
        limit: 100
      }),
    staleTime: 1000 * 60 * 2,
    refetchOnMount: 'always',
    enabled: tab() === 'pending' || auth().user !== null
  }))

  const eventTypesQuery = useQuery<EventType[], Error>(() => ({
    queryKey: queryKeys.eventTypes(lang()),
    queryFn: getEventTypes,
    staleTime: 1000 * 60 * 60
  }))

  // Visible month for the calendar grid.
  const monthQuery = useQuery<Event[], Error>(() => ({
    queryKey: ['events', 'month', visibleMonth().toISOString()],
    queryFn: () => {
      const start = visibleMonth()
      return getEventsWithMyAttendance({
        filters: [
          { field: 'startTime', operator: '>=', value: new Date(Date.UTC(start.getFullYear(), start.getMonth(), 1)) },
          {
            field: 'startTime',
            operator: '<=',
            value: new Date(Date.UTC(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59))
          }
        ],
        order: 'startTime__asc'
      })
    },
    staleTime: 1000 * 60 * 2,
    enabled: view() === 'month'
  }))

  const eventTypes = () => eventTypesQuery.data ?? []

  const statusOptionsFor = (event: Event): AttendanceStatus[] => {
    const type = eventTypes().find(t => t.code === event.type)
    return type?.preStatusSet ?? []
  }

  // The API has no `myAttendance`; derive it from the attendance array.
  const myStatusOf = (event: Event): string | undefined =>
    event.myAttendance?.preStatus ??
    event.attendance?.find(a => a.userId === auth().user?.id)?.preStatus ??
    undefined

  // Not answered yet = still open for sign-up and no status of mine.
  const pendingEvents = createMemo(() => {
    const now = new Date()
    return (pendingQuery.data ?? []).filter(
      event => new Date(event.closeTime) >= now && !myStatusOf(event)
    )
  })

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
      const key = queryKeys.eventsWithAttendance(tab() === 'pending' ? 'pending' : tab())
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Event[]>(key)
      const patch = (events: Event[] | undefined) =>
        (events ?? []).map(e =>
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
      queryClient.setQueryData<Event[]>(key, old => patch(old))
      queryClient.setQueryData<Event[]>(PENDING_KEY, old => patch(old))
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

  const baseEvents = () => (tab() === 'pending' ? pendingEvents() : eventsQuery.data ?? [])

  const filteredEvents = createMemo(() => {
    let result = [...baseEvents()]
    if (selectedType() !== 'all') {
      result = result.filter(e => e.type === selectedType())
    }
    // List is always "closest to now first": upcoming ascending, past descending.
    result.sort((a, b) => {
      const diff = new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      return tab() === 'past' ? -diff : diff
    })
    return result
  })

  const monthEvents = createMemo(() => {
    const list = monthQuery.data ?? []
    return selectedType() === 'all' ? list : list.filter(e => e.type === selectedType())
  })

  const groupedEvents = createMemo(() => {
    const groups = new Map<string, Event[]>()
    for (const event of filteredEvents()) {
      // Monthly dividers — the card itself shows the day and time.
      const key = formatDisplayDate(event.startTime, {
        day: undefined,
        month: 'long',
        year: 'numeric'
      })
      const arr = groups.get(key) ?? []
      arr.push(event)
      groups.set(key, arr)
    }
    return Array.from(groups.entries()).map(([date, dayEvents]) => ({ date, events: dayEvents }))
  })

  const loading = () => (tab() === 'pending' ? pendingQuery.isPending : eventsQuery.isPending)
  const failed = () => (tab() === 'pending' ? pendingQuery.isError : eventsQuery.isError)

  return (
    <div class="events-page">
      <div class="mb-4 flex flex-col gap-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h1 class="text-xl font-semibold text-text">{tEvents('title')}</h1>

          <div class="flex items-center gap-2">
            <A href="/events/manage" class="btn btn-secondary">
              <span class="icon-sm" innerHTML={ICONS['settings']} />
              {tr('Správa')}
            </A>
            <A href="/events/create" class="btn btn-primary">
              <span class="icon-sm" innerHTML={ICONS['plus']} />
              {tr('Nová událost')}
            </A>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <div class="flex gap-1 bg-100 rounded-lg p-1" role="tablist">
            <For each={[
              { value: 'upcoming' as EventTab, label: tEvents('upcoming') },
              { value: 'pending' as EventTab, label: tr('Nevyplněná docházka') },
              { value: 'past' as EventTab, label: tEvents('past') }
            ]}>
              {(item) => (
                <button
                  role="tab"
                  aria-selected={tab() === item.value}
                  class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1.5"
                  classList={{
                    'bg-elevated text-primary shadow-sm': tab() === item.value,
                    'text-text-secondary hover:text-text': tab() !== item.value
                  }}
                  onClick={() => setTab(item.value)}
                >
                  {item.label}
                  <Show when={item.value === 'pending' && pendingEvents().length > 0}>
                    <span
                      class="badge text-[11px] px-1.5 py-0"
                      classList={{
                        'bg-danger text-white': tab() === item.value,
                        'bg-danger-light text-danger': tab() !== item.value
                      }}
                    >
                      {pendingEvents().length}
                    </span>
                  </Show>
                </button>
              )}
            </For>
          </div>

          <div class="flex gap-1 bg-100 rounded-lg p-1" role="group" aria-label={tr('Zobrazení')}>
            <button
              type="button"
              class="inline-flex items-center justify-center w-10 h-10 rounded-md transition-colors"
              classList={{
                'bg-primary text-white shadow-sm': view() === 'list',
                'text-text-secondary hover:text-text hover:bg-200': view() !== 'list'
              }}
              aria-pressed={view() === 'list'}
              aria-label={tr('Seznam')}
              title={tr('Seznam')}
              onClick={() => setView('list')}
            >
              <span class="icon-md" innerHTML={ICONS['list']} />
            </button>
            <button
              type="button"
              class="inline-flex items-center justify-center w-10 h-10 rounded-md transition-colors"
              classList={{
                'bg-primary text-white shadow-sm': view() === 'month',
                'text-text-secondary hover:text-text hover:bg-200': view() !== 'month'
              }}
              aria-pressed={view() === 'month'}
              aria-label={tr('Kalendář')}
              title={tr('Kalendář')}
              onClick={() => setView('month')}
            >
              <span class="icon-md" innerHTML={ICONS['calendar']} />
            </button>
          </div>

          <select
            class="input py-2 px-3 text-sm"
            style="width: auto"
            value={selectedType()}
            onChange={e => setSelectedType(e.currentTarget.value)}
            aria-label={tr('Typ události')}
          >
            <option value="all">{tr('Všechny typy')}</option>
            <For each={eventTypes()}>
              {(type) => <option value={type.code}>{eventTypeCaption(type.code, type.caption)}</option>}
            </For>
          </select>
        </div>
      </div>

      <Show when={view() === 'month'}>
        <Show
          when={!monthQuery.isPending}
          fallback={
            <div class="flex items-center justify-center h-64">
              <span class="icon icon-lg text-muted animate-spin" innerHTML={ICONS['spinner']} />
            </div>
          }
        >
          <EventMonthView
            month={visibleMonth()}
            events={monthEvents()}
            onOpen={id => navigate(`/events/${id}`)}
            onMonthChange={setVisibleMonth}
          />
        </Show>
      </Show>

      <Show when={view() === 'list'}>
        <Show
          when={!loading()}
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
            when={!failed()}
            fallback={
              <div class="text-center p-8">
                <p class="text-danger mb-4">{tr('Chyba při načítání událostí.')}</p>
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
                  <h3 class="text-lg font-medium text-text mb-1">{tr('Žádné události')}</h3>
                  <p class="text-muted">
                    {tab() === 'upcoming'
                      ? tr('Zatím nejsou naplánované žádné události.')
                      : tab() === 'past'
                        ? tr('Zatím nejsou žádné minulé události.')
                        : tr('Máte vyplněnou docházku na všechny otevřené události.')}
                  </p>
                  <Show when={tab() === 'upcoming'}>
                    <button class="btn btn-secondary mt-4" onClick={() => setTab('past')}>
                      {tr('Zobrazit minulé události')}
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
                        <span class="text-base font-semibold text-text px-3">{group.date}</span>
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
  // The grey (primary) tone is too dark for the day number in dark mode.
  const dayColor = () =>
    color() === 'primary' ? 'var(--color-text)' : `var(--color-${color()})`
  const myStatus = () => props.myStatus

  return (
    <article
      class="bg-elevated rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={props.onOpen}
    >
      <div class="p-4">
        <div class="flex items-start gap-3">
          <div
            class="flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center"
            style={`background-color: var(--color-${color()}-light); color: ${dayColor()}`}
          >
            <span class="text-lg font-semibold leading-none">
              {new Date(props.event.startTime).getDate()}
            </span>
            <span class="text-[10px] font-medium uppercase tracking-wide opacity-80 mt-0.5">
              {formatWeekdayShort(props.event.startTime)}
            </span>
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <h3 class="font-semibold text-text truncate">{props.event.caption}</h3>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted">
                  <span>
                    {formatDisplayTime(props.event.startTime)}–{formatDisplayTime(props.event.endTime)}
                  </span>
                  <Show when={props.event.place}>
                    <span>• {props.event.place}</span>
                  </Show>
                </div>
              </div>
              <span class="badge bg-100 text-text-secondary text-xs flex-shrink-0">
                {eventTypeCaption(props.event.type, props.event.eventType?.caption)}
              </span>
            </div>

            <Show when={props.event.description}>
              <p class="text-sm text-muted mt-2 line-clamp-2">{props.event.description}</p>
            </Show>

            <Show when={canRsvp()}>
              <div class="mt-3 pt-3 border-t border-border-light" onClick={e => e.stopPropagation()}>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs text-muted">{tr('Účast:')}</span>
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
                          {attendanceCaption(option.code, option.caption)}
                        </button>
                      )
                    }}
                  </For>
                </div>
              </div>
            </Show>

            <Show when={!canRsvp() && myStatus()}>
              <div class="mt-3 pt-3 border-t border-border-light text-xs text-muted">
                {tr('Vaše účast:')}{' '}
                <span class="badge bg-100 text-text-secondary">
                  {attendanceCaption(myStatus()!)}
                </span>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </article>
  )
}
