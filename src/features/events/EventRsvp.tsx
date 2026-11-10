import { For } from 'solid-js'
import { ICONS } from '../../lib/icons'
import { STATUS_COLORS, STATUS_LABELS } from './constants'

export interface RsvpOption {
  code: string
  caption: string
  /** Raw RGB hex without '#'. */
  color?: string
}

export interface EventRsvpProps {
  statusOptions: RsvpOption[]
  myStatus?: string
  canRsvp: boolean
  isPending: boolean
  onRsvp: (code: string) => void
}

export default function EventRsvp(props: EventRsvpProps) {
  return (
    <div class="event-rsvp bg-elevated rounded-xl border border-border p-4 mb-4">
      <h2 class="text-lg font-semibold text-text mb-3 flex items-center gap-2">
        <span class="icon" innerHTML={ICONS['users']} />
        Vaše účast
      </h2>

      {props.canRsvp ? (
        <div class="flex flex-wrap gap-2">
          <For each={props.statusOptions}>
            {(option) => {
              const selected = () => props.myStatus === option.code
              const cls = () =>
                'rsvp-btn px-4 py-2 rounded-lg font-medium transition-all flex-1 min-w-[110px] ' +
                (selected() ? 'text-white shadow-md' : 'bg-100 text-text-secondary hover:bg-200') +
                (props.isPending ? ' opacity-50 cursor-wait' : '')
              const background = () =>
                option.color
                  ? `background-color: #${option.color}`
                  : `background-color: var(--color-${STATUS_COLORS[option.code] || 'secondary'})`
              return (
                <button
                  class={cls()}
                  style={selected() ? background() : undefined}
                  onClick={() => props.onRsvp(option.code)}
                  disabled={props.isPending || selected()}
                  aria-pressed={selected()}
                >
                  {STATUS_LABELS[option.code] || option.caption}
                </button>
              )
            }}
          </For>
        </div>
      ) : (
        <div class="flex items-center gap-2">
          {props.myStatus ? (
            <>
              <span class="text-muted text-sm">Zapsaná účast:</span>
              <span
                class="badge px-3 py-1"
                style={`background-color: var(--color-${STATUS_COLORS[props.myStatus] || 'secondary'}); color: white`}
              >
                {STATUS_LABELS[props.myStatus] || props.myStatus}
              </span>
            </>
          ) : (
            <p class="text-muted text-sm">Přihlášky na tuto událost jsou uzavřeny.</p>
          )}
        </div>
      )}
    </div>
  )
}
