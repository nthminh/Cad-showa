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

// Handle badge updates from the page.
// On Android, setAppBadge must be called from the service worker context,
// so the page posts a message here and we forward it via self.navigator.
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'SET_BADGE') return;
  if (!('setAppBadge' in self.navigator)) return;
  const count = event.data.count ?? 0;
  if (count > 0) {
    self.navigator.setAppBadge(count).catch(() => {});
  } else {
    self.navigator.clearAppBadge().catch(() => {});
  }
});
