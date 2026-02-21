/**
 * Sync Worker - Handles background synchronization
 */

// Store DB connection
let db = null;

// Initialize IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('SyncWorkerDB', 1);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve();
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('syncQueue')) {
                db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
            }
            
            if (!db.objectStoreNames.contains('syncHistory')) {
                const historyStore = db.createObjectStore('syncHistory', { keyPath: 'id', autoIncrement: true });
                historyStore.createIndex('timestamp', 'timestamp', { unique: false });
                historyStore.createIndex('status', 'status', { unique: false });
            }
        };
    });
}

// Get sync queue
function getSyncQueue() {
    return new Promise((resolve) => {
        const tx = db.transaction(['syncQueue'], 'readonly');
        const store = tx.objectStore('syncQueue');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
    });
}

// Add to sync queue
function addToSyncQueue(item) {
    return new Promise((resolve) => {
        const tx = db.transaction(['syncQueue'], 'readwrite');
        const store = tx.objectStore('syncQueue');
        
        const queueItem = {
            ...item,
            timestamp: Date.now(),
            attempts: 0
        };
        
        const request = store.add(queueItem);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}

// Remove from sync queue
function removeFromSyncQueue(id) {
    return new Promise((resolve) => {
        const tx = db.transaction(['syncQueue'], 'readwrite');
        const store = tx.objectStore('syncQueue');
        const request = store.delete(id);
        
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
    });
}

// Add to sync history
function addToSyncHistory(item) {
    return new Promise((resolve) => {
        const tx = db.transaction(['syncHistory'], 'readwrite');
        const store = tx.objectStore('syncHistory');
        
        const historyItem = {
            ...item,
            timestamp: Date.now()
        };
        
        const request = store.add(historyItem);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}

// Perform sync operation
async function performSync(item) {
    try {
        const response = await fetch(item.url, {
            method: item.method || 'POST',
            headers: item.headers || { 'Content-Type': 'application/json' },
            body: item.data ? JSON.stringify(item.data) : undefined
        });
        
        if (!response.ok) {
            throw new Error(`Sync failed: ${response.status}`);
        }
        
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Process sync queue
async function processSyncQueue() {
    const queue = await getSyncQueue();
    
    for (const item of queue) {
        // Check max attempts
        if (item.attempts >= 5) {
            await addToSyncHistory({
                type: 'sync',
                status: 'failed',
                error: 'Max attempts exceeded',
                item
            });
            await removeFromSyncQueue(item.id);
            continue;
        }
        
        // Perform sync
        const result = await performSync(item);
        
        if (result.success) {
            await addToSyncHistory({
                type: 'sync',
                status: 'success',
                item
            });
            await removeFromSyncQueue(item.id);
        } else {
            // Update attempt count
            const tx = db.transaction(['syncQueue'], 'readwrite');
            const store = tx.objectStore('syncQueue');
            item.attempts++;
            store.put(item);
            
            // Log failure
            await addToSyncHistory({
                type: 'sync',
                status: 'failed',
                error: result.error,
                item
            });
        }
    }
}

// Worker message handler
self.addEventListener('message', async (event) => {
    const { type, taskId, task, data } = event.data;
    
    switch (type) {
        case 'task':
            try {
                let result;
                
                switch (task) {
                    case 'sync':
                        result = await processSyncQueue();
                        break;
                        
                    case 'addToQueue':
                        result = await addToSyncQueue(data);
                        break;
                        
                    case 'getQueue':
                        result = await getSyncQueue();
                        break;
                        
                    case 'clearQueue':
                        result = await clearSyncQueue();
                        break;
                        
                    default:
                        throw new Error(`Unknown task: ${task}`);
                }
                
                self.postMessage({
                    type: 'task',
                    taskId,
                    result
                });
            } catch (error) {
                self.postMessage({
                    type: 'task',
                    taskId,
                    error: error.message
                });
            }
            break;
            
        case 'background':
            switch (task) {
                case 'sync':
                    processSyncQueue();
                    break;
                    
                case 'addToQueue':
                    addToSyncQueue(data);
                    break;
            }
            break;
    }
});

// Initialize on load
initDB().then(() => {
    self.postMessage({ type: 'ready' });
    
    // Periodic sync every 5 minutes
    setInterval(() => {
        processSyncQueue();
    }, 5 * 60 * 1000);
});
