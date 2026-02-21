/**
 * BhekOS File System - Complete virtual file system with all integrations
 */
const FileSystem = {
    os: null,
    db: null,
    
    // File system state
    state: {
        currentPath: '/',
        selectedItems: [],
        clipboard: null,
        clipboardAction: null,
        mountedDrives: new Map(),
        watchers: new Map()
    },
    
    // File system settings
    settings: {
        showHiddenFiles: false,
        confirmDelete: true,
        useRecycleBin: true,
        thumbnailCache: true,
        maxRecentFiles: 20
    },
    
    // Recent files
    recentFiles: [],
    
    // File type handlers
    fileHandlers: new Map(),
    
    // ==================== INITIALIZATION ====================
    
    async init(os) {
        this.os = os;
        console.log('File System initializing...');
        
        // Initialize IndexedDB
        await this.initDatabase();
        
        // Load settings
        await this.loadSettings();
        
        // Create default folders
        await this.createDefaultStructure();
        
        // Load recent files
        await this.loadRecentFiles();
        
        // Register default file handlers
        this.registerDefaultHandlers();
        
        // Setup file watchers
        this.setupWatchers();
        
        console.log('File System ready');
        return this;
    },
    
    async initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('BhekOS_FileSystem', 4);
            
            request.onerror = () => reject(request.error);
            
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Files store
                if (!db.objectStoreNames.contains('files')) {
                    const fileStore = db.createObjectStore('files', { keyPath: 'path' });
                    fileStore.createIndex('name', 'name', { unique: false });
                    fileStore.createIndex('parent', 'parent', { unique: false });
                    fileStore.createIndex('type', 'type', { unique: false });
                    fileStore.createIndex('extension', 'extension', { unique: false });
                    fileStore.createIndex('size', 'size', { unique: false });
                    fileStore.createIndex('modified', 'modified', { unique: false });
                    fileStore.createIndex('owner', 'owner', { unique: false });
                }
                
                // File content store
                if (!db.objectStoreNames.contains('content')) {
                    const contentStore = db.createObjectStore('content', { keyPath: 'path' });
                    contentStore.createIndex('size', 'size', { unique: false });
                }
                
                // File metadata store
                if (!db.objectStoreNames.contains('metadata')) {
                    const metaStore = db.createObjectStore('metadata', { keyPath: 'path' });
                }
                
                // Trash store
                if (!db.objectStoreNames.contains('trash')) {
                    const trashStore = db.createObjectStore('trash', { keyPath: 'path' });
                    trashStore.createIndex('deleted', 'deleted', { unique: false });
                }
                
                // File versions store
                if (!db.objectStoreNames.contains('versions')) {
                    const versionStore = db.createObjectStore('versions', { keyPath: 'id' });
                    versionStore.createIndex('path', 'path', { unique: false });
                    versionStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                // Shared files store (Phase 3)
                if (!db.objectStoreNames.contains('shared')) {
                    const sharedStore = db.createObjectStore('shared', { keyPath: 'id' });
                    sharedStore.createIndex('path', 'path', { unique: false });
                    sharedStore.createIndex('sharedWith', 'sharedWith', { unique: false });
                    sharedStore.createIndex('expires', 'expires', { unique: false });
                }
                
                // File locks store (Phase 3)
                if (!db.objectStoreNames.contains('locks')) {
                    const lockStore = db.createObjectStore('locks', { keyPath: 'path' });
                    lockStore.createIndex('user', 'user', { unique: false });
                    lockStore.createIndex('expires', 'expires', { unique: false });
                }
            };
        });
    },
    
    async loadSettings() {
        const saved = await this.os.modules.Storage.get('filesystem_settings', {});
        this.settings = { ...this.settings, ...saved };
    },
    
    async saveSettings() {
        await this.os.modules.Storage.set('filesystem_settings', this.settings);
    },
    
    async createDefaultStructure() {
        const root = await this.get('/');
        if (!root) {
            await this.createFolder(null, '', {
                owner: 'system',
                permissions: 'rwxr-xr-x',
                hidden: false
            });
            
            const folders = [
                'Documents', 'Downloads', 'Pictures', 'Music', 'Videos',
                'Desktop', 'Public', 'Templates', 'Projects', 'Apps',
                'Shared', 'Backups' // Phase 3 folders
            ];
            
            for (const folder of folders) {
                await this.createFolder('/', folder, {
                    owner: 'system',
                    permissions: 'rwxr-xr-x'
                });
            }
            
            await this.writeFile('/Documents/README.txt', 
                'Welcome to BhekOS File System!\n\nThis is your personal document folder.\n\nFor collaboration features, check the Shared folder.', 
                { owner: 'system' }
            );
            
            await this.writeFile('/Desktop/Welcome.app', 
                JSON.stringify({ type: 'app', id: 'welcome' }), 
                { type: 'application/bhekos-app' }
            );
        }
    },
    
    // ==================== FILE OPERATIONS ====================
    
    async get(path) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['files'], 'readonly');
            const store = tx.objectStore('files');
            const request = store.get(path);
            
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    },
    
    async createFolder(parentPath, name, options = {}) {
        const path = parentPath === '/' || !parentPath ? `/${name}` : `${parentPath}/${name}`;
        
        const exists = await this.get(path);
        if (exists) throw new Error('Folder already exists');
        
        const now = new Date().toISOString();
        const user = this.os.modules.Security?.getCurrentUser();
        
        const folder = {
            path,
            name,
            parent: parentPath || '/',
            type: 'folder',
            extension: null,
            size: 0,
            created: now,
            modified: now,
            accessed: now,
            owner: options.owner || user?.username || 'system',
            group: options.group || 'users',
            permissions: options.permissions || 'rwxr-xr-x',
            hidden: options.hidden || false,
            icon: '📁',
            tags: options.tags || [],
            metadata: options.metadata || {},
            shared: options.shared || false,
            locked: false,
            lockOwner: null
        };
        
        await this.saveFile(folder);
        this.notifyWatchers(parentPath, 'created', folder);
        this.logOperation('create_folder', path, user?.username);
        
        return folder;
    },
    
    async writeFile(path, content, options = {}) {
        const parts = path.split('/');
        const name = parts.pop();
        const parent = parts.join('/') || '/';
        const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : null;
        
        await this.checkPermissions(parent, 'write');
        
        const now = new Date().toISOString();
        const user = this.os.modules.Security?.getCurrentUser();
        
        let processedContent = content;
        let size = 0;
        
        if (typeof content === 'string') {
            size = content.length;
        } else if (content instanceof Blob) {
            size = content.size;
            processedContent = await this.blobToBase64(content);
        } else if (typeof content === 'object') {
            processedContent = JSON.stringify(content, null, 2);
            size = processedContent.length;
        }
        
        const existing = await this.get(path);
        
        // Check if file is locked
        if (existing?.locked && existing.lockOwner !== user?.username) {
            throw new Error('File is locked by another user');
        }
        
        let version = 1;
        if (existing) {
            if (existing.contentHash !== await this.hashContent(processedContent)) {
                await this.saveVersion(path, existing);
                version = (existing.version || 1) + 1;
            }
        }
        
        const file = {
            path,
            name,
            parent,
            type: 'file',
            extension,
            size,
            created: existing?.created || now,
            modified: now,
            accessed: now,
            owner: options.owner || user?.username || 'system',
            group: options.group || 'users',
            permissions: options.permissions || 'rw-r--r--',
            hidden: options.hidden || false,
            icon: this.getFileIcon(name, extension),
            mimeType: options.type || this.getMimeType(extension),
            contentHash: await this.hashContent(processedContent),
            version,
            tags: options.tags || existing?.tags || [],
            metadata: { ...existing?.metadata, ...options.metadata },
            shared: existing?.shared || false,
            sharedWith: existing?.sharedWith || [],
            locked: existing?.locked || false,
            lockOwner: existing?.lockOwner || null
        };
        
        await this.saveFile(file);
        await this.saveContent(path, processedContent, size);
        this.addToRecent(path, file);
        this.notifyWatchers(parent, existing ? 'modified' : 'created', file);
        this.logOperation(existing ? 'write_file' : 'create_file', path, user?.username);
        
        return file;
    },
    
    async readFile(path, options = {}) {
        const file = await this.get(path);
        if (!file) throw new Error('File not found');
        if (file.type === 'folder') throw new Error('Cannot read folder');
        
        await this.checkPermissions(path, 'read');
        
        file.accessed = new Date().toISOString();
        await this.saveFile(file);
        
        const content = await this.getContent(path);
        this.addToRecent(path, file);
        
        if (options.asBlob) {
            return this.base64ToBlob(content, file.mimeType);
        }
        
        if (options.encoding === 'binary') {
            return content;
        }
        
        if (file.extension === 'json' && typeof content === 'string') {
            try {
                return JSON.parse(content);
            } catch {
                return content;
            }
        }
        
        return content;
    },
    
    async delete(path, permanent = false) {
        const item = await this.get(path);
        if (!item) throw new Error('Item not found');
        
        await this.checkPermissions(path, 'delete');
        
        const user = this.os.modules.Security?.getCurrentUser();
        
        if (this.settings.useRecycleBin && !permanent) {
            await this.moveToTrash(path, item);
        } else {
            await this.permanentDelete(path, item);
        }
        
        this.logOperation('delete', path, user?.username);
        return true;
    },
    
    async moveToTrash(path, item) {
        const trashPath = `/Trash/${path.slice(1)}`;
        
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['files', 'content', 'trash'], 'readwrite');
            
            const trashStore = tx.objectStore('trash');
            trashStore.put({
                ...item,
                originalPath: path,
                deleted: new Date().toISOString(),
                deletedBy: this.os.modules.Security?.getCurrentUser()?.username || 'system'
            });
            
            const fileStore = tx.objectStore('files');
            fileStore.delete(path);
            
            if (item.type === 'file') {
                const contentStore = tx.objectStore('content');
                contentStore.delete(path);
            }
            
            tx.oncomplete = () => {
                this.notifyWatchers(item.parent, 'deleted', item);
                resolve();
            };
            
            tx.onerror = () => reject(tx.error);
        });
    },
    
    async permanentDelete(path, item) {
        if (item.type === 'folder') {
            const children = await this.listDirectory(path);
            for (const child of children) {
                await this.permanentDelete(child.path, child);
            }
        }
        
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['files', 'content', 'versions'], 'readwrite');
            
            tx.objectStore('files').delete(path);
            
            if (item.type === 'file') {
                tx.objectStore('content').delete(path);
                
                const versionIndex = tx.objectStore('versions').index('path');
                const versionRequest = versionIndex.getAll(path);
                
                versionRequest.onsuccess = () => {
                    for (const version of versionRequest.result) {
                        tx.objectStore('versions').delete(version.id);
                    }
                };
            }
            
            tx.oncomplete = () => {
                this.notifyWatchers(item.parent, 'deleted', item);
                resolve();
            };
            
            tx.onerror = () => reject(tx.error);
        });
    },
    
    async listDirectory(path, options = {}) {
        const dir = await this.get(path);
        if (!dir) throw new Error('Directory not found');
        if (dir.type !== 'folder') throw new Error('Not a directory');
        
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['files'], 'readonly');
            const store = tx.objectStore('files');
            const index = store.index('parent');
            const request = index.getAll(path);
            
            request.onsuccess = () => {
                let items = request.result || [];
                
                if (!this.settings.showHiddenFiles && !options.includeHidden) {
                    items = items.filter(item => !item.hidden);
                }
                
                if (options.filter) {
                    items = items.filter(options.filter);
                }
                
                if (options.sortBy) {
                    const order = options.order || 'asc';
                    items.sort((a, b) => {
                        let aVal = a[options.sortBy];
                        let bVal = b[options.sortBy];
                        
                        if (options.sortBy === 'modified' || options.sortBy === 'created' || options.sortBy === 'accessed') {
                            aVal = new Date(aVal).getTime();
                            bVal = new Date(bVal).getTime();
                        }
                        
                        if (aVal < bVal) return order === 'asc' ? -1 : 1;
                        if (aVal > bVal) return order === 'asc' ? 1 : -1;
                        return 0;
                    });
                } else {
                    items.sort((a, b) => {
                        if (a.type !== b.type) {
                            return a.type === 'folder' ? -1 : 1;
                        }
                        return a.name.localeCompare(b.name);
                    });
                }
                
                resolve(items);
            };
            
            request.onerror = () => reject(request.error);
        });
    },
    
    async move(oldPath, newPath) {
        const item = await this.get(oldPath);
        if (!item) throw new Error('Source not found');
        
        await this.checkPermissions(oldPath, 'move');
        await this.checkPermissions(newPath, 'write');
        
        const destExists = await this.get(newPath);
        if (destExists) throw new Error('Destination already exists');
        
        const user = this.os.modules.Security?.getCurrentUser();
        
        item.path = newPath;
        item.modified = new Date().toISOString();
        
        if (item.type === 'folder') {
            const children = await this.listDirectory(oldPath);
            for (const child of children) {
                const newChildPath = child.path.replace(oldPath, newPath);
                await this.move(child.path, newChildPath);
            }
        }
        
        if (item.type === 'file') {
            const content = await this.getContent(oldPath);
            await this.saveContent(newPath, content, item.size);
            await this.deleteContent(oldPath);
        }
        
        await this.deleteFile(oldPath);
        await this.saveFile(item);
        
        this.logOperation('move', `${oldPath} → ${newPath}`, user?.username);
        this.notifyWatchers(item.parent, 'moved', item);
        
        return item;
    },
    
    async copy(sourcePath, destPath) {
        const source = await this.get(sourcePath);
        if (!source) throw new Error('Source not found');
        
        await this.checkPermissions(sourcePath, 'read');
        await this.checkPermissions(destPath, 'write');
        
        const destExists = await this.get(destPath);
        if (destExists) throw new Error('Destination already exists');
        
        const user = this.os.modules.Security?.getCurrentUser();
        
        const copy = {
            ...source,
            path: destPath,
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            owner: user?.username || source.owner,
            shared: false,
            sharedWith: [],
            locked: false,
            lockOwner: null
        };
        
        delete copy.id;
        
        if (source.type === 'folder') {
            const children = await this.listDirectory(sourcePath);
            for (const child of children) {
                const newChildPath = child.path.replace(sourcePath, destPath);
                await this.copy(child.path, newChildPath);
            }
        }
        
        if (source.type === 'file') {
            const content = await this.getContent(sourcePath);
            await this.saveContent(destPath, content, source.size);
        }
        
        await this.saveFile(copy);
        
        this.logOperation('copy', `${sourcePath} → ${destPath}`, user?.username);
        this.notifyWatchers(destPath, 'created', copy);
        
        return copy;
    },
    
    // ==================== FILE CONTENT MANAGEMENT ====================
    
    saveFile(file) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['files'], 'readwrite');
            const store = tx.objectStore('files');
            const request = store.put(file);
            
            request.onsuccess = () => resolve(file);
            request.onerror = () => reject(request.error);
        });
    },
    
    deleteFile(path) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['files'], 'readwrite');
            const store = tx.objectStore('files');
            const request = store.delete(path);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },
    
    saveContent(path, content, size) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['content'], 'readwrite');
            const store = tx.objectStore('content');
            const request = store.put({ path, content, size });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },
    
    getContent(path) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['content'], 'readonly');
            const store = tx.objectStore('content');
            const request = store.get(path);
            
            request.onsuccess = () => resolve(request.result?.content || null);
            request.onerror = () => reject(request.error);
        });
    },
    
    deleteContent(path) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['content'], 'readwrite');
            const store = tx.objectStore('content');
            const request = store.delete(path);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },
    
    // ==================== VERSION CONTROL ====================
    
    async saveVersion(path, file) {
        const content = await this.getContent(path);
        const user = this.os.modules.Security?.getCurrentUser();
        
        const version = {
            id: `${path}_${Date.now()}`,
            path,
            timestamp: new Date().toISOString(),
            file: { ...file, content: undefined },
            content,
            user: user?.username || 'system',
            comment: file.versionComment || ''
        };
        
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['versions'], 'readwrite');
            const store = tx.objectStore('versions');
            const request = store.put(version);
            
            request.onsuccess = () => resolve(version);
            request.onerror = () => reject(request.error);
        });
    },
    
    async getVersions(path) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['versions'], 'readonly');
            const store = tx.objectStore('versions');
            const index = store.index('path');
            const request = index.getAll(path);
            
            request.onsuccess = () => {
                const versions = request.result || [];
                versions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                resolve(versions);
            };
            
            request.onerror = () => reject(request.error);
        });
    },
    
    async restoreVersion(path, versionId) {
        const versions = await this.getVersions(path);
        const version = versions.find(v => v.id === versionId);
        
        if (!version) throw new Error('Version not found');
        
        await this.writeFile(path, version.content, {
            metadata: { restoredFrom: versionId, restoredAt: new Date().toISOString() }
        });
    },
    
    // ==================== TRASH MANAGEMENT ====================
    
    async getTrash() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['trash'], 'readonly');
            const store = tx.objectStore('trash');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const items = request.result || [];
                items.sort((a, b) => new Date(b.deleted) - new Date(a.deleted));
                resolve(items);
            };
            
            request.onerror = () => reject(request.error);
        });
    },
    
    async restoreFromTrash(path) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['trash', 'files', 'content'], 'readwrite');
            
            const trashStore = tx.objectStore('trash');
            const trashRequest = trashStore.get(path);
            
            trashRequest.onsuccess = () => {
                const item = trashRequest.result;
                if (!item) {
                    reject(new Error('Item not found in trash'));
                    return;
                }
                
                const fileStore = tx.objectStore('files');
                fileStore.put(item);
                
                if (item.type === 'file') {
                    const contentStore = tx.objectStore('content');
                    contentStore.put({
                        path: item.originalPath,
                        content: item.content,
                        size: item.size
                    });
                }
                
                trashStore.delete(path);
            };
            
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },
    
    async emptyTrash() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['trash'], 'readwrite');
            const store = tx.objectStore('trash');
            const request = store.clear();
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },
    
    // ==================== CLIPBOARD OPERATIONS ====================
    
    async copyToClipboard(paths, action = 'copy') {
        const items = [];
        for (const path of paths) {
            const item = await this.get(path);
            if (item) items.push(item);
        }
        
        this.state.clipboard = items;
        this.state.clipboardAction = action;
        
        this.os.modules.EventBus.emit('clipboard:changed', {
            items: items.length,
            action
        });
    },
    
    async paste(destPath) {
        if (!this.state.clipboard) return [];
        
        const results = [];
        for (const item of this.state.clipboard) {
            const destName = this.state.clipboardAction === 'cut' ? 
                item.name : 
                await this.getUniqueName(destPath, item.name);
            
            const dest = `${destPath}/${destName}`;
            
            if (this.state.clipboardAction === 'cut') {
                results.push(await this.move(item.path, dest));
            } else {
                results.push(await this.copy(item.path, dest));
            }
        }
        
        if (this.state.clipboardAction === 'cut') {
            this.state.clipboard = null;
            this.state.clipboardAction = null;
        }
        
        return results;
    },
    
    async getUniqueName(destPath, name) {
        const exists = await this.get(`${destPath}/${name}`);
        if (!exists) return name;
        
        const ext = name.includes('.') ? name.split('.').pop() : '';
        const base = name.includes('.') ? name.slice(0, -(ext.length + 1)) : name;
        
        let counter = 1;
        let newName;
        
        do {
            newName = ext ? `${base} (${counter}).${ext}` : `${base} (${counter})`;
            counter++;
        } while (await this.get(`${destPath}/${newName}`));
        
        return newName;
    },
    
    // ==================== FILE WATCHERS ====================
    
    watch(path, callback) {
        const id = BhekHelpers.generateId('watch-');
        
        if (!this.state.watchers.has(path)) {
            this.state.watchers.set(path, new Map());
        }
        
        this.state.watchers.get(path).set(id, callback);
        return id;
    },
    
    unwatch(path, id) {
        const watchers = this.state.watchers.get(path);
        if (watchers) {
            watchers.delete(id);
            if (watchers.size === 0) {
                this.state.watchers.delete(path);
            }
        }
    },
    
    notifyWatchers(path, event, item) {
        const watchers = this.state.watchers.get(path);
        if (watchers) {
            watchers.forEach(callback => {
                try {
                    callback(event, item);
                } catch (error) {
                    console.error('Watcher error:', error);
                }
            });
        }
        
        if (path !== '/') {
            const parent = path.split('/').slice(0, -1).join('/') || '/';
            this.notifyWatchers(parent, event, item);
        }
    },
    
    setupWatchers() {
        setInterval(() => {}, 60000);
    },
    
    // ==================== RECENT FILES ====================
    
    addToRecent(path, file) {
        this.recentFiles = this.recentFiles.filter(f => f.path !== path);
        this.recentFiles.unshift({
            path,
            name: file.name,
            icon: file.icon,
            accessed: new Date().toISOString()
        });
        
        if (this.recentFiles.length > this.settings.maxRecentFiles) {
            this.recentFiles.pop();
        }
        
        this.saveRecentFiles();
        this.os.modules.EventBus.emit('files:recent_updated', this.recentFiles);
    },
    
    getRecentFiles() {
        return [...this.recentFiles];
    },
    
    clearRecentFiles() {
        this.recentFiles = [];
        this.saveRecentFiles();
    },
    
    async loadRecentFiles() {
        const saved = await this.os.modules.Storage.get('recent_files', []);
        this.recentFiles = saved;
    },
    
    async saveRecentFiles() {
        await this.os.modules.Storage.set('recent_files', this.recentFiles);
    },
    
    // ==================== FILE HANDLERS ====================
    
    registerHandler(extension, handler) {
        this.fileHandlers.set(extension.toLowerCase(), handler);
    },
    
    getHandler(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        return this.fileHandlers.get(ext);
    },
    
    async openFile(path) {
        const file = await this.get(path);
        if (!file) throw new Error('File not found');
        
        const handler = this.getHandler(file.name);
        
        if (handler) {
            await this.os.launchApp(handler.appId, { file: path });
        } else {
            await this.os.launchApp('notepad', { file: path });
        }
    },
    
    registerDefaultHandlers() {
        const handlers = {
            'txt': 'notepad', 'md': 'notepad', 'json': 'notepad',
            'jpg': 'image-viewer', 'jpeg': 'image-viewer', 'png': 'image-viewer',
            'gif': 'image-viewer', 'mp3': 'media-player', 'mp4': 'media-player',
            'pdf': 'pdf-viewer', 'doc': 'word-processor', 'docx': 'word-processor',
            'js': 'code-editor', 'html': 'code-editor', 'css': 'code-editor',
            'py': 'code-editor', 'csv': 'spreadsheet', 'xls': 'spreadsheet'
        };
        
        for (const [ext, appId] of Object.entries(handlers)) {
            this.registerHandler(ext, { appId, name: `${appId} Handler` });
        }
    },
    
    // ==================== PERMISSIONS ====================
    
    async checkPermissions(path, operation) {
        if (!this.os.modules.Security) return true;
        
        const user = this.os.modules.Security.getCurrentUser();
        if (!user || user.role === 'admin') return true;
        
        const item = await this.get(path);
        if (!item) return true;
        
        if (item.owner === user.username) {
            const perms = item.permissions.slice(0, 3);
            if (operation === 'read' && !perms.includes('r')) {
                throw new Error('Permission denied');
            }
            if (operation === 'write' && !perms.includes('w')) {
                throw new Error('Permission denied');
            }
            if (operation === 'delete' && !perms.includes('x')) {
                throw new Error('Permission denied');
            }
        } else {
            const perms = item.permissions.slice(6);
            if (operation === 'read' && !perms.includes('r')) {
                throw new Error('Permission denied');
            }
            if (operation === 'write' && !perms.includes('w')) {
                throw new Error('Permission denied');
            }
            if (operation === 'delete' && !perms.includes('x')) {
                throw new Error('Permission denied');
            }
        }
    },
    
    // ==================== PHASE 3: COLLABORATION FEATURES ====================
    
    /**
     * Share file with user
     * @param {string} path - File path
     * @param {string} username - User to share with
     * @param {Object} options - Share options
     */
    async shareFile(path, username, options = {}) {
        const file = await this.get(path);
        if (!file) throw new Error('File not found');
        
        const user = this.os.modules.Security?.getCurrentUser();
        if (file.owner !== user?.username && user?.role !== 'admin') {
            throw new Error('Only owner can share this file');
        }
        
        const shareId = BhekHelpers.generateUUID();
        const share = {
            id: shareId,
            path,
            sharedWith: username,
            sharedBy: user?.username,
            permissions: options.permissions || 'read',
            expires: options.expires || null,
            createdAt: new Date().toISOString(),
            message: options.message || ''
        };
        
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['shared'], 'readwrite');
            const store = tx.objectStore('shared');
            const request = store.put(share);
            
            request.onsuccess = () => {
                file.shared = true;
                if (!file.sharedWith) file.sharedWith = [];
                file.sharedWith.push(username);
                this.saveFile(file);
                
                this.os.modules.EventBus.emit('file:shared', { path, username, shareId });
                resolve(shareId);
            };
            
            request.onerror = () => reject(request.error);
        });
    },
    
    /**
     * Get shared files
     * @param {string} username - Username
     * @returns {Promise<Array>} Shared files
     */
    async getSharedWithUser(username) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['shared'], 'readonly');
            const store = tx.objectStore('shared');
            const index = store.index('sharedWith');
            const request = index.getAll(username);
            
            request.onsuccess = async () => {
                const shares = request.result || [];
                const results = [];
                
                for (const share of shares) {
                    if (share.expires && new Date(share.expires) < new Date()) {
                        continue;
                    }
                    
                    const file = await this.get(share.path);
                    if (file) {
                        results.push({
                            ...share,
                            file: {
                                name: file.name,
                                path: file.path,
                                icon: file.icon,
                                size: file.size,
                                modified: file.modified
                            }
                        });
                    }
                }
                
                resolve(results);
            };
            
            request.onerror = () => reject(request.error);
        });
    },
    
    /**
     * Lock file for editing
     * @param {string} path - File path
     */
    async lockFile(path) {
        const file = await this.get(path);
        if (!file) throw new Error('File not found');
        
        const user = this.os.modules.Security?.getCurrentUser();
        
        if (file.locked && file.lockOwner !== user?.username) {
            throw new Error(`File is locked by ${file.lockOwner}`);
        }
        
        file.locked = true;
        file.lockOwner = user?.username;
        file.lockExpires = Date.now() + 5 * 60 * 1000; // 5 minutes
        
        await this.saveFile(file);
        
        // Auto-expire lock
        setTimeout(() => {
            this.unlockFile(path, true);
        }, 5 * 60 * 1000);
        
        this.os.modules.EventBus.emit('file:locked', { path, user: user?.username });
        
        return true;
    },
    
    /**
     * Unlock file
     * @param {string} path - File path
     * @param {boolean} force - Force unlock
     */
    async unlockFile(path, force = false) {
        const file = await this.get(path);
        if (!file) throw new Error('File not found');
        
        const user = this.os.modules.Security?.getCurrentUser();
        
        if (!force && file.lockOwner !== user?.username && user?.role !== 'admin') {
            throw new Error('You do not own this lock');
        }
        
        file.locked = false;
        file.lockOwner = null;
        file.lockExpires = null;
        
        await this.saveFile(file);
        this.os.modules.EventBus.emit('file:unlocked', { path, user: user?.username });
        
        return true;
    },
    
    /**
     * Get file lock status
     * @param {string} path - File path
     * @returns {Object} Lock status
     */
    async getLockStatus(path) {
        const file = await this.get(path);
        if (!file) throw new Error('File not found');
        
        return {
            locked: file.locked || false,
            owner: file.lockOwner,
            expires: file.lockExpires
        };
    },
    
    // ==================== UTILITY METHODS ====================
    
    getFileIcon(name, ext) {
        const icons = {
            'txt': '📄', 'md': '📝', 'pdf': '📕', 'doc': '📘', 'docx': '📘',
            'js': '📜', 'html': '🌐', 'css': '🎨', 'json': '⚙️', 'py': '🐍',
            'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🎞️', 'svg': '🔷',
            'mp3': '🎵', 'wav': '🎵', 'mp4': '🎬', 'avi': '🎬',
            'zip': '📦', 'rar': '📦', '7z': '📦',
            'exe': '⚡', 'app': '📱', 'deb': '🐧',
            'csv': '📊', 'xls': '📊', 'xlsx': '📊', 'sql': '🗄️'
        };
        return icons[ext] || '📄';
    },
    
    getMimeType(ext) {
        const mimes = {
            'txt': 'text/plain', 'html': 'text/html', 'css': 'text/css',
            'js': 'application/javascript', 'json': 'application/json',
            'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
            'gif': 'image/gif', 'svg': 'image/svg+xml',
            'mp3': 'audio/mpeg', 'mp4': 'video/mp4',
            'pdf': 'application/pdf', 'zip': 'application/zip'
        };
        return mimes[ext] || 'application/octet-stream';
    },
    
    async hashContent(content) {
        if (!content) return '';
        
        const encoder = new TextEncoder();
        const data = encoder.encode(String(content).slice(0, 1000));
        const hash = await crypto.subtle.digest('SHA-1', data);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .slice(0, 16);
    },
    
    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    },
    
    base64ToBlob(base64, mime) {
        const byteCharacters = atob(base64.split(',')[1] || base64);
        const byteArrays = [];
        
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            byteArrays.push(new Uint8Array(byteNumbers));
        }
        
        return new Blob(byteArrays, { type: mime });
    },
    
    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
    },
    
    logOperation(operation, path, user) {
        if (this.os.modules.Logger) {
            this.os.modules.Logger.info('FileSystem', `${operation}: ${path}`, { user });
        }
        this.os.modules.EventBus.emit('files:operation', {
            operation, path, user, timestamp: new Date().toISOString()
        });
    },
    
    async getStats() {
        let totalFiles = 0, totalFolders = 0, totalSize = 0;
        
        const count = async (path) => {
            const items = await this.listDirectory(path, { includeHidden: true });
            for (const item of items) {
                if (item.type === 'folder') {
                    totalFolders++;
                    await count(item.path);
                } else {
                    totalFiles++;
                    totalSize += item.size;
                }
            }
        };
        
        await count('/');
        
        return {
            totalFiles,
            totalFolders,
            totalSize,
            formattedSize: this.formatSize(totalSize),
            recentFiles: this.recentFiles.length,
            trashItems: (await this.getTrash()).length,
            versions: await this.getVersionCount()
        };
    },
    
    getVersionCount() {
        return new Promise((resolve) => {
            const tx = this.db.transaction(['versions'], 'readonly');
            const store = tx.objectStore('versions');
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(0);
        });
    }
};

window.FileSystem = FileSystem;
