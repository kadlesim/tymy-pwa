// Register page

import { createSignal } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { doRegister } from '../../lib/auth'
import { useCommonCaptions } from '../../lib/captions'
import { ICONS } from '../layout/Layout'

interface RegisterFormData {
  login: string
  password: string
  confirmPassword: string
  email: string
  callName: string
  firstName: string
  lastName: string
  note: string
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { tAuth, tCommon, tErrors } = useCommonCaptions()
  
  const [formData, setFormData] = createSignal<RegisterFormData>({
    login: '',
    password: '',
    confirmPassword: '',
    email: '',
    callName: '',
    firstName: '',
    lastName: '',
    note: ''
  })
  
  const [errors, setErrors] = createSignal<Record<string, string>>({})
  const [isLoading, setIsLoading] = createSignal(false)
  const [showPassword, setShowPassword] = createSignal(false)
  const [success, setSuccess] = createSignal(false)
  
  const updateField = (field: keyof RegisterFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setErrors(prev => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }
  
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    const data = formData() as unknown as Record<string, string>
    
    // @ts-expect-error - TypeScript quirk with bracket notation on Record<string, string>
    if (!data['login']?.trim()) newErrors.login = 'Přihlašovací jméno je povinné'
    // @ts-expect-error - TypeScript quirk with bracket notation on Record<string, string>
    else if (data['login'].length < 3) newErrors.login = 'Minimálně 3 znaky'
    
    // @ts-expect-error - TypeScript quirk with bracket notation on Record<string, string>
    if (!data['password']) newErrors.password = 'Heslo je povinné'
    // @ts-expect-error - TypeScript quirk with bracket notation on Record<string, string>
    else if (data['password'].length < 6) newErrors.password = 'Minimálně 6 znaků'
    
    // @ts-expect-error - TypeScript quirk with bracket notation on Record<string, string>
    if (data['password'] !== data['confirmPassword']) newErrors.confirmPassword = 'Hesla se neshodují'
    
    // @ts-expect-error - TypeScript quirk with bracket notation on Record<string, string>
    if (!data['email']?.trim()) newErrors.email = 'E-mail je povinný'
    // @ts-expect-error - TypeScript quirk with bracket notation on Record<string, string>
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data['email'])) newErrors.email = 'Neplatný formát e-mailu'
    
    // @ts-expect-error - TypeScript quirk with bracket notation on Record<string, string>
    if (!data['callName']?.trim()) newErrors.callName = 'Zobrazované jméno je povinné'
    
    // @ts-expect-error - TypeScript quirk with bracket notation on Record<string, string>
    if (!data['firstName']?.trim()) newErrors.firstName = 'Jméno je povinné'
    
    // @ts-expect-error - TypeScript quirk with bracket notation on Record<string, string>
    if (!data['lastName']?.trim()) newErrors.lastName = 'Příjmení je povinné'
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setIsLoading(true)
    setErrors({})
    
    try {
      await doRegister(formData())
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err: any) {
      if (err.message?.includes('login')) {
        setErrors({ login: 'Toto přihlašovací jméno je již obsazené' })
      } else if (err.message?.includes('email')) {
        setErrors({ email: 'Tento e-mail je již registrovaný' })
      } else {
        setErrors({ form: err.message || tErrors('unknown') })
      }
    } finally {
      setIsLoading(false)
    }
  }
  
  if (success()) {
    return (
      <div class="auth-page min-h-dvh flex items-center justify-center p-4 bg-50">
        <div class="auth-card w-full max-w-md bg-elevated rounded-xl shadow-lg border border-border p-6 animate-slide-up text-center">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success-light text-success mb-4">
            <span class="icon icon-lg" innerHTML={ICONS['check']} />
          </div>
          <h1 class="text-2xl font-bold text-text mb-2">Registrace úspěšná</h1>
          <p class="text-muted mb-6">
            Váš účet byl vytvořen a čeká na schválení administrátorem týmu.
            Budete upozorněni e-mailem, jakmile bude účet aktivní.
          </p>
          <button
            class="btn btn-primary w-full"
            onClick={() => navigate('/login')}
          >
            Přejít k přihlášení
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div class="auth-page min-h-dvh flex items-center justify-center p-4 bg-50">
      <div class="auth-card w-full max-w-md bg-elevated rounded-xl shadow-lg border border-border p-6 animate-slide-up">
        <div class="text-center mb-6">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-primary-light mb-4">
            <span class="icon text-primary" innerHTML={ICONS['user']} />
          </div>
          <h1 class="text-2xl font-bold text-text">Registrace</h1>
          <p class="text-muted mt-1">Vytvořte si účet pro přístup k týmu</p>
        </div>
        
        {errors()['form'] && (
          <div class="alert alert-danger mb-4 p-3 rounded-lg bg-danger-light text-danger text-sm animate-slide-down">
            {errors()['form']}
          </div>
        )}
        
        <form onSubmit={handleSubmit} class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="firstName" class="label">{tAuth('firstName')}</label>
              <input
                id="firstName"
                type="text"
                class={`input w-full mt-1 ${errors()['firstName'] ? 'border-danger' : ''}`}
                value={formData()['firstName']}
                onInput={e => updateField('firstName', e.currentTarget.value)}
                placeholder="Jméno"
                required
                disabled={isLoading()}
              />
              {errors()['firstName'] && <p class="text-danger text-xs mt-1">{errors()['firstName']}</p>}
            </div>
            <div>
              <label for="lastName" class="label">{tAuth('lastName')}</label>
              <input
                id="lastName"
                type="text"
                class={`input w-full mt-1 ${errors()['lastName'] ? 'border-danger' : ''}`}
                value={formData()['lastName']}
                onInput={e => updateField('lastName', e.currentTarget.value)}
                placeholder="Příjmení"
                required
                disabled={isLoading()}
              />
              {errors()['lastName'] && <p class="text-danger text-xs mt-1">{errors()['lastName']}</p>}
            </div>
          </div>
          
          <div>
            <label for="callName" class="label">{tAuth('callName')}</label>
            <input
              id="callName"
              type="text"
              class={`input w-full mt-1 ${errors()['callName'] ? 'border-danger' : ''}`}
              value={formData()['callName']}
              onInput={e => updateField('callName', e.currentTarget.value)}
              placeholder="Zobrazované jméno (např. Jan N.)"
              required
              disabled={isLoading()}
            />
            {errors()['callName'] && <p class="text-danger text-xs mt-1">{errors()['callName']}</p>}
          </div>
          
          <div>
            <label for="email" class="label">{tAuth('email')}</label>
            <input
              id="email"
              type="email"
              class={`input w-full mt-1 ${errors()['email'] ? 'border-danger' : ''}`}
              value={formData()['email']}
              onInput={e => updateField('email', e.currentTarget.value)}
              placeholder="vase@email.cz"
              required
              disabled={isLoading()}
            />
            {errors()['email'] && <p class="text-danger text-xs mt-1">{errors()['email']}</p>}
          </div>
          
          <div>
            <label for="login" class="label">{tAuth('loginName')}</label>
            <input
              id="login"
              type="text"
              class={`input w-full mt-1 ${errors()['login'] ? 'border-danger' : ''}`}
              value={formData()['login']}
              onInput={e => updateField('login', e.currentTarget.value)}
              placeholder="Přihlašovací jméno"
              required
              disabled={isLoading()}
            />
            {errors()['login'] && <p class="text-danger text-xs mt-1">{errors()['login']}</p>}
          </div>
          
          <div>
            <label for="password" class="label">{tAuth('password')}</label>
            <div class="relative">
              <input
                id="password"
                type={showPassword() ? 'text' : 'password'}
                class={`input w-full pr-10 ${errors()['password'] ? 'border-danger' : ''}`}
                value={formData()['password']}
                onInput={e => updateField('password', e.currentTarget.value)}
                placeholder="Heslo (min. 6 znaků)"
                required
                disabled={isLoading()}
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
            {errors()['password'] && <p class="text-danger text-xs mt-1">{errors()['password']}</p>}
          </div>
          
          <div>
            <label for="confirmPassword" class="label">{tAuth('confirmPassword')}</label>
            <input
              id="confirmPassword"
              type={showPassword() ? 'text' : 'password'}
              class={`input w-full mt-1 ${errors()['confirmPassword'] ? 'border-danger' : ''}`}
              value={formData()['confirmPassword']}
              onInput={e => updateField('confirmPassword', e.currentTarget.value)}
              placeholder="Potvrzení hesla"
              required
              disabled={isLoading()}
            />
            {errors()['confirmPassword'] && <p class="text-danger text-xs mt-1">{errors()['confirmPassword']}</p>}
          </div>
          
          <div>
            <label for="note" class="label">Poznámka pro administrátory (volitelné)</label>
            <textarea
              id="note"
              class="input w-full mt-1 min-h-[80px] resize-y"
              value={formData()['note']}
              onInput={e => updateField('note', e.currentTarget.value)}
              placeholder="Proč chcete do týmu vstoupit..."
              disabled={isLoading()}
            />
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
              tAuth('register')
            )}
          </button>
        </form>
        
        <p class="text-center text-sm text-muted mt-6">
          Už máte účet?{' '}
          <button 
            class="text-primary hover:underline font-medium"
            onClick={() => navigate('/login')}
          >
            {tAuth('login')}
          </button>
        </p>
      </div>
    </div>
  )
}