/**
 * BhekOS Theme Manager - Complete theming system with dynamic loading
 */
const ThemeManager = {
    os: null,
    
    // Available themes
    themes: new Map(),
    
    // Current theme
    currentTheme: 'dark',
    
    // Theme variables
    variables: new Map(),
    
    // Theme history
    history: [],
    
    // Theme events
    events: {
        onThemeChange: null,
        onVariableChange: null
    },
    
    async init(os) {
        this.os = os;
        console.log('Theme Manager initializing...');
        
        // Register default themes
        this.registerDefaultThemes();
        
        // Load custom themes
        await this.loadCustomThemes();
        
        // Apply current theme
        await this.applyTheme(this.os.modules.Settings?.get('personalization.theme') || 'dark');
        
        console.log(`Theme Manager ready: ${this.themes.size} themes available`);
        return this;
    },
    
    registerDefaultThemes() {
        // Dark theme
        this.registerTheme({
            id: 'dark',
            name: 'Dark Mode',
            description: 'Easy on the eyes at night',
            icon: '🌙',
            colors: {
                background: '#1e1e1e',
                surface: '#2d2d2d',
                primary: '#0078d4',
                secondary: '#9c27b0',
                text: '#ffffff',
                textSecondary: '#aaaaaa',
                border: '#3d3d3d',
                success: '#4CAF50',
                warning: '#FF9800',
                error: '#FF5252',
                info: '#2196F3'
            },
            variables: {
                '--mica': 'rgba(20,20,20,0.85)',
                '--mica-border': 'rgba(255,255,255,0.15)',
                '--shadow-color': 'rgba(0,0,0,0.5)'
            }
        });
        
        // Light theme
        this.registerTheme({
            id: 'light',
            name: 'Light Mode',
            description: 'Bright and clean',
            icon: '☀️',
            colors: {
                background: '#f5f5f5',
                surface: '#ffffff',
                primary: '#0078d4',
                secondary: '#9c27b0',
                text: '#000000',
                textSecondary: '#666666',
                border: '#e0e0e0',
                success: '#4CAF50',
                warning: '#FF9800',
                error: '#FF5252',
                info: '#2196F3'
            },
            variables: {
                '--mica': 'rgba(240,240,240,0.85)',
                '--mica-border': 'rgba(0,0,0,0.1)',
                '--shadow-color': 'rgba(0,0,0,0.1)'
            }
        });
        
        // High contrast theme
        this.registerTheme({
            id: 'high-contrast',
            name: 'High Contrast',
            description: 'Maximum visibility',
            icon: '⚫',
            colors: {
                background: '#000000',
                surface: '#000000',
                primary: '#ffff00',
                secondary: '#00ffff',
                text: '#ffffff',
                textSecondary: '#ffff00',
                border: '#ffffff',
                success: '#00ff00',
                warning: '#ffff00',
                error: '#ff0000',
                info: '#00ffff'
            },
            variables: {
                '--mica': '#000000',
                '--mica-border': '#ffffff',
                '--shadow-color': 'rgba(255,255,255,0.5)'
            }
        });
        
        // Sepia theme
        this.registerTheme({
            id: 'sepia',
            name: 'Sepia',
            description: 'Warm, paper-like appearance',
            icon: '📜',
            colors: {
                background: '#f4ecd8',
                surface: '#e8dcc0',
                primary: '#8b4513',
                secondary: '#a0522d',
                text: '#5d3a1a',
                textSecondary: '#7a5c3a',
                border: '#c4a484',
                success: '#2e7d32',
                warning: '#f57c00',
                error: '#c62828',
                info: '#1565c0'
            },
            variables: {
                '--mica': 'rgba(244,236,216,0.9)',
                '--mica-border': 'rgba(139,69,19,0.2)',
                '--shadow-color': 'rgba(93,58,26,0.2)'
            }
        });
        
        // Nord theme
        this.registerTheme({
            id: 'nord',
            name: 'Nord',
            description: 'Cold, arctic-inspired colors',
            icon: '❄️',
            colors: {
                background: '#2e3440',
                surface: '#3b4252',
                primary: '#88c0d0',
                secondary: '#b48ead',
                text: '#eceff4',
                textSecondary: '#d8dee9',
                border: '#4c566a',
                success: '#a3be8c',
                warning: '#ebcb8b',
                error: '#bf616a',
                info: '#81a1c1'
            },
            variables: {
                '--mica': 'rgba(46,52,64,0.9)',
                '--mica-border': 'rgba(136,192,208,0.3)',
                '--shadow-color': 'rgba(0,0,0,0.5)'
            }
        });
        
        // Dracula theme
        this.registerTheme({
            id: 'dracula',
            name: 'Dracula',
            description: 'Dark theme with vibrant accents',
            icon: '🧛',
            colors: {
                background: '#282a36',
                surface: '#44475a',
                primary: '#ff79c6',
                secondary: '#bd93f9',
                text: '#f8f8f2',
                textSecondary: '#6272a4',
                border: '#44475a',
                success: '#50fa7b',
                warning: '#f1fa8c',
                error: '#ff5555',
                info: '#8be9fd'
            },
            variables: {
                '--mica': 'rgba(40,42,54,0.9)',
                '--mica-border': 'rgba(189,147,249,0.3)',
                '--shadow-color': 'rgba(0,0,0,0.5)'
            }
        });
    },
    
    registerTheme(theme) {
        this.themes.set(theme.id, theme);
    },
    
    async loadCustomThemes() {
        const customThemes = await this.os.modules.Storage.get('custom_themes', []);
        
        for (const theme of customThemes) {
            this.registerTheme(theme);
        }
    },
    
    async applyTheme(themeId) {
        const theme = this.themes.get(themeId);
        if (!theme) {
            console.warn(`Theme ${themeId} not found, using dark`);
            theme = this.themes.get('dark');
        }
        
        this.currentTheme = themeId;
        
        // Apply theme class
        document.body.className = themeId + '-theme';
        
        // Apply color variables
        for (const [key, value] of Object.entries(theme.colors)) {
            document.documentElement.style.setProperty(`--color-${key}`, value);
        }
        
        // Apply custom variables
        for (const [key, value] of Object.entries(theme.variables || {})) {
            document.documentElement.style.setProperty(key, value);
        }
        
        // Generate accent variations
        this.generateAccentVariations(theme.colors.primary);
        
        // Save to history
        this.history.push({
            theme: themeId,
            timestamp: Date.now()
        });
        
        // Save preference
        if (this.os.modules.Settings) {
            await this.os.modules.Settings.set('personalization.theme', themeId, false);
        }
        
        // Emit event
        this.os.modules.EventBus.emit('theme:applied', { themeId, theme });
        
        return theme;
    },
    
    generateAccentVariations(accentColor) {
        // Generate lighter and darker variations
        const rgb = this.hexToRgb(accentColor);
        if (!rgb) return;
        
        const lighter = this.lightenColor(accentColor, 20);
        const darker = this.darkenColor(accentColor, 20);
        const transparent = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`;
        
        document.documentElement.style.setProperty('--accent-light', lighter);
        document.documentElement.style.setProperty('--accent-dark', darker);
        document.documentElement.style.setProperty('--accent-transparent', transparent);
    },
    
    async createCustomTheme(name, colors) {
        const themeId = 'custom_' + Date.now();
        const theme = {
            id: themeId,
            name,
            description: 'Custom theme',
            icon: '🎨',
            colors,
            variables: {},
            custom: true
        };
        
        this.registerTheme(theme);
        
        // Save to storage
        const customThemes = await this.os.modules.Storage.get('custom_themes', []);
        customThemes.push(theme);
        await this.os.modules.Storage.set('custom_themes', customThemes);
        
        return themeId;
    },
    
    async deleteCustomTheme(themeId) {
        if (!themeId.startsWith('custom_')) return;
        
        this.themes.delete(themeId);
        
        const customThemes = await this.os.modules.Storage.get('custom_themes', []);
        const filtered = customThemes.filter(t => t.id !== themeId);
        await this.os.modules.Storage.set('custom_themes', filtered);
        
        if (this.currentTheme === themeId) {
            await this.applyTheme('dark');
        }
    },
    
    getTheme(themeId) {
        return this.themes.get(themeId);
    },
    
    getAllThemes() {
        return Array.from(this.themes.values());
    },
    
    getCurrentTheme() {
        return this.themes.get(this.currentTheme);
    },
    
    async setVariable(name, value) {
        document.documentElement.style.setProperty(name, value);
        this.variables.set(name, value);
        
        this.os.modules.EventBus.emit('theme:variableChanged', { name, value });
    },
    
    async resetToDefault() {
        await this.applyTheme('dark');
    },
    
    // Phase 3: Theme sharing
    async exportTheme(themeId) {
        const theme = this.themes.get(themeId);
        if (!theme) throw new Error('Theme not found');
        
        const exportData = {
            ...theme,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
        
        return JSON.stringify(exportData, null, 2);
    },
    
    async importTheme(themeData) {
        try {
            const theme = typeof themeData === 'string' ? JSON.parse(themeData) : themeData;
            
            if (!theme.id || !theme.name || !theme.colors) {
                throw new Error('Invalid theme format');
            }
            
            // Ensure unique ID for imported themes
            if (this.themes.has(theme.id)) {
                theme.id = 'imported_' + Date.now();
            }
            
            this.registerTheme(theme);
            
            // Save if custom
            if (!theme.builtin) {
                const customThemes = await this.os.modules.Storage.get('custom_themes', []);
                customThemes.push(theme);
                await this.os.modules.Storage.set('custom_themes', customThemes);
            }
            
            return theme.id;
        } catch (error) {
            console.error('Theme import failed:', error);
            throw error;
        }
    },
    
    // Utility methods
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },
    
    lightenColor(hex, percent) {
        const rgb = this.hexToRgb(hex);
        if (!rgb) return hex;
        
        const r = Math.min(255, rgb.r + (255 - rgb.r) * percent / 100);
        const g = Math.min(255, rgb.g + (255 - rgb.g) * percent / 100);
        const b = Math.min(255, rgb.b + (255 - rgb.b) * percent / 100);
        
        return this.rgbToHex(Math.round(r), Math.round(g), Math.round(b));
    },
    
    darkenColor(hex, percent) {
        const rgb = this.hexToRgb(hex);
        if (!rgb) return hex;
        
        const r = Math.max(0, rgb.r - rgb.r * percent / 100);
        const g = Math.max(0, rgb.g - rgb.g * percent / 100);
        const b = Math.max(0, rgb.b - rgb.b * percent / 100);
        
        return this.rgbToHex(Math.round(r), Math.round(g), Math.round(b));
    },
    
    rgbToHex(r, g, b) {
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
};

window.ThemeManager = ThemeManager;
