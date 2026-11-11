// Attendance report ("Report docházky"), the SPA counterpart of the legacy
// Event:Report page: a players × events matrix of planned/actual attendance, with the
// official XLSX export (`GET /api/event/export/report?year=…&page=…`).

import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { useQuery } from '@tanstack/solid-query'
import {
  exportEventReport,
  getEventTypes,
  getEventsWithMyAttendance,
  getUsersByStatus,
  type Event,
  type EventType,
  type User,
  type UserStatus
} from '../../lib/api'
import { queryKeys } from '../../lib/queryClient'
import { USER_STATUSES, USER_STATUS_LABELS } from '../../lib/user-status'
import { STATUS_COLORS } from '../events/constants'
import { attendanceCaption, eventTypeCaption } from '../../lib/event-labels'
import { formatDisplayDate } from '../../lib/date-filters'
import { getLocale, lang } from '../../lib/prefs'
import { tr } from '../../lib/i18n'
import { ICONS } from '../../lib/icons'

const STATUS_SHORT: Record<string, string> = {
  YES: '✓',
  NO: '✕',
  LAT: '~',
  DKY: '?',
  CHCI: '✓',
  NECHCI: '✕',
  NEVIM: '?'
}

const shortStatus = (code?: string | null): string =>
  code ? STATUS_SHORT[code] ?? code : ''

const statusColor = (code?: string | null): string =>
  code ? `var(--color-${STATUS_COLORS[code] ?? 'secondary'})` : 'var(--color-text-muted)'

const statusLabel = (code?: string | null): string =>
  code ? attendanceCaption(code) : '—'

export default function ReportsPage() {
  const [statusFilter, setStatusFilter] = createSignal<UserStatus>('PLAYER')
  const [typeFilter, setTypeFilter] = createSignal('all')
  const [from, setFrom] = createSignal('')
  const [to, setTo] = createSignal('')
  const [rangeTouched, setRangeTouched] = createSignal(false)
  const [downloading, setDownloading] = createSignal(false)
  const [downloadError, setDownloadError] = createSignal<string | null>(null)

  // Start on the year of the newest event (the dev dataset ends in 2022).
  const latestQuery = useQuery<Event[], Error>(() => ({
    queryKey: ['events', 'latest'],
    queryFn: () => getEventsWithMyAttendance({ order: 'startTime__desc', limit: 1 }),
    staleTime: 1000 * 60 * 30
  }))

  createEffect(() => {
    const newest = latestQuery.data?.[0]
    if (!newest || rangeTouched()) return
    const newestYear = new Date(newest.startTime).getFullYear()
    if (Number.isFinite(newestYear)) {
      setFrom(`${newestYear}-01-01`)
      setTo(`${newestYear}-12-31`)
    }
  })

  const eventsQuery = useQuery<Event[], Error>(() => ({
    queryKey: ['reports', 'events', from(), to()],
    queryFn: () =>
      getEventsWithMyAttendance({
        filters: [
          { field: 'startTime', operator: '>=', value: new Date(`${from()}T00:00:00`) },
          { field: 'startTime', operator: '<=', value: new Date(`${to()}T23:59:59`) }
        ],
        order: 'startTime'
      }),
    enabled: !!from() && !!to(),
    staleTime: 1000 * 60 * 10
  }))

  const playersQuery = useQuery<User[], Error>(() => ({
    queryKey: ['reports', 'players', statusFilter()],
    queryFn: () => getUsersByStatus(statusFilter()),
    staleTime: 1000 * 60 * 30
  }))

  const eventTypesQuery = useQuery<EventType[], Error>(() => ({
    queryKey: queryKeys.eventTypes(lang()),
    queryFn: getEventTypes,
    staleTime: 1000 * 60 * 60
  }))

  /** The XLSX export is server-side and year-based; use the year of the range start. */
  const exportYear = () => {
    const value = Number(from().slice(0, 4))
    return Number.isFinite(value) && value > 0 ? value : new Date().getFullYear()
  }

  const events = createMemo(() => eventsQuery.data ?? [])

  interface ReportPlayer {
    id: number
    name: string
  }

  const players = createMemo<ReportPlayer[]>(() => {
    const byId = new Map<number, ReportPlayer>()
    for (const user of playersQuery.data ?? []) {
      byId.set(user.id, { id: user.id, name: user.callName || user.displayName })
    }

    // Include anyone who appears in the attendance but is no longer an active player,
    // so historic events never look like they were attended by nobody.
    for (const event of events()) {
      for (const record of event.attendance ?? []) {
        if (byId.has(record.userId)) continue
        const summary = record.user
        byId.set(record.userId, {
          id: record.userId,
          name: summary?.callName || summary?.displayName || tr('Uživatel {id}', { id: record.userId })
        })
      }
    }

    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, getLocale()))
  })

  const attendanceFor = (event: Event, userId: number) =>
    (event.attendance ?? []).find(record => record.userId === userId)

  const usedEvents = createMemo(() =>
    events().filter(
      event =>
        (typeFilter() === 'all' || event.type === typeFilter()) &&
        (event.attendance ?? []).some(a => a.preStatus || a.postStatus)
    )
  )

  const handleDownload = async () => {
    setDownloadError(null)
    setDownloading(true)
    try {
      const year = exportYear()
      const blob = await exportEventReport(year)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `report-event-${year}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      setDownloadError((error as Error).message || tr('Export se nezdařil.'))
    } finally {
      setDownloading(false)
    }
  }

  const isLoading = () => eventsQuery.isPending || playersQuery.isPending

  return (
    <div class="reports-page">
      <div class="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 class="text-xl font-semibold text-text">{tr('Reporty')}</h1>
        <button
          class="btn btn-secondary"
          onClick={handleDownload}
          disabled={downloading()}
          title={tr('Stáhnout oficiální report jako XLSX (rok {year})', { year: exportYear() })}
        >
          <span class="icon-sm" innerHTML={ICONS['download']} />
          {downloading() ? tr('Stahuji…') : `XLSX ${exportYear()}`}
        </button>
      </div>

      {/* Filters: date range, event type and the user category (default: players). */}
      <div class="flex flex-wrap items-end gap-3 mb-3">
        <div>
          <label class="label mb-1" for="report-from">{tr('Od')}</label>
          <input
            id="report-from"
            type="date"
            class="input py-2 px-3 text-sm"
            style="width: auto"
            value={from()}
            onChange={e => {
              setRangeTouched(true)
              setFrom(e.currentTarget.value)
            }}
          />
        </div>
        <div>
          <label class="label mb-1" for="report-to">{tr('Do')}</label>
          <input
            id="report-to"
            type="date"
            class="input py-2 px-3 text-sm"
            style="width: auto"
            value={to()}
            onChange={e => {
              setRangeTouched(true)
              setTo(e.currentTarget.value)
            }}
          />
        </div>
        <div>
          <label class="label mb-1" for="report-type">{tr('Typ události')}</label>
          <select
            id="report-type"
            class="input py-2 px-3 text-sm"
            style="width: auto"
            value={typeFilter()}
            onChange={e => setTypeFilter(e.currentTarget.value)}
          >
            <option value="all">{tr('Všechny typy')}</option>
            <For each={eventTypesQuery.data ?? []}>
              {(type) => (
                <option value={type.code}>{eventTypeCaption(type.code, type.caption)}</option>
              )}
            </For>
          </select>
        </div>
        <div>
          <label class="label mb-1" for="report-group">{tr('Skupina')}</label>
          <select
            id="report-group"
            class="input py-2 px-3 text-sm"
            style="width: auto"
            value={statusFilter()}
            onChange={e => setStatusFilter(e.currentTarget.value as UserStatus)}
          >
            <For each={USER_STATUSES}>
              {(status) => <option value={status}>{tr(USER_STATUS_LABELS[status])}</option>}
            </For>
          </select>
        </div>
      </div>

      <Show when={downloadError()}>
        <p class="text-sm text-danger mb-3">{downloadError()}</p>
      </Show>

      <p class="text-sm text-muted mb-3">
        {tr('Plánovaná a skutečná účast ve vybraném období.')}
        <span class="ml-1">{tr('✓ přijdu · ✕ nepřijdu · ~ později · ? nevím')}</span>
      </p>

      <Show
        when={!isLoading()}
        fallback={
          <div class="flex items-center justify-center h-40">
            <span class="icon icon-lg text-muted animate-spin" innerHTML={ICONS['spinner']} />
          </div>
        }
      >
        <Show
          when={events().length > 0 && players().length > 0}
          fallback={
            <div class="text-center py-12">
              <span class="icon icon-lg text-muted mb-3" innerHTML={ICONS['reports']} />
              <h3 class="text-lg font-medium text-text mb-1">
                {tr('Žádná data pro vybrané období')}
              </h3>
              <p class="text-muted">
                {usedEvents().length === 0 && events().length > 0
                  ? tr('Pro tento typ události nejsou žádná data.')
                  : events().length === 0
                    ? tr('V tomto období nejsou žádné události.')
                    : tr('V této skupině nejsou žádní členové.')}
              </p>
            </div>
          }
        >
          <div class="bg-elevated rounded-xl border border-border overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-sm border-collapse">
                <thead>
                  <tr class="bg-50">
                    <th class="sticky left-0 z-10 bg-50 text-left px-3 py-2 font-medium text-text whitespace-nowrap border-b border-border">
                      {tr('Člen')}
                    </th>
                    <For each={usedEvents()}>
                      {event => (
                        <th
                          class="px-2 py-2 font-medium text-text border-b border-border min-w-[64px] align-bottom"
                          title={`${event.caption} — ${formatDisplayDate(event.startTime)}`}
                        >
                          <div class="truncate max-w-[110px] text-xs">{event.caption}</div>
                          <div class="text-[11px] font-normal text-muted whitespace-nowrap">
                            {formatDisplayDate(event.startTime)}
                          </div>
                        </th>
                      )}
                    </For>
                  </tr>
                </thead>
                <tbody>
                  <For each={players()}>
                    {player => (
                      <tr class="border-b border-border-light last:border-b-0">
                        <td class="sticky left-0 z-10 bg-elevated px-3 py-2 text-text whitespace-nowrap">
                          {player.name}
                        </td>
                        <For each={usedEvents()}>
                          {event => {
                            const record = attendanceFor(event, player.id)
                            return (
                              <td class="px-2 py-2 text-center align-top">
                                <Show
                                  when={record?.preStatus || record?.postStatus}
                                  fallback={<span class="text-muted">·</span>}
                                >
                                  <div class="leading-tight">
                                    <span
                                      class="block text-xs"
                                      style={`color: ${statusColor(record?.preStatus)}`}
                                      title={`${tr('Plán:')} ${statusLabel(record?.preStatus)}`}
                                    >
                                      {shortStatus(record?.preStatus) || '·'}
                                    </span>
                                    <span
                                      class="block text-[11px] opacity-60"
                                      style={`color: ${statusColor(record?.postStatus)}`}
                                      title={`${tr('Výsledek:')} ${statusLabel(record?.postStatus)}`}
                                    >
                                      {shortStatus(record?.postStatus) || '·'}
                                    </span>
                                  </div>
                                </Show>
                              </td>
                            )
                          }}
                        </For>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
            <p class="px-3 py-2 text-xs text-muted border-t border-border-light">
              {tr('{events} událostí · {players} osob', {
                events: usedEvents().length,
                players: players().length
              })}
            </p>
          </div>
        </Show>
      </Show>
    </div>
  )
}
