/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

// ── Precache all build assets ─────────────────────────────────────────────────
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// ── Force immediate activation on update ─────────────────────────────────────
self.addEventListener('install', () => {
  self.skipWaiting()
})
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return

  let data: { title: string; body: string; tag?: string; url?: string }
  try {
    data = event.data.json()
  } catch {
    data = { title: 'APEX', body: event.data.text() }
  }

  const options: NotificationOptions = {
    body: data.body,
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    tag: data.tag ?? 'apex-notification',
    data: { url: data.url ?? '/' },
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()

  const targetUrl = (event.notification.data?.url as string) ?? '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.postMessage({ type: 'NAVIGATE', url: targetUrl })
            return client.focus()
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
      })
  )
})
