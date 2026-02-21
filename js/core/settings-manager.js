/**
 * BhekOS Settings Manager - Complete system configuration with collaboration
 */
const SettingsManager = {
    os: null,
    
    // All settings categories
    categories: [
        { id: 'personalization', name: 'Personalization', icon: '🎨' },
        { id: 'system', name: 'System', icon: '⚙️' },
        { id: 'security', name: 'Security & Privacy', icon: '🔐' },
        { id: 'apps', name: 'Apps', icon: '📱' },
        { id: 'network', name: 'Network & Internet', icon: '🌐' },
        { id: 'account', name: 'Accounts', icon: '👤' },
        { id: 'accessibility', name: 'Accessibility', icon: '♿' },
        { id: 'update', name: 'Updates & Security', icon: '🔄' },
        { id: 'storage', name: 'Storage', icon: '💾' },
        { id: 'language', name: 'Language & Region', icon: '🌍' },
        { id: 'sync', name: 'Sync & Backup', icon: '☁️' }, // Phase 3
        { id: 'collaboration', name: 'Collaboration', icon: '👥' } // Phase 3
    ],
    
    // Default settings
    defaults: {
        personalization: {
            theme: 'dark',
            accentColor: '#0078d4',
            wallpaper: 'default',
            wallpaperFit: 'cover',
            transparency: true,
            animations: true,
            startButtonStyle: 'modern',
            taskbarAlignment: 'center',
            showTaskbarLabels: false,
            combineTaskbarIcons: true,
            showDesktopIcons: true,
            iconSize: 'medium',
            fontSize: 'medium',
            fontFamily: 'system'
        },
        
        system: {
            deviceName: 'BhekOS-PC',
            performance: 'balanced',
            batterySaver: false,
            startupApps: [],
            defaultApps: {},
            notifications: true,
            focusAssist: false,
            multitasking: true,
            snapWindows: true,
            shakeToMinimize: true
        },
        
        security: {
            requirePasswordOnWake: true,
            autoLock: true,
            autoLockMinutes: 5,
            showLockScreen: true,
            allowRemoteDesktop: false,
            firewall: true,
            antivirus: true,
            secureBoot: true,
            encryption: true,
            appPasswords: {},
            twoFactorAuth: false
        },
        
        apps: {
            autoUpdate: true,
            installUnknownSources: false,
            appNotifications: true,
            backgroundApps: true,
            defaultAppPermissions: {}
        },
        
        network: {
            airplaneMode: false,
            wifiEnabled: true,
            bluetoothEnabled: true,
            meteredConnection: false,
            proxyEnabled: false,
            proxyServer: '',
            proxyPort: '',
            dnsServers: []
        },
        
        account: {
            username: 'user',
            fullName: 'BhekOS User',
            email: '',
            profilePicture: null,
            syncSettings: true,
            syncFiles: false,
            onlineStatus: 'online',
            presenceEnabled: true // Phase 3
        },
        
        accessibility: {
            highContrast: false,
            magnifier: false,
            magnifierZoom: 100,
            narrator: false,
            stickyKeys: false,
            filterKeys: false,
            toggleKeys: false,
            mouseKeys: false,
            textSize: 'normal',
            reduceMotion: false,
            reduceTransparency: false
        },
        
        updates: {
            autoDownload: true,
            autoInstall: false,
            updateTime: '03:00',
            lastChecked: null,
            lastInstalled: null,
            updateChannel: 'stable'
        },
        
        storage: {
            storageSense: true,
            deleteTempFiles: true,
            autoDeleteRecycleBin: false,
            recycleBinDays: 30,
            storageLocation: 'local',
            backupEnabled: false,
            backupLocation: '',
            autoBackup: false,
            backupFrequency: 'daily'
        },
        
        language: {
            language: 'en-US',
            region: 'US',
            dateFormat: 'MM/dd/yyyy',
            timeFormat: '12h',
            firstDayOfWeek: 'monday',
            measurementSystem: 'imperial',
            keyboardLayout: 'us'
        },
        
        // Phase 3: Sync settings
        sync: {
            enabled: false,
            provider: 'internal',
            syncInterval: 5 * 60 * 1000, // 5 minutes
            syncOnChange: true,
            syncOverMetered: false,
            lastSync: null,
            conflicts: 'ask', // 'ask', 'local', 'remote'
            syncSettings: true,
            syncFiles: false,
            syncApps: false
        },
        
        // Phase 3: Collaboration settings
        collaboration: {
            presenceEnabled: true,
            showTyping: true,
            showCursors: true,
            autoAcceptShares: false,
            shareNotifications: true,
            maxCollaborators: 10,
            presenceTimeout: 5 * 60 * 1000, // 5 minutes
            activityBroadcast: true
        }
    },
    
    // Current settings
    settings: {},
    
    // Settings listeners
    listeners: new Map(),
    
    // Settings history for undo/redo
    history: [],
    historyIndex: -1,
    maxHistory: 50,
    
    // ==================== INITIALIZATION ====================
    
    async init(os) {
        this.os = os;
        console.log('Settings Manager initializing...');
        
        await this.loadSettings();
        await this.applySettings();
        this.setupAutoSave();
        this.setupSync(); // Phase 3
        
        console.log('Settings Manager ready');
        return this;
    },
    
    async loadSettings() {
        const saved = await this.os.modules.Storage.get('settings', {});
        this.settings = this.deepMerge(this.defaults, saved);
        this.addToHistory(this.settings);
    },
    
    async saveSettings() {
        await this.os.modules.Storage.set('settings', this.settings);
        
        // Sync if enabled
        if (this.get('sync.enabled')) {
            this.os.modules.CloudSync?.queueSync('settings', this.settings);
        }
        
        this.os.modules.EventBus.emit('settings:saved', this.settings);
    },
    
    // ==================== GET/SET SETTINGS ====================
    
    getAll() {
        return this.deepClone(this.settings);
    },
    
    getCategory(category) {
        return this.deepClone(this.settings[category] || {});
    },
    
    get(path, defaultValue = null) {
        const parts = path.split('.');
        let current = this.settings;
        
        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = current[part];
            } else {
                return defaultValue;
            }
        }
        
        return current !== undefined ? current : defaultValue;
    },
    
    async set(path, value, saveToHistory = true) {
        const oldValue = this.get(path);
        if (oldValue === value) return;
        
        const parts = path.split('.');
        let current = this.settings;
        
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!current[part]) current[part] = {};
            current = current[part];
        }
        
        const lastPart = parts[parts.length - 1];
        current[lastPart] = value;
        
        if (saveToHistory) {
            this.addToHistory(this.settings, { path, oldValue, newValue: value });
        }
        
        await this.applySetting(path, value);
        await this.saveSettings();
        this.notifyListeners(path, value, oldValue);
    },
    
    async setMany(settings) {
        for (const [path, value] of Object.entries(settings)) {
            await this.set(path, value, false);
        }
        this.addToHistory(this.settings, { type: 'batch', changes: settings });
    },
    
    async resetCategory(category) {
        if (this.defaults[category]) {
            this.settings[category] = this.deepClone(this.defaults[category]);
            await this.applyCategory(category);
            await this.saveSettings();
            this.notifyListeners(`category:${category}`, this.settings[category]);
        }
    },
    
    async resetAll() {
        this.settings = this.deepClone(this.defaults);
        await this.applySettings();
        await this.saveSettings();
        this.addToHistory(this.settings);
        this.notifyListeners('*', this.settings);
    },
    
    // ==================== APPLY SETTINGS ====================
    
    async applySettings() {
        await this.applyTheme();
        await this.applyWallpaper();
        await this.applyAccentColor();
        await this.applyAnimations();
        await this.applyFontSettings();
        await this.applyAccessibility();
        await this.applySyncSettings(); // Phase 3
    },
    
    async applySetting(path, value) {
        switch (path) {
            case 'personalization.theme':
                await this.applyTheme();
                break;
            case 'personalization.wallpaper':
            case 'personalization.wallpaperFit':
                await this.applyWallpaper();
                break;
            case 'personalization.accentColor':
                await this.applyAccentColor();
                break;
            case 'personalization.animations':
                await this.applyAnimations();
                break;
            case 'personalization.transparency':
                await this.applyTransparency();
                break;
            case 'personalization.fontFamily':
            case 'personalization.fontSize':
                await this.applyFontSettings();
                break;
            case 'accessibility.highContrast':
            case 'accessibility.magnifier':
            case 'accessibility.reduceMotion':
            case 'accessibility.reduceTransparency':
                await this.applyAccessibility();
                break;
            case 'system.performance':
                await this.applyPerformanceMode();
                break;
            case 'sync.enabled':
                await this.applySyncSettings();
                break;
            case 'collaboration.presenceEnabled':
                await this.applyPresenceSettings();
                break;
        }
    },
    
    async applyCategory(category) {
        switch (category) {
            case 'personalization':
                await this.applyTheme();
                await this.applyWallpaper();
                await this.applyAccentColor();
                await this.applyAnimations();
                await this.applyFontSettings();
                break;
            case 'accessibility':
                await this.applyAccessibility();
                break;
            case 'system':
                await this.applyPerformanceMode();
                break;
            case 'sync':
                await this.applySyncSettings();
                break;
            case 'collaboration':
                await this.applyPresenceSettings();
                break;
        }
    },
    
    // ==================== SPECIFIC APPLICATORS ====================
    
    async applyTheme() {
        const theme = this.get('personalization.theme', 'dark');
        document.body.className = theme + '-theme';
        
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', 
            theme === 'dark' ? '#1e1e1e' : '#f3f3f3');
        
        this.os.modules.EventBus.emit('theme:changed', theme);
    },
    
    async applyWallpaper() {
        const wallpaper = this.get('personalization.wallpaper', 'default');
        const fit = this.get('personalization.wallpaperFit', 'cover');
        
        const wallpapers = {
            'default': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=2564&q=80',
            'nature': 'https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=2564&q=80',
            'abstract': 'https://images.unsplash.com/photo-1550684376-efcbd6e3f031?auto=format&fit=crop&w=2564&q=80',
            'gradient': 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?auto=format&fit=crop&w=2564&q=80',
            'beach': 'https://images.unsplash.com/photo-1507525425510-1e2d6d7a2d3e?auto=format&fit=crop&w=2564&q=80',
            'mountains': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2564&q=80',
            'city': 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=2564&q=80',
            'space': 'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?auto=format&fit=crop&w=2564&q=80'
        };
        
        const wallpaperUrl = wallpapers[wallpaper] || wallpapers.default;
        const desktop = document.getElementById('desktop');
        
        if (desktop) {
            desktop.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.9)), url('${wallpaperUrl}')`;
            desktop.style.backgroundSize = fit;
            desktop.style.backgroundPosition = 'center';
            desktop.style.backgroundRepeat = 'no-repeat';
        }
        
        this.os.modules.EventBus.emit('wallpaper:changed', { wallpaper, fit });
    },
    
    async applyAccentColor() {
        const color = this.get('personalization.accentColor', '#0078d4');
        document.documentElement.style.setProperty('--accent', color);
        
        const rgb = this.hexToRgb(color);
        if (rgb) {
            document.documentElement.style.setProperty('--accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        }
        
        this.os.modules.EventBus.emit('accent:changed', color);
    },
    
    async applyAnimations() {
        const enabled = this.get('personalization.animations', true);
        document.documentElement.style.setProperty('--transition', 
            enabled ? '0.2s cubic-bezier(0.1, 0.9, 0.2, 1)' : 'none');
        document.body.classList.toggle('animations-enabled', enabled);
    },
    
    async applyTransparency() {
        const enabled = this.get('personalization.transparency', true);
        
        document.querySelectorAll('.window, .taskbar, #startMenu, .context-menu').forEach(el => {
            if (el) {
                el.style.backdropFilter = enabled ? 'var(--glass)' : 'none';
                el.style.background = enabled ? 'var(--mica)' : 'rgba(30, 30, 30, 0.95)';
            }
        });
    },
    
    async applyFontSettings() {
        const fontFamily = this.get('personalization.fontFamily', 'system');
        const fontSize = this.get('personalization.fontSize', 'medium');
        
        const fontSizes = { 'small': '12px', 'medium': '14px', 'large': '16px', 'x-large': '18px' };
        const fonts = {
            'system': "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif",
            'classic': "'Segoe UI', 'Tahoma', 'Geneva', sans-serif",
            'modern': "'Inter', 'Roboto', system-ui, sans-serif",
            'mono': "'Cascadia Code', 'Consolas', monospace"
        };
        
        document.documentElement.style.setProperty('--font', fonts[fontFamily] || fonts.system);
        document.documentElement.style.setProperty('--font-size', fontSizes[fontSize] || fontSizes.medium);
    },
    
    async applyAccessibility() {
        const highContrast = this.get('accessibility.highContrast', false);
        const reduceMotion = this.get('accessibility.reduceMotion', false);
        const reduceTransparency = this.get('accessibility.reduceTransparency', false);
        const magnifier = this.get('accessibility.magnifier', false);
        const magnifierZoom = this.get('accessibility.magnifierZoom', 100);
        
        document.body.classList.toggle('high-contrast', highContrast);
        document.body.classList.toggle('reduce-motion', reduceMotion);
        document.body.classList.toggle('reduce-transparency', reduceTransparency);
        
        if (magnifier) {
            document.body.style.zoom = magnifierZoom / 100;
        } else {
            document.body.style.zoom = '1';
        }
    },
    
    async applyPerformanceMode() {
        const mode = this.get('system.performance', 'balanced');
        
        switch (mode) {
            case 'high':
                document.documentElement.style.setProperty('--animation-duration', '0.2s');
                document.documentElement.style.setProperty('--blur-strength', '45px');
                break;
            case 'balanced':
                document.documentElement.style.setProperty('--animation-duration', '0.15s');
                document.documentElement.style.setProperty('--blur-strength', '30px');
                break;
            case 'power-saver':
                document.documentElement.style.setProperty('--animation-duration', '0.1s');
                document.documentElement.style.setProperty('--blur-strength', '0px');
                document.body.classList.add('reduce-motion');
                break;
        }
    },
    
    // Phase 3: Sync settings applicator
    async applySyncSettings() {
        const enabled = this.get('sync.enabled', false);
        
        if (enabled && this.os.modules.CloudSync) {
            await this.os.modules.CloudSync.startSync();
        } else if (this.os.modules.CloudSync) {
            this.os.modules.CloudSync.stopSync();
        }
    },
    
    // Phase 3: Presence settings applicator
    async applyPresenceSettings() {
        const enabled = this.get('collaboration.presenceEnabled', true);
        
        if (this.os.modules.Collaboration) {
            if (enabled) {
                await this.os.modules.Collaboration.broadcastPresence();
            } else {
                this.os.modules.Collaboration.broadcastOffline();
            }
        }
    },
    
    // ==================== HISTORY MANAGEMENT ====================
    
    addToHistory(settings, change = null) {
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        this.history.push({
            settings: this.deepClone(settings),
            change,
            timestamp: Date.now()
        });
        
        this.historyIndex++;
        
        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.historyIndex--;
        }
    },
    
    async undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = this.history[this.historyIndex];
            this.settings = this.deepClone(state.settings);
            await this.applySettings();
            await this.saveSettings();
            this.notifyListeners('*', this.settings);
        }
    },
    
    async redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const state = this.history[this.historyIndex];
            this.settings = this.deepClone(state.settings);
            await this.applySettings();
            await this.saveSettings();
            this.notifyListeners('*', this.settings);
        }
    },
    
    // ==================== LISTENER MANAGEMENT ====================
    
    on(path, callback) {
        if (!this.listeners.has(path)) {
            this.listeners.set(path, []);
        }
        this.listeners.get(path).push(callback);
        
        return () => {
            const listeners = this.listeners.get(path);
            if (listeners) {
                const index = listeners.indexOf(callback);
                if (index !== -1) listeners.splice(index, 1);
            }
        };
    },
    
    notifyListeners(path, newValue, oldValue = null) {
        const pathListeners = this.listeners.get(path);
        if (pathListeners) {
            pathListeners.forEach(cb => {
                try { cb(newValue, oldValue, path); } catch (e) { console.error('Settings listener error:', e); }
            });
        }
        
        const allListeners = this.listeners.get('*');
        if (allListeners) {
            allListeners.forEach(cb => {
                try { cb({ path, newValue, oldValue }); } catch (e) { console.error('Settings listener error:', e); }
            });
        }
    },
    
    // ==================== IMPORT/EXPORT ====================
    
    exportSettings() {
        const data = JSON.stringify(this.settings, null, 2);
        BhekHelpers.downloadFile(`bhekos-settings-${new Date().toISOString().slice(0,10)}.json`, data, 'application/json');
    },
    
    async importSettings(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    this.settings = this.deepMerge(this.defaults, imported);
                    await this.applySettings();
                    await this.saveSettings();
                    this.addToHistory(this.settings);
                    this.notifyListeners('*', this.settings);
                    resolve(true);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    },
    
    // ==================== AUTO-SAVE ====================
    
    setupAutoSave() {
        let hasChanges = false;
        
        setInterval(async () => {
            if (hasChanges) {
                await this.saveSettings();
                hasChanges = false;
            }
        }, 30000);
        
        const originalSet = this.set;
        this.set = async (...args) => {
            await originalSet.apply(this, args);
            hasChanges = true;
        };
    },
    
    // Phase 3: Setup sync
    setupSync() {
        if (this.os.modules.EventBus) {
            this.os.modules.EventBus.on('online', () => {
                if (this.get('sync.enabled')) {
                    this.os.modules.CloudSync?.syncNow();
                }
            });
        }
    },
    
    // ==================== UTILITY METHODS ====================
    
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },
    
    deepMerge(...objects) {
        const result = {};
        for (const obj of objects) {
            for (const key in obj) {
                if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                    result[key] = this.deepMerge(result[key] || {}, obj[key]);
                } else {
                    result[key] = obj[key];
                }
            }
        }
        return result;
    },
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },
    
    getWallpapers() {
        return [
            { id: 'default', name: 'Default', preview: '🎨', category: 'abstract' },
            { id: 'nature', name: 'Nature', preview: '🌲', category: 'nature' },
            { id: 'abstract', name: 'Abstract', preview: '🔷', category: 'abstract' },
            { id: 'gradient', name: 'Gradient', preview: '🌈', category: 'abstract' },
            { id: 'beach', name: 'Beach', preview: '🏖️', category: 'nature' },
            { id: 'mountains', name: 'Mountains', preview: '⛰️', category: 'nature' },
            { id: 'city', name: 'City', preview: '🌆', category: 'urban' },
            { id: 'space', name: 'Space', preview: '🌌', category: 'space' }
        ];
    },
    
    getThemes() {
        return [
            { id: 'dark', name: 'Dark Mode', preview: '🌙', description: 'Easy on the eyes at night' },
            { id: 'light', name: 'Light Mode', preview: '☀️', description: 'Bright and clean' },
            { id: 'high-contrast', name: 'High Contrast', preview: '⚫', description: 'Maximum visibility' }
        ];
    },
    
    getAccentColors() {
        return [
            { name: 'Blue', value: '#0078d4' },
            { name: 'Green', value: '#4CAF50' },
            { name: 'Orange', value: '#FF9800' },
            { name: 'Purple', value: '#9C27B0' },
            { name: 'Pink', value: '#E91E63' },
            { name: 'Cyan', value: '#00BCD4' },
            { name: 'Red', value: '#F44336' },
            { name: 'Teal', value: '#009688' },
            { name: 'Amber', value: '#FFC107' },
            { name: 'Indigo', value: '#3F51B5' }
        ];
    },
    
    getValidationRules() {
        return {
            'system.deviceName': {
                required: true,
                pattern: /^[a-zA-Z0-9-_]+$/,
                message: 'Device name can only contain letters, numbers, hyphens and underscores'
            },
            'personalization.accentColor': {
                required: true,
                pattern: /^#[0-9A-F]{6}$/i,
                message: 'Must be a valid hex color'
            },
            'security.autoLockMinutes': {
                min: 1,
                max: 60,
                message: 'Auto-lock time must be between 1 and 60 minutes'
            },
            'accessibility.magnifierZoom': {
                min: 100,
                max: 500,
                message: 'Magnifier zoom must be between 100% and 500%'
            }
        };
    },
    
    validate(path, value) {
        const rules = this.getValidationRules();
        const rule = rules[path];
        
        if (!rule) return { valid: true };
        
        if (rule.required && !value) {
            return { valid: false, message: rule.message || 'This field is required' };
        }
        
        if (rule.pattern && !rule.pattern.test(value)) {
            return { valid: false, message: rule.message || 'Invalid format' };
        }
        
        if (rule.min !== undefined && value < rule.min) {
            return { valid: false, message: rule.message || `Minimum value is ${rule.min}` };
        }
        
        if (rule.max !== undefined && value > rule.max) {
            return { valid: false, message: rule.message || `Maximum value is ${rule.max}` };
        }
        
        return { valid: true };
    }
};

window.SettingsManager = SettingsManager;
