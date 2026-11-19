// Login page

import { createSignal, Show } from 'solid-js'
import { useNavigate, useLocation } from '@solidjs/router'
import { doLogin, useSessionExpired, clearSessionExpired } from '../../lib/auth'
import { getTeam, teamFromHostname, teamHost } from '../../lib/team'
import {
  getRememberedLogin,
  storeRememberedLogin,
  clearRememberedLogin
} from '../../lib/remember'
import { useCommonCaptions } from '../../lib/captions'
import { tr } from '../../lib/i18n'
import { ICONS } from '../layout/Layout'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { tAuth, tCommon, tErrors } = useCommonCaptions()

  // Credentials saved by a previous "Zapamatovat mě" login on this device (per team),
  // so an expired session does not force the user to retype everything.
  const remembered = getRememberedLogin()

  const [loginName, setLoginName] = createSignal(remembered?.login ?? '')
  const [password, setPassword] = createSignal(remembered?.password ?? '')
  const [remember, setRemember] = createSignal(remembered !== null)
  const [error, setError] = createSignal<string | null>(null)
  const [isLoading, setIsLoading] = createSignal(false)
  const [showPassword, setShowPassword] = createSignal(false)
  
  // Get redirect path from state
  const from = (location.state as { from?: string })?.from || '/events'

  const currentTeam = () => {
    const team = getTeam() ?? teamFromHostname()
    return team ? teamHost(team) : null
  }
  
  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError(null)
    clearSessionExpired()
    setIsLoading(true)
    
    try {
      await doLogin(loginName(), password())
      // Only store credentials that actually worked; unticking the box forgets them.
      if (remember()) {
        storeRememberedLogin({ login: loginName(), password: password() })
      } else {
        clearRememberedLogin()
      }
      navigate(from, { replace: true })
    } catch (err: any) {
      setError(err.message || tErrors('unknown'))
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleForgotPassword = () => {
    navigate('/forgot-password')
  }
  
  const handleRegister = () => {
    navigate('/register')
  }
  
  return (
    <div class="auth-page min-h-dvh flex items-center justify-center p-4 bg-50">
      <div class="auth-card w-full max-w-md bg-elevated rounded-xl shadow-lg border border-border p-6 animate-slide-up">
        {/* Logo/Brand */}
        <div class="text-center mb-6">
          <img
            src="/icons/icon-192.png"
            alt=""
            width="64"
            height="64"
            class="inline-block w-16 h-16 mb-4"
          />
          <h1 class="text-2xl font-bold text-text">{currentTeam() ?? 'tymy.cz'}</h1>
          <Show when={currentTeam()}>
            <button
              type="button"
              class="block mx-auto text-xs text-primary underline mt-2"
              onClick={() => navigate('/team')}
            >
              {tr('změnit tým')}
            </button>
          </Show>
        </div>
        
        {/* Expired session notice */}
        <Show when={useSessionExpired()}>
          <div class="alert mb-4 p-3 rounded-lg bg-warning-light text-warning text-sm flex items-center gap-2 animate-slide-down" role="status">
            <span class="icon flex-shrink-0" innerHTML={ICONS['clock']} />
            <span>{tr('Platnost přihlášení vypršela. Přihlaste se prosím znovu.')}</span>
          </div>
        </Show>

        {/* Error message */}
        {error() && (
          <div class="alert alert-danger mb-4 p-3 rounded-lg bg-danger-light text-danger text-sm flex items-center gap-2 animate-slide-down">
            <span class="icon flex-shrink-0" innerHTML={ICONS['alert']} />
            <span>{error()}</span>
          </div>
        )}
        
        {/* Login form */}
        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <label for="login" class="label">{tAuth('loginName')}</label>
            <input
              id="login"
              type="text"
              class="input w-full mt-1"
              value={loginName()}
              onInput={e => setLoginName(e.currentTarget.value)}
              placeholder={tr('Přihlašovací jméno')}
              autocomplete="username"
              required
              disabled={isLoading()}
              autofocus
            />
          </div>
          
          <div>
            <div class="flex justify-between mb-1">
              <label for="password" class="label">{tAuth('password')}</label>
              <button
                type="button"
                class="text-sm text-primary hover:underline"
                onClick={handleForgotPassword}
              >
                {tAuth('forgotPassword')}
              </button>
            </div>
            <div class="relative">
              <input
                id="password"
                type={showPassword() ? 'text' : 'password'}
                class="input w-full pr-10"
                value={password()}
                onInput={e => setPassword(e.currentTarget.value)}
                placeholder={tr('Heslo')}
                autocomplete="current-password"
                required
                disabled={isLoading()}
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                onClick={() => setShowPassword(!showPassword())}
                aria-label={showPassword() ? tr('Skrýt heslo') : tr('Zobrazit heslo')}
              >
                <span class="icon" innerHTML={ICONS['chevronDown']} />
              </button>
            </div>
          </div>
          
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                class="checkbox w-4 h-4 rounded border-border text-primary"
                checked={remember()}
                onChange={e => setRemember(e.currentTarget.checked)}
              />
              <span class="text-sm text-text-secondary">{tr('Zapamatovat mě')}</span>
            </label>
          </div>
          
          <button
            type="submit"
            class="btn btn-primary w-full py-3 mt-2"
            disabled={isLoading()}
          >
            {isLoading() ? (
              <span class="flex items-center justify-center gap-2">
                <span class="icon-sm animate-spin" innerHTML={ICONS['spinner']} />
                {tCommon('loading')}
              </span>
            ) : (
              tAuth('login')
            )}
          </button>
        </form>
        
        {/* Register link */}
        <p class="text-center text-sm text-muted mt-6">
          {tr('Ještě nemáte účet?')}{' '}
          <button 
            class="text-primary hover:underline font-medium"
            onClick={handleRegister}
          >
            {tAuth('register')}
          </button>
        </p>
      </div>
    </div>
  )
}