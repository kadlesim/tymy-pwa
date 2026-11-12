// One chat message: avatar, author, BBCode body, reactions and the hover menu
// (react / copy / edit / pin / delete). Rights mirror the server (PostManager):
//   edit   – own post (legacy UI also requires discussion.editablePosts)
//   delete – discussion.canDelete, or own post when editablePosts is **false**
//            (with editablePosts the server answers 403 "Nedostatečná práva")
//   pin    – discussion.canStick
//   react, copy – everyone

import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import { useMutation, useQueryClient } from '@tanstack/solid-query'
import {
  apiAssetUrl,
  deleteDiscussionPost,
  reactToPost,
  updateDiscussionPost,
  type DiscussionPage,
  type DiscussionPost
} from '../../lib/api'
import { queryKeys } from '../../lib/queryClient'
import { useAuth } from '../../lib/auth'
import { bbcodeToHtml } from '../../lib/bbcode'
import { formatDisplayTime, formatRelativeTime } from '../../lib/date-filters'
import { tr } from '../../lib/i18n'
import { ICONS } from '../../lib/icons'

/** Emoji offered in the picker (the legacy app has a huge picker; this is enough). */
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '👏', '🔥']

/**
 * The server stores only single-code-point reactions (`mb_strlen($reaction) !== 1` is
 * silently ignored), so the heart must be sent as U+2764 without the emoji variation
 * selector — otherwise the optimistic reaction disappears after the next refetch.
 */
const normalizeReaction = (emoji: string): string => emoji.replace(/\uFE0F/g, '')

/** Display form: the stored heart is text-presentation, so re-add the selector. */
const displayReaction = (emoji: string): string =>
  normalizeReaction(emoji) === '❤' ? '❤️' : emoji

export const authorName = (post: DiscussionPost): string =>
  post.createdBy?.callName ||
  post.createdBy?.displayName ||
  post.createdBy?.login ||
  post.userName ||
  tr('Neznámý autor')

type ChatData = { pages: DiscussionPage[]; pageParams: number[] }

/** Applies an optimistic patch to one post inside the infinite chat cache. */
function patchPost(
  client: ReturnType<typeof useQueryClient>,
  discussionId: number,
  postId: number,
  updater: (post: DiscussionPost) => DiscussionPost
): void {
  client.setQueryData<ChatData>(queryKeys.discussionChat(discussionId), previous => {
    if (!previous) return previous
    return {
      ...previous,
      pages: previous.pages.map(page => ({
        ...page,
        posts: page.posts.map(post => (post.id === postId ? updater(post) : post))
      }))
    }
  })
}

function plainText(bbcode: string): string {
  const parsed = new DOMParser().parseFromString(bbcodeToHtml(bbcode), 'text/html')
  return (parsed.body.textContent ?? '').trim()
}

export interface ChatMessageProps {
  discussionId: number
  post: DiscussionPost
  /** Continuation of the previous message by the same author – hides avatar/name. */
  grouped: boolean
  canEdit: boolean
  canDelete: boolean
  canStick: boolean
}

export default function ChatMessage(props: ChatMessageProps) {
  const auth = useAuth()
  const queryClient = useQueryClient()

  const meId = () => auth().user?.id ?? null
  const chatKey = () => queryKeys.discussionChat(props.discussionId)

  const [menuOpen, setMenuOpen] = createSignal(false)
  const [openUp, setOpenUp] = createSignal(false)
  const [editing, setEditing] = createSignal(false)
  const [draft, setDraft] = createSignal('')
  const [copied, setCopied] = createSignal(false)

  const reactions = () => Object.entries(props.post.reactions ?? {}) as [string, number[]][]
  const iReacted = (emoji: string) => {
    const id = meId()
    if (id === null) return false
    const target = normalizeReaction(emoji)
    const entry = reactions().find(([key]) => normalizeReaction(key) === target)
    return entry ? entry[1].includes(id) : false
  }

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: chatKey() })
  }

  const reactMutation = useMutation<void, Error, { emoji: string; remove: boolean }>(() => ({
    mutationFn: value => reactToPost(props.discussionId, props.post.id, value.emoji, value.remove),
    onError: invalidate
  }))

  const editMutation = useMutation<DiscussionPost, Error, string>(() => ({
    mutationFn: text => updateDiscussionPost(props.discussionId, { id: props.post.id, post: text }),
    onSuccess: () => {
      setEditing(false)
      invalidate()
    }
  }))

  const deleteMutation = useMutation<void, Error, void>(() => ({
    mutationFn: () => deleteDiscussionPost(props.discussionId, props.post.id),
    onSuccess: () => {
      invalidate()
      void queryClient.invalidateQueries({ queryKey: queryKeys.discussionsWithNew() })
    }
  }))

  const stickMutation = useMutation<DiscussionPost, Error, boolean>(() => ({
    mutationFn: sticky => updateDiscussionPost(props.discussionId, { id: props.post.id, sticky }),
    onSuccess: invalidate
  }))

  /** Opens above the button when the message sits near the bottom of the pane. */
  const toggleMenu = (event: MouseEvent) => {
    const button = event.currentTarget as HTMLElement
    const scroller = button.closest('.chat-scroll')
    const boundaryBottom = scroller?.getBoundingClientRect().bottom ?? window.innerHeight
    setOpenUp(boundaryBottom - button.getBoundingClientRect().bottom < 260)
    setMenuOpen(!menuOpen())
  }

  // Close the menu when clicking anywhere outside this message.
  createEffect(() => {    if (!menuOpen()) return
    const handler = (event: MouseEvent) => {
      const path = event.composedPath() as Array<Element | Window>
      const inside = path.some(
        element =>
          element instanceof HTMLElement && element.dataset['messageMenu'] === String(props.post.id)
      )
      if (!inside) setMenuOpen(false)
    }
    document.addEventListener('click', handler)
    onCleanup(() => document.removeEventListener('click', handler))
  })

  const toggleReaction = (emoji: string) => {
    const id = meId()
    if (id === null) return
    // Normalise before every use — the server key and our picker key must match.
    const target = normalizeReaction(emoji)
    const remove = iReacted(target)

    patchPost(queryClient, props.discussionId, props.post.id, post => {
      const reactionsMap = { ...(post.reactions ?? {}) }
      const users = new Set(reactionsMap[target] ?? [])
      if (remove) users.delete(id)
      else users.add(id)
      if (users.size > 0) reactionsMap[target] = [...users]
      else delete reactionsMap[target]
      return { ...post, reactions: reactionsMap }
    })

    reactMutation.mutate({ emoji: target, remove })
  }

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(plainText(props.post.post))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked – silently ignore, the text is still on screen
    }
    setMenuOpen(false)
  }

  const startEdit = () => {
    setDraft(props.post.post)
    setEditing(true)
    setMenuOpen(false)
  }

  const saveEdit = () => {
    const text = draft().trim()
    if (!text || editMutation.isPending) return
    if (text === props.post.post.trim()) {
      setEditing(false)
      return
    }
    editMutation.mutate(text)
  }

  const removeMessage = () => {
    setMenuOpen(false)
    if (!window.confirm(tr('Smazat tento příspěvek?'))) return
    deleteMutation.mutate()
  }

  const toggleSticky = () => {
    setMenuOpen(false)
    stickMutation.mutate(!props.post.sticky)
  }

  return (
    <div
      class="group flex gap-3 py-3 border-b border-border-light last:border-b-0"
      data-message-menu={props.post.id}
    >
      <div class="w-8 flex-shrink-0">
        <Show when={!props.grouped}>
          <Show
            when={props.post.createdBy?.pictureUrl}
            fallback={
              <span
                class="w-8 h-8 rounded-full bg-secondary-light flex items-center justify-center text-muted"
                title={authorName(props.post)}
              >
                <span class="icon-sm" innerHTML={ICONS['user']} />
              </span>
            }
          >
            {(pictureUrl) => (
              <img
                src={apiAssetUrl(pictureUrl())}
                alt=""
                loading="lazy"
                class="w-8 h-8 rounded-full object-cover border border-border"
              />
            )}
          </Show>
        </Show>
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2 mb-1">
          <div class="min-w-0">
            <Show when={!props.grouped}>
              <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span class="text-sm font-semibold text-text truncate">{authorName(props.post)}</span>
                <time
                  class="text-xs text-muted"
                  datetime={props.post.createdAt}
                  title={props.post.createdAtStr || formatRelativeTime(props.post.createdAt)}
                >
                  {formatDisplayTime(props.post.createdAt)}
                </time>
                <Show when={props.post.updatedAt}>
                  <span
                    class="text-xs text-muted italic"
                    title={`Upraveno: ${props.post.updatedAtStr ?? props.post.updatedAt}`}
                  >
                    upraveno
                  </span>
                </Show>
                <Show when={props.post.sticky}>
                  <span class="badge bg-warning-light text-warning">{tr('Připnuto')}</span>
                </Show>
              </div>
            </Show>
          </div>

          {/* Actions: always visible on touch, revealed on hover with a mouse. */}
          <div class="relative flex-shrink-0 -mt-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
            <button
              type="button"
              class="header-btn p-1.5 rounded-md hover:bg-100"
              aria-label={tr('Možnosti zprávy')}
              aria-expanded={menuOpen()}
              onClick={toggleMenu}
            >
              <span class="icon-sm" innerHTML={ICONS['more']} />
            </button>

            <Show when={menuOpen()}>
              <div
                class="absolute right-0 z-20 w-48 bg-elevated border border-border rounded-lg shadow-lg py-1 animate-slide-down"
                classList={{ 'bottom-full mb-1': openUp(), 'top-full mt-1': !openUp() }}
              >
                <div class="flex flex-wrap gap-0.5 px-2 pb-1.5 mb-1 border-b border-border-light">
                  <For each={REACTIONS}>
                    {emoji => (
                      <button
                        type="button"
                        class="p-1 rounded hover:bg-100 text-base leading-none"
                        classList={{ 'bg-primary-light': iReacted(emoji) }}
                        title={iReacted(emoji) ? tr('Zrušit reakci') : tr('Reagovat')}
                        onClick={() => toggleReaction(emoji)}
                      >
                        {emoji}
                      </button>
                    )}
                  </For>
                </div>

                <button
                  type="button"
                  class="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-text hover:bg-100"
                  onClick={copyMessage}
                >
                  <span class="icon-sm" innerHTML={copied() ? ICONS['check'] : ICONS['copy']} />
                  {copied() ? tr('Zkopírováno') : tr('Kopírovat')}
                </button>

                <Show when={props.canEdit}>
                  <button
                    type="button"
                    class="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-text hover:bg-100"
                    onClick={startEdit}
                  >
                    <span class="icon-sm" innerHTML={ICONS['edit']} />
                    Upravit
                  </button>
                </Show>

                <Show when={props.canStick}>
                  <button
                    type="button"
                    class="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-text hover:bg-100"
                    onClick={toggleSticky}
                    disabled={stickMutation.isPending}
                  >
                    <span class="icon-sm" innerHTML={ICONS['pin']} />
                    {props.post.sticky ? tr('Odšpendlit') : tr('Připnout')}
                  </button>
                </Show>

                <Show when={props.canDelete}>
                  <button
                    type="button"
                    class="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-danger hover:bg-danger-light"
                    onClick={removeMessage}
                    disabled={deleteMutation.isPending}
                  >
                    <span class="icon-sm" innerHTML={ICONS['delete']} />
                    Smazat
                  </button>
                </Show>
              </div>
            </Show>
          </div>
        </div>

        <Show
          when={editing()}
          fallback={
            <div class="chat-bubble prose prose-sm max-w-none" innerHTML={bbcodeToHtml(props.post.post)} />
          }
        >
          <textarea
            class="input w-full text-sm min-h-[72px] resize-y"
            value={draft()}
            onInput={e => setDraft(e.currentTarget.value)}
            aria-label={tr('Upravit příspěvek')}
            autofocus
          />
          <div class="flex items-center gap-2 mt-1.5">
            <button
              type="button"
              class="btn btn-primary btn-sm"
              onClick={saveEdit}
              disabled={editMutation.isPending || !draft().trim()}
            >
              {editMutation.isPending ? tr('Ukládám…') : tr('Uložit')}
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              onClick={() => setEditing(false)}
              disabled={editMutation.isPending}
            >
              {tr('Zrušit')}
            </button>
            <Show when={editMutation.isError}>
              <span class="text-xs text-danger">
                {(editMutation.error as Error | null)?.message ?? tr('Uložení se nezdařilo.')}
              </span>
            </Show>
          </div>
        </Show>

        <Show when={reactions().length > 0}>
          <div class="flex flex-wrap gap-1 mt-1.5">
            <For each={reactions()}>
              {([emoji, users]) => (
                <button
                  type="button"
                  class="badge border transition-colors"
                  classList={{
                    'bg-primary-light border-primary text-text': iReacted(emoji),
                    'bg-50 border-border text-text-secondary': !iReacted(emoji)
                  }}
                  title={iReacted(emoji) ? tr('Zrušit reakci') : tr('Reagovat')}
                  onClick={() => toggleReaction(emoji)}
                >
                  <span class="text-sm leading-none">{displayReaction(emoji)}</span>
                  <Show when={users.length > 1}>
                    <span class="text-[11px]">{users.length}</span>
                  </Show>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  )
}
