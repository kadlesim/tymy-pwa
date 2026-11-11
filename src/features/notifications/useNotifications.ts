// Queries + seen state behind the notification bell.

import { createEffect, createMemo, createSignal } from 'solid-js'
import { useQuery } from '@tanstack/solid-query'
import {
  getDiscussionsWithNew,
  getEvents,
  getMenuPolls,
  type Discussion,
  type Event,
  type Poll
} from '../../lib/api'
import { queryKeys } from '../../lib/queryClient'
import { useAuth } from '../../lib/auth'
import {
  buildNotifications,
  discussionIdOf,
  eventIdOf,
  loadSeen,
  saveSeen,
  unreadCountOf,
  type NotificationItem,
  type SeenState
} from '../../lib/notifications'

export function useNotifications() {
  const auth = useAuth()
  const userId = () => auth().user?.id ?? null

  const [seen, setSeen] = createSignal<SeenState>(loadSeen(userId()))

  // Different user on the same browser → different seen state.
  createEffect(() => {
    setSeen(loadSeen(userId()))
  })

  const updateSeen = (next: SeenState) => {
    setSeen(next)
    saveSeen(userId(), next)
  }

  const discussionsQuery = useQuery<Discussion[], Error>(() => ({
    queryKey: queryKeys.discussionsWithNew(),
    queryFn: getDiscussionsWithNew,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
    enabled: userId() !== null
  }))

  // Lightweight collection (no attendance arrays), newest ids first.
  const eventsQuery = useQuery<Event[], Error>(() => ({
    queryKey: ['events', 'notifications'],
    queryFn: () => getEvents({ order: 'id', limit: 20 }),
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 120,
    enabled: userId() !== null
  }))

  const pollsQuery = useQuery<Poll[], Error>(() => ({
    queryKey: queryKeys.menuPolls(),
    queryFn: getMenuPolls,
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 120,
    enabled: userId() !== null
  }))

  // First load: remember the newest event id instead of presenting the whole history.
  createEffect(() => {
    const list = eventsQuery.data
    if (!list || list.length === 0 || seen().lastEventId > 0) return
    const maxId = Math.max(...list.map(event => event.id))
    updateSeen({ ...seen(), lastEventId: maxId })
  })

  const items = createMemo<NotificationItem[]>(() =>
    buildNotifications({
      discussions: discussionsQuery.data ?? [],
      events: eventsQuery.data ?? [],
      polls: pollsQuery.data ?? [],
      seen: seen(),
      meId: userId()
    })
  )

  const unreadCount = createMemo(() => unreadCountOf(items()))

  const markRead = (item: NotificationItem) => {
    const current = seen()

    const discussionId = discussionIdOf(item)
    if (discussionId !== null) {
      const discussion = (discussionsQuery.data ?? []).find(entry => entry.id === discussionId)
      updateSeen({
        ...current,
        discussions: {
          ...current.discussions,
          [String(discussionId)]: discussion?.newPosts ?? 0
        }
      })
      return
    }

    const eventId = eventIdOf(item)
    if (eventId !== null && !current.dismissedEvents.includes(eventId)) {
      updateSeen({
        ...current,
        dismissedEvents: [...current.dismissedEvents, eventId].slice(-100)
      })
    }
  }

  const markAllRead = () => {
    const discussions: Record<string, number> = {}
    for (const discussion of discussionsQuery.data ?? []) {
      discussions[String(discussion.id)] = discussion.newPosts
    }
    const maxEventId = Math.max(0, ...(eventsQuery.data ?? []).map(event => event.id))
    updateSeen({ version: 1, discussions, lastEventId: maxEventId, dismissedEvents: [] })
  }

  const refetch = () => {
    void discussionsQuery.refetch()
    void eventsQuery.refetch()
    void pollsQuery.refetch()
  }

  return {
    items,
    unreadCount,
    isLoading: () => discussionsQuery.isPending || eventsQuery.isPending,
    isError: () => discussionsQuery.isError || eventsQuery.isError,
    refetch,
    markRead,
    markAllRead
  }
}
