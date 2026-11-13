// Service worker de la app instalada (RistoSuite CRM). Solo atiende las notificaciones push: no guarda nada en caché,
// así que nunca puede mostrar una versión vieja del panel.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch { d = {} }
  event.waitUntil((async () => {
    // Si el CRM está abierto y a la vista, el aviso ya aparece en pantalla: no se duplica con una notificación del sistema.
    // (Las pruebas siempre se muestran.)
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (!d.prueba && ventanas.some((v) => v.visibilityState === 'visible')) return
    await self.registration.showNotification(d.titulo || 'RistoSuite', {
      body: d.cuerpo || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: d.tag || undefined,
      data: { url: typeof d.url === 'string' && d.url.startsWith('/') ? d.url : '/' },
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href
  event.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const abierta = ventanas.find((v) => new URL(v.url).origin === self.location.origin)
    if (abierta) { await abierta.focus(); try { await abierta.navigate(url) } catch { await self.clients.openWindow(url) } return }
    await self.clients.openWindow(url)
  })())
})
