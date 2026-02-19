// Service Worker - Conversando
// Gestisce notifiche chiamate ANCHE con app chiusa

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCp2SjlW-JX9FeW1csVslhJm4qW51kzSKg",
  projectId: "chill-chat-4945d"
};

// Stato persistente
let currentUserId = null;
let pollingInterval = null;
let knownCalls = new Set();

self.addEventListener('install', (event) => {
  console.log('🔧 SW installato');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✅ SW attivato');
  event.waitUntil(
    self.clients.claim().then(() => {
      // Appena attivato, controlla se c'è un userId salvato e inizia polling
      return self.clients.matchAll().then(clients => {
        if (clients.length > 0) {
          console.log('📱 App aperta, aspetto messaggio INIT');
        } else {
          console.log('📱 App chiusa, provo a caricare userId da IndexedDB');
          tryLoadUserIdAndStartPolling();
        }
      });
    })
  );
});

// ─── Carica userId da IndexedDB se app è chiusa ───
async function tryLoadUserIdAndStartPolling() {
  try {
    // Usa IndexedDB per leggere l'ultimo userId
    const db = await openDB();
    const userId = await getUserIdFromDB(db);
    
    if (userId) {
      console.log('📱 userId caricato da storage:', userId);
      currentUserId = userId;
      startCallPolling();
    } else {
      console.log('⚠️ Nessun userId trovato, aspetto login');
    }
  } catch (err) {
    console.log('❌ Errore caricamento userId:', err);
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ConversandoDB', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    };
  });
}

function getUserIdFromDB(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const request = store.get('userId');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ─── Ricevi messaggio dall'app ───
self.addEventListener('message', async (event) => {
  const { type, config, userId } = event.data || {};

  if (type === 'INIT') {
    currentUserId = userId;
    console.log('📱 SW inizializzato per user:', userId);
    
    // Salva userId in IndexedDB per uso quando app è chiusa
    try {
      const db = await openDB();
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put(userId, 'userId');
      await new Promise(resolve => { tx.oncomplete = resolve; });
      console.log('💾 userId salvato in IndexedDB');
    } catch (err) {
      console.log('❌ Errore salvataggio userId:', err);
    }
    
    startCallPolling();
  }

  if (type === 'STOP') {
    stopCallPolling();
  }
  
  if (type === 'LOGOUT') {
    currentUserId = null;
    stopCallPolling();
    // Cancella userId da IndexedDB
    try {
      const db = await openDB();
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').delete('userId');
    } catch (err) {}
  }
});

// ─── Polling chiamate in arrivo ───
function startCallPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  if (!currentUserId) return;
  
  console.log('🔄 Avvio polling chiamate per:', currentUserId);
  
  pollingInterval = setInterval(async () => {
    if (!FIREBASE_CONFIG.apiKey || !currentUserId) return;
    
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/calls?key=${FIREBASE_CONFIG.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) return;
      
      const data = await response.json();
      const docs = data.documents || [];
      
      for (const doc of docs) {
        const fields = doc.fields || {};
        const callId = doc.name.split('/').pop();
        
        const toUser = fields.to?.stringValue;
        const status = fields.status?.stringValue;
        const fromName = fields.fromName?.stringValue || 'Sconosciuto';
        const callType = fields.type?.stringValue || 'audio';
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
        
        // Mostra notifica SEMPRE (anche se app chiusa)
        console.log('📞 Nuova chiamata rilevata da SW:', fromName);
        await showIncomingCallNotification(callId, fromName, callType, fromAvatar, fromId);
      }
    } catch (err) {
      // Silenzioso - normale se offline
    }
  }, 3000); // ogni 3 secondi
}

function stopCallPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  knownCalls.clear();
}

async function showIncomingCallNotification(callId, fromName, callType, fromAvatar, fromId) {
  const isVideo = callType === 'video';
  
  await self.registration.showNotification(
    `📞 ${fromName} sta chiamando`,
    {
      body: isVideo ? '📹 Videochiamata in arrivo' : '📞 Chiamata audio in arrivo',
      icon: '/chill-chat/icon-192.png',
      badge: '/chill-chat/icon-192.png',
      tag: `call-${callId}`,
      requireInteraction: true,
      vibrate: [300, 200, 300, 200, 300, 200, 1000, 300, 200, 300],
      silent: false,
      renotify: true,
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
    event.waitUntil(declineCall(callId));
    return;
  }

  // Accetta → apri app
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const appUrl = `${url}?acceptCall=${callId}&from=${fromId}&fromName=${encodeURIComponent(fromName)}&type=${callType}`;
      
      const existing = clients.find(c => c.url.includes('lagattix.github.io'));
      if (existing) {
        existing.focus();
        existing.postMessage({
          type: 'ACCEPT_CALL',
          callId, fromId, fromName, callType
        });
        return;
      }
      
      return self.clients.openWindow(appUrl);
    })
  );
});

async function declineCall(callId) {
  if (!FIREBASE_CONFIG.apiKey || !callId) return;
  
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/calls/${callId}?key=${FIREBASE_CONFIG.apiKey}&updateMask.fieldPaths=status`;
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: { status: { stringValue: 'declined' } }
      })
    });
    console.log('📵 Chiamata rifiutata dal SW');
  } catch (err) {
    console.error('Errore rifiuto:', err);
  }
}

self.addEventListener('notificationclose', (event) => {
  console.log('🔕 Notifica chiusa');
});
