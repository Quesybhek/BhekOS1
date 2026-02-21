/**
 * BhekOS Display Manager - Multi-monitor and virtual desktop support
 */
const DisplayManager = {
    os: null,
    
    // Displays
    displays: new Map(),
    primaryDisplay: null,
    
    // Virtual desktops
    desktops: new Map(),
    currentDesktop: 'desktop-1',
    
    // Desktop settings
    settings: {
        extendDisplays: true,
        mirrorDisplays: false,
        taskbarOnAllDisplays: true,
        wallpaperOnAllDisplays: true,
        showDesktopsInTaskbar: true,
        desktopsCount: 4,
        switchWithCtrlWin: true
    },
    
    // Desktop history
    desktopHistory: [],
    historyIndex: -1,
    
    // Phase 3: Collaboration per desktop
    desktopCollaborators: new Map(), // desktopId -> Set of users
    
    async init(os) {
        this.os = os;
        console.log('Display Manager initializing...');
        
        await this.detectDisplays();
        await this.createDefaultDesktops();
        this.setupListeners();
        this.loadSavedState();
        
        console.log(`Display Manager ready: ${this.displays.size} displays, ${this.desktops.size} desktops`);
        return this;
    },
    
    detectDisplays() {
        // In a real system, this would detect multiple monitors
        // For web, we'll simulate with the window and screen info
        
        const displays = [
            {
                id: 'display-1',
                name: 'Main Display',
                primary: true,
                width: window.screen.width,
                height: window.screen.height,
                left: 0,
                top: 0,
                scale: window.devicePixelRatio || 1,
                isInternal: true,
                refreshRate: 60,
                colorDepth: window.screen.colorDepth || 24
            }
        ];
        
        // Simulate second display if window is large enough
        if (window.screen.width > 1920) {
            displays.push({
                id: 'display-2',
                name: 'Secondary Display',
                primary: false,
                width: 1920,
                height: 1080,
                left: window.screen.width,
                top: 0,
                scale: 1,
                isInternal: false,
                refreshRate: 60,
                colorDepth: 24
            });
        }
        
        displays.forEach(display => {
            this.displays.set(display.id, display);
            if (display.primary) this.primaryDisplay = display;
        });
        
        this.createDisplayContainers();
    },
    
    createDisplayContainers() {
        const desktop = document.getElementById('desktop');
        
        this.displays.forEach((display, id) => {
            const container = document.createElement('div');
            container.className = 'display-container';
            container.id = `display-${id}`;
            container.style.width = display.width + 'px';
            container.style.height = display.height + 'px';
            container.style.left = display.left + 'px';
            container.style.top = display.top + 'px';
            container.style.position = 'absolute';
            
            if (!display.primary) {
                container.style.borderLeft = '2px solid var(--accent)';
            }
            
            desktop.appendChild(container);
        });
    },
    
    createDefaultDesktops() {
        const count = this.settings.desktopsCount;
        
        for (let i = 1; i <= count; i++) {
            const id = `desktop-${i}`;
            this.desktops.set(id, {
                id,
                name: `Desktop ${i}`,
                index: i,
                windows: new Set(),
                wallpaper: null,
                created: Date.now(),
                lastActive: i === 1 ? Date.now() : null,
                layout: {}, // Saved window positions for this desktop
                collaborators: new Set() // Phase 3
            });
        }
        
        this.currentDesktop = 'desktop-1';
        this.desktops.get('desktop-1').lastActive = Date.now();
    },
    
    setupListeners() {
        // Listen for window creation
        this.os.modules.EventBus.on('window:created', (winId) => {
            this.addWindowToDesktop(winId, this.currentDesktop);
        });
        
        // Listen for window closing
        this.os.modules.EventBus.on('window:closed', (winId) => {
            this.removeWindowFromAllDesktops(winId);
        });
        
        // Listen for window movement
        this.os.modules.EventBus.on('window:moved', ({ windowId, left, top }) => {
            this.saveWindowLayout(windowId, { left, top });
        });
        
        // Handle resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        // Phase 2: Keyboard shortcuts for desktop switching
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key.startsWith('Digit')) {
                const num = parseInt(e.key.slice(-1));
                if (num > 0 && num <= this.desktops.size) {
                    e.preventDefault();
                    this.switchToDesktop(`desktop-${num}`);
                }
            }
            
            if (e.ctrlKey && e.key === 'Tab') {
                e.preventDefault();
                this.showDesktopSwitcher();
            }
        });
    },
    
    handleResize() {
        // Update display dimensions
        this.displays.forEach(display => {
            if (display.primary) {
                display.width = window.innerWidth;
                display.height = window.innerHeight;
            }
        });
        
        // Update display containers
        this.displays.forEach((display, id) => {
            const container = document.getElementById(`display-${id}`);
            if (container) {
                container.style.width = display.width + 'px';
                container.style.height = display.height + 'px';
            }
        });
    },
    
    loadSavedState() {
        const saved = this.os.modules.Storage.get('desktop_layout', {});
        
        if (saved.desktops) {
            saved.desktops.forEach((desktop, id) => {
                if (this.desktops.has(id)) {
                    const existing = this.desktops.get(id);
                    existing.name = desktop.name || existing.name;
                    existing.wallpaper = desktop.wallpaper;
                    existing.layout = desktop.layout || {};
                }
            });
        }
        
        if (saved.currentDesktop) {
            this.currentDesktop = saved.currentDesktop;
        }
    },
    
    saveState() {
        const layout = {
            desktops: {},
            currentDesktop: this.currentDesktop
        };
        
        this.desktops.forEach((desktop, id) => {
            layout.desktops[id] = {
                name: desktop.name,
                wallpaper: desktop.wallpaper,
                layout: desktop.layout
            };
        });
        
        this.os.modules.Storage.set('desktop_layout', layout);
    },
    
    // ==================== DESKTOP MANAGEMENT ====================
    
    switchToDesktop(desktopId) {
        if (!this.desktops.has(desktopId)) return;
        
        const oldDesktop = this.currentDesktop;
        this.currentDesktop = desktopId;
        
        // Hide windows from old desktop
        this.hideDesktopWindows(oldDesktop);
        
        // Show windows from new desktop
        this.showDesktopWindows(desktopId);
        
        // Update last active times
        this.desktops.get(oldDesktop).lastActive = Date.now();
        this.desktops.get(desktopId).lastActive = Date.now();
        
        // Update taskbar
        this.os.modules.EventBus.emit('desktop:changed', {
            from: oldDesktop,
            to: desktopId
        });
        
        // Save state
        this.saveState();
        
        // Phase 3: Broadcast desktop change to collaborators
        if (this.os.modules.Collaboration) {
            this.os.modules.Collaboration.broadcast('desktop_changed', {
                from: oldDesktop,
                to: desktopId,
                user: this.os.modules.Security?.getCurrentUser()?.username
            });
        }
    },
    
    switchToDesktopByIndex(index) {
        const desktopId = `desktop-${index}`;
        if (this.desktops.has(desktopId)) {
            this.switchToDesktop(desktopId);
        }
    },
    
    nextDesktop() {
        const currentIndex = this.getDesktopIndex(this.currentDesktop);
        const nextIndex = (currentIndex % this.desktops.size) + 1;
        this.switchToDesktopByIndex(nextIndex);
    },
    
    previousDesktop() {
        const currentIndex = this.getDesktopIndex(this.currentDesktop);
        const prevIndex = currentIndex === 1 ? this.desktops.size : currentIndex - 1;
        this.switchToDesktopByIndex(prevIndex);
    },
    
    getDesktopIndex(desktopId) {
        return parseInt(desktopId.split('-')[1]);
    },
    
    hideDesktopWindows(desktopId) {
        const desktop = this.desktops.get(desktopId);
        if (!desktop) return;
        
        desktop.windows.forEach(winId => {
            const win = this.os.modules.WindowManager?.windows.get(winId);
            if (win) {
                win.element.style.display = 'none';
            }
        });
    },
    
    showDesktopWindows(desktopId) {
        const desktop = this.desktops.get(desktopId);
        if (!desktop) return;
        
        desktop.windows.forEach(winId => {
            const win = this.os.modules.WindowManager?.windows.get(winId);
            if (win && win.state !== 'minimized') {
                win.element.style.display = 'flex';
            }
        });
    },
    
    addWindowToDesktop(winId, desktopId) {
        const desktop = this.desktops.get(desktopId);
        if (desktop && !desktop.windows.has(winId)) {
            desktop.windows.add(winId);
            
            // Update visibility
            const win = this.os.modules.WindowManager?.windows.get(winId);
            if (win) {
                win.element.style.display = desktopId === this.currentDesktop ? 'flex' : 'none';
            }
            
            this.saveState();
        }
    },
    
    removeWindowFromDesktop(winId, desktopId) {
        const desktop = this.desktops.get(desktopId);
        if (desktop) {
            desktop.windows.delete(winId);
            this.saveState();
        }
    },
    
    removeWindowFromAllDesktops(winId) {
        this.desktops.forEach(desktop => {
            desktop.windows.delete(winId);
        });
        this.saveState();
    },
    
    moveWindowToDesktop(winId, desktopId) {
        // Remove from current desktop
        this.desktops.forEach(desktop => {
            if (desktop.windows.has(winId)) {
                desktop.windows.delete(winId);
            }
        });
        
        // Add to new desktop
        this.addWindowToDesktop(winId, desktopId);
        
        // Phase 3: Broadcast window move
        if (this.os.modules.Collaboration) {
            this.os.modules.Collaboration.broadcast('window_moved_desktop', {
                windowId: winId,
                to: desktopId,
                user: this.os.modules.Security?.getCurrentUser()?.username
            });
        }
    },
    
    saveWindowLayout(winId, position) {
        const desktop = this.desktops.get(this.currentDesktop);
        if (desktop) {
            desktop.layout[winId] = {
                ...position,
                timestamp: Date.now()
            };
            this.saveState();
        }
    },
    
    // ==================== DESKTOP CUSTOMIZATION ====================
    
    renameDesktop(desktopId, newName) {
        const desktop = this.desktops.get(desktopId);
        if (desktop) {
            desktop.name = newName;
            this.saveState();
            this.os.modules.EventBus.emit('desktop:renamed', { desktopId, newName });
        }
    },
    
    setDesktopWallpaper(desktopId, wallpaper) {
        const desktop = this.desktops.get(desktopId);
        if (desktop) {
            desktop.wallpaper = wallpaper;
            this.saveState();
            
            if (desktopId === this.currentDesktop) {
                this.applyDesktopWallpaper(desktopId);
            }
        }
    },
    
    applyDesktopWallpaper(desktopId) {
        const desktop = this.desktops.get(desktopId);
        if (!desktop || !desktop.wallpaper) return;
        
        const desktopEl = document.getElementById('desktop');
        if (desktopEl) {
            desktopEl.style.backgroundImage = `url('${desktop.wallpaper}')`;
        }
    },
    
    addDesktop() {
        const newIndex = this.desktops.size + 1;
        const id = `desktop-${newIndex}`;
        
        this.desktops.set(id, {
            id,
            name: `Desktop ${newIndex}`,
            index: newIndex,
            windows: new Set(),
            wallpaper: null,
            created: Date.now(),
            lastActive: null,
            layout: {},
            collaborators: new Set()
        });
        
        this.saveState();
        this.os.modules.EventBus.emit('desktop:added', { desktopId: id });
        
        return id;
    },
    
    removeDesktop(desktopId) {
        if (desktopId === 'desktop-1') {
            throw new Error('Cannot remove main desktop');
        }
        
        const desktop = this.desktops.get(desktopId);
        if (!desktop) return;
        
        // Move all windows to main desktop
        desktop.windows.forEach(winId => {
            this.moveWindowToDesktop(winId, 'desktop-1');
        });
        
        this.desktops.delete(desktopId);
        
        if (this.currentDesktop === desktopId) {
            this.switchToDesktop('desktop-1');
        }
        
        this.saveState();
        this.os.modules.EventBus.emit('desktop:removed', { desktopId });
    },
    
    // ==================== DESKTOP SWITCHER UI ====================
    
    showDesktopSwitcher() {
        const switcher = document.createElement('div');
        switcher.className = 'desktop-switcher';
        
        let html = `
            <div class="switcher-header">
                <h2><span>🖥️</span> Virtual Desktops</h2>
                <button class="switcher-close" onclick="this.closest('.desktop-switcher').remove()">✕</button>
            </div>
            <div class="desktops-grid">
        `;
        
        this.desktops.forEach(desktop => {
            const isCurrent = desktop.id === this.currentDesktop;
            const windowCount = desktop.windows.size;
            
            html += `
                <div class="desktop-thumbnail ${isCurrent ? 'current' : ''}" 
                     onclick="DisplayManager.switchToDesktop('${desktop.id}')">
                    <div class="thumbnail-preview">
                        ${Array(Math.min(windowCount, 9)).fill('🪟').join('')}
                        ${windowCount === 0 ? '📄' : ''}
                        ${windowCount > 9 ? '+' + (windowCount - 9) : ''}
                    </div>
                    <div class="thumbnail-name">
                        <span>${desktop.name}</span>
                        <button class="thumbnail-rename" onclick="event.stopPropagation(); DisplayManager.renameDesktopPrompt('${desktop.id}')">✏️</button>
                    </div>
                    <div class="thumbnail-count">${windowCount} window${windowCount !== 1 ? 's' : ''}</div>
                    <div class="thumbnail-actions">
                        ${desktop.id !== 'desktop-1' ? `
                            <button class="thumbnail-action-btn delete" onclick="event.stopPropagation(); DisplayManager.removeDesktop('${desktop.id}')">🗑️</button>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        html += `
            </div>
            <div class="switcher-footer">
                <div class="switcher-footer-left">
                    <button class="switcher-btn" onclick="DisplayManager.addDesktop()">➕ New Desktop</button>
                </div>
                <div class="switcher-footer-right">
                    <button class="switcher-btn" onclick="DisplayManager.showDesktopSettings()">⚙️ Settings</button>
                    <button class="switcher-btn primary" onclick="this.closest('.desktop-switcher').remove()">Done</button>
                </div>
            </div>
            <div class="switcher-hint">
                <span><span class="hint-key">Ctrl</span> + <span class="hint-key">1-${this.desktops.size}</span> to switch</span>
                <span><span class="hint-key">Ctrl</span> + <span class="hint-key">Tab</span> to open switcher</span>
            </div>
        `;
        
        switcher.innerHTML = html;
        document.body.appendChild(switcher);
    },
    
    renameDesktopPrompt(desktopId) {
        const desktop = this.desktops.get(desktopId);
        const newName = prompt('Enter new desktop name:', desktop.name);
        if (newName && newName.trim()) {
            this.renameDesktop(desktopId, newName.trim());
            
            // Update switcher if open
            const switcher = document.querySelector('.desktop-switcher');
            if (switcher) {
                this.showDesktopSwitcher();
            }
        }
    },
    
    showDesktopSettings() {
        // Would open settings to desktop preferences
        this.os.modules.EventBus.emit('settings:open', { section: 'desktops' });
    },
    
    // ==================== PHASE 3: COLLABORATION ====================
    
    addCollaboratorToDesktop(desktopId, username) {
        if (!this.desktopCollaborators.has(desktopId)) {
            this.desktopCollaborators.set(desktopId, new Set());
        }
        
        this.desktopCollaborators.get(desktopId).add(username);
        this.updateDesktopCollaboratorsIndicator(desktopId);
    },
    
    removeCollaboratorFromDesktop(desktopId, username) {
        const collab = this.desktopCollaborators.get(desktopId);
        if (collab) {
            collab.delete(username);
            this.updateDesktopCollaboratorsIndicator(desktopId);
        }
    },
    
    updateDesktopCollaboratorsIndicator(desktopId) {
        // Could show in taskbar or desktop switcher
        const collaborators = this.desktopCollaborators.get(desktopId) || new Set();
        
        if (desktopId === this.currentDesktop && collaborators.size > 0) {
            // Show in taskbar
            this.os.modules.EventBus.emit('desktop:collaborators', {
                desktopId,
                count: collaborators.size,
                users: Array.from(collaborators)
            });
        }
    },
    
    getDesktopCollaborators(desktopId) {
        return Array.from(this.desktopCollaborators.get(desktopId) || []);
    },
    
    // ==================== UTILITY METHODS ====================
    
    getCurrentDesktop() {
        return this.desktops.get(this.currentDesktop);
    },
    
    getDesktop(desktopId) {
        return this.desktops.get(desktopId);
    },
    
    getAllDesktops() {
        return Array.from(this.desktops.values());
    },
    
    getDesktopWindows(desktopId) {
        const desktop = this.desktops.get(desktopId);
        return desktop ? Array.from(desktop.windows) : [];
    },
    
    getDisplays() {
        return Array.from(this.displays.values());
    },
    
    getDisplay(displayId) {
        return this.displays.get(displayId);
    }
};

window.DisplayManager = DisplayManager;
