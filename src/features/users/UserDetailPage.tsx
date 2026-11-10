// User detail page

import { Show } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { useQuery } from '@tanstack/solid-query'
import { getUser, type User } from '../../lib/api'
import { apiAssetUrl } from '../../lib/api'
import { queryKeys } from '../../lib/queryClient'
import { useCommonCaptions } from '../../lib/captions'
import { ICONS } from '../../lib/icons'

export default function UserDetailPage() {
  const params = useParams()
  const navigate = useNavigate()
  const { tCommon } = useCommonCaptions()

  const userId = () => parseInt(params['id'] ?? '0', 10)

  const userQuery = useQuery<User, Error>(() => ({
    queryKey: queryKeys.user(userId()),
    queryFn: () => getUser(userId()),
    enabled: userId() > 0
  }))

  return (
    <Show
      when={!userQuery.isPending}
      fallback={
        <div class="flex items-center justify-center h-64">
          <div class="flex flex-col items-center gap-4">
            <div class="animate-spin text-primary">⏳</div>
            <p class="text-muted">{tCommon('loading')}</p>
          </div>
        </div>
      }
    >
      <Show
        when={userQuery.data}
        fallback={
          <div class="text-center p-8">
            <h2 class="text-xl font-semibold text-text mb-2">Uživatel nenalezen</h2>
            <button class="btn btn-primary" onClick={() => navigate('/users')}>Zpět k týmu</button>
          </div>
        }
      >
        {(user) => (
          <div class="user-detail max-w-2xl mx-auto space-y-6">
            <div class="bg-elevated rounded-xl border border-border p-6">
              <div class="flex items-center gap-4">
                <img
                  src={apiAssetUrl(user().pictureUrl)}
                  alt=""
                  class="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                />
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <h1 class="text-2xl font-bold text-text">
                      {user().callName || user().displayName}
                    </h1>
                    <span class="badge bg-secondary-light text-secondary">{user().status}</span>
                  </div>
                  <p class="text-muted">@{user().login}</p>
                  <div class="flex flex-wrap gap-2 mt-2">
                    {user().roles.map(role => (
                      <span class="badge bg-secondary-light text-secondary text-xs">{role}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <section class="bg-elevated rounded-xl border border-border p-6">
              <h2 class="text-lg font-semibold text-text mb-4 flex items-center gap-2">
                <span class="icon" innerHTML={ICONS['user']} />
                Osobní údaje
              </h2>
              <dl class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt class="text-muted">Jméno</dt>
                  <dd class="font-medium text-text">{user().firstName || '—'}</dd>
                </div>
                <div>
                  <dt class="text-muted">Příjmení</dt>
                  <dd class="font-medium text-text">{user().lastName || '—'}</dd>
                </div>
                <div>
                  <dt class="text-muted">Zobrazované jméno</dt>
                  <dd class="font-medium text-text">{user().callName || '—'}</dd>
                </div>
                <div>
                  <dt class="text-muted">E-mail</dt>
                  <dd class="font-medium text-text">{user().email || '—'}</dd>
                </div>
                <div>
                  <dt class="text-muted">Telefon</dt>
                  <dd class="font-medium text-text">{user().phone || '—'}</dd>
                </div>
                <div>
                  <dt class="text-muted">Datum narození</dt>
                  <dd class="font-medium text-text">{user().birthDate || '—'}</dd>
                </div>
                <div>
                  <dt class="text-muted">Číslo dresu</dt>
                  <dd class="font-medium text-text">{user().jerseyNumber || '—'}</dd>
                </div>
                <div>
                  <dt class="text-muted">Pohlaví</dt>
                  <dd class="font-medium text-text">
                    {user().gender === 'MALE' ? 'Muž' : 'Žena'}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        )}
      </Show>
    </Show>
  )
}
