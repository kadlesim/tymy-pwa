// Team selection – the step in front of the login screen. Every Tymy team lives on
// `<subdomain>.tymy.cz`, and the API has to be asked on that host, so the choice is
// stored before the user logs in. Skipped automatically for a valid session.

import { createSignal, Show } from 'solid-js'
import { useLocation, useNavigate } from '@solidjs/router'
import { checkTeam } from '../../lib/api'
import { TEAM_DOMAIN, normalizeTeam, storeTeam, suggestedTeam } from '../../lib/team'
import { useCommonCaptions } from '../../lib/captions'
import { ICONS } from '../../lib/icons'

export default function TeamPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { tCommon } = useCommonCaptions()

  const from = (location.state as { from?: string } | undefined)?.from

  const [name, setName] = createSignal(suggestedTeam())
  const [error, setError] = createSignal<string | null>(null)
  const [checking, setChecking] = createSignal(false)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    const team = normalizeTeam(name())
    if (!team) {
      setError('Zadejte prosím adresu týmu.')
      return
    }

    setError(null)
    setChecking(true)
    try {
      const found = await checkTeam(team)
      if (!found) {
        setError(`Tým „${team}.${TEAM_DOMAIN}“ nebyl nalezen.`)
        return
      }
      storeTeam(team)
      navigate('/login', { state: from ? { from } : undefined })
    } finally {
      setChecking(false)
    }
  }

  return (
    <div class="auth-page min-h-dvh flex items-center justify-center p-4 bg-50">
      <div class="auth-card w-full max-w-md bg-elevated rounded-xl shadow-lg border border-border p-6 animate-slide-up">
        <div class="text-center mb-6">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-primary-light mb-4">
            <span class="icon icon-lg text-primary" innerHTML={ICONS['users']} />
          </div>
          <h1 class="text-2xl font-bold text-text">tymy.cz</h1>
        </div>

        <form onSubmit={handleSubmit} class="space-y-4">
          <div class="flex items-center justify-center gap-2">
            <input
              id="team"
              type="text"
              class="input text-center font-medium"
              style="width: 5.5rem"
              value={name()}
              onInput={e => {
                setName(e.currentTarget.value)
                setError(null)
              }}
              placeholder="tym"
              aria-label="Adresa týmu"
              autocomplete="off"
              autocapitalize="none"
              spellcheck={false}
              maxlength={40}
              required
              disabled={checking()}
              autofocus
            />
            <span class="text-xl font-semibold text-text leading-none whitespace-nowrap">
              .{TEAM_DOMAIN}
            </span>
          </div>
          <p class="text-xs text-muted text-center">
            Například <span class="font-medium text-text">dev.{TEAM_DOMAIN}</span>
          </p>

          <Show when={error()}>
            <div class="alert alert-danger p-3 rounded-lg bg-danger-light text-danger text-sm flex items-center gap-2 animate-slide-down" role="alert">
              <span class="icon flex-shrink-0" innerHTML={ICONS['alert']} />
              <span>{typeof error() === 'string' ? error() : ''}</span>
            </div>
          </Show>

          <button type="submit" class="btn btn-primary w-full py-3 mt-2" disabled={checking()}>
            {checking() ? (
              <span class="flex items-center justify-center gap-2">
                <span class="icon-sm animate-spin" innerHTML={ICONS['spinner']} />
                {tCommon('loading')}
              </span>
            ) : (
              <span class="flex items-center justify-center gap-2">
                <span class="icon-sm" innerHTML={ICONS['back']} style="transform: rotate(180deg)" />
                Pokračovat na přihlášení
              </span>
            )}
          </button>
        </form>

        <p class="text-xs text-muted text-center mt-6">
          Adresu týmu najdete v e-mailu od správce týmu.
        </p>
      </div>
    </div>
  )
}
