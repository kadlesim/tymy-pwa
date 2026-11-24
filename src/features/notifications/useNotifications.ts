// Queries + seen state behind the notification bell and the nav badges.

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
  type NotificationKind,
  type SeenState
} from '../../lib/notifications'

// The bell and the layout's nav badges each call this hook, so the "seen" state lives in
// module scope: opening a notification in the bell also clears the badge in the nav.
const [seenState, setSeenState] = createSignal<SeenState>(loadSeen(null))
let seenUserId: number | null = null
let seenBound = false

/** Reloads the stored high-water marks when the signed-in account changes. */
function syncSeenUser(userId: number | null) {
  if (seenBound && seenUserId === userId) return
  seenBound = true
  seenUserId = userId
  setSeenState(loadSeen(userId))
}

export function useNotifications() {
  const auth = useAuth()
  const userId = () => auth().user?.id ?? null

  // Different user on the same browser → different seen state.
  createEffect(() => syncSeenUser(userId()))

  const seen = seenState
  const updateSeen = (next: SeenState) => {
    setSeenState(next)
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

  // Per-section totals for the navigation badges: everything the bell would list.
  const counts = createMemo<Record<NotificationKind, number>>(() => {
    const byKind: Record<NotificationKind, number> = { discussion: 0, event: 0, poll: 0 }
    for (const item of items()) byKind[item.kind] += 1
    return byKind
  })

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
    counts,
    isLoading: () => discussionsQuery.isPending || eventsQuery.isPending,
    isError: () => discussionsQuery.isError || eventsQuery.isError,
    refetch,
    markRead,
    markAllRead
  }
}
