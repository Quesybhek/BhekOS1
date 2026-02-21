/**
 * BhekOS Logger - Advanced logging system with levels, modules, and persistence
 */
const Logger = {
    // Log levels
    levels: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
        FATAL: 4
    },
    
    // Level names
    levelNames: ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'],
    
    // Current log level
    currentLevel: 1, // INFO
    
    // Module-specific log levels
    moduleLevels: new Map(),
    
    // Log history
    history: [],
    
    // Maximum history size
    maxHistory: 1000,
    
    // Output to console
    consoleOutput: true,
    
    // Output to file (in production)
    fileOutput: false,
    
    // Output to remote server
    remoteOutput: false,
    remoteUrl: null,
    
    // Buffer for batch sending
    buffer: [],
    bufferSize: 10,
    bufferTimeout: 5000,
    
    // Initialize
    init(options = {}) {
        this.currentLevel = options.level !== undefined ? options.level : this.levels.INFO;
        this.maxHistory = options.maxHistory || 1000;
        this.consoleOutput = options.console !== false;
        this.remoteOutput = options.remote || false;
        this.remoteUrl = options.remoteUrl || null;
        this.bufferSize = options.bufferSize || 10;
        
        // Start buffer flush interval
        if (this.remoteOutput) {
            setInterval(() => this.flushBuffer(), this.bufferTimeout);
        }
        
        console.log('Logger initialized');
        return this;
    },
    
    // ==================== LOGGING METHODS ====================
    
    /**
     * Log debug message
     * @param {string} module - Module name
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments
     */
    debug(module, message, ...args) {
        this.log(this.levels.DEBUG, module, message, ...args);
    },
    
    /**
     * Log info message
     * @param {string} module - Module name
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments
     */
    info(module, message, ...args) {
        this.log(this.levels.INFO, module, message, ...args);
    },
    
    /**
     * Log warning message
     * @param {string} module - Module name
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments
     */
    warn(module, message, ...args) {
        this.log(this.levels.WARN, module, message, ...args);
    },
    
    /**
     * Log error message
     * @param {string} module - Module name
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments
     */
    error(module, message, ...args) {
        this.log(this.levels.ERROR, module, message, ...args);
    },
    
    /**
     * Log fatal message
     * @param {string} module - Module name
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments
     */
    fatal(module, message, ...args) {
        this.log(this.levels.FATAL, module, message, ...args);
    },
    
    /**
     * Core log method
     * @param {number} level - Log level
     * @param {string} module - Module name
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments
     */
    log(level, module, message, ...args) {
        const moduleLevel = this.getModuleLevel(module);
        if (level < moduleLevel) return;
        
        const timestamp = new Date().toISOString();
        const levelName = this.levelNames[level];
        const stack = level >= this.levels.ERROR ? this.getStack() : null;
        
        const logEntry = {
            id: this.generateId(),
            timestamp,
            level: levelName,
            module,
            message,
            args: this.safeClone(args),
            stack,
            user: this.getCurrentUser()
        };
        
        // Add to history
        this.addToHistory(logEntry);
        
        // Format for console
        const formatted = this.formatMessage(logEntry);
        
        // Output to console
        if (this.consoleOutput) {
            this.outputToConsole(level, formatted);
        }
        
        // Add to buffer for remote
        if (this.remoteOutput) {
            this.buffer.push(logEntry);
            if (this.buffer.length >= this.bufferSize) {
                this.flushBuffer();
            }
        }
        
        // Trigger event
        if (window.EventBus) {
            EventBus.emit('log:entry', logEntry);
        }
        
        return logEntry;
    },
    
    /**
     * Log with object
     * @param {string} module - Module name
     * @param {Object} obj - Object to log
     */
    dir(module, obj) {
        const levelName = 'INFO';
        const timestamp = new Date().toISOString();
        
        console.group(`[${timestamp}] [${levelName}] [${module}]`);
        console.dir(obj);
        console.groupEnd();
    },
    
    /**
     * Log with table
     * @param {string} module - Module name
     * @param {Array} data - Data to display as table
     */
    table(module, data) {
        console.group(`[${module}] Table`);
        console.table(data);
        console.groupEnd();
    },
    
    /**
     * Start a group
     * @param {string} module - Module name
     * @param {string} label - Group label
     */
    group(module, label) {
        console.group(`[${module}] ${label}`);
    },
    
    /**
     * End a group
     */
    groupEnd() {
        console.groupEnd();
    },
    
    /**
     * Log time taken for an operation
     * @param {string} module - Module name
     * @param {string} label - Operation label
     * @param {Function} fn - Function to time
     * @returns {*} Function result
     */
    time(module, label, fn) {
        console.time(`[${module}] ${label}`);
        const result = fn();
        console.timeEnd(`[${module}] ${label}`);
        return result;
    },
    
    /**
     * Log async time taken
     * @param {string} module - Module name
     * @param {string} label - Operation label
     * @param {Function} fn - Async function to time
     * @returns {Promise<*>} Function result
     */
    async timeAsync(module, label, fn) {
        console.time(`[${module}] ${label}`);
        const result = await fn();
        console.timeEnd(`[${module}] ${label}`);
        return result;
    },
    
    // ==================== MODULE LEVEL MANAGEMENT ====================
    
    /**
     * Set log level for specific module
     * @param {string} module - Module name
     * @param {number} level - Log level
     */
    setModuleLevel(module, level) {
        this.moduleLevels.set(module, level);
    },
    
    /**
     * Get effective level for module
     * @param {string} module - Module name
     * @returns {number} Effective log level
     */
    getModuleLevel(module) {
        return this.moduleLevels.get(module) ?? this.currentLevel;
    },
    
    /**
     * Set global log level
     * @param {number} level - Log level
     */
    setLevel(level) {
        this.currentLevel = level;
    },
    
    /**
     * Get current log level
     * @returns {number} Current log level
     */
    getLevel() {
        return this.currentLevel;
    },
    
    // ==================== HISTORY MANAGEMENT ====================
    
    /**
     * Add entry to history
     * @param {Object} entry - Log entry
     */
    addToHistory(entry) {
        this.history.push(entry);
        
        // Trim history
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    },
    
    /**
     * Get log history
     * @param {Object} filters - Filters (level, module, from, to, limit)
     * @returns {Array} Filtered history
     */
    getHistory(filters = {}) {
        let filtered = [...this.history];
        
        if (filters.level) {
            filtered = filtered.filter(h => h.level === filters.level);
        }
        
        if (filters.module) {
            filtered = filtered.filter(h => h.module === filters.module);
        }
        
        if (filters.from) {
            const fromTime = new Date(filters.from).getTime();
            filtered = filtered.filter(h => new Date(h.timestamp).getTime() >= fromTime);
        }
        
        if (filters.to) {
            const toTime = new Date(filters.to).getTime();
            filtered = filtered.filter(h => new Date(h.timestamp).getTime() <= toTime);
        }
        
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(h => 
                h.message.toLowerCase().includes(searchLower) ||
                h.module.toLowerCase().includes(searchLower)
            );
        }
        
        if (filters.limit) {
            filtered = filtered.slice(-filters.limit);
        }
        
        return filtered;
    },
    
    /**
     * Clear history
     */
    clearHistory() {
        this.history = [];
    },
    
    /**
     * Get statistics about logs
     * @returns {Object} Log statistics
     */
    getStats() {
        const stats = {
            total: this.history.length,
            byLevel: {},
            byModule: {},
            lastHour: 0,
            lastDay: 0
        };
        
        const now = Date.now();
        const hourAgo = now - 3600000;
        const dayAgo = now - 86400000;
        
        for (const entry of this.history) {
            // By level
            stats.byLevel[entry.level] = (stats.byLevel[entry.level] || 0) + 1;
            
            // By module
            stats.byModule[entry.module] = (stats.byModule[entry.module] || 0) + 1;
            
            // Time ranges
            const entryTime = new Date(entry.timestamp).getTime();
            if (entryTime >= hourAgo) stats.lastHour++;
            if (entryTime >= dayAgo) stats.lastDay++;
        }
        
        return stats;
    },
    
    // ==================== FORMATTING ====================
    
    /**
     * Format log message
     * @param {Object} entry - Log entry
     * @returns {string} Formatted message
     */
    formatMessage(entry) {
        const time = new Date(entry.timestamp).toLocaleTimeString();
        let formatted = `[${time}] [${entry.level}] [${entry.module}] ${entry.message}`;
        
        if (entry.args && entry.args.length > 0) {
            formatted += ' ' + entry.args.map(arg => {
                if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg);
                    } catch {
                        return String(arg);
                    }
                }
                return String(arg);
            }).join(' ');
        }
        
        return formatted;
    },
    
    /**
     * Output to console with appropriate method
     * @param {number} level - Log level
     * @param {string} message - Formatted message
     */
    outputToConsole(level, message) {
        switch(level) {
            case this.levels.DEBUG:
                console.debug(message);
                break;
            case this.levels.INFO:
                console.info(message);
                break;
            case this.levels.WARN:
                console.warn(message);
                break;
            case this.levels.ERROR:
            case this.levels.FATAL:
                console.error(message);
                break;
            default:
                console.log(message);
        }
    },
    
    /**
     * Get current stack trace
     * @returns {string} Stack trace
     */
    getStack() {
        try {
            throw new Error();
        } catch (e) {
            return e.stack?.split('\n').slice(2).join('\n') || null;
        }
    },
    
    /**
     * Get current user
     * @returns {string|null} Current username
     */
    getCurrentUser() {
        if (window.BhekOS?.modules?.Security) {
            const user = BhekOS.modules.Security.getCurrentUser();
            return user?.username || null;
        }
        return null;
    },
    
    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        return 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    
    /**
     * Safe clone for args
     * @param {Array} args - Arguments to clone
     * @returns {Array} Cloned arguments
     */
    safeClone(args) {
        return args.map(arg => {
            try {
                if (arg instanceof Error) {
                    return {
                        message: arg.message,
                        stack: arg.stack,
                        name: arg.name
                    };
                }
                if (arg instanceof HTMLElement) {
                    return {
                        tagName: arg.tagName,
                        id: arg.id,
                        className: arg.className
                    };
                }
                if (typeof arg === 'object' && arg !== null) {
                    return JSON.parse(JSON.stringify(arg));
                }
                return arg;
            } catch {
                return String(arg);
            }
        });
    },
    
    // ==================== REMOTE LOGGING ====================
    
    /**
     * Flush buffer to remote server
     */
    async flushBuffer() {
        if (this.buffer.length === 0 || !this.remoteUrl) return;
        
        const logs = [...this.buffer];
        this.buffer = [];
        
        try {
            const response = await fetch(this.remoteUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ logs })
            });
            
            if (!response.ok) {
                console.warn('Failed to send logs to remote server');
                // Re-add to buffer
                this.buffer.unshift(...logs);
            }
        } catch (error) {
            console.warn('Failed to send logs to remote server:', error);
            // Re-add to buffer
            this.buffer.unshift(...logs);
        }
    },
    
    /**
     * Set remote logging URL
     * @param {string} url - Remote URL
     */
    setRemoteUrl(url) {
        this.remoteUrl = url;
        this.remoteOutput = true;
    },
    
    // ==================== EXPORT ====================
    
    /**
     * Export logs to JSON
     * @returns {string} JSON string
     */
    exportLogs() {
        return JSON.stringify(this.history, null, 2);
    },
    
    /**
     * Download logs as file
     * @param {string} filename - Filename
     */
    downloadLogs(filename = `bhekos-logs-${new Date().toISOString().slice(0,10)}.json`) {
        const data = this.exportLogs();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },
    
    /**
     * Clear all logs
     */
    clearAll() {
        this.history = [];
        this.buffer = [];
    }
};

window.Logger = Logger;
