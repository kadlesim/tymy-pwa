// Authentication state management and helpers

import { createSignal, createEffect, onCleanup } from 'solid-js'
import { User, UserStatus } from './types'
import {
  ApiError,
  getTSID,
  setTSID,
  clearTSID,
  getStoredUser,
  setStoredUser,
  isAuthenticated,
  login,
  logout,
  loginWithSession,
  register,
  requestPasswordReset,
  resetPassword,
  apiAssetUrl,
  getUser,
  onUnauthorized
} from './api'
import { queryClient } from './queryClient'

// ============================================
// Auth Context / Store
// ============================================

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  roles: string[]
}

const [authState, setAuthState] = createSignal<AuthState>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  roles: []
})

// True when the previous session was rejected by the server (expired / logged out
// elsewhere). The login screen uses it to explain why the user is back there.
const [sessionExpired, setSessionExpired] = createSignal(false)

const PERSISTED_CACHE_KEY = 'tymy:query-cache'
const REVALIDATE_AFTER_MS = 5 * 60 * 1000
let lastSessionCheck = 0

/** Drops every trace of the current session (token, cached user, persisted queries). */
function dropSession(expired: boolean): void {
  clearTSID()
  try {
    window.localStorage.removeItem(PERSISTED_CACHE_KEY)
  } catch {
    // storage can be unavailable (private mode) – nothing to clean then
  }
  queryClient.clear()
  setAuthState({ user: null, isLoading: false, isAuthenticated: false, roles: [] })
  setSessionExpired(expired)
}

// Any 401 from the API means the stored session is no longer usable: forget it and
// let the route guards take the user to the login screen.
onUnauthorized(() => dropSession(true))

/**
 * Asks the API whether the stored session still works.
 * `true` = valid, `false` = rejected (401/403), `null` = could not tell (offline).
 */
async function verifySession(userId: number): Promise<boolean | null> {
  try {
    const user = await getUser(userId)
    if (user) setStoredUser(user)
    return true
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return false
    }
    return null
  }
}

// ============================================
// Initialize Auth on App Start
// ============================================

export async function initAuth(): Promise<void> {
  setAuthState(prev => ({ ...prev, isLoading: true }))

  try {
    // Restore a stored session first (the session cookie is HttpOnly and cannot
    // be read from JS, so the stored user is our source of truth) — but ask the API
    // whether that session still exists before trusting it.
    if (isAuthenticated()) {
      const user = getStoredUser()
      if (user) {
        const valid = await verifySession(user.id)
        lastSessionCheck = Date.now()
        if (valid !== false) {
          setAuthState({
            user,
            isLoading: false,
            isAuthenticated: true,
            roles: user.roles
          })
        } else {
          dropSession(true)
        }
        return
      }
    }

    // Reuse an existing site session. Only meaningful when the app is served
    // from the same origin as the API (production); in dev it just redirects.
    if (!import.meta.env.DEV) {
      const phpSession = await loginWithSession()
      if (phpSession) {
        setAuthState({
          user: phpSession.data,
          isLoading: false,
          isAuthenticated: true,
          roles: phpSession.data.roles
        })
        return
      }
    }
  } catch (error) {
    console.warn('Auth initialization failed:', error)
  } finally {
    setAuthState(prev => ({ ...prev, isLoading: false }))
  }
}

/**
 * Re-checks the session after the app has been in the background (phones suspend
 * tabs for hours) so the next API call does not fail with 401.
 * Throttled to one request per `REVALIDATE_AFTER_MS`.
 */
export async function revalidateSession(): Promise<void> {
  const state = authState()
  if (!state.isAuthenticated || !state.user) return
  if (Date.now() - lastSessionCheck < REVALIDATE_AFTER_MS) return
  lastSessionCheck = Date.now()

  const valid = await verifySession(state.user.id)
  if (valid === false) dropSession(true)
}

export function useSessionExpired(): boolean {
  return sessionExpired()
}

export function clearSessionExpired(): void {
  setSessionExpired(false)
}

// ============================================
// Public Auth Actions
// ============================================

export async function doLogin(loginName: string, password: string): Promise<User> {
  setAuthState(prev => ({ ...prev, isLoading: true }))
  try {
    const response = await login({ login: loginName, password })
    lastSessionCheck = Date.now()
    clearSessionExpired()
    setAuthState({
      user: response.data,
      isLoading: false,
      isAuthenticated: true,
      roles: response.data.roles
    })
    return response.data
  } catch (error) {
    setAuthState(prev => ({ ...prev, isLoading: false }))
    throw error
  }
}

export async function doRegister(data: {
  login: string
  password: string
  email: string
  callName: string
  firstName: string
  lastName: string
  note?: string
}): Promise<User> {
  setAuthState(prev => ({ ...prev, isLoading: true }))
  try {
    const user = await register(data)
    setAuthState(prev => ({ ...prev, isLoading: false }))
    return user
  } catch (error) {
    setAuthState(prev => ({ ...prev, isLoading: false }))
    throw error
  }
}

export async function doLogout(): Promise<void> {
  setAuthState(prev => ({ ...prev, isLoading: true }))
  try {
    await logout()
  } catch (error) {
    console.warn('Logout request failed:', error)
  } finally {
    dropSession(false)
  }
}

export async function doRequestPasswordReset(email: string, callbackUri: string, hostname: string): Promise<void> {
  await requestPasswordReset({ email, callbackUri, hostname })
}

export async function doResetPassword(resetCode: string): Promise<string> {
  return resetPassword(resetCode)
}

// Re-export for backward compatibility
export { doRequestPasswordReset as requestPasswordReset, doResetPassword as resetPassword }

// ============================================
// Role/Permission Helpers
// ============================================

export function useAuth() {
  return authState
}

export function useUser(): User | null {
  return authState().user
}

export function useIsLoading(): boolean {
  return authState().isLoading
}

export function useIsAuthenticated(): boolean {
  return authState().isAuthenticated
}

export function useRoles(): string[] {
  return authState().roles
}

export function hasRole(role: string): boolean {
  return authState().roles.includes(role)
}

export function hasAnyRole(roles: string[]): boolean {
  return roles.some(role => authState().roles.includes(role))
}

export function canPlanEvents(): boolean {
  const user = authState().user
  return user?.roles.includes('ATT') ?? false
}

export function canManageEvents(): boolean {
  const user = authState().user
  return user?.roles.includes('SUPER') ?? false
}

export function canViewResults(): boolean {
  const user = authState().user
  return user?.roles.includes('USR') ?? false
}

export function isAdmin(): boolean {
  return hasRole('SUPER')
}

export function isCoach(): boolean {
  return hasRole('ATT') || hasRole('SUPER')
}

export function getUserStatus(): UserStatus | null {
  return authState().user?.status ?? null
}

export function getDisplayName(): string {
  return authState().user?.displayName ?? authState().user?.callName ?? 'Host'
}

export function getUserAvatar(): string {
  return apiAssetUrl(authState().user?.pictureUrl)
}

// ============================================
// Auth Guard Helper
// ============================================

export function requireAuth(redirectTo: string = '/login'): User {
  const state = authState()
  if (!state.isAuthenticated || !state.user) {
    throw new Error(`REDIRECT:${redirectTo}`)
  }
  return state.user
}

export function requireRole(role: string, redirectTo: string = '/'): User {
  const user = requireAuth(redirectTo)
  if (!user.roles.includes(role)) {
    throw new Error(`REDIRECT:${redirectTo}`)
  }
  return user
}

// ============================================
// Session Persistence (optional - for offline)
// ============================================

export function enableSessionPersistence(): () => void {
  // Store auth state changes to IndexedDB for offline recovery
  // This is a placeholder - implement with idb if needed
  return () => {}
}