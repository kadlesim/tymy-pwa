// Bell button + notification menu (derived feed) with the Web Push toggle.

import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { ICONS } from '../../lib/icons'
import { tr } from '../../lib/i18n'
import { disablePush, enablePush, getPushState, type PushState } from '../../lib/push'
import { useNotifications } from './useNotifications'

const KIND_ICON: Record<string, string> = {
  discussion: 'chat',
  event: 'calendar',
  poll: 'poll'
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const { items, unreadCount, isLoading, isError, refetch, markRead, markAllRead } = useNotifications()

  const [open, setOpen] = createSignal(false)
  const [pushState, setPushState] = createSignal<PushState>('unsupported')
  const [pushBusy, setPushBusy] = createSignal(false)
  const [pushError, setPushError] = createSignal<string | null>(null)

  const refreshPushState = async () => {
    setPushState(await getPushState())
  }

  onMount(() => {
    void refreshPushState()
    // First load: the SW may still be installing, so re-check once it is active.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => void refreshPushState()).catch(() => {})
    }

    const onClickOutside = (event: MouseEvent) => {
      if (!open()) return
      const path = event.composedPath() as Array<Element | Window>
      const inside = path.some(
        el =>
          el instanceof Element &&
          (el.classList?.contains('notifications-menu') ||
            el.getAttribute?.('data-toggle') === 'notifications')
      )
      if (!inside) setOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('click', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    onCleanup(() => {
      document.removeEventListener('click', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    })
  })

  const openItem = (href: string, id: string) => {
    const item = items().find(entry => entry.id === id)
    if (item) markRead(item)
    setOpen(false)
    navigate(href)
  }

  const togglePush = async () => {
    setPushBusy(true)
    setPushError(null)
    try {
      if (pushState() === 'subscribed') {
        await disablePush()
      } else {
        const next = await enablePush()
        if (next === 'denied') setPushError(tr('Notifikace jsou v prohlížeči zakázané.'))
        else if (next !== 'subscribed') setPushError(tr('Notifikace se nepodařilo zapnout.'))
      }
      await refreshPushState()
    } finally {
      setPushBusy(false)
    }
  }

  const badge = () => (unreadCount() > 99 ? '99+' : String(unreadCount()))

  return (
    <div class="notifications-menu relative">
      <button
        type="button"
        class="header-btn relative p-2 rounded-lg hover:bg-100"
        data-toggle="notifications"
        aria-label={unreadCount() > 0 ? tr('Notifikace ({n})', { n: unreadCount() }) : tr('Notifikace')}
        aria-expanded={open()}
        onClick={() => setOpen(!open())}
      >
        <span class="icon" innerHTML={ICONS['bell']} />
        <Show when={unreadCount() > 0}>
          <span class="absolute top-0 right-0 min-w-[1rem] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-semibold leading-4 text-center">
            {badge()}
          </span>
        </Show>
      </button>

      <Show when={open()}>
        <div class="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-elevated rounded-lg shadow-lg border border-border overflow-hidden z-50">
          <div class="flex items-center justify-between px-3 py-2 border-b border-border">
            <p class="text-sm font-semibold text-text">{tr('Notifikace')}</p>
            <button
              type="button"
              class="header-btn p-1 rounded-md hover:bg-100"
              aria-label={tr('Zavřít')}
              onClick={() => setOpen(false)}
            >
              <span class="icon-sm" innerHTML={ICONS['close']} />
            </button>
          </div>

          <div class="max-h-[60vh] overflow-y-auto">
            <Show
              when={!isLoading()}
              fallback={
                <div class="flex items-center justify-center py-8">
                  <span class="icon text-muted animate-spin" innerHTML={ICONS['spinner']} />
                </div>
              }
            >
              <Show
                when={!isError()}
                fallback={
                  <div class="text-center px-4 py-6">
                    <p class="text-sm text-danger mb-3">{tr('Notifikace se nepodařilo načíst.')}</p>
                    <button type="button" class="btn btn-sm btn-secondary" onClick={refetch}>
                      {tr('Zkusit znovu')}
                    </button>
                  </div>
                }
              >
                <Show
                  when={items().length > 0}
                  fallback={
                    <div class="text-center px-4 py-8">
                      <div class="icon icon-lg text-muted mb-2" innerHTML={ICONS['check']} />
                      <p class="text-sm text-muted">{tr('Žádné nové notifikace')}</p>
                    </div>
                  }
                >
                  <For each={items()}>
                    {item => (
                      <button
                        type="button"
                        class="w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-50 border-b border-border-light last:border-b-0"
                        onClick={() => openItem(item.href, item.id)}
                      >
                        <span
                          class="icon-sm text-muted mt-0.5"
                          innerHTML={ICONS[KIND_ICON[item.kind] ?? 'bell']}
                        />
                        <span class="flex-1 min-w-0">
                          <span class="block text-sm font-medium text-text truncate">{item.title}</span>
                          <span class="block text-xs text-muted truncate">{item.subtitle}</span>
                        </span>
                        <Show when={item.unread}>
                          <span class="w-2 h-2 rounded-full bg-danger mt-2 flex-shrink-0" />
                        </Show>
                      </button>
                    )}
                  </For>
                </Show>
              </Show>
            </Show>
          </div>

          <div class="px-3 py-2 border-t border-border space-y-2">
            <Show when={unreadCount() > 0}>
              <button type="button" class="btn btn-sm btn-secondary w-full" onClick={markAllRead}>
                {tr('Označit vše jako přečtené')}
              </button>
            </Show>
            <Show when={pushState() !== 'unsupported' && pushState() !== 'denied'}>
              <button
                type="button"
                class="btn btn-sm btn-secondary w-full"
                disabled={pushBusy()}
                onClick={togglePush}
              >
                {pushState() === 'subscribed' ? tr('Vypnout notifikace') : tr('Zapnout notifikace')}
              </button>
            </Show>
            <Show when={pushState() === 'denied'}>
              <p class="text-xs text-muted">{tr('Notifikace jsou v prohlížeči zakázané.')}</p>
            </Show>
            <Show when={pushError()}>
              <p class="text-xs text-danger">{pushError()}</p>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}
