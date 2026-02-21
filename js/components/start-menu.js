/**
 * BhekOS Start Menu Component - Modern Windows 11 style start menu
 */
const StartMenu = {
    os: null,
    element: null,
    
    // Menu state
    state: {
        open: false,
        currentView: 'main', // main, allApps, search, account
        searchQuery: '',
        pinnedApps: [],
        recentApps: []
    },
    
    async init(os) {
        this.os = os;
        this.element = document.getElementById('startMenu');
        await this.loadPinnedApps();
        await this.loadRecentApps();
        await this.render();
        this.setupEventListeners();
        
        return this;
    },
    
    async loadPinnedApps() {
        const saved = await this.os.modules.Storage.get('pinned_apps', []);
        this.state.pinnedApps = saved;
    },
    
    async savePinnedApps() {
        await this.os.modules.Storage.set('pinned_apps', this.state.pinnedApps);
    },
    
    async loadRecentApps() {
        const apps = this.os.modules.AppStore?.getRecentlyUsedApps(6) || [];
        this.state.recentApps = apps;
    },
    
    async render() {
        const user = this.os.modules.UserManager?.getCurrentUser();
        const apps = this.os.modules.AppStore?.getInstalledApps() || [];
        
        // Filter pinned apps
        const pinned = apps.filter(app => this.state.pinnedApps.includes(app.id));
        const others = apps.filter(app => !this.state.pinnedApps.includes(app.id));
        
        this.element.innerHTML = `
            <div class="start-menu-container">
                <!-- Header with user profile -->
                <div class="start-menu-header">
                    <div class="user-profile" id="userProfile">
                        <div class="user-avatar">
                            ${user?.avatar?.value || '👤'}
                            <span class="user-status ${user?.presence || 'offline'}"></span>
                        </div>
                        <div class="user-info">
                            <h3>${user?.name || 'User'}</h3>
                            <p>${user?.email || 'user@bhekos.local'}</p>
                        </div>
                    </div>
                </div>
                
                <!-- Search bar -->
                <div class="start-menu-search">
                    <span class="search-icon">🔍</span>
                    <input type="text" placeholder="Search apps, files, settings..." 
                           id="startMenuSearch" value="${this.state.searchQuery}">
                </div>
                
                <!-- Main content area -->
                <div class="start-menu-content" id="startMenuContent">
                    ${this.renderContent()}
                </div>
                
                <!-- Footer with power options -->
                <div class="start-menu-footer">
                    <div class="power-options">
                        <button class="power-btn" id="powerBtn" title="Power options">⏻</button>
                        <div class="power-menu" id="powerMenu">
                            <div class="power-menu-item" onclick="StartMenu.sleep()">
                                <span class="power-icon">😴</span> Sleep
                            </div>
                            <div class="power-menu-item" onclick="StartMenu.shutdown()">
                                <span class="power-icon">⏻</span> Shut down
                            </div>
                            <div class="power-menu-item" onclick="StartMenu.restart()">
                                <span class="power-icon">🔄</span> Restart
                            </div>
                        </div>
                    </div>
                    <div class="user-actions">
                        <button onclick="StartMenu.openAccountSettings()" title="Account settings">👤</button>
                        <button onclick="StartMenu.lock()" title="Lock">🔒</button>
                    </div>
                </div>
            </div>
        `;
        
        this.addStyles();
    },
    
    renderContent() {
        switch(this.state.currentView) {
            case 'main':
                return this.renderMainView();
            case 'allApps':
                return this.renderAllAppsView();
            case 'search':
                return this.renderSearchResults();
            case 'account':
                return this.renderAccountView();
            default:
                return this.renderMainView();
        }
    },
    
    renderMainView() {
        const apps = this.os.modules.AppStore?.getInstalledApps() || [];
        const pinned = apps.filter(app => this.state.pinnedApps.includes(app.id));
        const recent = this.state.recentApps;
        
        return `
            <!-- Pinned apps section -->
            <div class="start-menu-section">
                <div class="section-header">
                    <h4>📌 Pinned</h4>
                    <button onclick="StartMenu.showAllApps()">All apps ›</button>
                </div>
                <div class="pinned-apps-grid">
                    ${pinned.slice(0, 18).map(app => `
                        <div class="start-menu-item" onclick="StartMenu.launchApp('${app.id}')">
                            <div class="item-icon">${app.icon}</div>
                            <div class="item-name">${app.name}</div>
                        </div>
                    `).join('')}
                    ${pinned.length === 0 ? `
                        <div class="empty-pinned">Pin your favorite apps here</div>
                    ` : ''}
                </div>
            </div>
            
            <!-- Recommended section -->
            <div class="start-menu-section">
                <div class="section-header">
                    <h4>🕒 Recommended</h4>
                </div>
                <div class="recommended-list">
                    ${recent.map(app => `
                        <div class="recommended-item" onclick="StartMenu.launchApp('${app.id}')">
                            <div class="item-icon">${app.icon}</div>
                            <div class="item-info">
                                <div class="item-name">${app.name}</div>
                                <div class="item-description">Recently used</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },
    
    renderAllAppsView() {
        const apps = this.os.modules.AppStore?.getInstalledApps() || [];
        const grouped = this.groupAppsByLetter(apps);
        const letters = Object.keys(grouped).sort();
        
        return `
            <div class="all-apps-view">
                <div class="view-header">
                    <button class="back-btn" onclick="StartMenu.goBack()">← Back</button>
                    <h4>All Apps</h4>
                </div>
                <div class="alphabet-jump">
                    ${letters.map(l => `<span onclick="StartMenu.jumpToLetter('${l}')">${l}</span>`).join('')}
                </div>
                <div class="all-apps-list">
                    ${letters.map(letter => `
                        <div class="app-group" data-letter="${letter}">
                            <div class="group-letter">${letter}</div>
                            ${grouped[letter].map(app => `
                                <div class="all-apps-item" onclick="StartMenu.launchApp('${app.id}')">
                                    <div class="item-icon">${app.icon}</div>
                                    <div class="item-name">${app.name}</div>
                                    ${this.state.pinnedApps.includes(app.id) ? 
                                        '<button class="pin-btn active" onclick="event.stopPropagation(); StartMenu.togglePin(\'' + app.id + '\')">📌</button>' : 
                                        '<button class="pin-btn" onclick="event.stopPropagation(); StartMenu.togglePin(\'' + app.id + '\')">📍</button>'
                                    }
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },
    
    renderSearchResults() {
        if (!this.state.searchQuery) return this.renderMainView();
        
        const results = this.searchApps(this.state.searchQuery);
        
        return `
            <div class="search-results-view">
                <div class="view-header">
                    <button class="back-btn" onclick="StartMenu.clearSearch()">← Back</button>
                    <h4>Search: "${this.state.searchQuery}"</h4>
                </div>
                <div class="search-results-list">
                    ${results.length > 0 ? results.map(result => `
                        <div class="search-result-item" onclick="StartMenu.launchApp('${result.id}')">
                            <div class="item-icon">${result.icon}</div>
                            <div class="item-info">
                                <div class="item-name">${this.highlightText(result.name, this.state.searchQuery)}</div>
                                <div class="item-description">${result.description || 'App'}</div>
                            </div>
                        </div>
                    `).join('') : `
                        <div class="no-results">
                            <span class="no-results-icon">🔍</span>
                            <p>No results found for "${this.state.searchQuery}"</p>
                        </div>
                    `}
                </div>
            </div>
        `;
    },
    
    renderAccountView() {
        const user = this.os.modules.UserManager?.getCurrentUser();
        
        return `
            <div class="account-view">
                <div class="view-header">
                    <button class="back-btn" onclick="StartMenu.goBack()">← Back</button>
                    <h4>Account</h4>
                </div>
                
                <div class="account-profile">
                    <div class="account-avatar-large">${user?.avatar?.value || '👤'}</div>
                    <div class="account-info">
                        <div class="account-name">${user?.name || 'User'}</div>
                        <div class="account-email">${user?.email || 'user@bhekos.local'}</div>
                    </div>
                </div>
                
                <div class="account-status">
                    <div class="status-option ${user?.presence === 'online' ? 'active' : ''}" 
                         onclick="StartMenu.setStatus('online')">
                        <span class="status-dot online"></span> Online
                    </div>
                    <div class="status-option ${user?.presence === 'away' ? 'active' : ''}" 
                         onclick="StartMenu.setStatus('away')">
                        <span class="status-dot away"></span> Away
                    </div>
                    <div class="status-option ${user?.presence === 'busy' ? 'active' : ''}" 
                         onclick="StartMenu.setStatus('busy')">
                        <span class="status-dot busy"></span> Busy
                    </div>
                    <div class="status-option ${user?.presence === 'offline' ? 'active' : ''}" 
                         onclick="StartMenu.setStatus('offline')">
                        <span class="status-dot offline"></span> Invisible
                    </div>
                </div>
                
                <div class="account-actions">
                    <button onclick="os.launchApp('settings', { page: 'account' })">
                        <span class="action-icon">⚙️</span> Account settings
                    </button>
                    <button onclick="StartMenu.lock()">
                        <span class="action-icon">🔒</span> Lock
                    </button>
                    <button onclick="StartMenu.logout()">
                        <span class="action-icon">🚪</span> Sign out
                    </button>
                </div>
                
                <div class="account-stats">
                    <div class="stat-item">
                        <span class="stat-value">${user?.loginCount || 0}</span>
                        <span class="stat-label">Logins</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${this.getAppCount()}</span>
                        <span class="stat-label">Apps</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${this.getStorageUsed()}</span>
                        <span class="stat-label">Storage</span>
                    </div>
                </div>
            </div>
        `;
    },
    
    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('startMenuSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.state.searchQuery = e.target.value;
                this.state.currentView = 'search';
                this.render();
            });
            
            searchInput.addEventListener('focus', () => {
                if (this.state.searchQuery) {
                    this.state.currentView = 'search';
                    this.render();
                }
            });
        }
        
        // User profile click
        const userProfile = document.getElementById('userProfile');
        if (userProfile) {
            userProfile.addEventListener('click', () => {
                this.state.currentView = 'account';
                this.render();
            });
        }
        
        // Power button
        const powerBtn = document.getElementById('powerBtn');
        if (powerBtn) {
            powerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const menu = document.getElementById('powerMenu');
                menu.classList.toggle('show');
            });
        }
        
        // Close power menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.power-options')) {
                document.getElementById('powerMenu')?.classList.remove('show');
            }
        });
    },
    
    // ==================== NAVIGATION ====================
    
    toggle() {
        if (this.state.open) {
            this.close();
        } else {
            this.open();
        }
    },
    
    open() {
        this.state.open = true;
        this.element.classList.add('open');
        this.loadRecentApps();
        this.render();
        
        // Focus search
        setTimeout(() => {
            document.getElementById('startMenuSearch')?.focus();
        }, 100);
    },
    
    close() {
        this.state.open = false;
        this.element.classList.remove('open');
        this.state.currentView = 'main';
        this.state.searchQuery = '';
    },
    
    showAllApps() {
        this.state.currentView = 'allApps';
        this.render();
    },
    
    goBack() {
        this.state.currentView = 'main';
        this.render();
    },
    
    clearSearch() {
        this.state.searchQuery = '';
        this.state.currentView = 'main';
        this.render();
    },
    
    jumpToLetter(letter) {
        const element = document.querySelector(`[data-letter="${letter}"]`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    },
    
    // ==================== APP ACTIONS ====================
    
    launchApp(appId) {
        this.os.launchApp(appId);
        this.close();
    },
    
    async togglePin(appId) {
        if (this.state.pinnedApps.includes(appId)) {
            this.state.pinnedApps = this.state.pinnedApps.filter(id => id !== appId);
        } else {
            this.state.pinnedApps.push(appId);
        }
        await this.savePinnedApps();
        this.render();
    },
    
    isPinned(appId) {
        return this.state.pinnedApps.includes(appId);
    },
    
    // ==================== USER ACTIONS ====================
    
    setStatus(status) {
        this.os.modules.UserManager?.setPresence(status);
        this.goBack();
    },
    
    lock() {
        this.os.modules.Security?.lock();
        this.close();
    },
    
    logout() {
        this.os.modules.Security?.logout();
        this.close();
    },
    
    sleep() {
        console.log('Sleep mode');
        this.close();
    },
    
    shutdown() {
        this.os.shutdown?.();
        this.close();
    },
    
    restart() {
        this.os.restart?.();
        this.close();
    },
    
    openAccountSettings() {
        this.os.launchApp('settings', { page: 'account' });
        this.close();
    },
    
    // ==================== UTILITY METHODS ====================
    
    groupAppsByLetter(apps) {
        const grouped = {};
        
        apps.forEach(app => {
            const letter = app.name[0].toUpperCase();
            if (!grouped[letter]) {
                grouped[letter] = [];
            }
            grouped[letter].push(app);
        });
        
        return grouped;
    },
    
    searchApps(query) {
        const apps = this.os.modules.AppStore?.getInstalledApps() || [];
        const queryLower = query.toLowerCase();
        
        return apps.filter(app => 
            app.name.toLowerCase().includes(queryLower) ||
            (app.description && app.description.toLowerCase().includes(queryLower))
        );
    },
    
    highlightText(text, query) {
        if (!query) return text;
        
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    },
    
    getAppCount() {
        return this.os.modules.AppStore?.getInstalledApps().length || 0;
    },
    
    getStorageUsed() {
        const info = this.os.modules.Storage?.info();
        return info ? BhekHelpers.formatBytes(info.totalSize) : '0 B';
    },
    
    // ==================== STYLES ====================
    
    addStyles() {
        if (document.getElementById('startmenu-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'startmenu-styles';
        style.textContent = `
            .start-menu {
                position: absolute;
                bottom: var(--taskbar-height);
                left: 0;
                width: 640px;
                height: 720px;
                background: var(--mica);
                backdrop-filter: var(--glass);
                border: 1px solid var(--mica-border);
                border-radius: 12px 12px 0 0;
                display: none;
                flex-direction: column;
                z-index: 9999;
                overflow: hidden;
                box-shadow: 0 -10px 40px rgba(0,0,0,0.4);
            }
            
            .start-menu.open {
                display: flex;
            }
            
            .start-menu-container {
                display: flex;
                flex-direction: column;
                height: 100%;
            }
            
            /* Header */
            .start-menu-header {
                padding: 20px;
                background: linear-gradient(135deg, rgba(var(--accent-rgb),0.2), rgba(0,0,0,0.3));
                border-bottom: 1px solid var(--mica-border);
            }
            
            .user-profile {
                display: flex;
                align-items: center;
                gap: 12px;
                cursor: pointer;
                padding: 8px;
                border-radius: 8px;
                transition: background 0.2s;
            }
            
            .user-profile:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .user-avatar {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: var(--accent);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                position: relative;
            }
            
            .user-status {
                position: absolute;
                bottom: 2px;
                right: 2px;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                border: 2px solid var(--mica);
            }
            
            .user-status.online { background: #4CAF50; }
            .user-status.away { background: #FF9800; }
            .user-status.busy { background: #FF5252; }
            .user-status.offline { background: #9E9E9E; }
            
            .user-info h3 {
                font-size: 16px;
                margin-bottom: 2px;
            }
            
            .user-info p {
                font-size: 12px;
                opacity: 0.7;
            }
            
            /* Search */
            .start-menu-search {
                margin: 16px 20px;
                position: relative;
            }
            
            .start-menu-search input {
                width: 100%;
                padding: 12px 16px 12px 40px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 8px;
                color: white;
                font-size: 14px;
            }
            
            .start-menu-search input:focus {
                outline: none;
                border-color: var(--accent);
            }
            
            .start-menu-search .search-icon {
                position: absolute;
                left: 12px;
                top: 50%;
                transform: translateY(-50%);
                opacity: 0.7;
            }
            
            /* Content */
            .start-menu-content {
                flex: 1;
                overflow-y: auto;
                padding: 0 16px;
            }
            
            .start-menu-section {
                margin-bottom: 24px;
            }
            
            .section-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                padding: 0 4px;
            }
            
            .section-header h4 {
                font-size: 14px;
                opacity: 0.8;
            }
            
            .section-header button {
                background: transparent;
                border: none;
                color: var(--accent);
                font-size: 13px;
                cursor: pointer;
            }
            
            .pinned-apps-grid {
                display: grid;
                grid-template-columns: repeat(6, 1fr);
                gap: 8px;
            }
            
            .start-menu-item {
                padding: 12px 8px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                text-align: center;
                border: 1px solid transparent;
            }
            
            .start-menu-item:hover {
                background: rgba(255,255,255,0.1);
                transform: translateY(-2px);
                border-color: var(--accent);
            }
            
            .start-menu-item .item-icon {
                font-size: 24px;
                margin-bottom: 6px;
            }
            
            .start-menu-item .item-name {
                font-size: 11px;
                line-height: 1.2;
            }
            
            .empty-pinned {
                grid-column: 1 / -1;
                text-align: center;
                padding: 20px;
                opacity: 0.5;
                font-size: 13px;
            }
            
            .recommended-list {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .recommended-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
            }
            
            .recommended-item:hover {
                background: rgba(255,255,255,0.05);
            }
            
            .recommended-item .item-icon {
                font-size: 20px;
            }
            
            .recommended-item .item-info {
                flex: 1;
            }
            
            .recommended-item .item-name {
                font-size: 13px;
                margin-bottom: 2px;
            }
            
            .recommended-item .item-description {
                font-size: 11px;
                opacity: 0.6;
            }
            
            /* All Apps View */
            .all-apps-view {
                height: 100%;
                position: relative;
            }
            
            .view-header {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 0;
                border-bottom: 1px solid var(--mica-border);
                margin-bottom: 16px;
            }
            
            .back-btn {
                background: transparent;
                border: none;
                color: white;
                font-size: 16px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
            }
            
            .back-btn:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .alphabet-jump {
                position: absolute;
                right: 0;
                top: 60px;
                display: flex;
                flex-direction: column;
                font-size: 10px;
                opacity: 0.5;
                z-index: 1;
            }
            
            .alphabet-jump span {
                cursor: pointer;
                padding: 2px;
            }
            
            .alphabet-jump span:hover {
                opacity: 1;
                color: var(--accent);
            }
            
            .all-apps-list {
                max-height: calc(100% - 60px);
                overflow-y: auto;
                padding-right: 20px;
            }
            
            .app-group {
                margin-bottom: 16px;
            }
            
            .group-letter {
                font-size: 18px;
                font-weight: 300;
                margin-bottom: 8px;
                padding-left: 4px;
            }
            
            .all-apps-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                position: relative;
            }
            
            .all-apps-item:hover {
                background: rgba(255,255,255,0.05);
            }
            
            .all-apps-item .item-icon {
                font-size: 18px;
            }
            
            .all-apps-item .item-name {
                flex: 1;
                font-size: 13px;
            }
            
            .pin-btn {
                background: transparent;
                border: none;
                color: white;
                opacity: 0.5;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
            }
            
            .pin-btn:hover {
                opacity: 1;
            }
            
            .pin-btn.active {
                opacity: 1;
                color: var(--accent);
            }
            
            /* Search Results */
            .search-results-list {
                padding: 8px 0;
            }
            
            .search-result-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 12px;
                border-radius: 6px;
                cursor: pointer;
            }
            
            .search-result-item:hover {
                background: rgba(255,255,255,0.05);
            }
            
            .search-result-item mark {
                background: var(--accent);
                color: white;
                padding: 0 2px;
                border-radius: 2px;
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
            
            /* Account View */
            .account-view {
                padding: 8px 0;
            }
            
            .account-profile {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 20px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                margin-bottom: 20px;
            }
            
            .account-avatar-large {
                width: 64px;
                height: 64px;
                border-radius: 50%;
                background: var(--accent);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 32px;
            }
            
            .account-info .account-name {
                font-size: 18px;
                font-weight: 500;
                margin-bottom: 4px;
            }
            
            .account-info .account-email {
                font-size: 13px;
                opacity: 0.7;
            }
            
            .account-status {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 8px;
                margin-bottom: 20px;
            }
            
            .status-option {
                padding: 12px;
                background: rgba(255,255,255,0.05);
                border-radius: 6px;
                text-align: center;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .status-option:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .status-option.active {
                background: rgba(var(--accent-rgb), 0.2);
                border: 1px solid var(--accent);
            }
            
            .status-dot {
                display: inline-block;
                width: 10px;
                height: 10px;
                border-radius: 50%;
                margin-right: 6px;
            }
            
            .status-dot.online { background: #4CAF50; }
            .status-dot.away { background: #FF9800; }
            .status-dot.busy { background: #FF5252; }
            .status-dot.offline { background: #9E9E9E; }
            
            .account-actions {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-bottom: 20px;
            }
            
            .account-actions button {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                background: rgba(255,255,255,0.05);
                border: 1px solid var(--mica-border);
                border-radius: 6px;
                color: white;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .account-actions button:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .action-icon {
                font-size: 16px;
            }
            
            .account-stats {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
                padding: 16px;
                background: rgba(255,255,255,0.03);
                border-radius: 8px;
            }
            
            .stat-item {
                text-align: center;
            }
            
            .stat-value {
                display: block;
                font-size: 18px;
                font-weight: 500;
                margin-bottom: 2px;
            }
            
            .stat-label {
                font-size: 11px;
                opacity: 0.6;
            }
            
            /* Footer */
            .start-menu-footer {
                padding: 16px 20px;
                background: rgba(0,0,0,0.2);
                border-top: 1px solid var(--mica-border);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .power-options {
                position: relative;
            }
            
            .power-btn {
                width: 36px;
                height: 36px;
                border-radius: 6px;
                background: rgba(255,255,255,0.05);
                border: 1px solid var(--mica-border);
                color: white;
                font-size: 18px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .power-btn:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .power-menu {
                position: absolute;
                bottom: 100%;
                left: 0;
                background: var(--mica);
                backdrop-filter: var(--glass);
                border: 1px solid var(--mica-border);
                border-radius: 8px;
                min-width: 150px;
                margin-bottom: 8px;
                display: none;
            }
            
            .power-menu.show {
                display: block;
            }
            
            .power-menu-item {
                padding: 12px 16px;
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
            }
            
            .power-menu-item:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .user-actions {
                display: flex;
                gap: 8px;
            }
            
            .user-actions button {
                width: 36px;
                height: 36px;
                border-radius: 6px;
                background: rgba(255,255,255,0.05);
                border: 1px solid var(--mica-border);
                color: white;
                font-size: 16px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .user-actions button:hover {
                background: rgba(255,255,255,0.1);
            }
            
            /* Light theme */
            .light-theme .start-menu {
                color: black;
                background: var(--mica);
            }
            
            .light-theme .start-menu-search input {
                background: rgba(0,0,0,0.05);
                color: black;
            }
            
            .light-theme .start-menu-item {
                background: rgba(0,0,0,0.02);
                color: black;
            }
            
            .light-theme .start-menu-item:hover {
                background: rgba(0,0,0,0.05);
            }
            
            .light-theme .back-btn {
                color: black;
            }
            
            .light-theme .power-btn {
                color: black;
            }
            
            .light-theme .user-actions button {
                color: black;
            }
        `;
        
        document.head.appendChild(style);
    }
};

window.StartMenu = StartMenu;
