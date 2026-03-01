const CACHE_NAME = 'pm-cache-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', () => {
  // Minimal fetch handler – required so the browser treats this as a valid
  // service worker and allows the Web App Badging API to function on
  // desktop and mobile when the app is installed as a PWA.
});
