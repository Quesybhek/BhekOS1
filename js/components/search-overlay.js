/**
 * BhekOS Search Overlay - Global search interface
 */
const SearchOverlay = {
    os: null,
    element: null,
    visible: false,
    
    // Search state
    state: {
        query: '',
        filter: 'all',
        results: [],
        selectedIndex: 0,
        recentSearches: []
    },
    
    async init(os) {
        this.os = os;
        this.createOverlay();
        this.loadRecentSearches();
        this.setupShortcuts();
        
        return this;
    },
    
    createOverlay() {
        this.element = document.createElement('div');
        this.element.className = 'search-overlay';
        this.element.id = 'search-overlay';
        this.element.innerHTML = `
            <div class="search-container">
                <div class="search-header">
                    <span class="search-icon">🔍</span>
                    <input type="text" class="search-input" id="global-search-input" 
                           placeholder="Search files, apps, settings, users..." autocomplete="off">
                    <button class="search-close" onclick="SearchOverlay.hide()">✕</button>
                </div>
                
                <div class="search-filters">
                    <button class="filter-btn active" data-filter="all">All</button>
                    <button class="filter-btn" data-filter="files">Files</button>
                    <button class="filter-btn" data-filter="apps">Apps</button>
                    <button class="filter-btn" data-filter="settings">Settings</button>
                    <button class="filter-btn" data-filter="users">Users</button>
                    <button class="filter-btn" data-filter="recent">Recent</button>
                </div>
                
                <div class="search-results" id="search-results"></div>
                
                <div class="search-footer">
                    <span>↑↓ to navigate</span>
                    <span>↵ to open</span>
                    <span>esc to close</span>
                    <span class="search-time" id="search-time"></span>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.element);
        this.addStyles();
        this.setupListeners();
    },
    
    setupListeners() {
        const input = document.getElementById('global-search-input');
        
        input.addEventListener('input', this.debounce(async (e) => {
            const query = e.target.value;
            this.state.query = query;
            
            if (query.length >= 2) {
                await this.performSearch(query);
            } else {
                this.showRecent();
            }
        }, 300));
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateResults('down');
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateResults('up');
            } else if (e.key === 'Enter') {
                e.preventDefault();
                this.openSelected();
            }
        });
        
        // Filter buttons
        this.element.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.element.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                this.state.filter = e.target.dataset.filter;
                const query = input.value;
                
                if (query.length >= 2) {
                    this.performSearch(query);
                } else {
                    this.showRecent();
                }
            });
        });
    },
    
    setupShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.show();
            }
            
            if (e.key === 'Escape' && this.visible) {
                this.hide();
            }
        });
    },
    
    // ==================== SEARCH OPERATIONS ====================
    
    async performSearch(query) {
        const startTime = performance.now();
        let results = [];
        
        switch(this.state.filter) {
            case 'files':
                results = await this.searchFiles(query);
                break;
            case 'apps':
                results = this.searchApps(query);
                break;
            case 'settings':
                results = this.searchSettings(query);
                break;
            case 'users':
                results = this.searchUsers(query);
                break;
            default:
                results = await this.searchAll(query);
        }
        
        this.state.results = results;
        this.renderResults(results, query);
        
        const endTime = performance.now();
        document.getElementById('search-time').textContent = `${(endTime - startTime).toFixed(0)}ms`;
    },
    
    async searchFiles(query) {
        if (this.os.modules.FileSearch) {
            return await this.os.modules.FileSearch.search(query, {
                maxResults: 20,
                fuzzy: true
            });
        }
        return [];
    },
    
    searchApps(query) {
        const apps = this.os.modules.AppStore?.getInstalledApps() || [];
        const queryLower = query.toLowerCase();
        
        return apps
            .filter(app => 
                app.name.toLowerCase().includes(queryLower) ||
                (app.description && app.description.toLowerCase().includes(queryLower))
            )
            .map(app => ({
                ...app,
                type: 'app',
                score: 100,
                icon: app.icon
            }));
    },
    
    searchSettings(query) {
        const settings = this.os.modules.Settings?.categories || [];
        const queryLower = query.toLowerCase();
        
        return settings
            .filter(cat => cat.name.toLowerCase().includes(queryLower))
            .map(cat => ({
                id: cat.id,
                name: cat.name,
                icon: cat.icon,
                type: 'setting',
                path: cat.id,
                score: 80
            }));
    },
    
    searchUsers(query) {
        const users = this.os.modules.UserManager?.getAllUsers() || [];
        const queryLower = query.toLowerCase();
        
        return users
            .filter(user => 
                user.name.toLowerCase().includes(queryLower) ||
                user.username.toLowerCase().includes(queryLower) ||
                (user.email && user.email.toLowerCase().includes(queryLower))
            )
            .map(user => ({
                id: user.id,
                name: user.name,
                username: user.username,
                email: user.email,
                icon: user.avatar?.value || '👤',
                type: 'user',
                score: 90
            }));
    },
    
    async searchAll(query) {
        const [files, apps, settings, users] = await Promise.all([
            this.searchFiles(query),
            this.searchApps(query),
            this.searchSettings(query),
            this.searchUsers(query)
        ]);
        
        return [...files, ...apps, ...settings, ...users]
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, 20);
    },
    
    async showRecent() {
        const recent = this.state.recentSearches.slice(0, 5);
        const recentFiles = await this.os.modules.FileSearch?.searchRecent(1) || [];
        const recentApps = this.os.modules.AppStore?.getRecentlyUsedApps(5) || [];
        
        const results = [
            ...recent.map(q => ({
                type: 'recent',
                name: q,
                icon: '🕒',
                query: q
            })),
            ...recentFiles.map(f => ({ ...f, type: 'file' })),
            ...recentApps.map(a => ({ ...a, type: 'app' }))
        ];
        
        this.state.results = results;
        this.renderRecent(results);
    },
    
    // ==================== RENDERING ====================
    
    renderResults(items, query) {
        const resultsEl = document.getElementById('search-results');
        
        if (items.length === 0) {
            resultsEl.innerHTML = `
                <div class="no-results">
                    <span class="no-results-icon">🔍</span>
                    <span>No results found for "${query}"</span>
                    <span class="no-results-hint">Try different keywords or check spelling</span>
                </div>
            `;
            return;
        }
        
        let html = '';
        let currentType = '';
        
        items.forEach((item, index) => {
            const typeLabel = this.getTypeLabel(item.type);
            
            if (typeLabel !== currentType) {
                currentType = typeLabel;
                html += `<div class="result-category">${typeLabel}</div>`;
            }
            
            html += `
                <div class="result-item" data-index="${index}" data-type="${item.type}" data-id="${item.id || item.path || item.query}">
                    <div class="result-icon">${item.icon || this.getIcon(item)}</div>
                    <div class="result-info">
                        <div class="result-name">${this.highlightText(item.name || item.username || item, query)}</div>
                        <div class="result-path">${item.path || item.description || item.email || ''}</div>
                    </div>
                    ${item.score ? `<div class="result-score">${Math.round(item.score)}%</div>` : ''}
                </div>
            `;
        });
        
        resultsEl.innerHTML = html;
        this.state.selectedIndex = 0;
        this.updateSelection();
    },
    
    renderRecent(items) {
        const resultsEl = document.getElementById('search-results');
        
        if (items.length === 0) {
            resultsEl.innerHTML = `
                <div class="no-results">
                    <span class="no-results-icon">📁</span>
                    <span>No recent items</span>
                </div>
            `;
            return;
        }
        
        let html = '<div class="result-category">Recent</div>';
        
        items.forEach((item, index) => {
            html += `
                <div class="result-item" data-index="${index}" data-type="${item.type}" data-id="${item.id || item.path || item.query}">
                    <div class="result-icon">${item.icon || this.getIcon(item)}</div>
                    <div class="result-info">
                        <div class="result-name">${item.name || item.query || item}</div>
                        <div class="result-path">${item.path || 'Recently accessed'}</div>
                    </div>
                    ${item.modified ? `<div class="result-time">${BhekHelpers.formatRelativeTime(item.modified)}</div>` : ''}
                </div>
            `;
        });
        
        resultsEl.innerHTML = html;
        this.state.selectedIndex = 0;
        this.updateSelection();
    },
    
    // ==================== NAVIGATION ====================
    
    navigateResults(direction) {
        const items = this.element.querySelectorAll('.result-item');
        if (items.length === 0) return;
        
        if (direction === 'down') {
            this.state.selectedIndex = (this.state.selectedIndex + 1) % items.length;
        } else {
            this.state.selectedIndex = (this.state.selectedIndex - 1 + items.length) % items.length;
        }
        
        this.updateSelection();
    },
    
    updateSelection() {
        const items = this.element.querySelectorAll('.result-item');
        items.forEach((item, i) => {
            item.classList.toggle('selected', i === this.state.selectedIndex);
        });
        
        const selected = items[this.state.selectedIndex];
        if (selected) {
            selected.scrollIntoView({ block: 'nearest' });
        }
    },
    
    async openSelected() {
        const selected = this.element.querySelector('.result-item.selected');
        if (!selected) return;
        
        const type = selected.dataset.type;
        const id = selected.dataset.id;
        
        // Add to recent searches
        if (this.state.query) {
            this.addRecentSearch(this.state.query);
        }
        
        this.hide();
        
        switch(type) {
            case 'file':
            case 'folder':
                await this.os.modules.FileSystem?.openFile(id);
                break;
            case 'app':
                await this.os.launchApp(id);
                break;
            case 'setting':
                await this.os.launchApp('settings', { page: id });
                break;
            case 'user':
                await this.os.launchApp('users', { userId: id });
                break;
            case 'recent':
                document.getElementById('global-search-input').value = id;
                await this.performSearch(id);
                break;
        }
    },
    
    // ==================== RECENT SEARCHES ====================
    
    addRecentSearch(query) {
        if (!query) return;
        
        this.state.recentSearches = [
            query,
            ...this.state.recentSearches.filter(q => q !== query)
        ].slice(0, 10);
        
        this.saveRecentSearches();
    },
    
    loadRecentSearches() {
        const saved = this.os.modules.Storage?.get('recent_searches', []);
        this.state.recentSearches = saved || [];
    },
    
    saveRecentSearches() {
        this.os.modules.Storage?.set('recent_searches', this.state.recentSearches);
    },
    
    // ==================== UI CONTROL ====================
    
    show() {
        this.visible = true;
        this.element.classList.add('visible');
        document.getElementById('global-search-input').focus();
        this.showRecent();
    },
    
    hide() {
        this.visible = false;
        this.element.classList.remove('visible');
        this.state.query = '';
        this.state.filter = 'all';
    },
    
    // ==================== UTILITY METHODS ====================
    
    getTypeLabel(type) {
        const labels = {
            'file': '📄 Files',
            'folder': '📁 Folders',
            'app': '📱 Apps',
            'setting': '⚙️ Settings',
            'user': '👤 Users',
            'recent': '🕒 Recent Searches'
        };
        return labels[type] || '📄 Items';
    },
    
    getIcon(item) {
        if (item.type === 'folder') return '📁';
        if (item.type === 'file') return item.extension ? this.getFileIcon(item.extension) : '📄';
        if (item.type === 'app') return '📱';
        if (item.type === 'setting') return '⚙️';
        if (item.type === 'user') return '👤';
        if (item.type === 'recent') return '🕒';
        return '📄';
    },
    
    getFileIcon(ext) {
        const icons = {
            'txt': '📄', 'pdf': '📕', 'jpg': '🖼️', 'png': '🖼️',
            'mp3': '🎵', 'mp4': '🎬', 'js': '📜', 'html': '🌐',
            'css': '🎨', 'json': '⚙️', 'doc': '📘', 'xls': '📊'
        };
        return icons[ext] || '📄';
    },
    
    highlightText(text, query) {
        if (!query || !text) return text;
        
        const regex = new RegExp(`(${query})`, 'gi');
        return String(text).replace(regex, '<mark>$1</mark>');
    },
    
    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },
    
    // ==================== STYLES ====================
    
    addStyles() {
        if (document.getElementById('search-overlay-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'search-overlay-styles';
        style.textContent = `
            .search-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.5);
                backdrop-filter: blur(5px);
                display: none;
                align-items: flex-start;
                justify-content: center;
                z-index: 100000;
                padding-top: 20vh;
            }
            
            .search-overlay.visible {
                display: flex;
            }
            
            .search-container {
                width: 600px;
                max-width: 90vw;
                background: var(--mica);
                backdrop-filter: var(--glass);
                border: 1px solid var(--mica-border);
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 25px 50px rgba(0,0,0,0.5);
                animation: slideDown 0.3s;
            }
            
            @keyframes slideDown {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .search-header {
                display: flex;
                align-items: center;
                padding: 16px;
                border-bottom: 1px solid var(--mica-border);
            }
            
            .search-icon {
                font-size: 18px;
                margin-right: 12px;
                opacity: 0.7;
            }
            
            .search-input {
                flex: 1;
                background: transparent;
                border: none;
                color: white;
                font-size: 16px;
                outline: none;
            }
            
            .search-input::placeholder {
                color: rgba(255,255,255,0.5);
            }
            
            .search-close {
                background: transparent;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
            }
            
            .search-close:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .search-filters {
                display: flex;
                gap: 4px;
                padding: 12px 16px;
                border-bottom: 1px solid var(--mica-border);
                flex-wrap: wrap;
            }
            
            .filter-btn {
                padding: 4px 12px;
                background: transparent;
                border: 1px solid var(--mica-border);
                border-radius: 16px;
                color: white;
                font-size: 12px;
                cursor: pointer;
                transition: 0.2s;
            }
            
            .filter-btn:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .filter-btn.active {
                background: var(--accent);
                border-color: var(--accent);
            }
            
            .search-results {
                max-height: 400px;
                overflow-y: auto;
                padding: 8px;
            }
            
            .result-category {
                padding: 8px 12px;
                font-size: 11px;
                opacity: 0.7;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .result-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 12px;
                border-radius: 6px;
                cursor: pointer;
                transition: 0.2s;
            }
            
            .result-item:hover,
            .result-item.selected {
                background: rgba(255,255,255,0.1);
            }
            
            .result-icon {
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                background: rgba(255,255,255,0.05);
                border-radius: 6px;
                flex-shrink: 0;
            }
            
            .result-info {
                flex: 1;
                min-width: 0;
            }
            
            .result-name {
                font-size: 14px;
                margin-bottom: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .result-name mark {
                background: var(--accent);
                color: white;
                padding: 0 2px;
                border-radius: 2px;
            }
            
            .result-path {
                font-size: 11px;
                opacity: 0.5;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .result-score {
                font-size: 11px;
                opacity: 0.5;
                min-width: 40px;
                text-align: right;
            }
            
            .result-time {
                font-size: 11px;
                opacity: 0.5;
                white-space: nowrap;
            }
            
            .no-results {
                text-align: center;
                padding: 40px 20px;
                opacity: 0.7;
            }
            
            .no-results-icon {
                font-size: 32px;
                display: block;
                margin-bottom: 12px;
            }
            
            .no-results-hint {
                display: block;
                font-size: 12px;
                margin-top: 8px;
                opacity: 0.5;
            }
            
            .search-footer {
                padding: 12px 16px;
                border-top: 1px solid var(--mica-border);
                display: flex;
                gap: 20px;
                font-size: 11px;
                opacity: 0.5;
            }
            
            .search-time {
                margin-left: auto;
            }
            
            /* Light theme */
            .light-theme .search-overlay {
                color: black;
            }
            
            .light-theme .search-input {
                color: black;
            }
            
            .light-theme .search-input::placeholder {
                color: rgba(0,0,0,0.3);
            }
            
            .light-theme .filter-btn {
                color: black;
            }
            
            .light-theme .search-close {
                color: black;
            }
            
            .light-theme .result-item:hover,
            .light-theme .result-item.selected {
                background: rgba(0,0,0,0.05);
            }
        `;
        
        document.head.appendChild(style);
    }
};

window.SearchOverlay = SearchOverlay;
