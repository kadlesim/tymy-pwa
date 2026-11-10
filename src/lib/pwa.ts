// PWA: service worker registration, updates, and install prompt

import { createSignal } from 'solid-js'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

interface SyncManager {
  register(tag: string): Promise<void>
}

let swRegistration: (ServiceWorkerRegistration & { sync?: SyncManager }) | null = null
let deferredPrompt: BeforeInstallPromptEvent | null = null

export interface PWAUpdateInfo {
  available: boolean
  refreshing: boolean
  offlineReady: boolean
}

const [updateInfo, setUpdateInfo] = createSignal<PWAUpdateInfo>({
  available: false,
  refreshing: false,
  offlineReady: false
})

export async function initPWA(): Promise<void> {
  if (!('serviceWorker' in navigator)) return

  try {
    // vite-plugin-pwa injects the registration script in production builds.
    // `ready` resolves once a worker controls the page; in dev it stays pending.
    const registration = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      sync?: SyncManager
    }

    swRegistration = registration

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      if (!newWorker) return
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          setUpdateInfo(prev => ({ ...prev, available: true }))
          window.dispatchEvent(new CustomEvent('pwa:update-available'))
        }
      })
    })

    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    setInterval(() => registration.update(), 1000 * 60 * 60)

    window.addEventListener('online', () => {
      setUpdateInfo(prev => ({ ...prev, offlineReady: false }))
      registration.sync?.register('background-sync').catch(() => {})
    })

    window.addEventListener('offline', () => {
      setUpdateInfo(prev => ({ ...prev, offlineReady: true }))
    })
  } catch (error) {
    console.error('PWA init failed:', error)
  }
}

export async function applyUpdate(): Promise<void> {
  if (!swRegistration?.waiting) return
  setUpdateInfo(prev => ({ ...prev, refreshing: true }))
  swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })
}

export function dismissUpdate(): void {
  setUpdateInfo(prev => ({ ...prev, available: false }))
}

export function usePWAUpdate() {
  return updateInfo
}

export function isPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

const [canInstall, setCanInstall] = createSignal(false)

export function setDeferredPrompt(event: BeforeInstallPromptEvent): void {
  deferredPrompt = event
  setCanInstall(true)
}

export function useInstallPrompt() {
  const prompt = async (): Promise<void> => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    deferredPrompt = null
    setCanInstall(false)
  }
  return { prompt, canInstall }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission !== 'denied') return Notification.requestPermission()
  return 'denied'
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!('PushManager' in window)) return null

  const registration = await navigator.serviceWorker.ready
  const permission = await requestNotificationPermission()
  if (permission !== 'granted') return null

  try {
    const vapidPublicKey = (import.meta.env as Record<string, string | undefined>)['VITE_VAPID_PUBLIC_KEY']
    const applicationServerKey = vapidPublicKey
      ? (urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource)
      : undefined

    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    })
  } catch (error) {
    console.error('Push subscription failed:', error)
    return null
  }
}

export async function shareEvent(event: { title: string; text: string; url: string }): Promise<boolean> {
  if (!navigator.share) return false
  try {
    await navigator.share(event)
    return true
  } catch (error) {
    if ((error as Error).name !== 'AbortError') console.error('Share failed:', error)
    return false
  }
}

export function registerBackgroundSync(tag: string): Promise<void> {
  if (!swRegistration?.sync) return Promise.reject(new Error('Background sync not supported'))
  return swRegistration.sync.register(tag)
}
