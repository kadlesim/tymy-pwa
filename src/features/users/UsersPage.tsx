// Team roster page

import { createSignal, createMemo, For, Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { useQuery } from '@tanstack/solid-query'
import { getUsersByStatus, type User, type UserStatus } from '../../lib/api'
import { apiAssetUrl } from '../../lib/api'
import { queryKeys } from '../../lib/queryClient'
import { USER_STATUSES, USER_STATUS_LABELS } from '../../lib/user-status'
import { useCommonCaptions } from '../../lib/captions'
import { tr } from '../../lib/i18n'
import { ICONS } from '../../lib/icons'

export default function UsersPage() {
  const navigate = useNavigate()
  const { tCommon } = useCommonCaptions()

  const [status, setStatus] = createSignal<UserStatus>('PLAYER')
  const [search, setSearch] = createSignal('')
  // Avatar URLs that 404 (no picture / deleted upload) fall back to the user glyph.
  const [brokenAvatars, setBrokenAvatars] = createSignal<Set<number>>(new Set())

  const usersQuery = useQuery<User[], Error>(() => ({
    queryKey: queryKeys.users(status()),
    queryFn: () => getUsersByStatus(status()),
    staleTime: 1000 * 60 * 5
  }))

  const filtered = createMemo(() => {
    const q = search().toLowerCase().trim()
    const list = usersQuery.data ?? []
    if (!q) return list
    // Phones are typed with spaces/dashes; compare stripped forms too.
    const phoneQuery = q.replace(/[^\d+]/g, '')
    const digitsOf = (value?: string | null) => (value ?? '').replace(/[^\d+]/g, '')
    return list.filter(user => {
      const haystack = [
        user.callName,
        user.login,
        user.firstName,
        user.lastName,
        user.email,
        user.phone,
        user.phone2
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (haystack.includes(q)) return true
      return (
        phoneQuery.length >= 3 &&
        (digitsOf(user.phone).includes(phoneQuery) || digitsOf(user.phone2).includes(phoneQuery))
      )
    })
  })

  return (
    <div class="users-page">
      <div class="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 class="text-xl font-semibold text-text">{tr('Tým')}</h1>
        <input
          type="search"
          class="input w-full sm:w-64"
          placeholder={tr('Hledat jméno, e-mail, telefon…')}
          value={search()}
          onInput={e => setSearch(e.currentTarget.value)}
        />
      </div>

      <div class="flex gap-1 bg-100 rounded-lg p-1 mb-4 overflow-x-auto" role="tablist">
        <For each={USER_STATUSES}>
          {(s) => (
            <button
              role="tab"
              aria-selected={status() === s}
              class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
              classList={{
                'bg-elevated text-primary shadow-sm': status() === s,
                'text-text-secondary hover:text-text': status() !== s
              }}
              onClick={() => setStatus(s)}
            >
              {tr(USER_STATUS_LABELS[s])}
            </button>
          )}
        </For>
      </div>

      <Show when={!usersQuery.isPending} fallback={<p class="text-muted">{tCommon('loading')}</p>}>
        <Show
          when={filtered().length > 0}
          fallback={
            <div class="text-center py-12">
              <div class="icon icon-lg text-muted mb-3" innerHTML={ICONS['users']} />
              <h3 class="text-lg font-medium text-text mb-1">{tr('Žádní uživatelé')}</h3>
              <p class="text-muted">{tr('V této skupině nejsou žádní členové.')}</p>
            </div>
          }
        >
          <div class="bg-elevated rounded-xl border border-border overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-sm border-collapse">
                <thead>
                  <tr class="bg-50 border-b border-border text-[11px] uppercase tracking-wide text-muted">
                    <th class="text-left font-medium px-3 py-2">{tr('Člen')}</th>
                    <th class="text-left font-medium px-3 py-2 w-16 whitespace-nowrap">{tr('Číslo')}</th>
                    <th class="text-left font-medium px-3 py-2 whitespace-nowrap hidden md:table-cell">
                      {tr('Telefon')}
                    </th>
                    <th class="text-left font-medium px-3 py-2 whitespace-nowrap hidden sm:table-cell">
                      {tr('E-mail')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <For each={filtered()}>
                    {(user) => (
                      <tr
                        class="border-b border-border-light last:border-b-0 hover:bg-50 cursor-pointer"
                        onClick={() => navigate(`/users/${user.id}`)}
                      >
                        <td class="px-3 py-2">
                          <div class="flex items-center gap-3">
                            <Show
                              when={
                                user.pictureUrl && !brokenAvatars().has(user.id)
                                  ? user.pictureUrl
                                  : undefined
                              }
                              fallback={
                                <span class="w-9 h-9 rounded-full bg-secondary-light flex items-center justify-center text-muted flex-shrink-0">
                                  <span class="icon-sm" innerHTML={ICONS['user']} />
                                </span>
                              }
                            >
                              {(pictureUrl) => (
                                <img
                                  src={apiAssetUrl(pictureUrl())}
                                  alt=""
                                  loading="lazy"
                                  class="w-9 h-9 rounded-full object-cover border border-border flex-shrink-0"
                                  onError={() =>
                                    setBrokenAvatars(prev => new Set(prev).add(user.id))
                                  }
                                />
                              )}
                            </Show>
                            <div class="min-w-0">
                              <p class="font-medium text-text truncate">
                                {user.callName || user.displayName}
                              </p>
                              <p class="text-xs text-muted truncate sm:hidden">
                                {user.phone || user.email || ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td class="px-3 py-2 text-text whitespace-nowrap">
                          {user.jerseyNumber ? `#${user.jerseyNumber}` : '—'}
                        </td>
                        <td class="px-3 py-2 text-muted whitespace-nowrap hidden md:table-cell">
                          {user.phone || '—'}
                        </td>
                        <td class="px-3 py-2 text-muted hidden sm:table-cell">
                          <span class="block truncate max-w-[260px]">{user.email || '—'}</span>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  )
}
