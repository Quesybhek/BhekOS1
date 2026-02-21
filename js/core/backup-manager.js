/**
 * BhekOS Backup Manager - Complete backup and restore system
 */
const BackupManager = {
    os: null,
    
    // Backups storage
    backups: new Map(),
    
    // Backup schedules
    schedules: new Map(),
    
    // Current backup status
    status: 'idle', // idle, backing_up, restoring, verifying
    
    // Backup settings
    settings: {
        autoBackup: false,
        backupInterval: 24 * 60 * 60 * 1000, // 24 hours
        backupTime: '02:00', // 2 AM
        keepBackups: 10,
        backupLocation: '/Backups',
        compressBackups: true,
        encryptBackups: true,
        verifyAfterBackup: true,
        notifyOnCompletion: true,
        includeSystem: true,
        includeUsers: true,
        includeApps: true,
        includeFiles: true,
        includeSettings: true,
        maxBackupSize: 1024 * 1024 * 1024, // 1GB
        backupFormats: ['zip', 'tar', 'bhek'], // Supported formats
        preferredFormat: 'bhek'
    },
    
    // Backup history
    history: [],
    
    // Progress tracking
    progress: {
        current: 0,
        total: 0,
        phase: '',
        item: ''
    },
    
    async init(os) {
        this.os = os;
        console.log('Backup Manager initializing...');
        
        await this.loadSettings();
        await this.loadBackups();
        await this.loadSchedules();
        this.setupListeners();
        
        if (this.settings.autoBackup) {
            this.scheduleAutoBackup();
        }
        
        console.log(`Backup Manager ready: ${this.backups.size} backups, ${this.schedules.size} schedules`);
        return this;
    },
    
    async loadSettings() {
        const saved = await this.os.modules.Storage.get('backup_settings', {});
        this.settings = { ...this.settings, ...saved };
    },
    
    async saveSettings() {
        await this.os.modules.Storage.set('backup_settings', this.settings);
    },
    
    async loadBackups() {
        const saved = await this.os.modules.Storage.get('backups', []);
        
        saved.forEach(backup => {
            this.backups.set(backup.id, backup);
        });
    },
    
    async saveBackups() {
        const backups = Array.from(this.backups.values());
        await this.os.modules.Storage.set('backups', backups);
    },
    
    async loadSchedules() {
        const saved = await this.os.modules.Storage.get('backup_schedules', []);
        
        saved.forEach(schedule => {
            this.schedules.set(schedule.id, schedule);
        });
    },
    
    async saveSchedules() {
        const schedules = Array.from(this.schedules.values());
        await this.os.modules.Storage.set('backup_schedules', schedules);
    },
    
    setupListeners() {
        // Listen for system events that might trigger backup
        this.os.modules.EventBus.on('system:shutdown', () => {
            if (this.status === 'backing_up') {
                this.cancelBackup();
            }
        });
        
        // Check schedules periodically
        setInterval(() => {
            this.checkSchedules();
        }, 60000); // Check every minute
    },
    
    // ==================== BACKUP CREATION ====================
    
    async createBackup(options = {}) {
        if (this.status !== 'idle') {
            throw new Error(`Cannot create backup while ${this.status}`);
        }
        
        this.status = 'backing_up';
        this.progress = { current: 0, total: 0, phase: 'initializing', item: '' };
        
        const backupId = 'backup_' + Date.now() + '_' + BhekHelpers.randomString(4);
        const backup = {
            id: backupId,
            name: options.name || `Backup ${new Date().toLocaleString()}`,
            description: options.description || '',
            createdAt: Date.now(),
            size: 0,
            format: options.format || this.settings.preferredFormat,
            compressed: options.compress !== undefined ? options.compress : this.settings.compressBackups,
            encrypted: options.encrypt !== undefined ? options.encrypt : this.settings.encryptBackups,
            include: {
                system: options.includeSystem ?? this.settings.includeSystem,
                users: options.includeUsers ?? this.settings.includeUsers,
                apps: options.includeApps ?? this.settings.includeApps,
                files: options.includeFiles ?? this.settings.includeFiles,
                settings: options.includeSettings ?? this.settings.includeSettings
            },
            status: 'in_progress',
            data: {},
            manifest: {
                version: '1.0',
                osVersion: this.os.version,
                created: Date.now(),
                createdBy: this.os.modules.Security?.getCurrentUser()?.username || 'system'
            }
        };
        
        this.backups.set(backupId, backup);
        this.os.modules.EventBus.emit('backup:started', { backupId });
        
        try {
            // Calculate total steps
            const steps = [];
            if (backup.include.system) steps.push('system');
            if (backup.include.users) steps.push('users');
            if (backup.include.apps) steps.push('apps');
            if (backup.include.files) steps.push('files');
            if (backup.include.settings) steps.push('settings');
            
            this.progress.total = steps.length;
            
            // Backup each component
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                this.progress.current = i;
                this.progress.phase = `backing_up_${step}`;
                
                switch (step) {
                    case 'system':
                        await this.backupSystem(backup);
                        break;
                    case 'users':
                        await this.backupUsers(backup);
                        break;
                    case 'apps':
                        await this.backupApps(backup);
                        break;
                    case 'files':
                        await this.backupFiles(backup);
                        break;
                    case 'settings':
                        await this.backupSettings(backup);
                        break;
                }
                
                this.os.modules.EventBus.emit('backup:progress', {
                    backupId,
                    progress: (i + 1) / steps.length * 100,
                    phase: step
                });
            }
            
            // Calculate total size
            backup.size = this.calculateBackupSize(backup);
            
            // Compress if needed
            if (backup.compressed) {
                await this.compressBackup(backup);
            }
            
            // Encrypt if needed
            if (backup.encrypted) {
                await this.encryptBackup(backup);
            }
            
            // Save to storage
            backup.status = 'completed';
            backup.completedAt = Date.now();
            
            // Save backup file
            await this.saveBackupFile(backup);
            
            // Verify if requested
            if (this.settings.verifyAfterBackup) {
                await this.verifyBackup(backupId);
            }
            
            // Trim old backups
            await this.trimOldBackups();
            
            this.status = 'idle';
            this.progress = { current: 0, total: 0, phase: '', item: '' };
            
            this.addToHistory({
                type: 'backup',
                action: 'created',
                backupId,
                size: backup.size,
                timestamp: Date.now()
            });
            
            this.os.modules.EventBus.emit('backup:completed', {
                backupId,
                size: backup.size
            });
            
            if (this.settings.notifyOnCompletion) {
                this.os.notify('Backup', `Backup completed: ${backup.name}`, 'success');
            }
            
            await this.saveBackups();
            
            return backup;
            
        } catch (error) {
            backup.status = 'failed';
            backup.error = error.message;
            this.status = 'idle';
            
            this.addToHistory({
                type: 'backup',
                action: 'failed',
                backupId,
                error: error.message,
                timestamp: Date.now()
            });
            
            this.os.modules.EventBus.emit('backup:failed', {
                backupId,
                error: error.message
            });
            
            if (this.settings.notifyOnCompletion) {
                this.os.notify('Backup', `Backup failed: ${error.message}`, 'error');
            }
            
            await this.saveBackups();
            throw error;
        }
    },
    
    async backupSystem(backup) {
        this.progress.item = 'System information';
        
        backup.data.system = {
            version: this.os.version,
            build: this.os.build,
            uptime: this.os.modules.SystemMonitor?.metrics.uptime,
            deviceName: this.os.modules.Settings?.get('system.deviceName'),
            performance: this.os.modules.Settings?.get('system.performance'),
            startupApps: this.os.modules.Settings?.get('system.startupApps'),
            network: {
                hostname: window.location.hostname,
                userAgent: navigator.userAgent,
                platform: navigator.platform
            }
        };
    },
    
    async backupUsers(backup) {
        this.progress.item = 'User data';
        
        const users = this.os.modules.UserManager?.getAllUsers() || [];
        backup.data.users = users.map(user => ({
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            role: user.role,
            groups: user.groups,
            preferences: user.preferences,
            createdAt: user.createdAt,
            // Don't include passwords or sensitive data
        }));
    },
    
    async backupApps(backup) {
        this.progress.item = 'Applications';
        
        const apps = this.os.modules.AppStore?.getInstalledApps() || [];
        backup.data.apps = apps.map(app => ({
            id: app.id,
            name: app.name,
            version: app.version,
            installDate: app.installDate,
            settings: app.settings
        }));
    },
    
    async backupFiles(backup) {
        this.progress.item = 'Files';
        
        backup.data.files = [];
        
        const scanDirectory = async (path) => {
            const items = await this.os.modules.FileSystem?.listDirectory(path, { includeHidden: true }) || [];
            
            for (const item of items) {
                if (item.type === 'folder') {
                    await scanDirectory(item.path);
                } else {
                    try {
                        const content = await this.os.modules.FileSystem?.readFile(item.path, { encoding: 'binary' });
                        backup.data.files.push({
                            path: item.path,
                            name: item.name,
                            size: item.size,
                            modified: item.modified,
                            content
                        });
                        
                        // Check size limit
                        if (backup.data.files.reduce((sum, f) => sum + f.size, 0) > this.settings.maxBackupSize) {
                            throw new Error('Backup size limit exceeded');
                        }
                    } catch (error) {
                        console.warn(`Failed to backup file ${item.path}:`, error);
                    }
                }
            }
        };
        
        await scanDirectory('/');
    },
    
    async backupSettings(backup) {
        this.progress.item = 'Settings';
        
        backup.data.settings = this.os.modules.Settings?.getAll() || {};
    },
    
    calculateBackupSize(backup) {
        let size = 0;
        
        const measure = (obj) => {
            if (typeof obj === 'string') {
                size += obj.length;
            } else if (obj && typeof obj === 'object') {
                Object.values(obj).forEach(measure);
            }
        };
        
        measure(backup.data);
        return size;
    },
    
    async compressBackup(backup) {
        this.progress.phase = 'compressing';
        
        // Simple compression simulation
        backup.data = {
            compressed: true,
            originalSize: backup.size,
            data: btoa(JSON.stringify(backup.data))
        };
        
        backup.size = backup.data.data.length;
    },
    
    async encryptBackup(backup) {
        this.progress.phase = 'encrypting';
        
        if (this.os.modules.Security) {
            const user = this.os.modules.Security.getCurrentUser();
            if (user) {
                const encrypted = await this.os.modules.Security.encryptUserData(backup.data);
                backup.data = {
                    encrypted: true,
                    data: encrypted
                };
            }
        }
    },
    
    async saveBackupFile(backup) {
        this.progress.phase = 'saving';
        
        // Create backup file in file system
        const filename = `${backup.id}.${backup.format}`;
        const path = `${this.settings.backupLocation}/${filename}`;
        
        const content = JSON.stringify(backup, null, 2);
        
        if (this.os.modules.FileSystem) {
            await this.os.modules.FileSystem.writeFile(path, content);
        }
        
        // Also keep in memory for quick access
        this.backups.set(backup.id, backup);
    },
    
    // ==================== RESTORE ====================
    
    async restoreBackup(backupId, options = {}) {
        if (this.status !== 'idle') {
            throw new Error(`Cannot restore while ${this.status}`);
        }
        
        const backup = this.backups.get(backupId);
        if (!backup) throw new Error('Backup not found');
        
        this.status = 'restoring';
        this.progress = { current: 0, total: 0, phase: 'initializing', item: '' };
        
        this.os.modules.EventBus.emit('restore:started', { backupId });
        
        try {
            // Load backup data
            let data = backup.data;
            
            // Decrypt if needed
            if (data.encrypted) {
                data = await this.os.modules.Security?.decryptUserData(data.data);
            }
            
            // Decompress if needed
            if (data.compressed) {
                data = JSON.parse(atob(data.data));
            }
            
            // Calculate total steps
            const steps = [];
            if (data.system) steps.push('system');
            if (data.users) steps.push('users');
            if (data.apps) steps.push('apps');
            if (data.files) steps.push('files');
            if (data.settings) steps.push('settings');
            
            this.progress.total = steps.length;
            
            // Restore each component
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                this.progress.current = i;
                this.progress.phase = `restoring_${step}`;
                
                switch (step) {
                    case 'system':
                        await this.restoreSystem(data.system);
                        break;
                    case 'users':
                        await this.restoreUsers(data.users);
                        break;
                    case 'apps':
                        await this.restoreApps(data.apps);
                        break;
                    case 'files':
                        await this.restoreFiles(data.files);
                        break;
                    case 'settings':
                        await this.restoreSettings(data.settings);
                        break;
                }
                
                this.os.modules.EventBus.emit('restore:progress', {
                    backupId,
                    progress: (i + 1) / steps.length * 100,
                    phase: step
                });
            }
            
            this.status = 'idle';
            
            this.addToHistory({
                type: 'restore',
                action: 'completed',
                backupId,
                timestamp: Date.now()
            });
            
            this.os.modules.EventBus.emit('restore:completed', { backupId });
            
            if (this.settings.notifyOnCompletion) {
                this.os.notify('Restore', `Restore completed: ${backup.name}`, 'success');
            }
            
        } catch (error) {
            this.status = 'idle';
            
            this.addToHistory({
                type: 'restore',
                action: 'failed',
                backupId,
                error: error.message,
                timestamp: Date.now()
            });
            
            this.os.modules.EventBus.emit('restore:failed', {
                backupId,
                error: error.message
            });
            
            if (this.settings.notifyOnCompletion) {
                this.os.notify('Restore', `Restore failed: ${error.message}`, 'error');
            }
            
            throw error;
        }
    },
    
    async restoreSystem(data) {
        this.progress.item = 'System information';
        // System restore would require careful implementation
        console.log('Restoring system:', data);
    },
    
    async restoreUsers(data) {
        this.progress.item = 'User data';
        
        for (const userData of data) {
            // Check if user exists
            const existing = this.os.modules.UserManager?.findUserByUsername(userData.username);
            
            if (!existing) {
                await this.os.modules.UserManager?.createUser({
                    username: userData.username,
                    name: userData.name,
                    email: userData.email,
                    role: userData.role,
                    groups: userData.groups,
                    preferences: userData.preferences
                });
            }
        }
    },
    
    async restoreApps(data) {
        this.progress.item = 'Applications';
        
        for (const appData of data) {
            const installed = this.os.modules.AppStore?.isInstalled(appData.id);
            
            if (!installed) {
                try {
                    await this.os.modules.AppStore?.installApp(appData.id);
                    
                    // Restore app settings
                    if (appData.settings) {
                        await this.os.modules.AppStore?.saveAppSettings(appData.id, appData.settings);
                    }
                } catch (error) {
                    console.warn(`Failed to restore app ${appData.name}:`, error);
                }
            }
        }
    },
    
    async restoreFiles(data) {
        this.progress.item = 'Files';
        
        for (const fileData of data) {
            try {
                await this.os.modules.FileSystem?.writeFile(
                    fileData.path,
                    fileData.content,
                    { metadata: { restored: true } }
                );
            } catch (error) {
                console.warn(`Failed to restore file ${fileData.path}:`, error);
            }
        }
    },
    
    async restoreSettings(data) {
        this.progress.item = 'Settings';
        
        if (this.os.modules.Settings) {
            await this.os.modules.Settings.importSettings(data);
        }
    },
    
    // ==================== BACKUP VERIFICATION ====================
    
    async verifyBackup(backupId) {
        const backup = this.backups.get(backupId);
        if (!backup) throw new Error('Backup not found');
        
        this.status = 'verifying';
        this.progress = { current: 0, total: 0, phase: 'verifying', item: '' };
        
        try {
            // Check if backup file exists
            const path = `${this.settings.backupLocation}/${backup.id}.${backup.format}`;
            const file = await this.os.modules.FileSystem?.get(path);
            
            if (!file) {
                throw new Error('Backup file not found');
            }
            
            // Verify integrity
            const content = await this.os.modules.FileSystem?.readFile(path);
            const parsed = JSON.parse(content);
            
            // Check manifest
            if (parsed.manifest.version !== backup.manifest.version) {
                throw new Error('Backup version mismatch');
            }
            
            // Check data integrity (simplified)
            if (backup.encrypted) {
                // Would need to verify encryption
            }
            
            backup.verified = true;
            backup.verifiedAt = Date.now();
            
            this.addToHistory({
                type: 'verify',
                action: 'completed',
                backupId,
                timestamp: Date.now()
            });
            
            this.os.modules.EventBus.emit('backup:verified', { backupId });
            
        } catch (error) {
            this.addToHistory({
                type: 'verify',
                action: 'failed',
                backupId,
                error: error.message,
                timestamp: Date.now()
            });
            
            throw error;
        } finally {
            this.status = 'idle';
        }
    },
    
    // ==================== BACKUP MANAGEMENT ====================
    
    getBackups() {
        return Array.from(this.backups.values())
            .sort((a, b) => b.createdAt - a.createdAt);
    },
    
    getBackup(backupId) {
        return this.backups.get(backupId);
    },
    
    async deleteBackup(backupId) {
        const backup = this.backups.get(backupId);
        if (!backup) return;
        
        // Delete backup file
        const path = `${this.settings.backupLocation}/${backup.id}.${backup.format}`;
        await this.os.modules.FileSystem?.delete(path, true);
        
        // Remove from memory
        this.backups.delete(backupId);
        await this.saveBackups();
        
        this.addToHistory({
            type: 'backup',
            action: 'deleted',
            backupId,
            timestamp: Date.now()
        });
        
        this.os.modules.EventBus.emit('backup:deleted', { backupId });
    },
    
    async trimOldBackups() {
        const backups = this.getBackups();
        
        if (backups.length > this.settings.keepBackups) {
            const toDelete = backups.slice(this.settings.keepBackups);
            
            for (const backup of toDelete) {
                await this.deleteBackup(backup.id);
            }
        }
    },
    
    async exportBackup(backupId) {
        const backup = this.backups.get(backupId);
        if (!backup) throw new Error('Backup not found');
        
        const filename = `${backup.name.replace(/[^a-z0-9]/gi, '_')}.${backup.format}`;
        const content = JSON.stringify(backup, null, 2);
        
        BhekHelpers.downloadFile(filename, content, 'application/json');
    },
    
    async importBackup(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const backup = JSON.parse(e.target.result);
                    
                    // Validate backup format
                    if (!backup.id || !backup.manifest) {
                        throw new Error('Invalid backup format');
                    }
                    
                    // Check if backup already exists
                    if (this.backups.has(backup.id)) {
                        backup.id = backup.id + '_imported';
                    }
                    
                    this.backups.set(backup.id, backup);
                    await this.saveBackups();
                    
                    // Save backup file
                    const path = `${this.settings.backupLocation}/${backup.id}.${backup.format}`;
                    await this.os.modules.FileSystem?.writeFile(path, e.target.result);
                    
                    resolve(backup);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    },
    
    // ==================== SCHEDULED BACKUPS ====================
    
    createSchedule(options) {
        const scheduleId = 'schedule_' + BhekHelpers.generateId();
        
        const schedule = {
            id: scheduleId,
            name: options.name || 'Scheduled Backup',
            enabled: options.enabled !== false,
            interval: options.interval || this.settings.backupInterval,
            time: options.time || this.settings.backupTime,
            days: options.days || [1, 2, 3, 4, 5, 6, 7], // All days
            lastRun: null,
            nextRun: this.calculateNextRun(options),
            options: {
                includeSystem: options.includeSystem ?? this.settings.includeSystem,
                includeUsers: options.includeUsers ?? this.settings.includeUsers,
                includeApps: options.includeApps ?? this.settings.includeApps,
                includeFiles: options.includeFiles ?? this.settings.includeFiles,
                includeSettings: options.includeSettings ?? this.settings.includeSettings
            },
            createdAt: Date.now(),
            createdBy: this.os.modules.Security?.getCurrentUser()?.username
        };
        
        this.schedules.set(scheduleId, schedule);
        this.saveSchedules();
        
        this.os.modules.EventBus.emit('backup:schedule_created', { scheduleId });
        
        return schedule;
    },
    
    updateSchedule(scheduleId, updates) {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) throw new Error('Schedule not found');
        
        Object.assign(schedule, updates);
        
        if (updates.time || updates.days) {
            schedule.nextRun = this.calculateNextRun(schedule);
        }
        
        this.saveSchedules();
        this.os.modules.EventBus.emit('backup:schedule_updated', { scheduleId });
    },
    
    deleteSchedule(scheduleId) {
        this.schedules.delete(scheduleId);
        this.saveSchedules();
        this.os.modules.EventBus.emit('backup:schedule_deleted', { scheduleId });
    },
    
    getSchedules() {
        return Array.from(this.schedules.values());
    },
    
    calculateNextRun(schedule) {
        const now = new Date();
        const [hours, minutes] = schedule.time.split(':').map(Number);
        
        let next = new Date();
        next.setHours(hours, minutes, 0, 0);
        
        // If today's time has passed, move to next day
        if (next <= now) {
            next.setDate(next.getDate() + 1);
        }
        
        // Find next allowed day
        while (!schedule.days.includes(next.getDay())) {
            next.setDate(next.getDate() + 1);
        }
        
        return next.getTime();
    },
    
    scheduleAutoBackup() {
        // Clear existing interval
        if (this.scheduleInterval) {
            clearInterval(this.scheduleInterval);
        }
        
        // Check schedules every minute
        this.scheduleInterval = setInterval(() => {
            this.checkSchedules();
        }, 60000);
    },
    
    async checkSchedules() {
        const now = Date.now();
        
        for (const schedule of this.schedules.values()) {
            if (!schedule.enabled) continue;
            
            if (schedule.nextRun <= now) {
                // Run backup
                try {
                    await this.createBackup({
                        name: schedule.name,
                        ...schedule.options
                    });
                    
                    // Update schedule
                    schedule.lastRun = now;
                    schedule.nextRun = this.calculateNextRun(schedule);
                    
                    this.addToHistory({
                        type: 'schedule',
                        action: 'executed',
                        scheduleId: schedule.id,
                        timestamp: now
                    });
                    
                } catch (error) {
                    this.addToHistory({
                        type: 'schedule',
                        action: 'failed',
                        scheduleId: schedule.id,
                        error: error.message,
                        timestamp: now
                    });
                }
                
                this.saveSchedules();
            }
        }
    },
    
    // ==================== BACKUP HISTORY ====================
    
    addToHistory(entry) {
        this.history.push(entry);
        
        // Trim history
        if (this.history.length > 1000) {
            this.history = this.history.slice(-1000);
        }
    },
    
    getHistory(limit = 100) {
        return this.history.slice(-limit);
    },
    
    // ==================== UTILITY METHODS ====================
    
    cancelBackup() {
        if (this.status === 'backing_up') {
            this.status = 'idle';
            this.os.modules.EventBus.emit('backup:cancelled');
        }
    },
    
    getStatus() {
        return {
            status: this.status,
            progress: this.progress,
            backups: this.backups.size,
            schedules: this.schedules.size,
            settings: this.settings,
            lastBackup: this.getBackups()[0]?.createdAt,
            totalSize: this.getBackups().reduce((sum, b) => sum + b.size, 0)
        };
    },
    
    getBackupStats() {
        const backups = this.getBackups();
        
        return {
            total: backups.length,
            totalSize: backups.reduce((sum, b) => sum + b.size, 0),
            averageSize: backups.length ? 
                backups.reduce((sum, b) => sum + b.size, 0) / backups.length : 0,
            lastBackup: backups[0]?.createdAt,
            byMonth: this.groupBackupsByMonth(backups)
        };
    },
    
    groupBackupsByMonth(backups) {
        const groups = {};
        
        backups.forEach(backup => {
            const date = new Date(backup.createdAt);
            const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
            
            if (!groups[key]) {
                groups[key] = { count: 0, size: 0 };
            }
            
            groups[key].count++;
            groups[key].size += backup.size;
        });
        
        return groups;
    },
    
    async updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        await this.saveSettings();
        
        if (this.settings.autoBackup) {
            this.scheduleAutoBackup();
        }
    },
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
    }
};

window.BackupManager = BackupManager;
