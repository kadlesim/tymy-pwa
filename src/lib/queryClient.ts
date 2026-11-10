// TanStack Query configuration with offline persistence

import { QueryClient } from '@tanstack/solid-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { persistQueryClient } from '@tanstack/query-persist-client-core'

// Create persister with localStorage
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'tymy:query-cache',
  throttleTime: 1000
})

// Create QueryClient with optimized defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 1,
      refetchOnWindowFocus: 'always',
      refetchOnReconnect: true,
      refetchOnMount: false
    },
    mutations: {
      retry: 0,
      onError: (error) => {
        console.error('Mutation error:', error)
      }
    }
  }
})

// Persist query client to localStorage
if (typeof window !== 'undefined') {
  persistQueryClient({
    queryClient,
    persister,
    maxAge: 1000 * 60 * 60 * 24 * 7
  })
}

// Query Keys Factory
export const queryKeys = {
  currentUser: () => ['user'] as const,
  auth: () => ['auth'] as const,
  captions: (lang: string) => ['captions', lang] as const,
  events: (filters?: string) => ['events', filters ?? 'all'] as const,
  eventsWithAttendance: (filters?: string) => ['events', 'withAttendance', filters ?? 'all'] as const,
  event: (id: number) => ['event', id] as const,
  eventAttendance: (id: number) => ['event', id, 'attendance'] as const,
  eventHistory: (id: number) => ['event', id, 'history'] as const,
  eventTypes: () => ['eventTypes'] as const,
  discussions: () => ['discussions'] as const,
  discussionsWithNew: () => ['discussions', 'withNew'] as const,
  discussionsNewOnly: () => ['discussions', 'newOnly'] as const,
  discussion: (id: number) => ['discussion', id] as const,
  discussionPosts: (id: number, mode: string, page: number) => ['discussion', id, 'posts', mode, page] as const,
  // Infinite, newest-first page list used by the chat view.
  discussionChat: (id: number) => ['discussion', id, 'chat'] as const,
  polls: () => ['polls'] as const,
  menuPolls: () => ['polls', 'menu'] as const,
  poll: (id: number) => ['poll', id] as const,
  notes: () => ['notes'] as const,
  notesHtml: () => ['notes', 'html'] as const,
  note: (id: number) => ['note', id] as const,
  users: (status?: string) => ['users', status ?? 'all'] as const,
  user: (id: number) => ['user', id] as const,
  liveUsers: () => ['users', 'live'] as const,
  caption: (lang: string, domain: string) => ['caption', lang, domain] as const
}

// Helper: Invalidate related queries
export async function invalidateEvents(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: ['events'] })
}

export async function invalidateDiscussions(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: ['discussions'] })
}

export async function invalidatePolls(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: ['polls'] })
}

export async function invalidateUser(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: ['user'] })
}

// Helper: Optimistic updates
export function optimisticUpdate<T>(
  queryKey: readonly unknown[],
  updater: (old: T | undefined) => T
): () => void {
  const snapshot = queryClient.getQueryData<T>(queryKey)
  queryClient.setQueryData(queryKey, updater)
  
  return () => {
    if (snapshot === undefined) {
      queryClient.removeQueries({ queryKey })
    } else {
      queryClient.setQueryData(queryKey, snapshot)
    }
  }
}