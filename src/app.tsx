// App shell with providers, routing, and layout

import { createEffect, onCleanup, Show } from 'solid-js'
import { Router, Route, Navigate, useLocation, type RouteSectionProps } from '@solidjs/router'
import { initAuth, revalidateSession, useIsAuthenticated, useIsLoading } from './lib/auth'
import { loadCaptions } from './lib/captions'
import { initPWA, setDeferredPrompt } from './lib/pwa'
import { ICONS } from './lib/icons'
import Layout from './features/layout/Layout'
import LoginPage from './features/auth/LoginPage'
import TeamPage from './features/auth/TeamPage'
import RegisterPage from './features/auth/RegisterPage'
import ForgotPasswordPage from './features/auth/ForgotPasswordPage'
import ResetPasswordPage from './features/auth/ResetPasswordPage'
import EventsPage from './features/events/EventsPage'
import EventDetailPage from './features/events/EventDetailPage'
import EventCreatePage from './features/events/EventCreatePage'
import DiscussionsPage from './features/discussions/DiscussionsPage'
import DiscussionDetailPage from './features/discussions/DiscussionDetailPage'
import PollsPage from './features/polls/PollsPage'
import PollDetailPage from './features/polls/PollDetailPage'
import ProfilePage from './features/profile/ProfilePage'
import SettingsPage from './features/profile/SettingsPage'
import UsersPage from './features/users/UsersPage'
import UserDetailPage from './features/users/UserDetailPage'
import FilesPage from './features/files/FilesPage'
import ReportsPage from './features/reports/ReportsPage'

// Initialize app on mount
createEffect(() => {
  initAuth()
  // The captions endpoint is not present on all API deployments; only try it
  // in production. Built-in Czech defaults cover development.
  if (import.meta.env.PROD) loadCaptions('CZ')
  initPWA()
  
  const handleBeforeInstallPrompt = (e: Event) => {
    e.preventDefault()
    setDeferredPrompt(e as BeforeInstallPromptEvent)
  }

  // Phones suspend tabs for hours; re-check the session when the app comes back so
  // the first request after resuming does not hit a 401 with a stale token.
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') void revalidateSession()
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  onCleanup(() => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })
})

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

function Splash() {
  return (
    <div class="min-h-dvh flex items-center justify-center">
      <span class="icon icon-lg text-muted animate-spin" innerHTML={ICONS['spinner']} aria-label="Načítání" />
    </div>
  )
}

function PrivateRoute(props: RouteSectionProps<unknown>) {
  const location = useLocation()

  return (
    <Show when={!useIsLoading()} fallback={<Splash />}>
      <Show
        when={useIsAuthenticated()}
        fallback={<Navigate href="/team" state={{ from: location.pathname }} />}
      >
        <Layout>{props.children as any}</Layout>
      </Show>
    </Show>
  )
}

// Team selection: skipped as soon as a valid session exists.
function TeamRoute(props: RouteSectionProps<unknown>) {
  return (
    <Show when={!useIsLoading()} fallback={<Splash />}>
      <Show when={!useIsAuthenticated()} fallback={<Navigate href="/events" />}>
        <>{props.children as any}</>
      </Show>
    </Show>
  )
}

function PublicRoute(props: RouteSectionProps<unknown>) {
  return (
    <Show when={!useIsLoading()} fallback={<Splash />}>
      <Show when={!useIsAuthenticated()} fallback={<Navigate href="/events" />}>
        <>{props.children as any}</>
      </Show>
    </Show>
  )
}

export default function App() {
  return (
    <Router>
      <Route path="/team" component={TeamRoute} >
        <Route path="" component={TeamPage} />
      </Route>
      <Route path="/login" component={PublicRoute} >
        <Route path="" component={LoginPage} />
      </Route>
      <Route path="/register" component={PublicRoute} >
        <Route path="" component={RegisterPage} />
      </Route>
      <Route path="/forgot-password" component={PublicRoute} >
        <Route path="" component={ForgotPasswordPage} />
      </Route>
      <Route path="/reset-password/:code" component={PublicRoute} >
        <Route path="" component={ResetPasswordPage} />
      </Route>
      
      <Route path="/events" component={PrivateRoute} >
        <Route path="" component={EventsPage} />
        <Route path="/:id" component={EventDetailPage} />
        <Route path="/create" component={EventCreatePage} />
      </Route>
      
      <Route path="/discussions" component={PrivateRoute} >
        <Route path="" component={DiscussionsPage} />
        <Route path="/:id" component={DiscussionDetailPage} />
      </Route>
      
      <Route path="/polls" component={PrivateRoute} >
        <Route path="" component={PollsPage} />
        <Route path="/:id" component={PollDetailPage} />
      </Route>
      
      <Route path="/profile" component={PrivateRoute} >
        <Route path="" component={ProfilePage} />
        <Route path="/settings" component={SettingsPage} />
      </Route>
      
      <Route path="/users" component={PrivateRoute} >
        <Route path="" component={UsersPage} />
        <Route path="/:id" component={UserDetailPage} />
      </Route>

      <Route path="/files" component={PrivateRoute} >
        <Route path="" component={FilesPage} />
      </Route>

      <Route path="/reports" component={PrivateRoute} >
        <Route path="" component={ReportsPage} />
      </Route>
      
      <Route path="/" component={() => <Navigate href="/events" />} />
      <Route path="*any" component={() => <Navigate href="/events" />} />
    </Router>
  )
}