// Poll detail page with voting

import { createSignal, For, Show } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/solid-query'
import { getPoll, submitPollVotes, type Poll, type PollOption } from '../../lib/api'
import { queryKeys } from '../../lib/queryClient'
import { useCommonCaptions } from '../../lib/captions'
import { ICONS } from '../../lib/icons'

type VoteValue = string | number | boolean

export default function PollDetailPage() {
  const params = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { tPolls, tCommon } = useCommonCaptions()

  const pollId = () => parseInt(params['id'] ?? '0', 10)
  const [selected, setSelected] = createSignal<Record<number, VoteValue>>({})

  const pollQuery = useQuery<Poll, Error>(() => ({
    queryKey: queryKeys.poll(pollId()),
    queryFn: () => getPoll(pollId()),
    enabled: pollId() > 0
  }))

  const voteMutation = useMutation<void, Error, void>(() => ({
    mutationFn: async () => {
      const entries = Object.entries(selected())
      const votes = entries.map(([optionId, value]) => {
        const base = { userId: 0, optionId: parseInt(optionId, 10) }
        if (typeof value === 'string') return { ...base, stringValue: value }
        if (typeof value === 'number') return { ...base, numericValue: value }
        return { ...base, booleanValue: value }
      })
      await submitPollVotes(pollId(), votes)
    },
    onSuccess: () => {
      setSelected({})
      queryClient.invalidateQueries({ queryKey: queryKeys.poll(pollId()) })
      queryClient.invalidateQueries({ queryKey: queryKeys.menuPolls() })
    }
  }))

  const setOption = (optionId: number, value: VoteValue) => {
    setSelected(prev => ({ ...prev, [optionId]: value }))
  }

  const voteCountFor = (poll: Poll, option: PollOption) =>
    (poll.votes ?? []).filter(v => v.optionId === option.id).length

  return (
    <Show
      when={!pollQuery.isPending}
      fallback={
        <div class="flex items-center justify-center h-64">
          <div class="flex flex-col items-center gap-4">
            <span class="icon icon-lg text-muted animate-spin" innerHTML={ICONS['spinner']} />
            <p class="text-muted">{tCommon('loading')}</p>
          </div>
        </div>
      }
    >
      <Show
        when={pollQuery.data}
        fallback={
          <div class="text-center p-8">
            <h2 class="text-xl font-semibold text-text mb-2">Anketa nenalezena</h2>
            <button class="btn btn-primary" onClick={() => navigate('/polls')}>Zpět k anketám</button>
          </div>
        }
      >
        {(poll) => {
          const isClosed = () => poll().status === 'CLOSED'
          const canVote = () => poll().canVote && !isClosed() && !poll().voted
          const showResults = () =>
            poll().canSeeResults &&
            (poll().showResults === 'ALWAYS' || (poll().showResults === 'AFTER_VOTE' && poll().voted))
          const totalVotes = () => poll().votes?.length ?? 0

          return (
            <div class="poll-detail max-w-2xl mx-auto">
              <div class="mb-6">
                <div class="flex items-center gap-3 mb-2">
                  <span class="icon icon-lg text-muted" innerHTML={ICONS['poll']} />
                  <div>
                    <h1 class="text-2xl font-bold text-text">{poll().caption}</h1>
                    <div class="flex items-center gap-3 text-sm">
                      <span
                        class="badge"
                        classList={{
                          'bg-success-light text-success': !isClosed(),
                          'bg-danger-light text-danger': isClosed()
                        }}
                      >
                        {isClosed() ? 'Uzavřeno' : 'Otevřeno'}
                      </span>
                      <Show when={poll().voted}>
                        <span class="badge bg-primary-light text-primary">Hlasováno</span>
                      </Show>
                    </div>
                  </div>
                </div>
                <Show when={poll().descriptionHtml}>
                  <div class="prose prose-sm max-w-none mt-3" innerHTML={poll().descriptionHtml} />
                </Show>
              </div>

              <div class="space-y-3 mb-6">
                <For each={poll().options ?? []}>
                  {(option) => (
                    <div class="bg-elevated rounded-xl border border-border p-4">
                      <div class="flex items-center gap-3">
                        <Show when={option.type === 'TEXT' && !showResults()}>
                          <input
                            type="text"
                            class="input flex-1"
                            placeholder={option.caption}
                            onInput={e => setOption(option.id, e.currentTarget.value)}
                            disabled={!canVote()}
                          />
                        </Show>
                        <Show when={option.type === 'NUMBER' && !showResults()}>
                          <label class="text-sm text-text flex-1">{option.caption}</label>
                          <input
                            type="number"
                            class="input w-28"
                            onInput={e => setOption(option.id, parseFloat(e.currentTarget.value) || 0)}
                            disabled={!canVote()}
                          />
                        </Show>
                        <Show when={option.type === 'BOOLEAN' && !showResults()}>
                          <label class="flex items-center gap-2 flex-1 cursor-pointer">
                            <input
                              type="checkbox"
                              class="checkbox w-5 h-5"
                              onChange={e => setOption(option.id, e.currentTarget.checked)}
                              disabled={!canVote()}
                            />
                            <span class="text-text">{option.caption}</span>
                          </label>
                        </Show>

                        <Show when={showResults()}>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between text-sm mb-1">
                              <span class="text-text">{option.caption}</span>
                              <span class="text-muted">
                                {voteCountFor(poll(), option)} hlasů
                              </span>
                            </div>
                            <div class="h-2 bg-100 rounded-full overflow-hidden">
                              <div
                                class="h-full bg-primary rounded-full"
                                style={`width: ${totalVotes() ? (voteCountFor(poll(), option) / totalVotes()) * 100 : 0}%`}
                              />
                            </div>
                          </div>
                        </Show>
                      </div>
                    </div>
                  )}
                </For>
              </div>

              <Show when={canVote()}>
                <button
                  class="btn btn-primary w-full py-3"
                  disabled={voteMutation.isPending || Object.keys(selected()).length === 0}
                  onClick={() => voteMutation.mutate()}
                >
                  {voteMutation.isPending ? 'Odesílání…' : 'Hlasovat'}
                </button>
              </Show>

              <Show when={!canVote() && !showResults()}>
                <p class="text-center text-muted py-4">
                  {isClosed() ? 'Anketa je uzavřena.' : 'Výsledky budou zobrazeny po uzavření ankety.'}
                </p>
              </Show>
            </div>
          )
        }}
      </Show>
    </Show>
  )
}
