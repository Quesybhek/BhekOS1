/**
 * BhekOS Activity Feed Component - Real-time activity tracking
 */
const ActivityFeed = {
    os: null,
    element: null,
    visible: false,
    
    // Activities
    activities: [],
    
    // Settings
    settings: {
        maxActivities: 100,
        showTimestamps: true,
        groupByDay: true,
        playSounds: true
    },
    
    async init(os) {
        this.os = os;
        this.createFeed();
        this.setupListeners();
        this.loadSettings();
        
        return this;
    },
    
    createFeed() {
        this.element = document.createElement('div');
        this.element.className = 'activity-feed';
        this.element.id = 'activityFeed';
        this.element.innerHTML = this.render();
        document.body.appendChild(this.element);
        this.addStyles();
    },
    
    render() {
        const grouped = this.groupActivities();
        
        return `
            <div class="activity-feed-container">
                <div class="activity-feed-header">
                    <h3>
                        <span class="header-icon">📊</span>
                        Activity Feed
                    </h3>
                    <div class="header-actions">
                        <button class="filter-btn" onclick="ActivityFeed.toggleFilter()" title="Filter">
                            🔍
                        </button>
                        <button class="close-btn" onclick="ActivityFeed.hide()">✕</button>
                    </div>
                </div>
                
                <div class="activity-filters" id="activityFilters" style="display: none;">
                    <select id="activityTypeFilter" onchange="ActivityFeed.applyFilters()">
                        <option value="all">All Activities</option>
                        <option value="file">File Operations</option>
                        <option value="user">User Actions</option>
                        <option value="app">App Activities</option>
                        <option value="system">System Events</option>
                        <option value="collab">Collaboration</option>
                    </select>
                    
                    <select id="activityUserFilter" onchange="ActivityFeed.applyFilters()">
                        <option value="all">All Users</option>
                        ${this.getUserOptions()}
                    </select>
                    
                    <button class="clear-filters" onclick="ActivityFeed.clearFilters()">Clear</button>
                </div>
                
                <div class="activity-list" id="activityList">
                    ${this.renderActivities(grouped)}
                </div>
                
                <div class="activity-feed-footer">
                    <button class="refresh-btn" onclick="ActivityFeed.refresh()">
                        🔄 Refresh
                    </button>
                    <button class="clear-btn" onclick="ActivityFeed.clearAll()">
                        🗑️ Clear All
                    </button>
                </div>
            </div>
        `;
    },
    
    renderActivities(grouped) {
        if (this.activities.length === 0) {
            return `
                <div class="no-activities">
                    <div class="no-activities-icon">📭</div>
                    <div class="no-activities-text">No activities yet</div>
                    <div class="no-activities-hint">Activities will appear here</div>
                </div>
            `;
        }
        
        let html = '';
        
        if (this.settings.groupByDay) {
            Object.entries(grouped).forEach(([date, activities]) => {
                html += `<div class="activity-date-header">${date}</div>`;
                activities.forEach(activity => {
                    html += this.renderActivityItem(activity);
                });
            });
        } else {
            this.activities.forEach(activity => {
                html += this.renderActivityItem(activity);
            });
        }
        
        return html;
    },
    
    renderActivityItem(activity) {
        return `
            <div class="activity-item ${activity.type}" data-id="${activity.id}">
                <div class="activity-icon">${this.getActivityIcon(activity)}</div>
                <div class="activity-content">
                    <div class="activity-title">
                        <span class="activity-user">${activity.user || 'System'}</span>
                        <span class="activity-action">${activity.action}</span>
                    </div>
                    <div class="activity-description">${activity.description || ''}</div>
                    ${this.settings.showTimestamps ? `
                        <div class="activity-time">${BhekHelpers.formatRelativeTime(activity.timestamp)}</div>
                    ` : ''}
                </div>
                ${activity.target ? `
                    <div class="activity-target" onclick="ActivityFeed.onTargetClick('${activity.target}')">
                        ${activity.targetIcon || '🔗'}
                    </div>
                ` : ''}
            </div>
        `;
    },
    
    setupListeners() {
        // Listen for various events
        const events = [
            'file:created', 'file:modified', 'file:deleted', 'file:shared',
            'user:login', 'user:logout', 'user:presence',
            'app:installed', 'app:uninstalled', 'app:updated',
            'system:startup', 'system:shutdown',
            'collab:user_joined', 'collab:user_left', 'collab:message'
        ];
        
        events.forEach(event => {
            this.os.modules.EventBus.on(event, (data) => {
                this.addActivity({
                    type: event.split(':')[0],
                    action: event.split(':')[1],
                    ...data,
                    timestamp: Date.now()
                });
            });
        });
        
        // Keyboard shortcut
        document.addEventListener('keydown', (e) => {
            if (e.altKey && e.key === 'a') {
                e.preventDefault();
                this.toggle();
            }
        });
    },
    
    // ==================== ACTIVITY MANAGEMENT ====================
    
    addActivity(activity) {
        const newActivity = {
            id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            ...activity
        };
        
        this.activities.unshift(newActivity);
        
        // Trim if needed
        if (this.activities.length > this.settings.maxActivities) {
            this.activities.pop();
        }
        
        // Update UI if visible
        if (this.visible) {
            this.refresh();
        }
        
        // Play sound if enabled
        if (this.settings.playSounds) {
            this.playSound(activity.type);
        }
        
        // Emit event
        this.os.modules.EventBus.emit('activity:added', newActivity);
    },
    
    addActivityFromEvent(event, data) {
        this.addActivity({
            type: event,
            user: data.user || this.os.modules.UserManager?.getCurrentUser()?.username,
            ...data
        });
    },
    
    clearAll() {
        this.activities = [];
        this.refresh();
        this.os.notify('Activity Feed', 'All activities cleared', 'info');
    },
    
    removeActivity(id) {
        this.activities = this.activities.filter(a => a.id !== id);
        this.refresh();
    },
    
    // ==================== FILTERING ====================
    
    applyFilters() {
        const typeFilter = document.getElementById('activityTypeFilter')?.value || 'all';
        const userFilter = document.getElementById('activityUserFilter')?.value || 'all';
        
        const filtered = this.activities.filter(activity => {
            if (typeFilter !== 'all' && activity.type !== typeFilter) return false;
            if (userFilter !== 'all' && activity.user !== userFilter) return false;
            return true;
        });
        
        const grouped = this.groupActivities(filtered);
        document.getElementById('activityList').innerHTML = this.renderActivities(grouped);
    },
    
    clearFilters() {
        document.getElementById('activityTypeFilter').value = 'all';
        document.getElementById('activityUserFilter').value = 'all';
        this.refresh();
    },
    
    toggleFilter() {
        const filters = document.getElementById('activityFilters');
        filters.style.display = filters.style.display === 'none' ? 'flex' : 'none';
    },
    
    // ==================== GROUPING ====================
    
    groupActivities(activities = null) {
        const acts = activities || this.activities;
        const grouped = {};
        
        acts.forEach(activity => {
            const date = new Date(activity.timestamp).toLocaleDateString();
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(activity);
        });
        
        return grouped;
    },
    
    // ==================== UI CONTROL ====================
    
    show() {
        this.visible = true;
        this.element.classList.add('visible');
        this.refresh();
    },
    
    hide() {
        this.visible = false;
        this.element.classList.remove('visible');
    },
    
    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    },
    
    refresh() {
        const grouped = this.groupActivities();
        document.getElementById('activityList').innerHTML = this.renderActivities(grouped);
    },
    
    // ==================== UTILITY METHODS ====================
    
    getActivityIcon(activity) {
        const icons = {
            file: {
                created: '📄+',
                modified: '📝',
                deleted: '🗑️',
                shared: '📤'
            },
            user: {
                login: '🔓',
                logout: '🔒',
                presence: '👤'
            },
            app: {
                installed: '📲',
                uninstalled: '🗑️',
                updated: '🔄'
            },
            system: {
                startup: '🚀',
                shutdown: '⏻'
            },
            collab: {
                user_joined: '👥+',
                user_left: '👥-',
                message: '💬'
            }
        };
        
        return icons[activity.type]?.[activity.action] || '📌';
    },
    
    getUserOptions() {
        const users = this.os.modules.UserManager?.getAllUsers() || [];
        return users.map(user => 
            `<option value="${user.username}">${user.name}</option>`
        ).join('');
    },
    
    onTargetClick(target) {
        // Handle clicking on activity target
        console.log('Activity target clicked:', target);
    },
    
    playSound(type) {
        // Play different sounds for different activity types
        const sounds = {
            file: '/sounds/file.mp3',
            user: '/sounds/user.mp3',
            app: '/sounds/app.mp3',
            system: '/sounds/system.mp3',
            collab: '/sounds/collab.mp3'
        };
        
        const sound = sounds[type];
        if (sound) {
            const audio = new Audio(sound);
            audio.volume = 0.2;
            audio.play().catch(() => {});
        }
    },
    
    loadSettings() {
        const saved = this.os.modules.Storage?.get('activity_feed_settings', {});
        this.settings = { ...this.settings, ...saved };
    },
    
    saveSettings() {
        this.os.modules.Storage?.set('activity_feed_settings', this.settings);
    },
    
    // ==================== STYLES ====================
    
    addStyles() {
        if (document.getElementById('activity-feed-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'activity-feed-styles';
        style.textContent = `
            .activity-feed {
                position: fixed;
                top: 0;
                right: -400px;
                width: 380px;
                height: 100vh;
                background: var(--mica);
                backdrop-filter: var(--glass);
                border-left: 1px solid var(--mica-border);
                z-index: 9999;
                transition: right 0.3s;
                display: flex;
                flex-direction: column;
            }
            
            .activity-feed.visible {
                right: 0;
            }
            
            .activity-feed-container {
                display: flex;
                flex-direction: column;
                height: 100%;
            }
            
            .activity-feed-header {
                padding: 16px 20px;
                border-bottom: 1px solid var(--mica-border);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .activity-feed-header h3 {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 18px;
                font-weight: 500;
            }
            
            .header-actions {
                display: flex;
                gap: 8px;
            }
            
            .filter-btn,
            .close-btn {
                background: transparent;
                border: none;
                color: white;
                font-size: 16px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
            }
            
            .filter-btn:hover,
            .close-btn:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .activity-filters {
                padding: 12px 16px;
                border-bottom: 1px solid var(--mica-border);
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }
            
            .activity-filters select {
                flex: 1;
                padding: 6px 8px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 4px;
                color: white;
                font-size: 12px;
            }
            
            .clear-filters {
                padding: 6px 12px;
                background: transparent;
                border: 1px solid var(--mica-border);
                border-radius: 4px;
                color: white;
                font-size: 12px;
                cursor: pointer;
            }
            
            .clear-filters:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .activity-list {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
            }
            
            .activity-date-header {
                padding: 8px 0;
                font-size: 12px;
                font-weight: 500;
                opacity: 0.7;
                position: sticky;
                top: 0;
                background: var(--mica);
                backdrop-filter: var(--glass);
                z-index: 1;
            }
            
            .activity-item {
                display: flex;
                gap: 12px;
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 8px;
                background: rgba(255,255,255,0.03);
                transition: background 0.2s;
                position: relative;
            }
            
            .activity-item:hover {
                background: rgba(255,255,255,0.06);
            }
            
            .activity-item::before {
                content: '';
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                width: 3px;
                border-radius: 3px 0 0 3px;
            }
            
            .activity-item.file::before { background: #4CAF50; }
            .activity-item.user::before { background: #2196F3; }
            .activity-item.app::before { background: #9C27B0; }
            .activity-item.system::before { background: #FF9800; }
            .activity-item.collab::before { background: #00BCD4; }
            
            .activity-icon {
                font-size: 20px;
                min-width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(255,255,255,0.05);
                border-radius: 6px;
            }
            
            .activity-content {
                flex: 1;
            }
            
            .activity-title {
                margin-bottom: 4px;
                font-size: 13px;
            }
            
            .activity-user {
                font-weight: 500;
                color: var(--accent);
            }
            
            .activity-action {
                opacity: 0.9;
            }
            
            .activity-description {
                font-size: 12px;
                opacity: 0.7;
                margin-bottom: 4px;
            }
            
            .activity-time {
                font-size: 10px;
                opacity: 0.5;
            }
            
            .activity-target {
                font-size: 16px;
                cursor: pointer;
                opacity: 0.5;
                transition: opacity 0.2s;
                display: flex;
                align-items: center;
            }
            
            .activity-target:hover {
                opacity: 1;
            }
            
            .no-activities {
                text-align: center;
                padding: 60px 20px;
                opacity: 0.5;
            }
            
            .no-activities-icon {
                font-size: 48px;
                margin-bottom: 16px;
            }
            
            .no-activities-text {
                font-size: 16px;
                margin-bottom: 8px;
            }
            
            .no-activities-hint {
                font-size: 12px;
            }
            
            .activity-feed-footer {
                padding: 16px 20px;
                border-top: 1px solid var(--mica-border);
                display: flex;
                gap: 8px;
            }
            
            .refresh-btn,
            .clear-btn {
                flex: 1;
                padding: 8px;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
                transition: 0.2s;
            }
            
            .refresh-btn {
                background: transparent;
                border: 1px solid var(--mica-border);
                color: white;
            }
            
            .refresh-btn:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .clear-btn {
                background: #ff5252;
                color: white;
            }
            
            .clear-btn:hover {
                background: #ff6b6b;
            }
            
            /* Light theme */
            .light-theme .activity-feed {
                color: black;
            }
            
            .light-theme .filter-btn,
            .light-theme .close-btn {
                color: black;
            }
            
            .light-theme .activity-filters select {
                color: black;
            }
            
            .light-theme .refresh-btn {
                color: black;
            }
        `;
        
        document.head.appendChild(style);
    }
};

window.ActivityFeed = ActivityFeed;
