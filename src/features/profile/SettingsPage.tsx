// App settings page

import { createSignal, For, Show } from 'solid-js'
import { doLogout } from '../../lib/auth'
import { useCommonCaptions } from '../../lib/captions'
import { tr } from '../../lib/i18n'
import { theme, setTheme, textSize, setTextSize, lang, setLang } from '../../lib/prefs'

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
            <div class="space-y-3 text-sm">
              <label class="flex items-center justify-between">
                <span class="text-text">{tr('Push notifikace pro nové zprávy')}</span>
                <Toggle />
              </label>
              <label class="flex items-center justify-between">
                <span class="text-text">{tr('Nové události a změny účastí')}</span>
                <Toggle />
              </label>
              <label class="flex items-center justify-between">
                <span class="text-text">{tr('Připomínky událostí')}</span>
                <Toggle default={false} />
              </label>
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
