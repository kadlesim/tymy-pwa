// Poll detail page with voting

import { createSignal, createMemo, For, Show } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/solid-query'
import {
  getPoll,
  getUser,
  getUsersByStatus,
  submitPollVotes,
  apiAssetUrl,
  type Poll,
  type PollOption,
  type User
} from '../../lib/api'
import { queryKeys } from '../../lib/queryClient'
import { USER_STATUSES } from '../../lib/user-status'
import { getLocale } from '../../lib/prefs'
import { useCommonCaptions } from '../../lib/captions'
import { tr, trBool } from '../../lib/i18n'
import { ICONS } from '../../lib/icons'

type VoteValue = string | number | boolean

export default function PollDetailPage() {
  const params = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { tPolls, tCommon } = useCommonCaptions()

  const pollId = () => parseInt(params['id'] ?? '0', 10)
  const [selected, setSelected] = createSignal<Record<number, VoteValue>>({})
  // Avatar URLs that 404 (deleted uploads) fall back to the generic user glyph.
  const [brokenAvatars, setBrokenAvatars] = createSignal<Set<number>>(new Set())

  const pollQuery = useQuery<Poll, Error>(() => ({
    queryKey: queryKeys.poll(pollId()),
    queryFn: () => getPoll(pollId()),
    enabled: pollId() > 0
  }))

  // Votes only carry userIds, so the names/avatars come from the roster (all categories).
  const usersQuery = useQuery<User[], Error>(() => ({
    queryKey: ['users', 'poll-voters'],
    queryFn: async () => {
      const lists = await Promise.all(USER_STATUSES.map(status => getUsersByStatus(status)))
      return lists.flat()
    },
    staleTime: 1000 * 60 * 10
  }))

  const baseUsersById = createMemo(() => {
    const map = new Map<number, User>()
    for (const user of usersQuery.data ?? []) map.set(user.id, user)
    return map
  })

  const voterIds = createMemo(() => {
    const poll = pollQuery.data
    if (!poll) return []
    const ids = new Set<number>()
    for (const vote of poll.votes ?? []) ids.add(vote.userId)
    const base = baseUsersById()
    const label = (id: number) => {
      const user = base.get(id)
      return user?.displayName || user?.callName || user?.login || ''
    }
    return [...ids].sort((a, b) => label(a).localeCompare(label(b), getLocale()))
  })

  // Voters can be missing from the roster (left the team, alien votes) — ask for those
  // individual users so the table never falls back to "Uživatel 106".
  const missingVoterIds = createMemo(() =>
    voterIds().filter(id => !baseUsersById().has(id))
  )

  const extraUsersQuery = useQuery<(User | null)[], Error>(() => ({
    queryKey: ['users', 'poll-voters', 'extra', missingVoterIds().join(',')],
    queryFn: () => Promise.all(missingVoterIds().map(id => getUser(id).catch(() => null))),
    enabled: missingVoterIds().length > 0,
    staleTime: 1000 * 60 * 10
  }))

  const usersById = createMemo(() => {
    const map = new Map(baseUsersById())
    for (const user of extraUsersQuery.data ?? []) {
      if (user) map.set(user.id, user)
    }
    return map
  })

  const userName = (userId: number): string => {
    const user = usersById().get(userId)
    return (
      user?.displayName ||
      user?.callName ||
      user?.login ||
      tr('Uživatel {id}', { id: userId })
    )
  }

  const choiceOptions = (poll: Poll): PollOption[] =>
    (poll.options ?? []).filter(option => option.type !== 'TEXT')

  const textOptions = (poll: Poll): PollOption[] =>
    (poll.options ?? []).filter(option => option.type === 'TEXT')

  const voteOf = (poll: Poll, userId: number, optionId: number) =>
    (poll.votes ?? []).find(vote => vote.userId === userId && vote.optionId === optionId)

  /** Free-text answers form the "notes" column (the API has no per-vote note field). */
  const notesFor = (poll: Poll, userId: number): string =>
    textOptions(poll)
      .map(option => voteOf(poll, userId, option.id)?.stringValue)
      .filter((value): value is string => !!value)
      .join(' · ')

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
            <h2 class="text-xl font-semibold text-text mb-2">{tr('Anketa nenalezena')}</h2>
            <button class="btn btn-primary" onClick={() => navigate('/polls')}>{tr('Zpět k anketám')}</button>
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
                        {isClosed() ? tr('Uzavřeno') : tr('Otevřeno')}
                      </span>
                      <Show when={poll().voted}>
                        <span class="badge bg-primary-light text-primary">{tr('Hlasováno')}</span>
                      </Show>
                    </div>
                  </div>
                </div>
                <Show when={poll().descriptionHtml}>
                  <div class="prose prose-sm max-w-none mt-3" innerHTML={poll().descriptionHtml} />
                </Show>
              </div>

              <div class="space-y-3 mb-6">
                <Show when={!showResults()}>
                  <For each={poll().options ?? []}>
                    {(option) => (
                      <div class="bg-elevated rounded-xl border border-border p-4">
                        <Show when={option.type === 'TEXT'}>
                          <input
                            type="text"
                            class="input w-full"
                            placeholder={option.caption}
                            onInput={e => setOption(option.id, e.currentTarget.value)}
                            disabled={!canVote()}
                          />
                        </Show>
                        <Show when={option.type === 'NUMBER'}>
                          <div class="flex items-center gap-3">
                            <label class="text-sm text-text flex-1">{option.caption}</label>
                            <input
                              type="number"
                              class="input w-28"
                              onInput={e => setOption(option.id, parseFloat(e.currentTarget.value) || 0)}
                              disabled={!canVote()}
                            />
                          </div>
                        </Show>
                        <Show when={option.type === 'BOOLEAN'}>
                          <label class="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              class="checkbox w-5 h-5"
                              onChange={e => setOption(option.id, e.currentTarget.checked)}
                              disabled={!canVote()}
                            />
                            <span class="text-text">{option.caption}</span>
                          </label>
                        </Show>
                      </div>
                    )}
                  </For>
                </Show>
              </div>

              {/* Results: per-player table, or aggregate bars for anonymous polls. */}
              <Show when={showResults()}>
                <Show
                  when={!poll().anonymousResults}
                  fallback={
                    <div class="space-y-3 mb-6">
                      <For each={poll().options ?? []}>
                        {(option) => (
                          <div class="bg-elevated rounded-xl border border-border p-4">
                            <div class="flex items-center justify-between text-sm mb-1">
                              <span class="text-text">{option.caption}</span>
                              <span class="text-muted">
                                {tr('{n} hlasů', { n: voteCountFor(poll(), option) })}
                              </span>
                            </div>
                            <div class="h-2 bg-100 rounded-full overflow-hidden">
                              <div
                                class="h-full bg-primary rounded-full"
                                style={`width: ${totalVotes() ? (voteCountFor(poll(), option) / totalVotes()) * 100 : 0}%`}
                              />
                            </div>
                          </div>
                        )}
                      </For>
                      <p class="text-xs text-muted">
                        {tr('Anonymní anketa – jména hlasujících se nezobrazují.')}
                      </p>
                    </div>
                  }
                >
                  <div class="bg-elevated rounded-xl border border-border overflow-hidden mb-6">
                    <div class="overflow-x-auto">
                      <table class="w-full text-sm border-collapse">
                        <thead>
                          <tr class="bg-50 border-b border-border text-[11px] uppercase tracking-wide text-muted">
                            <th class="text-left font-medium px-3 py-2 sticky left-0 z-10 bg-50 whitespace-nowrap">
                              {tr('Člen')}
                            </th>
                            <For each={choiceOptions(poll())}>
                              {(option) => (
                                <th class="text-center font-medium px-3 py-2 whitespace-nowrap">
                                  {option.caption}
                                  <div class="text-[11px] font-normal normal-case text-muted">
                                    {tr('{n} hlasů', { n: voteCountFor(poll(), option) })}
                                  </div>
                                </th>
                              )}
                            </For>
                            <th class="text-left font-medium px-3 py-2 whitespace-nowrap">
                              {tr('Poznámka')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <For each={voterIds()}>
                            {(userId) => (
                              <tr class="border-b border-border-light last:border-b-0">
                                <td class="px-3 py-2 sticky left-0 z-10 bg-elevated">
                                  <div class="flex items-center gap-2">
                                    <Show
                                      when={
                                        usersById().get(userId)?.pictureUrl &&
                                        !brokenAvatars().has(userId)
                                          ? usersById().get(userId)!.pictureUrl
                                          : undefined
                                      }
                                      fallback={
                                        <span class="w-6 h-6 rounded-full bg-secondary-light flex items-center justify-center text-muted flex-shrink-0">
                                          <span class="icon-sm" innerHTML={ICONS['user']} />
                                        </span>
                                      }
                                    >
                                      {(pictureUrl) => (
                                        <img
                                          src={apiAssetUrl(pictureUrl())}
                                          alt=""
                                          loading="lazy"
                                          class="w-6 h-6 rounded-full object-cover flex-shrink-0"
                                          onError={() =>
                                            setBrokenAvatars(prev => new Set(prev).add(userId))
                                          }
                                        />
                                      )}
                                    </Show>
                                    <span class="text-text truncate">{userName(userId)}</span>
                                  </div>
                                </td>
                                <For each={choiceOptions(poll())}>
                                  {(option) => {
                                    const vote = () => voteOf(poll(), userId, option.id)
                                    return (
                                      <td class="px-3 py-2 text-center whitespace-nowrap">
                                        <Show
                                          when={vote()}
                                          fallback={<span class="text-muted">·</span>}
                                        >
                                          {(v) => (
                                            <span
                                              classList={{
                                                'text-success font-medium':
                                                  option.type === 'BOOLEAN' && !!v().booleanValue,
                                                'text-danger':
                                                  option.type === 'BOOLEAN' && !v().booleanValue
                                              }}
                                            >
                                              {option.type === 'BOOLEAN'
                                                ? trBool(!!v().booleanValue)
                                                : option.type === 'NUMBER'
                                                  ? String(v().numericValue ?? '')
                                                  : (v().stringValue ?? '')}
                                            </span>
                                          )}
                                        </Show>
                                      </td>
                                    )
                                  }}
                                </For>
                                <td class="px-3 py-2 text-muted text-xs max-w-[220px]">
                                  {notesFor(poll(), userId) || '—'}
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

              <Show when={canVote()}>
                <button
                  class="btn btn-primary w-full py-3"
                  disabled={voteMutation.isPending || Object.keys(selected()).length === 0}
                  onClick={() => voteMutation.mutate()}
                >
                  {voteMutation.isPending ? tr('Odesílání…') : tr('Hlasovat')}
                </button>
              </Show>

              <Show when={!canVote() && !showResults()}>
                <p class="text-center text-muted py-4">
                  {isClosed() ? tr('Anketa je uzavřena.') : tr('Výsledky budou zobrazeny po uzavření ankety.')}
                </p>
              </Show>
            </div>
          )
        }}
      </Show>
    </Show>
  )
}
