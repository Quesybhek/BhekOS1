/**
 * BhekOS Keyboard Shortcuts Manager
 */
const ShortcutManager = {
    os: null,
    
    // Registered shortcuts
    shortcuts: new Map(),
    
    // Shortcut categories
    categories: {
        global: [],
        window: [],
        desktop: [],
        app: [],
        system: []
    },
    
    // Active modifiers
    modifiers: {
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
        win: false
    },
    
    // Custom shortcuts
    customShortcuts: new Map(),
    
    // Shortcut conflicts
    conflicts: [],
    
    async init(os) {
        this.os = os;
        console.log('Shortcut Manager initializing...');
        
        // Register default shortcuts
        this.registerDefaults();
        
        // Load custom shortcuts
        await this.loadCustomShortcuts();
        
        // Setup listeners
        this.setupListeners();
        
        console.log(`Shortcut Manager ready: ${this.shortcuts.size} shortcuts registered`);
        return this;
    },
    
    setupListeners() {
        document.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });
        
        document.addEventListener('keyup', (e) => {
            this.handleKeyUp(e);
        });
        
        // Prevent default browser shortcuts when we want to override
        document.addEventListener('keydown', (e) => {
            if (this.isBhekOSShortcut(e)) {
                e.preventDefault();
            }
        });
    },
    
    handleKeyDown(e) {
        // Update modifiers
        this.modifiers.ctrl = e.ctrlKey;
        this.modifiers.alt = e.altKey;
        this.modifiers.shift = e.shiftKey;
        this.modifiers.meta = e.metaKey;
        
        // Check for Win key (Cmd on Mac)
        if (e.key === 'Meta' || e.key === 'Windows') {
            this.modifiers.win = true;
            this.showWinKeyMenu();
        }
        
        // Build shortcut string
        const shortcut = this.buildShortcutString(e);
        
        // Find and execute matching shortcut
        const match = this.findShortcut(shortcut);
        if (match) {
            e.preventDefault();
            match.action(e);
        }
    },
    
    handleKeyUp(e) {
        if (e.key === 'Meta' || e.key === 'Windows') {
            this.modifiers.win = false;
            this.hideWinKeyMenu();
        }
    },
    
    buildShortcutString(e) {
        const parts = [];
        
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        if (e.metaKey) parts.push('Win');
        
        // Add the main key (if not a modifier)
        if (!['Control', 'Alt', 'Shift', 'Meta', 'Windows'].includes(e.key)) {
            // Handle special keys
            const keyMap = {
                ' ': 'Space',
                'ArrowUp': 'Up',
                'ArrowDown': 'Down',
                'ArrowLeft': 'Left',
                'ArrowRight': 'Right',
                'Escape': 'Esc',
                'Delete': 'Del',
                'Insert': 'Ins',
                'PageUp': 'PgUp',
                'PageDown': 'PgDn'
            };
            
            const key = keyMap[e.key] || (e.key.length === 1 ? e.key.toUpperCase() : e.key);
            parts.push(key);
        }
        
        return parts.join('+');
    },
    
    registerShortcut(shortcut, action, description = '', category = 'global') {
        this.shortcuts.set(shortcut, { action, description, category });
        this.categories[category].push({ shortcut, description });
    },
    
    findShortcut(shortcut) {
        // Check registered shortcuts
        if (this.shortcuts.has(shortcut)) {
            return this.shortcuts.get(shortcut);
        }
        
        // Check custom shortcuts
        if (this.customShortcuts.has(shortcut)) {
            return this.customShortcuts.get(shortcut);
        }
        
        return null;
    },
    
    isBhekOSShortcut(e) {
        const shortcut = this.buildShortcutString(e);
        return this.shortcuts.has(shortcut) || this.customShortcuts.has(shortcut);
    },
    
    // ==================== DEFAULT SHORTCUTS ====================
    
    registerDefaults() {
        // Window management
        this.registerShortcut('Ctrl+N', () => {
            this.os.launchApp('file-explorer');
        }, 'New window', 'window');
        
        this.registerShortcut('Ctrl+W', () => {
            const focused = this.os.modules.WindowManager?.focusedWindow;
            if (focused) this.os.modules.WindowManager.close(focused);
        }, 'Close window', 'window');
        
        this.registerShortcut('Alt+Tab', () => {
            this.os.modules.WindowManager?.showWindowSwitcher();
        }, 'Switch window', 'window');
        
        this.registerShortcut('Win+Tab', () => {
            this.os.modules.DisplayManager?.showDesktopSwitcher();
        }, 'Task view', 'desktop');
        
        this.registerShortcut('Win+D', () => {
            this.os.modules.WindowManager?.minimizeAll();
        }, 'Show desktop', 'desktop');
        
        this.registerShortcut('Win+L', () => {
            this.os.modules.Security?.lock();
        }, 'Lock screen', 'global');
        
        this.registerShortcut('Win+E', () => {
            this.os.launchApp('file-explorer');
        }, 'File Explorer', 'global');
        
        this.registerShortcut('Win+S', () => {
            if (window.SearchOverlay) {
                SearchOverlay.show();
            }
        }, 'Search', 'global');
        
        this.registerShortcut('Win+I', () => {
            this.os.launchApp('settings');
        }, 'Settings', 'global');
        
        this.registerShortcut('Ctrl+Shift+Esc', () => {
            this.os.launchApp('task-manager');
        }, 'Task Manager', 'global');
        
        this.registerShortcut('F5', () => {
            location.reload();
        }, 'Refresh', 'global');
        
        this.registerShortcut('F11', () => {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                document.documentElement.requestFullscreen();
            }
        }, 'Fullscreen', 'global');
        
        this.registerShortcut('Alt+F4', () => {
            const focused = this.os.modules.WindowManager?.focusedWindow;
            if (focused) {
                this.os.modules.WindowManager.close(focused);
            } else {
                this.os.shutdown?.();
            }
        }, 'Close / Shutdown', 'global');
        
        // Desktop switching
        for (let i = 1; i <= 9; i++) {
            this.registerShortcut(`Ctrl+${i}`, () => {
                this.os.modules.DisplayManager?.switchToDesktopByIndex(i);
            }, `Switch to desktop ${i}`, 'desktop');
        }
        
        this.registerShortcut('Ctrl+Win+Right', () => {
            this.os.modules.DisplayManager?.nextDesktop();
        }, 'Next desktop', 'desktop');
        
        this.registerShortcut('Ctrl+Win+Left', () => {
            this.os.modules.DisplayManager?.previousDesktop();
        }, 'Previous desktop', 'desktop');
        
        // Window snapping
        this.registerShortcut('Win+Left', () => {
            this.os.modules.WindowManager?.snapFocusedWindow('left');
        }, 'Snap left', 'window');
        
        this.registerShortcut('Win+Right', () => {
            this.os.modules.WindowManager?.snapFocusedWindow('right');
        }, 'Snap right', 'window');
        
        this.registerShortcut('Win+Up', () => {
            this.os.modules.WindowManager?.maximizeFocused();
        }, 'Maximize', 'window');
        
        this.registerShortcut('Win+Down', () => {
            const focused = this.os.modules.WindowManager?.focusedWindow;
            if (focused) {
                const win = this.os.modules.WindowManager.windows.get(focused);
                if (win?.state === 'maximized') {
                    this.os.modules.WindowManager.restore(focused);
                }
            }
        }, 'Restore', 'window');
        
        // System
        this.registerShortcut('Win+R', () => {
            this.showRunDialog();
        }, 'Run', 'system');
        
        this.registerShortcut('Ctrl+Alt+Del', () => {
            this.showSecurityOptions();
        }, 'Security options', 'system');
        
        // Phase 3: Collaboration shortcuts
        this.registerShortcut('Win+C', () => {
            this.os.launchApp('chat');
        }, 'Open Chat', 'global');
        
        this.registerShortcut('Win+U', () => {
            this.os.launchApp('users');
        }, 'User Manager', 'global');
        
        this.registerShortcut('Ctrl+Shift+S', () => {
            if (this.os.modules.Collaboration) {
                this.os.modules.Collaboration.startScreenShare();
            }
        }, 'Share screen', 'global');
    },
    
    // ==================== CUSTOM SHORTCUTS ====================
    
    async loadCustomShortcuts() {
        const saved = await this.os.modules.Storage.get('custom_shortcuts', []);
        
        saved.forEach(item => {
            this.customShortcuts.set(item.shortcut, {
                action: this.parseAction(item.action),
                description: item.description,
                category: 'custom'
            });
        });
    },
    
    async saveCustomShortcuts() {
        const shortcuts = [];
        
        this.customShortcuts.forEach((value, shortcut) => {
            shortcuts.push({
                shortcut,
                description: value.description,
                action: value.action.toString()
            });
        });
        
        await this.os.modules.Storage.set('custom_shortcuts', shortcuts);
    },
    
    parseAction(actionString) {
        // Parse action string to function
        // This would need careful implementation to avoid eval
        return () => {
            console.log('Custom action:', actionString);
        };
    },
    
    addCustomShortcut(shortcut, action, description) {
        if (this.shortcuts.has(shortcut) || this.customShortcuts.has(shortcut)) {
            this.conflicts.push({ shortcut, existing: this.findShortcut(shortcut) });
            return false;
        }
        
        this.customShortcuts.set(shortcut, { action, description, category: 'custom' });
        this.saveCustomShortcuts();
        return true;
    },
    
    removeCustomShortcut(shortcut) {
        this.customShortcuts.delete(shortcut);
        this.saveCustomShortcuts();
    },
    
    // ==================== SHORTCUT DISPLAY ====================
    
    showWinKeyMenu() {
        const menu = document.createElement('div');
        menu.className = 'win-key-menu';
        
        const categories = {
            'Window': ['E', 'D', 'Tab', 'Left', 'Right', 'Up', 'Down'],
            'System': ['L', 'I', 'S', 'R', 'C', 'U']
        };
        
        let html = '<div class="win-menu-header">Windows Key Shortcuts</div>';
        html += '<div class="win-menu-grid">';
        
        for (const [category, keys] of Object.entries(categories)) {
            html += `<div class="win-menu-category">${category}</div>`;
            keys.forEach(key => {
                const shortcut = this.findShortcut(`Win+${key}`);
                if (shortcut) {
                    html += `
                        <div class="win-menu-item" data-shortcut="Win+${key}">
                            <span class="item-icon">${this.getShortcutIcon(`Win+${key}`)}</span>
                            <span class="item-name">${shortcut.description}</span>
                            <span class="item-shortcut">Win+${key}</span>
                        </div>
                    `;
                }
            });
        }
        
        html += '</div>';
        menu.innerHTML = html;
        
        document.body.appendChild(menu);
        
        // Position near start button
        const startBtn = document.querySelector('.start-button');
        if (startBtn) {
            const rect = startBtn.getBoundingClientRect();
            menu.style.left = rect.left + 'px';
            menu.style.bottom = '60px';
        }
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (document.body.contains(menu)) {
                menu.remove();
            }
        }, 3000);
    },
    
    hideWinKeyMenu() {
        const menu = document.querySelector('.win-key-menu');
        if (menu) menu.remove();
    },
    
    showRunDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'run-dialog';
        dialog.innerHTML = `
            <div class="run-dialog-content">
                <h3>Run</h3>
                <input type="text" id="run-command" placeholder="Type a command, folder, or app name">
                <div class="run-dialog-actions">
                    <button onclick="ShortcutManager.executeRunCommand()">OK</button>
                    <button onclick="this.closest('.run-dialog').remove()">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        setTimeout(() => {
            document.getElementById('run-command')?.focus();
        }, 100);
        
        // Handle Enter key
        document.getElementById('run-command')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.executeRunCommand();
            }
        });
    },
    
    executeRunCommand() {
        const input = document.getElementById('run-command');
        const command = input?.value.trim();
        
        if (command) {
            // Try to launch as app
            const app = this.os.modules.AppStore?.getApp(command);
            if (app) {
                this.os.launchApp(app.id);
            } else {
                // Try to open as path
                this.os.modules.FileSystem?.openFile(command);
            }
        }
        
        document.querySelector('.run-dialog')?.remove();
    },
    
    showSecurityOptions() {
        const options = document.createElement('div');
        options.className = 'security-options';
        options.innerHTML = `
            <div class="security-options-content">
                <h3>Security Options</h3>
                <button onclick="ShortcutManager.lock()">Lock</button>
                <button onclick="ShortcutManager.logout()">Log Out</button>
                <button onclick="ShortcutManager.shutdown()">Shut Down</button>
                <button onclick="ShortcutManager.restart()">Restart</button>
                <button onclick="this.closest('.security-options').remove()">Cancel</button>
            </div>
        `;
        
        document.body.appendChild(options);
    },
    
    lock() {
        this.os.modules.Security?.lock();
        document.querySelector('.security-options')?.remove();
    },
    
    logout() {
        this.os.modules.Security?.logout();
        document.querySelector('.security-options')?.remove();
    },
    
    shutdown() {
        this.os.shutdown?.();
        document.querySelector('.security-options')?.remove();
    },
    
    restart() {
        this.os.restart?.();
        document.querySelector('.security-options')?.remove();
    },
    
    // ==================== UTILITY ====================
    
    getShortcutIcon(shortcut) {
        const icons = {
            'Win+E': '📁',
            'Win+D': '🖥️',
            'Win+L': '🔒',
            'Win+I': '⚙️',
            'Win+S': '🔍',
            'Win+C': '💬',
            'Win+U': '👥'
        };
        return icons[shortcut] || '⌨️';
    },
    
    getAllShortcuts() {
        const all = [];
        
        this.shortcuts.forEach((value, shortcut) => {
            all.push({ shortcut, ...value });
        });
        
        this.customShortcuts.forEach((value, shortcut) => {
            all.push({ shortcut, ...value });
        });
        
        return all;
    },
    
    getShortcutsByCategory(category) {
        return this.categories[category] || [];
    },
    
    getConflicts() {
        return this.conflicts;
    }
};

window.ShortcutManager = ShortcutManager;
