/**
 * BhekOS Network Utilities - API communication, WebSocket, and offline sync
 */
const BhekNetwork = {
    // Base API URL
    apiBaseUrl: '/api',
    
    // WebSocket connection
    ws: null,
    wsReconnectAttempts: 0,
    maxReconnectAttempts: 10,
    reconnectDelay: 1000,
    
    // Request queue for offline support
    requestQueue: [],
    isOnline: navigator.onLine,
    
    // Default headers
    defaultHeaders: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    },
    
    // Cache for GET requests
    cache: new Map(),
    cacheTimeout: 5 * 60 * 1000, // 5 minutes
    
    // ==================== INITIALIZATION ====================
    
    /**
     * Initialize network module
     * @param {Object} options - Configuration options
     */
    init(options = {}) {
        this.apiBaseUrl = options.apiBaseUrl || this.apiBaseUrl;
        
        // Monitor online/offline status
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Process any queued requests
        if (this.isOnline) {
            this.processQueue();
        }
        
        console.log('Network module initialized');
        return this;
    },
    
    // ==================== HTTP REQUESTS ====================
    
    /**
     * Make GET request
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Request options
     * @returns {Promise<*>} Response data
     */
    async get(endpoint, options = {}) {
        const url = this.buildUrl(endpoint, options.params);
        const cacheKey = url;
        
        // Check cache
        if (!options.skipCache && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
            this.cache.delete(cacheKey);
        }
        
        const response = await this.request(url, {
            method: 'GET',
            headers: options.headers,
            signal: options.signal
        });
        
        // Cache response
        if (!options.skipCache) {
            this.cache.set(cacheKey, {
                data: response,
                timestamp: Date.now()
            });
        }
        
        return response;
    },
    
    /**
     * Make POST request
     * @param {string} endpoint - API endpoint
     * @param {*} data - Request data
     * @param {Object} options - Request options
     * @returns {Promise<*>} Response data
     */
    async post(endpoint, data, options = {}) {
        return this.request(endpoint, {
            method: 'POST',
            data,
            headers: options.headers,
            signal: options.signal,
            offline: options.offline !== false
        });
    },
    
    /**
     * Make PUT request
     * @param {string} endpoint - API endpoint
     * @param {*} data - Request data
     * @param {Object} options - Request options
     * @returns {Promise<*>} Response data
     */
    async put(endpoint, data, options = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            data,
            headers: options.headers,
            signal: options.signal,
            offline: options.offline !== false
        });
    },
    
    /**
     * Make PATCH request
     * @param {string} endpoint - API endpoint
     * @param {*} data - Request data
     * @param {Object} options - Request options
     * @returns {Promise<*>} Response data
     */
    async patch(endpoint, data, options = {}) {
        return this.request(endpoint, {
            method: 'PATCH',
            data,
            headers: options.headers,
            signal: options.signal,
            offline: options.offline !== false
        });
    },
    
    /**
     * Make DELETE request
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Request options
     * @returns {Promise<*>} Response data
     */
    async delete(endpoint, options = {}) {
        return this.request(endpoint, {
            method: 'DELETE',
            headers: options.headers,
            signal: options.signal,
            offline: options.offline !== false
        });
    },
    
    /**
     * Core request method
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Request options
     * @returns {Promise<*>} Response data
     */
    async request(endpoint, options = {}) {
        const url = this.buildUrl(endpoint, options.params);
        const method = options.method || 'GET';
        
        // Prepare headers
        const headers = { ...this.defaultHeaders, ...options.headers };
        
        // Add auth token if available
        const token = this.getAuthToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Prepare fetch options
        const fetchOptions = {
            method,
            headers,
            signal: options.signal,
            credentials: 'same-origin'
        };
        
        // Add body for non-GET requests
        if (method !== 'GET' && options.data !== undefined) {
            if (options.data instanceof FormData) {
                fetchOptions.body = options.data;
                delete headers['Content-Type']; // Let browser set it
            } else {
                fetchOptions.body = JSON.stringify(options.data);
            }
        }
        
        // Check offline status
        if (!this.isOnline && options.offline !== false && method !== 'GET') {
            return this.queueRequest(url, fetchOptions);
        }
        
        try {
            const response = await fetch(url, fetchOptions);
            
            // Handle response
            if (!response.ok) {
                throw await this.handleError(response);
            }
            
            // Parse response
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else if (contentType && contentType.includes('text/')) {
                return await response.text();
            } else {
                return await response.blob();
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request cancelled');
            }
            
            // Queue for offline if enabled
            if (!this.isOnline && options.offline !== false && method !== 'GET') {
                return this.queueRequest(url, fetchOptions);
            }
            
            throw error;
        }
    },
    
    /**
     * Upload file with progress
     * @param {string} endpoint - API endpoint
     * @param {File} file - File to upload
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<*>} Response data
     */
    async upload(endpoint, file, onProgress = null) {
        const formData = new FormData();
        formData.append('file', file);
        
        const xhr = new XMLHttpRequest();
        
        return new Promise((resolve, reject) => {
            xhr.open('POST', this.buildUrl(endpoint), true);
            
            // Add auth token
            const token = this.getAuthToken();
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
            
            // Progress events
            if (onProgress) {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        onProgress({
                            loaded: e.loaded,
                            total: e.total,
                            percent: (e.loaded / e.total) * 100
                        });
                    }
                });
            }
            
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        resolve(JSON.parse(xhr.responseText));
                    } catch {
                        resolve(xhr.responseText);
                    }
                } else {
                    reject(new Error(`Upload failed: ${xhr.status}`));
                }
            };
            
            xhr.onerror = () => reject(new Error('Upload failed'));
            xhr.send(formData);
        });
    },
    
    /**
     * Download file
     * @param {string} endpoint - API endpoint
     * @param {string} filename - Download filename
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<void>}
     */
    async download(endpoint, filename, onProgress = null) {
        const url = this.buildUrl(endpoint);
        const xhr = new XMLHttpRequest();
        
        return new Promise((resolve, reject) => {
            xhr.open('GET', url, true);
            xhr.responseType = 'blob';
            
            // Add auth token
            const token = this.getAuthToken();
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
            
            // Progress events
            if (onProgress) {
                xhr.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        onProgress({
                            loaded: e.loaded,
                            total: e.total,
                            percent: (e.loaded / e.total) * 100
                        });
                    }
                });
            }
            
            xhr.onload = () => {
                if (xhr.status === 200) {
                    const blob = xhr.response;
                    const downloadUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(downloadUrl);
                    resolve();
                } else {
                    reject(new Error(`Download failed: ${xhr.status}`));
                }
            };
            
            xhr.onerror = () => reject(new Error('Download failed'));
            xhr.send();
        });
    },
    
    // ==================== WEBSOCKET ====================
    
    /**
     * Connect WebSocket
     * @param {string} endpoint - WebSocket endpoint
     * @param {Object} handlers - Event handlers
     */
    connectWebSocket(endpoint, handlers = {}) {
        if (this.ws) {
            this.ws.close();
        }
        
        const wsUrl = this.buildWebSocketUrl(endpoint);
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = (event) => {
            console.log('WebSocket connected');
            this.wsReconnectAttempts = 0;
            if (handlers.onOpen) handlers.onOpen(event);
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (handlers.onMessage) handlers.onMessage(data);
            } catch {
                if (handlers.onMessage) handlers.onMessage(event.data);
            }
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            if (handlers.onError) handlers.onError(error);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket closed');
            if (handlers.onClose) handlers.onClose();
            this.reconnectWebSocket(endpoint, handlers);
        };
    },
    
    /**
     * Reconnect WebSocket with exponential backoff
     * @param {string} endpoint - WebSocket endpoint
     * @param {Object} handlers - Event handlers
     */
    reconnectWebSocket(endpoint, handlers) {
        if (this.wsReconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnection attempts reached');
            return;
        }
        
        const delay = this.reconnectDelay * Math.pow(2, this.wsReconnectAttempts);
        this.wsReconnectAttempts++;
        
        setTimeout(() => {
            console.log(`Reconnecting WebSocket (attempt ${this.wsReconnectAttempts})...`);
            this.connectWebSocket(endpoint, handlers);
        }, delay);
    },
    
    /**
     * Send message via WebSocket
     * @param {*} data - Data to send
     */
    sendWebSocket(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = typeof data === 'string' ? data : JSON.stringify(data);
            this.ws.send(message);
        } else {
            console.warn('WebSocket not connected');
        }
    },
    
    /**
     * Close WebSocket connection
     */
    closeWebSocket() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    },
    
    // ==================== OFFLINE QUEUE ====================
    
    /**
     * Queue request for offline
     * @param {string} url - Request URL
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} Queued response
     */
    async queueRequest(url, options) {
        const queueItem = {
            id: Date.now() + Math.random().toString(36),
            url,
            options,
            timestamp: Date.now()
        };
        
        this.requestQueue.push(queueItem);
        
        // Save to IndexedDB for persistence
        await this.saveQueueToDB();
        
        return {
            queued: true,
            id: queueItem.id,
            message: 'Request queued for offline sync'
        };
    },
    
    /**
     * Process queued requests
     */
    async processQueue() {
        if (this.requestQueue.length === 0) return;
        
        console.log(`Processing ${this.requestQueue.length} queued requests`);
        
        const queue = [...this.requestQueue];
        this.requestQueue = [];
        
        for (const item of queue) {
            try {
                await fetch(item.url, item.options);
                console.log('Processed queued request:', item.id);
            } catch (error) {
                console.error('Failed to process queued request:', error);
                this.requestQueue.push(item);
            }
        }
        
        // Update queue in DB
        await this.saveQueueToDB();
    },
    
    /**
     * Save queue to IndexedDB
     */
    async saveQueueToDB() {
        if (!window.BhekStorage) return;
        
        try {
            await BhekStorage.set('request_queue', this.requestQueue, { large: true });
        } catch (error) {
            console.error('Failed to save queue:', error);
        }
    },
    
    /**
     * Load queue from IndexedDB
     */
    async loadQueueFromDB() {
        if (!window.BhekStorage) return;
        
        try {
            const queue = await BhekStorage.get('request_queue', []);
            this.requestQueue = queue;
        } catch (error) {
            console.error('Failed to load queue:', error);
        }
    },
    
    // ==================== EVENT HANDLERS ====================
    
    /**
     * Handle online event
     */
    handleOnline() {
        console.log('Network: Online');
        this.isOnline = true;
        this.processQueue();
        
        if (window.EventBus) {
            EventBus.emit('network:online');
        }
    },
    
    /**
     * Handle offline event
     */
    handleOffline() {
        console.log('Network: Offline');
        this.isOnline = false;
        
        if (window.EventBus) {
            EventBus.emit('network:offline');
        }
    },
    
    // ==================== UTILITY METHODS ====================
    
    /**
     * Build full URL
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Query parameters
     * @returns {string} Full URL
     */
    buildUrl(endpoint, params = {}) {
        let url = endpoint.startsWith('http') ? endpoint : this.apiBaseUrl + endpoint;
        
        if (Object.keys(params).length > 0) {
            const searchParams = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) {
                searchParams.append(key, value);
            }
            url += '?' + searchParams.toString();
        }
        
        return url;
    },
    
    /**
     * Build WebSocket URL
     * @param {string} endpoint - WebSocket endpoint
     * @returns {string} WebSocket URL
     */
    buildWebSocketUrl(endpoint) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        return `${protocol}//${host}${endpoint}`;
    },
    
    /**
     * Get authentication token
     * @returns {string|null} Auth token
     */
    getAuthToken() {
        if (window.BhekOS?.modules?.Security) {
            return BhekOS.modules.Security.getToken?.() || null;
        }
        return localStorage.getItem('auth_token');
    },
    
    /**
     * Handle HTTP error
     * @param {Response} response - Fetch response
     * @returns {Promise<Error>} Error object
     */
    async handleError(response) {
        let errorMessage = `HTTP Error ${response.status}`;
        
        try {
            const data = await response.json();
            errorMessage = data.message || data.error || errorMessage;
        } catch {
            try {
                errorMessage = await response.text();
            } catch {}
        }
        
        const error = new Error(errorMessage);
        error.status = response.status;
        error.response = response;
        
        return error;
    },
    
    /**
     * Clear request cache
     * @param {string} pattern - URL pattern to clear (optional)
     */
    clearCache(pattern = null) {
        if (pattern) {
            for (const [key] of this.cache) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
    },
    
    /**
     * Check if online
     * @returns {boolean} Online status
     */
    isOnline() {
        return this.isOnline;
    },
    
    /**
     * Get queue status
     * @returns {Object} Queue info
     */
    getQueueStatus() {
        return {
            queued: this.requestQueue.length,
            online: this.isOnline
        };
    }
};

window.BhekNetwork = BhekNetwork;
