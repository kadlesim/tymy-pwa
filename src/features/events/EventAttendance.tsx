import { For, Show } from 'solid-js'
import { ICONS } from '../../lib/icons'
import { apiAssetUrl } from '../../lib/api'
import { STATUS_COLORS, STATUS_LABELS } from './constants'
import { formatDisplayDateTime } from '../../lib/date-filters'

export interface AttendanceItem {
  userId: number
  user?: { pictureUrl: string; callName: string; displayName?: string; login: string }
  preStatus?: string | null
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

export interface EventAttendanceProps {
  attendance: AttendanceItem[]
  history: HistoryItem[]
  showHistory: boolean
  onToggleHistory: () => void
}

export default function EventAttendance(props: EventAttendanceProps) {
  return (
    <Show when={props.attendance.length > 0}>
      <div class="event-attendance bg-elevated rounded-xl border border-border overflow-hidden mb-4">
        <div class="p-4 border-b border-border flex items-center justify-between">
          <h2 class="text-lg font-semibold text-text flex items-center gap-2">
            <span class="icon" innerHTML={ICONS['users']} />
            Přihlášeni ({props.attendance.length})
          </h2>
          <button class="btn btn-secondary text-sm" onClick={props.onToggleHistory}>
            {props.showHistory ? 'Skrýt historii' : 'Historie změn'}
          </button>
        </div>

        <div class="divide-y divide-border">
          <For each={props.attendance}>
            {(att) => (
              <div class="attendance-item p-4 flex items-center gap-3">
                <Show when={att.user}>
                  <img src={apiAssetUrl(att.user!.pictureUrl)} alt="" class="w-10 h-10 rounded-full object-cover border border-border" />
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-text truncate">{att.user!.callName || att.user!.displayName}</p>
                    <p class="text-xs text-muted">{att.user!.login}</p>
                  </div>
                  <Show when={att.preStatus}>
                    <span
                      class="badge px-2 py-1 text-sm"
                      style={`background-color: var(--color-${STATUS_COLORS[att.preStatus!] || 'secondary'}); color: white`}
                    >
                      {STATUS_LABELS[att.preStatus!] || att.preStatus}
                    </span>
                  </Show>
                </Show>
              </div>
            )}
          </For>
        </div>

        <Show when={props.showHistory && props.history.length > 0}>
          <div class="event-history p-4 bg-50 border-t border-border">
            <h3 class="text-sm font-medium text-text mb-3">Historie změn účastí</h3>
            <div class="space-y-2 max-h-64 overflow-y-auto">
              <For each={props.history}>
                {(h) => (
                  <div class="history-item text-sm p-2 bg-elevated rounded">
                    <div class="flex items-center gap-2 text-muted mb-1">
                      <span class="font-medium text-text">{h.user?.callName || h.user?.displayName || 'Neznámý'}</span>
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
