// Forgot password page

import { createSignal } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { doRequestPasswordReset } from '../../lib/auth'
import { useCommonCaptions } from '../../lib/captions'
import { ICONS } from '../layout/Layout'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { tAuth, tCommon, tErrors } = useCommonCaptions()
  
  const [email, setEmail] = createSignal('')
  const [error, setError] = createSignal<string | null>(null)
  const [isLoading, setIsLoading] = createSignal(false)
  const [success, setSuccess] = createSignal(false)
  
  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    
    if (!email().trim()) {
      setError('E-mail je povinný')
      setIsLoading(false)
      return
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email())) {
      setError('Neplatný formát e-mailu')
      setIsLoading(false)
      return
    }
    
    try {
      const callbackUri = `${window.location.origin}/reset-password/%s`
      const hostname = window.location.hostname
      
      await doRequestPasswordReset(email(), callbackUri, hostname)
      
      setSuccess(true)
      
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || tErrors('unknown'))
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div class="auth-page min-h-dvh flex items-center justify-center p-4 bg-50">
      <div class="auth-card w-full max-w-md bg-elevated rounded-xl shadow-lg border border-border p-6 animate-slide-up">
        <div class="text-center mb-6">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-warning-light text-warning mb-4">
            <span class="icon text-2xl">🔑</span>
          </div>
          <h1 class="text-2xl font-bold text-text">Zapomenuté heslo</h1>
          <p class="text-muted mt-1">
            Zadejte svůj e-mail a pošleme vám odkaz pro nastavení nového hesla
          </p>
        </div>
        
        {error() && (
          <div class="alert alert-danger mb-4 p-3 rounded-lg bg-danger-light text-danger text-sm animate-slide-down">
            {error()}
          </div>
        )}
        
        {success() ? (
          <div class="text-center">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success-light text-success mb-4">
              <span class="icon text-2xl">✓</span>
            </div>
            <h2 class="text-xl font-semibold text-text mb-2">E-mail odeslán</h2>
            <p class="text-muted mb-6">
              Pokud je e-mail v našem systému, obdržíte odkaz pro reset hesla.
              Odkaz platí 1 hodinu.
            </p>
            <button
              class="btn btn-primary w-full"
              onClick={() => navigate('/login')}
            >
              Zpět k přihlášení
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} class="space-y-4">
            <div>
              <label for="email" class="label">{tAuth('email')}</label>
              <input
                id="email"
                type="email"
                class="input w-full mt-1"
                value={email()}
                onInput={e => setEmail(e.currentTarget.value)}
                placeholder="vase@email.cz"
                required
                disabled={isLoading()}
                autocomplete="email"
              />
            </div>
            
            <button
              type="submit"
              class="btn btn-primary w-full py-3"
              disabled={isLoading()}
            >
              {isLoading() ? (
                <span class="flex items-center justify-center gap-2">
                  <span class="animate-spin">⏳</span>
                  {tCommon('loading')}
                </span>
              ) : (
                'Poslat odkaz pro reset'
              )}
            </button>
          </form>
        )}
        
        <p class="text-center text-sm text-muted mt-6">
          <button 
            class="text-primary hover:underline font-medium"
            onClick={() => navigate('/login')}
          >
            Zpět k přihlášení
          </button>
        </p>
      </div>
    </div>
  )
}