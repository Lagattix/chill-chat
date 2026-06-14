// Conversando PWA service worker.
// Handles app install/offline cache and Firebase background notifications.

importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

const APP_VERSION = '2026-06-14-pwa-1';
const STATIC_CACHE = `conversando-static-${APP_VERSION}`;
const RUNTIME_CACHE = `conversando-runtime-${APP_VERSION}`;
const APP_SCOPE = '/chill-chat/';
const APP_URL = self.registration.scope;

const APP_SHELL = [
  APP_SCOPE,
  `${APP_SCOPE}index.html`,
  `${APP_SCOPE}manifest.json`,
  `${APP_SCOPE}icons/icon-192.png`,
  `${APP_SCOPE}icons/icon-512.png`,
  `${APP_SCOPE}icons/apple-touch-icon.png`
];

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCp2SjlW-JX9FeW1csVslhJm4qW51kzSKg',
  authDomain: 'chill-chat-4945d.firebaseapp.com',
  projectId: 'chill-chat-4945d',
  storageBucket: 'chill-chat-4945d.firebasestorage.app',
  messagingSenderId: '803118071656',
  appId: '1:803118071656:web:90708d615b96cdfd31e0dd'
};

let messaging = null;
let currentUserId = null;
let pollingInterval = null;
let knownCalls = new Set();

try {
  firebase.initializeApp(FIREBASE_CONFIG);
  messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const { notification, data } = payload || {};
    const callData = data || {};

    return showCallNotification({
      callId: callData.callId,
      fromId: callData.fromId,
      fromName: callData.fromName || notification?.title || 'Chiamata in arrivo',
      callType: callData.callType || 'audio',
      title: notification?.title || 'Chiamata in arrivo',
      body: notification?.body || 'Chiamata in arrivo'
    });
  });
} catch (err) {
  console.warn('[SW] Firebase Messaging non disponibile:', err.message);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(name => name.startsWith('conversando-') && ![STATIC_CACHE, RUNTIME_CACHE].includes(name))
        .map(name => caches.delete(name))
    );

    await self.clients.claim();

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (!clients.length) {
      tryLoadUserIdAndStartPolling();
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_SCOPE)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, `${APP_SCOPE}index.html`));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

self.addEventListener('message', async (event) => {
  const { type, userId } = event.data || {};

  if (type === 'INIT') {
    currentUserId = userId;
    await saveUserId(userId);
    startCallPolling();
  }

  if (type === 'STOP') {
    stopCallPolling();
  }

  if (type === 'LOGOUT') {
    currentUserId = null;
    stopCallPolling();
    await deleteUserId();
  }
});

self.addEventListener('notificationclick', (event) => {
  const { action, notification } = event;
  const { callId, fromId, fromName, callType } = notification.data || {};

  notification.close();

  if (action === 'decline') {
    event.waitUntil(declineCall(callId));
    return;
  }

  event.waitUntil(openCall(callId, fromId, fromName, callType));
});

async function networkFirst(request, fallbackPath) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    return cached || caches.match(fallbackPath);
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fresh = fetch(request)
    .then(async response => {
      if (response && response.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fresh;
}

async function tryLoadUserIdAndStartPolling() {
  try {
    const userId = await getUserId();
    if (userId) {
      currentUserId = userId;
      startCallPolling();
    }
  } catch (err) {
    console.warn('[SW] Impossibile caricare userId:', err.message);
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

async function getUserId() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const request = tx.objectStore('settings').get('userId');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveUserId(userId) {
  if (!userId) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put(userId, 'userId');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteUserId() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').delete('userId');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function startCallPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  if (!currentUserId) return;

  pollingInterval = setInterval(checkIncomingCalls, 3000);
  checkIncomingCalls();
}

function stopCallPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  knownCalls.clear();
}

async function checkIncomingCalls() {
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
      const fromId = fields.from?.stringValue;
      const createdAt = fields.createdAt?.timestampValue;

      if (toUser !== currentUserId || status !== 'ringing' || knownCalls.has(callId)) continue;
      if (createdAt && Date.now() - new Date(createdAt).getTime() > 30000) continue;

      knownCalls.add(callId);
      await showCallNotification({ callId, fromId, fromName, callType });
    }
  } catch (err) {
    // Offline or transient network errors are expected for an installed PWA.
  }
}

async function showCallNotification({ callId, fromId, fromName, callType, title, body }) {
  const isVideo = callType === 'video';

  return self.registration.showNotification(title || `${fromName} sta chiamando`, {
    body: body || (isVideo ? 'Videochiamata in arrivo' : 'Chiamata audio in arrivo'),
    icon: `${APP_SCOPE}icons/icon-192.png`,
    badge: `${APP_SCOPE}icons/icon-192.png`,
    tag: `call-${callId || Date.now()}`,
    requireInteraction: true,
    vibrate: [300, 200, 300, 200, 300, 200, 1000, 300, 200, 300],
    silent: false,
    renotify: true,
    data: { callId, fromId, fromName, callType, url: APP_URL },
    actions: [
      { action: 'accept', title: 'Accetta' },
      { action: 'decline', title: 'Rifiuta' }
    ]
  });
}

async function openCall(callId, fromId, fromName, callType) {
  const appUrl = `${APP_URL}?acceptCall=${callId || ''}&from=${fromId || ''}&fromName=${encodeURIComponent(fromName || '')}&type=${callType || 'audio'}`;
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const existing = clientList.find(client => client.url.startsWith(APP_URL));

  if (existing) {
    await existing.focus();
    existing.postMessage({ type: 'ACCEPT_CALL', callId, fromId, fromName, callType });
    return;
  }

  return self.clients.openWindow(appUrl);
}

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
  } catch (err) {
    console.error('[SW] Errore rifiuto chiamata:', err.message);
  }
}
