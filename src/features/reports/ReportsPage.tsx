// Attendance report ("Report docházky"), the SPA counterpart of the legacy
// Event:Report page: a players × events matrix of planned/actual attendance, with the
// official XLSX export (`GET /api/event/export/report?year=…&page=…`).

import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { useQuery } from '@tanstack/solid-query'
import {
  exportEventReport,
  getEventsWithMyAttendance,
  getUsersByStatus,
  type Event,
  type User
} from '../../lib/api'
import { STATUS_COLORS, STATUS_LABELS } from '../events/constants'
import { formatDisplayDate } from '../../lib/date-filters'
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
  code ? STATUS_LABELS[code] ?? code : '—'

const yearsBack = 15

export default function ReportsPage() {
  const [year, setYear] = createSignal(new Date().getFullYear())
  const [yearTouched, setYearTouched] = createSignal(false)
  const [downloading, setDownloading] = createSignal(false)
  const [downloadError, setDownloadError] = createSignal<string | null>(null)

  const yearOptions = createMemo(() => {
    const now = new Date().getFullYear()
    return Array.from({ length: yearsBack + 1 }, (_, i) => now - i)
  })

  // Start on the newest year that actually has events (the dev dataset ends in 2022).
  const latestQuery = useQuery<Event[], Error>(() => ({
    queryKey: ['events', 'latest'],
    queryFn: () => getEventsWithMyAttendance({ order: 'startTime__desc', limit: 1 }),
    staleTime: 1000 * 60 * 30
  }))

  createEffect(() => {
    const newest = latestQuery.data?.[0]
    if (!newest || yearTouched()) return
    const newestYear = new Date(newest.startTime).getFullYear()
    if (Number.isFinite(newestYear)) setYear(newestYear)
  })

  const eventsQuery = useQuery<Event[], Error>(() => ({
    queryKey: ['reports', 'events', year()],
    queryFn: () =>
      getEventsWithMyAttendance({
        filters: [
          { field: 'startTime', operator: '>=', value: new Date(Date.UTC(year(), 0, 1)) },
          { field: 'startTime', operator: '<=', value: new Date(Date.UTC(year(), 11, 31, 23, 59, 59)) }
        ],
        order: 'startTime'
      }),
    staleTime: 1000 * 60 * 10
  }))

  const playersQuery = useQuery<User[], Error>(() => ({
    queryKey: ['reports', 'players'],
    queryFn: () => getUsersByStatus('PLAYER'),
    staleTime: 1000 * 60 * 30
  }))

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
          name: summary?.callName || summary?.displayName || `Uživatel ${record.userId}`
        })
      }
    }

    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  })

  const attendanceFor = (event: Event, userId: number) =>
    (event.attendance ?? []).find(record => record.userId === userId)

  const usedEvents = createMemo(() =>
    events().filter(event => (event.attendance ?? []).some(a => a.preStatus || a.postStatus))
  )

  const handleDownload = async () => {
    setDownloadError(null)
    setDownloading(true)
    try {
      const blob = await exportEventReport(year())
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `report-event-${year()}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      setDownloadError((error as Error).message || 'Export se nezdařil.')
    } finally {
      setDownloading(false)
    }
  }

  const isLoading = () => eventsQuery.isPending || playersQuery.isPending

  return (
    <div class="reports-page">
      <div class="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 class="text-xl font-semibold text-text">Reporty</h1>
        <div class="flex items-center gap-2">
          <label class="label mb-0" for="report-year">
            Rok
          </label>
          <select
            id="report-year"
            class="input w-auto"
            value={String(year())}
            onChange={e => {
              setYearTouched(true)
              setYear(Number(e.currentTarget.value))
            }}
          >
            <For each={yearOptions()}>{option => <option value={String(option)}>{option}</option>}</For>
          </select>
          <button
            class="btn btn-secondary"
            onClick={handleDownload}
            disabled={downloading()}
            title="Stáhnout oficiální report jako XLSX"
          >
            <span class="icon-sm" innerHTML={ICONS['download']} />
            {downloading() ? 'Stahuji…' : 'XLSX'}
          </button>
        </div>
      </div>

      <Show when={downloadError()}>
        <p class="text-sm text-danger mb-3">{downloadError()}</p>
      </Show>

      <p class="text-sm text-muted mb-3">
        Plánovaná a skutečná účast na událostech roku {year()}.
        <span class="ml-1">✓ přijdu · ✕ nepřijdu · ~ později · ? nevím</span>
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
              <h3 class="text-lg font-medium text-text mb-1">Žádná data pro rok {year()}</h3>
              <p class="text-muted">
                {events().length === 0
                  ? 'V tomto roce nejsou žádné události.'
                  : 'V týmu nejsou žádní aktivní hráči.'}
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
                      Hráč
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
                                      title={`Plán: ${statusLabel(record?.preStatus)}`}
                                    >
                                      {shortStatus(record?.preStatus) || '·'}
                                    </span>
                                    <span
                                      class="block text-[11px] opacity-60"
                                      style={`color: ${statusColor(record?.postStatus)}`}
                                      title={`Výsledek: ${statusLabel(record?.postStatus)}`}
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
              {usedEvents().length} událostí · {players().length} hráčů
            </p>
          </div>
        </Show>
      </Show>
    </div>
  )
}
