/**
 * File Explorer Application - Complete file manager
 */
class FileExplorerApp {
    constructor(os, windowId) {
        this.os = os;
        this.windowId = windowId;
        this.currentPath = '/';
        this.history = ['/'];
        this.historyIndex = 0;
        this.viewMode = 'grid'; // grid, list, details
        this.sortBy = 'name';
        this.sortOrder = 'asc';
        this.selectedItems = new Set();
        this.watcherId = null;
        this.clipboard = null;
        this.clipboardAction = null;
        this.searchResults = null;
    }
    
    async render(container, options = {}) {
        this.container = container;
        
        if (options.path) {
            this.currentPath = options.path;
        }
        
        await this.renderExplorer();
        this.setupWatcher();
        this.addStyles();
    }
    
    async renderExplorer() {
        let items;
        if (this.searchResults) {
            items = this.searchResults;
        } else {
            items = await this.os.modules.FileSystem.listDirectory(this.currentPath, {
                sortBy: this.sortBy,
                order: this.sortOrder
            });
        }
        
        const pathParts = this.currentPath.split('/').filter(p => p);
        const parentPath = this.currentPath === '/' ? null : 
            '/' + pathParts.slice(0, -1).join('/');
        
        this.container.innerHTML = `
            <div class="file-explorer">
                <!-- Toolbar -->
                <div class="explorer-toolbar">
                    <div class="toolbar-group">
                        <button class="toolbar-btn" onclick="this.explorerNavigate('back')" 
                                ${this.historyIndex > 0 ? '' : 'disabled'}>
                            ←
                        </button>
                        <button class="toolbar-btn" onclick="this.explorerNavigate('forward')"
                                ${this.historyIndex < this.history.length - 1 ? '' : 'disabled'}>
                            →
                        </button>
                        <button class="toolbar-btn" onclick="this.explorerNavigate('up')"
                                ${parentPath ? '' : 'disabled'}>
                            ↑
                        </button>
                        <button class="toolbar-btn" onclick="this.refresh()">
                            ↻
                        </button>
                    </div>
                    
                    <div class="toolbar-group">
                        <button class="toolbar-btn" onclick="this.createNewFolder()">
                            📁 New Folder
                        </button>
                        <button class="toolbar-btn" onclick="this.createNewFile()">
                            📄 New File
                        </button>
                    </div>
                    
                    <div class="toolbar-group">
                        <button class="toolbar-btn" onclick="this.copy()" 
                                ${this.selectedItems.size ? '' : 'disabled'}>
                            📋 Copy
                        </button>
                        <button class="toolbar-btn" onclick="this.cut()"
                                ${this.selectedItems.size ? '' : 'disabled'}>
                            ✂️ Cut
                        </button>
                        <button class="toolbar-btn" onclick="this.paste()"
                                ${this.clipboard ? '' : 'disabled'}>
                            📌 Paste
                        </button>
                        <button class="toolbar-btn" onclick="this.delete()"
                                ${this.selectedItems.size ? '' : 'disabled'}>
                            🗑️ Delete
                        </button>
                        <button class="toolbar-btn" onclick="this.rename()"
                                ${this.selectedItems.size === 1 ? '' : 'disabled'}>
                            ✏️ Rename
                        </button>
                    </div>
                    
                    <div class="toolbar-group">
                        <button class="toolbar-btn ${this.viewMode === 'grid' ? 'active' : ''}" 
                                onclick="this.setViewMode('grid')">
                            📱 Grid
                        </button>
                        <button class="toolbar-btn ${this.viewMode === 'list' ? 'active' : ''}" 
                                onclick="this.setViewMode('list')">
                            📋 List
                        </button>
                        <button class="toolbar-btn ${this.viewMode === 'details' ? 'active' : ''}" 
                                onclick="this.setViewMode('details')">
                            📊 Details
                        </button>
                    </div>
                    
                    <div class="toolbar-group">
                        <select class="toolbar-select" onchange="this.changeSort(this.value)">
                            <option value="name" ${this.sortBy === 'name' ? 'selected' : ''}>Name</option>
                            <option value="modified" ${this.sortBy === 'modified' ? 'selected' : ''}>Date Modified</option>
                            <option value="size" ${this.sortBy === 'size' ? 'selected' : ''}>Size</option>
                            <option value="type" ${this.sortBy === 'type' ? 'selected' : ''}>Type</option>
                        </select>
                        <button class="toolbar-btn" onclick="this.toggleSortOrder()">
                            ${this.sortOrder === 'asc' ? '↑' : '↓'}
                        </button>
                    </div>
                    
                    <div class="toolbar-group">
                        <button class="toolbar-btn" onclick="this.showSearch()">
                            🔍 Search
                        </button>
                        <button class="toolbar-btn" onclick="this.showShare()"
                                ${this.selectedItems.size === 1 ? '' : 'disabled'}>
                            📤 Share
                        </button>
                        <button class="toolbar-btn" onclick="this.showProperties()"
                                ${this.selectedItems.size === 1 ? '' : 'disabled'}>
                            ℹ️ Properties
                        </button>
                    </div>
                </div>
                
                <!-- Search Bar (hidden by default) -->
                <div class="explorer-search" id="explorer-search" style="display: none;">
                    <input type="text" placeholder="Search in ${this.currentPath}" id="search-input">
                    <button onclick="this.performSearch()">Search</button>
                    <button onclick="this.clearSearch()">Clear</button>
                </div>
                
                <!-- Breadcrumb -->
                <div class="explorer-breadcrumb">
                    <span class="breadcrumb-item" onclick="this.navigateTo('/')">🏠 Root</span>
                    ${pathParts.map((part, index) => {
                        const path = '/' + pathParts.slice(0, index + 1).join('/');
                        return `
                            <span class="breadcrumb-separator">›</span>
                            <span class="breadcrumb-item" onclick="this.navigateTo('${path}')">${part}</span>
                        `;
                    }).join('')}
                </div>
                
                <!-- File List -->
                <div class="explorer-view ${this.viewMode}-view" id="explorer-view">
                    ${items.map(item => this.renderItem(item)).join('')}
                </div>
                
                <!-- Status Bar -->
                <div class="explorer-status">
                    <span>${items.length} item${items.length !== 1 ? 's' : ''}</span>
                    <span>${this.selectedItems.size} selected</span>
                    ${this.getTotalSize(items) ? `<span>Total size: ${this.formatBytes(this.getTotalSize(items))}</span>` : ''}
                    <span class="status-right">
                        <span class="status-item" onclick="this.showRecent()">🕒 Recent</span>
                        <span class="status-item" onclick="this.showShared()">👥 Shared</span>
                    </span>
                </div>
            </div>
        `;
        
        this.addEventListeners();
    }
    
    renderItem(item) {
        const isSelected = this.selectedItems.has(item.path);
        const icon = item.type === 'folder' ? '📁' : (item.icon || '📄');
        const modified = new Date(item.modified).toLocaleString();
        const size = item.type === 'folder' ? '—' : this.formatBytes(item.size);
        
        // Check if file is shared
        const shared = item.shared ? '<span class="item-shared-badge">👥</span>' : '';
        
        if (this.viewMode === 'grid') {
            return `
                <div class="explorer-item ${isSelected ? 'selected' : ''}" 
                     data-path="${item.path}"
                     data-type="${item.type}"
                     ondblclick="this.openItem('${item.path}', '${item.type}')">
                    <div class="item-icon">${icon}</div>
                    <div class="item-name">${item.name}</div>
                    <div class="item-date">${new Date(item.modified).toLocaleDateString()}</div>
                    ${shared}
                </div>
            `;
        } else if (this.viewMode === 'list') {
            return `
                <div class="explorer-item list-item ${isSelected ? 'selected' : ''}" 
                     data-path="${item.path}"
                     data-type="${item.type}"
                     ondblclick="this.openItem('${item.path}', '${item.type}')">
                    <div class="item-icon">${icon}</div>
                    <div class="item-name">${item.name}</div>
                    <div class="item-modified">${modified}</div>
                    ${shared}
                </div>
            `;
        } else {
            return `
                <div class="explorer-item details-item ${isSelected ? 'selected' : ''}" 
                     data-path="${item.path}"
                     data-type="${item.type}"
                     ondblclick="this.openItem('${item.path}', '${item.type}')">
                    <div class="item-icon">${icon}</div>
                    <div class="item-name">${item.name}</div>
                    <div class="item-modified">${modified}</div>
                    <div class="item-size">${size}</div>
                    <div class="item-type">${item.type}</div>
                    ${shared}
                </div>
            `;
        }
    }
    
    addEventListeners() {
        const view = document.getElementById('explorer-view');
        
        // Selection handling
        view.addEventListener('click', (e) => {
            const item = e.target.closest('.explorer-item');
            if (!item) {
                this.selectedItems.clear();
                this.renderExplorer();
                return;
            }
            
            const path = item.dataset.path;
            
            if (e.ctrlKey) {
                if (this.selectedItems.has(path)) {
                    this.selectedItems.delete(path);
                } else {
                    this.selectedItems.add(path);
                }
            } else if (e.shiftKey && this.lastSelected) {
                const items = Array.from(view.children);
                const start = items.findIndex(el => el.dataset.path === this.lastSelected);
                const end = items.findIndex(el => el.dataset.path === path);
                
                const [min, max] = [Math.min(start, end), Math.max(start, end)];
                for (let i = min; i <= max; i++) {
                    this.selectedItems.add(items[i].dataset.path);
                }
            } else {
                this.selectedItems.clear();
                this.selectedItems.add(path);
                this.lastSelected = path;
            }
            
            view.querySelectorAll('.explorer-item').forEach(el => {
                el.classList.toggle('selected', this.selectedItems.has(el.dataset.path));
            });
        });
        
        // Drag and drop
        view.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.explorer-item');
            if (item) {
                e.dataTransfer.setData('text/plain', item.dataset.path);
                e.dataTransfer.effectAllowed = 'move';
            }
        });
        
        view.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        
        view.addEventListener('drop', async (e) => {
            e.preventDefault();
            const item = e.target.closest('.explorer-item');
            if (!item) return;
            
            const destPath = item.dataset.type === 'folder' ? 
                item.dataset.path : 
                item.dataset.path.split('/').slice(0, -1).join('/') || '/';
            
            const sourcePath = e.dataTransfer.getData('text/plain');
            
            try {
                await this.os.modules.FileSystem.move(sourcePath, destPath + '/' + sourcePath.split('/').pop());
                this.refresh();
            } catch (error) {
                this.os.notify('Error', 'Failed to move item: ' + error.message, 'error');
            }
        });
    }
    
    setupWatcher() {
        if (this.watcherId) {
            this.os.modules.FileSystem.unwatch(this.currentPath, this.watcherId);
        }
        
        this.watcherId = this.os.modules.FileSystem.watch(this.currentPath, (event, item) => {
            if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
            this.refreshTimeout = setTimeout(() => this.refresh(), 100);
        });
    }
    
    // ==================== NAVIGATION ====================
    
    async navigateTo(path) {
        try {
            const dir = await this.os.modules.FileSystem.get(path);
            if (dir && dir.type === 'folder') {
                this.currentPath = path;
                this.history = this.history.slice(0, this.historyIndex + 1);
                this.history.push(path);
                this.historyIndex++;
                this.selectedItems.clear();
                this.searchResults = null;
                await this.renderExplorer();
            }
        } catch (error) {
            this.os.notify('Error', 'Cannot navigate to path', 'error');
        }
    }
    
    explorerNavigate(direction) {
        if (direction === 'back' && this.historyIndex > 0) {
            this.historyIndex--;
            this.currentPath = this.history[this.historyIndex];
            this.renderExplorer();
        } else if (direction === 'forward' && this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.currentPath = this.history[this.historyIndex];
            this.renderExplorer();
        } else if (direction === 'up') {
            const parts = this.currentPath.split('/').filter(p => p);
            if (parts.length > 0) {
                this.navigateTo('/' + parts.slice(0, -1).join('/'));
            }
        }
    }
    
    async refresh() {
        this.searchResults = null;
        await this.renderExplorer();
    }
    
    async openItem(path, type) {
        if (type === 'folder') {
            this.navigateTo(path);
        } else {
            try {
                await this.os.modules.FileSystem.openFile(path);
            } catch (error) {
                this.os.notify('Error', 'Cannot open file', 'error');
            }
        }
    }
    
    // ==================== FILE OPERATIONS ====================
    
    async createNewFolder() {
        const name = prompt('Enter folder name:');
        if (!name) return;
        
        try {
            await this.os.modules.FileSystem.createFolder(this.currentPath, name);
            this.refresh();
        } catch (error) {
            this.os.notify('Error', error.message, 'error');
        }
    }
    
    async createNewFile() {
        const name = prompt('Enter file name:');
        if (!name) return;
        
        try {
            await this.os.modules.FileSystem.writeFile(
                this.currentPath + '/' + name,
                ''
            );
            this.refresh();
        } catch (error) {
            this.os.notify('Error', error.message, 'error');
        }
    }
    
    async copy() {
        const paths = Array.from(this.selectedItems);
        this.clipboard = paths;
        this.clipboardAction = 'copy';
        this.os.notify('Clipboard', `${paths.length} item(s) copied`);
    }
    
    async cut() {
        const paths = Array.from(this.selectedItems);
        this.clipboard = paths;
        this.clipboardAction = 'cut';
        this.os.notify('Clipboard', `${paths.length} item(s) cut`);
    }
    
    async paste() {
        if (!this.clipboard) return;
        
        for (const sourcePath of this.clipboard) {
            const fileName = sourcePath.split('/').pop();
            const destPath = this.currentPath + '/' + fileName;
            
            try {
                if (this.clipboardAction === 'cut') {
                    await this.os.modules.FileSystem.move(sourcePath, destPath);
                } else {
                    await this.os.modules.FileSystem.copy(sourcePath, destPath);
                }
            } catch (error) {
                this.os.notify('Error', `Failed to paste: ${error.message}`, 'error');
            }
        }
        
        this.clipboard = null;
        this.clipboardAction = null;
        this.refresh();
    }
    
    async delete() {
        if (this.selectedItems.size === 0) return;
        
        const confirmMsg = `Delete ${this.selectedItems.size} item(s)?`;
        if (!confirm(confirmMsg)) return;
        
        for (const path of this.selectedItems) {
            try {
                await this.os.modules.FileSystem.delete(path);
            } catch (error) {
                this.os.notify('Error', `Failed to delete: ${error.message}`, 'error');
            }
        }
        
        this.selectedItems.clear();
        this.refresh();
    }
    
    async rename() {
        if (this.selectedItems.size !== 1) return;
        
        const path = Array.from(this.selectedItems)[0];
        const item = await this.os.modules.FileSystem.get(path);
        if (!item) return;
        
        const newName = prompt('Enter new name:', item.name);
        if (!newName || newName === item.name) return;
        
        const newPath = path.split('/').slice(0, -1).concat(newName).join('/');
        
        try {
            await this.os.modules.FileSystem.move(path, newPath);
            this.refresh();
        } catch (error) {
            this.os.notify('Error', error.message, 'error');
        }
    }
    
    // ==================== VIEW MODES ====================
    
    setViewMode(mode) {
        this.viewMode = mode;
        this.renderExplorer();
    }
    
    changeSort(field) {
        this.sortBy = field;
        this.renderExplorer();
    }
    
    toggleSortOrder() {
        this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        this.renderExplorer();
    }
    
    // ==================== SEARCH ====================
    
    showSearch() {
        const searchBar = document.getElementById('explorer-search');
        searchBar.style.display = 'flex';
        document.getElementById('search-input').focus();
    }
    
    async performSearch() {
        const query = document.getElementById('search-input').value;
        if (!query) return;
        
        const results = await this.os.modules.FileSearch.search(query, {
            path: this.currentPath,
            maxResults: 100
        });
        
        this.searchResults = results;
        this.renderExplorer();
    }
    
    clearSearch() {
        this.searchResults = null;
        document.getElementById('explorer-search').style.display = 'none';
        this.renderExplorer();
    }
    
    // ==================== SHARE (Phase 3) ====================
    
    async showShare() {
        if (this.selectedItems.size !== 1) return;
        
        const path = Array.from(this.selectedItems)[0];
        const item = await this.os.modules.FileSystem.get(path);
        
        if (window.FileShareDialog) {
            FileShareDialog.setFile(item);
            FileShareDialog.show();
        }
    }
    
    async showShared() {
        const sharedFiles = await this.os.modules.FileSystem.getSharedWithUser(
            this.os.modules.UserManager?.getCurrentUser()?.id
        );
        
        this.searchResults = sharedFiles.map(s => s.file);
        this.renderExplorer();
    }
    
    // ==================== RECENT FILES ====================
    
    async showRecent() {
        const recent = await this.os.modules.FileSystem.getRecentFiles();
        this.searchResults = recent;
        this.renderExplorer();
    }
    
    // ==================== PROPERTIES ====================
    
    async showProperties() {
        if (this.selectedItems.size !== 1) return;
        
        const path = Array.from(this.selectedItems)[0];
        const item = await this.os.modules.FileSystem.get(path);
        
        const properties = `
            <div class="properties-dialog">
                <h3>Properties: ${item.name}</h3>
                <table>
                    <tr><td>Type:</td><td>${item.type}</td></tr>
                    <tr><td>Location:</td><td>${item.path}</td></tr>
                    <tr><td>Size:</td><td>${this.formatBytes(item.size)}</td></tr>
                    <tr><td>Created:</td><td>${new Date(item.created).toLocaleString()}</td></tr>
                    <tr><td>Modified:</td><td>${new Date(item.modified).toLocaleString()}</td></tr>
                    <tr><td>Accessed:</td><td>${new Date(item.accessed).toLocaleString()}</td></tr>
                    <tr><td>Owner:</td><td>${item.owner}</td></tr>
                    <tr><td>Permissions:</td><td>${item.permissions}</td></tr>
                    ${item.shared ? '<tr><td>Shared:</td><td>Yes</td></tr>' : ''}
                </table>
            </div>
        `;
        
        // Show in a modal
        const modal = document.createElement('div');
        modal.className = 'properties-modal';
        modal.innerHTML = properties;
        modal.innerHTML += '<button onclick="this.parentElement.remove()">Close</button>';
        document.body.appendChild(modal);
    }
    
    // ==================== UTILITY METHODS ====================
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
    }
    
    getTotalSize(items) {
        return items.reduce((sum, item) => sum + (item.size || 0), 0);
    }
    
    // ==================== CLEANUP ====================
    
    destroy() {
        if (this.watcherId) {
            this.os.modules.FileSystem.unwatch(this.currentPath, this.watcherId);
        }
    }
    
    // ==================== STYLES ====================
    
    addStyles() {
        if (document.getElementById('file-explorer-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'file-explorer-styles';
        style.textContent = `
            .file-explorer {
                height: 100%;
                display: flex;
                flex-direction: column;
                background: rgba(0,0,0,0.2);
                font-size: 13px;
            }
            
            .explorer-toolbar {
                padding: 8px;
                background: rgba(0,0,0,0.3);
                border-bottom: 1px solid var(--mica-border);
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }
            
            .toolbar-group {
                display: flex;
                gap: 2px;
                padding: 0 4px;
                border-right: 1px solid var(--mica-border);
            }
            
            .toolbar-group:last-child {
                border-right: none;
            }
            
            .toolbar-btn {
                padding: 6px 10px;
                background: transparent;
                border: none;
                color: white;
                font-size: 13px;
                cursor: pointer;
                border-radius: 4px;
                min-width: 32px;
            }
            
            .toolbar-btn:hover:not(:disabled) {
                background: rgba(255,255,255,0.1);
            }
            
            .toolbar-btn.active {
                background: var(--accent);
            }
            
            .toolbar-btn:disabled {
                opacity: 0.3;
                cursor: default;
            }
            
            .toolbar-select {
                padding: 5px 8px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 4px;
                color: white;
                font-size: 13px;
            }
            
            .explorer-search {
                padding: 8px;
                background: rgba(0,0,0,0.2);
                border-bottom: 1px solid var(--mica-border);
                display: flex;
                gap: 8px;
            }
            
            .explorer-search input {
                flex: 1;
                padding: 6px 8px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 4px;
                color: white;
            }
            
            .explorer-search button {
                padding: 6px 12px;
                background: var(--accent);
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
            }
            
            .explorer-breadcrumb {
                padding: 8px 12px;
                background: rgba(0,0,0,0.2);
                border-bottom: 1px solid var(--mica-border);
                display: flex;
                align-items: center;
                gap: 4px;
                flex-wrap: wrap;
            }
            
            .breadcrumb-item {
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
            }
            
            .breadcrumb-item:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .breadcrumb-separator {
                opacity: 0.5;
            }
            
            .explorer-view {
                flex: 1;
                overflow-y: auto;
                padding: 12px;
            }
            
            .grid-view {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                gap: 12px;
            }
            
            .explorer-item {
                padding: 12px 8px;
                border-radius: 6px;
                cursor: pointer;
                transition: 0.2s;
                border: 1px solid transparent;
                text-align: center;
                position: relative;
            }
            
            .explorer-item:hover {
                background: rgba(255,255,255,0.05);
                border-color: var(--mica-border);
            }
            
            .explorer-item.selected {
                background: rgba(var(--accent-rgb), 0.2);
                border-color: var(--accent);
            }
            
            .item-icon {
                font-size: 32px;
                margin-bottom: 4px;
            }
            
            .item-name {
                font-size: 12px;
                word-break: break-word;
                line-height: 1.2;
            }
            
            .item-date {
                font-size: 10px;
                opacity: 0.6;
            }
            
            .item-shared-badge {
                position: absolute;
                top: 4px;
                right: 4px;
                font-size: 12px;
            }
            
            .list-view {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            
            .list-view .explorer-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px 12px;
                text-align: left;
            }
            
            .list-view .item-icon {
                font-size: 20px;
                margin-bottom: 0;
                width: 24px;
            }
            
            .list-view .item-name {
                flex: 2;
            }
            
            .list-view .item-modified {
                flex: 1;
                font-size: 11px;
                opacity: 0.7;
            }
            
            .details-view {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            
            .details-view .explorer-item {
                display: grid;
                grid-template-columns: 30px 2fr 1.5fr 100px 80px;
                align-items: center;
                gap: 12px;
                padding: 6px 12px;
                text-align: left;
            }
            
            .details-view .item-icon {
                font-size: 18px;
                margin-bottom: 0;
            }
            
            .details-view .item-name,
            .details-view .item-modified,
            .details-view .item-size,
            .details-view .item-type {
                font-size: 12px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .explorer-status {
                padding: 4px 12px;
                background: rgba(0,0,0,0.2);
                border-top: 1px solid var(--mica-border);
                display: flex;
                gap: 20px;
                font-size: 11px;
                opacity: 0.7;
            }
            
            .status-right {
                margin-left: auto;
                display: flex;
                gap: 12px;
            }
            
            .status-item {
                cursor: pointer;
                padding: 2px 6px;
                border-radius: 4px;
            }
            
            .status-item:hover {
                background: rgba(255,255,255,0.1);
            }
            
            /* Properties dialog */
            .properties-modal {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--mica);
                backdrop-filter: var(--glass);
                border: 1px solid var(--mica-border);
                border-radius: 12px;
                padding: 24px;
                min-width: 400px;
                z-index: 10000;
            }
            
            .properties-modal table {
                width: 100%;
                margin: 16px 0;
                border-collapse: collapse;
            }
            
            .properties-modal td {
                padding: 8px;
                border-bottom: 1px solid var(--mica-border);
            }
            
            .properties-modal td:first-child {
                font-weight: 500;
                width: 100px;
            }
            
            /* Light theme */
            .light-theme .file-explorer {
                background: rgba(255,255,255,0.2);
                color: black;
            }
            
            .light-theme .toolbar-btn,
            .light-theme .toolbar-select,
            .light-theme .explorer-search input {
                color: black;
            }
        `;
        
        document.head.appendChild(style);
    }
}

window.FileExplorerApp = FileExplorerApp;
