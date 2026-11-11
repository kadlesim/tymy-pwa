// Discussions list page

import { createSignal, For, Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/solid-query'
import { getDiscussionsWithNew, createDiscussion, type Discussion } from '../../lib/api'
import { queryKeys } from '../../lib/queryClient'
import { isAdmin } from '../../lib/auth'
import { useCommonCaptions } from '../../lib/captions'
import { tr } from '../../lib/i18n'
import { ICONS } from '../../lib/icons'

export default function DiscussionsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { tDiscussions, tCommon } = useCommonCaptions()

  const [showCreate, setShowCreate] = createSignal(false)
  const [caption, setCaption] = createSignal('')
  const [description, setDescription] = createSignal('')

  const discussionsQuery = useQuery<Discussion[], Error>(() => ({
    queryKey: queryKeys.discussionsWithNew(),
    queryFn: getDiscussionsWithNew,
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60
  }))

  const createMutation = useMutation<void, Error, { caption: string; description: string }>(() => ({
    mutationFn: async d => {
      await createDiscussion(d)
    },
    onSuccess: () => {
      setShowCreate(false)
      setCaption('')
      setDescription('')
      queryClient.invalidateQueries({ queryKey: queryKeys.discussionsWithNew() })
    }
  }))

  const handleCreate = (e: SubmitEvent) => {
    e.preventDefault()
    if (!caption().trim()) return
    createMutation.mutate({ caption: caption(), description: description() })
  }

  // The API exposes no `canCreate` flag; the team's admins are the only ones for whom
  // the "new discussion" button is rendered (the server still checks SYS:DIS_CREATE).
  const canCreateDiscussion = () => isAdmin()

  return (
    <div class="discussions-page">
      <div class="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 class="text-xl font-semibold text-text">{tDiscussions('title')}</h1>
        <Show when={canCreateDiscussion()}>
          <button class="btn btn-primary" onClick={() => setShowCreate(true)}>
            <span class="icon" innerHTML={ICONS['chat']} />
            {tr('Nová diskuze')}
          </button>
        </Show>
      </div>

      <Show when={!discussionsQuery.isPending} fallback={<p class="text-muted">{tCommon('loading')}</p>}>
        <Show
          when={(discussionsQuery.data ?? []).length > 0}
          fallback={
            <div class="text-center py-12">
              <div class="icon icon-lg text-muted mb-3" innerHTML={ICONS['chat']} />
              <h3 class="text-lg font-medium text-text mb-1">{tDiscussions('noDiscussions')}</h3>
              <p class="text-muted mb-4">{tr('Zatím nejsou k dispozici žádné diskuze.')}</p>
              <Show when={canCreateDiscussion()}>
                <button class="btn btn-primary" onClick={() => setShowCreate(true)}>
                  {tr('Vytvořit první diskuzi')}
                </button>
              </Show>
            </div>
          }
        >
          <div class="space-y-2">
            <For each={discussionsQuery.data}>
              {(discussion) => (
                <article
                  class="bg-elevated rounded-xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/discussions/${discussion.id}`)}
                >
                  <div class="flex items-start gap-3">
                    <span class="icon icon-lg text-muted mt-0.5 flex-shrink-0" innerHTML={ICONS['chat']} />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-start justify-between gap-2">
                        <h3 class="font-semibold text-text truncate">{discussion.caption}</h3>
                        <Show when={discussion.newPosts > 0}>
                          <span class="badge bg-danger text-white text-xs flex-shrink-0">
                            {tr('{n} nových', { n: discussion.newPosts })}
                          </span>
                        </Show>
                      </div>
                      <Show when={discussion.description}>
                        <p class="text-sm text-muted mt-1 line-clamp-2">{discussion.description}</p>
                      </Show>
                      <div class="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted">
                        <Show when={discussion.publicRead}>
                          <span class="badge bg-success-light text-success">{tr('Veřejné')}</span>
                        </Show>
                        <Show when={!discussion.canWrite}>
                          <span class="badge bg-danger-light text-danger">{tr('Uzamčeno')}</span>
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

      <Show when={showCreate()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowCreate(false)}
        >
          <div class="bg-elevated rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 class="text-lg font-semibold text-text mb-4">{tr('Nová diskuze')}</h2>
            <form onSubmit={handleCreate} class="space-y-4">
              <div>
                <label class="label">{tr('Název')} <span class="text-danger">*</span></label>
                <input
                  class="input w-full mt-1"
                  value={caption()}
                  onInput={e => setCaption(e.currentTarget.value)}
                  required
                />
              </div>
              <div>
                <label class="label">{tr('Popis')}</label>
                <textarea
                  class="input w-full mt-1 min-h-[80px]"
                  value={description()}
                  onInput={e => setDescription(e.currentTarget.value)}
                />
              </div>
              <div class="flex justify-end gap-2 pt-2">
                <button type="button" class="btn btn-secondary" onClick={() => setShowCreate(false)}>
                  {tCommon('cancel')}
                </button>
                <button type="submit" class="btn btn-primary" disabled={createMutation.isPending}>
                  {createMutation.isPending ? tr('Vytváření…') : tr('Vytvořit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  )
}
