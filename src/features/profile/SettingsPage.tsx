// App settings page

import { createSignal, For, Show } from 'solid-js'
import { doLogout } from '../../lib/auth'
import { useCommonCaptions } from '../../lib/captions'

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

  const handleLogout = async () => {
    if (confirm('Opravdu se chcete odhlásit?')) {
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
                    {s.label}
                  </button>
                </li>
              )}
            </For>
          </ul>
        </nav>

        <div class="flex-1 bg-elevated rounded-xl border border-border p-6">
          <Show when={section() === 'notifications'}>
            <h2 class="text-lg font-semibold text-text mb-4">Notifikace</h2>
            <div class="space-y-3 text-sm">
              <label class="flex items-center justify-between">
                <span class="text-text">Push notifikace pro nové zprávy</span>
                <Toggle />
              </label>
              <label class="flex items-center justify-between">
                <span class="text-text">Nové události a změny účastí</span>
                <Toggle />
              </label>
              <label class="flex items-center justify-between">
                <span class="text-text">Připomínky událostí</span>
                <Toggle default={false} />
              </label>
            </div>
          </Show>

          <Show when={section() === 'privacy'}>
            <h2 class="text-lg font-semibold text-text mb-4">Soukromí</h2>
            <div class="space-y-3 text-sm">
              <label class="flex items-center justify-between">
                <span class="text-text">Profil viditelný pro členy týmu</span>
                <Toggle />
              </label>
              <label class="flex items-center justify-between">
                <span class="text-text">Zobrazit moji účast na událostech</span>
                <Toggle />
              </label>
            </div>
          </Show>

          <Show when={section() === 'appearance'}>
            <h2 class="text-lg font-semibold text-text mb-4">Vzhled</h2>
            <label class="label">Jazyk</label>
            <select class="input w-full max-w-xs mt-1">
              <option value="CZ">Čeština</option>
              <option value="EN">English</option>
            </select>
          </Show>

          <Show when={section() === 'account'}>
            <h2 class="text-lg font-semibold text-text mb-4">Účet</h2>
            <div class="space-y-3">
              <button class="btn btn-secondary w-full justify-start">Změnit heslo</button>
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
