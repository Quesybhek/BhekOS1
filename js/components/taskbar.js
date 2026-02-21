/**
 * BhekOS Taskbar Component - Modern taskbar with system tray
 */
const Taskbar = {
    os: null,
    element: null,
    
    // Running apps
    runningApps: new Map(),
    
    // Taskbar state
    state: {
        expanded: false,
        searchActive: false,
        notifications: []
    },
    
    async init(os) {
        this.os = os;
        this.element = document.getElementById('taskbar');
        await this.render();
        this.setupEventListeners();
        this.startClock();
        
        return this;
    },
    
    async render() {
        const user = this.os.modules.UserManager?.getCurrentUser();
        
        this.element.innerHTML = `
            <!-- Start Button -->
            <div class="start-button" id="startButton" data-tooltip="Start">
                <div class="start-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M4 4H10V10H4V4Z" fill="currentColor"/>
                        <path d="M14 4H20V10H14V4Z" fill="currentColor"/>
                        <path d="M4 14H10V20H4V14Z" fill="currentColor"/>
                        <path d="M14 14H20V20H14V14Z" fill="currentColor"/>
                    </svg>
                </div>
                <span class="start-text">Start</span>
            </div>
            
            <!-- Search / Widgets -->
            <div class="taskbar-search" id="taskbarSearch" data-tooltip="Search (Ctrl+K)">
                <span class="search-icon">🔍</span>
                <span class="search-text">Search</span>
            </div>
            
            <!-- Running Apps -->
            <div class="running-apps" id="runningApps"></div>
            
            <!-- System Tray -->
            <div class="system-tray">
                ${this.renderTrayIcons()}
                <div class="tray-item user-menu" id="userMenu" data-tooltip="User menu">
                    <div class="user-avatar-small">${user?.avatar?.value || '👤'}</div>
                </div>
                <div class="tray-item clock" id="clock" data-tooltip="${new Date().toLocaleDateString()}">00:00</div>
            </div>
            
            <!-- Show Desktop Button -->
            <div class="show-desktop" id="showDesktop" data-tooltip="Show desktop">
                <div class="desktop-line"></div>
            </div>
        `;
        
        this.addStyles();
    },
    
    renderTrayIcons() {
        return `
            <div class="tray-item" id="networkIcon" data-tooltip="Network">📶</div>
            <div class="tray-item" id="volumeIcon" data-tooltip="Volume">🔊</div>
            <div class="tray-item" id="batteryIcon" data-tooltip="Battery">🔋 85%</div>
            <div class="tray-item" id="notificationIcon" data-tooltip="Notifications">🔔</div>
            <div class="tray-item" id="collabIcon" data-tooltip="Collaboration" style="display: none;">👥</div>
        `;
    },
    
    setupEventListeners() {
        // Start button
        document.getElementById('startButton')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.os.modules.StartMenu?.toggle();
        });
        
        // Search
        document.getElementById('taskbarSearch')?.addEventListener('click', () => {
            if (window.SearchOverlay) {
                SearchOverlay.show();
            }
        });
        
        // Show desktop
        document.getElementById('showDesktop')?.addEventListener('click', () => {
            this.os.modules.WindowManager?.minimizeAll();
        });
        
        // User menu
        document.getElementById('userMenu')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showUserMenu();
        });
        
        // Tray icons
        document.getElementById('networkIcon')?.addEventListener('click', () => {
            this.showNetworkMenu();
        });
        
        document.getElementById('volumeIcon')?.addEventListener('click', () => {
            this.showVolumeMenu();
        });
        
        document.getElementById('notificationIcon')?.addEventListener('click', () => {
            this.showNotificationCenter();
        });
        
        document.getElementById('collabIcon')?.addEventListener('click', () => {
            this.os.modules.Collaboration?.showRoomSelector();
        });
        
        // Close menus when clicking elsewhere
        document.addEventListener('click', () => {
            this.closeAllMenus();
        });
    },
    
    startClock() {
        setInterval(() => {
            const clock = document.getElementById('clock');
            if (clock) {
                const now = new Date();
                clock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                clock.setAttribute('data-tooltip', now.toLocaleDateString([], { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                }));
            }
        }, 1000);
    },
    
    // ==================== APP MANAGEMENT ====================
    
    addApp(appId, title, icon) {
        const container = document.getElementById('runningApps');
        if (!container) return;
        
        const item = document.createElement('div');
        item.className = 'running-app-item';
        item.id = `task-${appId}`;
        item.innerHTML = icon;
        item.title = title;
        item.dataset.appId = appId;
        
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            this.os.modules.WindowManager?.toggleWindow(appId);
        });
        
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showAppContextMenu(e, appId, title);
        });
        
        container.appendChild(item);
        this.runningApps.set(appId, item);
    },
    
    removeApp(appId) {
        const item = this.runningApps.get(appId);
        if (item) {
            item.remove();
            this.runningApps.delete(appId);
        }
    },
    
    setActive(appId) {
        this.runningApps.forEach((item, id) => {
            item.classList.toggle('active', id === appId);
        });
    },
    
    setMinimized(appId, minimized) {
        const item = this.runningApps.get(appId);
        if (item) {
            item.classList.toggle('minimized', minimized);
        }
    },
    
    updateAppBadge(appId, count) {
        const item = this.runningApps.get(appId);
        if (!item) return;
        
        let badge = item.querySelector('.app-badge');
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'app-badge';
                item.appendChild(badge);
            }
            badge.textContent = count > 9 ? '9+' : count;
        } else if (badge) {
            badge.remove();
        }
    },
    
    showAppContextMenu(e, appId, title) {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = e.clientX + 'px';
        menu.style.top = (e.clientY - 10) + 'px';
        
        menu.innerHTML = `
            <div class="context-menu-item" onclick="Taskbar.maximizeApp('${appId}')">
                <span class="menu-icon">🗖</span> Maximize
            </div>
            <div class="context-menu-item" onclick="Taskbar.minimizeApp('${appId}')">
                <span class="menu-icon">─</span> Minimize
            </div>
            <div class="context-menu-item" onclick="Taskbar.closeApp('${appId}')">
                <span class="menu-icon">✕</span> Close
            </div>
            <hr>
            <div class="context-menu-item" onclick="Taskbar.pinToTaskbar('${appId}')">
                <span class="menu-icon">📌</span> Pin to taskbar
            </div>
        `;
        
        document.body.appendChild(menu);
        
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }, { once: true });
        }, 10);
    },
    
    maximizeApp(appId) {
        this.os.modules.WindowManager?.maximize(appId);
    },
    
    minimizeApp(appId) {
        this.os.modules.WindowManager?.minimize(appId);
    },
    
    closeApp(appId) {
        this.os.modules.WindowManager?.close(appId);
    },
    
    pinToTaskbar(appId) {
        // Implement pinning
        console.log('Pin to taskbar:', appId);
    },
    
    // ==================== SYSTEM TRAY MENUS ====================
    
    showUserMenu() {
        const user = this.os.modules.UserManager?.getCurrentUser();
        const menu = document.createElement('div');
        menu.className = 'context-menu user-menu';
        
        const startBtn = document.getElementById('userMenu');
        const rect = startBtn.getBoundingClientRect();
        
        menu.style.right = (window.innerWidth - rect.right) + 'px';
        menu.style.bottom = '60px';
        
        menu.innerHTML = `
            <div class="user-menu-header">
                <div class="user-avatar">${user?.avatar?.value || '👤'}</div>
                <div class="user-info">
                    <div class="user-name">${user?.name || 'User'}</div>
                    <div class="user-email">${user?.email || 'user@bhekos.local'}</div>
                </div>
            </div>
            <div class="context-menu-item" onclick="Taskbar.changeUserStatus('online')">
                <span class="status-indicator online"></span> Online
            </div>
            <div class="context-menu-item" onclick="Taskbar.changeUserStatus('away')">
                <span class="status-indicator away"></span> Away
            </div>
            <div class="context-menu-item" onclick="Taskbar.changeUserStatus('busy')">
                <span class="status-indicator busy"></span> Busy
            </div>
            <hr>
            <div class="context-menu-item" onclick="os.launchApp('settings', { page: 'account' })">
                <span class="menu-icon">👤</span> Account settings
            </div>
            <div class="context-menu-item" onclick="os.launchApp('users')">
                <span class="menu-icon">👥</span> Switch user
            </div>
            <hr>
            <div class="context-menu-item" onclick="Taskbar.lock()">
                <span class="menu-icon">🔒</span> Lock
            </div>
            <div class="context-menu-item" onclick="Taskbar.logout()">
                <span class="menu-icon">🚪</span> Log out
            </div>
        `;
        
        document.body.appendChild(menu);
        
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }, { once: true });
        }, 10);
    },
    
    changeUserStatus(status) {
        this.os.modules.UserManager?.setPresence(status);
        document.querySelector('.user-menu')?.remove();
    },
    
    showNetworkMenu() {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        
        const icon = document.getElementById('networkIcon');
        const rect = icon.getBoundingClientRect();
        
        menu.style.right = (window.innerWidth - rect.right) + 'px';
        menu.style.bottom = '60px';
        
        menu.innerHTML = `
            <div class="context-menu-item">
                <span class="menu-icon">📶</span> Wi-Fi: Connected
            </div>
            <div class="context-menu-item">
                <span class="menu-icon">📶</span> Network Name
            </div>
            <hr>
            <div class="context-menu-item" onclick="Taskbar.toggleAirplaneMode()">
                <span class="menu-icon">✈️</span> Airplane mode
            </div>
            <div class="context-menu-item" onclick="os.launchApp('settings', { page: 'network' })">
                <span class="menu-icon">⚙️</span> Network settings
            </div>
        `;
        
        document.body.appendChild(menu);
        
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }, { once: true });
        }, 10);
    },
    
    showVolumeMenu() {
        const menu = document.createElement('div');
        menu.className = 'context-menu volume-menu';
        
        const icon = document.getElementById('volumeIcon');
        const rect = icon.getBoundingClientRect();
        
        menu.style.right = (window.innerWidth - rect.right) + 'px';
        menu.style.bottom = '60px';
        
        menu.innerHTML = `
            <div class="volume-slider-container">
                <input type="range" min="0" max="100" value="50" class="volume-slider" id="volumeSlider">
                <span class="volume-value">50%</span>
            </div>
            <hr>
            <div class="context-menu-item" onclick="Taskbar.toggleMute()">
                <span class="menu-icon">🔇</span> Mute
            </div>
            <div class="context-menu-item" onclick="os.launchApp('settings', { page: 'sound' })">
                <span class="menu-icon">⚙️</span> Sound settings
            </div>
        `;
        
        document.body.appendChild(menu);
        
        const slider = document.getElementById('volumeSlider');
        slider.addEventListener('input', (e) => {
            const value = e.target.value;
            menu.querySelector('.volume-value').textContent = value + '%';
            // Update volume icon based on value
            const icon = document.getElementById('volumeIcon');
            if (value == 0) icon.textContent = '🔇';
            else if (value < 30) icon.textContent = '🔈';
            else if (value < 70) icon.textContent = '🔉';
            else icon.textContent = '🔊';
        });
        
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }, { once: true });
        }, 10);
    },
    
    showNotificationCenter() {
        const notifications = this.state.notifications;
        const menu = document.createElement('div');
        menu.className = 'notification-center';
        
        const icon = document.getElementById('notificationIcon');
        const rect = icon.getBoundingClientRect();
        
        menu.style.right = (window.innerWidth - rect.right) + 'px';
        menu.style.bottom = '60px';
        
        if (notifications.length === 0) {
            menu.innerHTML = `
                <div class="notification-center-header">
                    <h3>Notifications</h3>
                </div>
                <div class="notification-empty">
                    <span class="empty-icon">🔔</span>
                    <p>No new notifications</p>
                </div>
            `;
        } else {
            menu.innerHTML = `
                <div class="notification-center-header">
                    <h3>Notifications</h3>
                    <button onclick="Taskbar.clearAllNotifications()">Clear all</button>
                </div>
                <div class="notification-list">
                    ${notifications.map(n => `
                        <div class="notification-item ${n.read ? '' : 'unread'}">
                            <div class="notification-icon">${n.icon || '📌'}</div>
                            <div class="notification-content">
                                <div class="notification-title">${n.title}</div>
                                <div class="notification-message">${n.message}</div>
                                <div class="notification-time">${BhekHelpers.formatRelativeTime(n.timestamp)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        document.body.appendChild(menu);
        
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }, { once: true });
        }, 10);
    },
    
    addNotification(notification) {
        this.state.notifications.unshift({
            ...notification,
            timestamp: Date.now(),
            read: false
        });
        
        // Update badge
        const unread = this.state.notifications.filter(n => !n.read).length;
        const icon = document.getElementById('notificationIcon');
        if (unread > 0) {
            icon.innerHTML = `🔔 <span class="badge">${unread}</span>`;
        } else {
            icon.textContent = '🔔';
        }
        
        // Show popup
        this.showNotificationPopup(notification);
    },
    
    showNotificationPopup(notification) {
        const popup = document.createElement('div');
        popup.className = 'notification-popup';
        popup.innerHTML = `
            <div class="notification-popup-icon">${notification.icon || '📌'}</div>
            <div class="notification-popup-content">
                <div class="notification-popup-title">${notification.title}</div>
                <div class="notification-popup-message">${notification.message}</div>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        setTimeout(() => {
            popup.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            popup.classList.remove('show');
            setTimeout(() => popup.remove(), 300);
        }, 5000);
    },
    
    clearAllNotifications() {
        this.state.notifications = [];
        document.getElementById('notificationIcon').textContent = '🔔';
        document.querySelector('.notification-center')?.remove();
    },
    
    // ==================== COLLABORATION INDICATORS ====================
    
    showCollaborationIndicator() {
        const icon = document.getElementById('collabIcon');
        if (icon) {
            icon.style.display = 'block';
            
            // Pulse animation when active
            icon.classList.add('active-collab');
            
            // Update tooltip
            const room = this.os.modules.Collaboration?.getCurrentRoom();
            if (room) {
                icon.setAttribute('data-tooltip', `In room: ${room.name} (${room.participants.size} users)`);
            }
        }
    },
    
    hideCollaborationIndicator() {
        const icon = document.getElementById('collabIcon');
        if (icon) {
            icon.style.display = 'none';
            icon.classList.remove('active-collab');
        }
    },
    
    // ==================== SYSTEM ACTIONS ====================
    
    lock() {
        this.os.modules.Security?.lock();
        document.querySelector('.user-menu')?.remove();
    },
    
    logout() {
        this.os.modules.Security?.logout();
        document.querySelector('.user-menu')?.remove();
    },
    
    toggleAirplaneMode() {
        console.log('Toggle airplane mode');
    },
    
    toggleMute() {
        const icon = document.getElementById('volumeIcon');
        if (icon.textContent === '🔇') {
            icon.textContent = '🔊';
        } else {
            icon.textContent = '🔇';
        }
    },
    
    closeAllMenus() {
        document.querySelectorAll('.context-menu, .notification-center').forEach(menu => {
            menu.remove();
        });
    },
    
    // ==================== STYLES ====================
    
    addStyles() {
        if (document.getElementById('taskbar-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'taskbar-styles';
        style.textContent = `
            .taskbar {
                position: absolute;
                bottom: 0;
                left: 0;
                width: 100%;
                height: var(--taskbar-height);
                background: var(--mica);
                backdrop-filter: var(--glass);
                border-top: 1px solid var(--mica-border);
                display: flex;
                align-items: center;
                padding: 0 8px;
                gap: 8px;
                z-index: 1000;
            }
            
            .start-button {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 12px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
                background: rgba(255,255,255,0.05);
                height: 36px;
            }
            
            .start-button:hover {
                background: rgba(255,255,255,0.1);
                transform: translateY(-1px);
            }
            
            .start-button.active {
                background: rgba(var(--accent-rgb), 0.3);
            }
            
            .start-icon {
                color: var(--accent);
            }
            
            .taskbar-search {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 12px;
                border-radius: 20px;
                background: rgba(255,255,255,0.05);
                cursor: pointer;
                width: 200px;
                transition: all 0.2s;
                height: 36px;
            }
            
            .taskbar-search:hover {
                background: rgba(255,255,255,0.1);
                width: 220px;
            }
            
            .running-apps {
                display: flex;
                gap: 2px;
                flex: 1;
                justify-content: center;
                height: 100%;
                align-items: center;
            }
            
            .running-app-item {
                width: 40px;
                height: 40px;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                cursor: pointer;
                transition: all 0.2s;
                position: relative;
            }
            
            .running-app-item:hover {
                background: rgba(255,255,255,0.1);
                transform: translateY(-2px);
            }
            
            .running-app-item.active {
                background: rgba(255,255,255,0.15);
            }
            
            .running-app-item.active::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 50%;
                transform: translateX(-50%);
                width: 20px;
                height: 2px;
                background: var(--accent);
                border-radius: 1px;
            }
            
            .running-app-item.minimized {
                opacity: 0.5;
            }
            
            .app-badge {
                position: absolute;
                top: 2px;
                right: 2px;
                min-width: 16px;
                height: 16px;
                background: #ff5252;
                border-radius: 8px;
                font-size: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 4px;
                border: 1px solid var(--mica);
            }
            
            .system-tray {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 0 8px;
                border-left: 1px solid var(--mica-border);
                height: 100%;
            }
            
            .tray-item {
                padding: 6px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.2s;
                min-width: 32px;
                text-align: center;
                position: relative;
            }
            
            .tray-item:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .tray-item .badge {
                position: absolute;
                top: 0;
                right: 0;
                background: #ff5252;
                color: white;
                font-size: 10px;
                min-width: 16px;
                height: 16px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .user-avatar-small {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: var(--accent);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: bold;
            }
            
            .show-desktop {
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                border-radius: 4px;
                transition: background 0.2s;
                margin-left: 4px;
            }
            
            .show-desktop:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .desktop-line {
                width: 16px;
                height: 2px;
                background: rgba(255,255,255,0.5);
                border-radius: 1px;
                transition: width 0.2s;
            }
            
            .show-desktop:hover .desktop-line {
                width: 20px;
            }
            
            /* User Menu */
            .user-menu-header {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 16px;
                border-bottom: 1px solid var(--mica-border);
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
            }
            
            .user-info .user-name {
                font-weight: 500;
                margin-bottom: 4px;
            }
            
            .user-info .user-email {
                font-size: 11px;
                opacity: 0.7;
            }
            
            .status-indicator {
                display: inline-block;
                width: 10px;
                height: 10px;
                border-radius: 50%;
                margin-right: 8px;
            }
            
            .status-indicator.online { background: #4CAF50; }
            .status-indicator.away { background: #FF9800; }
            .status-indicator.busy { background: #FF5252; }
            
            /* Volume Menu */
            .volume-slider-container {
                padding: 16px;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .volume-slider {
                flex: 1;
                height: 4px;
                -webkit-appearance: none;
                background: rgba(255,255,255,0.2);
                border-radius: 2px;
                outline: none;
            }
            
            .volume-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: var(--accent);
                cursor: pointer;
            }
            
            .volume-value {
                min-width: 40px;
                text-align: right;
                font-size: 12px;
            }
            
            /* Notification Center */
            .notification-center {
                position: absolute;
                width: 320px;
                max-height: 400px;
                background: var(--mica);
                backdrop-filter: var(--glass);
                border: 1px solid var(--mica-border);
                border-radius: 8px;
                overflow: hidden;
                z-index: 10000;
            }
            
            .notification-center-header {
                padding: 12px 16px;
                border-bottom: 1px solid var(--mica-border);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .notification-center-header button {
                background: transparent;
                border: none;
                color: var(--accent);
                cursor: pointer;
                font-size: 12px;
            }
            
            .notification-list {
                max-height: 340px;
                overflow-y: auto;
            }
            
            .notification-item {
                display: flex;
                gap: 12px;
                padding: 12px 16px;
                border-bottom: 1px solid var(--mica-border);
                transition: background 0.2s;
            }
            
            .notification-item:hover {
                background: rgba(255,255,255,0.05);
            }
            
            .notification-item.unread {
                background: rgba(var(--accent-rgb), 0.1);
            }
            
            .notification-icon {
                font-size: 20px;
            }
            
            .notification-content {
                flex: 1;
            }
            
            .notification-title {
                font-weight: 500;
                margin-bottom: 4px;
                font-size: 13px;
            }
            
            .notification-message {
                font-size: 12px;
                opacity: 0.8;
                margin-bottom: 4px;
            }
            
            .notification-time {
                font-size: 10px;
                opacity: 0.5;
            }
            
            .notification-empty {
                padding: 40px 20px;
                text-align: center;
                opacity: 0.5;
            }
            
            .notification-empty .empty-icon {
                font-size: 32px;
                display: block;
                margin-bottom: 12px;
            }
            
            /* Notification Popup */
            .notification-popup {
                position: fixed;
                bottom: 80px;
                right: 20px;
                width: 300px;
                background: var(--mica);
                backdrop-filter: var(--glass);
                border: 1px solid var(--accent);
                border-radius: 8px;
                padding: 12px;
                display: flex;
                gap: 12px;
                transform: translateX(120%);
                transition: transform 0.3s;
                z-index: 10001;
                box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            }
            
            .notification-popup.show {
                transform: translateX(0);
            }
            
            .notification-popup-icon {
                font-size: 24px;
            }
            
            .notification-popup-title {
                font-weight: 500;
                margin-bottom: 4px;
            }
            
            .notification-popup-message {
                font-size: 12px;
                opacity: 0.9;
            }
            
            /* Collaboration Indicator */
            .active-collab {
                animation: pulse 2s infinite;
                color: #4CAF50;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            /* Tooltips */
            [data-tooltip] {
                position: relative;
            }
            
            [data-tooltip]:hover::after {
                content: attr(data-tooltip);
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
                white-space: nowrap;
                z-index: 10002;
                margin-bottom: 8px;
            }
            
            /* Light theme */
            .light-theme .taskbar {
                background: rgba(240,240,240,0.85);
                border-top-color: rgba(0,0,0,0.1);
            }
            
            .light-theme .start-button {
                background: rgba(0,0,0,0.05);
                color: black;
            }
            
            .light-theme .taskbar-search {
                background: rgba(0,0,0,0.05);
                color: black;
            }
            
            .light-theme .running-app-item {
                color: black;
            }
            
            .light-theme .tray-item {
                color: black;
            }
            
            .light-theme .system-tray {
                border-left-color: rgba(0,0,0,0.1);
            }
            
            .light-theme .desktop-line {
                background: rgba(0,0,0,0.3);
            }
        `;
        
        document.head.appendChild(style);
    }
};

window.Taskbar = Taskbar;
