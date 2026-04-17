// BudgetCAD Pro Service Worker v5.0
const CACHE_NAME = 'budgetcad-pro-v5.0.0';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
  'https://cdn.jsdelivr.net/npm/crypto-js@4.2.0/crypto-js.min.js',
  'https://cdn.jsdelivr.net/npm/ml-regression@2.0.0/dist/ml-regression.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js',
  'https://cdn.jsdelivr.net/npm/idb@8.0.0/build/iife/index-min.js'
];

// Installation
self.addEventListener('install', (event) => {
  console.log('🛠️ BudgetCAD Pro SW: Installation');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Mise en cache des assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activation - Nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  console.log('✅ BudgetCAD Pro SW: Activé');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Stratégie de cache: Network First pour les données, Cache First pour les assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') return;
  
  // API Overpass (guichets ATM) - Network only
  if (url.hostname === 'overpass-api.de') {
    return;
  }
  
  // Assets statiques - Cache First
  if (ASSETS_TO_CACHE.some(asset => url.pathname.includes(asset.split('/').pop()))) {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then((response) => {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response.clone());
              return response;
            });
          });
        })
    );
    return;
  }
  
  // Données - Network First avec fallback cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Mettre en cache la réponse fraîche
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Offline - retourner la version cachée
        return caches.match(event.request);
      })
  );
});

// Gestion des messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    self.registration.update();
  }
  
  if (event.data && event.data.type === 'SYNC_DATA') {
    // Synchronisation des données en arrière-plan
    syncDataInBackground();
  }
});

// Synchronisation périodique (si supportée)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'budgetcad-sync') {
    event.waitUntil(syncDataInBackground());
  }
});

// Synchronisation en arrière-plan
async function syncDataInBackground() {
  console.log('🔄 Synchronisation en arrière-plan');
  
  // Notifier tous les clients
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      timestamp: Date.now()
    });
  });
}

// Notification push
self.addEventListener('push', (event) => {
  let data = {
    title: 'BudgetCAD Pro',
    body: 'Nouvelle alerte budgétaire',
    icon: '/icon-192.png',
    badge: '/badge-96.png'
  };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      vibrate: [200, 100, 200],
      tag: 'budgetcad-notification',
      renotify: true,
      actions: [
        { action: 'open', title: 'Ouvrir' },
        { action: 'dismiss', title: 'Ignorer' }
      ],
      data: {
        url: data.url || '/'
      }
    })
  );
});

// Clic sur notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      const url = event.notification.data.url || '/';
      
      // Chercher un client existant
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Ouvrir nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

console.log('🚀 BudgetCAD Pro Service Worker v5.0.0 chargé');