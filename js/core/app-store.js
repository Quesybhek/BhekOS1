/**
 * BhekOS App Store - Complete app management with collaboration features
 */
const AppStore = {
    os: null,
    
    // Installed apps
    installedApps: new Map(),
    
    // Store apps (available for download)
    storeApps: new Map(),
    
    // Categories
    categories: [
        { id: 'all', name: 'All Apps', icon: '📱' },
        { id: 'system', name: 'System', icon: '⚙️' },
        { id: 'internet', name: 'Internet', icon: '🌐' },
        { id: 'games', name: 'Games', icon: '🎮' },
        { id: 'productivity', name: 'Productivity', icon: '📊' },
        { id: 'media', name: 'Media', icon: '🎵' },
        { id: 'development', name: 'Development', icon: '💻' },
        { id: 'utilities', name: 'Utilities', icon: '🔧' },
        { id: 'collaboration', name: 'Collaboration', icon: '👥' }, // Phase 3
        { id: 'cloud', name: 'Cloud', icon: '☁️' } // Phase 3
    ],
    
    // App ratings
    ratings: new Map(),
    
    // App reviews
    reviews: new Map(),
    
    // App updates
    updates: [],
    
    // App permissions registry
    permissions: new Map(),
    
    async init(os) {
        this.os = os;
        console.log('App Store initializing...');
        
        await this.loadInstalledApps();
        this.registerDefaultApps();
        await this.loadStoreCatalog();
        await this.loadRatings(); // Phase 3
        await this.checkForUpdates(); // Phase 3
        
        console.log(`App Store ready: ${this.installedApps.size} installed, ${this.storeApps.size} available`);
        return this;
    },
    
    // ==================== DEFAULT APPS ====================
    
    registerDefaultApps() {
        const defaultApps = [
            {
                id: 'file-explorer',
                name: 'File Explorer',
                icon: '📁',
                category: 'system',
                version: '1.0.0',
                author: 'BhekOS',
                description: 'Browse and manage files on your system',
                longDescription: 'A full-featured file manager with support for copy, move, delete, and preview operations. Includes folder tree view, file properties, and search functionality.',
                size: '1.2 MB',
                license: 'Built-in',
                rating: 5,
                downloads: 15000,
                builtin: true,
                features: ['File browsing', 'Copy/Paste', 'Search', 'File preview', 'Properties'],
                permissions: ['Read files', 'Write files', 'Create folders'],
                collaboration: false // Phase 3
            },
            {
                id: 'terminal',
                name: 'Terminal',
                icon: '💻',
                category: 'system',
                version: '2.1.0',
                author: 'BhekOS',
                description: 'Command line interface with powerful commands',
                longDescription: 'Access the system command line with over 50 built-in commands. Supports scripting, command history, and customizable themes.',
                size: '2.5 MB',
                license: 'Built-in',
                rating: 5,
                downloads: 12000,
                builtin: true,
                features: ['Command history', 'Auto-complete', 'Custom commands', 'Scripting', 'Themes'],
                permissions: ['Execute commands', 'Access system'],
                collaboration: false
            },
            {
                id: 'app-store',
                name: 'App Store',
                icon: '📱',
                category: 'system',
                version: '1.0.0',
                author: 'BhekOS',
                description: 'Browse and install applications',
                longDescription: 'Discover and install new apps for BhekOS. Browse by category, read reviews, and manage your installed applications.',
                size: '1.8 MB',
                license: 'Built-in',
                rating: 5,
                downloads: 10000,
                builtin: true,
                features: ['Browse apps', 'Install/Uninstall', 'Updates', 'Categories', 'Search'],
                permissions: ['Install apps', 'Remove apps'],
                collaboration: false
            },
            {
                id: 'settings',
                name: 'Settings',
                icon: '⚙️',
                category: 'system',
                version: '1.0.0',
                author: 'BhekOS',
                description: 'System settings and preferences',
                longDescription: 'Configure all aspects of BhekOS including appearance, security, network, and user accounts.',
                size: '1.5 MB',
                license: 'Built-in',
                rating: 5,
                downloads: 20000,
                builtin: true,
                features: ['Appearance', 'Security', 'Network', 'Accounts', 'Updates'],
                permissions: ['Change settings', 'System configuration'],
                collaboration: false
            },
            {
                id: 'web-browser',
                name: 'Web Browser',
                icon: '🌐',
                category: 'internet',
                version: '1.2.0',
                author: 'BhekOS',
                description: 'Fast and secure web browsing',
                longDescription: 'Built-in web browser with tab support, bookmarks, history, and privacy features. Includes ad blocking and secure browsing.',
                size: '3.2 MB',
                license: 'Built-in',
                rating: 4,
                downloads: 18000,
                builtin: true,
                features: ['Tabs', 'Bookmarks', 'History', 'Private mode', 'Ad block'],
                permissions: ['Internet access', 'Storage'],
                collaboration: false
            },
            {
                id: 'snake-game',
                name: 'Snake Game',
                icon: '🐍',
                category: 'games',
                version: '1.0.0',
                author: 'BhekOS',
                description: 'Classic snake game with high scores',
                longDescription: 'Control the snake, eat food, and grow as long as possible without hitting walls or yourself.',
                size: '0.8 MB',
                license: 'Built-in',
                rating: 4,
                downloads: 25000,
                builtin: true,
                features: ['High scores', 'Multiple speeds', 'Sound effects'],
                permissions: ['Save scores'],
                collaboration: false
            },
            {
                id: 'task-manager',
                name: 'Task Manager',
                icon: '📊',
                category: 'system',
                version: '1.0.0',
                author: 'BhekOS',
                description: 'Monitor system performance and processes',
                longDescription: 'View running processes, CPU and memory usage, and system performance metrics.',
                size: '1.1 MB',
                license: 'Built-in',
                rating: 4,
                downloads: 8000,
                builtin: true,
                features: ['Process list', 'Performance graphs', 'Resource monitoring', 'End tasks'],
                permissions: ['View processes', 'End processes'],
                collaboration: false
            },
            // Phase 3: Collaboration apps
            {
                id: 'chat',
                name: 'Chat',
                icon: '💬',
                category: 'collaboration',
                version: '1.0.0',
                author: 'BhekOS',
                description: 'Team chat and messaging',
                longDescription: 'Real-time messaging with channels, direct messages, file sharing, and integrations.',
                size: '2.8 MB',
                license: 'Built-in',
                rating: 5,
                downloads: 5000,
                builtin: true,
                features: ['Channels', 'Direct messages', 'File sharing', 'Emoji reactions', 'Threads'],
                permissions: ['Send messages', 'Receive notifications', 'Share files'],
                collaboration: true
            },
            {
                id: 'users',
                name: 'User Manager',
                icon: '👥',
                category: 'collaboration',
                version: '1.0.0',
                author: 'BhekOS',
                description: 'Manage users and permissions',
                longDescription: 'Create and manage user accounts, set permissions, and monitor user activity.',
                size: '1.3 MB',
                license: 'Built-in',
                rating: 4,
                downloads: 3000,
                builtin: true,
                features: ['User creation', 'Role management', 'Permissions', 'Activity logs'],
                permissions: ['Manage users', 'View logs'],
                collaboration: true
            },
            {
                id: 'backup',
                name: 'Backup & Restore',
                icon: '💾',
                category: 'utilities',
                version: '1.0.0',
                author: 'BhekOS',
                description: 'Backup and restore your data',
                longDescription: 'Create backups of your files, settings, and apps. Schedule automatic backups and restore from previous versions.',
                size: '1.5 MB',
                license: 'Built-in',
                rating: 4,
                downloads: 4000,
                builtin: true,
                features: ['Full backup', 'Incremental backup', 'Scheduling', 'Cloud backup'],
                permissions: ['Read all files', 'Write all files'],
                collaboration: false
            },
            {
                id: 'remote-desktop',
                name: 'Remote Desktop',
                icon: '🖥️',
                category: 'collaboration',
                version: '1.0.0',
                author: 'BhekOS',
                description: 'Access your desktop remotely',
                longDescription: 'Securely access your BhekOS desktop from anywhere. Share your screen or control another user\'s desktop.',
                size: '3.5 MB',
                license: 'Built-in',
                rating: 4,
                downloads: 2000,
                builtin: true,
                features: ['Screen sharing', 'Remote control', 'File transfer', 'Chat'],
                permissions: ['Screen capture', 'Input control', 'Network access'],
                collaboration: true
            }
        ];
        
        defaultApps.forEach(app => {
            this.storeApps.set(app.id, app);
            if (app.builtin) {
                this.installedApps.set(app.id, { ...app, installDate: new Date().toISOString() });
            }
        });
    },
    
    // ==================== STORE CATALOG ====================
    
    async loadStoreCatalog() {
        // Simulate additional apps from server
        const additionalApps = [
            {
                id: 'calculator-pro',
                name: 'Calculator Pro',
                icon: '🧮',
                category: 'productivity',
                version: '2.0.0',
                author: 'MathSoft',
                description: 'Advanced calculator with scientific functions',
                longDescription: 'Professional calculator with scientific, graphing, and programming modes. Includes unit converter and equation solver.',
                size: '4.2 MB',
                price: '$2.99',
                rating: 5,
                downloads: 5000,
                builtin: false,
                features: ['Scientific mode', 'Graphing', 'Unit converter', 'Equation solver'],
                permissions: ['None']
            },
            {
                id: 'paint-pro',
                name: 'Paint Pro',
                icon: '🎨',
                category: 'media',
                version: '1.5.0',
                author: 'CreativeSoft',
                description: 'Professional image editing',
                longDescription: 'Create and edit images with layers, filters, and effects. Supports PSD, PNG, JPG, and more.',
                size: '8.5 MB',
                price: '$4.99',
                rating: 4,
                downloads: 3500,
                builtin: false,
                features: ['Layers', 'Filters', 'Effects', 'Multiple formats'],
                permissions: ['File access']
            },
            {
                id: 'code-editor',
                name: 'Code Editor',
                icon: '📝',
                category: 'development',
                version: '1.0.0',
                author: 'DevSoft',
                description: 'Lightweight code editor with syntax highlighting',
                longDescription: 'Edit code with syntax highlighting, auto-completion, and multiple language support.',
                size: '3.1 MB',
                price: 'Free',
                rating: 4,
                downloads: 8000,
                builtin: false,
                features: ['Syntax highlighting', 'Auto-complete', 'Multiple languages', 'Search'],
                permissions: ['File access']
            },
            // Phase 3: More apps
            {
                id: 'video-conference',
                name: 'Video Conference',
                icon: '📹',
                category: 'collaboration',
                version: '1.0.0',
                author: 'CommSoft',
                description: 'HD video conferencing',
                longDescription: 'Video calls with screen sharing, recording, and virtual backgrounds. Supports up to 50 participants.',
                size: '6.2 MB',
                price: 'Free',
                rating: 5,
                downloads: 12000,
                builtin: false,
                features: ['HD video', 'Screen sharing', 'Recording', 'Virtual backgrounds'],
                permissions: ['Camera', 'Microphone', 'Network']
            },
            {
                id: 'project-manager',
                name: 'Project Manager',
                icon: '📋',
                category: 'productivity',
                version: '2.1.0',
                author: 'SoftCorp',
                description: 'Manage projects and tasks',
                longDescription: 'Organize projects, assign tasks, track progress, and collaborate with team members.',
                size: '5.5 MB',
                price: '$9.99',
                rating: 4,
                downloads: 7500,
                builtin: false,
                features: ['Task boards', 'Gantt charts', 'Team collaboration', 'Deadline tracking'],
                permissions: ['Storage', 'Notifications']
            }
        ];
        
        additionalApps.forEach(app => {
            this.storeApps.set(app.id, app);
        });
    },
    
    // ==================== INSTALLED APPS ====================
    
    async loadInstalledApps() {
        const saved = await this.os.modules.Storage.get('installedApps', []);
        
        for (const appData of saved) {
            if (typeof appData === 'string') {
                const app = this.storeApps.get(appData);
                if (app) {
                    this.installedApps.set(appData, { ...app, installDate: new Date().toISOString() });
                }
            } else {
                this.installedApps.set(appData.id, appData);
            }
        }
    },
    
    async saveInstalledApps() {
        const apps = Array.from(this.installedApps.values()).map(app => ({
            id: app.id,
            name: app.name,
            version: app.version,
            installDate: app.installDate,
            settings: app.settings || {}
        }));
        
        await this.os.modules.Storage.set('installedApps', apps);
    },
    
    getApp(appId) {
        return this.installedApps.get(appId) || this.storeApps.get(appId);
    },
    
    getAvailableApps(category = 'all') {
        let apps = Array.from(this.storeApps.values());
        
        if (category !== 'all') {
            apps = apps.filter(app => app.category === category);
        }
        
        return apps.sort((a, b) => a.name.localeCompare(b.name));
    },
    
    getInstalledApps() {
        return Array.from(this.installedApps.values())
            .sort((a, b) => a.name.localeCompare(b.name));
    },
    
    isInstalled(appId) {
        return this.installedApps.has(appId);
    },
    
    // ==================== INSTALL/UNINSTALL ====================
    
    async installApp(appId) {
        const app = this.storeApps.get(appId);
        if (!app) throw new Error('App not found');
        if (this.installedApps.has(appId)) throw new Error('App already installed');
        
        // Check permissions
        await this.requestPermissions(app);
        
        this.os.notify('App Store', `Installing ${app.name}...`, 'info', 5000);
        
        try {
            await this.downloadAppFiles(app);
            
            const installedApp = {
                ...app,
                installDate: new Date().toISOString(),
                lastUsed: null,
                settings: {}
            };
            
            this.installedApps.set(appId, installedApp);
            await this.saveInstalledApps();
            await this.createDesktopShortcut(installedApp);
            
            if (this.os.modules.StartMenu) {
                this.os.modules.StartMenu.addApp(installedApp);
            }
            
            this.os.notify('App Store', `${app.name} installed successfully!`, 'success');
            this.os.modules.EventBus.emit('app:installed', { appId });
            
            // Phase 3: Share installation with team
            if (this.os.modules.Collaboration) {
                this.os.modules.Collaboration.broadcastActivity('app_installed', {
                    app: app.name,
                    user: this.os.modules.Security?.getCurrentUser()?.username
                });
            }
            
            return installedApp;
        } catch (error) {
            console.error('Installation failed:', error);
            this.os.notify('App Store', `Failed to install ${app.name}`, 'error');
            throw error;
        }
    },
    
    async uninstallApp(appId) {
        const app = this.installedApps.get(appId);
        if (!app) throw new Error('App not installed');
        if (app.builtin) throw new Error('Cannot uninstall built-in app');
        
        if (!confirm(`Are you sure you want to uninstall ${app.name}?`)) {
            return;
        }
        
        try {
            await this.os.modules.FileSystem.delete(`/Apps/${appId}`);
            
            this.installedApps.delete(appId);
            await this.saveInstalledApps();
            await this.removeDesktopShortcut(appId);
            
            if (this.os.modules.StartMenu) {
                this.os.modules.StartMenu.removeApp(appId);
            }
            
            this.os.notify('App Store', `${app.name} uninstalled successfully`, 'info');
            this.os.modules.EventBus.emit('app:uninstalled', { appId });
        } catch (error) {
            console.error('Uninstall failed:', error);
            this.os.notify('App Store', `Failed to uninstall ${app.name}`, 'error');
            throw error;
        }
    },
    
    async downloadAppFiles(app) {
        await this.os.modules.FileSystem.createFolder('/Apps', app.id);
        
        await this.os.modules.FileSystem.writeFile(
            `/Apps/${app.id}/manifest.json`,
            JSON.stringify(app, null, 2),
            'application/json'
        );
        
        await this.os.modules.FileSystem.writeFile(
            `/Apps/${app.id}/main.js`,
            this.generateAppTemplate(app),
            'application/javascript'
        );
        
        await this.os.modules.FileSystem.writeFile(
            `/Apps/${app.id}/style.css`,
            this.generateAppStyles(app),
            'text/css'
        );
    },
    
    generateAppTemplate(app) {
        return `/**
 * ${app.name} - ${app.version}
 * Author: ${app.author}
 * Description: ${app.description}
 */

class ${app.id.replace(/-/g, '_')}App {
    constructor(os, windowId) {
        this.os = os;
        this.windowId = windowId;
        this.app = ${JSON.stringify(app, null, 4)};
    }
    
    async render(container, options = {}) {
        container.innerHTML = \`
            <div style="padding: 20px; text-align: center;">
                <div style="font-size: 64px; margin-bottom: 20px;">${app.icon}</div>
                <h2 style="margin-bottom: 10px;">${app.name}</h2>
                <p style="opacity: 0.7; margin-bottom: 20px;">${app.description}</p>
                <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px;">
                    <p>This app has been installed from the BhekOS App Store.</p>
                    <p style="margin-top: 10px;">Version: ${app.version}</p>
                    <p>Author: ${app.author}</p>
                </div>
            </div>
        \`;
    }
    
    destroy() {
        // Cleanup
    }
}

window.${app.id.replace(/-/g, '_')}App = ${app.id.replace(/-/g, '_')}App;
`;
    },
    
    generateAppStyles(app) {
        return `/* ${app.name} Styles */
.app-${app.id} {
    /* Custom styles */
}

.app-${app.id} .header {
    background: linear-gradient(135deg, var(--accent), transparent);
}
`;
    },
    
    async createDesktopShortcut(app) {
        const shortcutContent = JSON.stringify({
            type: 'app',
            id: app.id,
            name: app.name,
            icon: app.icon
        });
        
        await this.os.modules.FileSystem.writeFile(
            `/Desktop/${app.name}.app`,
            shortcutContent,
            'application/bhekos-app'
        );
        
        if (this.os.modules.DesktopIcons) {
            this.os.modules.DesktopIcons.refresh();
        }
    },
    
    async removeDesktopShortcut(appId) {
        const desktop = await this.os.modules.FileSystem.listDirectory('/Desktop');
        
        for (const file of desktop) {
            if (file.name.endsWith('.app')) {
                const content = await this.os.modules.FileSystem.readFile(file.path);
                try {
                    const shortcut = JSON.parse(content);
                    if (shortcut.id === appId) {
                        await this.os.modules.FileSystem.delete(file.path);
                        break;
                    }
                } catch (e) {}
            }
        }
        
        if (this.os.modules.DesktopIcons) {
            this.os.modules.DesktopIcons.refresh();
        }
    },
    
    // ==================== UPDATES ====================
    
    async checkForUpdates() {
        const updates = [];
        
        for (const [id, app] of this.installedApps) {
            const storeApp = this.storeApps.get(id);
            if (storeApp && storeApp.version !== app.version) {
                updates.push({
                    id,
                    name: app.name,
                    currentVersion: app.version,
                    newVersion: storeApp.version,
                    size: storeApp.size
                });
            }
        }
        
        this.updates = updates;
        return updates;
    },
    
    async updateApp(appId) {
        const app = this.installedApps.get(appId);
        const storeApp = this.storeApps.get(appId);
        
        if (!app || !storeApp) throw new Error('App not found');
        if (app.version === storeApp.version) throw new Error('App is already up to date');
        
        this.os.notify('App Store', `Updating ${app.name}...`, 'info');
        
        await this.downloadAppFiles(storeApp);
        
        this.installedApps.set(appId, {
            ...storeApp,
            installDate: new Date().toISOString(),
            lastUsed: app.lastUsed,
            settings: app.settings
        });
        
        await this.saveInstalledApps();
        
        this.os.notify('App Store', `${app.name} updated to version ${storeApp.version}`, 'success');
        
        // Remove from updates list
        this.updates = this.updates.filter(u => u.id !== appId);
        
        return storeApp;
    },
    
    async updateAllApps() {
        const updates = await this.checkForUpdates();
        
        for (const update of updates) {
            try {
                await this.updateApp(update.id);
            } catch (error) {
                console.error(`Failed to update ${update.name}:`, error);
            }
        }
        
        return updates.length;
    },
    
    // ==================== SEARCH ====================
    
    searchApps(query) {
        query = query.toLowerCase();
        const results = [];
        
        this.storeApps.forEach(app => {
            if (app.name.toLowerCase().includes(query) ||
                app.description.toLowerCase().includes(query) ||
                app.category.toLowerCase().includes(query)) {
                results.push(app);
            }
        });
        
        return results;
    },
    
    getAppsByCategory(category) {
        return Array.from(this.storeApps.values())
            .filter(app => app.category === category)
            .sort((a, b) => a.name.localeCompare(b.name));
    },
    
    getFeaturedApps() {
        return Array.from(this.storeApps.values())
            .filter(app => app.rating >= 4)
            .sort((a, b) => b.downloads - a.downloads)
            .slice(0, 6);
    },
    
    getRecentlyUpdated() {
        return Array.from(this.storeApps.values())
            .sort((a, b) => Math.random() - 0.5)
            .slice(0, 6);
    },
    
    // ==================== RATINGS & REVIEWS (Phase 3) ====================
    
    async loadRatings() {
        const saved = await this.os.modules.Storage.get('app_ratings', {});
        this.ratings = new Map(Object.entries(saved));
        
        const savedReviews = await this.os.modules.Storage.get('app_reviews', {});
        this.reviews = new Map(Object.entries(savedReviews));
    },
    
    async saveRatings() {
        const ratings = Object.fromEntries(this.ratings);
        await this.os.modules.Storage.set('app_ratings', ratings);
        
        const reviews = Object.fromEntries(this.reviews);
        await this.os.modules.Storage.set('app_reviews', reviews);
    },
    
    async rateApp(appId, rating, review = null) {
        const app = this.getApp(appId);
        if (!app) throw new Error('App not found');
        
        const user = this.os.modules.Security?.getCurrentUser();
        if (!user) throw new Error('Must be logged in to rate');
        
        // Store rating
        if (!this.ratings.has(appId)) {
            this.ratings.set(appId, []);
        }
        
        const ratings = this.ratings.get(appId);
        const existingIndex = ratings.findIndex(r => r.user === user.username);
        
        if (existingIndex >= 0) {
            ratings[existingIndex] = { user: user.username, rating, date: new Date().toISOString() };
        } else {
            ratings.push({ user: user.username, rating, date: new Date().toISOString() });
        }
        
        // Calculate average rating
        const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
        app.rating = Math.round(avgRating * 10) / 10;
        
        // Store review
        if (review) {
            if (!this.reviews.has(appId)) {
                this.reviews.set(appId, []);
            }
            
            const reviews = this.reviews.get(appId);
            reviews.push({
                user: user.username,
                rating,
                review,
                date: new Date().toISOString(),
                helpful: 0
            });
        }
        
        await this.saveRatings();
        
        this.os.modules.EventBus.emit('app:rated', { appId, rating, user: user.username });
    },
    
    getAppRatings(appId) {
        return {
            average: this.storeApps.get(appId)?.rating || 0,
            total: this.ratings.get(appId)?.length || 0,
            ratings: this.ratings.get(appId) || []
        };
    },
    
    getAppReviews(appId) {
        return this.reviews.get(appId) || [];
    },
    
    async markReviewHelpful(appId, reviewIndex) {
        const reviews = this.reviews.get(appId);
        if (reviews && reviews[reviewIndex]) {
            reviews[reviewIndex].helpful++;
            await this.saveRatings();
        }
    },
    
    // ==================== PERMISSIONS (Phase 3) ====================
    
    async requestPermissions(app) {
        const user = this.os.modules.Security?.getCurrentUser();
        if (!user) return true;
        
        const requiredPermissions = app.permissions || [];
        const grantedPermissions = [];
        
        for (const permission of requiredPermissions) {
            // Check if already granted
            const key = `${app.id}:${permission}`;
            if (this.permissions.has(key)) {
                grantedPermissions.push(permission);
                continue;
            }
            
            // Request permission
            const granted = await this.showPermissionDialog(app, permission);
            if (granted) {
                this.permissions.set(key, {
                    app: app.id,
                    permission,
                    granted: true,
                    date: new Date().toISOString()
                });
                grantedPermissions.push(permission);
            } else {
                throw new Error(`Permission denied: ${permission}`);
            }
        }
        
        return grantedPermissions;
    },
    
    async showPermissionDialog(app, permission) {
        // In a real implementation, show a dialog
        return confirm(`${app.name} requests permission to: ${permission}\n\nAllow?`);
    },
    
    getAppPermissions(appId) {
        const permissions = [];
        
        for (const [key, value] of this.permissions) {
            if (key.startsWith(`${appId}:`)) {
                permissions.push(value);
            }
        }
        
        return permissions;
    },
    
    revokeAppPermission(appId, permission) {
        const key = `${appId}:${permission}`;
        this.permissions.delete(key);
    },
    
    // ==================== APP SETTINGS ====================
    
    async getAppSettings(appId) {
        const app = this.installedApps.get(appId);
        return app?.settings || {};
    },
    
    async saveAppSettings(appId, settings) {
        const app = this.installedApps.get(appId);
        if (app) {
            app.settings = { ...app.settings, ...settings };
            await this.saveInstalledApps();
            this.os.modules.EventBus.emit('app:settings', { appId, settings });
        }
    },
    
    // ==================== APP USAGE ====================
    
    async recordAppLaunch(appId) {
        const app = this.installedApps.get(appId);
        if (app) {
            app.lastUsed = new Date().toISOString();
            app.launchCount = (app.launchCount || 0) + 1;
            await this.saveInstalledApps();
        }
    },
    
    getMostUsedApps(limit = 5) {
        return Array.from(this.installedApps.values())
            .filter(app => app.launchCount)
            .sort((a, b) => (b.launchCount || 0) - (a.launchCount || 0))
            .slice(0, limit);
    },
    
    getRecentlyUsedApps(limit = 5) {
        return Array.from(this.installedApps.values())
            .filter(app => app.lastUsed)
            .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))
            .slice(0, limit);
    },
    
    // ==================== APP SHARING (Phase 3) ====================
    
    async shareApp(appId, username) {
        const app = this.getApp(appId);
        if (!app) throw new Error('App not found');
        
        const user = this.os.modules.Security?.getCurrentUser();
        
        const shareData = {
            appId,
            appName: app.name,
            appIcon: app.icon,
            sharedBy: user?.username,
            sharedWith: username,
            timestamp: new Date().toISOString()
        };
        
        // Store share record
        const shares = await this.os.modules.Storage.get('shared_apps', []);
        shares.push(shareData);
        await this.os.modules.Storage.set('shared_apps', shares);
        
        // Notify user
        if (this.os.modules.Collaboration) {
            this.os.modules.Collaboration.sendNotification(username, {
                type: 'app_shared',
                title: 'App Shared',
                message: `${user?.username} shared ${app.name} with you`,
                data: shareData
            });
        }
        
        return shareData;
    },
    
    async getSharedApps(username) {
        const shares = await this.os.modules.Storage.get('shared_apps', []);
        return shares.filter(s => s.sharedWith === username);
    }
};

window.AppStore = AppStore;
