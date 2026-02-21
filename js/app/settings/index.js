/**
 * Settings Application - Complete system settings interface
 */
class SettingsApp {
    constructor(os, windowId) {
        this.os = os;
        this.windowId = windowId;
        this.currentCategory = 'personalization';
        this.currentSubpage = null;
        this.searchQuery = '';
        this.settings = os.modules.SettingsManager;
        this.unsavedChanges = false;
    }
    
    async render(container, options = {}) {
        this.container = container;
        
        if (options.page) {
            this.currentCategory = options.page;
        }
        
        await this.renderSettings();
    }
    
    async renderSettings() {
        const categories = this.settings.categories;
        const currentCategory = this.settings.getCategory(this.currentCategory);
        
        this.container.innerHTML = `
            <div class="settings-app">
                <!-- Header -->
                <div class="settings-header">
                    <h1 class="settings-title">
                        <span class="settings-icon">⚙️</span>
                        Settings
                    </h1>
                    <div class="settings-search">
                        <span class="search-icon">🔍</span>
                        <input type="text" 
                               placeholder="Search settings..." 
                               id="settings-search"
                               value="${this.searchQuery}">
                    </div>
                </div>
                
                <div class="settings-container">
                    <!-- Sidebar -->
                    <div class="settings-sidebar">
                        ${categories.map(cat => `
                            <div class="settings-category ${cat.id === this.currentCategory ? 'active' : ''}"
                                 data-category="${cat.id}"
                                 onclick="appSettings.showCategory('${cat.id}')">
                                <span class="category-icon">${cat.icon}</span>
                                <span class="category-name">${cat.name}</span>
                                ${this.hasUpdates(cat.id) ? '<span class="category-badge">•</span>' : ''}
                            </div>
                        `).join('')}
                        
                        <div class="settings-sidebar-footer">
                            <div class="settings-category" onclick="appSettings.exportSettings()">
                                <span class="category-icon">📤</span>
                                <span class="category-name">Export</span>
                            </div>
                            <div class="settings-category" onclick="appSettings.importSettings()">
                                <span class="category-icon">📥</span>
                                <span class="category-name">Import</span>
                            </div>
                            <div class="settings-category" onclick="appSettings.resetAll()">
                                <span class="category-icon">🔄</span>
                                <span class="category-name">Reset All</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Content -->
                    <div class="settings-content" id="settings-content">
                        ${this.currentSubpage ? 
                            this.renderSubpage() : 
                            this.renderCategoryContent(this.currentCategory, currentCategory)
                        }
                    </div>
                </div>
                
                <!-- Status Bar -->
                <div class="settings-status">
                    <span>🕒 Last synced: ${new Date().toLocaleTimeString()}</span>
                    ${this.unsavedChanges ? '<span class="unsaved-badge">● Unsaved changes</span>' : ''}
                </div>
            </div>
        `;
        
        this.addEventListeners();
    }
    
    renderCategoryContent(categoryId, settings) {
        switch(categoryId) {
            case 'personalization':
                return this.renderPersonalization(settings);
            case 'system':
                return this.renderSystem(settings);
            case 'security':
                return this.renderSecurity(settings);
            case 'apps':
                return this.renderApps(settings);
            case 'network':
                return this.renderNetwork(settings);
            case 'account':
                return this.renderAccount(settings);
            case 'accessibility':
                return this.renderAccessibility(settings);
            case 'update':
                return this.renderUpdates(settings);
            case 'storage':
                return this.renderStorage(settings);
            case 'language':
                return this.renderLanguage(settings);
            case 'sync':
                return this.renderSync(settings);
            case 'collaboration':
                return this.renderCollaboration(settings);
            default:
                return this.renderDefault(categoryId);
        }
    }
    
    renderPersonalization(settings) {
        const themes = this.settings.getThemes();
        const wallpapers = this.settings.getWallpapers();
        const accentColors = this.settings.getAccentColors();
        
        return `
            <div class="settings-page">
                <h2 class="page-title">🎨 Personalization</h2>
                <p class="page-description">Make your desktop look and feel the way you want</p>
                
                <!-- Theme Section -->
                <div class="settings-section">
                    <h3 class="section-title">Theme</h3>
                    <div class="theme-grid">
                        ${themes.map(theme => `
                            <div class="theme-card ${settings.theme === theme.id ? 'selected' : ''}"
                                 onclick="appSettings.setSetting('personalization.theme', '${theme.id}')">
                                <div class="theme-preview theme-${theme.id}">
                                    <span>${theme.preview}</span>
                                </div>
                                <div class="theme-name">${theme.name}</div>
                                <div class="theme-description">${theme.description}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Wallpaper Section -->
                <div class="settings-section">
                    <h3 class="section-title">Wallpaper</h3>
                    <div class="wallpaper-grid">
                        ${wallpapers.map(wp => `
                            <div class="wallpaper-card ${settings.wallpaper === wp.id ? 'selected' : ''}"
                                 onclick="appSettings.setSetting('personalization.wallpaper', '${wp.id}')">
                                <div class="wallpaper-preview" style="background: linear-gradient(135deg, var(--accent), #9c27b0);">
                                    <span>${wp.preview}</span>
                                </div>
                                <div class="wallpaper-name">${wp.name}</div>
                                <div class="wallpaper-category">${wp.category}</div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="settings-row">
                        <label>Fit</label>
                        <select onchange="appSettings.setSetting('personalization.wallpaperFit', this.value)">
                            <option value="cover" ${settings.wallpaperFit === 'cover' ? 'selected' : ''}>Fill</option>
                            <option value="contain" ${settings.wallpaperFit === 'contain' ? 'selected' : ''}>Fit</option>
                            <option value="stretch" ${settings.wallpaperFit === 'stretch' ? 'selected' : ''}>Stretch</option>
                            <option value="tile" ${settings.wallpaperFit === 'tile' ? 'selected' : ''}>Tile</option>
                            <option value="center" ${settings.wallpaperFit === 'center' ? 'selected' : ''}>Center</option>
                        </select>
                    </div>
                </div>
                
                <!-- Accent Color Section -->
                <div class="settings-section">
                    <h3 class="section-title">Accent Color</h3>
                    <div class="color-grid">
                        ${accentColors.map(color => `
                            <div class="color-swatch ${settings.accentColor === color.value ? 'selected' : ''}"
                                 style="background: ${color.value}"
                                 title="${color.name}"
                                 onclick="appSettings.setSetting('personalization.accentColor', '${color.value}')">
                                ${settings.accentColor === color.value ? '✓' : ''}
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="settings-row">
                        <label>Custom Color</label>
                        <input type="color" 
                               value="${settings.accentColor}"
                               onchange="appSettings.setSetting('personalization.accentColor', this.value)">
                    </div>
                </div>
                
                <!-- Effects Section -->
                <div class="settings-section">
                    <h3 class="section-title">Effects</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Transparency Effects</span>
                            <span class="row-description">Enable mica and glass effects</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.transparency ? 'checked' : ''}
                                   onchange="appSettings.setSetting('personalization.transparency', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Animations</span>
                            <span class="row-description">Window and UI animations</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.animations ? 'checked' : ''}
                                   onchange="appSettings.setSetting('personalization.animations', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row">
                        <label>Start Button Style</label>
                        <select onchange="appSettings.setSetting('personalization.startButtonStyle', this.value)">
                            <option value="modern" ${settings.startButtonStyle === 'modern' ? 'selected' : ''}>Modern</option>
                            <option value="classic" ${settings.startButtonStyle === 'classic' ? 'selected' : ''}>Classic</option>
                            <option value="minimal" ${settings.startButtonStyle === 'minimal' ? 'selected' : ''}>Minimal</option>
                        </select>
                    </div>
                    
                    <div class="settings-row">
                        <label>Taskbar Alignment</label>
                        <select onchange="appSettings.setSetting('personalization.taskbarAlignment', this.value)">
                            <option value="left" ${settings.taskbarAlignment === 'left' ? 'selected' : ''}>Left</option>
                            <option value="center" ${settings.taskbarAlignment === 'center' ? 'selected' : ''}>Center</option>
                            <option value="right" ${settings.taskbarAlignment === 'right' ? 'selected' : ''}>Right</option>
                        </select>
                    </div>
                </div>
                
                <!-- Desktop Icons Section -->
                <div class="settings-section">
                    <h3 class="section-title">Desktop Icons</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Show Desktop Icons</span>
                            <span class="row-description">Display icons on desktop</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.showDesktopIcons ? 'checked' : ''}
                                   onchange="appSettings.setSetting('personalization.showDesktopIcons', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row">
                        <label>Icon Size</label>
                        <select onchange="appSettings.setSetting('personalization.iconSize', this.value)">
                            <option value="small" ${settings.iconSize === 'small' ? 'selected' : ''}>Small</option>
                            <option value="medium" ${settings.iconSize === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="large" ${settings.iconSize === 'large' ? 'selected' : ''}>Large</option>
                        </select>
                    </div>
                </div>
                
                <!-- Font Settings -->
                <div class="settings-section">
                    <h3 class="section-title">Fonts</h3>
                    
                    <div class="settings-row">
                        <label>Font Family</label>
                        <select onchange="appSettings.setSetting('personalization.fontFamily', this.value)">
                            <option value="system" ${settings.fontFamily === 'system' ? 'selected' : ''}>System Default</option>
                            <option value="classic" ${settings.fontFamily === 'classic' ? 'selected' : ''}>Classic</option>
                            <option value="modern" ${settings.fontFamily === 'modern' ? 'selected' : ''}>Modern</option>
                            <option value="mono" ${settings.fontFamily === 'mono' ? 'selected' : ''}>Monospace</option>
                        </select>
                    </div>
                    
                    <div class="settings-row">
                        <label>Font Size</label>
                        <select onchange="appSettings.setSetting('personalization.fontSize', this.value)">
                            <option value="small" ${settings.fontSize === 'small' ? 'selected' : ''}>Small</option>
                            <option value="medium" ${settings.fontSize === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="large" ${settings.fontSize === 'large' ? 'selected' : ''}>Large</option>
                            <option value="x-large" ${settings.fontSize === 'x-large' ? 'selected' : ''}>Extra Large</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderSystem(settings) {
        return `
            <div class="settings-page">
                <h2 class="page-title">⚙️ System</h2>
                <p class="page-description">Configure system settings and performance</p>
                
                <!-- Device Info -->
                <div class="settings-section">
                    <h3 class="section-title">Device Information</h3>
                    
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Device Name</span>
                            <span class="info-value">${settings.deviceName}</span>
                            <button class="info-edit" onclick="appSettings.editDeviceName()">✏️</button>
                        </div>
                        <div class="info-item">
                            <span class="info-label">OS Version</span>
                            <span class="info-value">BhekOS 6.0.22000</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Build</span>
                            <span class="info-value">22000.556</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Processor</span>
                            <span class="info-value">Virtual CPU</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Memory</span>
                            <span class="info-value">2 GB</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">System Type</span>
                            <span class="info-value">64-bit</span>
                        </div>
                    </div>
                </div>
                
                <!-- Performance -->
                <div class="settings-section">
                    <h3 class="section-title">Performance</h3>
                    
                    <div class="settings-row">
                        <label>Performance Mode</label>
                        <select onchange="appSettings.setSetting('system.performance', this.value)">
                            <option value="high" ${settings.performance === 'high' ? 'selected' : ''}>High Performance</option>
                            <option value="balanced" ${settings.performance === 'balanced' ? 'selected' : ''}>Balanced</option>
                            <option value="power-saver" ${settings.performance === 'power-saver' ? 'selected' : ''}>Power Saver</option>
                        </select>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Battery Saver</span>
                            <span class="row-description">Extend battery life</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.batterySaver ? 'checked' : ''}
                                   onchange="appSettings.setSetting('system.batterySaver', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
                
                <!-- Startup -->
                <div class="settings-section">
                    <h3 class="section-title">Startup Apps</h3>
                    
                    <div class="startup-list">
                        ${this.renderStartupApps(settings.startupApps)}
                    </div>
                    
                    <button class="settings-button" onclick="appSettings.manageStartupApps()">
                        Manage Startup Apps
                    </button>
                </div>
                
                <!-- Multitasking -->
                <div class="settings-section">
                    <h3 class="section-title">Multitasking</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Snap Windows</span>
                            <span class="row-description">Arrange windows by dragging to edges</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.snapWindows ? 'checked' : ''}
                                   onchange="appSettings.setSetting('system.snapWindows', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Shake to Minimize</span>
                            <span class="row-description">Shake a window to minimize others</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.shakeToMinimize ? 'checked' : ''}
                                   onchange="appSettings.setSetting('system.shakeToMinimize', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
                
                <!-- Notifications -->
                <div class="settings-section">
                    <h3 class="section-title">Notifications</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Notifications</span>
                            <span class="row-description">Show notifications from apps</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.notifications ? 'checked' : ''}
                                   onchange="appSettings.setSetting('system.notifications', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Focus Assist</span>
                            <span class="row-description">Hide notifications during focused work</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.focusAssist ? 'checked' : ''}
                                   onchange="appSettings.setSetting('system.focusAssist', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderSecurity(settings) {
        return `
            <div class="settings-page">
                <h2 class="page-title">🔐 Security & Privacy</h2>
                <p class="page-description">Protect your device and data</p>
                
                <!-- Security Status -->
                <div class="security-status">
                    <div class="status-card secure">
                        <span class="status-icon">🛡️</span>
                        <div class="status-info">
                            <span class="status-title">Your device is secure</span>
                            <span class="status-desc">All security features are active</span>
                        </div>
                    </div>
                </div>
                
                <!-- Sign-in Options -->
                <div class="settings-section">
                    <h3 class="section-title">Sign-in Options</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Require Sign-in on Wake</span>
                            <span class="row-description">Ask for password when waking from sleep</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.requirePasswordOnWake ? 'checked' : ''}
                                   onchange="appSettings.setSetting('security.requirePasswordOnWake', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Auto-Lock</span>
                            <span class="row-description">Lock after inactivity</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.autoLock ? 'checked' : ''}
                                   onchange="appSettings.setSetting('security.autoLock', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row">
                        <label>Auto-Lock Time</label>
                        <select onchange="appSettings.setSetting('security.autoLockMinutes', this.value)">
                            <option value="1" ${settings.autoLockMinutes === 1 ? 'selected' : ''}>1 minute</option>
                            <option value="5" ${settings.autoLockMinutes === 5 ? 'selected' : ''}>5 minutes</option>
                            <option value="10" ${settings.autoLockMinutes === 10 ? 'selected' : ''}>10 minutes</option>
                            <option value="15" ${settings.autoLockMinutes === 15 ? 'selected' : ''}>15 minutes</option>
                            <option value="30" ${settings.autoLockMinutes === 30 ? 'selected' : ''}>30 minutes</option>
                        </select>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Show Lock Screen</span>
                            <span class="row-description">Display lock screen before sign-in</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.showLockScreen ? 'checked' : ''}
                                   onchange="appSettings.setSetting('security.showLockScreen', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
                
                <!-- Password Section -->
                <div class="settings-section">
                    <h3 class="section-title">Password</h3>
                    
                    <div class="settings-row">
                        <label>Current Password</label>
                        <input type="password" id="current-password" placeholder="Enter current password">
                    </div>
                    
                    <div class="settings-row">
                        <label>New Password</label>
                        <input type="password" id="new-password" placeholder="Enter new password">
                    </div>
                    
                    <div class="settings-row">
                        <label>Confirm Password</label>
                        <input type="password" id="confirm-password" placeholder="Confirm new password">
                    </div>
                    
                    <button class="settings-button" onclick="appSettings.changePassword()">
                        Change Password
                    </button>
                </div>
                
                <!-- Two-Factor Authentication -->
                <div class="settings-section">
                    <h3 class="section-title">Two-Factor Authentication</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Two-Factor Authentication</span>
                            <span class="row-description">Add extra security to your account</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.twoFactorAuth ? 'checked' : ''}
                                   onchange="appSettings.toggleTwoFactor(this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    ${settings.twoFactorAuth ? `
                        <div class="twofa-setup">
                            <p>Scan this QR code with your authenticator app:</p>
                            <div class="qr-code">[QR Code Placeholder]</div>
                            <p class="setup-key">Setup key: JBSWY3DPEHPK3PXP</p>
                        </div>
                    ` : ''}
                </div>
                
                <!-- Privacy -->
                <div class="settings-section">
                    <h3 class="section-title">Privacy</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Allow Remote Desktop</span>
                            <span class="row-description">Allow remote connections to this device</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.allowRemoteDesktop ? 'checked' : ''}
                                   onchange="appSettings.setSetting('security.allowRemoteDesktop', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Firewall</span>
                            <span class="row-description">Protect your device from network threats</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.firewall ? 'checked' : ''}
                                   onchange="appSettings.setSetting('security.firewall', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Real-time Protection</span>
                            <span class="row-description">Scan files in real-time</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.antivirus ? 'checked' : ''}
                                   onchange="appSettings.setSetting('security.antivirus', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Device Encryption</span>
                            <span class="row-description">Encrypt your files for security</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.encryption ? 'checked' : ''}
                                   onchange="appSettings.setSetting('security.encryption', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderApps(settings) {
        return `
            <div class="settings-page">
                <h2 class="page-title">📱 Apps</h2>
                <p class="page-description">Manage app settings and permissions</p>
                
                <!-- App Settings -->
                <div class="settings-section">
                    <h3 class="section-title">General</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Auto-update Apps</span>
                            <span class="row-description">Automatically update installed apps</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.autoUpdate ? 'checked' : ''}
                                   onchange="appSettings.setSetting('apps.autoUpdate', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Install from Unknown Sources</span>
                            <span class="row-description">Allow installation from outside the app store</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.installUnknownSources ? 'checked' : ''}
                                   onchange="appSettings.setSetting('apps.installUnknownSources', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>App Notifications</span>
                            <span class="row-description">Show notifications from apps</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.appNotifications ? 'checked' : ''}
                                   onchange="appSettings.setSetting('apps.appNotifications', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Background Apps</span>
                            <span class="row-description">Allow apps to run in the background</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.backgroundApps ? 'checked' : ''}
                                   onchange="appSettings.setSetting('apps.backgroundApps', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
                
                <!-- Default Apps -->
                <div class="settings-section">
                    <h3 class="section-title">Default Apps</h3>
                    
                    <div class="settings-row">
                        <label>Web Browser</label>
                        <select onchange="appSettings.setDefaultApp('browser', this.value)">
                            <option value="web-browser" selected>Web Browser</option>
                            <option value="custom">Custom Browser</option>
                        </select>
                    </div>
                    
                    <div class="settings-row">
                        <label>Email Client</label>
                        <select onchange="appSettings.setDefaultApp('email', this.value)">
                            <option value="none">None</option>
                            <option value="mail">Mail App</option>
                        </select>
                    </div>
                    
                    <div class="settings-row">
                        <label>Media Player</label>
                        <select onchange="appSettings.setDefaultApp('media', this.value)">
                            <option value="media-player" selected>Media Player</option>
                            <option value="vlc">VLC</option>
                        </select>
                    </div>
                </div>
                
                <!-- App Permissions -->
                <div class="settings-section">
                    <h3 class="section-title">App Permissions</h3>
                    
                    <div class="permissions-list" id="app-permissions-list">
                        ${this.renderAppPermissions()}
                    </div>
                </div>
            </div>
        `;
    }
    
    renderNetwork(settings) {
        return `
            <div class="settings-page">
                <h2 class="page-title">🌐 Network & Internet</h2>
                <p class="page-description">Manage network connections and settings</p>
                
                <!-- Wi-Fi -->
                <div class="settings-section">
                    <h3 class="section-title">Wi-Fi</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Wi-Fi</span>
                            <span class="row-description">Enable wireless networking</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.wifiEnabled ? 'checked' : ''}
                                   onchange="appSettings.setSetting('network.wifiEnabled', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row">
                        <label>Connected Network</label>
                        <span>BhekOS Network <button onclick="appSettings.showNetworks()">Change</button></span>
                    </div>
                </div>
                
                <!-- Bluetooth -->
                <div class="settings-section">
                    <h3 class="section-title">Bluetooth</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Bluetooth</span>
                            <span class="row-description">Enable Bluetooth</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.bluetoothEnabled ? 'checked' : ''}
                                   onchange="appSettings.setSetting('network.bluetoothEnabled', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
                
                <!-- Airplane Mode -->
                <div class="settings-section">
                    <h3 class="section-title">Airplane Mode</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Airplane Mode</span>
                            <span class="row-description">Disable all wireless communications</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.airplaneMode ? 'checked' : ''}
                                   onchange="appSettings.setSetting('network.airplaneMode', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
                
                <!-- Proxy -->
                <div class="settings-section">
                    <h3 class="section-title">Proxy</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Use Proxy Server</span>
                            <span class="row-description">Configure proxy settings</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.proxyEnabled ? 'checked' : ''}
                                   onchange="appSettings.setSetting('network.proxyEnabled', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    ${settings.proxyEnabled ? `
                        <div class="settings-row">
                            <label>Proxy Server</label>
                            <input type="text" value="${settings.proxyServer}" 
                                   onchange="appSettings.setSetting('network.proxyServer', this.value)">
                        </div>
                        <div class="settings-row">
                            <label>Proxy Port</label>
                            <input type="text" value="${settings.proxyPort}" 
                                   onchange="appSettings.setSetting('network.proxyPort', this.value)">
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    renderAccount(settings) {
        const user = this.os.modules.UserManager?.getCurrentUser();
        
        return `
            <div class="settings-page">
                <h2 class="page-title">👤 Account</h2>
                <p class="page-description">Manage your account settings</p>
                
                <!-- Your Info -->
                <div class="settings-section">
                    <h3 class="section-title">Your Info</h3>
                    
                    <div class="account-info-card">
                        <div class="account-avatar-large">${user?.avatar?.value || '👤'}</div>
                        <div class="account-details">
                            <div class="account-name">${user?.name || 'User'}</div>
                            <div class="account-username">@${user?.username || 'username'}</div>
                            <div class="account-email">${user?.email || 'email@example.com'}</div>
                        </div>
                        <button class="edit-account-btn" onclick="appSettings.editAccount()">Edit</button>
                    </div>
                </div>
                
                <!-- Sign-in Options -->
                <div class="settings-section">
                    <h3 class="section-title">Sign-in Options</h3>
                    
                    <div class="settings-row">
                        <label>Password</label>
                        <button onclick="appSettings.changePassword()">Change</button>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Remember Me</span>
                            <span class="row-description">Stay signed in across sessions</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" checked>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
                
                <!-- Sync Settings -->
                <div class="settings-section">
                    <h3 class="section-title">Sync</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Sync Settings</span>
                            <span class="row-description">Sync your settings across devices</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.syncSettings ? 'checked' : ''}
                                   onchange="appSettings.setSetting('account.syncSettings', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Sync Files</span>
                            <span class="row-description">Sync your files to the cloud</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.syncFiles ? 'checked' : ''}
                                   onchange="appSettings.setSetting('account.syncFiles', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
                
                <!-- Privacy -->
                <div class="settings-section">
                    <h3 class="section-title">Privacy</h3>
                    
                    <div class="settings-row">
                        <label>Online Status</label>
                        <select onchange="appSettings.setSetting('account.onlineStatus', this.value)">
                            <option value="online" ${settings.onlineStatus === 'online' ? 'selected' : ''}>Online</option>
                            <option value="away" ${settings.onlineStatus === 'away' ? 'selected' : ''}>Away</option>
                            <option value="busy" ${settings.onlineStatus === 'busy' ? 'selected' : ''}>Busy</option>
                            <option value="offline" ${settings.onlineStatus === 'offline' ? 'selected' : ''}>Offline</option>
                        </select>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Show Online Status</span>
                            <span class="row-description">Let others see when you're online</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.presenceEnabled ? 'checked' : ''}
                                   onchange="appSettings.setSetting('account.presenceEnabled', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderAccessibility(settings) {
        return `
            <div class="settings-page">
                <h2 class="page-title">♿ Accessibility</h2>
                <p class="page-description">Make your device easier to use</p>
                
                <!-- Vision -->
                <div class="settings-section">
                    <h3 class="section-title">Vision</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>High Contrast</span>
                            <span class="row-description">Increase color contrast</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.highContrast ? 'checked' : ''}
                                   onchange="appSettings.setSetting('accessibility.highContrast', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Magnifier</span>
                            <span class="row-description">Zoom in on screen content</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.magnifier ? 'checked' : ''}
                                   onchange="appSettings.setSetting('accessibility.magnifier', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    ${settings.magnifier ? `
                        <div class="settings-row">
                            <label>Zoom Level</label>
                            <input type="range" min="100" max="500" value="${settings.magnifierZoom}"
                                   onchange="appSettings.setSetting('accessibility.magnifierZoom', this.value)">
                            <span>${settings.magnifierZoom}%</span>
                        </div>
                    ` : ''}
                </div>
                
                <!-- Hearing -->
                <div class="settings-section">
                    <h3 class="section-title">Hearing</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Closed Captions</span>
                            <span class="row-description">Show subtitles for media</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Flash Notifications</span>
                            <span class="row-description">Flash screen for notifications</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
                
                <!-- Interaction -->
                <div class="settings-section">
                    <h3 class="section-title">Interaction</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Sticky Keys</span>
                            <span class="row-description">Press keyboard shortcuts one key at a time</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.stickyKeys ? 'checked' : ''}
                                   onchange="appSettings.setSetting('accessibility.stickyKeys', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Filter Keys</span>
                            <span class="row-description">Ignore brief or repeated keystrokes</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.filterKeys ? 'checked' : ''}
                                   onchange="appSettings.setSetting('accessibility.filterKeys', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Mouse Keys</span>
                            <span class="row-description">Control mouse with keyboard</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.mouseKeys ? 'checked' : ''}
                                   onchange="appSettings.setSetting('accessibility.mouseKeys', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
                
                <!-- Motion -->
                <div class="settings-section">
                    <h3 class="section-title">Motion</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Reduce Motion</span>
                            <span class="row-description">Minimize screen animations</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.reduceMotion ? 'checked' : ''}
                                   onchange="appSettings.setSetting('accessibility.reduceMotion', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Reduce Transparency</span>
                            <span class="row-description">Reduce transparent effects</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.reduceTransparency ? 'checked' : ''}
                                   onchange="appSettings.setSetting('accessibility.reduceTransparency', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderUpdates(settings) {
        return `
            <div class="settings-page">
                <h2 class="page-title">🔄 Updates & Security</h2>
                <p class="page-description">Check for updates and manage security</p>
                
                <!-- Update Status -->
                <div class="settings-section">
                    <h3 class="section-title">Update Status</h3>
                    
                    <div class="update-status-card">
                        <div class="update-icon">✅</div>
                        <div class="update-info">
                            <div class="update-title">Your system is up to date</div>
                            <div class="update-desc">Last checked: ${new Date(settings.lastChecked || Date.now()).toLocaleString()}</div>
                        </div>
                        <button class="check-updates-btn" onclick="appSettings.checkForUpdates()">Check for Updates</button>
                    </div>
                </div>
                
                <!-- Update Settings -->
                <div class="settings-section">
                    <h3 class="section-title">Update Settings</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Auto-download Updates</span>
                            <span class="row-description">Automatically download available updates</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.autoDownload ? 'checked' : ''}
                                   onchange="appSettings.setSetting('updates.autoDownload', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Auto-install Updates</span>
                            <span class="row-description">Automatically install updates when available</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.autoInstall ? 'checked' : ''}
                                   onchange="appSettings.setSetting('updates.autoInstall', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row">
                        <label>Update Time</label>
                        <input type="time" value="${settings.updateTime}"
                               onchange="appSettings.setSetting('updates.updateTime', this.value)">
                    </div>
                    
                    <div class="settings-row">
                        <label>Update Channel</label>
                        <select onchange="appSettings.setSetting('updates.updateChannel', this.value)">
                            <option value="stable" ${settings.updateChannel === 'stable' ? 'selected' : ''}>Stable</option>
                            <option value="beta" ${settings.updateChannel === 'beta' ? 'selected' : ''}>Beta</option>
                            <option value="dev" ${settings.updateChannel === 'dev' ? 'selected' : ''}>Dev</option>
                        </select>
                    </div>
                </div>
                
                <!-- Windows Security -->
                <div class="settings-section">
                    <h3 class="section-title">Windows Security</h3>
                    
                    <div class="security-options">
                        <div class="security-option">
                            <span class="option-name">Virus & threat protection</span>
                            <span class="option-status active">Active</span>
                        </div>
                        <div class="security-option">
                            <span class="option-name">Firewall & network protection</span>
                            <span class="option-status active">Active</span>
                        </div>
                        <div class="security-option">
                            <span class="option-name">App & browser control</span>
                            <span class="option-status">Configure</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderStorage(settings) {
        const stats = this.os.modules.Storage?.info() || { totalSize: 0, formattedSize: '0 B' };
        
        return `
            <div class="settings-page">
                <h2 class="page-title">💾 Storage</h2>
                <p class="page-description">Manage storage space</p>
                
                <!-- Storage Overview -->
                <div class="settings-section">
                    <h3 class="section-title">Storage Overview</h3>
                    
                    <div class="storage-overview">
                        <div class="storage-chart">
                            <div class="storage-used" style="width: ${(stats.totalSize / (5 * 1024 * 1024)) * 100}%"></div>
                        </div>
                        <div class="storage-stats">
                            <div class="stat-item">
                                <span class="stat-label">Total Storage</span>
                                <span class="stat-value">${stats.formattedSize}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Used</span>
                                <span class="stat-value">${BhekHelpers.formatBytes(stats.totalSize)}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Free</span>
                                <span class="stat-value">${BhekHelpers.formatBytes(5 * 1024 * 1024 - stats.totalSize)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Storage Sense -->
                <div class="settings-section">
                    <h3 class="section-title">Storage Sense</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Storage Sense</span>
                            <span class="row-description">Automatically free up space</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.storageSense ? 'checked' : ''}
                                   onchange="appSettings.setSetting('storage.storageSense', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    ${settings.storageSense ? `
                        <div class="settings-row toggle-row">
                            <div class="row-label">
                                <span>Delete Temporary Files</span>
                                <span class="row-description">Automatically delete temporary files</span>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" 
                                       ${settings.deleteTempFiles ? 'checked' : ''}
                                       onchange="appSettings.setSetting('storage.deleteTempFiles', this.checked)">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        
                        <div class="settings-row toggle-row">
                            <div class="row-label">
                                <span>Auto-delete Recycle Bin</span>
                                <span class="row-description">Delete files in recycle bin after period</span>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" 
                                       ${settings.autoDeleteRecycleBin ? 'checked' : ''}
                                       onchange="appSettings.setSetting('storage.autoDeleteRecycleBin', this.checked)">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        
                        ${settings.autoDeleteRecycleBin ? `
                            <div class="settings-row">
                                <label>Days before deletion</label>
                                <input type="number" min="1" max="365" value="${settings.recycleBinDays}"
                                       onchange="appSettings.setSetting('storage.recycleBinDays', this.value)">
                            </div>
                        ` : ''}
                    ` : ''}
                </div>
                
                <!-- Cleanup -->
                <div class="settings-section">
                    <h3 class="section-title">Cleanup</h3>
                    
                    <button class="settings-button" onclick="appSettings.cleanNow()">
                        Clean Now
                    </button>
                    
                    <div class="cleanup-options">
                        <label class="option-checkbox">
                            <input type="checkbox" checked> Temporary files
                        </label>
                        <label class="option-checkbox">
                            <input type="checkbox" checked> Recycle Bin
                        </label>
                        <label class="option-checkbox">
                            <input type="checkbox"> Downloads folder
                        </label>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderLanguage(settings) {
        return `
            <div class="settings-page">
                <h2 class="page-title">🌍 Language & Region</h2>
                <p class="page-description">Configure language and regional settings</p>
                
                <!-- Language -->
                <div class="settings-section">
                    <h3 class="section-title">Language</h3>
                    
                    <div class="settings-row">
                        <label>Display Language</label>
                        <select onchange="appSettings.setSetting('language.language', this.value)">
                            <option value="en-US" ${settings.language === 'en-US' ? 'selected' : ''}>English (United States)</option>
                            <option value="en-GB" ${settings.language === 'en-GB' ? 'selected' : ''}>English (United Kingdom)</option>
                            <option value="es" ${settings.language === 'es' ? 'selected' : ''}>Español</option>
                            <option value="fr" ${settings.language === 'fr' ? 'selected' : ''}>Français</option>
                            <option value="de" ${settings.language === 'de' ? 'selected' : ''}>Deutsch</option>
                            <option value="zh" ${settings.language === 'zh' ? 'selected' : ''}>中文</option>
                        </select>
                    </div>
                </div>
                
                <!-- Region -->
                <div class="settings-section">
                    <h3 class="section-title">Region</h3>
                    
                    <div class="settings-row">
                        <label>Country or Region</label>
                        <select onchange="appSettings.setSetting('language.region', this.value)">
                            <option value="US" ${settings.region === 'US' ? 'selected' : ''}>United States</option>
                            <option value="GB" ${settings.region === 'GB' ? 'selected' : ''}>United Kingdom</option>
                            <option value="CA" ${settings.region === 'CA' ? 'selected' : ''}>Canada</option>
                            <option value="AU" ${settings.region === 'AU' ? 'selected' : ''}>Australia</option>
                        </select>
                    </div>
                </div>
                
                <!-- Formats -->
                <div class="settings-section">
                    <h3 class="section-title">Formats</h3>
                    
                    <div class="settings-row">
                        <label>Date Format</label>
                        <select onchange="appSettings.setSetting('language.dateFormat', this.value)">
                            <option value="MM/dd/yyyy" ${settings.dateFormat === 'MM/dd/yyyy' ? 'selected' : ''}>MM/dd/yyyy</option>
                            <option value="dd/MM/yyyy" ${settings.dateFormat === 'dd/MM/yyyy' ? 'selected' : ''}>dd/MM/yyyy</option>
                            <option value="yyyy-MM-dd" ${settings.dateFormat === 'yyyy-MM-dd' ? 'selected' : ''}>yyyy-MM-dd</option>
                        </select>
                    </div>
                    
                    <div class="settings-row">
                        <label>Time Format</label>
                        <select onchange="appSettings.setSetting('language.timeFormat', this.value)">
                            <option value="12h" ${settings.timeFormat === '12h' ? 'selected' : ''}>12-hour</option>
                            <option value="24h" ${settings.timeFormat === '24h' ? 'selected' : ''}>24-hour</option>
                        </select>
                    </div>
                    
                    <div class="settings-row">
                        <label>First Day of Week</label>
                        <select onchange="appSettings.setSetting('language.firstDayOfWeek', this.value)">
                            <option value="monday" ${settings.firstDayOfWeek === 'monday' ? 'selected' : ''}>Monday</option>
                            <option value="sunday" ${settings.firstDayOfWeek === 'sunday' ? 'selected' : ''}>Sunday</option>
                            <option value="saturday" ${settings.firstDayOfWeek === 'saturday' ? 'selected' : ''}>Saturday</option>
                        </select>
                    </div>
                    
                    <div class="settings-row">
                        <label>Measurement System</label>
                        <select onchange="appSettings.setSetting('language.measurementSystem', this.value)">
                            <option value="imperial" ${settings.measurementSystem === 'imperial' ? 'selected' : ''}>Imperial (US)</option>
                            <option value="metric" ${settings.measurementSystem === 'metric' ? 'selected' : ''}>Metric</option>
                        </select>
                    </div>
                </div>
                
                <!-- Keyboard -->
                <div class="settings-section">
                    <h3 class="section-title">Keyboard</h3>
                    
                    <div class="settings-row">
                        <label>Keyboard Layout</label>
                        <select onchange="appSettings.setSetting('language.keyboardLayout', this.value)">
                            <option value="us" ${settings.keyboardLayout === 'us' ? 'selected' : ''}>US</option>
                            <option value="uk" ${settings.keyboardLayout === 'uk' ? 'selected' : ''}>UK</option>
                            <option value="de" ${settings.keyboardLayout === 'de' ? 'selected' : ''}>German</option>
                            <option value="fr" ${settings.keyboardLayout === 'fr' ? 'selected' : ''}>French</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderSync(settings) {
        return `
            <div class="settings-page">
                <h2 class="page-title">☁️ Sync & Backup</h2>
                <p class="page-description">Sync your data across devices</p>
                
                <!-- Sync Status -->
                <div class="settings-section">
                    <h3 class="section-title">Sync Status</h3>
                    
                    <div class="sync-status-card">
                        <div class="sync-icon">${settings.enabled ? '✅' : '⏸️'}</div>
                        <div class="sync-info">
                            <div class="sync-title">Sync is ${settings.enabled ? 'enabled' : 'disabled'}</div>
                            <div class="sync-desc">Last synced: ${settings.lastSync ? new Date(settings.lastSync).toLocaleString() : 'Never'}</div>
                        </div>
                        <button class="sync-now-btn" onclick="appSettings.syncNow()">Sync Now</button>
                    </div>
                </div>
                
                <!-- Sync Settings -->
                <div class="settings-section">
                    <h3 class="section-title">Sync Settings</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Enable Sync</span>
                            <span class="row-description">Sync your data across devices</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.enabled ? 'checked' : ''}
                                   onchange="appSettings.setSetting('sync.enabled', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    ${settings.enabled ? `
                        <div class="settings-row toggle-row">
                            <div class="row-label">
                                <span>Sync Settings</span>
                                <span class="row-description">Sync your system settings</span>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" 
                                       ${settings.syncSettings ? 'checked' : ''}
                                       onchange="appSettings.setSetting('sync.syncSettings', this.checked)">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        
                        <div class="settings-row toggle-row">
                            <div class="row-label">
                                <span>Sync Files</span>
                                <span class="row-description">Sync your files to the cloud</span>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" 
                                       ${settings.syncFiles ? 'checked' : ''}
                                       onchange="appSettings.setSetting('sync.syncFiles', this.checked)">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        
                        <div class="settings-row toggle-row">
                            <div class="row-label">
                                <span>Sync Apps</span>
                                <span class="row-description">Sync your installed apps</span>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" 
                                       ${settings.syncApps ? 'checked' : ''}
                                       onchange="appSettings.setSetting('sync.syncApps', this.checked)">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        
                        <div class="settings-row">
                            <label>Sync Provider</label>
                            <select onchange="appSettings.setSetting('sync.provider', this.value)">
                                <option value="internal" ${settings.provider === 'internal' ? 'selected' : ''}>BhekOS Cloud</option>
                                <option value="onedrive" ${settings.provider === 'onedrive' ? 'selected' : ''}>OneDrive</option>
                                <option value="gdrive" ${settings.provider === 'gdrive' ? 'selected' : ''}>Google Drive</option>
                            </select>
                        </div>
                        
                        <div class="settings-row">
                            <label>Sync Interval</label>
                            <select onchange="appSettings.setSetting('sync.syncInterval', this.value)">
                                <option value="300000" ${settings.syncInterval === 300000 ? 'selected' : ''}>5 minutes</option>
                                <option value="900000" ${settings.syncInterval === 900000 ? 'selected' : ''}>15 minutes</option>
                                <option value="3600000" ${settings.syncInterval === 3600000 ? 'selected' : ''}>1 hour</option>
                                <option value="86400000" ${settings.syncInterval === 86400000 ? 'selected' : ''}>1 day</option>
                            </select>
                        </div>
                        
                        <div class="settings-row toggle-row">
                            <div class="row-label">
                                <span>Sync on Change</span>
                                <span class="row-description">Sync immediately when changes occur</span>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" 
                                       ${settings.syncOnChange ? 'checked' : ''}
                                       onchange="appSettings.setSetting('sync.syncOnChange', this.checked)">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        
                        <div class="settings-row">
                            <label>Conflict Resolution</label>
                            <select onchange="appSettings.setSetting('sync.conflicts', this.value)">
                                <option value="ask" ${settings.conflicts === 'ask' ? 'selected' : ''}>Ask me</option>
                                <option value="local" ${settings.conflicts === 'local' ? 'selected' : ''}>Keep local version</option>
                                <option value="remote" ${settings.conflicts === 'remote' ? 'selected' : ''}>Keep cloud version</option>
                            </select>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    renderCollaboration(settings) {
        return `
            <div class="settings-page">
                <h2 class="page-title">👥 Collaboration</h2>
                <p class="page-description">Configure collaboration features</p>
                
                <!-- Presence -->
                <div class="settings-section">
                    <h3 class="section-title">Presence</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Show Presence</span>
                            <span class="row-description">Let others see when you're online</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.presenceEnabled ? 'checked' : ''}
                                   onchange="appSettings.setSetting('collaboration.presenceEnabled', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Show Typing Indicators</span>
                            <span class="row-description">Show when you're typing</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.showTyping ? 'checked' : ''}
                                   onchange="appSettings.setSetting('collaboration.showTyping', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Show Cursors</span>
                            <span class="row-description">Show other users' cursors</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.showCursors ? 'checked' : ''}
                                   onchange="appSettings.setSetting('collaboration.showCursors', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
                
                <!-- Sharing -->
                <div class="settings-section">
                    <h3 class="section-title">Sharing</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Auto-accept Shares</span>
                            <span class="row-description">Automatically accept shared files</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.autoAcceptShares ? 'checked' : ''}
                                   onchange="appSettings.setSetting('collaboration.autoAcceptShares', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Share Notifications</span>
                            <span class="row-description">Show notifications for shares</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.shareNotifications ? 'checked' : ''}
                                   onchange="appSettings.setSetting('collaboration.shareNotifications', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
                
                <!-- Limits -->
                <div class="settings-section">
                    <h3 class="section-title">Limits</h3>
                    
                    <div class="settings-row">
                        <label>Max Collaborators</label>
                        <input type="number" min="1" max="50" value="${settings.maxCollaborators}"
                               onchange="appSettings.setSetting('collaboration.maxCollaborators', this.value)">
                    </div>
                    
                    <div class="settings-row">
                        <label>Presence Timeout</label>
                        <select onchange="appSettings.setSetting('collaboration.presenceTimeout', this.value)">
                            <option value="300000" ${settings.presenceTimeout === 300000 ? 'selected' : ''}>5 minutes</option>
                            <option value="600000" ${settings.presenceTimeout === 600000 ? 'selected' : ''}>10 minutes</option>
                            <option value="1800000" ${settings.presenceTimeout === 1800000 ? 'selected' : ''}>30 minutes</option>
                            <option value="3600000" ${settings.presenceTimeout === 3600000 ? 'selected' : ''}>1 hour</option>
                        </select>
                    </div>
                </div>
                
                <!-- Activity -->
                <div class="settings-section">
                    <h3 class="section-title">Activity</h3>
                    
                    <div class="settings-row toggle-row">
                        <div class="row-label">
                            <span>Broadcast Activity</span>
                            <span class="row-description">Share your activity with others</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   ${settings.activityBroadcast ? 'checked' : ''}
                                   onchange="appSettings.setSetting('collaboration.activityBroadcast', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderDefault(categoryId) {
        return `
            <div class="settings-page">
                <h2 class="page-title">${categoryId} Settings</h2>
                <p class="page-description">Configure ${categoryId} settings</p>
                <div class="settings-section">
                    <p>Settings for ${categoryId} will appear here.</p>
                </div>
            </div>
        `;
    }
    
    // ==================== EVENT HANDLERS ====================
    
    addEventListeners() {
        const searchInput = document.getElementById('settings-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.filterSettings();
            });
        }
        
        this.unsubscribe = this.settings.on('*', (change) => {
            this.unsavedChanges = true;
            this.updateChangedIndicator(change.path);
        });
    }
    
    // ==================== NAVIGATION ====================
    
    showCategory(categoryId) {
        this.currentCategory = categoryId;
        this.currentSubpage = null;
        this.renderSettings();
    }
    
    showSubpage(subpage) {
        this.currentSubpage = subpage;
        this.renderSettings();
    }
    
    // ==================== SETTING ACTIONS ====================
    
    async setSetting(path, value) {
        await this.settings.set(path, value);
        this.unsavedChanges = false;
    }
    
    async toggleSetting(path) {
        const current = this.settings.get(path);
        await this.setSetting(path, !current);
    }
    
    // ==================== UTILITY METHODS ====================
    
    hasUpdates(categoryId) {
        return false;
    }
    
    filterSettings() {
        // Implement search filtering
    }
    
    updateChangedIndicator(path) {
        // Update UI to show changed setting
    }
    
    renderStartupApps(apps) {
        if (!apps || apps.length === 0) {
            return '<div class="empty-state">No startup apps configured</div>';
        }
        
        return apps.map(app => `
            <div class="startup-item">
                <span class="startup-name">${app.name || app}</span>
                <label class="toggle-switch">
                    <input type="checkbox" checked>
                    <span class="toggle-slider"></span>
                </label>
            </div>
        `).join('');
    }
    
    renderAppPermissions() {
        const apps = this.os.modules.AppStore?.getInstalledApps() || [];
        
        return apps.map(app => `
            <div class="permission-item">
                <div class="app-info">
                    <span class="app-icon">${app.icon}</span>
                    <span class="app-name">${app.name}</span>
                </div>
                <button class="manage-permissions-btn" onclick="appSettings.manageAppPermissions('${app.id}')">
                    Manage
                </button>
            </div>
        `).join('');
    }
    
    // ==================== ACTION METHODS ====================
    
    async editDeviceName() {
        const newName = prompt('Enter new device name:', this.settings.get('system.deviceName'));
        if (newName) {
            await this.setSetting('system.deviceName', newName);
        }
    }
    
    async changePassword() {
        const current = document.getElementById('current-password')?.value;
        const newPass = document.getElementById('new-password')?.value;
        const confirm = document.getElementById('confirm-password')?.value;
        
        if (!current || !newPass || !confirm) {
            this.os.notify('Error', 'Please fill all fields', 'error');
            return;
        }
        
        if (newPass !== confirm) {
            this.os.notify('Error', 'New passwords do not match', 'error');
            return;
        }
        
        try {
            await this.os.modules.Security.changePassword(
                this.settings.get('account.username'),
                current,
                newPass
            );
            this.os.notify('Success', 'Password changed successfully', 'success');
        } catch (error) {
            this.os.notify('Error', error.message, 'error');
        }
    }
    
    async toggleTwoFactor(enabled) {
        if (enabled) {
            const secret = this.os.modules.Security.generateTOTPSecret();
            // Show QR code
            await this.setSetting('security.twoFactorAuth', true);
        } else {
            const password = prompt('Enter your password to disable 2FA:');
            if (password) {
                try {
                    await this.os.modules.Security.disableTwoFactor(password);
                    await this.setSetting('security.twoFactorAuth', false);
                } catch (error) {
                    this.os.notify('Error', error.message, 'error');
                }
            }
        }
    }
    
    setDefaultApp(type, appId) {
        const defaultApps = this.settings.get('system.defaultApps') || {};
        defaultApps[type] = appId;
        this.setSetting('system.defaultApps', defaultApps);
    }
    
    manageAppPermissions(appId) {
        this.os.notify('App Permissions', `Managing permissions for ${appId}`, 'info');
    }
    
    showNetworks() {
        this.os.notify('Network', 'Scanning for networks...', 'info');
    }
    
    editAccount() {
        this.os.notify('Account', 'Edit account feature coming soon', 'info');
    }
    
    async checkForUpdates() {
        this.os.notify('Updates', 'Checking for updates...', 'info');
        setTimeout(() => {
            this.os.notify('Updates', 'Your system is up to date', 'success');
        }, 2000);
    }
    
    cleanNow() {
        this.os.notify('Storage', 'Cleaning up storage...', 'info');
        setTimeout(() => {
            this.os.notify('Storage', 'Cleanup complete', 'success');
        }, 2000);
    }
    
    async syncNow() {
        if (this.os.modules.CloudSync) {
            await this.os.modules.CloudSync.sync();
        }
    }
    
    exportSettings() {
        this.settings.exportSettings();
    }
    
    importSettings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            try {
                await this.settings.importSettings(file);
                this.os.notify('Success', 'Settings imported successfully', 'success');
                this.renderSettings();
            } catch (error) {
                this.os.notify('Error', 'Failed to import settings', 'error');
            }
        };
        input.click();
    }
    
    async resetAll() {
        if (confirm('Reset all settings to default? This cannot be undone.')) {
            await this.settings.resetAll();
            this.renderSettings();
            this.os.notify('Settings', 'All settings reset to default', 'info');
        }
    }
    
    manageStartupApps() {
        this.os.notify('Startup', 'Manage startup apps', 'info');
    }
    
    // ==================== CLEANUP ====================
    
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }
}

window.SettingsApp = SettingsApp;
