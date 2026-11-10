// Attendance list, grouped by what people answered.
// Only active players (status PLAYER) and people who actually filled something in are
// listed; each row shows the display name and their note, never the uppercase login.

import { createMemo, createSignal, For, Show } from 'solid-js'
import { ICONS } from '../../lib/icons'
import { apiAssetUrl } from '../../lib/api'
import { STATUS_COLORS, STATUS_LABELS } from './constants'
import { formatDisplayDateTime } from '../../lib/date-filters'

export interface AttendanceItem {
  userId: number
  preStatus?: string | null
  preDescription?: string | null
  user?: {
    pictureUrl: string
    callName: string
    displayName?: string
    login: string
    status?: string
  }
}

export interface HistoryItem {
  eventId: number
  userId: number
  updatedAt: string
  updatedById: number
  preStatusFrom?: string | null
  preDescFrom?: string | null
  preStatusTo?: string | null
  preDescTo?: string | null
  user?: { callName: string; displayName?: string }
  updatedBy?: { callName: string; displayName?: string }
}

export interface StatusOption {
  code: string
  caption: string
}

export interface EventAttendanceProps {
  attendance: AttendanceItem[]
  statusOptions: StatusOption[]
  history: HistoryItem[]
  showHistory: boolean
  onToggleHistory: () => void
}

interface Group {
  code: string | null
  label: string
  color: string
  items: AttendanceItem[]
}

const displayNameOf = (item: AttendanceItem): string =>
  item.user?.displayName || item.user?.callName || item.user?.login || `Uživatel ${item.userId}`

const isActivePlayer = (item: AttendanceItem): boolean => item.user?.status === 'PLAYER'

export default function EventAttendance(props: EventAttendanceProps) {
  // Avatars that 404 (deleted uploads) fall back to the generic user glyph.
  const [brokenAvatars, setBrokenAvatars] = createSignal<Set<number>>(new Set())

  const groups = createMemo<Group[]>(() => {
    // Active players plus anybody who actually answered (former players, sick, deleted).
    const visible = props.attendance.filter(item => isActivePlayer(item) || !!item.preStatus)

    const byStatus = new Map<string, AttendanceItem[]>()
    for (const item of visible) {
      const code = item.preStatus ?? ''
      const list = byStatus.get(code) ?? []
      list.push(item)
      byStatus.set(code, list)
    }

    const order: Group[] = props.statusOptions.map(option => ({
      code: option.code,
      label: option.caption || STATUS_LABELS[option.code] || option.code,
      color: STATUS_COLORS[option.code] ?? 'secondary',
      items: []
    }))

    const withoutStatus: Group = {
      code: null,
      label: 'Bez odpovědi',
      color: 'secondary',
      items: []
    }

    for (const [code, items] of byStatus) {
      const sorted = [...items].sort((a, b) => displayNameOf(a).localeCompare(displayNameOf(b), 'cs'))
      const group = code ? order.find(g => g.code === code) : undefined
      if (group) group.items = sorted
      else if (!code) withoutStatus.items = sorted
      else order.push({ code, label: STATUS_LABELS[code] ?? code, color: STATUS_COLORS[code] ?? 'secondary', items: sorted })
    }

    return [...order, withoutStatus].filter(group => group.items.length > 0)
  })

  const total = createMemo(() => groups().reduce((sum, group) => sum + group.items.length, 0))

  return (
    <Show when={props.attendance.length > 0}>
      <div class="event-attendance bg-elevated rounded-xl border border-border overflow-hidden mb-4">
        <div class="p-4 border-b border-border flex items-center justify-between gap-2">
          <h2 class="text-lg font-semibold text-text flex items-center gap-2">
            <span class="icon" innerHTML={ICONS['users']} />
            Účast ({total()})
          </h2>
          <button class="btn btn-secondary text-sm" onClick={props.onToggleHistory}>
            {props.showHistory ? 'Skrýt historii' : 'Historie změn'}
          </button>
        </div>

        <For each={groups()}>
          {group => (
            <section class="attendance-group border-t border-border-light first:border-t-0">
              <header class="flex items-center gap-2 px-4 py-2 bg-50">
                <span
                  class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={`background-color: var(--color-${group.color})`}
                />
                <span class="text-sm font-medium text-text">{group.label}</span>
                <span class="text-xs text-muted">{group.items.length}</span>
              </header>

              <div class="divide-y divide-border-light">
                <For each={group.items}>
                  {item => (
                    <div class="attendance-item px-4 py-2 flex items-center gap-3">
                      <Show
                        when={
                          item.user?.pictureUrl && !brokenAvatars().has(item.userId)
                            ? item.user.pictureUrl
                            : undefined
                        }
                        fallback={
                          <span class="w-8 h-8 rounded-full bg-secondary-light flex items-center justify-center text-muted flex-shrink-0">
                            <span class="icon-sm" innerHTML={ICONS['user']} />
                          </span>
                        }
                      >
                        {(pictureUrl) => (
                          <img
                            src={apiAssetUrl(pictureUrl())}
                            alt=""
                            loading="lazy"
                            class="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0"
                            onError={() => setBrokenAvatars(prev => new Set(prev).add(item.userId))}
                          />
                        )}
                      </Show>

                      <div class="min-w-0 flex-1">
                        <p class="text-sm text-text truncate">{displayNameOf(item)}</p>
                        <Show when={item.preDescription}>
                          <p class="text-xs text-muted truncate" title={item.preDescription!}>
                            {item.preDescription}
                          </p>
                        </Show>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </section>
          )}
        </For>

        <Show when={props.showHistory && props.history.length > 0}>
          <div class="event-history p-4 bg-50 border-t border-border">
            <h3 class="text-sm font-medium text-text mb-3">Historie změn účastí</h3>
            <div class="space-y-2 max-h-64 overflow-y-auto">
              <For each={props.history}>
                {(h) => (
                  <div class="history-item text-sm p-2 bg-elevated rounded">
                    <div class="flex items-center gap-2 text-muted mb-1">
                      <span class="font-medium text-text">{h.user?.displayName || h.user?.callName || 'Neznámý'}</span>
                      <span>•</span>
                      <span>{formatDisplayDateTime(h.updatedAt)}</span>
                    </div>
                    <div class="flex items-center gap-2 ml-6">
                      <Show when={h.preStatusFrom}>
                        {(from) => (
                          <>
                            <span
                              class="badge text-xs"
                              style={`background-color: var(--color-${STATUS_COLORS[from()] || 'secondary'}); color: white`}
                            >
                              {STATUS_LABELS[from()] || from()}
                            </span>
                            <span class="icon text-muted" innerHTML={ICONS['chevronDown']} />
                          </>
                        )}
                      </Show>
                      <Show when={h.preStatusTo}>
                        {(to) => (
                          <span
                            class="badge text-xs"
                            style={`background-color: var(--color-${STATUS_COLORS[to()] || 'secondary'}); color: white`}
                          >
                            {STATUS_LABELS[to()] || to()}
                          </span>
                        )}
                      </Show>
                      <Show when={h.preDescTo}>
                        <span class="text-muted text-xs">({h.preDescTo})</span>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  )
}
