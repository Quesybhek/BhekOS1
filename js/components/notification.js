/**
 * BhekOS Notification Component - System notifications
 */
const Notification = {
    os: null,
    container: null,
    
    // Notification settings
    settings: {
        maxNotifications: 5,
        defaultTimeout: 5000,
        position: 'top-right',
        showIcons: true,
        playSounds: true
    },
    
    // Active notifications
    notifications: [],
    
    async init(os) {
        this.os = os;
        this.createContainer();
        this.loadSettings();
        
        return this;
    },
    
    createContainer() {
        this.container = document.createElement('div');
        this.container.className = 'notifications-container';
        this.container.id = 'notifications';
        document.body.appendChild(this.container);
        
        this.addStyles();
    },
    
    loadSettings() {
        const saved = this.os.modules.Storage?.get('notification_settings', {});
        this.settings = { ...this.settings, ...saved };
    },
    
    // ==================== SHOW NOTIFICATIONS ====================
    
    show(title, message, type = 'info', timeout = null) {
        const id = 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const notification = {
            id,
            title,
            message,
            type,
            timeout: timeout !== null ? timeout : this.settings.defaultTimeout,
            timestamp: Date.now(),
            read: false
        };
        
        // Add to list
        this.notifications.push(notification);
        
        // Render
        this.renderNotification(notification);
        
        // Trim if needed
        if (this.notifications.length > this.settings.maxNotifications) {
            const oldest = this.notifications.shift();
            document.getElementById(oldest.id)?.remove();
        }
        
        // Play sound
        if (this.settings.playSounds) {
            this.playSound(type);
        }
        
        // Add to taskbar
        if (window.Taskbar) {
            Taskbar.addNotification(notification);
        }
        
        return id;
    },
    
    renderNotification(notification) {
        const el = document.createElement('div');
        el.className = `notification notification-${notification.type}`;
        el.id = notification.id;
        
        el.innerHTML = `
            <div class="notification-icon">${this.getIcon(notification.type)}</div>
            <div class="notification-content">
                <div class="notification-title">${notification.title}</div>
                <div class="notification-message">${notification.message}</div>
                <div class="notification-time">${BhekHelpers.formatRelativeTime(notification.timestamp)}</div>
            </div>
            <button class="notification-close" onclick="Notification.close('${notification.id}')">✕</button>
        `;
        
        this.container.appendChild(el);
        
        // Animate in
        setTimeout(() => el.classList.add('show'), 10);
        
        // Auto close
        if (notification.timeout > 0) {
            setTimeout(() => {
                this.close(notification.id);
            }, notification.timeout);
        }
        
        // Add click handler
        el.addEventListener('click', (e) => {
            if (!e.target.classList.contains('notification-close')) {
                this.onClick(notification);
            }
        });
    },
    
    close(id) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('show');
            setTimeout(() => {
                el.remove();
                this.notifications = this.notifications.filter(n => n.id !== id);
            }, 300);
        }
    },
    
    closeAll() {
        this.notifications.forEach(n => this.close(n.id));
    },
    
    // ==================== NOTIFICATION TYPES ====================
    
    success(title, message, timeout = null) {
        return this.show(title, message, 'success', timeout);
    },
    
    error(title, message, timeout = null) {
        return this.show(title, message, 'error', timeout);
    },
    
    warning(title, message, timeout = null) {
        return this.show(title, message, 'warning', timeout);
    },
    
    info(title, message, timeout = null) {
        return this.show(title, message, 'info', timeout);
    },
    
    // ==================== PERSISTENT NOTIFICATIONS ====================
    
    showPersistent(title, message, type = 'info', actions = []) {
        const id = this.show(title, message, type, 0);
        
        if (actions.length > 0) {
            const el = document.getElementById(id);
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'notification-actions';
            
            actions.forEach(action => {
                const btn = document.createElement('button');
                btn.textContent = action.label;
                btn.onclick = () => {
                    action.handler();
                    this.close(id);
                };
                actionsDiv.appendChild(btn);
            });
            
            el.querySelector('.notification-content').appendChild(actionsDiv);
        }
        
        return id;
    },
    
    // ==================== PROGRESS NOTIFICATIONS ====================
    
    showProgress(title, message = '') {
        const id = 'progress_' + Date.now();
        
        const el = document.createElement('div');
        el.className = 'notification notification-progress';
        el.id = id;
        
        el.innerHTML = `
            <div class="notification-icon">⏳</div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
            </div>
        `;
        
        this.container.appendChild(el);
        setTimeout(() => el.classList.add('show'), 10);
        
        return {
            id,
            update: (progress, newMessage) => {
                const fill = el.querySelector('.progress-fill');
                if (fill) fill.style.width = progress + '%';
                
                if (newMessage) {
                    el.querySelector('.notification-message').textContent = newMessage;
                }
            },
            complete: (successMessage) => {
                if (successMessage) {
                    el.querySelector('.notification-message').textContent = successMessage;
                }
                el.querySelector('.notification-icon').textContent = '✅';
                setTimeout(() => this.close(id), 2000);
            },
            error: (errorMessage) => {
                el.querySelector('.notification-icon').textContent = '❌';
                el.querySelector('.notification-message').textContent = errorMessage;
                el.classList.add('notification-error');
                setTimeout(() => this.close(id), 3000);
            }
        };
    },
    
    // ==================== NOTIFICATION CENTER ====================
    
    showNotificationCenter() {
        if (window.Taskbar) {
            Taskbar.showNotificationCenter();
        }
    },
    
    markAsRead(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
            notification.read = true;
        }
    },
    
    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
    },
    
    getUnreadCount() {
        return this.notifications.filter(n => !n.read).length;
    },
    
    // ==================== EVENT HANDLERS ====================
    
    onClick(notification) {
        this.markAsRead(notification.id);
        this.os.modules.EventBus.emit('notification:clicked', notification);
    },
    
    // ==================== UTILITY METHODS ====================
    
    getIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            progress: '⏳'
        };
        return icons[type] || '📌';
    },
    
    playSound(type) {
        // Play different sounds for different types
        const sounds = {
            success: '/sounds/success.mp3',
            error: '/sounds/error.mp3',
            warning: '/sounds/warning.mp3',
            info: '/sounds/info.mp3'
        };
        
        const sound = sounds[type];
        if (sound) {
            const audio = new Audio(sound);
            audio.volume = 0.3;
            audio.play().catch(() => {});
        }
    },
    
    // ==================== STYLES ====================
    
    addStyles() {
        if (document.getElementById('notification-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notifications-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                pointer-events: none;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 350px;
            }
            
            .notification {
                background: var(--mica);
                backdrop-filter: var(--glass);
                border: 1px solid var(--mica-border);
                border-radius: 8px;
                padding: 12px;
                display: flex;
                gap: 12px;
                align-items: flex-start;
                transform: translateX(120%);
                transition: transform 0.3s;
                pointer-events: auto;
                box-shadow: 0 5px 20px rgba(0,0,0,0.3);
                position: relative;
                overflow: hidden;
            }
            
            .notification.show {
                transform: translateX(0);
            }
            
            .notification::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 4px;
                height: 100%;
            }
            
            .notification-success::before {
                background: #4CAF50;
            }
            
            .notification-error::before {
                background: #FF5252;
            }
            
            .notification-warning::before {
                background: #FF9800;
            }
            
            .notification-info::before {
                background: var(--accent);
            }
            
            .notification-icon {
                font-size: 20px;
                min-width: 24px;
            }
            
            .notification-content {
                flex: 1;
            }
            
            .notification-title {
                font-weight: 500;
                margin-bottom: 4px;
                font-size: 14px;
            }
            
            .notification-message {
                font-size: 12px;
                opacity: 0.9;
                margin-bottom: 4px;
            }
            
            .notification-time {
                font-size: 10px;
                opacity: 0.5;
            }
            
            .notification-close {
                background: transparent;
                border: none;
                color: white;
                font-size: 12px;
                cursor: pointer;
                opacity: 0.5;
                padding: 4px;
                border-radius: 4px;
            }
            
            .notification-close:hover {
                opacity: 1;
                background: rgba(255,255,255,0.1);
            }
            
            .notification-actions {
                display: flex;
                gap: 8px;
                margin-top: 8px;
            }
            
            .notification-actions button {
                padding: 4px 12px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 4px;
                color: white;
                font-size: 11px;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .notification-actions button:hover {
                background: rgba(255,255,255,0.2);
            }
            
            /* Progress notification */
            .progress-bar {
                width: 100%;
                height: 4px;
                background: rgba(255,255,255,0.1);
                border-radius: 2px;
                margin-top: 8px;
                overflow: hidden;
            }
            
            .progress-fill {
                height: 100%;
                background: var(--accent);
                transition: width 0.3s;
            }
            
            /* Light theme */
            .light-theme .notification {
                color: black;
            }
            
            .light-theme .notification-close {
                color: black;
            }
            
            .light-theme .notification-actions button {
                color: black;
            }
        `;
        
        document.head.appendChild(style);
    }
};

window.Notification = Notification;
