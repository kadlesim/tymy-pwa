// Event detail page

import { createSignal, Show } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/solid-query'
import {
  getEvent,
  getEventHistory,
  setAttendance,
  deleteEvent,
  type Event,
  type AttendanceHistory
} from '../../lib/api'
import { queryKeys, invalidateEvents } from '../../lib/queryClient'
import { useCommonCaptions } from '../../lib/captions'
import { useAuth } from '../../lib/auth'
import { getEventStatus } from '../../lib/date-filters'
import { ICONS } from '../../lib/icons'
import EventHeader from './EventHeader'
import EventRsvp from './EventRsvp'
import EventAttendance from './EventAttendance'
import EventLink from './EventLink'

export default function EventDetailPage() {
  const params = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const auth = useAuth()
  const { tCommon } = useCommonCaptions()

  const eventId = () => parseInt(params['id'] ?? '0', 10)
  const [showHistory, setShowHistory] = createSignal(false)

  const eventQuery = useQuery<Event, Error>(() => ({
    queryKey: queryKeys.event(eventId()),
    queryFn: () => getEvent(eventId()),
    enabled: !Number.isNaN(eventId()) && eventId() > 0
  }))

  const historyQuery = useQuery<AttendanceHistory[], Error>(() => ({
    queryKey: queryKeys.eventHistory(eventId()),
    queryFn: () => getEventHistory(eventId()),
    enabled: showHistory() && !Number.isNaN(eventId()) && eventId() > 0
  }))

  const rsvpMutation = useMutation<void, Error, string>(() => ({
    mutationFn: (status: string) =>
      setAttendance([
        {
          userId: auth().user?.id ?? 0,
          eventId: eventId(),
          preStatus: status,
          preDescription: ''
        }
      ]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.event(eventId()) })
      invalidateEvents()
      eventQuery.refetch()
    }
  }))

  const deleteMutation = useMutation<void, Error, void>(() => ({
    mutationFn: () => deleteEvent(eventId()),
    onSuccess: () => {
      invalidateEvents()
      navigate('/events')
    }
  }))

  const handleDelete = () => {
    if (confirm('Opravdu chcete tuto událost smazat? Tato akce je nevratná.')) {
      deleteMutation.mutate()
    }
  }

  return (
    <Show
      when={!eventQuery.isPending}
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
        when={eventQuery.data}
        fallback={
          <div class="text-center p-8">
            <h2 class="text-xl font-semibold text-text mb-2">Událost nenalezena</h2>
            <p class="text-muted mb-4">Požadovaná událost neexistuje.</p>
            <button class="btn btn-primary" onClick={() => navigate('/events')}>Zpět k událostem</button>
          </div>
        }
      >
        {(event) => {
          const isPast = () => getEventStatus(event()) === 'past'
          const statusOptions = () => event().eventType?.preStatusSet ?? []
          const canRsvp = () => !isPast() && statusOptions().length > 0
          const myStatus = () =>
            event().myAttendance?.preStatus ??
            event().attendance?.find(a => a.userId === auth().user?.id)?.preStatus

          return (
            <div class="event-detail max-w-3xl mx-auto">
              <EventHeader
                event={event()}
                canPlan={!!event().canPlan}
                onEdit={() => navigate(`/events/${event().id}/edit`)}
                onDelete={handleDelete}
              />

              <EventRsvp
                statusOptions={statusOptions().map(s => ({ code: s.code, caption: s.caption, color: s.color }))}
                myStatus={myStatus() ?? undefined}
                canRsvp={canRsvp()}
                isPending={rsvpMutation.isPending}
                onRsvp={(code) => rsvpMutation.mutate(code)}
              />

              <Show when={event().attendance && event().attendance!.length > 0}>
                <EventAttendance
                  attendance={(event().attendance ?? []).map(a => ({
                    userId: a.userId,
                    preStatus: a.preStatus,
                    user: a.user
                      ? {
                          pictureUrl: a.user.pictureUrl,
                          callName: a.user.callName,
                          displayName: a.user.displayName,
                          login: a.user.login
                        }
                      : undefined
                  }))}
                  history={(historyQuery.data ?? []).map(h => ({
                    eventId: h.eventId,
                    userId: h.userId,
                    updatedAt: h.updatedAt,
                    updatedById: h.updatedById,
                    preStatusFrom: h.preStatusFrom,
                    preDescFrom: h.preDescFrom,
                    preStatusTo: h.preStatusTo,
                    preDescTo: h.preDescTo,
                    user: h.user,
                    updatedBy: h.updatedBy
                  }))}
                  showHistory={showHistory()}
                  onToggleHistory={() => setShowHistory(!showHistory())}
                />
              </Show>

              <EventLink link={event().link} />
            </div>
          )
        }}
      </Show>
    </Show>
  )
}
