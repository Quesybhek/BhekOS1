/**
 * BhekOS System Monitor - Performance metrics and resource usage
 */
const SystemMonitor = {
    os: null,
    
    // Metrics
    metrics: {
        cpu: {
            usage: 0,
            cores: navigator.hardwareConcurrency || 4,
            temperature: null,
            frequency: null,
            load: []
        },
        memory: {
            total: 2 * 1024 * 1024 * 1024, // Simulated 2GB
            used: 0,
            free: 0,
            cache: 0,
            swap: 0,
            usage: 0
        },
        storage: {
            total: 50 * 1024 * 1024 * 1024, // Simulated 50GB
            used: 0,
            free: 0,
            usage: 0
        },
        network: {
            rx: 0,
            tx: 0,
            connections: 0,
            latency: 0,
            interfaces: []
        },
        processes: [],
        uptime: 0,
        battery: {
            charging: true,
            level: 85,
            timeRemaining: 7200
        },
        gpu: {
            usage: 0,
            memory: 0,
            temperature: null
        }
    },
    
    // History for graphs
    history: {
        cpu: [],
        memory: [],
        network: [],
        gpu: [],
        timestamps: []
    },
    
    // Max history points
    maxHistory: 60,
    
    // Update interval
    interval: null,
    
    // Alert thresholds
    thresholds: {
        cpu: 80,
        memory: 85,
        storage: 90,
        battery: 20
    },
    
    // Alert callbacks
    alerts: [],
    
    async init(os) {
        this.os = os;
        console.log('System Monitor initializing...');
        
        // Get initial metrics
        await this.updateStorageMetrics();
        await this.updateBatteryInfo();
        
        // Start monitoring
        this.startMonitoring();
        
        console.log('System Monitor initialized');
        return this;
    },
    
    startMonitoring() {
        this.interval = setInterval(() => {
            this.updateMetrics();
            this.recordHistory();
            this.checkAlerts();
        }, 1000);
        
        // Update uptime
        setInterval(() => {
            if (this.os.startTime) {
                this.metrics.uptime = (Date.now() - this.os.startTime) / 1000;
            }
        }, 1000);
    },
    
    stopMonitoring() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    },
    
    updateMetrics() {
        // Simulate CPU usage with variance
        this.metrics.cpu.usage = Math.random() * 30 + 10; // 10-40%
        
        // Generate per-core loads
        this.metrics.cpu.load = Array(this.metrics.cpu.cores).fill(0).map(() => 
            Math.random() * 40 + 5
        );
        
        // Simulate CPU frequency
        this.metrics.cpu.frequency = 2000 + Math.random() * 1000;
        
        // Simulate memory usage
        const storageInfo = this.os.modules.Storage?.info() || { totalSize: 0 };
        this.metrics.memory.used = storageInfo.totalSize || Math.random() * 1024 * 1024 * 1024;
        this.metrics.memory.free = this.metrics.memory.total - this.metrics.memory.used;
        this.metrics.memory.usage = (this.metrics.memory.used / this.metrics.memory.total) * 100;
        this.metrics.memory.cache = Math.random() * 200 * 1024 * 1024;
        this.metrics.memory.swap = Math.random() * 500 * 1024 * 1024;
        
        // Simulate network
        this.metrics.network.rx = Math.floor(Math.random() * 1000 * 1024);
        this.metrics.network.tx = Math.floor(Math.random() * 500 * 1024);
        this.metrics.network.connections = Math.floor(Math.random() * 20);
        this.metrics.network.latency = Math.random() * 50 + 10;
        
        // Simulate GPU usage
        this.metrics.gpu.usage = Math.random() * 30 + 10;
        this.metrics.gpu.memory = Math.random() * 2 * 1024 * 1024 * 1024;
        
        // Update processes
        this.updateProcesses();
        
        // Emit update event
        this.os.modules.EventBus.emit('system:metrics', this.metrics);
    },
    
    async updateStorageMetrics() {
        if (this.os.modules.FileSystem) {
            const stats = await this.os.modules.FileSystem.getStats();
            this.metrics.storage.used = stats.totalSize;
            this.metrics.storage.free = this.metrics.storage.total - this.metrics.storage.used;
            this.metrics.storage.usage = (this.metrics.storage.used / this.metrics.storage.total) * 100;
        }
    },
    
    async updateBatteryInfo() {
        if ('getBattery' in navigator) {
            try {
                const battery = await navigator.getBattery();
                
                this.metrics.battery = {
                    charging: battery.charging,
                    level: battery.level * 100,
                    timeRemaining: battery.charging ? 
                        battery.chargingTime : battery.dischargingTime
                };
                
                // Listen for battery changes
                battery.addEventListener('levelchange', () => {
                    this.metrics.battery.level = battery.level * 100;
                    this.checkAlerts();
                });
                
                battery.addEventListener('chargingchange', () => {
                    this.metrics.battery.charging = battery.charging;
                });
            } catch (e) {
                console.warn('Battery API not available');
            }
        }
    },
    
    updateProcesses() {
        const processes = [];
        
        // Get running windows as processes
        if (this.os.modules.WindowManager) {
            this.os.modules.WindowManager.windows.forEach((win, id) => {
                processes.push({
                    id,
                    pid: id,
                    name: win.app?.name || 'Unknown',
                    cpu: Math.random() * 5,
                    memory: Math.floor(Math.random() * 50 + 10) * 1024 * 1024,
                    memoryFormatted: this.formatBytes(Math.floor(Math.random() * 50 + 10) * 1024 * 1024),
                    status: win.state || 'running',
                    user: win.app?.owner || 'system',
                    started: win.created || Date.now() - Math.random() * 3600000,
                    threads: Math.floor(Math.random() * 10 + 1)
                });
            });
        }
        
        // Add system processes
        processes.push({
            id: 'system',
            pid: 0,
            name: 'System Idle Process',
            cpu: 100 - this.metrics.cpu.usage,
            memory: 10 * 1024 * 1024,
            memoryFormatted: this.formatBytes(10 * 1024 * 1024),
            status: 'running',
            user: 'system',
            started: this.os.startTime || Date.now() - 86400000,
            threads: 5
        });
        
        processes.push({
            id: 'kernel',
            pid: 1,
            name: 'System Kernel',
            cpu: this.metrics.cpu.usage * 0.1,
            memory: 50 * 1024 * 1024,
            memoryFormatted: this.formatBytes(50 * 1024 * 1024),
            status: 'running',
            user: 'system',
            started: this.os.startTime || Date.now() - 86400000,
            threads: 20
        });
        
        this.metrics.processes = processes;
    },
    
    recordHistory() {
        const now = Date.now();
        
        this.history.cpu.push({
            value: this.metrics.cpu.usage,
            timestamp: now
        });
        
        this.history.memory.push({
            value: this.metrics.memory.usage,
            timestamp: now
        });
        
        this.history.network.push({
            rx: this.metrics.network.rx,
            tx: this.metrics.network.tx,
            timestamp: now
        });
        
        this.history.gpu.push({
            value: this.metrics.gpu.usage,
            timestamp: now
        });
        
        this.history.timestamps.push(now);
        
        // Trim history
        if (this.history.cpu.length > this.maxHistory) {
            this.history.cpu.shift();
            this.history.memory.shift();
            this.history.network.shift();
            this.history.gpu.shift();
            this.history.timestamps.shift();
        }
    },
    
    // ==================== ALERTS ====================
    
    onAlert(callback) {
        this.alerts.push(callback);
        return () => {
            const index = this.alerts.indexOf(callback);
            if (index !== -1) this.alerts.splice(index, 1);
        };
    },
    
    checkAlerts() {
        // CPU alert
        if (this.metrics.cpu.usage > this.thresholds.cpu) {
            this.triggerAlert({
                type: 'cpu',
                level: 'warning',
                message: `CPU usage is high (${this.metrics.cpu.usage.toFixed(1)}%)`,
                value: this.metrics.cpu.usage,
                threshold: this.thresholds.cpu
            });
        }
        
        // Memory alert
        if (this.metrics.memory.usage > this.thresholds.memory) {
            this.triggerAlert({
                type: 'memory',
                level: 'warning',
                message: `Memory usage is high (${this.metrics.memory.usage.toFixed(1)}%)`,
                value: this.metrics.memory.usage,
                threshold: this.thresholds.memory
            });
        }
        
        // Storage alert
        if (this.metrics.storage.usage > this.thresholds.storage) {
            this.triggerAlert({
                type: 'storage',
                level: 'warning',
                message: `Storage is almost full (${this.metrics.storage.usage.toFixed(1)}%)`,
                value: this.metrics.storage.usage,
                threshold: this.thresholds.storage
            });
        }
        
        // Battery alert
        if (!this.metrics.battery.charging && this.metrics.battery.level < this.thresholds.battery) {
            this.triggerAlert({
                type: 'battery',
                level: 'warning',
                message: `Battery is low (${this.metrics.battery.level.toFixed(0)}%)`,
                value: this.metrics.battery.level,
                threshold: this.thresholds.battery
            });
        }
    },
    
    triggerAlert(alert) {
        // Check if similar alert was triggered recently
        const recent = this.alerts.some(cb => {
            // Would need to track recent alerts
            return false;
        });
        
        if (!recent) {
            this.alerts.forEach(cb => cb(alert));
            this.os.modules.EventBus.emit('system:alert', alert);
            
            if (this.os.modules.Notification) {
                this.os.modules.Notification.show(
                    'System Alert',
                    alert.message,
                    alert.level
                );
            }
        }
    },
    
    // ==================== PROCESS MANAGEMENT ====================
    
    killProcess(pid) {
        if (pid === 0 || pid === 1) {
            throw new Error('Cannot kill system process');
        }
        
        const process = this.metrics.processes.find(p => p.id === pid);
        if (process) {
            if (this.os.modules.WindowManager) {
                this.os.modules.WindowManager.close(pid);
            }
            
            this.os.modules.EventBus.emit('process:killed', { pid });
            this.os.notify('System', `Process ${process.name} terminated`, 'warning');
        }
    },
    
    getProcessDetails(pid) {
        return this.metrics.processes.find(p => p.id === pid);
    },
    
    // ==================== OPTIMIZATION ====================
    
    async optimizeMemory() {
        // Clear caches
        if (this.os.modules.FileSystem) {
            // Clear thumbnail cache
        }
        
        // Clear unused data
        if (this.os.modules.Storage) {
            // Could clear old temp data
        }
        
        this.os.notify('System', 'Memory optimization complete', 'success');
        this.os.modules.EventBus.emit('system:optimized', { type: 'memory' });
    },
    
    async cleanStorage() {
        if (this.os.modules.FileSystem) {
            // Empty trash
            await this.os.modules.FileSystem.emptyTrash();
            
            // Clear temp files
            const tempFiles = await this.os.modules.FileSystem.search('.tmp');
            for (const file of tempFiles) {
                await this.os.modules.FileSystem.delete(file.path, true);
            }
        }
        
        this.os.notify('System', 'Storage cleanup complete', 'success');
        this.os.modules.EventBus.emit('system:optimized', { type: 'storage' });
    },
    
    // ==================== GETTERS ====================
    
    getMetrics() {
        return { ...this.metrics };
    },
    
    getHistory(duration = '1h') {
        const now = Date.now();
        let cutoff = now;
        
        switch(duration) {
            case '1m': cutoff = now - 60000; break;
            case '5m': cutoff = now - 300000; break;
            case '15m': cutoff = now - 900000; break;
            case '1h': cutoff = now - 3600000; break;
            case '24h': cutoff = now - 86400000; break;
        }
        
        const indices = this.history.timestamps
            .map((t, i) => t >= cutoff ? i : -1)
            .filter(i => i !== -1);
        
        return {
            cpu: indices.map(i => this.history.cpu[i]),
            memory: indices.map(i => this.history.memory[i]),
            network: indices.map(i => this.history.network[i]),
            gpu: indices.map(i => this.history.gpu[i]),
            timestamps: indices.map(i => this.history.timestamps[i])
        };
    },
    
    getProcesses(filter = 'all') {
        let processes = [...this.metrics.processes];
        
        if (filter === 'user') {
            processes = processes.filter(p => p.user !== 'system');
        } else if (filter === 'system') {
            processes = processes.filter(p => p.user === 'system');
        }
        
        return processes;
    },
    
    // ==================== UTILITY ====================
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
    },
    
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
        
        return parts.join(' ');
    }
};

window.SystemMonitor = SystemMonitor;
