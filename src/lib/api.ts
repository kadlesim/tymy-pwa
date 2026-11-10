// API Client with TSID authentication, envelope unwrapping, and filter builder

import type {
  ApiResponse,
  User,
  UserStatus,
  LoginResponse,
  Event,
  EventType,
  EventTypeCode,
  Attendance,
  AttendanceStatus,
  AttendanceHistory,
  Discussion,
  DiscussionDetail,
  DiscussionPage,
  DiscussionPost,
  Poll,
  PollOption,
  PollVote,
  Note,
  LiveUser,
  CaptionsCollection,
  Caption
} from './types'

import { getTeam } from './team'

// Re-export types for consumers
export type {
  ApiResponse,
  User,
  UserStatus,
  LoginResponse,
  Event,
  EventType,
  EventTypeCode,
  Attendance,
  AttendanceStatus,
  AttendanceHistory,
  Discussion,
  DiscussionDetail,
  DiscussionPage,
  DiscussionPost,
  Poll,
  PollOption,
  PollVote,
  Note,
  LiveUser,
  CaptionsCollection,
  Caption
}

const API_BASE = (import.meta.env as any).VITE_API_BASE ?? '/api'
const TSID_STORAGE_KEY = 'tymy:tsid'
const USER_STORAGE_KEY = 'tymy:user'
const TEAM_HEADER = 'X-Team-Subdomain'

/** Headers every call carries so the (dev) proxy reaches the right team host. */
function withTeam(headers: Headers): Headers {
  const team = getTeam()
  if (team) headers.set(TEAM_HEADER, team)
  return headers
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ============================================
// TSID Session Management
// ============================================

export function getTSID(): string | null {
  return localStorage.getItem(TSID_STORAGE_KEY)
}

export function setTSID(tsid: string): void {
  localStorage.setItem(TSID_STORAGE_KEY, tsid)
}

export function clearTSID(): void {
  localStorage.removeItem(TSID_STORAGE_KEY)
  localStorage.removeItem(USER_STORAGE_KEY)
}

export function getStoredUser(): User | null {
  try {
    const stored = localStorage.getItem(USER_STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export function setStoredUser(user: User): void {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
}

export function isAuthenticated(): boolean {
  return !!getTSID()
}

// ============================================
// Session expiry
// ============================================

type UnauthorizedListener = () => void
let unauthorizedListener: UnauthorizedListener | null = null

/**
 * Registers a single listener invoked whenever the API answers 401. The auth store
 * uses it to drop the stale session and send the user back to the login screen
 * instead of letting every screen fill up with "Unauthorized" errors.
 */
export function onUnauthorized(listener: UnauthorizedListener): void {
  unauthorizedListener = listener
}

// ============================================
// Core Request Function
// ============================================

async function requestEnvelope<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  const tsid = getTSID()
  const headers = new Headers(init.headers)

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  headers.set('Accept', 'application/json')

  if (tsid) {
    // Session is a PHPSESSID cookie. Browsers can't set it from JS, so the dev
    // proxy turns this header into a Cookie header. In production the cookie is
    // sent automatically (credentials: 'include').
    headers.set('X-Session-Key', tsid)
  }
  withTeam(headers)

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include'
  })

  if (response.status === 401) {
    unauthorizedListener?.()
  }

  let json: ApiResponse<T>
  try {
    json = await response.json()
  } catch {
    throw new ApiError('Neplatná odpověď serveru', response.status)
  }

  if (!response.ok || json.status !== 'OK') {
    const message =
      json.statusMessage ?? json.message ?? `HTTP ${response.status}: ${response.statusText}`
    throw new ApiError(message, response.status, json.data)
  }

  return json
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const json = await requestEnvelope<T>(path, init)
  return json.data as T
}

// Resolve a server-relative asset path (avatars, uploads) to a usable URL.
// Override with VITE_ASSET_ORIGIN when files live on a different host.
export function apiAssetUrl(path?: string): string {
  if (!path) return '/icons/icon-192.png'
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:')) return path
  const origin = (import.meta.env as Record<string, string | undefined>)['VITE_ASSET_ORIGIN'] ?? ''
  const normalised = path.startsWith('/') ? path : `/${path}`
  if (origin) return `${origin}${normalised}`

  // In development the dev proxy serves the assets; tell it which team to ask.
  const team = import.meta.env.DEV ? getTeam() : null
  if (!team) return normalised
  return `${normalised}${normalised.includes('?') ? '&' : '?'}team=${encodeURIComponent(team)}`
}

// ============================================
// Binary downloads (XLSX exports)
// ============================================

async function requestBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const tsid = getTSID()
  const headers = withTeam(new Headers(init.headers))
  if (tsid) headers.set('X-Session-Key', tsid)

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include'
  })

  if (response.status === 401) {
    unauthorizedListener?.()
    throw new ApiError('Platnost přihlášení vypršela', 401)
  }
  if (!response.ok) {
    throw new ApiError(`Export se nezdařil (HTTP ${response.status})`, response.status)
  }
  return response.blob()
}

/**
 * Attendance report as an XLSX file (`Event:Export:report`).
 * Returns the spreadsheet itself, not a JSON envelope.
 */
export async function exportEventReport(year: number, page: number = 1): Promise<Blob> {
  return requestBlob(`/event/export/report?year=${year}&page=${page}`)
}

/** Flat attendance export (one row per user × event) as XLSX. */
export async function exportAttendance(
  from: string,
  until: string,
  type?: number
): Promise<Blob> {
  const params = new URLSearchParams({ from, until })
  if (type !== undefined) params.set('type', String(type))
  return requestBlob(`/event/export/attendance?${params.toString()}`)
}

// ============================================
// Teams
// ============================================

/**
 * Checks that `<team>.tymy.cz` exists before the user continues to the login screen.
 * A real team answers 401 (login required) or 200; unknown subdomains are redirected
 * to the 404 page, which we treat as "not found".
 */
export async function checkTeam(team: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/eventTypes`, {
      headers: { Accept: 'application/json', [TEAM_HEADER]: team },
      redirect: 'manual',
      cache: 'no-store'
    })
    if (response.type === 'opaqueredirect') return false
    if (response.status >= 300 && response.status < 400) return false
    return response.status === 200 || response.status === 401
  } catch {
    return false
  }
}

// ============================================
// Filter Builder for Events
// ============================================

export type FilterOperator = '>' | '<' | '=' | '!=' | '>=' | '<='

export interface FilterCondition {
  field: string
  operator: FilterOperator
  value: string | number | Date
}

export function buildFilterString(filters: FilterCondition[]): string {
  return filters
    .map(({ field, operator, value }) => {
      const formattedValue = formatFilterValue(value)
      return `${field}${operator}${formattedValue}`
    })
    .join('~')
}

function formatFilterValue(value: string | number | Date): string {
  if (value instanceof Date) {
    // API format: YYYYMMDDHHmmss
    return value.toISOString().replace(/[-:]/g, '').replace(/\..+/, '')
  }
  return String(value)
}

export function createEventFilters(params: {
  startAfter?: Date
  startBefore?: Date
  endAfter?: Date
  endBefore?: Date
  types?: string[]
}): FilterCondition[] {
  const filters: FilterCondition[] = []
  
  if (params.startAfter) filters.push({ field: 'startTime', operator: '>', value: params.startAfter })
  if (params.startBefore) filters.push({ field: 'startTime', operator: '<', value: params.startBefore })
  if (params.endAfter) filters.push({ field: 'endTime', operator: '>', value: params.endAfter })
  if (params.endBefore) filters.push({ field: 'endTime', operator: '<', value: params.endBefore })
  if (params.types?.length) {
    // For multiple types, we'd need multiple filters or the API supports arrays
    params.types.forEach(type => {
      filters.push({ field: 'type', operator: '=', value: type })
    })
  }
  
  return filters
}

// ============================================
// Auth API
// ============================================

export async function login(credentials: { login: string; password: string }): Promise<LoginResponse> {
  // The API expects a form-encoded body for POST /login; JSON is rejected.
  const body = new URLSearchParams({
    login: credentials.login,
    password: credentials.password
  })

  const envelope = await requestEnvelope<User>('/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: body.toString()
  })

  const sessionKey = (envelope as unknown as { sessionKey?: string }).sessionKey
  if (!sessionKey) {
    throw new ApiError('Server nevrátil přihlašovací klíč', 200)
  }
  const user = envelope.data as User

  setTSID(sessionKey)
  setStoredUser(user)
  return { sessionKey, data: user }
}

export async function loginWithSession(): Promise<LoginResponse | null> {
  try {
    const envelope = await requestEnvelope<User>('/loginPhp')
    const sessionKey = (envelope as unknown as { sessionKey?: string }).sessionKey
    if (!sessionKey) return null
    const user = envelope.data as User
    setTSID(sessionKey)
    setStoredUser(user)
    return { sessionKey, data: user }
  } catch {
    return null
  }
}

export async function logout(): Promise<void> {
  try {
    await request('/logout', { method: 'GET' })
  } finally {
    clearTSID()
  }
}

export async function register(userData: {
  login: string
  password: string
  email: string
  callName: string
  firstName: string
  lastName: string
  note?: string
}): Promise<User> {
  const data = await request<{ id: number; login: string; canLogin: boolean; createdAt: string; status: string; callName: string; email: string; jerseyNumber: string; gender: string; pictureUrl: string; displayName: string; note?: string }>('/users/register', {
    method: 'POST',
    body: JSON.stringify(userData)
  })
  return data as unknown as User
}

export async function requestPasswordReset(data: {
  email: string
  callbackUri: string
  hostname: string
}): Promise<void> {
  await request('/pwdlost', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function resetPassword(resetCode: string): Promise<string> {
  return request<string>(`/pwdreset/${resetCode}`)
}

// ============================================
// Events API
// ============================================

export async function getEvents(filters?: FilterCondition[]): Promise<Event[]> {
  let path = '/events'
  if (filters?.length) {
    path += `?filter=${encodeURIComponent(buildFilterString(filters))}`
  }
  return request<Event[]>(path)
}

export interface EventsQueryOptions {
  filters?: FilterCondition[]
  /** e.g. "startTime" or "startTime__desc" */
  order?: string
  limit?: number
  offset?: number
}

export async function getEventsWithMyAttendance(options: EventsQueryOptions = {}): Promise<Event[]> {
  const params = new URLSearchParams()
  if (options.filters?.length) params.set('filter', buildFilterString(options.filters))
  if (options.order) params.set('order', options.order)
  if (options.limit !== undefined) params.set('limit', String(options.limit))
  if (options.offset !== undefined) params.set('offset', String(options.offset))

  const query = params.toString()
  return request<Event[]>(`/events/withMyAttendance${query ? `?${query}` : ''}`)
}

export async function getEvent(id: number): Promise<Event> {
  return request<Event>(`/event/${id}`)
}

export async function getEventHistory(id: number): Promise<AttendanceHistory[]> {
  return request<AttendanceHistory[]>(`/event/${id}/history`)
}

export async function createEvents(events: Partial<Event>[]): Promise<Event[]> {
  return request<Event[]>('/events/create', {
    method: 'POST',
    body: JSON.stringify(events)
  })
}

export async function updateEvent(id: number, event: Partial<Event>): Promise<Event> {
  return request<Event>(`/event/${id}`, {
    method: 'PUT',
    body: JSON.stringify(event)
  })
}

export async function deleteEvent(id: number): Promise<void> {
  await request(`/event/${id}`, { method: 'DELETE' })
}

export async function getEventTypes(): Promise<EventType[]> {
  return request<EventType[]>('/eventTypes')
}

export async function setAttendance(attendance: { userId: number; eventId: number; preStatus: string; preDescription?: string }[]): Promise<void> {
  await request('/attendance', {
    method: 'POST',
    body: JSON.stringify(attendance)
  })
}

// ============================================
// Discussions/Chat API
// ============================================

export async function getDiscussions(): Promise<Discussion[]> {
  return request<Discussion[]>('/discussions')
}

export async function getAccessibleDiscussions(): Promise<Discussion[]> {
  return request<Discussion[]>('/discussions/accessible')
}

export async function getDiscussionsWithNew(): Promise<Discussion[]> {
  return request<Discussion[]>('/discussions/withNew')
}

export async function getNewOnlyDiscussions(): Promise<{ id: number; newPosts: number }[]> {
  return request<{ id: number; newPosts: number }[]>('/discussions/newOnly')
}

export async function getDiscussion(id: number): Promise<DiscussionDetail> {
  return request<DiscussionDetail>(`/discussion/${id}`)
}

export async function getDiscussionPosts(id: number, mode: 'bb' | 'html' = 'bb', page: number = 1): Promise<DiscussionPage> {
  return request<DiscussionPage>(`/discussion/${id}/${mode}/${page}`)
}

export async function searchDiscussionPosts(id: number, mode: 'bb' | 'html', page: number, search: string): Promise<DiscussionPage> {
  return request<DiscussionPage>(`/discussion/${id}/${mode}/${page}/?search=${encodeURIComponent(search)}`)
}

export async function createDiscussion(discussion: { caption: string; description: string }): Promise<DiscussionDetail> {
  return request<DiscussionDetail>('/discussions', {
    method: 'POST',
    body: JSON.stringify(discussion)
  })
}

export async function updateDiscussion(id: number, discussion: { caption: string; description: string }): Promise<DiscussionDetail> {
  return request<DiscussionDetail>(`/discussions`, {
    method: 'PUT',
    body: JSON.stringify({ id, ...discussion })
  })
}

export async function deleteDiscussion(id: number): Promise<void> {
  await request('/discussions', {
    method: 'DELETE',
    body: JSON.stringify({ id })
  })
}

export async function createDiscussionPost(discussionId: number, post: string): Promise<DiscussionPost> {
  return request<DiscussionPost>(`/discussions/${discussionId}/post`, {
    method: 'POST',
    body: JSON.stringify({ post })
  })
}

/**
 * Edits a post or toggles its sticky flag. The API takes the discussion id in the URL
 * and the post id in the body (`PUT /discussions/{discussionId}/post`).
 */
export async function updateDiscussionPost(
  discussionId: number,
  post: { id: number; post?: string; sticky?: boolean }
): Promise<DiscussionPost> {
  return request<DiscussionPost>(`/discussions/${discussionId}/post`, {
    method: 'PUT',
    body: JSON.stringify(post)
  })
}

/** Deletes one post: discussion id in the URL, post id in the body. */
export async function deleteDiscussionPost(discussionId: number, postId: number): Promise<void> {
  await request(`/discussions/${discussionId}/post`, {
    method: 'DELETE',
    body: JSON.stringify({ id: postId })
  })
}

/**
 * Adds (`POST`) or removes (`DELETE`) the current user's reaction to a post.
 * The body is a bare JSON string with the emoji, e.g. `"👍"`.
 */
export async function reactToPost(
  discussionId: number,
  postId: number,
  emoji: string,
  remove: boolean = false
): Promise<void> {
  await request(`/discussions/${discussionId}/post/${postId}/react`, {
    method: remove ? 'DELETE' : 'POST',
    body: JSON.stringify(emoji)
  })
}

export async function previewDiscussionPost(post: string): Promise<string> {
  return request<string>('/discussion/preview', {
    method: 'POST',
    body: JSON.stringify({ post })
  })
}

// ============================================
// Polls API
// ============================================

export async function getPolls(): Promise<Poll[]> {
  return request<Poll[]>('/polls')
}

export async function getMenuPolls(): Promise<Poll[]> {
  return request<Poll[]>('/polls/menu')
}

export async function getPoll(id: number): Promise<Poll> {
  return request<Poll>(`/polls/${id}`)
}

export async function submitPollVotes(pollId: number, votes: { userId: number; optionId: number; stringValue?: string; numericValue?: number; booleanValue?: boolean }[]): Promise<void> {
  await request(`/polls/${pollId}/votes`, {
    method: 'POST',
    body: JSON.stringify(votes)
  })
}

// ============================================
// Notes API
// ============================================

export async function getNotes(): Promise<Note[]> {
  return request<Note[]>('/notes')
}

export async function getNotesHtml(): Promise<Note[]> {
  return request<Note[]>('/notes/html')
}

export async function getNote(id: number): Promise<Note> {
  return request<Note>(`/notes/${id}`)
}

export async function createNote(note: Omit<Note, 'id' | 'createdById' | 'createdAt' | 'updatedById' | 'updatedAt' | 'readCounter' | 'updateCounter' | 'version' | 'canRead' | 'canWrite'>): Promise<void> {
  await request('/notes', {
    method: 'POST',
    body: JSON.stringify(note)
  })
}

export async function updateNote(note: Partial<Note> & { id: number }): Promise<void> {
  await request('/notes', {
    method: 'PUT',
    body: JSON.stringify(note)
  })
}

export async function deleteNote(id: number): Promise<void> {
  await request(`/notes/${id}`, { method: 'DELETE' })
}

// ============================================
// Users API
// ============================================

export async function getUser(id: number): Promise<User> {
  return request<User>(`/user/${id}`)
}

export async function updateUser(id: number, user: Partial<User>): Promise<User> {
  return request<User>(`/user/${id}`, {
    method: 'PUT',
    body: JSON.stringify(user)
  })
}

export async function uploadAvatar(id: number, base64Image: string): Promise<void> {
  await request(`/user/${id}/avatar`, {
    method: 'POST',
    body: base64Image,
    headers: { 'Content-Type': 'text/plain' }
  })
}

export async function getUsersByStatus(status: UserStatus): Promise<User[]> {
  return request<User[]>(`/users/status/${status}`)
}

export async function createUser(user: Partial<User> & { password: string }): Promise<User> {
  return request<User>('/users', {
    method: 'POST',
    body: JSON.stringify(user)
  })
}

export async function getLiveUsers(): Promise<LiveUser[]> {
  return request<LiveUser[]>('/live')
}

// ============================================
// Captions/i18n API
// ============================================

export async function getCaptions(): Promise<Caption[]> {
  return request<Caption[]>('/captions')
}

export async function getCaption(language: 'CZ' | 'EN', domain: string): Promise<Record<string, string>> {
  return request<Record<string, string>>(`/caption/${language}/${domain}`)
}

// ============================================
// Utility: Batch API calls for hydration
// ============================================

export async function hydrateApp(): Promise<{
  user: User | null
  captions: Caption[]
  eventTypes: EventType[]
  discussions: Discussion[]
}> {
  const [user, captions, eventTypes, discussions] = await Promise.allSettled([
    isAuthenticated() ? getStoredUser() : Promise.resolve(null),
    getCaptions(),
    getEventTypes(),
    getAccessibleDiscussions()
  ])

  return {
    user: user.status === 'fulfilled' ? user.value : null,
    captions: captions.status === 'fulfilled' ? captions.value : [],
    eventTypes: eventTypes.status === 'fulfilled' ? eventTypes.value : [],
    discussions: discussions.status === 'fulfilled' ? discussions.value : []
  }
}