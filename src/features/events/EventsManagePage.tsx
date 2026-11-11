// Bulk event management (/events/manage).
//
// Two things live here:
//  1. a year/type filtered table of events with multi-select deletion — this is the
//     equivalent of the legacy `/setting/event` screen;
//  2. a series builder, because the API's create endpoint is natively bulk
//     (`POST /events/create` takes an array and creates them all at once — see tymy.apib),
//     which is how a whole season of trainings is meant to be entered.
//
// The table uses `/events` (not `/events/withMyAttendance`): it embeds no attendance
// arrays, so a full year stays small. Rights flags (`canPlan`, `canPlanOthers`) come
// with it; the server enforces the actual SYS:EVE_* rights.

import { createSignal, createMemo, For, Show } from 'solid-js'
import { A } from '@solidjs/router'
import { useQuery, useMutation } from '@tanstack/solid-query'
import {
  getEvents,
  getEventTypes,
  createEvents,
  deleteEvent,
  type Event,
  type EventType
} from '../../lib/api'
import { invalidateEvents } from '../../lib/queryClient'
import { useCommonCaptions } from '../../lib/captions'
import { tr } from '../../lib/i18n'
import { formatApiDate, formatDisplayDate, formatDisplayTime } from '../../lib/date-filters'
import { ICONS } from '../../lib/icons'
import { EVENT_TYPE_COLORS } from './constants'

type Notice = { kind: 'ok' | 'err'; text: string }

const WEEKDAYS = [
  { value: 1, label: 'Po' },
  { value: 2, label: 'Út' },
  { value: 3, label: 'St' },
  { value: 4, label: 'Čt' },
  { value: 5, label: 'Pá' },
  { value: 6, label: 'So' },
  { value: 0, label: 'Ne' }
]

/** Maximum events one series may create in a single request. */
const SERIES_LIMIT = 200

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** `<input type="date">` value (local time). */
function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseDateInput(value: string): Date | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  return Number.isNaN(date.getTime()) ? null : date
}

export default function EventsManagePage() {
  const { tCommon } = useCommonCaptions()

  const today = new Date()
  const [year, setYear] = createSignal(today.getFullYear())
  const [typeFilter, setTypeFilter] = createSignal('all')
  const [search, setSearch] = createSignal('')
  const [selected, setSelected] = createSignal<number[]>([])
  const [notice, setNotice] = createSignal<Notice | null>(null)

  // Series builder state.
  const defaultUntil = new Date(today)
  defaultUntil.setMonth(defaultUntil.getMonth() + 2)
  const [seriesOpen, setSeriesOpen] = createSignal(false)
  const [seriesCaption, setSeriesCaption] = createSignal('Trénink')
  const [seriesType, setSeriesType] = createSignal('TRA')
  const [seriesPlace, setSeriesPlace] = createSignal('')
  const [seriesLink, setSeriesLink] = createSignal('')
  const [seriesDescription, setSeriesDescription] = createSignal('')
  const [seriesWeekdays, setSeriesWeekdays] = createSignal<number[]>([today.getDay()])
  const [seriesFrom, setSeriesFrom] = createSignal(toDateInput(today))
  const [seriesUntil, setSeriesUntil] = createSignal(toDateInput(defaultUntil))
  const [seriesStartTime, setSeriesStartTime] = createSignal('18:00')
  const [seriesDuration, setSeriesDuration] = createSignal(120)
  const [seriesCloseOffset, setSeriesCloseOffset] = createSignal(6)

  const eventsQuery = useQuery<Event[], Error>(() => ({
    queryKey: ['events', 'manage', String(year())],
    queryFn: () =>
      getEvents({
        filters: [
          { field: 'startTime', operator: '>=', value: new Date(year(), 0, 1) },
          { field: 'startTime', operator: '<=', value: new Date(year(), 11, 31, 23, 59, 59) }
        ],
        order: 'startTime__asc',
        limit: 500
      }),
    staleTime: 1000 * 60 * 2
  }))

  const eventTypesQuery = useQuery<EventType[], Error>(() => ({
    queryKey: ['eventTypes'],
    queryFn: getEventTypes,
    staleTime: 1000 * 60 * 60
  }))

  const eventTypes = () => eventTypesQuery.data ?? []
  const typeCaption = (code: string) =>
    eventTypes().find(t => t.code === code)?.caption ?? code
  const typeColor = (code: string) => EVENT_TYPE_COLORS[code] ?? 'primary'

  const years = createMemo(() => {
    const current = new Date().getFullYear()
    const out: number[] = []
    for (let y = current + 2; y >= current - 10; y--) out.push(y)
    return out
  })

  const visible = createMemo(() => {
    let list = eventsQuery.data ?? []
    if (typeFilter() !== 'all') list = list.filter(e => e.type === typeFilter())
    const query = search().trim().toLowerCase()
    if (query) {
      list = list.filter(e =>
        `${e.caption} ${e.place ?? ''}`.toLowerCase().includes(query)
      )
    }
    return list
  })

  // Planning rights: the detail page uses the same pair of flags.
  const canEditEvent = (event: Event) => !!(event.canPlan || event.canPlanOthers)
  const editableVisible = () => visible().filter(canEditEvent)
  const anyEditable = () => editableVisible().length > 0

  const isSelected = (id: number) => selected().includes(id)
  const selectedEvents = () => visible().filter(e => isSelected(e.id))
  const allSelected = () => {
    const ids = editableVisible()
    return ids.length > 0 && ids.every(e => isSelected(e.id))
  }

  const toggleSelected = (id: number) =>
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))

  const toggleAll = () => {
    const ids = editableVisible().map(e => e.id)
    setSelected(allSelected() ? [] : ids)
  }

  const clearSelection = () => setSelected([])

  const deleteMutation = useMutation<
    { deleted: number; failed: number },
    Error,
    number[]
  >(() => ({
    mutationFn: async ids => {
      const results = await Promise.allSettled(ids.map(id => deleteEvent(id)))
      const failed = results.filter(r => r.status === 'rejected').length
      return { deleted: results.length - failed, failed }
    },
    onSuccess: ({ deleted, failed }) => {
      clearSelection()
      void invalidateEvents()
      setNotice(
        failed > 0
          ? {
              kind: 'err',
              text: tr(
                'Smazáno {deleted} událostí, {failed} se nepodařilo smazat (chybí právo SYS:EVE_DELETE?).',
                { deleted, failed }
              )
            }
          : { kind: 'ok', text: tr('Smazáno {n} událostí.', { n: deleted }) }
      )
    },
    onError: (error: Error) => setNotice({ kind: 'err', text: error.message })
  }))

  const handleDeleteSelected = () => {
    const events = selectedEvents()
    if (events.length === 0) return
    const preview = events
      .slice(0, 3)
      .map(e => `• ${formatDisplayDate(e.startTime)} ${e.caption}`)
      .join('\n')
    const more = events.length > 3 ? `\n• ${tr('… a dalších {n}', { n: events.length - 3 })}` : ''
    const question = `${tr('Opravdu smazat {n} událostí?', { n: events.length })}\n\n${preview}${more}\n\n${tr('Tato akce je nevratná.')}`
    if (!confirm(question)) {
      return
    }
    deleteMutation.mutate(events.map(e => e.id))
  }

  const handleDeleteOne = (event: Event) => {
    const question = `${tr('Opravdu smazat událost „{name}“ ({date})?', {
      name: event.caption,
      date: formatDisplayDate(event.startTime)
    })}\n\n${tr('Tato akce je nevratná.')}`
    if (!confirm(question)) {
      return
    }
    deleteMutation.mutate([event.id])
  }

  // ---- Series builder -------------------------------------------------------

  const toggleWeekday = (value: number) =>
    setSeriesWeekdays(prev =>
      prev.includes(value) ? prev.filter(d => d !== value) : [...prev, value].sort((a, b) => a - b)
    )

  const seriesDates = createMemo(() => {
    const from = parseDateInput(seriesFrom())
    const until = parseDateInput(seriesUntil())
    const time = seriesStartTime()
    if (!from || !until || until < from || !time) return []

    const [hours, minutes] = time.split(':').map(Number)
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return []

    const days = seriesWeekdays()
    if (days.length === 0) return []

    const duration = Math.max(1, seriesDuration())
    const closeOffset = Math.max(0, seriesCloseOffset())
    const dates: { start: Date; end: Date; close: Date }[] = []

    for (const cursor = new Date(from); cursor <= until; cursor.setDate(cursor.getDate() + 1)) {
      if (!days.includes(cursor.getDay())) continue
      const start = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate(),
        hours,
        minutes,
        0,
        0
      )
      dates.push({
        start,
        end: new Date(start.getTime() + duration * 60000),
        close: new Date(start.getTime() - closeOffset * 3600000)
      })
      if (dates.length > SERIES_LIMIT) break
    }
    return dates
  })

  const seriesError = (): string | null => {
    if (!seriesCaption().trim()) return tr('Zadejte název události.')
    if (seriesWeekdays().length === 0) return tr('Vyberte alespoň jeden den v týdnu.')
    const from = parseDateInput(seriesFrom())
    const until = parseDateInput(seriesUntil())
    if (!from || !until) return tr('Zadejte platné datum „od“ a „do“.')
    if (until < from) return tr('Datum „do“ musí být po datu „od“.')
    if (!seriesStartTime()) return tr('Zadejte čas začátku.')
    if (seriesDuration() < 15) return tr('Délka musí být alespoň 15 minut.')
    if (seriesDates().length === 0) return tr('V zadaném období nevychází žádný z vybraných dnů.')
    if (seriesDates().length > SERIES_LIMIT) {
      return tr('Série by měla více než {n} událostí — zkraťte období.', { n: SERIES_LIMIT })
    }
    return null
  }

  const createSeriesMutation = useMutation<Event[], Error, Partial<Event>[]>(() => ({
    mutationFn: payload => createEvents(payload),
    onSuccess: created => {
      void invalidateEvents()
      clearSelection()
      if (created.length > 0) {
        // Jump to the year the series starts in, so the new rows are visible.
        const first = created[0]
        const firstYear = first ? new Date(first.startTime).getFullYear() : NaN
        if (!Number.isNaN(firstYear)) setYear(firstYear)
      }
      setNotice({ kind: 'ok', text: tr('Vytvořeno {n} událostí.', { n: created.length }) })
    },
    onError: (error: Error) => setNotice({ kind: 'err', text: error.message })
  }))

  const handleSeriesSubmit = (e: SubmitEvent) => {
    e.preventDefault()
    const error = seriesError()
    if (error) {
      setNotice({ kind: 'err', text: error })
      return
    }

    const payload: Partial<Event>[] = seriesDates().map(d => ({
      caption: seriesCaption().trim(),
      type: seriesType() as Event['type'],
      description: seriesDescription(),
      place: seriesPlace(),
      link: seriesLink(),
      startTime: formatApiDate(d.start),
      endTime: formatApiDate(d.end),
      closeTime: formatApiDate(d.close)
    }))
    createSeriesMutation.mutate(payload)
  }

  const canSubmitSeries = () => !seriesError() && !createSeriesMutation.isPending

  return (
    <div class="events-manage">
      <div class="mb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold text-text">{tr('Správa událostí')}</h1>
          <p class="text-sm text-muted mt-1">
            {tr('Hromadné mazání a vytváření událostí. Pro jednotlivou úpravu otevřete událost.')}
          </p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <A href="/events" class="btn btn-secondary">
            <span class="icon-sm" innerHTML={ICONS['back']} />
            {tr('Zpět na události')}
          </A>
          <A href="/events/create" class="btn btn-primary">
            <span class="icon-sm" innerHTML={ICONS['plus']} />
            {tr('Nová událost')}
          </A>
        </div>
      </div>

      <Show when={notice()}>
        {(current) => (
          <div
            class="flex items-start gap-3 px-3 py-2 mb-4 rounded-lg border text-sm"
            classList={{
              'bg-success-light border-success text-success': current().kind === 'ok',
              'bg-danger-light border-danger text-danger': current().kind === 'err'
            }}
            role="status"
          >
            <span
              class="icon-sm mt-0.5"
              innerHTML={current().kind === 'ok' ? ICONS['check'] : ICONS['alert']}
            />
            <span class="flex-1">{current().text}</span>
            <button
              type="button"
              class="header-btn p-1 rounded-md hover:bg-100"
              aria-label={tr('Zavřít')}
              onClick={() => setNotice(null)}
            >
              <span class="icon-sm" innerHTML={ICONS['delete']} />
            </button>
          </div>
        )}
      </Show>

      {/* Series builder */}
      <section class="mb-5 bg-elevated border border-border rounded-xl">
        <button
          type="button"
          class="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
          aria-expanded={seriesOpen()}
          onClick={() => setSeriesOpen(!seriesOpen())}
        >
          <span class="flex items-center gap-2 font-semibold text-text">
            <span class="icon-sm" innerHTML={ICONS['calendar']} />
            {tr('Vytvořit sérii událostí')}
          </span>
          <span
            class="icon-sm text-muted transition-transform"
            classList={{ 'rotate-180': seriesOpen() }}
            innerHTML={ICONS['chevronDown']}
          />
        </button>

        <Show when={seriesOpen()}>
          <form onSubmit={handleSeriesSubmit} class="px-4 pb-4 pt-1 border-t border-border space-y-4">
            <p class="text-sm text-muted">
              {tr('Vytvoří opakovanou událost (např. tréninky každé pondělí a čtvrtek) v jednom požadavku. Server je ukládá najednou, maximálně {n} najednou.', { n: SERIES_LIMIT })}
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="label" for="series-caption">
                  {tr('Název události')} <span class="text-danger">*</span>
                </label>
                <input
                  id="series-caption"
                  class="input w-full mt-1"
                  value={seriesCaption()}
                  onInput={e => setSeriesCaption(e.currentTarget.value)}
                  placeholder={tr('Např. Trénink')}
                  required
                  disabled={createSeriesMutation.isPending}
                />
              </div>
              <div>
                <label class="label" for="series-type">{tr('Typ události')}</label>
                <select
                  id="series-type"
                  class="input w-full mt-1"
                  value={seriesType()}
                  onChange={e => setSeriesType(e.currentTarget.value)}
                  disabled={createSeriesMutation.isPending}
                >
                  <For each={eventTypes()}>{(type) => <option value={type.code}>{type.caption}</option>}</For>
                </select>
              </div>
              <div>
                <label class="label" for="series-place">{tr('Místo')}</label>
                <input
                  id="series-place"
                  class="input w-full mt-1"
                  value={seriesPlace()}
                  onInput={e => setSeriesPlace(e.currentTarget.value)}
                  placeholder={tr('Hřiště, adresa…')}
                  disabled={createSeriesMutation.isPending}
                />
              </div>
              <div>
                <label class="label" for="series-link">{tr('Odkaz')}</label>
                <input
                  id="series-link"
                  type="url"
                  class="input w-full mt-1"
                  value={seriesLink()}
                  onInput={e => setSeriesLink(e.currentTarget.value)}
                  placeholder="https://…"
                  disabled={createSeriesMutation.isPending}
                />
              </div>
              <div class="sm:col-span-2">
                <label class="label" for="series-description">{tr('Popis')}</label>
                <textarea
                  id="series-description"
                  class="input w-full mt-1 min-h-[70px] resize-y"
                  value={seriesDescription()}
                  onInput={e => setSeriesDescription(e.currentTarget.value)}
                  placeholder={tr('Společný popis všech událostí…')}
                  disabled={createSeriesMutation.isPending}
                />
              </div>
            </div>

            <fieldset class="border-t border-border pt-4">
              <legend class="label mb-2">{tr('Opakování')}</legend>

              <div class="flex flex-wrap items-center gap-2 mb-4" role="group" aria-label={tr('Dny v týdnu')}>
                <For each={WEEKDAYS}>
                  {(day) => (
                    <button
                      type="button"
                      class="px-3 py-1.5 rounded-md text-sm font-medium border transition-colors"
                      classList={{
                        'bg-primary text-white border-primary': seriesWeekdays().includes(day.value),
                        'bg-100 text-text-secondary border-transparent hover:bg-200': !seriesWeekdays().includes(day.value)
                      }}
                      aria-pressed={seriesWeekdays().includes(day.value)}
                      onClick={() => toggleWeekday(day.value)}
                      disabled={createSeriesMutation.isPending}
                    >
                      {tr(day.label)}
                    </button>
                  )}
                </For>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label class="label" for="series-from">{tr('Od')} <span class="text-danger">*</span></label>
                  <input
                    id="series-from"
                    type="date"
                    class="input w-full mt-1"
                    value={seriesFrom()}
                    onInput={e => setSeriesFrom(e.currentTarget.value)}
                    required
                    disabled={createSeriesMutation.isPending}
                  />
                </div>
                <div>
                  <label class="label" for="series-until">{tr('Do')} <span class="text-danger">*</span></label>
                  <input
                    id="series-until"
                    type="date"
                    class="input w-full mt-1"
                    value={seriesUntil()}
                    onInput={e => setSeriesUntil(e.currentTarget.value)}
                    required
                    disabled={createSeriesMutation.isPending}
                  />
                </div>
                <div>
                  <label class="label" for="series-time">{tr('Začátek')}</label>
                  <input
                    id="series-time"
                    type="time"
                    class="input w-full mt-1"
                    value={seriesStartTime()}
                    onInput={e => setSeriesStartTime(e.currentTarget.value)}
                    required
                    disabled={createSeriesMutation.isPending}
                  />
                </div>
                <div>
                  <label class="label" for="series-duration">{tr('Délka (min)')}</label>
                  <input
                    id="series-duration"
                    type="number"
                    min="15"
                    step="15"
                    class="input w-full mt-1"
                    value={seriesDuration()}
                    onInput={e => setSeriesDuration(Number(e.currentTarget.value))}
                    disabled={createSeriesMutation.isPending}
                  />
                </div>
                <div>
                  <label class="label" for="series-close">{tr('Uzávěrka (h před)')}</label>
                  <input
                    id="series-close"
                    type="number"
                    min="0"
                    step="1"
                    class="input w-full mt-1"
                    value={seriesCloseOffset()}
                    onInput={e => setSeriesCloseOffset(Number(e.currentTarget.value))}
                    disabled={createSeriesMutation.isPending}
                  />
                </div>
              </div>
            </fieldset>

            <div class="bg-50 border border-border-light rounded-lg p-3">
              <Show
                when={seriesDates().length > 0}
                fallback={
                  <p class="text-sm text-muted">
                    {tr('Žádné termíny — zkontrolujte vybrané dny a období.')}
                  </p>
                }
              >
                <p class="text-sm font-medium text-text mb-1">
                  {tr('Vytvoří se {n} událostí', { n: seriesDates().length })}
                </p>
                <ul class="text-xs text-text-secondary list-none pl-0 space-y-0.5">
                  <For each={seriesDates().slice(0, 6)}>
                    {(d) => (
                      <li>
                        {formatDisplayDate(d.start)} {formatDisplayTime(d.start)}–
                        {formatDisplayTime(d.end)}
                      </li>
                    )}
                  </For>
                </ul>
                <Show when={seriesDates().length > 6}>
                  <p class="text-xs text-muted mt-1">
                    {tr('… a dalších {n}', { n: seriesDates().length - 6 })}
                  </p>
                </Show>
              </Show>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3">
              <Show when={seriesError()}>
                {(message) => <p class="text-sm text-danger">{message()}</p>}
              </Show>
              <button type="submit" class="btn btn-primary ml-auto" disabled={!canSubmitSeries()}>
                <span
                  class="icon-sm"
                  classList={{ 'animate-spin': createSeriesMutation.isPending }}
                  innerHTML={createSeriesMutation.isPending ? ICONS['spinner'] : ICONS['plus']}
                />
                {createSeriesMutation.isPending
                  ? tr('Vytvářím…')
                  : seriesDates().length > 0
                    ? tr('Vytvořit {n} událostí', { n: seriesDates().length })
                    : tr('Vytvořit sérii')}
              </button>
            </div>
          </form>
        </Show>
      </section>

      {/* Filters */}
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <select
          class="input py-2 px-3 text-sm"
          style="width: auto"
          aria-label={tr('Rok')}
          value={String(year())}
          onChange={e => {
            setYear(Number(e.currentTarget.value))
            clearSelection()
          }}
        >
          <For each={years()}>{(y) => <option value={String(y)}>{y}</option>}</For>
        </select>

        <select
          class="input py-2 px-3 text-sm"
          style="width: auto"
          aria-label={tr('Typ události')}
          value={typeFilter()}
          onChange={e => {
            setTypeFilter(e.currentTarget.value)
            clearSelection()
          }}
        >
          <option value="all">{tr('Všechny typy')}</option>
          <For each={eventTypes()}>
            {(type) => <option value={type.code}>{type.caption}</option>}
          </For>
        </select>

        <div class="relative flex-1 min-w-[180px] max-w-xs">
          <input
            class="input py-2 pr-3 text-sm w-full"
            style="padding-left: 2rem"
            type="search"
            placeholder={tr('Hledat název nebo místo…')}
            aria-label={tr('Hledat událost')}
            value={search()}
            onInput={e => setSearch(e.currentTarget.value)}
          />
          <span
            class="icon-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
            innerHTML={ICONS['search']}
          />
        </div>

        <span class="text-sm text-muted ml-auto">
          {tr('{n} událostí', { n: visible().length })}
        </span>
      </div>

      {/* Selection bar */}
      <div class="flex flex-wrap items-center gap-2 mb-3 min-h-[34px]">
        <Show
          when={selectedEvents().length > 0}
          fallback={
            <Show when={anyEditable()}>
              <button type="button" class="btn btn-sm btn-secondary" onClick={toggleAll}>
                <span class="icon-sm" innerHTML={ICONS['check']} />
                {tr('Vybrat vše ({n})', { n: editableVisible().length })}
              </button>
            </Show>
          }
        >
          <span class="text-sm font-medium text-text">
            {tr('Vybráno {n}', { n: selectedEvents().length })}
          </span>
          <button type="button" class="btn btn-sm btn-secondary" onClick={clearSelection}>
            {tr('Zrušit výběr')}
          </button>
          <button
            type="button"
            class="btn btn-sm btn-danger ml-auto"
            disabled={deleteMutation.isPending}
            onClick={handleDeleteSelected}
          >
            <span
              class="icon-sm"
              innerHTML={deleteMutation.isPending ? ICONS['spinner'] : ICONS['delete']}
              classList={{ 'animate-spin': deleteMutation.isPending }}
            />
            {deleteMutation.isPending
              ? tr('Mažu…')
              : tr('Smazat vybrané ({n})', { n: selectedEvents().length })}
          </button>
        </Show>
      </div>

      {/* Event table */}
      <div class="bg-elevated border border-border rounded-xl overflow-hidden">
        <div class="hidden md:grid grid-cols-[2rem_8.5rem_minmax(0,1fr)_7rem_8rem_4.5rem] items-center gap-3 px-3 py-2 bg-50 border-b border-border text-[11px] font-medium uppercase tracking-wide text-muted">
          <input
            type="checkbox"
            class="checkbox w-4 h-4"
            checked={allSelected()}
            disabled={!anyEditable() || deleteMutation.isPending}
            onChange={toggleAll}
            aria-label={tr('Vybrat všechny události')}
          />
          <span>{tr('Termín')}</span>
          <span>{tr('Název')}</span>
          <span>{tr('Typ')}</span>
          <span>{tr('Místo')}</span>
          <span class="text-right">{tr('Akce')}</span>
        </div>

        <Show
          when={!eventsQuery.isPending}
          fallback={
            <div class="flex items-center justify-center h-40">
              <span class="icon icon-lg text-muted animate-spin" innerHTML={ICONS['spinner']} />
            </div>
          }
        >
          <Show
            when={!eventsQuery.isError}
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
              when={visible().length > 0}
              fallback={
                <div class="text-center py-10">
                  <div class="icon icon-lg text-muted mb-3" innerHTML={ICONS['calendar']} />
                  <p class="text-muted">
                    {tr('V roce {year} nejsou žádné události odpovídající filtru.', { year: year() })}
                  </p>
                </div>
              }
            >
              <For each={visible()}>
                {(event) => (
                  <div class="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] md:grid-cols-[2rem_8.5rem_minmax(0,1fr)_7rem_8rem_4.5rem] items-center gap-2 md:gap-3 px-3 py-2.5 border-b border-border-light last:border-b-0 hover:bg-50">
                    <input
                      type="checkbox"
                      class="checkbox w-4 h-4"
                      checked={isSelected(event.id)}
                      disabled={!canEditEvent(event) || deleteMutation.isPending}
                      onChange={() => toggleSelected(event.id)}
                      aria-label={tr('Vybrat {name}', { name: event.caption })}
                      title={canEditEvent(event) ? undefined : tr('Bez práva upravovat')}
                    />

                    <div class="hidden md:block text-sm text-text">
                      {formatDisplayDate(event.startTime)}
                      <div class="text-xs text-muted">{formatDisplayTime(event.startTime)}</div>
                    </div>

                    <div class="min-w-0">
                      <div class="md:hidden text-xs text-muted">
                        {formatDisplayDate(event.startTime)} {formatDisplayTime(event.startTime)}
                      </div>
                      <A
                        href={`/events/${event.id}`}
                        class="text-sm font-medium text-text truncate hover:underline block"
                      >
                        {event.caption}
                      </A>
                      <div class="md:hidden flex items-center gap-2 mt-0.5">
                        <span
                          class="badge type-badge text-[11px]"
                          style={`background-color: var(--color-${typeColor(event.type)}-light); color: var(--color-${typeColor(event.type)})`}
                        >
                          {typeCaption(event.type)}
                        </span>
                        <Show when={event.place}>
                          <span class="text-xs text-muted truncate">{event.place}</span>
                        </Show>
                      </div>
                    </div>

                    <div class="hidden md:block">
                      <span
                        class="badge type-badge text-xs"
                        style={`background-color: var(--color-${typeColor(event.type)}-light); color: var(--color-${typeColor(event.type)})`}
                      >
                        {typeCaption(event.type)}
                      </span>
                    </div>

                    <div class="hidden md:block text-xs text-muted truncate" title={event.place}>
                      {event.place || '—'}
                    </div>

                    <div class="flex items-center justify-end gap-1">
                      <Show when={canEditEvent(event)}>
                        <A
                          href={`/events/${event.id}/edit`}
                          class="header-btn p-1.5 rounded-md hover:bg-100"
                          title={tr('Upravit událost')}
                          aria-label={tr('Upravit {name}', { name: event.caption })}
                        >
                          <span class="icon-sm" innerHTML={ICONS['edit']} />
                        </A>
                        <button
                          type="button"
                          class="header-btn p-1.5 rounded-md hover:bg-danger-light hover:text-danger"
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDeleteOne(event)}
                          title={tr('Smazat událost')}
                          aria-label={tr('Smazat {name}', { name: event.caption })}
                        >
                          <span class="icon-sm" innerHTML={ICONS['delete']} />
                        </button>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </Show>
        </Show>
      </div>


    </div>
  )
}
