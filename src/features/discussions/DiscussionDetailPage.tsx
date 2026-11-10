// Discussion detail, rendered as a chat:
// – newest messages at the bottom, composer pinned to the bottom of the pane
// – only the newest page (~20 posts) is loaded first, older pages load when the
//   user scrolls up and the reading position is preserved while they prepend
// – one date divider per day, one separator between messages

import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { useNavigate, useParams } from '@solidjs/router'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/solid-query'
import {
  apiAssetUrl,
  createDiscussionPost,
  getDiscussionPosts,
  type DiscussionPage,
  type DiscussionPost
} from '../../lib/api'
import { queryKeys } from '../../lib/queryClient'
import { useCommonCaptions } from '../../lib/captions'
import { bbcodeToHtml } from '../../lib/bbcode'
import { formatDisplayTime, formatRelativeTime, parseApiDate } from '../../lib/date-filters'
import { ICONS } from '../../lib/icons'

// The API paginates oldest → newest, so page 1 holds the *oldest* posts. The chat
// starts at the last page instead (newest posts) and walks backwards from there.
// This sentinel makes the first request discover the real last page number.
const NEWEST_PAGE = Number.MAX_SAFE_INTEGER
const MAX_COMPOSER_HEIGHT = 120

const BBCODE_BUTTONS = [
  { tag: 'b', icon: 'bold', title: 'Tučně' },
  { tag: 'i', icon: 'italic', title: 'Kurzíva' },
  { tag: 'u', icon: 'underline', title: 'Podtržení' },
  { tag: 'url', icon: 'link', title: 'Odkaz' },
  { tag: 'quote', icon: 'quote', title: 'Citace' },
  { tag: 'code', icon: 'code', title: 'Kód' },
  { tag: 'list', icon: 'list', title: 'Seznam' }
]

type ChatItem =
  | { type: 'day'; key: string; label: string }
  | { type: 'post'; key: string; post: DiscussionPost; grouped: boolean }

const dayStart = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

function dayLabel(date: Date): string {
  const today = new Date()
  const diffDays = Math.round((dayStart(today) - dayStart(date)) / 86_400_000)
  if (diffDays === 0) return 'Dnes'
  if (diffDays === 1) return 'Včera'
  return date.toLocaleDateString(
    'cs-CZ',
    date.getFullYear() === today.getFullYear()
      ? { weekday: 'long', day: 'numeric', month: 'long' }
      : { day: 'numeric', month: 'numeric', year: 'numeric' }
  )
}

const postedAt = (post: DiscussionPost): Date => parseApiDate(post.createdAt)

const authorName = (post: DiscussionPost): string =>
  post.createdBy.callName || post.createdBy.displayName || post.createdBy.login

// Group consecutive posts by the same author when they are close in time, the way
// chat threads do, so a burst of messages does not repeat the avatar every line.
const GROUPING_WINDOW_MS = 5 * 60 * 1000

function toChatItems(posts: DiscussionPost[]): ChatItem[] {
  const items: ChatItem[] = []
  let previous: DiscussionPost | undefined

  for (const post of posts) {
    const date = postedAt(post)
    const dayKey = `day-${date.toDateString()}`
    if (!items.some(item => item.type === 'day' && item.key === dayKey)) {
      items.push({ type: 'day', key: dayKey, label: dayLabel(date) })
      previous = undefined
    }

    const grouped =
      previous !== undefined &&
      previous.createdById === post.createdById &&
      date.getTime() - postedAt(previous).getTime() < GROUPING_WINDOW_MS

    items.push({ type: 'post', key: `post-${post.id}`, post, grouped })
    previous = post
  }

  return items
}

function Loading() {
  return (
    <div class="flex items-center justify-center h-64">
      <div class="flex flex-col items-center gap-4">
        <span class="icon icon-lg text-primary animate-spin" innerHTML={ICONS['spinner']} />
        <p class="text-muted">Načítání…</p>
      </div>
    </div>
  )
}

export default function DiscussionDetailPage() {
  const params = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { tDiscussions } = useCommonCaptions()

  const discussionId = () => parseInt(params['id'] ?? '0', 10)
  const chatKey = () => queryKeys.discussionChat(discussionId())

  const [newPost, setNewPost] = createSignal('')
  const [showPreview, setShowPreview] = createSignal(false)
  const [scroller, setScroller] = createSignal<HTMLDivElement>()
  const [atBottom, setAtBottom] = createSignal(true)
  let textareaEl: HTMLTextAreaElement | undefined

  // ---------- data ----------

  const loadPage = async (pageParam: number): Promise<DiscussionPage> => {
    const id = discussionId()
    // First request: find out how many pages there are, then take the newest one.
    if (pageParam === NEWEST_PAGE) {
      const first = await getDiscussionPosts(id, 'bb', 1)
      const last = first.paging.numberOfPages || 1
      return last <= 1 ? first : getDiscussionPosts(id, 'bb', last)
    }
    return getDiscussionPosts(id, 'bb', pageParam)
  }

  const postsQuery = useInfiniteQuery<
    DiscussionPage,
    Error,
    { pages: DiscussionPage[]; pageParams: number[] },
    readonly unknown[],
    number
  >(() => ({
    queryKey: chatKey(),
    queryFn: ({ pageParam }) => loadPage(pageParam),
    initialPageParam: NEWEST_PAGE,
    getNextPageParam: (lastPage, _pages, lastPageParam: number) => {
      const current =
        lastPageParam === NEWEST_PAGE ? lastPage.paging.numberOfPages || 1 : lastPageParam
      return current > 1 ? current - 1 : undefined
    },
    enabled: discussionId() > 0,
    staleTime: 1000 * 15
  }))

  const pages = () => postsQuery.data?.pages ?? []
  const discussion = () => pages()[0]?.discussion

  const messages = createMemo<DiscussionPost[]>(() => {
    const seen = new Set<number>()
    const all: DiscussionPost[] = []
    // pages[0] is the newest page, so walk backwards to render oldest first.
    for (const page of [...pages()].reverse()) {
      for (const post of page.posts) {
        if (seen.has(post.id)) continue
        seen.add(post.id)
        all.push(post)
      }
    }
    return all.sort((a, b) => postedAt(a).getTime() - postedAt(b).getTime())
  })

  const items = createMemo(() => toChatItems(messages()))

  // ---------- scrolling ----------

  // Height of the scroll pane before older posts were prepended; restoring
  // `scrollHeight - anchor` afterwards keeps the reader where they were.
  let pendingAnchor: number | null = null
  let lastSeenId: number | undefined

  const scrollToBottom = (smooth = false) => {
    const el = scroller()
    if (!el) return
    if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    else el.scrollTop = el.scrollHeight
    setAtBottom(true)
  }

  const loadOlder = (force = false) => {
    const el = scroller()
    if (!el) return
    if (!postsQuery.hasNextPage || postsQuery.isFetchingNextPage) return
    // Forced = scrolled to the top; otherwise only when the pane has no overflow.
    if (!force && el.scrollHeight > el.clientHeight + 8) return
    pendingAnchor = el.scrollHeight
    void postsQuery.fetchNextPage()
  }

  const handleScroll = () => {
    const el = scroller()
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 64)
    if (el.scrollTop < 96) loadOlder(true)
  }

  // Jump to the newest message once the first page is on screen.
  let didInitialScroll = false
  createEffect(() => {
    const el = scroller()
    if (!el || didInitialScroll || !postsQuery.data) return
    didInitialScroll = true
    requestAnimationFrame(() => {
      scrollToBottom()
      loadOlder()
    })
  })

  // Older pages were prepended: keep the reading position and fill short panes.
  let seenPageCount = 0
  createEffect(() => {
    const count = postsQuery.data?.pages.length ?? 0
    if (count === seenPageCount) return
    const prepended = seenPageCount > 0 && count > seenPageCount
    seenPageCount = count
    if (!prepended) return
    const anchor = pendingAnchor
    pendingAnchor = null
    requestAnimationFrame(() => {
      const el = scroller()
      if (!el) return
      if (anchor !== null) el.scrollTop = el.scrollHeight - anchor
      loadOlder()
    })
  })

  // A new message arrived (own post or refetch): follow it when already at the end.
  createEffect(() => {
    const id = messages().at(-1)?.id
    if (id === undefined) return
    if (lastSeenId === undefined) {
      lastSeenId = id
      return
    }
    if (id === lastSeenId) return
    lastSeenId = id
    if (atBottom()) requestAnimationFrame(() => scrollToBottom(true))
  })

  // ---------- composer ----------

  const resizeComposer = () => {
    const el = textareaEl
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_COMPOSER_HEIGHT)}px`
  }

  const insertBbcode = (tag: string) => {
    const el = textareaEl
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const text = newPost()
    const selected = text.slice(start, end)
    let replacement = ''
    switch (tag) {
      case 'b':
      case 'i':
      case 'u':
        replacement = `[${tag}]${selected || 'text'}[/${tag}]`
        break
      case 'url':
        replacement = selected.startsWith('http')
          ? `[url]${selected}[/url]`
          : `[url=${selected || 'https://example.com'}]odkaz[/url]`
        break
      case 'quote':
        replacement = `[quote]${selected || 'citace'}[/quote]`
        break
      case 'code':
        replacement = `[code]${selected || 'kód'}[/code]`
        break
      case 'list':
        replacement = `[list]\n[*]${selected || 'položka 1'}\n[*]položka 2\n[/list]`
        break
    }
    setNewPost(text.slice(0, start) + replacement + text.slice(end))
    requestAnimationFrame(() => {
      const pos = start + replacement.length
      el.focus()
      el.setSelectionRange(pos, pos)
      resizeComposer()
    })
  }

  const createMutation = useMutation<DiscussionPost, Error, string>(() => ({
    mutationFn: (post: string) => createDiscussionPost(discussionId(), post),
    onSuccess: async () => {
      setNewPost('')
      setShowPreview(false)
      if (textareaEl) {
        textareaEl.style.height = 'auto'
        textareaEl.focus()
      }
      await queryClient.invalidateQueries({ queryKey: chatKey() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.discussionsWithNew() })
      requestAnimationFrame(() => scrollToBottom(true))
    }
  }))

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault()
    if (!newPost().trim() || createMutation.isPending) return
    createMutation.mutate(newPost())
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return
    if (e.isComposing) return
    e.preventDefault()
    if (newPost().trim() && !createMutation.isPending) createMutation.mutate(newPost())
  }

  // ---------- render ----------

  const renderItem = (item: ChatItem) => {
    if (item.type === 'day') {
      return (
        <div class="flex items-center gap-3 pt-4 pb-2">
          <div class="flex-1 h-px bg-border" />
          <span class="text-xs font-medium text-muted whitespace-nowrap">{item.label}</span>
          <div class="flex-1 h-px bg-border" />
        </div>
      )
    }

    const post = item.post
    return (
      <div class="flex gap-3 py-3 border-b border-border-light last:border-b-0">
        <div class="w-8 flex-shrink-0">
          <Show when={!item.grouped}>
            <img
              src={apiAssetUrl(post.createdBy.pictureUrl)}
              alt=""
              loading="lazy"
              class="w-8 h-8 rounded-full object-cover border border-border"
            />
          </Show>
        </div>
        <div class="flex-1 min-w-0">
          <Show when={!item.grouped}>
            <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-1">
              <span class="text-sm font-semibold text-text truncate">{authorName(post)}</span>
              <time
                class="text-xs text-muted"
                datetime={post.createdAt}
                title={post.createdAtStr || formatRelativeTime(post.createdAt)}
              >
                {formatDisplayTime(post.createdAt)}
              </time>
              <Show when={post.sticky}>
                <span class="badge bg-warning-light text-warning">Připnuto</span>
              </Show>
            </div>
          </Show>
          <div class="chat-bubble prose prose-sm max-w-none" innerHTML={bbcodeToHtml(post.post)} />
        </div>
      </div>
    )
  }

  return (
    <Show when={!postsQuery.isPending} fallback={<Loading />}>
      <Show
        when={discussion()}
        fallback={
          <div class="text-center p-8">
            <h2 class="text-xl font-semibold text-text mb-2">Diskuze nenalezena</h2>
            <button class="btn btn-primary" onClick={() => navigate('/discussions')}>
              Zpět na chat
            </button>
          </div>
        }
      >
        {(info) => (
          <div class="chat-shell max-w-3xl mx-auto flex flex-col bg-elevated border border-border rounded-xl overflow-hidden">
            {/* Header */}
            <header class="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border">
              <button
                class="header-btn p-2 rounded-lg hover:bg-100"
                onClick={() => navigate('/discussions')}
                aria-label="Zpět na chat"
              >
                <span class="icon" innerHTML={ICONS['back']} />
              </button>
              <div class="min-w-0 flex-1">
                <h1 class="text-base font-semibold text-text truncate">{info().caption}</h1>
                <div class="flex items-center gap-2 text-xs text-muted">
                  <span>{info().numberOfPosts} příspěvků</span>
                  <Show when={info().publicRead}>
                    <span class="badge bg-success-light text-success">Veřejné</span>
                  </Show>
                  <Show when={!info().canWrite}>
                    <span class="badge bg-danger-light text-danger">Uzamčeno</span>
                  </Show>
                  <Show when={info().description}>
                    <span class="hidden sm:block truncate">{info().description}</span>
                  </Show>
                </div>
              </div>
            </header>

            {/* Messages */}
            <div class="relative flex-1 min-h-0">
              <div
                ref={el => setScroller(el)}
                class="chat-scroll h-full overflow-y-auto px-4 pb-2"
                onScroll={handleScroll}
                role="log"
              >
                <Show when={postsQuery.isFetchingNextPage}>
                  <div class="flex justify-center pt-3">
                    <span
                      class="icon-sm text-muted animate-spin"
                      innerHTML={ICONS['spinner']}
                      aria-label="Načítání starších příspěvků"
                    />
                  </div>
                </Show>
                <Show when={!postsQuery.hasNextPage && messages().length > 0}>
                  <p class="text-center text-xs text-muted pt-3">Začátek diskuze</p>
                </Show>

                <Show
                  when={messages().length > 0}
                  fallback={
                    <p class="text-center text-muted py-10">
                      Zatím žádné příspěvky. Napište první zprávu.
                    </p>
                  }
                >
                  <For each={items()}>{item => renderItem(item)}</For>
                </Show>

                <Show when={postsQuery.isError}>
                  <div class="flex flex-col items-center gap-2 py-6">
                    <p class="text-sm text-danger">
                      {(postsQuery.error as Error | null)?.message ?? 'Načtení se nezdařilo.'}
                    </p>
                    <button class="btn btn-secondary btn-sm" onClick={() => postsQuery.refetch()}>
                      Zkusit znovu
                    </button>
                  </div>
                </Show>
              </div>

              <Show when={!atBottom()}>
                <button
                  type="button"
                  class="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1.5 rounded-full bg-elevated border border-border shadow-md text-xs font-medium text-text hover:bg-100"
                  onClick={() => scrollToBottom(true)}
                >
                  <span class="icon-sm" innerHTML={ICONS['chevronDown']} />
                  Nejnovější
                </button>
              </Show>
            </div>

            {/* Composer */}
            <div class="flex-shrink-0 border-t border-border bg-elevated">
              <Show
                when={info().canWrite}
                fallback={
                  <p class="px-4 py-4 text-sm text-muted text-center">
                    Do této diskuze nemůžete přispívat.
                  </p>
                }
              >
                <Show when={showPreview() && newPost().trim()}>
                  <div class="max-h-40 overflow-y-auto px-4 pt-3">
                    <p class="text-xs font-medium text-muted mb-1">Náhled</p>
                    <div class="prose prose-sm max-w-none" innerHTML={bbcodeToHtml(newPost())} />
                  </div>
                </Show>

                <form onSubmit={handleSubmit} class="p-3">
                  <div class="flex items-end gap-2 rounded-2xl border border-border bg-50 px-2 py-1 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary-light">
                    <textarea
                      ref={el => {
                        textareaEl = el
                      }}
                      rows={1}
                      class="chat-input flex-1 text-sm text-text"
                      value={newPost()}
                      onInput={e => {
                        setNewPost(e.currentTarget.value)
                        resizeComposer()
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder={tDiscussions('writePost')}
                      aria-label="Nová zpráva"
                      disabled={createMutation.isPending}
                    />
                    <button
                      type="submit"
                      class="btn btn-primary w-9 h-9 !p-0 rounded-full mb-1 flex-shrink-0"
                      disabled={createMutation.isPending || !newPost().trim()}
                      aria-label="Odeslat"
                      title="Odeslat (Enter)"
                    >
                      <span
                        class="icon"
                        classList={{ 'animate-pulse': createMutation.isPending }}
                        innerHTML={ICONS['send']}
                      />
                    </button>
                  </div>

                  <div class="mt-1.5 flex items-center gap-1">
                    <For each={BBCODE_BUTTONS}>
                      {btn => (
                        <button
                          type="button"
                          class="p-1.5 rounded-md text-muted hover:bg-100 hover:text-text"
                          title={btn.title}
                          aria-label={btn.title}
                          onClick={() => insertBbcode(btn.tag)}
                        >
                          <span class="icon-sm" innerHTML={ICONS[btn.icon]} />
                        </button>
                      )}
                    </For>

                    <div class="flex-1" />

                    <button
                      type="button"
                      class="btn btn-secondary btn-sm"
                      onClick={() => setShowPreview(!showPreview())}
                      aria-pressed={showPreview()}
                    >
                      <span class="icon-sm" innerHTML={ICONS['preview']} />
                      Náhled
                    </button>
                  </div>

                  <Show when={createMutation.isError}>
                    <p class="mt-2 text-xs text-danger">
                      {(createMutation.error as Error | null)?.message ?? 'Odeslání se nezdařilo.'}
                    </p>
                  </Show>
                </form>
              </Show>
            </div>
          </div>
        )}
      </Show>
    </Show>
  )
}
