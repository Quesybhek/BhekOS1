/**
 * BhekOS Web Worker Manager - Handle background tasks and threading
 */
const BhekWorker = {
    // Registered workers
    workers: new Map(),
    
    // Worker scripts
    scripts: {
        sync: '/workers/sync-worker.js',
        backup: '/workers/backup-worker.js',
        search: '/workers/search-worker.js',
        crypto: '/workers/crypto-worker.js'
    },
    
    // Task queue
    taskQueue: [],
    
    // Worker status
    status: new Map(),
    
    // ==================== INITIALIZATION ====================
    
    /**
     * Initialize worker manager
     * @param {Object} options - Configuration options
     */
    init(options = {}) {
        this.scripts = { ...this.scripts, ...options.scripts };
        
        // Check worker support
        if (!window.Worker) {
            console.warn('Web Workers not supported in this browser');
        }
        
        console.log('Worker Manager initialized');
        return this;
    },
    
    // ==================== WORKER MANAGEMENT ====================
    
    /**
     * Create a new worker
     * @param {string} name - Worker name
     * @param {string} script - Worker script URL
     * @param {Object} options - Worker options
     * @returns {Worker} Worker instance
     */
    createWorker(name, script, options = {}) {
        if (!window.Worker) {
            throw new Error('Web Workers not supported');
        }
        
        if (this.workers.has(name)) {
            this.terminateWorker(name);
        }
        
        const worker = new Worker(script, options);
        
        // Setup message handler
        worker.onmessage = (event) => {
            this.handleWorkerMessage(name, event.data);
        };
        
        worker.onerror = (error) => {
            this.handleWorkerError(name, error);
        };
        
        this.workers.set(name, worker);
        this.status.set(name, 'idle');
        
        console.log(`Worker created: ${name}`);
        return worker;
    },
    
    /**
     * Get worker instance
     * @param {string} name - Worker name
     * @returns {Worker|null} Worker instance
     */
    getWorker(name) {
        return this.workers.get(name) || null;
    },
    
    /**
     * Terminate worker
     * @param {string} name - Worker name
     */
    terminateWorker(name) {
        const worker = this.workers.get(name);
        if (worker) {
            worker.terminate();
            this.workers.delete(name);
            this.status.delete(name);
            console.log(`Worker terminated: ${name}`);
        }
    },
    
    /**
     * Terminate all workers
     */
    terminateAll() {
        for (const [name, worker] of this.workers) {
            worker.terminate();
        }
        this.workers.clear();
        this.status.clear();
        console.log('All workers terminated');
    },
    
    // ==================== TASK EXECUTION ====================
    
    /**
     * Run task in worker
     * @param {string} workerName - Worker name
     * @param {string} task - Task name
     * @param {*} data - Task data
     * @returns {Promise<*>} Task result
     */
    runTask(workerName, task, data = null) {
        return new Promise((resolve, reject) => {
            const worker = this.workers.get(workerName);
            
            if (!worker) {
                reject(new Error(`Worker not found: ${workerName}`));
                return;
            }
            
            const taskId = this.generateTaskId();
            
            // Setup one-time message handler
            const messageHandler = (event) => {
                if (event.data.taskId === taskId) {
                    worker.removeEventListener('message', messageHandler);
                    
                    if (event.data.error) {
                        reject(new Error(event.data.error));
                    } else {
                        resolve(event.data.result);
                    }
                    
                    this.status.set(workerName, 'idle');
                }
            };
            
            worker.addEventListener('message', messageHandler);
            
            // Send task to worker
            this.status.set(workerName, 'busy');
            worker.postMessage({
                type: 'task',
                taskId,
                task,
                data
            });
        });
    },
    
    /**
     * Run task in background (fire and forget)
     * @param {string} workerName - Worker name
     * @param {string} task - Task name
     * @param {*} data - Task data
     */
    runBackgroundTask(workerName, task, data = null) {
        const worker = this.workers.get(workerName);
        
        if (!worker) {
            console.error(`Worker not found: ${workerName}`);
            return;
        }
        
        worker.postMessage({
            type: 'background',
            task,
            data
        });
    },
    
    /**
     * Queue task for execution
     * @param {string} workerName - Worker name
     * @param {string} task - Task name
     * @param {*} data - Task data
     * @returns {Promise<*>} Task result
     */
    async queueTask(workerName, task, data = null) {
        const worker = this.workers.get(workerName);
        
        if (!worker) {
            throw new Error(`Worker not found: ${workerName}`);
        }
        
        // If worker is idle, run immediately
        if (this.status.get(workerName) === 'idle') {
            return this.runTask(workerName, task, data);
        }
        
        // Otherwise queue the task
        return new Promise((resolve, reject) => {
            this.taskQueue.push({
                workerName,
                task,
                data,
                resolve,
                reject
            });
        });
    },
    
    /**
     * Process next task in queue
     * @param {string} workerName - Worker name
     */
    processNextTask(workerName) {
        const nextTask = this.taskQueue.find(t => t.workerName === workerName);
        
        if (nextTask) {
            this.taskQueue = this.taskQueue.filter(t => t !== nextTask);
            
            this.runTask(workerName, nextTask.task, nextTask.data)
                .then(nextTask.resolve)
                .catch(nextTask.reject);
        }
    },
    
    // ==================== SPECIFIC WORKERS ====================
    
    /**
     * Create sync worker for background sync
     * @returns {Worker} Sync worker
     */
    createSyncWorker() {
        return this.createWorker('sync', this.scripts.sync);
    },
    
    /**
     * Create backup worker
     * @returns {Worker} Backup worker
     */
    createBackupWorker() {
        return this.createWorker('backup', this.scripts.backup);
    },
    
    /**
     * Create search worker
     * @returns {Worker} Search worker
     */
    createSearchWorker() {
        return this.createWorker('search', this.scripts.search);
    },
    
    /**
     * Create crypto worker
     * @returns {Worker} Crypto worker
     */
    createCryptoWorker() {
        return this.createWorker('crypto', this.scripts.crypto);
    },
    
    /**
     * Perform search in background
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Search results
     */
    async search(query, options = {}) {
        let worker = this.getWorker('search');
        
        if (!worker) {
            worker = this.createSearchWorker();
        }
        
        return this.runTask('search', 'search', { query, options });
    },
    
    /**
     * Perform backup in background
     * @param {Object} options - Backup options
     */
    backup(options = {}) {
        let worker = this.getWorker('backup');
        
        if (!worker) {
            worker = this.createBackupWorker();
        }
        
        this.runBackgroundTask('backup', 'backup', options);
    },
    
    /**
     * Sync data in background
     * @param {Object} data - Data to sync
     */
    sync(data) {
        let worker = this.getWorker('sync');
        
        if (!worker) {
            worker = this.createSyncWorker();
        }
        
        this.runBackgroundTask('sync', 'sync', data);
    },
    
    /**
     * Perform crypto operation
     * @param {string} operation - Crypto operation
     * @param {*} data - Data to process
     * @returns {Promise<*>} Result
     */
    async crypto(operation, data) {
        let worker = this.getWorker('crypto');
        
        if (!worker) {
            worker = this.createCryptoWorker();
        }
        
        return this.runTask('crypto', operation, data);
    },
    
    // ==================== EVENT HANDLERS ====================
    
    /**
     * Handle worker message
     * @param {string} workerName - Worker name
     * @param {*} data - Message data
     */
    handleWorkerMessage(workerName, data) {
        switch (data.type) {
            case 'ready':
                this.status.set(workerName, 'idle');
                this.processNextTask(workerName);
                break;
                
            case 'progress':
                if (window.EventBus) {
                    EventBus.emit(`worker:${workerName}:progress`, data.progress);
                }
                break;
                
            case 'complete':
                this.status.set(workerName, 'idle');
                this.processNextTask(workerName);
                break;
                
            case 'log':
                console.log(`[Worker:${workerName}]`, data.message);
                break;
        }
    },
    
    /**
     * Handle worker error
     * @param {string} workerName - Worker name
     * @param {ErrorEvent} error - Error event
     */
    handleWorkerError(workerName, error) {
        console.error(`Worker error (${workerName}):`, error);
        this.status.set(workerName, 'error');
        
        if (window.EventBus) {
            EventBus.emit(`worker:${workerName}:error`, {
                message: error.message,
                filename: error.filename,
                lineno: error.lineno
            });
        }
    },
    
    // ==================== UTILITY METHODS ====================
    
    /**
     * Generate unique task ID
     * @returns {string} Task ID
     */
    generateTaskId() {
        return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    
    /**
     * Check if worker is supported
     * @returns {boolean} True if supported
     */
    isSupported() {
        return typeof Worker !== 'undefined';
    },
    
    /**
     * Get worker status
     * @param {string} workerName - Worker name
     * @returns {string} Worker status
     */
    getWorkerStatus(workerName) {
        return this.status.get(workerName) || 'unknown';
    },
    
    /**
     * Get all worker statuses
     * @returns {Object} Status map
     */
    getAllStatuses() {
        const statuses = {};
        for (const [name, status] of this.status) {
            statuses[name] = status;
        }
        return statuses;
    },
    
    /**
     * Get queue length
     * @returns {number} Queue length
     */
    getQueueLength() {
        return this.taskQueue.length;
    },
    
    /**
     * Clear task queue
     */
    clearQueue() {
        this.taskQueue = [];
    },
    
    /**
     * Check if worker is busy
     * @param {string} workerName - Worker name
     * @returns {boolean} True if busy
     */
    isBusy(workerName) {
        return this.status.get(workerName) === 'busy';
    }
};

window.BhekWorker = BhekWorker;
