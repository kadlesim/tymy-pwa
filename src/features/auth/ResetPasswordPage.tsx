// Reset password page

import { createSignal } from 'solid-js'
import { useNavigate, useParams } from '@solidjs/router'
import { doResetPassword } from '../../lib/auth'
import { useCommonCaptions } from '../../lib/captions'
import { ICONS } from '../layout/Layout'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const params = useParams()
  const { tAuth, tCommon, tErrors } = useCommonCaptions()
  
  const resetCode = params['code']
  
  const [password, setPassword] = createSignal('')
  const [confirmPassword, setConfirmPassword] = createSignal('')
  const [error, setError] = createSignal<string | null>(null)
  const [isLoading, setIsLoading] = createSignal(false)
  const [success, setSuccess] = createSignal(false)
  const [showPassword, setShowPassword] = createSignal(false)
  
  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError(null)
    
    if (!password()) {
      setError('Heslo je povinné')
      return
    }
    
    if (password().length < 6) {
      setError('Heslo musí mít alespoň 6 znaků')
      return
    }
    
    if (password() !== confirmPassword()) {
      setError('Hesla se neshodují')
      return
    }
    
    if (!resetCode) {
      setError('Neplatný nebo chybějící resetovací kód')
      return
    }
    
    setIsLoading(true)
    
    try {
      await doResetPassword(resetCode)
      setSuccess(true)
    } catch (err: any) {
      if (err.message?.includes('expired') || err.message?.includes('starý')) {
        setError('Tento odkaz již vypršel. Požádejte o nový reset hesla.')
      } else if (err.message?.includes('invalid') || err.message?.includes('neplatný')) {
        setError('Neplatný resetovací kód.')
      } else {
        setError(err.message || tErrors('unknown'))
      }
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div class="auth-page min-h-dvh flex items-center justify-center p-4 bg-50">
      <div class="auth-card w-full max-w-md bg-elevated rounded-xl shadow-lg border border-border p-6 animate-slide-up">
        <div class="text-center mb-6">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-primary-light text-primary mb-4">
            <span class="icon text-2xl">🔒</span>
          </div>
          <h1 class="text-2xl font-bold text-text">Nastavit nové heslo</h1>
          <p class="text-muted mt-1">Zadejte nové heslo pro svůj účet</p>
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
            <h2 class="text-xl font-semibold text-text mb-2">Heslo změněno</h2>
            <p class="text-muted mb-6">
              Vaše heslo bylo úspěšně aktualizováno. Nyní se můžete přihlásit novým heslem.
            </p>
            <button
              class="btn btn-primary w-full"
              onClick={() => navigate('/login')}
            >
              Přejít k přihlášení
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} class="space-y-4">
            <div>
              <label for="password" class="label">Nové heslo</label>
              <div class="relative">
                <input
                  id="password"
                  type={showPassword() ? 'text' : 'password'}
                  class="input w-full pr-10"
                  value={password()}
                  onInput={e => setPassword(e.currentTarget.value)}
                  placeholder="Min. 6 znaků"
                  required
                  disabled={isLoading()}
                  autocomplete="new-password"
                />
                <button
                  type="button"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                  onClick={() => setShowPassword(!showPassword())}
                  aria-label={showPassword() ? 'Skrýt heslo' : 'Zobrazit heslo'}
                >
                  <span class="icon">👁</span>
                </button>
              </div>
            </div>
            
            <div>
              <label for="confirmPassword" class="label">Potvrdit nové heslo</label>
              <input
                id="confirmPassword"
                type={showPassword() ? 'text' : 'password'}
                class="input w-full mt-1"
                value={confirmPassword()}
                onInput={e => setConfirmPassword(e.currentTarget.value)}
                placeholder="Znovu zadat heslo"
                required
                disabled={isLoading()}
                autocomplete="new-password"
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
                'Uložit nové heslo'
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