'use strict';
// Network-first mit Nachfrage: GitHub Pages erlaubt 10 Minuten Zwischenspeicher (max-age=600). Mit cache: 'no-cache'
// fragt der Browser bei jedem Abruf kurz beim Server nach (bei unveränderten Dateien nur eine winzige 304-Antwort),
// so kommt eine neue Version sofort an. Offline greift der Cache.
const CACHE = 'habits-v4';
const ASSETS = ['./', 'index.html', 'style.css', 'app.js', 'vendor/supabase.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req.url, { cache: 'no-cache' }).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
  );
});
// Push vom Server: iOS verlangt, dass jede Nachricht sichtbar angezeigt wird.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { /* ohne Daten */ }
  e.waitUntil(self.registration.showNotification(d.title || 'Habits', {
    body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || undefined,
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow('./'))));
});
