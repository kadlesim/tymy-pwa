// App settings page

import { createSignal, For, onMount, Show } from 'solid-js'
import { doLogout } from '../../lib/auth'
import { useCommonCaptions } from '../../lib/captions'
import { tr } from '../../lib/i18n'
import { theme, setTheme, textSize, setTextSize, lang, setLang } from '../../lib/prefs'
import {
  disablePush,
  enablePush,
  getPushState,
  type PushState
} from '../../lib/push'

type Section = 'notifications' | 'privacy' | 'appearance' | 'account'

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'notifications', label: 'Notifikace' },
  { id: 'privacy', label: 'Soukromí' },
  { id: 'appearance', label: 'Vzhled' },
  { id: 'account', label: 'Účet' }
]

function Toggle(props: { default?: boolean }) {
  const [on, setOn] = createSignal(props.default ?? true)
  return (
    <input
      type="checkbox"
      class="checkbox w-5 h-5"
      checked={on()}
      onChange={e => setOn(e.currentTarget.checked)}
    />
  )
}

export default function SettingsPage() {
  const { tProfile, tAuth } = useCommonCaptions()
  const [section, setSection] = createSignal<Section>('notifications')

  const [pushState, setPushState] = createSignal<PushState>('unsupported')
  const [pushBusy, setPushBusy] = createSignal(false)
  const [pushError, setPushError] = createSignal<string | null>(null)

  const refreshPushState = async () => {
    setPushState(await getPushState())
  }

  onMount(() => {
    void refreshPushState()
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => void refreshPushState()).catch(() => {})
    }
  })

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

  const handleLogout = async () => {
    if (confirm(tr('Opravdu se chcete odhlásit?'))) {
      await doLogout()
    }
  }

  return (
    <div class="settings-page max-w-2xl mx-auto">
      <h1 class="text-2xl font-bold text-text mb-6">{tProfile('settings')}</h1>

      <div class="flex gap-6">
        <nav class="w-44 flex-shrink-0">
          <ul class="space-y-1">
            <For each={SECTIONS}>
              {(s) => (
                <li>
                  <button
                    class="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    classList={{
                      'bg-primary-light text-primary': section() === s.id,
                      'text-text-secondary hover:bg-100': section() !== s.id
                    }}
                    onClick={() => setSection(s.id)}
                  >
                    {tr(s.label)}
                  </button>
                </li>
              )}
            </For>
          </ul>
        </nav>

        <div class="flex-1 bg-elevated rounded-xl border border-border p-6">
          <Show when={section() === 'notifications'}>
            <h2 class="text-lg font-semibold text-text mb-4">{tr('Notifikace')}</h2>
            <div class="space-y-4 text-sm">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <p class="font-medium text-text">{tr('Push notifikace')}</p>
                  <p class="text-xs text-muted mt-1">
                    {tr('Server posílá notifikace pro nové příspěvky v diskuzích a pro nové nebo změněné události.')}
                  </p>
                </div>
                <Show
                  when={pushState() === 'off' || pushState() === 'subscribed' || pushState() === 'denied'}
                  fallback={
                    <span class="badge bg-secondary-light text-secondary flex-shrink-0">
                      {tr('Nedostupné')}
                    </span>
                  }
                >
                  <button
                    type="button"
                    class="btn btn-sm btn-secondary flex-shrink-0"
                    disabled={pushBusy() || pushState() === 'denied'}
                    onClick={togglePush}
                  >
                    {pushBusy()
                      ? tr('Ukládám…')
                      : pushState() === 'subscribed'
                        ? tr('Vypnout notifikace')
                        : tr('Zapnout notifikace')}
                  </button>
                </Show>
              </div>

              <Show when={pushState() === 'subscribed'}>
                <p class="text-xs text-success">{tr('Notifikace jsou v tomto prohlížeči zapnuté.')}</p>
              </Show>
              <Show when={pushState() === 'denied'}>
                <p class="text-xs text-danger">{tr('Notifikace jsou v prohlížeči zakázané.')}</p>
              </Show>
              <Show when={pushState() === 'unsupported'}>
                <p class="text-xs text-muted">{tr('Tento prohlížeč notifikace nepodporuje.')}</p>
              </Show>
              <Show when={pushState() === 'insecure'}>
                <p class="text-xs text-muted">{tr('Notifikace vyžadují zabezpečené připojení (HTTPS).')}</p>
              </Show>
              <Show when={pushState() === 'no-sw'}>
                <p class="text-xs text-muted">{tr('Notifikace nejsou v tomto prostředí dostupné.')}</p>
              </Show>
              <Show when={pushError()}>
                <p class="text-xs text-danger">{pushError()}</p>
              </Show>

              <p class="text-xs text-muted border-t border-border-light pt-3">
                {tr('Na iPhonu fungují notifikace jen v aplikaci nainstalované na plochu.')}
              </p>
            </div>
          </Show>

          <Show when={section() === 'privacy'}>
            <h2 class="text-lg font-semibold text-text mb-4">{tr('Soukromí')}</h2>
            <div class="space-y-3 text-sm">
              <label class="flex items-center justify-between">
                <span class="text-text">{tr('Profil viditelný pro členy týmu')}</span>
                <Toggle />
              </label>
              <label class="flex items-center justify-between">
                <span class="text-text">{tr('Zobrazit moji účast na událostech')}</span>
                <Toggle />
              </label>
            </div>
          </Show>

          <Show when={section() === 'appearance'}>
            <h2 class="text-lg font-semibold text-text mb-4">{tr('Vzhled')}</h2>
            <div class="space-y-4 text-sm">
              <div>
                <label class="label">{tr('Jazyk')}</label>
                <select
                  class="input w-full max-w-xs mt-1"
                  value={lang()}
                  onChange={e => setLang(e.currentTarget.value === 'en' ? 'en' : 'cs')}
                >
                  <option value="cs">{tr('Čeština')}</option>
                  <option value="en">{tr('Angličtina')}</option>
                </select>
              </div>
              <div>
                <label class="label">{tr('Vzhled')}</label>
                <div class="flex gap-2 mt-1">
                  <button
                    type="button"
                    class="btn btn-secondary"
                    classList={{ 'bg-primary-light text-primary': theme() === 'light' }}
                    onClick={() => setTheme('light')}
                  >
                    {tr('Světlý')}
                  </button>
                  <button
                    type="button"
                    class="btn btn-secondary"
                    classList={{ 'bg-primary-light text-primary': theme() === 'dark' }}
                    onClick={() => setTheme('dark')}
                  >
                    {tr('Tmavý')}
                  </button>
                </div>
              </div>
              <div>
                <label class="label">{tr('Velikost textu')}</label>
                <div class="flex gap-2 mt-1">
                  <button
                    type="button"
                    class="btn btn-secondary"
                    classList={{ 'bg-primary-light text-primary': textSize() === 'normal' }}
                    onClick={() => setTextSize('normal')}
                  >
                    {tr('Menší text')}
                  </button>
                  <button
                    type="button"
                    class="btn btn-secondary"
                    classList={{ 'bg-primary-light text-primary': textSize() === 'large' }}
                    onClick={() => setTextSize('large')}
                  >
                    {tr('Větší text')}
                  </button>
                </div>
              </div>
            </div>
          </Show>

          <Show when={section() === 'account'}>
            <h2 class="text-lg font-semibold text-text mb-4">{tr('Účet')}</h2>
            <div class="space-y-3">
              <button class="btn btn-secondary w-full justify-start">{tr('Změnit heslo')}</button>
              <button class="btn btn-danger w-full justify-start" onClick={handleLogout}>
                {tAuth('logout')}
              </button>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}
