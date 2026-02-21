/**
 * BhekOS Storage Utility - Complete data persistence with encryption and compression
 */
const BhekStorage = {
    // Storage prefix to avoid conflicts
    PREFIX: 'bhekos_',
    
    // Default TTL in milliseconds (30 days)
    DEFAULT_TTL: 30 * 24 * 60 * 60 * 1000,
    
    // Memory cache for faster access
    cache: new Map(),
    
    // Encryption key (in production, this should be user-specific)
    encryptionKey: null,
    
    // IndexedDB database for large storage
    db: null,
    
    // ==================== INITIALIZATION ====================
    
    /**
     * Initialize storage system
     * @param {Object} options - Configuration options
     */
    async init(options = {}) {
        this.encryptionKey = options.encryptionKey || null;
        
        // Initialize IndexedDB
        await this.initDB();
        
        // Load cache from localStorage
        this.loadCache();
        
        console.log('Storage system initialized');
        return this;
    },
    
    /**
     * Initialize IndexedDB for large storage
     */
    initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('BhekOS_Storage', 2);
            
            request.onerror = () => reject(request.error);
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Large data store
                if (!db.objectStoreNames.contains('largeData')) {
                    const store = db.createObjectStore('largeData', { keyPath: 'key' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('ttl', 'ttl', { unique: false });
                }
                
                // Binary data store
                if (!db.objectStoreNames.contains('binaryData')) {
                    db.createObjectStore('binaryData', { keyPath: 'key' });
                }
                
                // Sync queue for offline
                if (!db.objectStoreNames.contains('syncQueue')) {
                    db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    },
    
    /**
     * Load all items into cache
     */
    loadCache() {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith(this.PREFIX)) {
                    try {
                        const value = localStorage.getItem(key);
                        this.cache.set(key, JSON.parse(value));
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load cache:', e);
        }
    },
    
    // ==================== CORE METHODS ====================
    
    /**
     * Save data to storage
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @param {Object} options - Options (ttl, encrypt, compress, large)
     * @returns {Promise<boolean>} Success
     */
    async set(key, value, options = {}) {
        try {
            const prefixedKey = this.PREFIX + key;
            
            // Check if data is large ( > 100KB )
            const isLarge = options.large || (typeof value === 'string' && value.length > 100000);
            
            if (isLarge) {
                return await this.setLarge(prefixedKey, value, options);
            }
            
            // Prepare data wrapper
            const wrapper = {
                value: value,
                timestamp: Date.now(),
                ttl: options.ttl || this.DEFAULT_TTL,
                encrypted: options.encrypt || false,
                compressed: options.compress || false
            };
            
            // Process value
            let processedValue = value;
            
            // Compress if requested
            if (options.compress && typeof value === 'string') {
                processedValue = await this.compress(value);
                wrapper.compressed = true;
            }
            
            // Encrypt if requested
            if (options.encrypt && this.encryptionKey) {
                processedValue = await this.encrypt(JSON.stringify(processedValue));
                wrapper.encrypted = true;
            }
            
            wrapper.value = processedValue;
            
            // Save to localStorage
            const data = JSON.stringify(wrapper);
            localStorage.setItem(prefixedKey, data);
            
            // Update cache
            this.cache.set(prefixedKey, wrapper);
            
            return true;
        } catch (e) {
            console.error('Storage save failed:', e);
            return false;
        }
    },
    
    /**
     * Store large data in IndexedDB
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @param {Object} options - Options
     * @returns {Promise<boolean>} Success
     */
    setLarge(key, value, options = {}) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['largeData'], 'readwrite');
            const store = tx.objectStore('largeData');
            
            const wrapper = {
                key,
                value,
                timestamp: Date.now(),
                ttl: options.ttl || this.DEFAULT_TTL,
                type: typeof value,
                metadata: options.metadata || {}
            };
            
            const request = store.put(wrapper);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },
    
    /**
     * Get data from storage
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if not found
     * @param {Object} options - Options (ignoreTTL, fromLarge)
     * @returns {Promise<*>} Stored value or default
     */
    async get(key, defaultValue = null, options = {}) {
        try {
            const prefixedKey = this.PREFIX + key;
            
            // Try large storage first if specified
            if (options.fromLarge) {
                const largeValue = await this.getLarge(prefixedKey);
                if (largeValue !== null) return largeValue;
            }
            
            // Check cache first
            let wrapper = this.cache.get(prefixedKey);
            
            // If not in cache, load from localStorage
            if (!wrapper) {
                const data = localStorage.getItem(prefixedKey);
                if (!data) {
                    // Try large storage as fallback
                    const largeValue = await this.getLarge(prefixedKey);
                    return largeValue !== null ? largeValue : defaultValue;
                }
                wrapper = JSON.parse(data);
                this.cache.set(prefixedKey, wrapper);
            }
            
            // Check TTL
            if (!options.ignoreTTL && wrapper.ttl) {
                const age = Date.now() - wrapper.timestamp;
                if (age > wrapper.ttl) {
                    await this.remove(key);
                    return defaultValue;
                }
            }
            
            // Process value
            let value = wrapper.value;
            
            // Decrypt if needed
            if (wrapper.encrypted && this.encryptionKey) {
                value = JSON.parse(await this.decrypt(value));
            }
            
            // Decompress if needed
            if (wrapper.compressed && typeof value === 'string') {
                value = await this.decompress(value);
            }
            
            return value;
        } catch (e) {
            console.error('Storage load failed:', e);
            return defaultValue;
        }
    },
    
    /**
     * Get large data from IndexedDB
     * @param {string} key - Storage key
     * @returns {Promise<*>} Stored value
     */
    getLarge(key) {
        return new Promise((resolve) => {
            const tx = this.db.transaction(['largeData'], 'readonly');
            const store = tx.objectStore('largeData');
            const request = store.get(key);
            
            request.onsuccess = () => {
                const wrapper = request.result;
                if (!wrapper) {
                    resolve(null);
                    return;
                }
                
                // Check TTL
                const age = Date.now() - wrapper.timestamp;
                if (age > wrapper.ttl) {
                    this.removeLarge(key);
                    resolve(null);
                    return;
                }
                
                resolve(wrapper.value);
            };
            
            request.onerror = () => resolve(null);
        });
    },
    
    /**
     * Get multiple keys at once
     * @param {Array} keys - Keys to get
     * @returns {Promise<Object>} Object with key-value pairs
     */
    async getMany(keys) {
        const result = {};
        for (const key of keys) {
            result[key] = await this.get(key);
        }
        return result;
    },
    
    /**
     * Set multiple keys at once
     * @param {Object} items - Object with key-value pairs
     * @returns {Promise<boolean>} Success
     */
    async setMany(items) {
        try {
            for (const [key, value] of Object.entries(items)) {
                await this.set(key, value);
            }
            return true;
        } catch (e) {
            console.error('Batch save failed:', e);
            return false;
        }
    },
    
    /**
     * Remove data from storage
     * @param {string} key - Storage key
     * @returns {Promise<boolean>} Success
     */
    async remove(key) {
        const prefixedKey = this.PREFIX + key;
        localStorage.removeItem(prefixedKey);
        this.cache.delete(prefixedKey);
        await this.removeLarge(prefixedKey);
        return true;
    },
    
    /**
     * Remove large data from IndexedDB
     * @param {string} key - Storage key
     * @returns {Promise<boolean>} Success
     */
    removeLarge(key) {
        return new Promise((resolve) => {
            const tx = this.db.transaction(['largeData'], 'readwrite');
            const store = tx.objectStore('largeData');
            const request = store.delete(key);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
        });
    },
    
    /**
     * Remove multiple keys
     * @param {Array} keys - Keys to remove
     * @returns {Promise<boolean>} Success
     */
    async removeMany(keys) {
        for (const key of keys) {
            await this.remove(key);
        }
        return true;
    },
    
    /**
     * Clear all BhekOS data
     * @returns {Promise<boolean>} Success
     */
    async clear() {
        const keysToRemove = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.PREFIX)) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            this.cache.delete(key);
        });
        
        // Clear IndexedDB
        await this.clearLarge();
        
        return true;
    },
    
    /**
     * Clear all large data
     */
    clearLarge() {
        return new Promise((resolve) => {
            const tx = this.db.transaction(['largeData'], 'readwrite');
            const store = tx.objectStore('largeData');
            const request = store.clear();
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
        });
    },
    
    /**
     * Clear all data (including other apps)
     */
    async clearAll() {
        localStorage.clear();
        this.cache.clear();
        await this.clearLarge();
    },
    
    // ==================== ADVANCED METHODS ====================
    
    /**
     * Check if key exists
     * @param {string} key - Storage key
     * @returns {Promise<boolean>} True if exists
     */
    async has(key) {
        const prefixedKey = this.PREFIX + key;
        
        if (localStorage.getItem(prefixedKey) !== null) return true;
        
        // Check large storage
        const largeValue = await this.getLarge(prefixedKey);
        return largeValue !== null;
    },
    
    /**
     * Get all keys
     * @returns {Array} Array of keys
     */
    keys() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.PREFIX)) {
                keys.push(key.slice(this.PREFIX.length));
            }
        }
        return keys;
    },
    
    /**
     * Get storage size
     * @returns {Promise<number>} Size in bytes
     */
    async size() {
        let total = 0;
        
        // LocalStorage size
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.PREFIX)) {
                const value = localStorage.getItem(key);
                total += (key.length + value.length) * 2;
            }
        }
        
        // IndexedDB size (approximate)
        const largeItems = await this.getAllLarge();
        total += largeItems.reduce((sum, item) => sum + (item.value?.length || 0), 0);
        
        return total;
    },
    
    /**
     * Get all large items
     */
    getAllLarge() {
        return new Promise((resolve) => {
            const tx = this.db.transaction(['largeData'], 'readonly');
            const store = tx.objectStore('largeData');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
        });
    },
    
    /**
     * Get storage info
     * @returns {Promise<Object>} Storage information
     */
    async info() {
        const keys = this.keys();
        const items = {};
        
        for (const key of keys) {
            items[key] = {
                size: await this.getSize(key),
                exists: true
            };
        }
        
        const totalSize = await this.size();
        
        return {
            totalItems: keys.length,
            totalSize,
            formattedSize: BhekHelpers.formatBytes(totalSize),
            items,
            quota: 5 * 1024 * 1024, // Approximate 5MB limit
            percentUsed: (totalSize / (5 * 1024 * 1024)) * 100
        };
    },
    
    /**
     * Get size of specific key
     * @param {string} key - Storage key
     * @returns {Promise<number>} Size in bytes
     */
    async getSize(key) {
        const prefixedKey = this.PREFIX + key;
        const value = localStorage.getItem(prefixedKey);
        if (value) {
            return (prefixedKey.length + value.length) * 2;
        }
        
        const largeValue = await this.getLarge(prefixedKey);
        if (largeValue) {
            return typeof largeValue === 'string' ? largeValue.length * 2 : 1000; // Approx
        }
        
        return 0;
    },
    
    // ==================== SPECIFIC STORAGE METHODS ====================
    
    /**
     * Save user preferences
     * @param {Object} prefs - User preferences
     * @returns {Promise<boolean>} Success
     */
    savePrefs(prefs) {
        return this.set('prefs', prefs, { ttl: null }); // No TTL for preferences
    },
    
    /**
     * Load user preferences
     * @returns {Promise<Object>} User preferences
     */
    async loadPrefs() {
        return this.get('prefs', {
            theme: 'dark',
            wallpaper: 'default',
            accentColor: '#0078d4',
            startButtonStyle: 'modern',
            animations: true,
            transparency: true,
            autoSave: true,
            language: 'en'
        });
    },
    
    /**
     * Save app settings
     * @param {string} appId - App ID
     * @param {Object} settings - App settings
     * @returns {Promise<boolean>} Success
     */
    saveAppSettings(appId, settings) {
        return this.set(`app_${appId}`, settings);
    },
    
    /**
     * Load app settings
     * @param {string} appId - App ID
     * @returns {Promise<Object>} App settings
     */
    loadAppSettings(appId) {
        return this.get(`app_${appId}`, {});
    },
    
    /**
     * Save window positions
     * @param {Object} positions - Window positions
     * @returns {Promise<boolean>} Success
     */
    saveWindowPositions(positions) {
        return this.set('windows', positions);
    },
    
    /**
     * Load window positions
     * @returns {Promise<Object>} Window positions
     */
    loadWindowPositions() {
        return this.get('windows', {});
    },
    
    /**
     * Save session data
     * @param {Object} session - Session data
     * @returns {Promise<boolean>} Success
     */
    saveSession(session) {
        return this.set('session', session, { ttl: 24 * 60 * 60 * 1000, encrypt: true }); // 24 hours
    },
    
    /**
     * Load session data
     * @returns {Promise<Object>} Session data
     */
    loadSession() {
        return this.get('session', {}, { ignoreTTL: true });
    },
    
    // ==================== SECURITY METHODS ====================
    
    /**
     * Set encryption key
     * @param {string} key - Encryption key
     */
    setEncryptionKey(key) {
        this.encryptionKey = key;
    },
    
    /**
     * Encrypt data using Web Crypto API
     * @param {string} text - Text to encrypt
     * @returns {Promise<string>} Encrypted text
     */
    async encrypt(text) {
        if (!this.encryptionKey || !window.crypto.subtle) {
            return text; // Fallback to plain text
        }
        
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(text);
            
            // Generate IV
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            // Import key
            const key = await crypto.subtle.importKey(
                'raw',
                encoder.encode(this.encryptionKey.padEnd(32, '0').slice(0, 32)),
                { name: 'AES-GCM' },
                false,
                ['encrypt']
            );
            
            // Encrypt
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                key,
                data
            );
            
            // Combine IV and encrypted data
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);
            
            return btoa(String.fromCharCode(...combined));
        } catch (error) {
            console.error('Encryption failed:', error);
            return text;
        }
    },
    
    /**
     * Decrypt data using Web Crypto API
     * @param {string} encryptedText - Encrypted text
     * @returns {Promise<string>} Decrypted text
     */
    async decrypt(encryptedText) {
        if (!this.encryptionKey || !window.crypto.subtle) {
            return encryptedText; // Fallback
        }
        
        try {
            // Decode base64
            const combined = new Uint8Array(
                atob(encryptedText).split('').map(c => c.charCodeAt(0))
            );
            
            // Extract IV and data
            const iv = combined.slice(0, 12);
            const data = combined.slice(12);
            
            const encoder = new TextEncoder();
            
            // Import key
            const key = await crypto.subtle.importKey(
                'raw',
                encoder.encode(this.encryptionKey.padEnd(32, '0').slice(0, 32)),
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );
            
            // Decrypt
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                data
            );
            
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            console.error('Decryption failed:', error);
            return encryptedText;
        }
    },
    
    // ==================== COMPRESSION ====================
    
    /**
     * Compress string using LZ-string algorithm (simplified)
     * @param {string} text - Text to compress
     * @returns {Promise<string>} Compressed text
     */
    async compress(text) {
        // Simple run-length encoding for demo
        let result = '';
        let count = 1;
        
        for (let i = 0; i < text.length; i++) {
            if (text[i] === text[i + 1]) {
                count++;
            } else {
                result += (count > 3 ? count : text[i].repeat(count));
                count = 1;
            }
        }
        
        return result;
    },
    
    /**
     * Decompress string
     * @param {string} compressed - Compressed text
     * @returns {Promise<string>} Decompressed text
     */
    async decompress(compressed) {
        // Simple run-length decoding for demo
        let result = '';
        let i = 0;
        
        while (i < compressed.length) {
            const char = compressed[i];
            if (char >= '0' && char <= '9') {
                let numStr = '';
                while (i < compressed.length && compressed[i] >= '0' && compressed[i] <= '9') {
                    numStr += compressed[i];
                    i++;
                }
                const num = parseInt(numStr);
                const repeatChar = compressed[i];
                result += repeatChar.repeat(num);
                i++;
            } else {
                result += char;
                i++;
            }
        }
        
        return result;
    },
    
    // ==================== SYNC QUEUE ====================
    
    /**
     * Add item to sync queue for offline
     * @param {Object} item - Item to sync
     * @returns {Promise<number>} Queue ID
     */
    addToSyncQueue(item) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['syncQueue'], 'readwrite');
            const store = tx.objectStore('syncQueue');
            
            const queueItem = {
                ...item,
                timestamp: Date.now(),
                retries: 0
            };
            
            const request = store.add(queueItem);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    
    /**
     * Get all pending sync items
     * @returns {Promise<Array>} Sync queue
     */
    getSyncQueue() {
        return new Promise((resolve) => {
            const tx = this.db.transaction(['syncQueue'], 'readonly');
            const store = tx.objectStore('syncQueue');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
        });
    },
    
    /**
     * Remove item from sync queue
     * @param {number} id - Queue ID
     */
    removeFromSyncQueue(id) {
        return new Promise((resolve) => {
            const tx = this.db.transaction(['syncQueue'], 'readwrite');
            const store = tx.objectStore('syncQueue');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
        });
    },
    
    // ==================== UTILITY METHODS ====================
    
    /**
     * Export all data
     * @returns {Promise<Object>} All stored data
     */
    async export() {
        const data = {};
        const keys = this.keys();
        
        for (const key of keys) {
            data[key] = await this.get(key, null, { ignoreTTL: true });
        }
        
        // Add large data
        const largeItems = await this.getAllLarge();
        largeItems.forEach(item => {
            data[item.key.slice(this.PREFIX.length)] = item.value;
        });
        
        return data;
    },
    
    /**
     * Import data
     * @param {Object} data - Data to import
     * @param {boolean} merge - Merge with existing data
     * @returns {Promise<boolean>} Success
     */
    async import(data, merge = false) {
        try {
            if (!merge) {
                await this.clear();
            }
            
            for (const [key, value] of Object.entries(data)) {
                if (typeof value === 'string' && value.length > 100000) {
                    await this.set(key, value, { large: true });
                } else {
                    await this.set(key, value, { ttl: null });
                }
            }
            
            return true;
        } catch (e) {
            console.error('Import failed:', e);
            return false;
        }
    },
    
    /**
     * Backup to file
     * @param {string} filename - Backup filename
     */
    async backup(filename = `bhekos-backup-${new Date().toISOString().slice(0,10)}.json`) {
        const data = await this.export();
        const json = JSON.stringify(data, null, 2);
        
        BhekHelpers.downloadFile(filename, json, 'application/json');
    },
    
    /**
     * Restore from backup file
     * @param {File} file - Backup file
     * @returns {Promise<boolean>} Success
     */
    async restore(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    await this.import(data, false);
                    resolve(true);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }
};

window.BhekStorage = BhekStorage;
