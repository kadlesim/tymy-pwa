// Team roster page

import { createSignal, createMemo, For, Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { useQuery } from '@tanstack/solid-query'
import { getUsersByStatus, type User, type UserStatus } from '../../lib/api'
import { apiAssetUrl } from '../../lib/api'
import { queryKeys } from '../../lib/queryClient'
import { useCommonCaptions } from '../../lib/captions'
import { tr } from '../../lib/i18n'
import { ICONS } from '../../lib/icons'

const STATUSES: UserStatus[] = ['PLAYER', 'MEMBER', 'SICK', 'INIT', 'DELETED']

const STATUS_LABEL: Record<UserStatus, string> = {
  PLAYER: 'Hráči',
  MEMBER: 'Členové',
  SICK: 'Nemocní',
  INIT: 'Neaktivní',
  DELETED: 'Smazaní'
}

export default function UsersPage() {
  const navigate = useNavigate()
  const { tCommon } = useCommonCaptions()

  const [status, setStatus] = createSignal<UserStatus>('PLAYER')
  const [search, setSearch] = createSignal('')

  const usersQuery = useQuery<User[], Error>(() => ({
    queryKey: queryKeys.users(status()),
    queryFn: () => getUsersByStatus(status()),
    staleTime: 1000 * 60 * 5
  }))

  const filtered = createMemo(() => {
    const q = search().toLowerCase().trim()
    const list = usersQuery.data ?? []
    if (!q) return list
    return list.filter(
      u =>
        u.callName?.toLowerCase().includes(q) ||
        u.login?.toLowerCase().includes(q) ||
        u.firstName?.toLowerCase().includes(q) ||
        u.lastName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    )
  })

  return (
    <div class="users-page">
      <div class="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 class="text-xl font-semibold text-text">{tr('Tým')}</h1>
        <input
          type="search"
          class="input w-full sm:w-64"
          placeholder={tr('Hledat člena…')}
          value={search()}
          onInput={e => setSearch(e.currentTarget.value)}
        />
      </div>

      <div class="flex gap-1 bg-100 rounded-lg p-1 mb-4 overflow-x-auto" role="tablist">
        <For each={STATUSES}>
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
              {tr(STATUS_LABEL[s])}
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
          <div class="space-y-2">
            <For each={filtered()}>
              {(user) => (
                <article
                  class="bg-elevated rounded-xl border border-border p-3 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/users/${user.id}`)}
                >
                  <div class="flex items-center gap-3">
                    <img
                      src={apiAssetUrl(user.pictureUrl)}
                      alt=""
                      class="w-10 h-10 rounded-full object-cover border border-border flex-shrink-0"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-medium text-text truncate">
                          {user.callName || user.displayName}
                        </span>
                        <Show when={user.jerseyNumber}>
                          <span class="badge bg-primary-light text-primary text-xs">#{user.jerseyNumber}</span>
                        </Show>
                      </div>
                      <div class="flex items-center gap-2 text-xs text-muted mt-0.5">
                        <Show when={user.firstName || user.lastName}>
                          <span>{user.firstName} {user.lastName}</span>
                        </Show>
                        <Show when={user.email}>
                          <span class="truncate max-w-[200px]">{user.email}</span>
                        </Show>
                      </div>
                    </div>
                  </div>
                </article>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  )
}
