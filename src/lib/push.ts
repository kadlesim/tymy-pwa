// Browser Web Push: subscription lifecycle on top of the server that already exists
// (`POST /api/push-notification`, VAPID key below, payload `{title,message,image?,url?}`).
//
// Subscriptions are created from the page, never from the service worker: the SW cannot
// read `localStorage`, and our API client has to attach the `X-Session-Key` header.

import { registerPushSubscription } from './api'

/** Public key published by the Tymy server (identical on dev and pd). */
const VAPID_PUBLIC_KEY =
  (import.meta.env as Record<string, string | undefined>)['VITE_VAPID_PUBLIC_KEY'] ??
  'BNFwVh2n9jBpGDMx3Kiz47ldm8GrSP74Ff4VL54v6AoPg01BnT2TtqdEXBm6M7C8Nx3PoqqPie7kESKgm8jkAog'

const ENABLED_KEY = 'tymy:push:enabled'

export type PushState = 'unsupported' | 'insecure' | 'no-sw' | 'denied' | 'off' | 'subscribed'

function readEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

function writeEnabled(value: boolean): void {
  try {
    if (value) localStorage.setItem(ENABLED_KEY, '1')
    else localStorage.removeItem(ENABLED_KEY)
  } catch {
    // storage unavailable — the preference just won't stick
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
  return output
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

/** Current SW registration, if the app is running a service worker (production). */
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null
  } catch {
    return null
  }
}

export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported'
  // Push requires a secure context; localhost is exempt, a LAN IP over HTTP is not.
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'insecure'
  if (Notification.permission === 'denied') return 'denied'

  const registration = await getRegistration()
  if (!registration) return 'no-sw'

  try {
    const subscription = await registration.pushManager.getSubscription()
    return subscription && readEnabled() ? 'subscribed' : 'off'
  } catch {
    return 'off'
  }
}

/**
 * Asks for permission (must be called from a user gesture), subscribes and registers the
 * subscription with the API. Existing subscriptions are reused.
 */
export async function enablePush(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'

  const registration = await getRegistration()
  if (!registration) {
    // No service worker (Vite dev server): subscriptions cannot be created there.
    return 'no-sw'
  }

  try {
    // Wait for the worker to activate — `getRegistration()` alone may return an
    // installing registration on the first load.
    const ready = await navigator.serviceWorker.ready
    let subscription = await ready.pushManager.getSubscription()
    if (!subscription) {
      subscription = await ready.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource
      })
    }
    await registerPushSubscription(subscription.toJSON())
    writeEnabled(true)
    return 'subscribed'
  } catch (error) {
    console.warn('Push subscription failed:', error)
    return 'off'
  }
}

/** Stops this browser from receiving pushes (the server prunes the stale row on failure). */
export async function disablePush(): Promise<void> {
  const registration = await getRegistration()
  if (registration) {
    try {
      const subscription = await registration.pushManager.getSubscription()
      await subscription?.unsubscribe()
    } catch {
      // ignore — clearing the local flag is what matters
    }
  }
  writeEnabled(false)
}

/**
 * Re-posts the current subscription after login/refresh. Never asks for permission; only
 * repairs the server row when the user had push enabled already.
 */
export async function syncPushSubscription(): Promise<void> {
  if (!isPushSupported() || !readEnabled() || Notification.permission !== 'granted') return
  const registration = await getRegistration()
  if (!registration) return
  try {
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) await registerPushSubscription(subscription.toJSON())
  } catch (error) {
    console.debug('Push subscription sync failed:', error)
  }
}

/** Logout: stop this browser from receiving the previous user's notifications. */
export async function unsubscribeOnLogout(): Promise<void> {
  await disablePush()
}

export function isPushEnabledLocally(): boolean {
  return readEnabled()
}
