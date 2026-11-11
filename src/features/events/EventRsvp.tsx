// "Vaše účast": compact status buttons plus an optional note (preDescription).

import { createEffect, createSignal, For, Show } from 'solid-js'
import { ICONS } from '../../lib/icons'
import { tr } from '../../lib/i18n'
import { attendanceCaption } from '../../lib/event-labels'
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
  /** Note saved with the attendance record. */
  myNote?: string
  canRsvp: boolean
  isPending: boolean
  isNotePending?: boolean
  noteError?: string | null
  onRsvp: (code: string) => void
  onNoteSave: (note: string) => void
}

export default function EventRsvp(props: EventRsvpProps) {
  const [note, setNote] = createSignal(props.myNote ?? '')

  // Keep the input in sync when the server value changes (after a save/refetch).
  createEffect(() => {
    setNote(props.myNote ?? '')
  })

  const saveNote = () => {
    const value = note().trim()
    if (value === (props.myNote ?? '').trim() || !props.myStatus) return
    props.onNoteSave(value)
  }

  const noteDirty = () => note().trim() !== (props.myNote ?? '').trim()

  return (
    <div class="event-rsvp bg-elevated rounded-xl border border-border p-4 mb-4">
      <h2 class="text-lg font-semibold text-text mb-3 flex items-center gap-2">
        <span class="icon" innerHTML={ICONS['users']} />
        {tr('Vaše účast')}
      </h2>

      <Show
        when={props.canRsvp}
        fallback={
          <div class="flex flex-wrap items-center gap-2">
            <Show
              when={props.myStatus}
              fallback={<p class="text-muted text-sm">{tr('Přihlášky na tuto událost jsou uzavřeny.')}</p>}
            >
              <span class="text-muted text-sm">{tr('Zapsaná účast:')}</span>
              <span
                class="badge px-2 py-0.5 text-xs"
                style={`background-color: var(--color-${STATUS_COLORS[props.myStatus!] || 'secondary'}); color: white`}
              >
                {attendanceCaption(props.myStatus!, STATUS_LABELS[props.myStatus!])}
              </span>
              <Show when={props.myNote}>
                <span class="text-sm text-muted">„{props.myNote}“</span>
              </Show>
            </Show>
          </div>
        }
      >
        <div class="flex flex-wrap gap-1.5">
          <For each={props.statusOptions}>
            {(option) => {
              const selected = () => props.myStatus === option.code
              const cls = () =>
                'rsvp-btn px-2.5 py-1 rounded-md text-xs font-medium transition-all ' +
                (selected() ? 'text-white' : 'bg-100 text-text-secondary hover:bg-200') +
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
                  {attendanceCaption(option.code, option.caption || STATUS_LABELS[option.code])}
                </button>
              )
            }}
          </For>
        </div>

        <div class="mt-3">
          <label class="label text-xs mb-1" for="rsvp-note">
            {tr('Poznámka')}
          </label>
          <div class="flex items-center gap-2">
            <input
              id="rsvp-note"
              type="text"
              class="input text-sm py-1.5"
              value={note()}
              maxlength={200}
              placeholder={
                props.myStatus ? tr('Nepovinná poznámka k účasti') : tr('Nejprve vyberte účast')
              }
              disabled={!props.myStatus || props.isNotePending}
              onInput={e => setNote(e.currentTarget.value)}
              onBlur={saveNote}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.currentTarget.blur()
                }
              }}
            />
            <Show when={noteDirty() && props.myStatus}>
              <button
                type="button"
                class="header-btn p-1.5 rounded-md hover:bg-100 flex-shrink-0"
                onClick={saveNote}
                disabled={props.isNotePending}
                title={tr('Uložit poznámku')}
                aria-label={tr('Uložit poznámku')}
              >
                <span class="icon-sm" innerHTML={ICONS['check']} />
              </button>
            </Show>
          </div>
          <Show when={props.noteError}>
            <p class="text-xs text-danger mt-1">{props.noteError}</p>
          </Show>
        </div>
      </Show>
    </div>
  )
}
