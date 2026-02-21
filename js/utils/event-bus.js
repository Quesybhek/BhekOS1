/**
 * BhekOS Event Bus - Central event system for module communication
 */
const EventBus = {
    // Event listeners storage
    listeners: new Map(),
    
    // Wildcard listeners
    wildcardListeners: [],
    
    // Event history for debugging
    history: [],
    
    // Maximum history size
    maxHistory: 100,
    
    // Debug mode
    debug: false,
    
    // ==================== INITIALIZATION ====================
    
    /**
     * Initialize event bus
     * @param {Object} options - Configuration options
     */
    init(options = {}) {
        this.debug = options.debug || false;
        this.maxHistory = options.maxHistory || 100;
        console.log('Event Bus initialized');
        return this;
    },
    
    // ==================== CORE METHODS ====================
    
    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @param {Object} context - Context to bind callback to
     * @returns {Function} Unsubscribe function
     */
    on(event, callback, context = null) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        
        const listener = { callback, context };
        this.listeners.get(event).push(listener);
        
        if (this.debug) {
            console.log(`[EventBus] Subscribed to: ${event}`);
        }
        
        // Return unsubscribe function
        return () => this.off(event, callback);
    },
    
    /**
     * Subscribe to an event once
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @param {Object} context - Context to bind callback to
     * @returns {Function} Unsubscribe function
     */
    once(event, callback, context = null) {
        const onceWrapper = (...args) => {
            this.off(event, onceWrapper);
            callback.apply(context, args);
        };
        
        return this.on(event, onceWrapper, context);
    },
    
    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback to remove
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        
        const listeners = this.listeners.get(event);
        const index = listeners.findIndex(l => l.callback === callback);
        
        if (index !== -1) {
            listeners.splice(index, 1);
            
            if (this.debug) {
                console.log(`[EventBus] Unsubscribed from: ${event}`);
            }
        }
        
        // Clean up empty listener arrays
        if (listeners.length === 0) {
            this.listeners.delete(event);
        }
    },
    
    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {*} data - Event data
     * @returns {Promise<Array>} Results from listeners
     */
    emit(event, data = null) {
        // Log to history
        this.addToHistory(event, data);
        
        if (this.debug) {
            console.log(`[EventBus] Emitting: ${event}`, data);
        }
        
        const results = [];
        const promises = [];
        
        // Call specific listeners
        if (this.listeners.has(event)) {
            const listeners = [...this.listeners.get(event)];
            
            for (const listener of listeners) {
                try {
                    const result = listener.callback.call(listener.context, data, event);
                    
                    if (result instanceof Promise) {
                        promises.push(result);
                    } else {
                        results.push(result);
                    }
                } catch (error) {
                    console.error(`[EventBus] Error in listener for ${event}:`, error);
                }
            }
        }
        
        // Call wildcard listeners
        for (const listener of this.wildcardListeners) {
            if (listener.regex.test(event)) {
                try {
                    const result = listener.handler(data, event);
                    
                    if (result instanceof Promise) {
                        promises.push(result);
                    } else {
                        results.push(result);
                    }
                } catch (error) {
                    console.error(`[EventBus] Error in wildcard listener for ${event}:`, error);
                }
            }
        }
        
        // Return promise.all if any async listeners
        if (promises.length > 0) {
            return Promise.all(promises);
        }
        
        return results;
    },
    
    /**
     * Emit event and wait for first response
     * @param {string} event - Event name
     * @param {*} data - Event data
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<*>} Promise that resolves with first response
     */
    emitFirst(event, data = null, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.off(event, handler);
                reject(new Error(`Timeout waiting for response to ${event}`));
            }, timeout);
            
            const handler = (response) => {
                clearTimeout(timeoutId);
                this.off(event, handler);
                resolve(response);
            };
            
            this.once(event, handler);
            this.emit(event, data);
        });
    },
    
    /**
     * Emit event and wait for all responses
     * @param {string} event - Event name
     * @param {*} data - Event data
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<Array>} Promise that resolves with all responses
     */
    emitAll(event, data = null, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const results = [];
            let count = 0;
            let total = 0;
            
            const timeoutId = setTimeout(() => {
                this.off(event, handler);
                reject(new Error(`Timeout waiting for responses to ${event}`));
            }, timeout);
            
            const handler = (response) => {
                results.push(response);
                count++;
                
                if (count === total) {
                    clearTimeout(timeoutId);
                    this.off(event, handler);
                    resolve(results);
                }
            };
            
            // Count listeners first
            total = this.listeners.get(event)?.length || 0;
            total += this.wildcardListeners.filter(l => l.regex.test(event)).length;
            
            if (total === 0) {
                clearTimeout(timeoutId);
                resolve([]);
                return;
            }
            
            this.on(event, handler);
            this.emit(event, data);
        });
    },
    
    // ==================== WILDCARD EVENTS ====================
    
    /**
     * Subscribe to wildcard events (e.g., "app:*")
     * @param {string} pattern - Pattern with wildcards
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    onWildcard(pattern, callback) {
        const regex = this.patternToRegex(pattern);
        
        const wildcardHandler = (data, event) => {
            if (regex.test(event)) {
                callback(data, event);
            }
        };
        
        this.wildcardListeners.push({
            pattern,
            regex,
            callback,
            handler: wildcardHandler
        });
        
        // Return unsubscribe function
        return () => {
            const index = this.wildcardListeners.findIndex(l => l.pattern === pattern && l.callback === callback);
            if (index !== -1) {
                this.wildcardListeners.splice(index, 1);
            }
        };
    },
    
    /**
     * Convert pattern to regex
     * @param {string} pattern - Pattern with * wildcards
     * @returns {RegExp} Regular expression
     */
    patternToRegex(pattern) {
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        const regexStr = '^' + escaped.replace(/\*/g, '.*') + '$';
        return new RegExp(regexStr);
    },
    
    // ==================== ADVANCED METHODS ====================
    
    /**
     * Get all listeners for an event
     * @param {string} event - Event name
     * @returns {Array} Array of listeners
     */
    getListeners(event) {
        return this.listeners.get(event) || [];
    },
    
    /**
     * Get all registered events
     * @returns {Array} Array of event names
     */
    getEvents() {
        return Array.from(this.listeners.keys());
    },
    
    /**
     * Check if event has listeners
     * @param {string} event - Event name
     * @returns {boolean} True if has listeners
     */
    hasListeners(event) {
        return this.listeners.has(event) && this.listeners.get(event).length > 0;
    },
    
    /**
     * Remove all listeners for an event
     * @param {string} event - Event name (optional, removes all if not specified)
     */
    removeAllListeners(event = null) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
            this.wildcardListeners = [];
        }
    },
    
    /**
     * Add event to history
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    addToHistory(event, data) {
        this.history.push({
            event,
            data: this.cloneData(data),
            timestamp: Date.now()
        });
        
        // Trim history
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    },
    
    /**
     * Get event history
     * @param {string} event - Optional filter by event
     * @returns {Array} Event history
     */
    getHistory(event = null) {
        if (event) {
            return this.history.filter(h => h.event === event);
        }
        return [...this.history];
    },
    
    /**
     * Clear event history
     */
    clearHistory() {
        this.history = [];
    },
    
    /**
     * Clone data safely
     * @param {*} data - Data to clone
     * @returns {*} Cloned data
     */
    cloneData(data) {
        try {
            return JSON.parse(JSON.stringify(data));
        } catch {
            return data;
        }
    },
    
    // ==================== DEBUGGING ====================
    
    /**
     * Enable debug mode
     * @param {boolean} enabled - Debug enabled
     */
    setDebug(enabled) {
        this.debug = enabled;
    },
    
    /**
     * Get statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            totalEvents: this.listeners.size,
            totalListeners: Array.from(this.listeners.values()).reduce(
                (sum, listeners) => sum + listeners.length, 0
            ),
            totalWildcard: this.wildcardListeners.length,
            historySize: this.history.length,
            debug: this.debug
        };
    },
    
    /**
     * Wait for an event
     * @param {string} event - Event to wait for
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<*>} Promise that resolves with event data
     */
    waitFor(event, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.off(event, handler);
                reject(new Error(`Timeout waiting for ${event}`));
            }, timeout);
            
            const handler = (data) => {
                clearTimeout(timeoutId);
                resolve(data);
            };
            
            this.once(event, handler);
        });
    },
    
    /**
     * Create a named pipe between modules
     * @param {string} pipeName - Pipe name
     * @returns {Object} Pipe interface
     */
    createPipe(pipeName) {
        return {
            send: (data) => this.emit(`pipe:${pipeName}`, data),
            on: (callback) => this.on(`pipe:${pipeName}`, callback),
            once: (callback) => this.once(`pipe:${pipeName}`, callback),
            off: (callback) => this.off(`pipe:${pipeName}`, callback)
        };
    }
};

window.EventBus = EventBus;
