/**
 * BhekOS User Switcher Component - Quick user switching interface
 */
const UserSwitcher = {
    os: null,
    element: null,
    
    async init(os) {
        this.os = os;
        this.createSwitcher();
        this.setupEventListeners();
        
        return this;
    },
    
    createSwitcher() {
        this.element = document.createElement('div');
        this.element.className = 'user-switcher';
        this.element.id = 'userSwitcher';
        this.element.innerHTML = this.render();
        document.body.appendChild(this.element);
        this.addStyles();
    },
    
    render() {
        const currentUser = this.os.modules.UserManager?.getCurrentUser();
        const users = this.os.modules.UserManager?.getAllUsers() || [];
        const otherUsers = users.filter(u => u.id !== currentUser?.id);
        
        return `
            <div class="user-switcher-container">
                <div class="user-switcher-header">
                    <h3>Switch User</h3>
                    <button class="close-btn" onclick="UserSwitcher.hide()">✕</button>
                </div>
                
                <div class="current-user-section">
                    <div class="current-user-card">
                        <div class="user-avatar large">${currentUser?.avatar?.value || '👤'}</div>
                        <div class="user-details">
                            <div class="user-name">${currentUser?.name || 'Current User'}</div>
                            <div class="user-username">@${currentUser?.username || 'user'}</div>
                            <div class="user-status ${currentUser?.presence || 'online'}">
                                <span class="status-dot"></span>
                                ${currentUser?.presence || 'Online'}
                            </div>
                        </div>
                        <button class="lock-btn" onclick="UserSwitcher.lock()">Lock</button>
                    </div>
                </div>
                
                <div class="other-users-section">
                    <h4>Other Users</h4>
                    <div class="users-list">
                        ${otherUsers.length > 0 ? otherUsers.map(user => `
                            <div class="user-card" data-userid="${user.id}" onclick="UserSwitcher.switchToUser('${user.id}')">
                                <div class="user-avatar">${user.avatar?.value || '👤'}</div>
                                <div class="user-info">
                                    <div class="user-name">${user.name}</div>
                                    <div class="user-username">@${user.username}</div>
                                </div>
                                <div class="user-status-indicator ${user.presence || 'offline'}"></div>
                            </div>
                        `).join('') : `
                            <div class="no-users">No other users available</div>
                        `}
                    </div>
                </div>
                
                <div class="user-switcher-footer">
                    <button class="add-user-btn" onclick="UserSwitcher.addUser()">
                        <span class="btn-icon">➕</span> Add new user
                    </button>
                    <button class="sign-out-btn" onclick="UserSwitcher.signOut()">
                        <span class="btn-icon">🚪</span> Sign out
                    </button>
                </div>
            </div>
        `;
    },
    
    setupEventListeners() {
        // Listen for user changes
        this.os.modules.EventBus.on('user:login', () => this.refresh());
        this.os.modules.EventBus.on('user:logout', () => this.refresh());
        this.os.modules.EventBus.on('user:updated', () => this.refresh());
    },
    
    show() {
        this.refresh();
        this.element.classList.add('visible');
    },
    
    hide() {
        this.element.classList.remove('visible');
    },
    
    toggle() {
        if (this.element.classList.contains('visible')) {
            this.hide();
        } else {
            this.show();
        }
    },
    
    refresh() {
        this.element.innerHTML = this.render();
    },
    
    async switchToUser(userId) {
        const user = this.os.modules.UserManager?.getUser(userId);
        if (!user) return;
        
        // Show login prompt for the selected user
        this.hide();
        
        const password = await PasswordPrompt.show({
            title: `Switch to ${user.name}`,
            message: `Enter password for ${user.username}`,
            appName: 'User Switcher'
        });
        
        try {
            await this.os.modules.Security?.login(user.username, password);
        } catch (error) {
            this.os.notify('Login Failed', error.message, 'error');
        }
    },
    
    lock() {
        this.hide();
        this.os.modules.Security?.lock();
    },
    
    signOut() {
        this.hide();
        this.os.modules.Security?.logout();
    },
    
    addUser() {
        this.hide();
        this.os.launchApp('users', { action: 'add' });
    },
    
    // ==================== STYLES ====================
    
    addStyles() {
        if (document.getElementById('user-switcher-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'user-switcher-styles';
        style.textContent = `
            .user-switcher {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.5);
                backdrop-filter: blur(5px);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 100000;
            }
            
            .user-switcher.visible {
                display: flex;
            }
            
            .user-switcher-container {
                width: 500px;
                max-width: 90vw;
                max-height: 80vh;
                background: var(--mica);
                backdrop-filter: var(--glass);
                border: 1px solid var(--mica-border);
                border-radius: 12px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                animation: scaleIn 0.3s;
            }
            
            @keyframes scaleIn {
                from {
                    opacity: 0;
                    transform: scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }
            
            .user-switcher-header {
                padding: 16px 20px;
                border-bottom: 1px solid var(--mica-border);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .user-switcher-header h3 {
                font-size: 18px;
                font-weight: 500;
            }
            
            .close-btn {
                background: transparent;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                width: 32px;
                height: 32px;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .close-btn:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .current-user-section {
                padding: 20px;
                border-bottom: 1px solid var(--mica-border);
            }
            
            .current-user-card {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
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
            
            .user-avatar.large {
                width: 64px;
                height: 64px;
                font-size: 32px;
            }
            
            .user-details {
                flex: 1;
            }
            
            .user-name {
                font-size: 16px;
                font-weight: 500;
                margin-bottom: 2px;
            }
            
            .user-username {
                font-size: 13px;
                opacity: 0.7;
                margin-bottom: 4px;
            }
            
            .user-status {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
            }
            
            .user-status.online .status-dot { background: #4CAF50; }
            .user-status.away .status-dot { background: #FF9800; }
            .user-status.busy .status-dot { background: #FF5252; }
            
            .status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                display: inline-block;
            }
            
            .lock-btn {
                padding: 8px 16px;
                background: transparent;
                border: 1px solid var(--mica-border);
                border-radius: 6px;
                color: white;
                cursor: pointer;
                transition: 0.2s;
            }
            
            .lock-btn:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .other-users-section {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
            }
            
            .other-users-section h4 {
                font-size: 14px;
                margin-bottom: 12px;
                opacity: 0.8;
            }
            
            .users-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .user-card {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                background: rgba(255,255,255,0.03);
                border-radius: 6px;
                cursor: pointer;
                transition: 0.2s;
                position: relative;
            }
            
            .user-card:hover {
                background: rgba(255,255,255,0.08);
            }
            
            .user-card .user-avatar {
                width: 40px;
                height: 40px;
                font-size: 20px;
            }
            
            .user-info {
                flex: 1;
            }
            
            .user-info .user-name {
                font-size: 14px;
                margin-bottom: 2px;
            }
            
            .user-info .user-username {
                font-size: 12px;
            }
            
            .user-status-indicator {
                width: 10px;
                height: 10px;
                border-radius: 50%;
            }
            
            .user-status-indicator.online { background: #4CAF50; }
            .user-status-indicator.away { background: #FF9800; }
            .user-status-indicator.busy { background: #FF5252; }
            .user-status-indicator.offline { background: #9E9E9E; }
            
            .no-users {
                text-align: center;
                padding: 20px;
                opacity: 0.5;
                font-size: 13px;
            }
            
            .user-switcher-footer {
                padding: 16px 20px;
                border-top: 1px solid var(--mica-border);
                display: flex;
                gap: 10px;
            }
            
            .add-user-btn,
            .sign-out-btn {
                flex: 1;
                padding: 10px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                font-size: 13px;
                transition: 0.2s;
            }
            
            .add-user-btn {
                background: transparent;
                border: 1px solid var(--mica-border);
                color: white;
            }
            
            .add-user-btn:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .sign-out-btn {
                background: #ff5252;
                color: white;
            }
            
            .sign-out-btn:hover {
                background: #ff6b6b;
                transform: translateY(-1px);
            }
            
            .btn-icon {
                font-size: 16px;
            }
            
            /* Light theme */
            .light-theme .user-switcher {
                color: black;
            }
            
            .light-theme .close-btn {
                color: black;
            }
            
            .light-theme .add-user-btn {
                color: black;
            }
        `;
        
        document.head.appendChild(style);
    }
};

window.UserSwitcher = UserSwitcher;
