// Polls list page

import { For, Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { useQuery } from '@tanstack/solid-query'
import { getMenuPolls, type Poll } from '../../lib/api'
import { queryKeys } from '../../lib/queryClient'
import { useCommonCaptions } from '../../lib/captions'
import { ICONS } from '../../lib/icons'

export default function PollsPage() {
  const navigate = useNavigate()
  const { tPolls, tCommon } = useCommonCaptions()

  const pollsQuery = useQuery<Poll[], Error>(() => ({
    queryKey: queryKeys.menuPolls(),
    queryFn: getMenuPolls
  }))

  return (
    <div class="polls-page">
      <div class="mb-4">
        <h1 class="text-xl font-semibold text-text">{tPolls('title')}</h1>
      </div>

      <Show when={!pollsQuery.isPending} fallback={<p class="text-muted">{tCommon('loading')}</p>}>
        <Show
          when={(pollsQuery.data ?? []).length > 0}
          fallback={
            <div class="text-center py-12">
              <div class="icon icon-lg text-muted mb-3" innerHTML={ICONS['poll']} />
              <h3 class="text-lg font-medium text-text mb-1">{tPolls('noPolls')}</h3>
              <p class="text-muted">Momentálně nejsou k dispozici žádné otevřené ankety.</p>
            </div>
          }
        >
          <div class="space-y-3">
            <For each={pollsQuery.data}>
              {(poll) => (
                <article
                  class="bg-elevated rounded-xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/polls/${poll.id}`)}
                >
                  <div class="flex items-start gap-3">
                    <div class="w-12 h-12 rounded-lg bg-primary-light flex items-center justify-center flex-shrink-0">
                      <span class="icon text-primary" innerHTML={ICONS['poll']} />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-start justify-between gap-2">
                        <h3 class="font-semibold text-text truncate">{poll.caption}</h3>
                        <span
                          class="badge text-xs flex-shrink-0"
                          classList={{
                            'bg-success-light text-success': poll.status !== 'CLOSED',
                            'bg-danger-light text-danger': poll.status === 'CLOSED'
                          }}
                        >
                          {poll.status === 'CLOSED' ? 'Uzavřeno' : 'Otevřeno'}
                        </span>
                      </div>
                      <Show when={poll.description}>
                        <p class="text-sm text-muted mt-1 line-clamp-2">{poll.description}</p>
                      </Show>
                      <div class="flex flex-wrap items-center gap-2 mt-3 text-xs text-muted">
                        <span>{poll.votes?.length ?? 0} hlasů</span>
                        <Show when={poll.anonymousResults}>
                          <span class="badge bg-secondary-light text-secondary">Anonymní</span>
                        </Show>
                        <Show when={poll.voted}>
                          <span class="badge bg-primary-light text-primary">Hlasováno</span>
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
