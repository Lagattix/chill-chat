// Service Worker per notifiche push
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installato');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker attivato');
  event.waitUntil(self.clients.claim());
});

// Gestisce click su notifica
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notifica cliccata');
  event.notification.close();
  
  // Apri/focus sulla finestra dell'app
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('lagattix.github.io') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/chill-chat/');
      }
    })
  );
});
