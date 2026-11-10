// Login page

import { createSignal } from 'solid-js'
import { useNavigate, useLocation } from '@solidjs/router'
import { doLogin } from '../../lib/auth'
import { useCommonCaptions } from '../../lib/captions'
import { ICONS } from '../layout/Layout'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { tAuth, tCommon, tErrors } = useCommonCaptions()
  
  const [loginName, setLoginName] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [remember, setRemember] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [isLoading, setIsLoading] = createSignal(false)
  const [showPassword, setShowPassword] = createSignal(false)
  
  // Get redirect path from state
  const from = (location.state as { from?: string })?.from || '/events'
  
  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    
    try {
      await doLogin(loginName(), password())
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
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-primary-light mb-4">
            <span class="icon text-primary" innerHTML={ICONS['calendar']} />
          </div>
          <h1 class="text-2xl font-bold text-text">Týmový manažer</h1>
          <p class="text-muted mt-1">Přihlaste se pro přístup k událostem a chatu</p>
        </div>
        
        {/* Error message */}
        {error() && (
          <div class="alert alert-danger mb-4 p-3 rounded-lg bg-danger-light text-danger text-sm flex items-center gap-2 animate-slide-down">
            <span class="icon flex-shrink-0">⚠️</span>
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
              placeholder="Přihlašovací jméno"
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
                placeholder="Heslo"
                autocomplete="current-password"
                required
                disabled={isLoading()}
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                onClick={() => setShowPassword(!showPassword())}
                aria-label={showPassword() ? 'Skrýt heslo' : 'Zobrazit heslo'}
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
              <span class="text-sm text-text-secondary">Zapamatovat mě</span>
            </label>
          </div>
          
          <button
            type="submit"
            class="btn btn-primary w-full py-3 mt-2"
            disabled={isLoading()}
          >
            {isLoading() ? (
              <span class="flex items-center justify-center gap-2">
                <span class="animate-spin">⏳</span>
                {tCommon('loading')}
              </span>
            ) : (
              tAuth('login')
            )}
          </button>
        </form>
        
        {/* Register link */}
        <p class="text-center text-sm text-muted mt-6">
          Ještě nemáte účet?{' '}
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