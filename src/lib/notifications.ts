// Derived in-app notifications (bell menu) and the per-user "seen" state.
//
// Push notifications exist server-side, but they have no history or read state, so the
// bell lists what is new for the current user based on endpoints the app already uses.

import { tr } from './i18n'
import { formatDisplayDate, formatDisplayTime } from './date-filters'
import type { Discussion, Event, Poll } from './types'

export type NotificationKind = 'discussion' | 'event' | 'poll'

export interface NotificationItem {
  id: string
  kind: NotificationKind
  title: string
  subtitle: string
  href: string
  unread: boolean
  timestamp?: string
}

export interface SeenState {
  version: 1
  /** discussion id → number of posts already seen */
  discussions: Record<string, number>
  /** highest event id that was present on the first run */
  lastEventId: number
  /** event ids the user opened (newer than lastEventId) */
  dismissedEvents: number[]
}

const EMPTY: SeenState = { version: 1, discussions: {}, lastEventId: 0, dismissedEvents: [] }

const storageKey = (userId: number | null) => `tymy:notifications:seen:${userId ?? 'anon'}`

export function loadSeen(userId: number | null): SeenState {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw) as Partial<SeenState>
    return {
      version: 1,
      discussions: parsed.discussions ?? {},
      lastEventId: parsed.lastEventId ?? 0,
      dismissedEvents: parsed.dismissedEvents ?? []
    }
  } catch {
    return { ...EMPTY }
  }
}

export function saveSeen(userId: number | null, state: SeenState): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state))
  } catch {
    // storage unavailable — state stays in memory only
  }
}

interface BuildArgs {
  discussions: Discussion[]
  events: Event[]
  polls: Poll[]
  seen: SeenState
  meId: number | null
}

export function buildNotifications({ discussions, events, polls, seen, meId }: BuildArgs): NotificationItem[] {
  const items: NotificationItem[] = []

  for (const discussion of discussions) {
    if (discussion.newPosts <= 0) continue
    const alreadySeen = seen.discussions[String(discussion.id)] ?? 0
    const fresh = discussion.newPosts - alreadySeen
    if (fresh <= 0) continue
    items.push({
      id: `discussion:${discussion.id}`,
      kind: 'discussion',
      title: discussion.caption,
      subtitle: tr('{n} nových příspěvků', { n: fresh }),
      href: `/discussions/${discussion.id}`,
      unread: true
    })
  }

  // The first run only records the current maximum so the menu does not open with history.
  if (seen.lastEventId > 0) {
    const fresh = events
      .filter(
        event =>
          event.id > seen.lastEventId &&
          event.createdUserId !== meId &&
          !seen.dismissedEvents.includes(event.id)
      )
      .sort((a, b) => b.id - a.id)

    for (const event of fresh) {
      const when = `${formatDisplayDate(event.startTime)} ${formatDisplayTime(event.startTime)}`
      items.push({
        id: `event:${event.id}`,
        kind: 'event',
        title: event.caption,
        subtitle: event.place ? `${when} · ${event.place}` : when,
        href: `/events/${event.id}`,
        unread: true,
        timestamp: event.created ?? event.startTime
      })
    }
  }

  const openPolls = polls
    .filter(poll => poll.status === 'OPENED' && !poll.voted)
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, 5)

  for (const poll of openPolls) {
    items.push({
      id: `poll:${poll.id}`,
      kind: 'poll',
      title: poll.caption,
      subtitle: tr('Hlasujte v anketě'),
      href: `/polls/${poll.id}`,
      unread: false,
      timestamp: poll.createdAt
    })
  }

  return items
}

export function unreadCountOf(items: NotificationItem[]): number {
  return items.filter(item => item.unread).length
}

export function discussionIdOf(item: NotificationItem): number | null {
  if (item.kind !== 'discussion') return null
  const id = Number(item.href.split('/').pop())
  return Number.isFinite(id) ? id : null
}

export function eventIdOf(item: NotificationItem): number | null {
  if (item.kind !== 'event') return null
  const id = Number(item.href.split('/').pop())
  return Number.isFinite(id) ? id : null
}
