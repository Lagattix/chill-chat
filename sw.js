// Service Worker - Conversando
// Gestisce notifiche push e chiamate in arrivo anche con app in background

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCp2SjlW-JX9FeW1csVslhJm4qW51kzSKg",
  projectId: "chill-chat-4945d"
};

self.addEventListener('install', (event) => {
  console.log('🔧 SW installato');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✅ SW attivato');
  event.waitUntil(self.clients.claim());
});

// ─── Ricevi messaggio dall'app (config Firebase + userId) ───
let firebaseConfig = null;
let currentUserId = null;
let pollingInterval = null;

self.addEventListener('message', (event) => {
  const { type, config, userId } = event.data || {};

  if (type === 'INIT') {
    firebaseConfig = config;
    currentUserId = userId;
    console.log('📱 SW inizializzato per user:', userId);
    startCallPolling();
  }

  if (type === 'STOP') {
    stopCallPolling();
  }
});

// ─── Polling chiamate in arrivo ───
let lastChecked = Date.now();
let knownCalls = new Set();

function startCallPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  
  pollingInterval = setInterval(async () => {
    if (!firebaseConfig || !currentUserId) return;
    
    try {
      // Chiama Firestore REST API (non richiede SDK)
      const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/calls?key=${firebaseConfig.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) return;
      
      const data = await response.json();
      const docs = data.documents || [];
      
      for (const doc of docs) {
        const fields = doc.fields || {};
        const callId = doc.name.split('/').pop();
        
        const toUser = fields.to?.stringValue;
        const status = fields.status?.stringValue;
        const fromName = fields.fromName?.stringValue;
        const callType = fields.type?.stringValue;
        const fromAvatar = fields.fromAvatar?.stringValue || '👤';
        const fromId = fields.from?.stringValue;
        const createdAt = fields.createdAt?.timestampValue;
        
        // Solo chiamate per noi, in ringing, non già viste
        if (toUser !== currentUserId) continue;
        if (status !== 'ringing') continue;
        if (knownCalls.has(callId)) continue;
        
        // Ignora chiamate più vecchie di 30 secondi
        if (createdAt) {
          const callTime = new Date(createdAt).getTime();
          if (Date.now() - callTime > 30000) continue;
        }
        
        knownCalls.add(callId);
        
        // Controlla se l'app è già aperta e in foreground
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const appOpen = clients.some(c => c.url.includes('lagattix.github.io') && c.visibilityState === 'visible');
        
        if (!appOpen) {
          // App in background/chiusa → mostra notifica nativa con suoneria
          await showIncomingCallNotification(callId, fromName, callType, fromAvatar, fromId);
        }
      }
    } catch (err) {
      // Silenzioso - normale se offline
    }
  }, 3000); // controlla ogni 3 secondi
}

function stopCallPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

async function showIncomingCallNotification(callId, fromName, callType, fromAvatar, fromId) {
  const isVideo = callType === 'video';
  
  await self.registration.showNotification(
    `📞 ${fromName} sta chiamando`,
    {
      body: isVideo ? '📹 Videochiamata in arrivo' : '📞 Chiamata audio in arrivo',
      icon: '/chill-chat/icon-192.png',
      badge: '/chill-chat/icon-192.png',
      tag: `call-${callId}`,          // evita notifiche duplicate
      requireInteraction: true,        // resta sullo schermo finché non si agisce
      vibrate: [200, 100, 200, 100, 400], // vibrazione
      silent: false,                   // suona con suoneria sistema
      renotify: false,
      data: {
        callId,
        fromId,
        fromName,
        callType,
        url: `https://lagattix.github.io/chill-chat/`
      },
      actions: [
        { action: 'accept', title: '✅ Accetta' },
        { action: 'decline', title: '❌ Rifiuta' }
      ]
    }
  );
  
  console.log('🔔 Notifica chiamata mostrata per:', fromName);
}

// ─── Click su notifica ───
self.addEventListener('notificationclick', (event) => {
  const { action, notification } = event;
  const { callId, fromId, fromName, callType, url } = notification.data || {};
  
  notification.close();

  if (action === 'decline') {
    // Rifiuta la chiamata via Firestore REST
    event.waitUntil(declineCall(callId));
    return;
  }

  // Accetta o click generico → apri app con parametri chiamata
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const appUrl = `${url}?acceptCall=${callId}&from=${fromId}&fromName=${encodeURIComponent(fromName)}&type=${callType}`;
      
      // Se app già aperta, mandagli un messaggio
      const existing = clients.find(c => c.url.includes('lagattix.github.io'));
      if (existing) {
        existing.focus();
        existing.postMessage({
          type: 'ACCEPT_CALL',
          callId,
          fromId,
          fromName,
          callType
        });
        return;
      }
      
      // Altrimenti apri l'app con i parametri
      return self.clients.openWindow(appUrl);
    })
  );
});

// Rifiuta chiamata via Firestore REST API
async function declineCall(callId) {
  if (!firebaseConfig || !callId) return;
  
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/calls/${callId}?key=${firebaseConfig.apiKey}&updateMask.fieldPaths=status`;
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: { status: { stringValue: 'declined' } }
      })
    });
    console.log('📵 Chiamata rifiutata dal SW');
  } catch (err) {
    console.error('Errore rifiuto chiamata:', err);
  }
}

// ─── Notifica click messaggi ───
self.addEventListener('notificationclose', (event) => {
  console.log('🔕 Notifica chiusa');
});
