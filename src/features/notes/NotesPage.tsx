// Public notes page

import { For, Show } from 'solid-js'
import { useQuery } from '@tanstack/solid-query'
import { getNotesHtml, type Note } from '../../lib/api'
import { queryKeys } from '../../lib/queryClient'
import { useCommonCaptions } from '../../lib/captions'
import { tr } from '../../lib/i18n'
import { ICONS } from '../../lib/icons'

export default function NotesPage() {
  const { tNotes, tCommon } = useCommonCaptions()

  const notesQuery = useQuery<Note[], Error>(() => ({
    queryKey: queryKeys.notesHtml(),
    queryFn: getNotesHtml
  }))

  const displayNotes = () =>
    (notesQuery.data ?? []).filter(n => n.accessType === 'PUBLIC')

  return (
    <div class="notes-page max-w-3xl mx-auto space-y-6">
      <h1 class="text-2xl font-bold text-text">{tNotes('title')}</h1>

      <Show
        when={!notesQuery.isPending}
        fallback={<p class="text-muted">{tCommon('loading')}</p>}
      >
        <Show
          when={displayNotes().length > 0}
          fallback={
            <div class="text-center py-12">
              <div class="icon icon-lg text-muted mb-3" innerHTML={ICONS['chat']} />
              <h3 class="text-lg font-medium text-text mb-1">{tr('Žádné veřejné poznámky')}</h3>
            </div>
          }
        >
          <div class="space-y-4">
            <For each={displayNotes()}>
              {(note) => (
                <article class="bg-elevated rounded-xl border border-border overflow-hidden">
                  <div class="p-5">
                    <div class="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h2 class="text-lg font-semibold text-text">{note.caption}</h2>
                        <p class="text-sm text-muted mt-1">{note.description}</p>
                      </div>
                      <Show when={note.specialPage}>
                        <span class="badge bg-primary-light text-primary text-xs">{note.specialPage}</span>
                      </Show>
                    </div>
                    <div class="prose prose-sm max-w-none" innerHTML={note.source} />
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
