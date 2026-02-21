/**
 * BhekOS Desktop Icons Component - Desktop icon management
 */
const DesktopIcons = {
    os: null,
    element: null,
    
    // Icons state
    icons: new Map(),
    selectedIcon: null,
    selectionBox: null,
    isDragging: false,
    
    // Grid settings
    gridSize: 80,
    gridPadding: 20,
    
    async init(os) {
        this.os = os;
        this.element = document.getElementById('desktopIcons');
        await this.render();
        this.setupEventListeners();
        this.loadIconPositions();
        
        return this;
    },
    
    async render() {
        // Default desktop icons
        const defaultIcons = [
            { id: 'computer', name: 'This PC', icon: '💻', type: 'system', path: '/' },
            { id: 'recycle', name: 'Recycle Bin', icon: '🗑️', type: 'system', path: '/Trash' },
            { id: 'documents', name: 'Documents', icon: '📁', type: 'folder', path: '/Documents' },
            { id: 'downloads', name: 'Downloads', icon: '⬇️', type: 'folder', path: '/Downloads' },
            { id: 'network', name: 'Network', icon: '🌐', type: 'system', path: '/Network' }
        ];
        
        // Get installed apps
        const apps = this.os.modules.AppStore?.getInstalledApps() || [];
        
        // Combine and render
        const allIcons = [...defaultIcons, ...apps.map(app => ({
            id: app.id,
            name: app.name,
            icon: app.icon,
            type: 'app',
            appId: app.id
        }))];
        
        this.element.innerHTML = allIcons.map(icon => `
            <div class="desktop-icon" data-id="${icon.id}" data-type="${icon.type}" 
                 data-path="${icon.path || ''}" data-app="${icon.appId || ''}"
                 style="left: ${this.getIconPosition(icon.id).left}px; top: ${this.getIconPosition(icon.id).top}px;">
                <div class="icon-emoji">${icon.icon}</div>
                <div class="icon-name">${icon.name}</div>
            </div>
        `).join('');
        
        // Store icons
        allIcons.forEach(icon => {
            this.icons.set(icon.id, icon);
        });
        
        this.addStyles();
    },
    
    setupEventListeners() {
        // Single click - select
        this.element.addEventListener('click', (e) => {
            const icon = e.target.closest('.desktop-icon');
            if (icon) {
                e.stopPropagation();
                this.selectIcon(icon.dataset.id, e.ctrlKey);
            } else {
                this.deselectAll();
            }
        });
        
        // Double click - open
        this.element.addEventListener('dblclick', (e) => {
            const icon = e.target.closest('.desktop-icon');
            if (icon) {
                this.openIcon(icon.dataset.id, icon.dataset.type);
            }
        });
        
        // Right click - context menu
        this.element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const icon = e.target.closest('.desktop-icon');
            if (icon) {
                this.showIconContextMenu(e, icon.dataset.id);
            } else {
                this.showDesktopContextMenu(e);
            }
        });
        
        // Drag start
        this.element.addEventListener('mousedown', (e) => {
            const icon = e.target.closest('.desktop-icon');
            if (icon && e.button === 0) {
                this.startDrag(e, icon);
            }
        });
        
        // Selection box
        this.element.addEventListener('mousedown', (e) => {
            if (!e.target.closest('.desktop-icon') && e.button === 0) {
                this.startSelection(e);
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            this.onDrag(e);
            this.onSelection(e);
        });
        
        document.addEventListener('mouseup', (e) => {
            this.endDrag();
            this.endSelection(e);
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (this.selectedIcon) {
                switch(e.key) {
                    case 'Enter':
                        this.openIcon(this.selectedIcon, this.icons.get(this.selectedIcon)?.type);
                        break;
                    case 'Delete':
                        this.deleteIcon(this.selectedIcon);
                        break;
                    case 'F2':
                        this.renameIcon(this.selectedIcon);
                        break;
                    case 'ArrowUp':
                    case 'ArrowDown':
                    case 'ArrowLeft':
                    case 'ArrowRight':
                        e.preventDefault();
                        this.navigateWithKeyboard(e.key);
                        break;
                }
            }
        });
    },
    
    // ==================== SELECTION ====================
    
    selectIcon(id, multi = false) {
        const icon = document.querySelector(`.desktop-icon[data-id="${id}"]`);
        if (!icon) return;
        
        if (!multi) {
            this.deselectAll();
        }
        
        icon.classList.add('selected');
        this.selectedIcon = id;
        
        this.os.modules.EventBus.emit('desktop:iconSelected', { id });
    },
    
    deselectAll() {
        document.querySelectorAll('.desktop-icon.selected').forEach(el => {
            el.classList.remove('selected');
        });
        this.selectedIcon = null;
    },
    
    // ==================== DRAG AND DROP ====================
    
    startDrag(e, icon) {
        if (e.button !== 0) return;
        
        this.isDragging = true;
        this.dragIcon = icon;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.dragStartLeft = parseInt(icon.style.left) || 0;
        this.dragStartTop = parseInt(icon.style.top) || 0;
        
        icon.style.zIndex = '1000';
        icon.style.opacity = '0.8';
        icon.classList.add('dragging');
        
        // Select if not already selected
        if (!icon.classList.contains('selected')) {
            this.selectIcon(icon.dataset.id, e.ctrlKey);
        }
    },
    
    onDrag(e) {
        if (!this.isDragging || !this.dragIcon) return;
        
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        
        // Move all selected icons
        document.querySelectorAll('.desktop-icon.selected').forEach(icon => {
            const startLeft = parseInt(icon.dataset.startLeft) || parseInt(icon.style.left) || 0;
            const startTop = parseInt(icon.dataset.startTop) || parseInt(icon.style.top) || 0;
            
            icon.style.left = (startLeft + dx) + 'px';
            icon.style.top = (startTop + dy) + 'px';
        });
    },
    
    endDrag() {
        if (!this.isDragging) return;
        
        // Snap to grid
        document.querySelectorAll('.desktop-icon.selected').forEach(icon => {
            const left = parseInt(icon.style.left);
            const top = parseInt(icon.style.top);
            
            const snappedLeft = Math.round(left / this.gridSize) * this.gridSize + this.gridPadding;
            const snappedTop = Math.round(top / this.gridSize) * this.gridSize + this.gridPadding;
            
            icon.style.left = snappedLeft + 'px';
            icon.style.top = snappedTop + 'px';
            
            // Save position
            this.saveIconPosition(icon.dataset.id, snappedLeft, snappedTop);
            
            icon.style.zIndex = '';
            icon.style.opacity = '';
            icon.classList.remove('dragging');
            delete icon.dataset.startLeft;
            delete icon.dataset.startTop;
        });
        
        this.isDragging = false;
        this.dragIcon = null;
    },
    
    // ==================== SELECTION BOX ====================
    
    startSelection(e) {
        this.selectionActive = true;
        this.selectionStartX = e.clientX;
        this.selectionStartY = e.clientY;
        
        this.selectionBox = document.createElement('div');
        this.selectionBox.className = 'selection-box';
        document.body.appendChild(this.selectionBox);
    },
    
    onSelection(e) {
        if (!this.selectionActive || !this.selectionBox) return;
        
        const left = Math.min(e.clientX, this.selectionStartX);
        const top = Math.min(e.clientY, this.selectionStartY);
        const width = Math.abs(e.clientX - this.selectionStartX);
        const height = Math.abs(e.clientY - this.selectionStartY);
        
        this.selectionBox.style.left = left + 'px';
        this.selectionBox.style.top = top + 'px';
        this.selectionBox.style.width = width + 'px';
        this.selectionBox.style.height = height + 'px';
        
        // Check which icons are inside the box
        const boxRect = {
            left, top, right: left + width, bottom: top + height
        };
        
        document.querySelectorAll('.desktop-icon').forEach(icon => {
            const iconRect = icon.getBoundingClientRect();
            const isInside = !(iconRect.right < boxRect.left || 
                              iconRect.left > boxRect.right ||
                              iconRect.bottom < boxRect.top ||
                              iconRect.top > boxRect.bottom);
            
            icon.classList.toggle('selected', isInside);
        });
    },
    
    endSelection(e) {
        if (this.selectionBox) {
            this.selectionBox.remove();
            this.selectionBox = null;
        }
        this.selectionActive = false;
    },
    
    // ==================== OPEN ICONS ====================
    
    openIcon(id, type) {
        const icon = this.icons.get(id);
        if (!icon) return;
        
        switch(type) {
            case 'app':
                this.os.launchApp(icon.appId);
                break;
            case 'folder':
                this.os.launchApp('file-explorer', { path: icon.path });
                break;
            case 'system':
                this.openSystemItem(icon.id);
                break;
        }
    },
    
    openSystemItem(id) {
        switch(id) {
            case 'computer':
                this.os.launchApp('file-explorer', { path: '/' });
                break;
            case 'recycle':
                this.os.launchApp('file-explorer', { path: '/Trash' });
                break;
            case 'network':
                this.os.launchApp('file-explorer', { path: '/Network' });
                break;
        }
    },
    
    // ==================== CONTEXT MENUS ====================
    
    showIconContextMenu(e, id) {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        
        const icon = this.icons.get(id);
        
        menu.innerHTML = `
            <div class="context-menu-item" onclick="DesktopIcons.openIcon('${id}', '${icon.type}')">
                <span class="menu-icon">▶️</span> Open
            </div>
            <div class="context-menu-item" onclick="DesktopIcons.openInNewWindow('${id}')">
                <span class="menu-icon">🪟</span> Open in new window
            </div>
            <hr>
            <div class="context-menu-item" onclick="DesktopIcons.cutIcon('${id}')">
                <span class="menu-icon">✂️</span> Cut
            </div>
            <div class="context-menu-item" onclick="DesktopIcons.copyIcon('${id}')">
                <span class="menu-icon">📋</span> Copy
            </div>
            <div class="context-menu-item" onclick="DesktopIcons.pasteIcon()">
                <span class="menu-icon">📌</span> Paste
            </div>
            <hr>
            <div class="context-menu-item" onclick="DesktopIcons.renameIcon('${id}')">
                <span class="menu-icon">✏️</span> Rename
            </div>
            <div class="context-menu-item" onclick="DesktopIcons.deleteIcon('${id}')">
                <span class="menu-icon">🗑️</span> Delete
            </div>
            <hr>
            <div class="context-menu-item" onclick="DesktopIcons.createShortcut('${id}')">
                <span class="menu-icon">🔗</span> Create shortcut
            </div>
            <div class="context-menu-item" onclick="DesktopIcons.properties('${id}')">
                <span class="menu-icon">ℹ️</span> Properties
            </div>
        `;
        
        document.body.appendChild(menu);
        
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }, { once: true });
        }, 10);
    },
    
    showDesktopContextMenu(e) {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        
        menu.innerHTML = `
            <div class="context-menu-item" onclick="DesktopIcons.refresh()">
                <span class="menu-icon">↻</span> Refresh
            </div>
            <div class="context-menu-item" onclick="DesktopIcons.pasteFromClipboard()">
                <span class="menu-icon">📌</span> Paste
            </div>
            <hr>
            <div class="context-menu-item" onclick="DesktopIcons.newFolder()">
                <span class="menu-icon">📁</span> New folder
            </div>
            <div class="context-menu-item" onclick="DesktopIcons.newFile()">
                <span class="menu-icon">📄</span> New file
            </div>
            <hr>
            <div class="context-menu-item" onclick="DesktopIcons.sortByName()">
                <span class="menu-icon">🔤</span> Sort by name
            </div>
            <div class="context-menu-item" onclick="DesktopIcons.sortByDate()">
                <span class="menu-icon">📅</span> Sort by date
            </div>
            <div class="context-menu-item" onclick="DesktopIcons.sortBySize()">
                <span class="menu-icon">📊</span> Sort by size
            </div>
            <hr>
            <div class="context-menu-item" onclick="DesktopIcons.viewSettings()">
                <span class="menu-icon">⚙️</span> View settings
            </div>
            <div class="context-menu-item" onclick="DesktopIcons.personalize()">
                <span class="menu-icon">🎨</span> Personalize
            </div>
        `;
        
        document.body.appendChild(menu);
        
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }, { once: true });
        }, 10);
    },
    
    // ==================== ICON ACTIONS ====================
    
    async renameIcon(id) {
        const icon = document.querySelector(`.desktop-icon[data-id="${id}"]`);
        if (!icon) return;
        
        const nameEl = icon.querySelector('.icon-name');
        const oldName = nameEl.textContent;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = oldName;
        input.className = 'icon-rename-input';
        input.style.width = nameEl.offsetWidth + 'px';
        
        nameEl.innerHTML = '';
        nameEl.appendChild(input);
        input.focus();
        input.select();
        
        input.addEventListener('blur', () => {
            const newName = input.value.trim() || oldName;
            nameEl.textContent = newName;
            
            // Update icon data
            const iconData = this.icons.get(id);
            if (iconData) {
                iconData.name = newName;
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            }
        });
    },
    
    async deleteIcon(id) {
        if (!confirm('Are you sure you want to move this item to the Recycle Bin?')) return;
        
        const icon = this.icons.get(id);
        if (icon.type === 'system') {
            alert('Cannot delete system items');
            return;
        }
        
        // Remove from DOM
        document.querySelector(`.desktop-icon[data-id="${id}"]`)?.remove();
        this.icons.delete(id);
        
        // If it's an app, uninstall it
        if (icon.type === 'app') {
            await this.os.modules.AppStore?.uninstallApp(icon.appId);
        }
        
        // Remove position from storage
        const positions = await this.os.modules.Storage.get('desktop_icon_positions', {});
        delete positions[id];
        await this.os.modules.Storage.set('desktop_icon_positions', positions);
    },
    
    async newFolder() {
        const name = prompt('Enter folder name:');
        if (!name) return;
        
        // Create folder in file system
        const path = `/Desktop/${name}`;
        await this.os.modules.FileSystem?.createFolder('/Desktop', name);
        
        // Add icon
        const id = 'folder_' + Date.now();
        const icon = {
            id,
            name,
            icon: '📁',
            type: 'folder',
            path
        };
        
        this.icons.set(id, icon);
        this.refresh();
    },
    
    async newFile() {
        const name = prompt('Enter file name:');
        if (!name) return;
        
        // Create file
        const path = `/Desktop/${name}`;
        await this.os.modules.FileSystem?.writeFile(path, '');
        
        // Add icon
        const id = 'file_' + Date.now();
        const icon = {
            id,
            name,
            icon: '📄',
            type: 'file',
            path
        };
        
        this.icons.set(id, icon);
        this.refresh();
    },
    
    cutIcon(id) {
        // Implementation for cut operation
        console.log('Cut icon:', id);
    },
    
    copyIcon(id) {
        // Implementation for copy operation
        console.log('Copy icon:', id);
    },
    
    pasteIcon() {
        // Implementation for paste operation
        console.log('Paste');
    },
    
    createShortcut(id) {
        // Implementation for creating shortcut
        console.log('Create shortcut for:', id);
    },
    
    properties(id) {
        const icon = this.icons.get(id);
        if (!icon) return;
        
        // Show properties dialog
        alert(`Properties for ${icon.name}\nType: ${icon.type}\nPath: ${icon.path || 'N/A'}`);
    },
    
    // ==================== DESKTOP ACTIONS ====================
    
    refresh() {
        this.render();
        this.loadIconPositions();
    },
    
    sortByName() {
        // Implementation for sorting
        console.log('Sort by name');
    },
    
    sortByDate() {
        // Implementation for sorting
        console.log('Sort by date');
    },
    
    sortBySize() {
        // Implementation for sorting
        console.log('Sort by size');
    },
    
    viewSettings() {
        this.os.launchApp('settings', { page: 'personalization' });
    },
    
    personalize() {
        this.os.launchApp('settings', { page: 'personalization' });
    },
    
    // ==================== NAVIGATION ====================
    
    navigateWithKeyboard(key) {
        const icons = Array.from(document.querySelectorAll('.desktop-icon'));
        const currentIndex = icons.findIndex(icon => icon.dataset.id === this.selectedIcon);
        
        if (currentIndex === -1) return;
        
        let newIndex = currentIndex;
        const cols = Math.floor(window.innerWidth / this.gridSize);
        
        switch(key) {
            case 'ArrowRight':
                newIndex = currentIndex + 1;
                break;
            case 'ArrowLeft':
                newIndex = currentIndex - 1;
                break;
            case 'ArrowDown':
                newIndex = currentIndex + cols;
                break;
            case 'ArrowUp':
                newIndex = currentIndex - cols;
                break;
        }
        
        if (newIndex >= 0 && newIndex < icons.length) {
            this.selectIcon(icons[newIndex].dataset.id);
            icons[newIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    },
    
    // ==================== POSITION MANAGEMENT ====================
    
    getIconPosition(id) {
        const positions = this.os.modules.Storage.get('desktop_icon_positions', {});
        
        if (positions[id]) {
            return positions[id];
        }
        
        // Calculate grid position
        const index = Array.from(this.icons.keys()).indexOf(id);
        const cols = Math.floor(window.innerWidth / this.gridSize);
        const row = Math.floor(index / cols);
        const col = index % cols;
        
        return {
            left: col * this.gridSize + this.gridPadding,
            top: row * this.gridSize + this.gridPadding
        };
    },
    
    async saveIconPosition(id, left, top) {
        const positions = await this.os.modules.Storage.get('desktop_icon_positions', {});
        positions[id] = { left, top };
        await this.os.modules.Storage.set('desktop_icon_positions', positions);
    },
    
    async loadIconPositions() {
        const positions = await this.os.modules.Storage.get('desktop_icon_positions', {});
        
        Object.entries(positions).forEach(([id, pos]) => {
            const icon = document.querySelector(`.desktop-icon[data-id="${id}"]`);
            if (icon) {
                icon.style.left = pos.left + 'px';
                icon.style.top = pos.top + 'px';
            }
        });
    },
    
    // ==================== STYLES ====================
    
    addStyles() {
        if (document.getElementById('desktop-icons-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'desktop-icons-styles';
        style.textContent = `
            .desktop-icons {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: calc(100% - var(--taskbar-height));
                pointer-events: none;
            }
            
            .desktop-icon {
                position: absolute;
                width: 80px;
                padding: 8px 4px;
                border-radius: 6px;
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                cursor: default;
                transition: background 0.2s;
                pointer-events: auto;
                border: 1px solid transparent;
                z-index: 1;
            }
            
            .desktop-icon:hover {
                background: rgba(255,255,255,0.05);
                border-color: rgba(255,255,255,0.1);
            }
            
            .desktop-icon.selected {
                background: rgba(var(--accent-rgb), 0.2);
                border-color: var(--accent);
            }
            
            .desktop-icon.dragging {
                opacity: 0.8;
                z-index: 1000;
            }
            
            .icon-emoji {
                font-size: 32px;
                margin-bottom: 4px;
                width: 48px;
                height: 48px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
            }
            
            .icon-name {
                font-size: 11px;
                line-height: 1.2;
                word-break: break-word;
                max-width: 100%;
                text-shadow: 0 1px 2px rgba(0,0,0,0.5);
            }
            
            .icon-rename-input {
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--accent);
                border-radius: 4px;
                color: white;
                font-size: 11px;
                padding: 2px 4px;
                text-align: center;
                outline: none;
                width: 100%;
            }
            
            .selection-box {
                position: fixed;
                background: rgba(var(--accent-rgb), 0.1);
                border: 1px solid var(--accent);
                pointer-events: none;
                z-index: 9999;
            }
            
            /* Light theme */
            .light-theme .desktop-icon:hover {
                background: rgba(0,0,0,0.03);
                border-color: rgba(0,0,0,0.1);
            }
            
            .light-theme .icon-name {
                color: black;
                text-shadow: 0 1px 2px rgba(255,255,255,0.5);
            }
            
            .light-theme .icon-rename-input {
                background: white;
                color: black;
                border-color: var(--accent);
            }
        `;
        
        document.head.appendChild(style);
    }
};

window.DesktopIcons = DesktopIcons;
