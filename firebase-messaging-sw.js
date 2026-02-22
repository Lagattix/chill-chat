// Firebase Cloud Messaging Service Worker
// NOME FILE: firebase-messaging-sw.js (deve essere nella root del sito)

importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

const firebaseConfig = {
  apiKey: "AIzaSyCp2SjlW-JX9FeW1csVslhJm4qW51kzSKg",
  authDomain: "chill-chat-4945d.firebaseapp.com",
  projectId: "chill-chat-4945d",
  storageBucket: "chill-chat-4945d.firebasestorage.app",
  messagingSenderId: "803118071656",
  appId: "1:803118071656:web:90708d615b96cdfd31e0dd"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Gestisce notifiche push in background (app chiusa)
messaging.onBackgroundMessage((payload) => {
  console.log('📞 [FCM] Push ricevuto in background:', payload);
  
  const { notification, data } = payload;
  const callData = data || {};
  
  const notificationTitle = notification?.title || '📞 Chiamata in arrivo';
  const notificationOptions = {
    body: notification?.body || 'Chiamata in arrivo',
    icon: '/chill-chat/icon-192.png',
    badge: '/chill-chat/icon-192.png',
    tag: `call-${callData.callId}`,
    requireInteraction: true,
    vibrate: [300, 200, 300, 200, 300, 200, 1000, 300, 200, 300],
    data: callData,
    actions: [
      { action: 'accept', title: '✅ Accetta' },
      { action: 'decline', title: '❌ Rifiuta' }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Click su notifica
self.addEventListener('notificationclick', (event) => {
  console.log('📞 [FCM] Notifica cliccata:', event.action);
  event.notification.close();

  const { callId, fromId, fromName, callType } = event.notification.data || {};

  if (event.action === 'decline') {
    // Rifiuta chiamata
    fetch(`https://firestore.googleapis.com/v1/projects/chill-chat-4945d/databases/(default)/documents/calls/${callId}?key=AIzaSyCp2SjlW-JX9FeW1csVslhJm4qW51kzSKg&updateMask.fieldPaths=status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { status: { stringValue: 'declined' } } })
    });
    return;
  }

  // Accetta → apri app
  const url = `https://lagattix.github.io/chill-chat/?acceptCall=${callId}&from=${fromId}&fromName=${encodeURIComponent(fromName || '')}&type=${callType || 'audio'}`;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const existing = clientList.find(c => c.url.includes('lagattix.github.io'));
      if (existing) {
        existing.focus();
        existing.postMessage({ type: 'ACCEPT_CALL', callId, fromId, fromName, callType });
        return;
      }
      return clients.openWindow(url);
    })
  );
});
