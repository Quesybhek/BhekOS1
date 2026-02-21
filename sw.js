const CACHE_NAME = 'bhekos-v3';
const ASSETS = [
    '/',
    '/index.html',
    '/offline.html',
    '/manifest.json',
    
    // CSS
    '/css/main.css',
    '/css/animations.css',
    '/css/components/windows.css',
    '/css/components/taskbar.css',
    '/css/components/startmenu.css',
    '/css/components/desktop-switcher.css',
    '/css/components/shortcuts.css',
    '/css/components/collaboration.css',
    '/css/themes/dark.css',
    '/css/themes/light.css',
    
    // Utils
    '/js/utils/helpers.js',
    '/js/utils/storage.js',
    '/js/utils/event-bus.js',
    '/js/utils/logger.js',
    '/js/utils/crypto.js',
    '/js/utils/network.js',
    '/js/utils/worker.js',
    
    // Core Phase 1
    '/js/core/file-system.js',
    '/js/core/settings-manager.js',
    '/js/core/theme-manager.js',
    '/js/core/security.js',
    '/js/core/app-store.js',
    '/js/core/window-manager.js',
    
    // Core Phase 2
    '/js/core/display-manager.js',
    '/js/core/system-monitor.js',
    '/js/core/file-search.js',
    '/js/core/shortcuts.js',
    
    // Core Phase 3
    '/js/core/user-manager.js',
    '/js/core/cloud-sync.js',
    '/js/core/collaboration.js',
    '/js/core/chat-system.js',
    '/js/core/backup-manager.js',
    
    // Components Phase 1
    '/js/components/taskbar.js',
    '/js/components/start-menu.js',
    '/js/components/desktop-icons.js',
    '/js/components/notification.js',
    '/js/components/lock-screen.js',
    '/js/components/login-screen.js',
    '/js/components/password-prompt.js',
    
    // Components Phase 2
    '/js/components/search-overlay.js',
    
    // Components Phase 3
    '/js/components/user-switcher.js',
    '/js/components/activity-feed.js',
    '/js/components/file-share-dialog.js',
    
    // Apps Phase 1
    '/js/apps/file-explorer/index.js',
    '/js/apps/settings/index.js',
    '/js/apps/app-store/index.js',
    
    // Apps Phase 2
    '/js/apps/task-manager/index.js',
    
    // Apps Phase 3
    '/js/apps/users/index.js',
    '/js/apps/chat/index.js',
    '/js/apps/backup/index.js',
    '/js/apps/remote-desktop/index.js',
    
    // Boot
    '/js/core/boot.js',
    
    // Icons
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/shortcut-files.png',
    '/icons/shortcut-settings.png',
    '/icons/shortcut-chat.png',
    '/icons/shortcut-users.png',
    '/icons/default-avatar.png'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching assets');
                return cache.addAll(ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    // Handle API requests
    if (event.request.url.includes('/api/')) {
        event.respondWith(handleAPIRequest(event.request));
        return;
    }
    
    // Handle WebSocket connections
    if (event.request.url.includes('/ws/')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                
                return fetch(event.request).then((networkResponse) => {
                    // Don't cache non-successful responses
                    if (!networkResponse || networkResponse.status !== 200) {
                        return networkResponse;
                    }
                    
                    // Cache the new asset
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                    
                    return networkResponse;
                });
            })
            .catch(() => {
                // Return offline page for HTML requests
                if (event.request.headers.get('accept').includes('text/html')) {
                    return caches.match('/offline.html');
                }
            })
    );
});

// Handle API requests with offline queue
async function handleAPIRequest(request) {
    try {
        const response = await fetch(request.clone());
        return response;
    } catch (error) {
        // Store in offline queue for later sync
        const clone = request.clone();
        const db = await openOfflineDB();
        
        await db.add('offlineQueue', {
            id: Date.now() + Math.random(),
            url: clone.url,
            method: clone.method,
            headers: Array.from(clone.headers.entries()),
            body: await clone.text(),
            timestamp: Date.now()
        });
        
        return new Response(
            JSON.stringify({ queued: true, message: 'Request queued for offline sync' }),
            { status: 202, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

// Open IndexedDB for offline queue
function openOfflineDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('OfflineQueue', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('offlineQueue')) {
                db.createObjectStore('offlineQueue', { keyPath: 'id' });
            }
        };
    });
}

// Background sync for offline data
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncOfflineData());
    }
});

async function syncOfflineData() {
    const db = await openOfflineDB();
    const tx = db.transaction('offlineQueue', 'readwrite');
    const store = tx.objectStore('offlineQueue');
    const requests = await store.getAll();
    
    for (const req of requests) {
        try {
            const response = await fetch(req.url, {
                method: req.method,
                headers: new Headers(req.headers),
                body: req.body
            });
            
            if (response.ok) {
                await store.delete(req.id);
            }
        } catch (error) {
            console.error('Sync failed:', error);
        }
    }
}

// Push notifications
self.addEventListener('push', (event) => {
    const data = event.data.json();
    
    const options = {
        body: data.body,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        vibrate: [200, 100, 200],
        data: data.data,
        actions: data.actions || []
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action) {
        // Handle action buttons
        clients.openWindow(`/?action=${event.action}`);
    } else {
        // Open main window
        clients.openWindow('/');
    }
});
