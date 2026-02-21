/**
 * Backup Application - Backup and restore system
 */
class BackupApp {
    constructor(os, windowId) {
        this.os = os;
        this.windowId = windowId;
        this.currentView = 'list'; // list, create, restore, schedule
        this.selectedBackup = null;
        this.backups = [];
        this.schedules = [];
    }
    
    async render(container, options = {}) {
        this.container = container;
        
        if (options.backupId) {
            await this.loadBackupDetails(options.backupId);
        }
        
        await this.loadData();
        await this.renderBackupManager();
        this.addStyles();
    }
    
    async loadData() {
        if (this.os.modules.BackupManager) {
            this.backups = this.os.modules.BackupManager.getBackups();
            this.schedules = this.os.modules.BackupManager.getSchedules();
        } else {
            this.backups = this.getMockBackups();
            this.schedules = this.getMockSchedules();
        }
    }
    
    getMockBackups() {
        const now = Date.now();
        return [
            {
                id: 'backup1',
                name: 'System Backup 2024-01-15',
                createdAt: now - 7 * 86400000,
                size: 256 * 1024 * 1024,
                status: 'completed',
                type: 'full',
                include: { system: true, users: true, apps: true, files: true, settings: true }
            },
            {
                id: 'backup2',
                name: 'Files Backup 2024-01-14',
                createdAt: now - 6 * 86400000,
                size: 128 * 1024 * 1024,
                status: 'completed',
                type: 'files',
                include: { files: true }
            },
            {
                id: 'backup3',
                name: 'Settings Backup 2024-01-13',
                createdAt: now - 5 * 86400000,
                size: 512 * 1024,
                status: 'completed',
                type: 'settings',
                include: { settings: true }
            }
        ];
    }
    
    getMockSchedules() {
        return [
            {
                id: 'schedule1',
                name: 'Daily Backup',
                enabled: true,
                time: '02:00',
                days: [1, 2, 3, 4, 5],
                lastRun: Date.now() - 86400000,
                nextRun: Date.now() + 3600000,
                options: { includeSystem: true, includeUsers: true, includeApps: false }
            },
            {
                id: 'schedule2',
                name: 'Weekly Full Backup',
                enabled: true,
                time: '03:00',
                days: [0],
                lastRun: Date.now() - 3 * 86400000,
                nextRun: Date.now() + 4 * 86400000,
                options: { includeSystem: true, includeUsers: true, includeApps: true, includeFiles: true, includeSettings: true }
            }
        ];
    }
    
    async loadBackupDetails(backupId) {
        if (this.os.modules.BackupManager) {
            this.selectedBackup = this.os.modules.BackupManager.getBackup(backupId);
        } else {
            this.selectedBackup = this.backups.find(b => b.id === backupId);
        }
    }
    
    async renderBackupManager() {
        this.container.innerHTML = `
            <div class="backup-app">
                <!-- Header -->
                <div class="backup-header">
                    <h1 class="backup-title">
                        <span class="backup-icon">💾</span>
                        Backup & Restore
                    </h1>
                    <div class="backup-actions">
                        <button class="action-btn" onclick="backupApp.showCreateBackup()">
                            ➕ Create Backup
                        </button>
                        <button class="action-btn" onclick="backupApp.showSchedules()">
                            ⏰ Schedules
                        </button>
                    </div>
                </div>
                
                <!-- Tabs -->
                <div class="backup-tabs">
                    <button class="tab-btn ${this.currentView === 'list' ? 'active' : ''}" 
                            onclick="backupApp.switchView('list')">📋 Backups</button>
                    <button class="tab-btn ${this.currentView === 'restore' ? 'active' : ''}" 
                            onclick="backupApp.switchView('restore')">🔄 Restore</button>
                    <button class="tab-btn ${this.currentView === 'schedule' ? 'active' : ''}" 
                            onclick="backupApp.switchView('schedule')">⏱️ Schedules</button>
                </div>
                
                <!-- Content -->
                <div class="backup-content">
                    ${this.renderCurrentView()}
                </div>
                
                <!-- Status -->
                <div class="backup-status">
                    <span>Last backup: ${this.getLastBackupTime()}</span>
                    <span>Total size: ${this.getTotalSize()}</span>
                    <span>Next scheduled: ${this.getNextSchedule()}</span>
                </div>
            </div>
        `;
        
        this.addEventListeners();
    }
    
    renderCurrentView() {
        switch(this.currentView) {
            case 'list':
                return this.renderBackupList();
            case 'create':
                return this.renderCreateBackup();
            case 'restore':
                return this.renderRestoreView();
            case 'schedule':
                return this.renderSchedulesView();
            case 'details':
                return this.renderBackupDetails();
            default:
                return this.renderBackupList();
        }
    }
    
    renderBackupList() {
        return `
            <div class="backup-list-view">
                <h2 class="section-title">Available Backups</h2>
                
                <div class="backups-grid">
                    ${this.backups.length > 0 ? this.backups.map(backup => `
                        <div class="backup-card" onclick="backupApp.showBackupDetails('${backup.id}')">
                            <div class="backup-card-header">
                                <span class="backup-type-icon">${this.getBackupIcon(backup.type)}</span>
                                <span class="backup-status ${backup.status}">${backup.status}</span>
                            </div>
                            <div class="backup-card-body">
                                <h3 class="backup-name">${backup.name}</h3>
                                <div class="backup-date">${new Date(backup.createdAt).toLocaleString()}</div>
                                <div class="backup-size">${this.formatBytes(backup.size)}</div>
                            </div>
                            <div class="backup-card-footer">
                                <span class="backup-type">${backup.type} backup</span>
                                <button class="restore-btn" onclick="event.stopPropagation(); backupApp.startRestore('${backup.id}')">
                                    Restore
                                </button>
                            </div>
                        </div>
                    `).join('') : `
                        <div class="no-backups">
                            <div class="no-backups-icon">💾</div>
                            <h3>No Backups Found</h3>
                            <p>Create your first backup to protect your data</p>
                            <button class="create-first-btn" onclick="backupApp.showCreateBackup()">
                                Create Backup
                            </button>
                        </div>
                    `}
                </div>
            </div>
        `;
    }
    
    renderCreateBackup() {
        return `
            <div class="create-backup-view">
                <div class="view-header">
                    <button class="back-btn" onclick="backupApp.switchView('list')">← Back</button>
                    <h2>Create New Backup</h2>
                </div>
                
                <form class="backup-form" onsubmit="backupApp.createBackup(event)">
                    <div class="form-group">
                        <label>Backup Name</label>
                        <input type="text" id="backup-name" 
                               value="Backup ${new Date().toLocaleDateString()}" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Description (optional)</label>
                        <textarea id="backup-desc" rows="2"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>Backup Type</label>
                        <select id="backup-type" onchange="backupApp.toggleBackupOptions()">
                            <option value="full">Full Backup</option>
                            <option value="incremental">Incremental</option>
                            <option value="differential">Differential</option>
                            <option value="custom">Custom</option>
                        </select>
                    </div>
                    
                    <div class="backup-options" id="backup-options">
                        <h3>Include:</h3>
                        
                        <label class="checkbox-label">
                            <input type="checkbox" id="include-system" checked>
                            <span>System Information</span>
                        </label>
                        
                        <label class="checkbox-label">
                            <input type="checkbox" id="include-users" checked>
                            <span>User Data</span>
                        </label>
                        
                        <label class="checkbox-label">
                            <input type="checkbox" id="include-apps" checked>
                            <span>Applications</span>
                        </label>
                        
                        <label class="checkbox-label">
                            <input type="checkbox" id="include-files" checked>
                            <span>Files</span>
                        </label>
                        
                        <label class="checkbox-label">
                            <input type="checkbox" id="include-settings" checked>
                            <span>Settings</span>
                        </label>
                    </div>
                    
                    <div class="form-group">
                        <label>Compression</label>
                        <select id="backup-compress">
                            <option value="none">No Compression</option>
                            <option value="fast">Fast Compression</option>
                            <option value="maximum" selected>Maximum Compression</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Encryption</label>
                        <select id="backup-encrypt">
                            <option value="none">No Encryption</option>
                            <option value="aes128">AES-128</option>
                            <option value="aes256" selected>AES-256</option>
                        </select>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="cancel-btn" onclick="backupApp.switchView('list')">
                            Cancel
                        </button>
                        <button type="submit" class="create-btn">
                            Start Backup
                        </button>
                    </div>
                </form>
            </div>
        `;
    }
    
    renderRestoreView() {
        return `
            <div class="restore-view">
                <div class="view-header">
                    <h2>Restore from Backup</h2>
                    <p class="view-description">Select a backup to restore from</p>
                </div>
                
                <div class="restore-backups-list">
                    ${this.backups.map(backup => `
                        <div class="restore-item" onclick="backupApp.selectRestoreBackup('${backup.id}')">
                            <div class="restore-item-info">
                                <div class="restore-item-name">${backup.name}</div>
                                <div class="restore-item-date">${new Date(backup.createdAt).toLocaleString()}</div>
                            </div>
                            <div class="restore-item-meta">
                                <span class="restore-item-size">${this.formatBytes(backup.size)}</span>
                                <span class="restore-item-type">${backup.type}</span>
                            </div>
                            <button class="select-restore-btn">Select</button>
                        </div>
                    `).join('')}
                </div>
                
                <div class="restore-options" id="restore-options" style="display: none;">
                    <h3>Restore Options</h3>
                    
                    <div class="form-group">
                        <label>Restore Location</label>
                        <select id="restore-location">
                            <option value="original">Original Location</option>
                            <option value="new">New Location</option>
                            <option value="custom">Custom Location</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Restore Method</label>
                        <select id="restore-method">
                            <option value="overwrite">Overwrite existing files</option>
                            <option value="skip">Skip existing files</option>
                            <option value="rename">Rename restored files</option>
                        </select>
                    </div>
                    
                    <div class="form-actions">
                        <button class="start-restore-btn" onclick="backupApp.confirmRestore()">
                            Start Restore
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderSchedulesView() {
        return `
            <div class="schedules-view">
                <div class="view-header">
                    <h2>Backup Schedules</h2>
                    <button class="add-schedule-btn" onclick="backupApp.showAddSchedule()">
                        ➕ Add Schedule
                    </button>
                </div>
                
                <div class="schedules-list">
                    ${this.schedules.length > 0 ? this.schedules.map(schedule => `
                        <div class="schedule-card">
                            <div class="schedule-header">
                                <h3>${schedule.name}</h3>
                                <label class="toggle-switch">
                                    <input type="checkbox" ${schedule.enabled ? 'checked' : ''} 
                                           onchange="backupApp.toggleSchedule('${schedule.id}', this.checked)">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            
                            <div class="schedule-details">
                                <div class="schedule-time">
                                    <span class="detail-label">Time:</span>
                                    <span>${schedule.time}</span>
                                </div>
                                <div class="schedule-days">
                                    <span class="detail-label">Days:</span>
                                    <span>${this.formatDays(schedule.days)}</span>
                                </div>
                                <div class="schedule-last">
                                    <span class="detail-label">Last run:</span>
                                    <span>${schedule.lastRun ? new Date(schedule.lastRun).toLocaleString() : 'Never'}</span>
                                </div>
                                <div class="schedule-next">
                                    <span class="detail-label">Next run:</span>
                                    <span>${new Date(schedule.nextRun).toLocaleString()}</span>
                                </div>
                            </div>
                            
                            <div class="schedule-actions">
                                <button class="edit-schedule-btn" onclick="backupApp.editSchedule('${schedule.id}')">
                                    ✏️ Edit
                                </button>
                                <button class="delete-schedule-btn" onclick="backupApp.deleteSchedule('${schedule.id}')">
                                    🗑️ Delete
                                </button>
                            </div>
                        </div>
                    `).join('') : `
                        <div class="no-schedules">
                            <p>No schedules configured</p>
                            <button class="add-first-schedule" onclick="backupApp.showAddSchedule()">
                                Add Schedule
                            </button>
                        </div>
                    `}
                </div>
            </div>
        `;
    }
    
    renderBackupDetails() {
        if (!this.selectedBackup) return '';
        
        return `
            <div class="backup-details-view">
                <div class="view-header">
                    <button class="back-btn" onclick="backupApp.switchView('list')">← Back</button>
                    <h2>Backup Details</h2>
                </div>
                
                <div class="details-content">
                    <div class="details-section">
                        <h3>Basic Information</h3>
                        <div class="detail-row">
                            <span class="detail-label">Name:</span>
                            <span class="detail-value">${this.selectedBackup.name}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Created:</span>
                            <span class="detail-value">${new Date(this.selectedBackup.createdAt).toLocaleString()}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Size:</span>
                            <span class="detail-value">${this.formatBytes(this.selectedBackup.size)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Type:</span>
                            <span class="detail-value">${this.selectedBackup.type}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Status:</span>
                            <span class="detail-value status-${this.selectedBackup.status}">${this.selectedBackup.status}</span>
                        </div>
                    </div>
                    
                    <div class="details-section">
                        <h3>Contents</h3>
                        <div class="contents-list">
                            ${Object.entries(this.selectedBackup.include || {}).map(([key, value]) => `
                                <div class="content-item">
                                    <span class="content-icon">${this.getContentIcon(key)}</span>
                                    <span class="content-name">${key}</span>
                                    <span class="content-status ${value ? 'included' : 'excluded'}">
                                        ${value ? '✓ Included' : '✗ Excluded'}
                                    </span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="details-actions">
                        <button class="restore-this-btn" onclick="backupApp.startRestore('${this.selectedBackup.id}')">
                            🔄 Restore this Backup
                        </button>
                        <button class="verify-btn" onclick="backupApp.verifyBackup('${this.selectedBackup.id}')">
                            ✓ Verify Backup
                        </button>
                        <button class="export-btn" onclick="backupApp.exportBackup('${this.selectedBackup.id}')">
                            📤 Export Backup
                        </button>
                        <button class="delete-this-btn" onclick="backupApp.deleteBackup('${this.selectedBackup.id}')">
                            🗑️ Delete Backup
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    // ==================== EVENT HANDLERS ====================
    
    addEventListeners() {
        // Any additional event listeners
    }
    
    // ==================== VIEW NAVIGATION ====================
    
    switchView(view) {
        this.currentView = view;
        this.renderBackupManager();
    }
    
    async showBackupDetails(backupId) {
        await this.loadBackupDetails(backupId);
        this.currentView = 'details';
        this.renderBackupManager();
    }
    
    showCreateBackup() {
        this.currentView = 'create';
        this.renderBackupManager();
    }
    
    showSchedules() {
        this.currentView = 'schedule';
        this.renderBackupManager();
    }
    
    showAddSchedule() {
        alert('Add schedule coming soon!');
    }
    
    // ==================== BACKUP OPERATIONS ====================
    
    async createBackup(event) {
        event.preventDefault();
        
        const name = document.getElementById('backup-name').value;
        const description = document.getElementById('backup-desc').value;
        const type = document.getElementById('backup-type').value;
        const compress = document.getElementById('backup-compress').value;
        const encrypt = document.getElementById('backup-encrypt').value;
        
        const include = {
            system: document.getElementById('include-system')?.checked || false,
            users: document.getElementById('include-users')?.checked || false,
            apps: document.getElementById('include-apps')?.checked || false,
            files: document.getElementById('include-files')?.checked || false,
            settings: document.getElementById('include-settings')?.checked || false
        };
        
        this.os.notify('Backup', 'Starting backup...', 'info');
        
        try {
            if (this.os.modules.BackupManager) {
                await this.os.modules.BackupManager.createBackup({
                    name,
                    description,
                    include,
                    compress: compress !== 'none',
                    encrypt: encrypt !== 'none'
                });
            } else {
                // Mock success
                setTimeout(() => {
                    this.os.notify('Backup', 'Backup completed successfully', 'success');
                }, 2000);
            }
            
            this.switchView('list');
        } catch (error) {
            this.os.notify('Backup', 'Backup failed: ' + error.message, 'error');
        }
    }
    
    toggleBackupOptions() {
        const type = document.getElementById('backup-type').value;
        const options = document.getElementById('backup-options');
        
        if (type === 'custom') {
            options.style.display = 'block';
        } else {
            options.style.display = 'none';
        }
    }
    
    startRestore(backupId) {
        this.selectedBackup = this.backups.find(b => b.id === backupId);
        this.currentView = 'restore';
        this.renderBackupManager();
        
        setTimeout(() => {
            document.getElementById('restore-options').style.display = 'block';
        }, 100);
    }
    
    selectRestoreBackup(backupId) {
        this.selectedBackup = this.backups.find(b => b.id === backupId);
        document.getElementById('restore-options').style.display = 'block';
    }
    
    async confirmRestore() {
        if (!this.selectedBackup) {
            alert('Please select a backup');
            return;
        }
        
        const location = document.getElementById('restore-location')?.value;
        const method = document.getElementById('restore-method')?.value;
        
        if (confirm(`Restore from backup "${this.selectedBackup.name}"? This will overwrite existing files.`)) {
            this.os.notify('Restore', 'Starting restore...', 'info');
            
            try {
                if (this.os.modules.BackupManager) {
                    await this.os.modules.BackupManager.restoreBackup(this.selectedBackup.id, {
                        location,
                        method
                    });
                } else {
                    setTimeout(() => {
                        this.os.notify('Restore', 'Restore completed successfully', 'success');
                    }, 3000);
                }
                
                this.switchView('list');
            } catch (error) {
                this.os.notify('Restore', 'Restore failed: ' + error.message, 'error');
            }
        }
    }
    
    async verifyBackup(backupId) {
        this.os.notify('Verification', 'Verifying backup...', 'info');
        
        try {
            if (this.os.modules.BackupManager) {
                await this.os.modules.BackupManager.verifyBackup(backupId);
                this.os.notify('Verification', 'Backup verified successfully', 'success');
            } else {
                setTimeout(() => {
                    this.os.notify('Verification', 'Backup is valid', 'success');
                }, 2000);
            }
        } catch (error) {
            this.os.notify('Verification', 'Verification failed: ' + error.message, 'error');
        }
    }
    
    async exportBackup(backupId) {
        if (this.os.modules.BackupManager) {
            await this.os.modules.BackupManager.exportBackup(backupId);
        } else {
            alert('Export backup feature coming soon!');
        }
    }
    
    async deleteBackup(backupId) {
        if (!confirm('Delete this backup? This cannot be undone.')) return;
        
        try {
            if (this.os.modules.BackupManager) {
                await this.os.modules.BackupManager.deleteBackup(backupId);
            }
            
            this.backups = this.backups.filter(b => b.id !== backupId);
            this.switchView('list');
            this.os.notify('Backup', 'Backup deleted', 'success');
        } catch (error) {
            this.os.notify('Error', error.message, 'error');
        }
    }
    
    // ==================== SCHEDULE OPERATIONS ====================
    
    toggleSchedule(scheduleId, enabled) {
        if (this.os.modules.BackupManager) {
            this.os.modules.BackupManager.updateSchedule(scheduleId, { enabled });
        }
    }
    
    editSchedule(scheduleId) {
        alert('Edit schedule coming soon!');
    }
    
    deleteSchedule(scheduleId) {
        if (confirm('Delete this schedule?')) {
            this.schedules = this.schedules.filter(s => s.id !== scheduleId);
            this.renderBackupManager();
            
            if (this.os.modules.BackupManager) {
                this.os.modules.BackupManager.deleteSchedule(scheduleId);
            }
        }
    }
    
    // ==================== UTILITY METHODS ====================
    
    getBackupIcon(type) {
        const icons = {
            'full': '📀',
            'incremental': '➕',
            'differential': '📊',
            'files': '📁',
            'settings': '⚙️',
            'system': '🖥️'
        };
        return icons[type] || '💾';
    }
    
    getContentIcon(content) {
        const icons = {
            system: '🖥️',
            users: '👥',
            apps: '📱',
            files: '📁',
            settings: '⚙️'
        };
        return icons[content] || '📄';
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
    }
    
    formatDays(days) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days.map(d => dayNames[d]).join(', ');
    }
    
    getLastBackupTime() {
        if (this.backups.length === 0) return 'Never';
        const last = this.backups.sort((a, b) => b.createdAt - a.createdAt)[0];
        return new Date(last.createdAt).toLocaleDateString();
    }
    
    getTotalSize() {
        const total = this.backups.reduce((sum, b) => sum + b.size, 0);
        return this.formatBytes(total);
    }
    
    getNextSchedule() {
        const enabled = this.schedules.filter(s => s.enabled);
        if (enabled.length === 0) return 'None';
        
        const next = enabled.sort((a, b) => a.nextRun - b.nextRun)[0];
        return new Date(next.nextRun).toLocaleString();
    }
    
    // ==================== STYLES ====================
    
    addStyles() {
        if (document.getElementById('backup-app-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'backup-app-styles';
        style.textContent = `
            .backup-app {
                height: 100%;
                display: flex;
                flex-direction: column;
                padding: 20px;
            }
            
            .backup-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }
            
            .backup-title {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 24px;
            }
            
            .backup-icon {
                font-size: 32px;
            }
            
            .action-btn {
                padding: 8px 16px;
                margin-left: 8px;
                background: transparent;
                border: 1px solid var(--mica-border);
                border-radius: 6px;
                color: white;
                cursor: pointer;
            }
            
            .action-btn:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .backup-tabs {
                display: flex;
                gap: 4px;
                margin-bottom: 20px;
                border-bottom: 1px solid var(--mica-border);
                padding-bottom: 8px;
            }
            
            .tab-btn {
                padding: 6px 12px;
                background: transparent;
                border: none;
                color: white;
                cursor: pointer;
                border-radius: 4px;
            }
            
            .tab-btn:hover {
                background: rgba(255,255,255,0.05);
            }
            
            .tab-btn.active {
                background: var(--accent);
            }
            
            .backup-content {
                flex: 1;
                overflow-y: auto;
                margin-bottom: 16px;
            }
            
            .backup-status {
                padding: 8px 12px;
                background: rgba(0,0,0,0.2);
                border-top: 1px solid var(--mica-border);
                display: flex;
                gap: 20px;
                font-size: 11px;
                opacity: 0.7;
            }
            
            /* Backup List */
            .section-title {
                font-size: 18px;
                margin-bottom: 16px;
            }
            
            .backups-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 16px;
            }
            
            .backup-card {
                background: rgba(255,255,255,0.05);
                border-radius: 10px;
                padding: 16px;
                cursor: pointer;
                transition: 0.2s;
                border: 1px solid transparent;
            }
            
            .backup-card:hover {
                background: rgba(255,255,255,0.1);
                transform: translateY(-2px);
                border-color: var(--accent);
            }
            
            .backup-card-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            
            .backup-type-icon {
                font-size: 24px;
            }
            
            .backup-status {
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 11px;
                text-transform: uppercase;
            }
            
            .backup-status.completed {
                background: rgba(76, 175, 80, 0.2);
                color: #4CAF50;
            }
            
            .backup-status.failed {
                background: rgba(255, 82, 82, 0.2);
                color: #ff5252;
            }
            
            .backup-status.in_progress {
                background: rgba(255, 152, 0, 0.2);
                color: #FF9800;
            }
            
            .backup-name {
                font-size: 16px;
                font-weight: 500;
                margin-bottom: 4px;
            }
            
            .backup-date {
                font-size: 12px;
                opacity: 0.7;
                margin-bottom: 4px;
            }
            
            .backup-size {
                font-size: 13px;
                margin-bottom: 12px;
            }
            
            .backup-card-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .backup-type {
                font-size: 11px;
                opacity: 0.6;
                text-transform: uppercase;
            }
            
            .restore-btn {
                padding: 4px 12px;
                background: var(--accent);
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
            }
            
            .no-backups {
                grid-column: 1 / -1;
                text-align: center;
                padding: 60px 20px;
                opacity: 0.7;
            }
            
            .no-backups-icon {
                font-size: 48px;
                margin-bottom: 16px;
            }
            
            .create-first-btn {
                margin-top: 20px;
                padding: 10px 20px;
                background: var(--accent);
                border: none;
                border-radius: 6px;
                color: white;
                cursor: pointer;
            }
            
            /* Create Backup Form */
            .create-backup-view,
            .restore-view,
            .schedules-view,
            .backup-details-view {
                height: 100%;
                overflow-y: auto;
                padding-right: 10px;
            }
            
            .view-header {
                display: flex;
                align-items: center;
                gap: 20px;
                margin-bottom: 20px;
            }
            
            .back-btn {
                padding: 6px 12px;
                background: transparent;
                border: 1px solid var(--mica-border);
                border-radius: 4px;
                color: white;
                cursor: pointer;
            }
            
            .backup-form {
                max-width: 600px;
                margin: 0 auto;
            }
            
            .form-group {
                margin-bottom: 20px;
            }
            
            .form-group label {
                display: block;
                margin-bottom: 6px;
                font-size: 13px;
                font-weight: 500;
            }
            
            .form-group input,
            .form-group textarea,
            .form-group select {
                width: 100%;
                padding: 10px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 6px;
                color: white;
                font-size: 14px;
            }
            
            .backup-options {
                padding: 16px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                margin-bottom: 20px;
            }
            
            .backup-options h3 {
                font-size: 14px;
                margin-bottom: 12px;
            }
            
            .checkbox-label {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 8px;
                cursor: pointer;
            }
            
            .form-actions {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            
            .cancel-btn,
            .create-btn {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
            }
            
            .cancel-btn {
                background: transparent;
                border: 1px solid var(--mica-border);
                color: white;
            }
            
            .create-btn {
                background: var(--accent);
                color: white;
            }
            
            /* Restore View */
            .view-description {
                margin-bottom: 20px;
                opacity: 0.7;
            }
            
            .restore-backups-list {
                margin-bottom: 20px;
            }
            
            .restore-item {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                margin-bottom: 8px;
                cursor: pointer;
            }
            
            .restore-item:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .restore-item-info {
                flex: 1;
            }
            
            .restore-item-name {
                font-size: 16px;
                font-weight: 500;
                margin-bottom: 4px;
            }
            
            .restore-item-date {
                font-size: 12px;
                opacity: 0.7;
            }
            
            .restore-item-meta {
                display: flex;
                gap: 16px;
                font-size: 12px;
            }
            
            .select-restore-btn {
                padding: 6px 12px;
                background: var(--accent);
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
            }
            
            .restore-options {
                padding: 20px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                margin-top: 20px;
            }
            
            .restore-options h3 {
                margin-bottom: 16px;
            }
            
            .start-restore-btn {
                width: 100%;
                padding: 12px;
                background: var(--accent);
                border: none;
                border-radius: 6px;
                color: white;
                cursor: pointer;
            }
            
            /* Schedules View */
            .add-schedule-btn {
                margin-left: auto;
                padding: 8px 16px;
                background: var(--accent);
                border: none;
                border-radius: 6px;
                color: white;
                cursor: pointer;
            }
            
            .schedules-list {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            
            .schedule-card {
                padding: 20px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
            }
            
            .schedule-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }
            
            .schedule-header h3 {
                font-size: 16px;
                font-weight: 500;
            }
            
            .toggle-switch {
                position: relative;
                display: inline-block;
                width: 44px;
                height: 24px;
            }
            
            .toggle-switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            
            .toggle-slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(255,255,255,0.2);
                transition: 0.2s;
                border-radius: 24px;
            }
            
            .toggle-slider:before {
                position: absolute;
                content: "";
                height: 18px;
                width: 18px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                transition: 0.2s;
                border-radius: 50%;
            }
            
            input:checked + .toggle-slider {
                background-color: var(--accent);
            }
            
            input:checked + .toggle-slider:before {
                transform: translateX(20px);
            }
            
            .schedule-details {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
                margin-bottom: 16px;
            }
            
            .detail-label {
                opacity: 0.7;
                margin-right: 8px;
            }
            
            .schedule-actions {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
            }
            
            .edit-schedule-btn,
            .delete-schedule-btn {
                padding: 6px 12px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            
            .edit-schedule-btn {
                background: transparent;
                border: 1px solid var(--mica-border);
                color: white;
            }
            
            .delete-schedule-btn {
                background: #ff5252;
                color: white;
            }
            
            .no-schedules {
                text-align: center;
                padding: 40px;
                opacity: 0.7;
            }
            
            .add-first-schedule {
                margin-top: 16px;
                padding: 8px 16px;
                background: var(--accent);
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
            }
            
            /* Backup Details */
            .details-section {
                padding: 20px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                margin-bottom: 20px;
            }
            
            .details-section h3 {
                font-size: 16px;
                margin-bottom: 16px;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--mica-border);
            }
            
            .detail-row {
                display: flex;
                padding: 8px 0;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            
            .detail-label {
                width: 100px;
                font-weight: 500;
                opacity: 0.7;
            }
            
            .detail-value {
                flex: 1;
            }
            
            .status-completed {
                color: #4CAF50;
            }
            
            .contents-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .content-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px;
                background: rgba(255,255,255,0.03);
                border-radius: 6px;
            }
            
            .content-icon {
                font-size: 16px;
                width: 24px;
            }
            
            .content-name {
                flex: 1;
                font-size: 13px;
                text-transform: capitalize;
            }
            
            .content-status.included {
                color: #4CAF50;
            }
            
            .content-status.excluded {
                color: #ff5252;
            }
            
            .details-actions {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                margin-top: 20px;
            }
            
            .restore-this-btn,
            .verify-btn,
            .export-btn,
            .delete-this-btn {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
            }
            
            .restore-this-btn {
                background: var(--accent);
                color: white;
            }
            
            .verify-btn {
                background: transparent;
                border: 1px solid var(--mica-border);
                color: white;
            }
            
            .export-btn {
                background: #4CAF50;
                color: white;
            }
            
            .delete-this-btn {
                background: #ff5252;
                color: white;
            }
            
            /* Light theme */
            .light-theme .backup-app {
                color: black;
            }
            
            .light-theme .action-btn,
            .light-theme .tab-btn,
            .light-theme .back-btn,
            .light-theme .form-group input,
            .light-theme .form-group textarea,
            .light-theme .form-group select,
            .light-theme .cancel-btn,
            .light-theme .edit-schedule-btn {
                color: black;
            }
        `;
        
        document.head.appendChild(style);
    }
}

window.BackupApp = BackupApp;
window.backupApp = null; // Will be set when app is instantiated
