// Profile page: view and edit own profile

import { createSignal, createEffect, Show, For } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/solid-query'
import { getUser, updateUser, uploadAvatar, type User } from '../../lib/api'
import { apiAssetUrl } from '../../lib/api'
import { queryKeys } from '../../lib/queryClient'
import { useAuth } from '../../lib/auth'
import { useCommonCaptions } from '../../lib/captions'
import { tr } from '../../lib/i18n'
import { ICONS } from '../../lib/icons'

export default function ProfilePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const auth = useAuth()
  const user = () => auth().user
  const roles = () => auth().roles
  const { tProfile, tCommon } = useCommonCaptions()

  const [editing, setEditing] = createSignal(false)
  const [form, setForm] = createSignal<Partial<User>>({})
  const [avatarPreview, setAvatarPreview] = createSignal<string | null>(null)
  const [avatarBase64, setAvatarBase64] = createSignal<string | null>(null)

  const userQuery = useQuery<User, Error>(() => ({
    queryKey: queryKeys.user(user()?.id ?? 0),
    queryFn: () => getUser(user()!.id),
    enabled: !!user()?.id
  }))

  createEffect(() => {
    const u = userQuery.data
    if (u) {
      setForm({
        firstName: u.firstName,
        lastName: u.lastName,
        callName: u.callName,
        email: u.email,
        phone: u.phone,
        phone2: u.phone2,
        street: u.street,
        city: u.city,
        zipCode: u.zipCode,
        jerseyNumber: u.jerseyNumber,
        birthDate: u.birthDate,
        gender: u.gender,
        language: u.language
      })
    }
  })

  const saveMutation = useMutation<User, Error, Partial<User>>(() => ({
    mutationFn: (data: Partial<User>) => updateUser(user()!.id, data),
    onSuccess: () => {
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.user(user()!.id) })
    }
  }))

  const avatarMutation = useMutation<void, Error, string>(() => ({
    mutationFn: (base64: string) => uploadAvatar(user()!.id, base64),
    onSuccess: () => {
      setAvatarPreview(null)
      setAvatarBase64(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.user(user()!.id) })
    }
  }))

  const handleFile = (e: Event) => {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = ev => {
      const result = ev.target?.result as string
      setAvatarPreview(result)
      setAvatarBase64(result.split(',')[1] ?? null)
    }
    reader.readAsDataURL(file)
  }

  const field = (key: keyof User) => (form() as Record<string, unknown>)[key] as string | undefined
  const setField = (key: keyof User, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  return (
    <Show
      when={!userQuery.isPending && userQuery.data}
      fallback={<p class="text-muted">{tCommon('loading')}</p>}
    >
      <div class="profile-page max-w-2xl mx-auto space-y-6">
        <div class="bg-elevated rounded-xl border border-border p-6">
          <div class="flex items-center gap-4">
            <div class="relative">
              <img
                src={avatarPreview() || apiAssetUrl(userQuery.data!.pictureUrl)}
                alt=""
                class="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
              />
              <label class="absolute bottom-0 right-0 bg-primary text-white rounded-full p-2 cursor-pointer hover:bg-primary-hover">
                <input type="file" accept="image/*" class="sr-only" onChange={handleFile} />
                <span class="text-xs">＋</span>
              </label>
            </div>
            <div class="flex-1">
              <h1 class="text-2xl font-bold text-text">
                {userQuery.data!.callName || userQuery.data!.displayName}
              </h1>
              <p class="text-muted">@{userQuery.data!.login}</p>
              <div class="flex flex-wrap gap-2 mt-2">
                <span class="badge bg-primary-light text-primary">{userQuery.data!.status}</span>
                <For each={roles()}>{role => <span class="badge bg-secondary-light text-secondary text-xs">{role}</span>}</For>
              </div>
            </div>
            <Show when={avatarPreview()}>
              <button
                class="btn btn-primary"
                onClick={() => avatarBase64() && avatarMutation.mutate(avatarBase64()!)}
                disabled={avatarMutation.isPending}
              >
                {avatarMutation.isPending ? tr('Nahrávání…') : tr('Uložit avatar')}
              </button>
            </Show>
          </div>
        </div>

        <div class="bg-elevated rounded-xl border border-border p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-text flex items-center gap-2">
              <span class="icon" innerHTML={ICONS['user']} />
              {tProfile('personalInfo')}
            </h2>
            <div class="flex gap-2">
              <Show when={!editing()}>
                <button class="btn btn-secondary" onClick={() => setEditing(true)}>
                  {tProfile('editProfile')}
                </button>
              </Show>
              <Show when={editing()}>
                <button class="btn btn-secondary" onClick={() => setEditing(false)}>
                  {tCommon('cancel')}
                </button>
                <button
                  class="btn btn-primary"
                  onClick={() => saveMutation.mutate(form())}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? tr('Ukládání…') : tCommon('save')}
                </button>
              </Show>
            </div>
          </div>

          <Show
            when={editing()}
            fallback={
              <dl class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div><dt class="text-muted">{tr('Jméno')}</dt><dd class="font-medium text-text">{userQuery.data!.firstName || '—'}</dd></div>
                <div><dt class="text-muted">{tr('Příjmení')}</dt><dd class="font-medium text-text">{userQuery.data!.lastName || '—'}</dd></div>
                <div><dt class="text-muted">{tr('E-mail')}</dt><dd class="font-medium text-text">{userQuery.data!.email || '—'}</dd></div>
                <div><dt class="text-muted">{tr('Telefon')}</dt><dd class="font-medium text-text">{userQuery.data!.phone || '—'}</dd></div>
                <div><dt class="text-muted">{tr('Číslo dresu')}</dt><dd class="font-medium text-text">{userQuery.data!.jerseyNumber || '—'}</dd></div>
                <div><dt class="text-muted">{tr('Jazyk')}</dt><dd class="font-medium text-text">{userQuery.data!.language === 'CZ' ? tr('Čeština') : tr('Angličtina')}</dd></div>
              </dl>
            }
          >
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="label">{tr('Jméno')}</label>
                <input class="input w-full mt-1" value={field('firstName') ?? ''} onInput={e => setField('firstName', e.currentTarget.value)} />
              </div>
              <div>
                <label class="label">{tr('Příjmení')}</label>
                <input class="input w-full mt-1" value={field('lastName') ?? ''} onInput={e => setField('lastName', e.currentTarget.value)} />
              </div>
              <div>
                <label class="label">{tr('Zobrazované jméno')}</label>
                <input class="input w-full mt-1" value={field('callName') ?? ''} onInput={e => setField('callName', e.currentTarget.value)} />
              </div>
              <div>
                <label class="label">{tr('E-mail')}</label>
                <input type="email" class="input w-full mt-1" value={field('email') ?? ''} onInput={e => setField('email', e.currentTarget.value)} />
              </div>
              <div>
                <label class="label">{tr('Telefon')}</label>
                <input class="input w-full mt-1" value={field('phone') ?? ''} onInput={e => setField('phone', e.currentTarget.value)} />
              </div>
              <div>
                <label class="label">{tr('Číslo dresu')}</label>
                <input class="input w-full mt-1" value={field('jerseyNumber') ?? ''} onInput={e => setField('jerseyNumber', e.currentTarget.value)} />
              </div>
              <div>
                <label class="label">{tr('Ulice')}</label>
                <input class="input w-full mt-1" value={field('street') ?? ''} onInput={e => setField('street', e.currentTarget.value)} />
              </div>
              <div>
                <label class="label">{tr('Město')}</label>
                <input class="input w-full mt-1" value={field('city') ?? ''} onInput={e => setField('city', e.currentTarget.value)} />
              </div>
              <div>
                <label class="label">{tr('PSČ')}</label>
                <input class="input w-full mt-1" value={field('zipCode') ?? ''} onInput={e => setField('zipCode', e.currentTarget.value)} />
              </div>
            </div>
          </Show>
        </div>

        <button class="btn btn-secondary w-full" onClick={() => navigate('/profile/settings')}>
          {tr('Nastavení aplikace')}
        </button>
      </div>
    </Show>
  )
}
