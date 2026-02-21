/**
 * BhekOS Window Manager - Complete window management with collaboration features
 */
const WindowManager = {
    os: null,
    
    // Active windows
    windows: new Map(),
    
    // Z-index counter
    zIndex: 1000,
    
    // Currently focused window
    focusedWindow: null,
    
    // Drag state
    dragState: null,
    
    // Window states
    states: {
        NORMAL: 'normal',
        MINIMIZED: 'minimized',
        MAXIMIZED: 'maximized',
        SNAPPED_LEFT: 'snapped-left',
        SNAPPED_RIGHT: 'snapped-right',
        SNAPPED_TOP: 'snapped-top',
        SNAPPED_BOTTOM: 'snapped-bottom',
        FULLSCREEN: 'fullscreen'
    },
    
    // Window animations
    animations: true,
    
    // Window snap regions
    snapRegions: {
        left: { width: 0.5, height: 1.0 },
        right: { width: 0.5, height: 1.0 },
        top: { width: 1.0, height: 0.5 },
        bottom: { width: 1.0, height: 0.5 },
        topLeft: { width: 0.5, height: 0.5 },
        topRight: { width: 0.5, height: 0.5 },
        bottomLeft: { width: 0.5, height: 0.5 },
        bottomRight: { width: 0.5, height: 0.5 }
    },
    
    // Phase 3: Collaboration features
    collaborators: new Map(), // windowId -> Set of users viewing
    remoteCursors: new Map(), // windowId -> Map of user -> cursor position
    windowLocks: new Map(), // windowId -> username (who has focus/lock)
    
    async init(os) {
        this.os = os;
        this.setupEventListeners();
        this.setupSnapDetection(); // Phase 2
        await this.loadSavedState();
        
        // Phase 3: Collaboration setup
        this.setupCollaborationListeners();
        
        console.log('Window Manager initialized');
        return this;
    },
    
    setupEventListeners() {
        document.addEventListener('mousedown', (e) => {
            const win = e.target.closest('.window');
            if (win) {
                this.focus(win.id);
            }
        });
        
        document.addEventListener('mousemove', (e) => this.onDrag(e));
        document.addEventListener('mouseup', () => this.onDragEnd());
        
        // Phase 2: Keyboard shortcuts for window management
        document.addEventListener('keydown', (e) => {
            if (e.altKey && e.key === 'Tab') {
                e.preventDefault();
                this.showWindowSwitcher();
            }
            
            if (e.metaKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                this.snapFocusedWindow('left');
            }
            
            if (e.metaKey && e.key === 'ArrowRight') {
                e.preventDefault();
                this.snapFocusedWindow('right');
            }
            
            if (e.metaKey && e.key === 'ArrowUp') {
                e.preventDefault();
                this.maximizeFocused();
            }
            
            if (e.metaKey && e.key === 'ArrowDown') {
                e.preventDefault();
                if (this.focusedWindow) {
                    const win = this.windows.get(this.focusedWindow);
                    if (win.state === this.states.MAXIMIZED) {
                        this.restore(this.focusedWindow);
                    }
                }
            }
        });
    },
    
    // Phase 3: Collaboration listeners
    setupCollaborationListeners() {
        if (!this.os.modules.EventBus) return;
        
        this.os.modules.EventBus.on('collaboration:user_joined', (data) => {
            this.handleUserJoined(data);
        });
        
        this.os.modules.EventBus.on('collaboration:user_left', (data) => {
            this.handleUserLeft(data);
        });
        
        this.os.modules.EventBus.on('collaboration:cursor_moved', (data) => {
            this.handleRemoteCursor(data);
        });
        
        this.os.modules.EventBus.on('collaboration:window_focused', (data) => {
            this.handleRemoteFocus(data);
        });
    },
    
    // ==================== WINDOW CREATION ====================
    
    createWindow(app, options = {}) {
        const id = 'win_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const win = document.createElement('div');
        win.className = 'window';
        win.id = id;
        win.dataset.appId = app.id;
        
        const savedState = this.getSavedState(app.id);
        const defaultLeft = 100 + (this.windows.size % 5) * 30;
        const defaultTop = 50 + (this.windows.size % 5) * 30;
        
        win.style.left = (savedState?.left || defaultLeft) + 'px';
        win.style.top = (savedState?.top || defaultTop) + 'px';
        win.style.width = (savedState?.width || options.width || '600px');
        win.style.height = (savedState?.height || options.height || '400px');
        win.style.zIndex = ++this.zIndex;
        
        win.innerHTML = this.createWindowHTML(app, savedState);
        
        document.getElementById('windows-container').appendChild(win);
        
        this.setupWindowControls(win, id, app);
        
        // Phase 3: Collaboration setup
        this.collaborators.set(id, new Set());
        this.remoteCursors.set(id, new Map());
        
        this.windows.set(id, {
            id,
            element: win,
            app,
            state: savedState?.state || this.states.NORMAL,
            previousState: savedState?.previousState,
            created: Date.now(),
            lastFocused: Date.now(),
            minimized: false,
            collaborators: new Set() // Phase 3
        });
        
        if (this.os.modules.Taskbar) {
            this.os.modules.Taskbar.addApp(app.id, app.name, app.icon);
        }
        
        this.focus(id);
        this.loadAppContent(win, app, options);
        
        // Phase 3: Broadcast window creation to collaborators
        this.broadcastWindowEvent('window_created', { windowId: id, app: app.id });
        
        return id;
    },
    
    createWindowHTML(app, savedState) {
        const theme = this.os.modules.Settings?.get('personalization.theme', 'dark');
        const isMaximized = savedState?.state === this.states.MAXIMIZED;
        
        return `
            <div class="window-titlebar">
                <div class="window-title">
                    <span class="window-icon">${app.icon}</span>
                    <span class="window-title-text">${app.name}</span>
                </div>
                <div class="window-controls ${theme === 'dark' ? 'windows-style' : 'mac-style'}">
                    <button class="window-minimize" title="Minimize">${theme === 'dark' ? '─' : ''}</button>
                    <button class="window-maximize" title="Maximize">${theme === 'dark' ? '□' : ''}</button>
                    <button class="window-close" title="Close">${theme === 'dark' ? '✕' : ''}</button>
                </div>
            </div>
            <div class="window-content" id="content-${app.id}"></div>
            <div class="window-resize-handle"></div>
            <!-- Phase 3: Collaborators indicator -->
            <div class="window-collaborators" id="collab-${app.id}" style="display: none;"></div>
        `;
    },
    
    setupWindowControls(win, id, app) {
        const titlebar = win.querySelector('.window-titlebar');
        const minimizeBtn = win.querySelector('.window-minimize');
        const maximizeBtn = win.querySelector('.window-maximize');
        const closeBtn = win.querySelector('.window-close');
        const resizeHandle = win.querySelector('.window-resize-handle');
        
        titlebar.addEventListener('mousedown', (e) => {
            if (e.target === titlebar || e.target.closest('.window-title')) {
                this.startDrag(e, id);
            }
        });
        
        minimizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.minimize(id);
        });
        
        maximizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMaximize(id);
        });
        
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.close(id);
        });
        
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startResize(e, id);
            });
        }
        
        // Phase 3: Track mouse movement for remote cursors
        win.addEventListener('mousemove', (e) => {
            if (this.os.modules.Collaboration?.isSharing()) {
                this.broadcastCursorPosition(id, {
                    x: e.clientX - win.offsetLeft,
                    y: e.clientY - win.offsetTop
                });
            }
        });
    },
    
    // ==================== WINDOW OPERATIONS ====================
    
    startDrag(e, id) {
        e.preventDefault();
        const win = this.windows.get(id);
        if (!win) return;
        
        const element = win.element;
        
        this.dragState = {
            type: 'drag',
            id: id,
            startX: e.clientX,
            startY: e.clientY,
            startLeft: parseInt(element.style.left) || 0,
            startTop: parseInt(element.style.top) || 0,
            snapEnabled: true
        };
        
        element.style.transition = 'none';
        element.style.opacity = '0.95';
        element.classList.add('dragging');
        
        this.focus(id);
    },
    
    startResize(e, id) {
        e.preventDefault();
        const win = this.windows.get(id);
        if (!win) return;
        
        const element = win.element;
        
        this.dragState = {
            type: 'resize',
            id: id,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: element.offsetWidth,
            startHeight: element.offsetHeight,
            startLeft: parseInt(element.style.left) || 0,
            startTop: parseInt(element.style.top) || 0
        };
        
        element.style.transition = 'none';
        element.classList.add('resizing');
    },
    
    onDrag(e) {
        if (!this.dragState) return;
        
        const win = this.windows.get(this.dragState.id);
        if (!win) return;
        
        const element = win.element;
        const dx = e.clientX - this.dragState.startX;
        const dy = e.clientY - this.dragState.startY;
        
        if (this.dragState.type === 'drag') {
            const newLeft = this.dragState.startLeft + dx;
            const newTop = this.dragState.startTop + dy;
            
            element.style.left = newLeft + 'px';
            element.style.top = newTop + 'px';
            
            // Phase 2: Snap detection
            if (this.dragState.snapEnabled) {
                this.checkSnap(newLeft, newTop, element.offsetWidth, element.offsetHeight);
            }
        } else if (this.dragState.type === 'resize') {
            const newWidth = Math.max(300, this.dragState.startWidth + dx);
            const newHeight = Math.max(200, this.dragState.startHeight + dy);
            
            element.style.width = newWidth + 'px';
            element.style.height = newHeight + 'px';
        }
    },
    
    onDragEnd() {
        if (this.dragState) {
            const win = this.windows.get(this.dragState.id);
            if (win) {
                win.element.style.transition = '';
                win.element.style.opacity = '';
                win.element.classList.remove('dragging', 'resizing');
                
                // Check if snapped
                if (this.dragState.type === 'drag' && this.currentSnapRegion) {
                    this.applySnap(this.dragState.id, this.currentSnapRegion);
                }
                
                this.saveWindowState(this.dragState.id);
                
                // Phase 3: Broadcast window move
                this.broadcastWindowEvent('window_moved', {
                    windowId: this.dragState.id,
                    left: win.element.style.left,
                    top: win.element.style.top
                });
            }
            this.dragState = null;
            this.currentSnapRegion = null;
        }
    },
    
    // Phase 2: Snap detection
    checkSnap(left, top, width, height) {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight - 48; // Account for taskbar
        const margin = 20;
        
        this.currentSnapRegion = null;
        
        if (left < margin && top < margin) {
            this.currentSnapRegion = 'topLeft';
        } else if (left + width > screenWidth - margin && top < margin) {
            this.currentSnapRegion = 'topRight';
        } else if (left < margin && top + height > screenHeight - margin) {
            this.currentSnapRegion = 'bottomLeft';
        } else if (left + width > screenWidth - margin && top + height > screenHeight - margin) {
            this.currentSnapRegion = 'bottomRight';
        } else if (left < margin) {
            this.currentSnapRegion = 'left';
        } else if (left + width > screenWidth - margin) {
            this.currentSnapRegion = 'right';
        } else if (top < margin) {
            this.currentSnapRegion = 'top';
        } else if (top + height > screenHeight - margin) {
            this.currentSnapRegion = 'bottom';
        }
        
        // Visual feedback
        document.querySelectorAll('.snap-indicator').forEach(el => el.remove());
        
        if (this.currentSnapRegion) {
            const indicator = document.createElement('div');
            indicator.className = 'snap-indicator';
            const region = this.snapRegions[this.currentSnapRegion];
            
            indicator.style.position = 'fixed';
            indicator.style.background = 'rgba(var(--accent-rgb), 0.2)';
            indicator.style.border = '2px solid var(--accent)';
            indicator.style.borderRadius = '8px';
            indicator.style.pointerEvents = 'none';
            indicator.style.zIndex = '999999';
            
            if (this.currentSnapRegion.includes('left')) {
                indicator.style.left = '0';
                indicator.style.width = (screenWidth * region.width) + 'px';
            } else if (this.currentSnapRegion.includes('right')) {
                indicator.style.right = '0';
                indicator.style.width = (screenWidth * region.width) + 'px';
            } else {
                indicator.style.left = '0';
                indicator.style.width = '100%';
            }
            
            if (this.currentSnapRegion.includes('top')) {
                indicator.style.top = '0';
                indicator.style.height = (screenHeight * region.height) + 'px';
            } else if (this.currentSnapRegion.includes('bottom')) {
                indicator.style.bottom = '48px';
                indicator.style.height = (screenHeight * region.height) + 'px';
            } else {
                indicator.style.top = '0';
                indicator.style.height = '100%';
            }
            
            document.body.appendChild(indicator);
        }
    },
    
    applySnap(id, region) {
        const win = this.windows.get(id);
        if (!win) return;
        
        const element = win.element;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight - 48;
        const snap = this.snapRegions[region];
        
        let left, top, width, height;
        
        switch (region) {
            case 'left':
                left = 0;
                top = 0;
                width = screenWidth * snap.width;
                height = screenHeight;
                break;
            case 'right':
                left = screenWidth * (1 - snap.width);
                top = 0;
                width = screenWidth * snap.width;
                height = screenHeight;
                break;
            case 'top':
                left = 0;
                top = 0;
                width = screenWidth;
                height = screenHeight * snap.height;
                break;
            case 'bottom':
                left = 0;
                top = screenHeight * (1 - snap.height);
                width = screenWidth;
                height = screenHeight * snap.height;
                break;
            case 'topLeft':
                left = 0;
                top = 0;
                width = screenWidth * snap.width;
                height = screenHeight * snap.height;
                break;
            case 'topRight':
                left = screenWidth * (1 - snap.width);
                top = 0;
                width = screenWidth * snap.width;
                height = screenHeight * snap.height;
                break;
            case 'bottomLeft':
                left = 0;
                top = screenHeight * (1 - snap.height);
                width = screenWidth * snap.width;
                height = screenHeight * snap.height;
                break;
            case 'bottomRight':
                left = screenWidth * (1 - snap.width);
                top = screenHeight * (1 - snap.height);
                width = screenWidth * snap.width;
                height = screenHeight * snap.height;
                break;
        }
        
        element.style.left = left + 'px';
        element.style.top = top + 'px';
        element.style.width = width + 'px';
        element.style.height = height + 'px';
        element.style.transition = 'all 0.2s';
        
        win.previousState = win.state;
        win.state = `snapped-${region}`;
        
        setTimeout(() => {
            element.style.transition = '';
        }, 200);
        
        document.querySelectorAll('.snap-indicator').forEach(el => el.remove());
    },
    
    snapFocusedWindow(direction) {
        if (!this.focusedWindow) return;
        this.applySnap(this.focusedWindow, direction);
    },
    
    toggleMaximize(id) {
        const win = this.windows.get(id);
        if (!win) return;
        
        const element = win.element;
        
        if (win.state === this.states.MAXIMIZED) {
            // Restore
            if (win.previousState) {
                element.style.left = win.previousState.left;
                element.style.top = win.previousState.top;
                element.style.width = win.previousState.width;
                element.style.height = win.previousState.height;
                element.style.borderRadius = '12px';
            }
            win.state = this.states.NORMAL;
        } else {
            // Maximize
            win.previousState = {
                left: element.style.left,
                top: element.style.top,
                width: element.style.width,
                height: element.style.height
            };
            
            element.style.left = '0';
            element.style.top = '0';
            element.style.width = '100vw';
            element.style.height = 'calc(100vh - 48px)';
            element.style.borderRadius = '0';
            win.state = this.states.MAXIMIZED;
        }
        
        this.saveWindowState(id);
        
        // Phase 3: Broadcast state change
        this.broadcastWindowEvent('window_state_changed', {
            windowId: id,
            state: win.state
        });
    },
    
    maximizeFocused() {
        if (this.focusedWindow) {
            this.toggleMaximize(this.focusedWindow);
        }
    },
    
    minimize(id) {
        const win = this.windows.get(id);
        if (!win) return;
        
        if (win.state === this.states.MINIMIZED) {
            win.element.style.display = 'flex';
            win.state = win.previousState || this.states.NORMAL;
        } else {
            win.previousState = win.state;
            win.element.style.display = 'none';
            win.state = this.states.MINIMIZED;
        }
        
        this.saveWindowState(id);
        
        // Phase 3: Broadcast state change
        this.broadcastWindowEvent('window_state_changed', {
            windowId: id,
            state: win.state
        });
    },
    
    restore(id) {
        const win = this.windows.get(id);
        if (!win) return;
        
        win.element.style.display = 'flex';
        win.state = this.states.NORMAL;
        
        this.saveWindowState(id);
    },
    
    close(id) {
        const win = this.windows.get(id);
        if (!win) return;
        
        // Phase 3: Check if window is locked
        if (this.windowLocks.get(id) && this.windowLocks.get(id) !== this.os.modules.Security?.getCurrentUser()?.username) {
            this.os.notify('Window', 'This window is locked by another user', 'warning');
            return;
        }
        
        if (this.os.modules.Taskbar) {
            this.os.modules.Taskbar.removeApp(win.app.id);
        }
        
        win.element.remove();
        this.windows.delete(id);
        
        // Phase 3: Clean up collaboration data
        this.collaborators.delete(id);
        this.remoteCursors.delete(id);
        this.windowLocks.delete(id);
        
        this.saveWindowState(id, true);
        
        // Phase 3: Broadcast window close
        this.broadcastWindowEvent('window_closed', { windowId: id });
    },
    
    focus(id) {
        const win = this.windows.get(id);
        if (!win) return;
        
        win.element.style.zIndex = ++this.zIndex;
        win.lastFocused = Date.now();
        
        if (this.os.modules.Taskbar) {
            this.os.modules.Taskbar.setActive(win.app.id);
        }
        
        this.windows.forEach((w, wid) => {
            w.element.classList.toggle('focused', wid === id);
        });
        
        this.focusedWindow = id;
        
        // Phase 3: Broadcast focus change
        this.broadcastWindowEvent('window_focused', {
            windowId: id,
            user: this.os.modules.Security?.getCurrentUser()?.username
        });
    },
    
    minimizeAll() {
        this.windows.forEach((win, id) => {
            if (win.state !== this.states.MINIMIZED) {
                this.minimize(id);
            }
        });
    },
    
    // ==================== WINDOW SWITCHER (Phase 2) ====================
    
    showWindowSwitcher() {
        const switcher = document.createElement('div');
        switcher.className = 'window-switcher';
        
        const windows = Array.from(this.windows.values())
            .sort((a, b) => b.lastFocused - a.lastFocused);
        
        windows.forEach((win, index) => {
            const item = document.createElement('div');
            item.className = 'switcher-item';
            item.dataset.windowId = win.id;
            item.innerHTML = `
                <div class="switcher-icon">${win.app?.icon || '🪟'}</div>
                <div class="switcher-name">${win.app?.name || 'Window'}</div>
            `;
            switcher.appendChild(item);
        });
        
        document.body.appendChild(switcher);
        
        let currentIndex = 0;
        const items = switcher.querySelectorAll('.switcher-item');
        items[currentIndex]?.classList.add('selected');
        
        const keyHandler = (e) => {
            if (e.key === 'Tab' && e.altKey) {
                e.preventDefault();
                items[currentIndex].classList.remove('selected');
                currentIndex = (currentIndex + 1) % items.length;
                items[currentIndex].classList.add('selected');
            } else if (e.key === 'Alt') {
                const winId = items[currentIndex]?.dataset.windowId;
                if (winId) {
                    this.focus(winId);
                }
                switcher.remove();
                document.removeEventListener('keydown', keyHandler);
            }
        };
        
        document.addEventListener('keydown', keyHandler);
        
        setTimeout(() => {
            if (document.body.contains(switcher)) {
                switcher.remove();
                document.removeEventListener('keydown', keyHandler);
            }
        }, 3000);
    },
    
    // ==================== CONTENT LOADING ====================
    
    async loadAppContent(win, app, options) {
        const contentDiv = win.querySelector('.window-content');
        if (!contentDiv) return;
        
        const appName = app.id.replace(/-/g, '_') + 'App';
        
        if (window[appName]) {
            const appInstance = new window[appName](this.os, win.id);
            await appInstance.render(contentDiv, options);
            win.appInstance = appInstance;
        } else {
            contentDiv.innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; height: 100%;">
                    <div style="text-align: center;">
                        <div style="font-size: 48px; margin-bottom: 16px;">${app.icon}</div>
                        <h3>${app.name}</h3>
                        <p style="opacity: 0.7; margin-top: 8px;">Version ${app.version}</p>
                        <p style="font-size: 12px; margin-top: 16px;">App content would load here</p>
                    </div>
                </div>
            `;
        }
        
        // Record app launch
        if (this.os.modules.AppStore) {
            this.os.modules.AppStore.recordAppLaunch(app.id);
        }
    },
    
    // ==================== STATE MANAGEMENT ====================
    
    saveWindowState(id, remove = false) {
        const win = this.windows.get(id);
        if (!win || win.app.builtin) return;
        
        const states = this.os.modules.Storage.get('windowStates', {});
        
        if (remove) {
            delete states[win.app.id];
        } else {
            states[win.app.id] = {
                left: win.element.style.left,
                top: win.element.style.top,
                width: win.element.style.width,
                height: win.element.style.height,
                state: win.state,
                previousState: win.previousState
            };
        }
        
        this.os.modules.Storage.set('windowStates', states);
    },
    
    getSavedState(appId) {
        const states = this.os.modules.Storage.get('windowStates', {});
        return states[appId];
    },
    
    loadSavedState() {
        // States are applied when windows are created
    },
    
    // ==================== SNAP DETECTION (Phase 2) ====================
    
    setupSnapDetection() {
        // Add snap regions overlay
        const style = document.createElement('style');
        style.textContent = `
            .snap-indicator {
                animation: snapPulse 0.5s infinite alternate;
            }
            
            @keyframes snapPulse {
                from { opacity: 0.3; }
                to { opacity: 0.6; }
            }
        `;
        document.head.appendChild(style);
    },
    
    // ==================== PHASE 3: COLLABORATION METHODS ====================
    
    /**
     * Add collaborator to window
     */
    addCollaborator(windowId, username) {
        if (!this.collaborators.has(windowId)) {
            this.collaborators.set(windowId, new Set());
        }
        
        this.collaborators.get(windowId).add(username);
        this.updateCollaboratorsIndicator(windowId);
    },
    
    /**
     * Remove collaborator from window
     */
    removeCollaborator(windowId, username) {
        const collab = this.collaborators.get(windowId);
        if (collab) {
            collab.delete(username);
            this.updateCollaboratorsIndicator(windowId);
        }
    },
    
    /**
     * Update collaborators indicator in window titlebar
     */
    updateCollaboratorsIndicator(windowId) {
        const win = this.windows.get(windowId);
        if (!win) return;
        
        const indicator = win.element.querySelector('.window-collaborators');
        if (!indicator) return;
        
        const collaborators = this.collaborators.get(windowId) || new Set();
        
        if (collaborators.size > 0) {
            indicator.style.display = 'flex';
            indicator.innerHTML = Array.from(collaborators).map(user => `
                <div class="window-collaborator" title="${user}">
                    ${user.charAt(0).toUpperCase()}
                </div>
            `).join('');
        } else {
            indicator.style.display = 'none';
        }
    },
    
    /**
     * Handle remote cursor movement
     */
    handleRemoteCursor(data) {
        const { windowId, user, position } = data;
        
        const cursors = this.remoteCursors.get(windowId);
        if (!cursors) return;
        
        cursors.set(user, {
            ...position,
            lastUpdate: Date.now()
        });
        
        this.updateRemoteCursor(windowId, user, position);
    },
    
    /**
     * Update remote cursor in window
     */
    updateRemoteCursor(windowId, user, position) {
        const win = this.windows.get(windowId);
        if (!win) return;
        
        let cursor = win.element.querySelector(`.remote-cursor[data-user="${user}"]`);
        
        if (!cursor) {
            cursor = document.createElement('div');
            cursor.className = 'remote-cursor';
            cursor.setAttribute('data-user', user);
            cursor.style.borderColor = this.getUserColor(user);
            win.element.appendChild(cursor);
        }
        
        cursor.style.left = position.x + 'px';
        cursor.style.top = position.y + 'px';
    },
    
    /**
     * Handle user joining collaboration
     */
    handleUserJoined(data) {
        const { username, windows } = data;
        
        // Add user to windows they're viewing
        if (windows) {
            windows.forEach(windowId => {
                this.addCollaborator(windowId, username);
            });
        }
    },
    
    /**
     * Handle user leaving collaboration
     */
    handleUserLeft(data) {
        const { username } = data;
        
        // Remove user from all windows
        this.collaborators.forEach((users, windowId) => {
            if (users.has(username)) {
                users.delete(username);
                this.updateCollaboratorsIndicator(windowId);
            }
        });
        
        // Remove cursors
        this.remoteCursors.forEach((cursors, windowId) => {
            cursors.delete(username);
            const win = this.windows.get(windowId);
            if (win) {
                const cursor = win.element.querySelector(`.remote-cursor[data-user="${username}"]`);
                if (cursor) cursor.remove();
            }
        });
    },
    
    /**
     * Handle remote window focus
     */
    handleRemoteFocus(data) {
        const { windowId, user } = data;
        
        // Show indicator that another user focused this window
        const win = this.windows.get(windowId);
        if (win) {
            // Could add temporary highlight
        }
    },
    
    /**
     * Broadcast cursor position to collaborators
     */
    broadcastCursorPosition(windowId, position) {
        if (!this.os.modules.Collaboration) return;
        
        this.os.modules.Collaboration.broadcast('cursor_moved', {
            windowId,
            position,
            timestamp: Date.now()
        });
    },
    
    /**
     * Broadcast window event to collaborators
     */
    broadcastWindowEvent(event, data) {
        if (!this.os.modules.Collaboration) return;
        
        this.os.modules.Collaboration.broadcast(event, {
            ...data,
            user: this.os.modules.Security?.getCurrentUser()?.username,
            timestamp: Date.now()
        });
    },
    
    /**
     * Lock window for exclusive editing
     */
    async lockWindow(windowId) {
        const win = this.windows.get(windowId);
        if (!win) return false;
        
        const currentUser = this.os.modules.Security?.getCurrentUser()?.username;
        const currentLock = this.windowLocks.get(windowId);
        
        if (currentLock && currentLock !== currentUser) {
            return false;
        }
        
        this.windowLocks.set(windowId, currentUser);
        
        // Add visual indicator
        win.element.classList.add('locked');
        
        this.broadcastWindowEvent('window_locked', { windowId });
        
        return true;
    },
    
    /**
     * Unlock window
     */
    unlockWindow(windowId) {
        const win = this.windows.get(windowId);
        if (!win) return false;
        
        this.windowLocks.delete(windowId);
        win.element.classList.remove('locked');
        
        this.broadcastWindowEvent('window_unlocked', { windowId });
        
        return true;
    },
    
    /**
     * Get user color for cursor
     */
    getUserColor(username) {
        const colors = [
            '#FF5252', '#4CAF50', '#2196F3', '#FFC107', '#9C27B0',
            '#FF9800', '#00BCD4', '#E91E63', '#8BC34A', '#673AB7'
        ];
        
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = ((hash << 5) - hash) + username.charCodeAt(i);
            hash = hash & hash;
        }
        
        return colors[Math.abs(hash) % colors.length];
    },
    
    // ==================== UTILITY METHODS ====================
    
    getWindows() {
        return Array.from(this.windows.values());
    },
    
    getWindow(id) {
        return this.windows.get(id);
    },
    
    getFocusedWindow() {
        return this.focusedWindow ? this.windows.get(this.focusedWindow) : null;
    },
    
    getWindowsByApp(appId) {
        return Array.from(this.windows.values()).filter(w => w.app.id === appId);
    },
    
    closeAllWindows() {
        this.windows.forEach((win, id) => {
            this.close(id);
        });
    }
};

window.WindowManager = WindowManager;
