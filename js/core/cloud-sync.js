/**
 * BhekOS Cloud Sync - Synchronize data across devices
 */
const CloudSync = {
    os: null,
    
    // Sync status
    status: 'disconnected', // disconnected, connecting, connected, syncing, error
    
    // Sync queue
    queue: [],
    
    // Sync conflicts
    conflicts: [],
    
    // Sync settings
    settings: {
        enabled: false,
        provider: 'internal',
        serverUrl: 'https://sync.bhekos.local',
        apiKey: null,
        syncInterval: 5 * 60 * 1000, // 5 minutes
        syncOnChange: true,
        syncOverMetered: false,
        autoResolveConflicts: false,
        conflictStrategy: 'ask', // 'ask', 'local', 'remote', 'newest'
        syncSettings: true,
        syncFiles: false,
        syncApps: false,
        maxSyncSize: 100 * 1024 * 1024, // 100MB
        encryptData: true
    },
    
    // Sync data
    data: {
        settings: null,
        files: new Map(),
        apps: new Map(),
        lastSync: null
    },
    
    // Sync history
    history: [],
    
    async init(os) {
        this.os = os;
        console.log('Cloud Sync initializing...');
        
        await this.loadSettings();
        this.setupListeners();
        
        if (this.settings.enabled) {
            this.connect();
        }
        
        console.log('Cloud Sync initialized');
        return this;
    },
    
    async loadSettings() {
        const saved = await this.os.modules.Storage.get('sync_settings', {});
        this.settings = { ...this.settings, ...saved };
    },
    
    async saveSettings() {
        await this.os.modules.Storage.set('sync_settings', this.settings);
    },
    
    setupListeners() {
        // Listen for changes that need syncing
        if (this.settings.syncOnChange) {
            this.os.modules.EventBus.on('settings:saved', () => {
                if (this.settings.syncSettings) {
                    this.queueSync('settings', this.os.modules.Settings?.getAll());
                }
            });
            
            this.os.modules.EventBus.on('file:changed', (data) => {
                if (this.settings.syncFiles && data.path) {
                    this.queueSync('file', data);
                }
            });
            
            this.os.modules.EventBus.on('app:installed', (data) => {
                if (this.settings.syncApps) {
                    this.queueSync('app', data);
                }
            });
        }
        
        // Online/offline handling
        window.addEventListener('online', () => {
            this.processQueue();
        });
    },
    
    // ==================== CONNECTION ====================
    
    async connect() {
        this.status = 'connecting';
        this.os.modules.EventBus.emit('sync:connecting');
        
        try {
            // Simulate connection
            await this.delay(1000);
            
            this.status = 'connected';
            this.os.modules.EventBus.emit('sync:connected');
            
            // Start periodic sync
            this.startPeriodicSync();
            
            // Process queue
            this.processQueue();
            
            return true;
        } catch (error) {
            this.status = 'error';
            this.os.modules.EventBus.emit('sync:error', error);
            return false;
        }
    },
    
    disconnect() {
        this.status = 'disconnected';
        this.stopPeriodicSync();
        this.os.modules.EventBus.emit('sync:disconnected');
    },
    
    startPeriodicSync() {
        this.stopPeriodicSync();
        this.syncInterval = setInterval(() => {
            if (this.status === 'connected') {
                this.sync();
            }
        }, this.settings.syncInterval);
    },
    
    stopPeriodicSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    },
    
    // ==================== SYNC OPERATIONS ====================
    
    async sync() {
        if (this.status !== 'connected' || this.status === 'syncing') return;
        
        this.status = 'syncing';
        this.os.modules.EventBus.emit('sync:started');
        
        try {
            // Process queue first
            await this.processQueue();
            
            // Then sync each data type
            if (this.settings.syncSettings) {
                await this.syncSettings();
            }
            
            if (this.settings.syncFiles) {
                await this.syncFiles();
            }
            
            if (this.settings.syncApps) {
                await this.syncApps();
            }
            
            this.data.lastSync = Date.now();
            this.status = 'connected';
            
            this.addToHistory({
                type: 'sync',
                status: 'success',
                timestamp: Date.now()
            });
            
            this.os.modules.EventBus.emit('sync:completed');
            
        } catch (error) {
            this.status = 'error';
            this.addToHistory({
                type: 'sync',
                status: 'error',
                error: error.message,
                timestamp: Date.now()
            });
            this.os.modules.EventBus.emit('sync:error', error);
        }
    },
    
    async syncSettings() {
        const localSettings = this.os.modules.Settings?.getAll();
        const remoteSettings = await this.fetchRemote('settings');
        
        if (remoteSettings) {
            const resolved = this.resolveConflict('settings', localSettings, remoteSettings);
            if (resolved !== localSettings) {
                await this.os.modules.Settings?.importSettings(resolved);
            }
            if (resolved !== remoteSettings) {
                await this.pushRemote('settings', resolved);
            }
        } else {
            await this.pushRemote('settings', localSettings);
        }
    },
    
    async syncFiles() {
        // Get list of files that changed since last sync
        const changed = await this.getChangedFiles();
        
        for (const file of changed) {
            try {
                const content = await this.os.modules.FileSystem?.readFile(file.path);
                const remote = await this.fetchRemote(`file/${file.path}`);
                
                if (remote) {
                    const resolved = this.resolveFileConflict(file, remote, content);
                    if (resolved.action === 'useLocal') {
                        await this.pushRemote(`file/${file.path}`, { file, content });
                    } else if (resolved.action === 'useRemote') {
                        await this.os.modules.FileSystem?.writeFile(file.path, resolved.content);
                    }
                } else {
                    await this.pushRemote(`file/${file.path}`, { file, content });
                }
            } catch (error) {
                console.error('File sync failed:', file.path, error);
            }
        }
    },
    
    async syncApps() {
        const installed = this.os.modules.AppStore?.getInstalledApps();
        const remote = await this.fetchRemote('apps');
        
        if (remote) {
            // Compare and sync app lists
            const localIds = new Set(installed.map(a => a.id));
            const remoteIds = new Set(remote.map(a => a.id));
            
            // Install missing remote apps
            for (const app of remote) {
                if (!localIds.has(app.id) && app.autoSync) {
                    await this.os.modules.AppStore?.installApp(app.id);
                }
            }
            
            // Uninstall apps not in remote (if configured)
            // This would need careful consideration
        } else {
            await this.pushRemote('apps', installed);
        }
    },
    
    // ==================== QUEUE MANAGEMENT ====================
    
    queueSync(type, data) {
        this.queue.push({
            id: BhekHelpers.generateId('sync-'),
            type,
            data,
            timestamp: Date.now(),
            attempts: 0
        });
        
        if (this.status === 'connected') {
            this.processQueue();
        }
    },
    
    async processQueue() {
        if (this.queue.length === 0) return;
        
        const queue = [...this.queue];
        this.queue = [];
        
        for (const item of queue) {
            try {
                await this.pushRemote(item.type, item.data);
                this.addToHistory({
                    type: 'queue',
                    action: 'processed',
                    item,
                    timestamp: Date.now()
                });
            } catch (error) {
                item.attempts++;
                if (item.attempts < 3) {
                    this.queue.push(item); // Retry later
                } else {
                    this.addToHistory({
                        type: 'queue',
                        action: 'failed',
                        item,
                        error: error.message,
                        timestamp: Date.now()
                    });
                }
            }
        }
    },
    
    // ==================== CONFLICT RESOLUTION ====================
    
    resolveConflict(type, local, remote) {
        const strategy = this.settings.conflictStrategy;
        
        if (strategy === 'local') return local;
        if (strategy === 'remote') return remote;
        
        if (strategy === 'newest') {
            const localTime = local?.timestamp || 0;
            const remoteTime = remote?.timestamp || 0;
            return localTime > remoteTime ? local : remote;
        }
        
        if (strategy === 'ask') {
            this.conflicts.push({
                type,
                local,
                remote,
                timestamp: Date.now()
            });
            
            this.os.modules.EventBus.emit('sync:conflict', {
                type,
                local,
                remote,
                resolve: (choice) => this.resolveConflictChoice(type, choice, local, remote)
            });
            
            return local; // Default to local until resolved
        }
        
        return local;
    },
    
    resolveFileConflict(file, remote, localContent) {
        const localTime = new Date(file.modified).getTime();
        const remoteTime = new Date(remote.file.modified).getTime();
        
        if (Math.abs(localTime - remoteTime) < 1000) {
            // Same time - files are identical
            return { action: 'none' };
        }
        
        if (localTime > remoteTime) {
            // Local is newer
            return { action: 'useLocal' };
        } else if (remoteTime > localTime) {
            // Remote is newer
            return { action: 'useRemote', content: remote.content };
        }
        
        // Different times but can't decide - ask user
        this.conflicts.push({
            type: 'file',
            path: file.path,
            local: { file, content: localContent },
            remote,
            timestamp: Date.now()
        });
        
        this.os.modules.EventBus.emit('sync:file_conflict', {
            path: file.path,
            local: { file, content: localContent },
            remote,
            resolve: (choice) => this.resolveFileConflictChoice(file.path, choice, localContent, remote)
        });
        
        return { action: 'ask' };
    },
    
    resolveConflictChoice(type, choice, local, remote) {
        if (choice === 'local') {
            this.pushRemote(type, local);
        } else if (choice === 'remote') {
            if (type === 'settings') {
                this.os.modules.Settings?.importSettings(remote);
            }
        }
        
        // Remove from conflicts
        this.conflicts = this.conflicts.filter(c => 
            !(c.type === type && c.local === local && c.remote === remote)
        );
    },
    
    resolveFileConflictChoice(path, choice, localContent, remote) {
        if (choice === 'local') {
            this.pushRemote(`file/${path}`, { file: remote.file, content: localContent });
        } else if (choice === 'remote') {
            this.os.modules.FileSystem?.writeFile(path, remote.content);
        }
        
        // Remove from conflicts
        this.conflicts = this.conflicts.filter(c => 
            !(c.type === 'file' && c.path === path)
        );
    },
    
    // ==================== NETWORK OPERATIONS ====================
    
    async fetchRemote(endpoint) {
        if (!navigator.onLine) return null;
        
        try {
            const response = await fetch(`${this.settings.serverUrl}/api/${endpoint}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.settings.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            return await response.json();
        } catch (error) {
            console.error('Fetch failed:', error);
            return null;
        }
    },
    
    async pushRemote(endpoint, data) {
        if (!navigator.onLine) {
            this.queueSync(endpoint, data);
            return;
        }
        
        try {
            const response = await fetch(`${this.settings.serverUrl}/api/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.settings.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            return await response.json();
        } catch (error) {
            console.error('Push failed:', error);
            this.queueSync(endpoint, data);
        }
    },
    
    // ==================== FILE TRACKING ====================
    
    async getChangedFiles() {
        const changed = [];
        const lastSync = this.data.lastSync || 0;
        
        // This would need to track file changes
        // For now, return empty
        return changed;
    },
    
    // ==================== HISTORY ====================
    
    addToHistory(entry) {
        this.history.push(entry);
        
        // Trim history
        if (this.history.length > 100) {
            this.history = this.history.slice(-100);
        }
    },
    
    getHistory(limit = 50) {
        return this.history.slice(-limit);
    },
    
    // ==================== UTILITY ====================
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    getStatus() {
        return {
            status: this.status,
            enabled: this.settings.enabled,
            provider: this.settings.provider,
            queueLength: this.queue.length,
            conflicts: this.conflicts.length,
            lastSync: this.data.lastSync,
            settings: this.settings
        };
    },
    
    async updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        await this.saveSettings();
        
        if (this.settings.enabled && this.status !== 'connected') {
            this.connect();
        } else if (!this.settings.enabled && this.status === 'connected') {
            this.disconnect();
        }
    }
};

window.CloudSync = CloudSync;
