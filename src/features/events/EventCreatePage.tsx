// Event create / edit page

import { createSignal, createEffect, For, Show } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/solid-query'
import {
  getEvent,
  getEventTypes,
  createEvents,
  updateEvent,
  type Event,
  type EventType
} from '../../lib/api'
import { queryKeys, invalidateEvents } from '../../lib/queryClient'
import { useCommonCaptions } from '../../lib/captions'
import { formatApiDate } from '../../lib/date-filters'
import { ICONS } from '../../lib/icons'

// Value shaped for <input type="datetime-local">, in local time.
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function defaultTimes() {
  const start = new Date()
  start.setHours(18, 0, 0, 0)
  const end = new Date(start)
  end.setHours(20, 0, 0, 0)
  const close = new Date(start)
  close.setHours(12, 0, 0, 0)
  return { start, end, close }
}

export default function EventCreatePage() {
  const params = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { tEvents, tCommon } = useCommonCaptions()

  const idParam = params['id']
  const isEdit = () => idParam !== 'create' && !!idParam
  const eventId = () => (isEdit() ? parseInt(idParam!, 10) : 0)

  const initial = defaultTimes()

  const [caption, setCaption] = createSignal('')
  const [type, setType] = createSignal<string>('TRA')
  const [description, setDescription] = createSignal('')
  const [place, setPlace] = createSignal('')
  const [link, setLink] = createSignal('')
  const [startTime, setStartTime] = createSignal(toLocalInput(initial.start))
  const [endTime, setEndTime] = createSignal(toLocalInput(initial.end))
  const [closeTime, setCloseTime] = createSignal(toLocalInput(initial.close))

  const [errors, setErrors] = createSignal<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = createSignal(false)

  const eventTypesQuery = useQuery<EventType[], Error>(() => ({
    queryKey: queryKeys.eventTypes(),
    queryFn: getEventTypes,
    staleTime: 1000 * 60 * 60
  }))

  const existingQuery = useQuery<Event, Error>(() => ({
    queryKey: queryKeys.event(eventId()),
    queryFn: () => getEvent(eventId()),
    enabled: isEdit() && eventId() > 0
  }))

  createEffect(() => {
    const e = existingQuery.data
    if (!e) return
    setCaption(e.caption)
    setType(e.type)
    setDescription(e.description ?? '')
    setPlace(e.place ?? '')
    setLink(e.link ?? '')
    setStartTime(toLocalInput(new Date(e.startTime)))
    setEndTime(toLocalInput(new Date(e.endTime)))
    setCloseTime(toLocalInput(new Date(e.closeTime)))
  })

  const createMutation = useMutation<Event[], Error, Partial<Event>[]>(() => ({
    mutationFn: events => createEvents(events),
    onSuccess: () => {
      invalidateEvents()
      navigate('/events')
    },
    onSettled: () => setIsSubmitting(false)
  }))

  const updateMutation = useMutation<Event, Error, Partial<Event>>(() => ({
    mutationFn: event => updateEvent(eventId(), event),
    onSuccess: () => {
      invalidateEvents()
      queryClient.invalidateQueries({ queryKey: queryKeys.event(eventId()) })
      navigate(`/events/${eventId()}`)
    },
    onSettled: () => setIsSubmitting(false)
  }))

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!caption().trim()) next['caption'] = 'Název události je povinný'
    if (!startTime()) next['startTime'] = 'Čas začátku je povinný'
    if (!endTime()) next['endTime'] = 'Čas konce je povinný'
    if (startTime() && endTime() && startTime() >= endTime()) next['endTime'] = 'Konec musí být po začátku'
    if (!closeTime()) next['closeTime'] = 'Uzavření přihlášek je povinné'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault()
    if (!validate()) return

    const payload: Partial<Event> = {
      caption: caption(),
      type: type() as Event['type'],
      description: description(),
      place: place(),
      link: link(),
      startTime: formatApiDate(new Date(startTime())),
      endTime: formatApiDate(new Date(endTime())),
      closeTime: formatApiDate(new Date(closeTime()))
    }

    setIsSubmitting(true)
    if (isEdit()) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate([payload])
    }
  }

  const quickDates = [
    { label: 'Dnes', days: 0 },
    { label: 'Zítra', days: 1 },
    { label: 'Za 3 dny', days: 3 },
    { label: 'Za týden', days: 7 }
  ]

  const applyQuickDate = (days: number) => {
    const start = new Date()
    start.setDate(start.getDate() + days)
    start.setHours(18, 0, 0, 0)
    const end = new Date(start)
    end.setHours(20, 0, 0, 0)
    const close = new Date(start)
    close.setHours(12, 0, 0, 0)
    setStartTime(toLocalInput(start))
    setEndTime(toLocalInput(end))
    setCloseTime(toLocalInput(close))
  }

  return (
    <Show
      when={!isEdit() || !existingQuery.isPending}
      fallback={
        <div class="flex items-center justify-center h-64">
          <div class="flex flex-col items-center gap-4">
            <span class="icon icon-lg text-muted animate-spin" innerHTML={ICONS['spinner']} />
            <p class="text-muted">{tCommon('loading')}</p>
          </div>
        </div>
      }
    >
      <div class="max-w-2xl mx-auto">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-text">
            {isEdit() ? tEvents('editEvent') : tEvents('createEvent')}
          </h1>
          <p class="text-muted mt-1">
            {isEdit() ? 'Upravit existující událost' : 'Vytvořit novou událost pro tým'}
          </p>
        </div>

        <form onSubmit={handleSubmit} class="space-y-6">
          <fieldset class="bg-elevated rounded-xl border border-border p-5 space-y-4">
            <legend class="text-lg font-semibold text-text mb-2">Základní informace</legend>

            <div>
              <label class="label">Název události <span class="text-danger">*</span></label>
              <input
                class="input w-full mt-1"
                classList={{ 'border-danger': !!errors()['caption'] }}
                value={caption()}
                onInput={e => setCaption(e.currentTarget.value)}
                placeholder="Např. Trénink, Zápas, Schůze…"
                required
                disabled={isSubmitting()}
              />
              <Show when={errors()['caption']}>
                <p class="text-danger text-xs mt-1">{errors()['caption']}</p>
              </Show>
            </div>

            <div>
              <label class="label">Typ události</label>
              <select
                class="input w-full mt-1"
                value={type()}
                onChange={e => setType(e.currentTarget.value)}
                disabled={isSubmitting()}
              >
                <For each={eventTypesQuery.data ?? []}>
                  {(t) => <option value={t.code}>{t.caption}</option>}
                </For>
              </select>
            </div>

            <div>
              <label class="label">Popis</label>
              <textarea
                class="input w-full mt-1 min-h-[100px] resize-y"
                value={description()}
                onInput={e => setDescription(e.currentTarget.value)}
                placeholder="Podrobnosti o události…"
                disabled={isSubmitting()}
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="label">Místo</label>
                <input
                  class="input w-full mt-1"
                  value={place()}
                  onInput={e => setPlace(e.currentTarget.value)}
                  placeholder="Hřiště, adresa…"
                  disabled={isSubmitting()}
                />
              </div>
              <div>
                <label class="label">Odkaz</label>
                <input
                  type="url"
                  class="input w-full mt-1"
                  value={link()}
                  onInput={e => setLink(e.currentTarget.value)}
                  placeholder="https://…"
                  disabled={isSubmitting()}
                />
              </div>
            </div>
          </fieldset>

          <fieldset class="bg-elevated rounded-xl border border-border p-5 space-y-4">
            <legend class="text-lg font-semibold text-text mb-2">Datum a čas</legend>

            <div class="flex flex-wrap gap-2">
              <For each={quickDates}>
                {(q) => (
                  <button
                    type="button"
                    class="btn btn-secondary text-sm"
                    onClick={() => applyQuickDate(q.days)}
                    disabled={isSubmitting()}
                  >
                    {q.label}
                  </button>
                )}
              </For>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="label">Začátek <span class="text-danger">*</span></label>
                <input
                  type="datetime-local"
                  class="input w-full mt-1"
                  classList={{ 'border-danger': !!errors()['startTime'] }}
                  value={startTime()}
                  onInput={e => setStartTime(e.currentTarget.value)}
                  required
                  disabled={isSubmitting()}
                />
                <Show when={errors()['startTime']}>
                  <p class="text-danger text-xs mt-1">{errors()['startTime']}</p>
                </Show>
              </div>

              <div>
                <label class="label">Konec <span class="text-danger">*</span></label>
                <input
                  type="datetime-local"
                  class="input w-full mt-1"
                  classList={{ 'border-danger': !!errors()['endTime'] }}
                  value={endTime()}
                  onInput={e => setEndTime(e.currentTarget.value)}
                  required
                  disabled={isSubmitting()}
                />
                <Show when={errors()['endTime']}>
                  <p class="text-danger text-xs mt-1">{errors()['endTime']}</p>
                </Show>
              </div>

              <div>
                <label class="label">Uzávěrka přihlášek <span class="text-danger">*</span></label>
                <input
                  type="datetime-local"
                  class="input w-full mt-1"
                  classList={{ 'border-danger': !!errors()['closeTime'] }}
                  value={closeTime()}
                  onInput={e => setCloseTime(e.currentTarget.value)}
                  required
                  disabled={isSubmitting()}
                />
                <Show when={errors()['closeTime']}>
                  <p class="text-danger text-xs mt-1">{errors()['closeTime']}</p>
                </Show>
              </div>
            </div>
          </fieldset>

          <div class="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button type="button" class="btn btn-secondary" onClick={() => navigate(-1)} disabled={isSubmitting()}>
              {tCommon('cancel')}
            </button>
            <button type="submit" class="btn btn-primary" disabled={isSubmitting()}>
              {isSubmitting()
                ? tCommon('loading')
                : isEdit()
                  ? tEvents('editEvent')
                  : tEvents('createEvent')}
            </button>
          </div>
        </form>
      </div>
    </Show>
  )
}
