/**
 * Backup Worker - Handles backup and restore operations
 */

let db = null;

// Initialize IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('BackupWorkerDB', 1);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve();
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('backups')) {
                const backupStore = db.createObjectStore('backups', { keyPath: 'id', autoIncrement: true });
                backupStore.createIndex('timestamp', 'timestamp', { unique: false });
                backupStore.createIndex('name', 'name', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('schedules')) {
                db.createObjectStore('schedules', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// Create backup
async function createBackup(options = {}) {
    const {
        name = `backup-${new Date().toISOString()}`,
        includeApps = true,
        includeSettings = true,
        includeFiles = true,
        compress = true
    } = options;
    
    // Collect data from all sources
    const backup = {
        name,
        timestamp: Date.now(),
        version: '1.0',
        data: {}
    };
    
    // Progress reporting
    let progress = 0;
    const totalSteps = 3;
    
    // Backup localStorage
    if (includeSettings) {
        backup.data.localStorage = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            backup.data.localStorage[key] = localStorage.getItem(key);
        }
        progress += 100 / totalSteps;
        self.postMessage({ type: 'progress', progress });
    }
    
    // Backup app data from IndexedDB
    if (includeApps) {
        backup.data.apps = await backupApps();
        progress += 100 / totalSteps;
        self.postMessage({ type: 'progress', progress });
    }
    
    // Backup file system
    if (includeFiles) {
        backup.data.files = await backupFileSystem();
        progress += 100 / totalSteps;
        self.postMessage({ type: 'progress', progress });
    }
    
    // Compress if needed
    if (compress) {
        backup.compressed = true;
        backup.data = await compressData(backup.data);
    }
    
    // Save backup record
    const backupId = await saveBackupRecord(backup);
    
    return {
        id: backupId,
        name: backup.name,
        timestamp: backup.timestamp,
        size: JSON.stringify(backup).length
    };
}

// Backup apps from IndexedDB
async function backupApps() {
    const dbs = await indexedDB.databases?.() || [];
    const appData = {};
    
    for (const dbInfo of dbs) {
        if (dbInfo.name.startsWith('BhekOS_')) {
            appData[dbInfo.name] = await exportDatabase(dbInfo.name);
        }
    }
    
    return appData;
}

// Backup file system
async function backupFileSystem() {
    // This would access the main file system
    // For now, return placeholder
    return { note: 'File system backup not implemented in worker' };
}

// Export entire IndexedDB
function exportDatabase(dbName) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName);
        
        request.onsuccess = (event) => {
            const db = event.target.result;
            const exportData = {};
            const tx = db.transaction(db.objectStoreNames, 'readonly');
            
            let completed = 0;
            const total = db.objectStoreNames.length;
            
            for (const storeName of db.objectStoreNames) {
                const store = tx.objectStore(storeName);
                const getAllRequest = store.getAll();
                
                getAllRequest.onsuccess = () => {
                    exportData[storeName] = getAllRequest.result;
                    completed++;
                    
                    if (completed === total) {
                        resolve(exportData);
                    }
                };
                
                getAllRequest.onerror = () => {
                    exportData[storeName] = [];
                    completed++;
                    
                    if (completed === total) {
                        resolve(exportData);
                    }
                };
            }
        };
        
        request.onerror = () => reject(request.error);
    });
}

// Compress data
async function compressData(data) {
    const json = JSON.stringify(data);
    // Simple compression simulation
    return btoa(json);
}

// Decompress data
async function decompressData(compressed) {
    const json = atob(compressed);
    return JSON.parse(json);
}

// Save backup record
function saveBackupRecord(backup) {
    return new Promise((resolve) => {
        const tx = db.transaction(['backups'], 'readwrite');
        const store = tx.objectStore('backups');
        
        const record = {
            name: backup.name,
            timestamp: backup.timestamp,
            size: JSON.stringify(backup).length,
            data: backup
        };
        
        const request = store.add(record);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}

// Get all backups
function getBackups() {
    return new Promise((resolve) => {
        const tx = db.transaction(['backups'], 'readonly');
        const store = tx.objectStore('backups');
        const request = store.getAll();
        
        request.onsuccess = () => {
            const backups = request.result.map(({ id, name, timestamp, size }) => ({
                id,
                name,
                timestamp,
                size
            }));
            resolve(backups);
        };
        
        request.onerror = () => resolve([]);
    });
}

// Restore backup
async function restoreBackup(backupId) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['backups'], 'readonly');
        const store = tx.objectStore('backups');
        const request = store.get(backupId);
        
        request.onsuccess = async (event) => {
            const backup = event.target.result?.data;
            
            if (!backup) {
                reject(new Error('Backup not found'));
                return;
            }
            
            try {
                // Decompress if needed
                let data = backup.data;
                if (backup.compressed) {
                    data = await decompressData(data);
                }
                
                // Restore localStorage
                if (data.localStorage) {
                    localStorage.clear();
                    for (const [key, value] of Object.entries(data.localStorage)) {
                        localStorage.setItem(key, value);
                    }
                }
                
                // Note: Restoring apps and files would require main thread interaction
                
                resolve({ success: true });
            } catch (error) {
                reject(error);
            }
        };
        
        request.onerror = () => reject(request.error);
    });
}

// Delete backup
function deleteBackup(backupId) {
    return new Promise((resolve) => {
        const tx = db.transaction(['backups'], 'readwrite');
        const store = tx.objectStore('backups');
        const request = store.delete(backupId);
        
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
    });
}

// Create backup schedule
function createSchedule(options) {
    return new Promise((resolve) => {
        const tx = db.transaction(['schedules'], 'readwrite');
        const store = tx.objectStore('schedules');
        
        const schedule = {
            ...options,
            createdAt: Date.now(),
            lastRun: null,
            nextRun: Date.now() + (options.interval || 86400000) // Default 1 day
        };
        
        const request = store.add(schedule);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}

// Check scheduled backups
async function checkSchedules() {
    const tx = db.transaction(['schedules'], 'readonly');
    const store = tx.objectStore('schedules');
    const request = store.getAll();
    
    request.onsuccess = () => {
        const now = Date.now();
        
        for (const schedule of request.result) {
            if (schedule.nextRun <= now) {
                // Run backup
                createBackup(schedule.options).then((backup) => {
                    // Update schedule
                    const updateTx = db.transaction(['schedules'], 'readwrite');
                    const updateStore = updateTx.objectStore('schedules');
                    
                    schedule.lastRun = now;
                    schedule.nextRun = now + (schedule.interval || 86400000);
                    
                    updateStore.put(schedule);
                    
                    self.postMessage({
                        type: 'log',
                        message: `Scheduled backup completed: ${backup.name}`
                    });
                });
            }
        }
    };
}

// Worker message handler
self.addEventListener('message', async (event) => {
    const { type, taskId, task, data } = event.data;
    
    switch (type) {
        case 'task':
            try {
                let result;
                
                switch (task) {
                    case 'backup':
                        result = await createBackup(data);
                        break;
                        
                    case 'getBackups':
                        result = await getBackups();
                        break;
                        
                    case 'restore':
                        result = await restoreBackup(data.backupId);
                        break;
                        
                    case 'delete':
                        result = await deleteBackup(data.backupId);
                        break;
                        
                    case 'createSchedule':
                        result = await createSchedule(data);
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
                case 'backup':
                    createBackup(data);
                    break;
                    
                case 'checkSchedules':
                    checkSchedules();
                    break;
            }
            break;
    }
});

// Initialize on load
initDB().then(() => {
    self.postMessage({ type: 'ready' });
    
    // Check schedules every minute
    setInterval(() => {
        checkSchedules();
    }, 60 * 1000);
});
