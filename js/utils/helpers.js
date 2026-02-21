/**
 * BhekOS Helper Functions - Core utilities for the entire system
 */
const BhekHelpers = {
    // ==================== ID GENERATION ====================
    
    /**
     * Generate a unique ID with optional prefix
     * @param {string} prefix - Optional prefix for the ID
     * @returns {string} Unique ID
     */
    generateId(prefix = '') {
        return prefix + Date.now() + '-' + Math.random().toString(36).substr(2, 9) + '-' + this.randomString(4);
    },
    
    /**
     * Generate a random string of specified length
     * @param {number} length - Length of string to generate
     * @returns {string} Random string
     */
    randomString(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    
    /**
     * Generate a UUID v4
     * @returns {string} UUID
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },
    
    // ==================== DATE & TIME FORMATTING ====================
    
    /**
     * Format time for display
     * @param {Date} date - Date object
     * @param {boolean} includeSeconds - Whether to include seconds
     * @returns {string} Formatted time
     */
    formatTime(date = new Date(), includeSeconds = false) {
        const options = {
            hour: '2-digit',
            minute: '2-digit',
            ...(includeSeconds && { second: '2-digit' })
        };
        return date.toLocaleTimeString([], options);
    },
    
    /**
     * Format date for display
     * @param {Date} date - Date object
     * @param {string} format - 'short', 'medium', or 'long'
     * @returns {string} Formatted date
     */
    formatDate(date = new Date(), format = 'medium') {
        const formats = {
            short: { month: 'numeric', day: 'numeric', year: '2-digit' },
            medium: { month: 'short', day: 'numeric', year: 'numeric' },
            long: { month: 'long', day: 'numeric', year: 'numeric' }
        };
        return date.toLocaleDateString([], formats[format] || formats.medium);
    },
    
    /**
     * Format relative time (e.g., "2 minutes ago")
     * @param {Date|number} date - Date or timestamp
     * @returns {string} Relative time string
     */
    formatRelativeTime(date) {
        const now = new Date();
        const then = new Date(date);
        const diffMs = now - then;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        const diffWeek = Math.floor(diffDay / 7);
        const diffMonth = Math.floor(diffDay / 30);
        const diffYear = Math.floor(diffDay / 365);
        
        if (diffSec < 10) return 'just now';
        if (diffSec < 60) return `${diffSec} seconds ago`;
        if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
        if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
        if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
        if (diffWeek < 5) return `${diffWeek} week${diffWeek > 1 ? 's' : ''} ago`;
        if (diffMonth < 12) return `${diffMonth} month${diffMonth > 1 ? 's' : ''} ago`;
        return `${diffYear} year${diffYear > 1 ? 's' : ''} ago`;
    },
    
    // ==================== DEVICE DETECTION ====================
    
    /**
     * Check if device is mobile
     * @returns {boolean} True if mobile device
     */
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.innerWidth <= 768);
    },
    
    /**
     * Check if device is tablet
     * @returns {boolean} True if tablet
     */
    isTablet() {
        return /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent) ||
               (window.innerWidth > 768 && window.innerWidth <= 1024);
    },
    
    /**
     * Check if device is desktop
     * @returns {boolean} True if desktop
     */
    isDesktop() {
        return !this.isMobile() && !this.isTablet();
    },
    
    /**
     * Get device type
     * @returns {string} 'mobile', 'tablet', or 'desktop'
     */
    getDeviceType() {
        if (this.isMobile()) return 'mobile';
        if (this.isTablet()) return 'tablet';
        return 'desktop';
    },
    
    /**
     * Check if running in standalone/PWA mode
     * @returns {boolean} True if standalone
     */
    isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true;
    },
    
    /**
     * Get browser info
     * @returns {Object} Browser information
     */
    getBrowserInfo() {
        const ua = navigator.userAgent;
        let browser = 'Unknown';
        let version = 'Unknown';
        
        if (ua.includes('Firefox')) {
            browser = 'Firefox';
            version = ua.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.includes('Chrome')) {
            browser = 'Chrome';
            version = ua.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
            browser = 'Safari';
            version = ua.match(/Version\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.includes('Edg')) {
            browser = 'Edge';
            version = ua.match(/Edg\/(\d+)/)?.[1] || 'Unknown';
        }
        
        return {
            name: browser,
            version,
            platform: navigator.platform,
            language: navigator.language,
            cookies: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack,
            userAgent: ua
        };
    },
    
    // ==================== PERFORMANCE UTILITIES ====================
    
    /**
     * Debounce function to limit how often a function can be called
     * @param {Function} func - Function to debounce
     * @param {number} wait - Milliseconds to wait
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    /**
     * Throttle function to limit execution rate
     * @param {Function} func - Function to throttle
     * @param {number} limit - Milliseconds between executions
     * @returns {Function} Throttled function
     */
    throttle(func, limit) {
        let inThrottle;
        let lastFunc;
        let lastRan;
        
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                lastRan = Date.now();
                inThrottle = true;
                
                setTimeout(() => {
                    inThrottle = false;
                }, limit);
            } else {
                clearTimeout(lastFunc);
                lastFunc = setTimeout(() => {
                    if (Date.now() - lastRan >= limit) {
                        func.apply(this, args);
                        lastRan = Date.now();
                    }
                }, limit - (Date.now() - lastRan));
            }
        };
    },
    
    /**
     * Memoize function results
     * @param {Function} func - Function to memoize
     * @returns {Function} Memoized function
     */
    memoize(func) {
        const cache = new Map();
        return function(...args) {
            const key = JSON.stringify(args);
            if (cache.has(key)) {
                return cache.get(key);
            }
            const result = func.apply(this, args);
            cache.set(key, result);
            return result;
        };
    },
    
    /**
     * Measure function execution time
     * @param {Function} fn - Function to measure
     * @param {string} name - Name for logging
     * @returns {*} Function result
     */
    measureTime(fn, name = 'Function') {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        console.log(`${name} took ${(end - start).toFixed(2)}ms`);
        return result;
    },
    
    /**
     * Create a performance marker
     * @param {string} name - Marker name
     */
    mark(name) {
        if (performance.mark) {
            performance.mark(name);
        }
    },
    
    /**
     * Measure between two markers
     * @param {string} name - Measurement name
     * @param {string} startMark - Start marker
     * @param {string} endMark - End marker
     */
    measure(name, startMark, endMark) {
        if (performance.measure) {
            performance.measure(name, startMark, endMark);
        }
    },
    
    // ==================== OBJECT/ARRAY UTILITIES ====================
    
    /**
     * Deep clone an object
     * @param {*} obj - Object to clone
     * @returns {*} Cloned object
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof RegExp) return new RegExp(obj);
        if (obj instanceof Map) return new Map(JSON.parse(JSON.stringify(Array.from(obj))));
        if (obj instanceof Set) return new Set(JSON.parse(JSON.stringify(Array.from(obj))));
        
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (e) {
            // Fallback for circular references
            const clone = Array.isArray(obj) ? [] : {};
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    clone[key] = this.deepClone(obj[key]);
                }
            }
            return clone;
        }
    },
    
    /**
     * Deep merge objects
     * @param {...Object} objects - Objects to merge
     * @returns {Object} Merged object
     */
    deepMerge(...objects) {
        const result = {};
        
        for (const obj of objects) {
            if (!obj) continue;
            
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    if (this.isPlainObject(obj[key]) && this.isPlainObject(result[key])) {
                        result[key] = this.deepMerge(result[key], obj[key]);
                    } else {
                        result[key] = obj[key];
                    }
                }
            }
        }
        
        return result;
    },
    
    /**
     * Check if value is a plain object
     * @param {*} value - Value to check
     * @returns {boolean} True if plain object
     */
    isPlainObject(value) {
        return value !== null && 
               typeof value === 'object' && 
               value.constructor === Object;
    },
    
    /**
     * Pick specific keys from object
     * @param {Object} obj - Source object
     * @param {Array} keys - Keys to pick
     * @returns {Object} New object with picked keys
     */
    pick(obj, keys) {
        return keys.reduce((acc, key) => {
            if (key in obj) acc[key] = obj[key];
            return acc;
        }, {});
    },
    
    /**
     * Omit specific keys from object
     * @param {Object} obj - Source object
     * @param {Array} keys - Keys to omit
     * @returns {Object} New object without omitted keys
     */
    omit(obj, keys) {
        const result = { ...obj };
        keys.forEach(key => delete result[key]);
        return result;
    },
    
    /**
     * Group array by key
     * @param {Array} array - Array to group
     * @param {string|Function} key - Key or function to group by
     * @returns {Object} Grouped object
     */
    groupBy(array, key) {
        return array.reduce((result, item) => {
            const groupKey = typeof key === 'function' ? key(item) : item[key];
            if (!result[groupKey]) result[groupKey] = [];
            result[groupKey].push(item);
            return result;
        }, {});
    },
    
    /**
     * Sort array by key
     * @param {Array} array - Array to sort
     * @param {string} key - Key to sort by
     * @param {string} order - 'asc' or 'desc'
     * @returns {Array} Sorted array
     */
    sortBy(array, key, order = 'asc') {
        const sorted = [...array].sort((a, b) => {
            if (a[key] < b[key]) return -1;
            if (a[key] > b[key]) return 1;
            return 0;
        });
        return order === 'desc' ? sorted.reverse() : sorted;
    },
    
    /**
     * Get unique values from array
     * @param {Array} array - Array to process
     * @returns {Array} Unique values
     */
    unique(array) {
        return [...new Set(array)];
    },
    
    /**
     * Chunk array into smaller arrays
     * @param {Array} array - Array to chunk
     * @param {number} size - Chunk size
     * @returns {Array} Array of chunks
     */
    chunk(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    },
    
    // ==================== STRING UTILITIES ====================
    
    /**
     * Truncate text to specified length
     * @param {string} text - Text to truncate
     * @param {number} length - Maximum length
     * @param {string} suffix - Suffix to add
     * @returns {string} Truncated text
     */
    truncate(text, length = 50, suffix = '...') {
        if (!text || text.length <= length) return text;
        return text.substr(0, length) + suffix;
    },
    
    /**
     * Capitalize first letter
     * @param {string} str - String to capitalize
     * @returns {string} Capitalized string
     */
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },
    
    /**
     * Capitalize each word
     * @param {string} str - String to capitalize
     * @returns {string} Capitalized words
     */
    capitalizeWords(str) {
        if (!str) return '';
        return str.split(' ').map(word => this.capitalize(word)).join(' ');
    },
    
    /**
     * Slugify string (URL friendly)
     * @param {string} str - String to slugify
     * @returns {string} Slug
     */
    slugify(str) {
        return str
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    },
    
    /**
     * Escape HTML special characters
     * @param {string} html - String to escape
     * @returns {string} Escaped string
     */
    escapeHtml(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    },
    
    /**
     * Unescape HTML special characters
     * @param {string} html - String to unescape
     * @returns {string} Unescaped string
     */
    unescapeHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    },
    
    /**
     * Format file size
     * @param {number} bytes - Size in bytes
     * @param {number} decimals - Decimal places
     * @returns {string} Formatted size
     */
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
    },
    
    /**
     * Format number with commas
     * @param {number} num - Number to format
     * @returns {string} Formatted number
     */
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },
    
    /**
     * Format duration in milliseconds
     * @param {number} ms - Milliseconds
     * @returns {string} Formatted duration
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    },
    
    // ==================== COLOR UTILITIES ====================
    
    /**
     * Generate random color
     * @returns {string} Random hex color
     */
    randomColor() {
        const colors = ['#0078d4', '#4CAF50', '#FF9800', '#9C27B0', '#E91E63', '#00BCD4', '#FF5722'];
        return colors[Math.floor(Math.random() * colors.length)];
    },
    
    /**
     * Generate random bright color
     * @returns {string} Random bright hex color
     */
    randomBrightColor() {
        const hue = Math.floor(Math.random() * 360);
        return `hsl(${hue}, 80%, 60%)`;
    },
    
    /**
     * Convert hex to RGB
     * @param {string} hex - Hex color
     * @returns {Object|null} RGB values
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },
    
    /**
     * Convert RGB to hex
     * @param {number} r - Red
     * @param {number} g - Green
     * @param {number} b - Blue
     * @returns {string} Hex color
     */
    rgbToHex(r, g, b) {
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },
    
    /**
     * Lighten a color
     * @param {string} color - Hex color
     * @param {number} percent - Percent to lighten (0-100)
     * @returns {string} Lightened color
     */
    lightenColor(color, percent) {
        const rgb = this.hexToRgb(color);
        if (!rgb) return color;
        
        const r = Math.min(255, rgb.r + (255 - rgb.r) * percent / 100);
        const g = Math.min(255, rgb.g + (255 - rgb.g) * percent / 100);
        const b = Math.min(255, rgb.b + (255 - rgb.b) * percent / 100);
        
        return this.rgbToHex(Math.round(r), Math.round(g), Math.round(b));
    },
    
    /**
     * Darken a color
     * @param {string} color - Hex color
     * @param {number} percent - Percent to darken (0-100)
     * @returns {string} Darkened color
     */
    darkenColor(color, percent) {
        const rgb = this.hexToRgb(color);
        if (!rgb) return color;
        
        const r = Math.max(0, rgb.r - rgb.r * percent / 100);
        const g = Math.max(0, rgb.g - rgb.g * percent / 100);
        const b = Math.max(0, rgb.b - rgb.b * percent / 100);
        
        return this.rgbToHex(Math.round(r), Math.round(g), Math.round(b));
    },
    
    /**
     * Get contrasting text color (black or white) for background
     * @param {string} hex - Background color
     * @returns {string} Text color
     */
    getContrastColor(hex) {
        const rgb = this.hexToRgb(hex);
        if (!rgb) return '#ffffff';
        
        const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
        return luminance > 0.5 ? '#000000' : '#ffffff';
    },
    
    // ==================== DOM UTILITIES ====================
    
    /**
     * Check if element is in viewport
     * @param {HTMLElement} element - Element to check
     * @returns {boolean} True if in viewport
     */
    isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    },
    
    /**
     * Get element position relative to document
     * @param {HTMLElement} element - Element
     * @returns {Object} Position {top, left}
     */
    getElementPosition(element) {
        let top = 0;
        let left = 0;
        let current = element;
        
        while (current) {
            top += current.offsetTop;
            left += current.offsetLeft;
            current = current.offsetParent;
        }
        
        return { top, left };
    },
    
    /**
     * Create element with attributes and children
     * @param {string} tag - HTML tag
     * @param {Object} attrs - Attributes
     * @param {Array|string} children - Children
     * @returns {HTMLElement} Created element
     */
    createElement(tag, attrs = {}, children = []) {
        const element = document.createElement(tag);
        
        for (const [key, value] of Object.entries(attrs)) {
            if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                element.addEventListener(key.slice(2).toLowerCase(), value);
            } else if (key === 'className') {
                element.className = value;
            } else {
                element.setAttribute(key, value);
            }
        }
        
        if (typeof children === 'string') {
            element.innerHTML = children;
        } else if (Array.isArray(children)) {
            children.forEach(child => {
                if (child instanceof HTMLElement) {
                    element.appendChild(child);
                } else if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                }
            });
        }
        
        return element;
    },
    
    /**
     * Remove all children from element
     * @param {HTMLElement} element - Element to clear
     */
    emptyElement(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    },
    
    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise<boolean>} True if successful
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            
            try {
                document.execCommand('copy');
                document.body.removeChild(textarea);
                return true;
            } catch (e) {
                document.body.removeChild(textarea);
                return false;
            }
        }
    },
    
    /**
     * Download data as file
     * @param {string} filename - Filename
     * @param {string} content - File content
     * @param {string} type - MIME type
     */
    downloadFile(filename, content, type = 'text/plain') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },
    
    // ==================== VALIDATION ====================
    
    /**
     * Validate email
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid
     */
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    /**
     * Validate URL
     * @param {string} url - URL to validate
     * @returns {boolean} True if valid
     */
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },
    
    /**
     * Validate phone number
     * @param {string} phone - Phone to validate
     * @returns {boolean} True if valid
     */
    isValidPhone(phone) {
        const re = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
        return re.test(phone);
    },
    
    /**
     * Validate strong password
     * @param {string} password - Password to validate
     * @returns {Object} Validation result
     */
    validatePassword(password) {
        const errors = [];
        
        if (password.length < 8) {
            errors.push('At least 8 characters');
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('At least one uppercase letter');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('At least one lowercase letter');
        }
        if (!/[0-9]/.test(password)) {
            errors.push('At least one number');
        }
        if (!/[!@#$%^&*]/.test(password)) {
            errors.push('At least one special character');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    },
    
    // ==================== MATH UTILITIES ====================
    
    /**
     * Clamp number between min and max
     * @param {number} num - Number to clamp
     * @param {number} min - Minimum
     * @param {number} max - Maximum
     * @returns {number} Clamped number
     */
    clamp(num, min, max) {
        return Math.min(Math.max(num, min), max);
    },
    
    /**
     * Map number from one range to another
     * @param {number} num - Number to map
     * @param {number} inMin - Input min
     * @param {number} inMax - Input max
     * @param {number} outMin - Output min
     * @param {number} outMax - Output max
     * @returns {number} Mapped number
     */
    mapRange(num, inMin, inMax, outMin, outMax) {
        return (num - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    },
    
    /**
     * Generate random integer between min and max (inclusive)
     * @param {number} min - Minimum
     * @param {number} max - Maximum
     * @returns {number} Random integer
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    
    /**
     * Generate random float between min and max
     * @param {number} min - Minimum
     * @param {number} max - Maximum
     * @returns {number} Random float
     */
    randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    },
    
    /**
     * Calculate percentage
     * @param {number} value - Current value
     * @param {number} total - Total value
     * @returns {number} Percentage
     */
    percent(value, total) {
        if (total === 0) return 0;
        return (value / total) * 100;
    },
    
    // ==================== STORAGE UTILITIES ====================
    
    /**
     * Get storage usage
     * @returns {Object} Storage usage info
     */
    getStorageUsage() {
        let total = 0;
        let items = 0;
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            total += (key.length + value.length) * 2; // Approximate bytes
            items++;
        }
        
        return {
            items,
            bytes: total,
            formatted: this.formatBytes(total),
            percentUsed: (total / (5 * 1024 * 1024)) * 100 // Approximate 5MB limit
        };
    },
    
    /**
     * Check if localStorage is available
     * @returns {boolean} True if available
     */
    isStorageAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    },
    
    // ==================== ENCODING ====================
    
    /**
     * Base64 encode string
     * @param {string} str - String to encode
     * @returns {string} Base64 encoded string
     */
    base64Encode(str) {
        try {
            return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
                (match, p1) => String.fromCharCode('0x' + p1)));
        } catch (e) {
            return btoa(str);
        }
    },
    
    /**
     * Base64 decode string
     * @param {string} str - Base64 string to decode
     * @returns {string} Decoded string
     */
    base64Decode(str) {
        try {
            return decodeURIComponent(Array.prototype.map.call(atob(str), c =>
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join(''));
        } catch (e) {
            return atob(str);
        }
    }
};

window.BhekHelpers = BhekHelpers;
