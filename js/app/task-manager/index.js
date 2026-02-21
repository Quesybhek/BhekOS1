/**
 * Task Manager Application - Monitor system performance and processes
 */
class TaskManagerApp {
    constructor(os, windowId) {
        this.os = os;
        this.windowId = windowId;
        this.currentTab = 'processes';
        this.sortBy = 'cpu';
        this.sortOrder = 'desc';
        this.updateInterval = null;
        this.processes = [];
        this.metrics = null;
        this.history = null;
    }
    
    async render(container, options = {}) {
        this.container = container;
        await this.loadData();
        await this.renderTaskManager();
        this.startUpdates();
        this.addStyles();
    }
    
    async loadData() {
        this.metrics = this.os.modules.SystemMonitor?.getMetrics() || this.getDefaultMetrics();
        this.history = this.os.modules.SystemMonitor?.getHistory() || this.getDefaultHistory();
        this.processes = this.metrics.processes || [];
    }
    
    getDefaultMetrics() {
        return {
            cpu: { usage: 0, cores: 4 },
            memory: { total: 2 * 1024 * 1024 * 1024, used: 0, free: 0 },
            storage: { total: 50 * 1024 * 1024 * 1024, used: 0, free: 0 },
            network: { rx: 0, tx: 0, connections: 0 },
            processes: [],
            uptime: 0
        };
    }
    
    getDefaultHistory() {
        return {
            cpu: [],
            memory: [],
            network: []
        };
    }
    
    async renderTaskManager() {
        this.container.innerHTML = `
            <div class="task-manager">
                <!-- Header -->
                <div class="task-manager-header">
                    <h1 class="task-manager-title">📊 Task Manager</h1>
                    <div class="task-manager-actions">
                        <button class="action-btn" onclick="taskManager.refresh()">↻ Refresh</button>
                        <button class="action-btn" onclick="taskManager.endTask()" id="end-task-btn" disabled>End Task</button>
                    </div>
                </div>
                
                <!-- Tabs -->
                <div class="task-manager-tabs">
                    <button class="tab-btn ${this.currentTab === 'processes' ? 'active' : ''}" 
                            onclick="taskManager.switchTab('processes')">Processes</button>
                    <button class="tab-btn ${this.currentTab === 'performance' ? 'active' : ''}" 
                            onclick="taskManager.switchTab('performance')">Performance</button>
                    <button class="tab-btn ${this.currentTab === 'history' ? 'active' : ''}" 
                            onclick="taskManager.switchTab('history')">History</button>
                    <button class="tab-btn ${this.currentTab === 'startup' ? 'active' : ''}" 
                            onclick="taskManager.switchTab('startup')">Startup</button>
                    <button class="tab-btn ${this.currentTab === 'users' ? 'active' : ''}" 
                            onclick="taskManager.switchTab('users')">Users</button>
                </div>
                
                <!-- Tab Content -->
                <div class="task-manager-content">
                    ${this.renderCurrentTab()}
                </div>
                
                <!-- Footer -->
                <div class="task-manager-footer">
                    <span>${this.processes.length} processes</span>
                    <span>CPU: ${this.metrics.cpu.usage.toFixed(1)}%</span>
                    <span>Memory: ${this.formatBytes(this.metrics.memory.used)} / ${this.formatBytes(this.metrics.memory.total)}</span>
                    <span>Uptime: ${this.formatUptime(this.metrics.uptime)}</span>
                </div>
            </div>
        `;
        
        this.addEventListeners();
    }
    
    renderCurrentTab() {
        switch(this.currentTab) {
            case 'processes':
                return this.renderProcessesTab();
            case 'performance':
                return this.renderPerformanceTab();
            case 'history':
                return this.renderHistoryTab();
            case 'startup':
                return this.renderStartupTab();
            case 'users':
                return this.renderUsersTab();
            default:
                return this.renderProcessesTab();
        }
    }
    
    renderProcessesTab() {
        const sortedProcesses = this.sortProcesses();
        
        return `
            <div class="processes-tab">
                <div class="process-list-header">
                    <div class="process-col" onclick="taskManager.sortBy('name')">Name</div>
                    <div class="process-col" onclick="taskManager.sortBy('cpu')">CPU</div>
                    <div class="process-col" onclick="taskManager.sortBy('memory')">Memory</div>
                    <div class="process-col" onclick="taskManager.sortBy('status')">Status</div>
                    <div class="process-col" onclick="taskManager.sortBy('user')">User</div>
                    <div class="process-col">Actions</div>
                </div>
                
                <div class="process-list" id="process-list">
                    ${sortedProcesses.map(proc => this.renderProcessRow(proc)).join('')}
                </div>
            </div>
        `;
    }
    
    renderProcessRow(proc) {
        const isSelected = false; // Track selected process
        const cpuClass = proc.cpu > 50 ? 'high-cpu' : proc.cpu > 25 ? 'medium-cpu' : '';
        const memClass = proc.memory > 100 * 1024 * 1024 ? 'high-mem' : '';
        
        return `
            <div class="process-row ${isSelected ? 'selected' : ''}" data-pid="${proc.pid || proc.id}">
                <div class="process-col">${proc.name}</div>
                <div class="process-col cpu-col ${cpuClass}">${proc.cpu.toFixed(1)}%</div>
                <div class="process-col mem-col ${memClass}">${this.formatBytes(proc.memory)}</div>
                <div class="process-col status-${proc.status}">${proc.status}</div>
                <div class="process-col">${proc.user || 'system'}</div>
                <div class="process-col">
                    <button class="process-end-btn" onclick="taskManager.endProcess('${proc.pid || proc.id}')">End</button>
                </div>
            </div>
        `;
    }
    
    renderPerformanceTab() {
        return `
            <div class="performance-tab">
                <div class="performance-grid">
                    <!-- CPU Card -->
                    <div class="performance-card">
                        <h3>CPU</h3>
                        <div class="performance-value">${this.metrics.cpu.usage.toFixed(1)}%</div>
                        <div class="performance-bar">
                            <div class="performance-bar-fill" style="width: ${this.metrics.cpu.usage}%"></div>
                        </div>
                        <div class="performance-detail">
                            <span>Cores: ${this.metrics.cpu.cores}</span>
                            <span>Frequency: ${(this.metrics.cpu.frequency || 2000).toFixed(0)} MHz</span>
                        </div>
                        <canvas id="cpu-chart" width="300" height="100"></canvas>
                    </div>
                    
                    <!-- Memory Card -->
                    <div class="performance-card">
                        <h3>Memory</h3>
                        <div class="performance-value">${(this.metrics.memory.used / this.metrics.memory.total * 100).toFixed(1)}%</div>
                        <div class="performance-bar">
                            <div class="performance-bar-fill" style="width: ${this.metrics.memory.used / this.metrics.memory.total * 100}%"></div>
                        </div>
                        <div class="performance-detail">
                            <span>Used: ${this.formatBytes(this.metrics.memory.used)}</span>
                            <span>Free: ${this.formatBytes(this.metrics.memory.free)}</span>
                        </div>
                        <div class="performance-subdetail">
                            <span>Cached: ${this.formatBytes(this.metrics.memory.cache || 0)}</span>
                            <span>Swap: ${this.formatBytes(this.metrics.memory.swap || 0)}</span>
                        </div>
                    </div>
                    
                    <!-- Storage Card -->
                    <div class="performance-card">
                        <h3>Storage</h3>
                        <div class="performance-value">${(this.metrics.storage.used / this.metrics.storage.total * 100).toFixed(1)}%</div>
                        <div class="performance-bar">
                            <div class="performance-bar-fill" style="width: ${this.metrics.storage.used / this.metrics.storage.total * 100}%"></div>
                        </div>
                        <div class="performance-detail">
                            <span>Used: ${this.formatBytes(this.metrics.storage.used)}</span>
                            <span>Free: ${this.formatBytes(this.metrics.storage.free)}</span>
                        </div>
                    </div>
                    
                    <!-- Network Card -->
                    <div class="performance-card">
                        <h3>Network</h3>
                        <div class="network-stats">
                            <div class="network-stat">
                                <span class="stat-label">Download</span>
                                <span class="stat-value">${this.formatBytes(this.metrics.network.rx)}/s</span>
                            </div>
                            <div class="network-stat">
                                <span class="stat-label">Upload</span>
                                <span class="stat-value">${this.formatBytes(this.metrics.network.tx)}/s</span>
                            </div>
                        </div>
                        <div class="performance-detail">
                            <span>Connections: ${this.metrics.network.connections}</span>
                            <span>Latency: ${(this.metrics.network.latency || 0).toFixed(0)} ms</span>
                        </div>
                        <canvas id="network-chart" width="300" height="100"></canvas>
                    </div>
                    
                    <!-- GPU Card -->
                    <div class="performance-card">
                        <h3>GPU</h3>
                        <div class="performance-value">${(this.metrics.gpu?.usage || 0).toFixed(1)}%</div>
                        <div class="performance-bar">
                            <div class="performance-bar-fill" style="width: ${this.metrics.gpu?.usage || 0}%"></div>
                        </div>
                        <div class="performance-detail">
                            <span>Memory: ${this.formatBytes(this.metrics.gpu?.memory || 0)}</span>
                            <span>Temp: ${this.metrics.gpu?.temperature || 'N/A'}°C</span>
                        </div>
                    </div>
                    
                    <!-- Battery Card -->
                    <div class="performance-card">
                        <h3>Battery</h3>
                        <div class="performance-value">${this.metrics.battery?.level || 85}%</div>
                        <div class="performance-bar">
                            <div class="performance-bar-fill" style="width: ${this.metrics.battery?.level || 85}%"></div>
                        </div>
                        <div class="performance-detail">
                            <span>Status: ${this.metrics.battery?.charging ? 'Charging' : 'Discharging'}</span>
                            <span>Time: ${this.formatTime(this.metrics.battery?.timeRemaining || 0)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="performance-actions">
                    <button class="performance-btn" onclick="taskManager.optimizeMemory()">
                        🧹 Optimize Memory
                    </button>
                    <button class="performance-btn" onclick="taskManager.cleanStorage()">
                        🗑️ Clean Storage
                    </button>
                </div>
            </div>
        `;
    }
    
    renderHistoryTab() {
        return `
            <div class="history-tab">
                <div class="history-controls">
                    <select id="history-metric" onchange="taskManager.updateHistoryChart()">
                        <option value="cpu">CPU Usage</option>
                        <option value="memory">Memory Usage</option>
                        <option value="network">Network</option>
                    </select>
                    
                    <select id="history-timespan" onchange="taskManager.updateHistoryChart()">
                        <option value="60">Last minute</option>
                        <option value="300">Last 5 minutes</option>
                        <option value="900">Last 15 minutes</option>
                        <option value="3600">Last hour</option>
                    </select>
                    
                    <button class="history-refresh" onclick="taskManager.refreshHistory()">↻</button>
                </div>
                
                <div class="history-chart-container">
                    <canvas id="history-chart" width="700" height="300"></canvas>
                </div>
                
                <div class="history-stats">
                    <div class="stat-item">
                        <span class="stat-label">Average</span>
                        <span class="stat-value" id="history-avg">0%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Peak</span>
                        <span class="stat-value" id="history-peak">0%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Current</span>
                        <span class="stat-value" id="history-current">0%</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderStartupTab() {
        const startupApps = this.os.modules.Settings?.get('system.startupApps') || [];
        
        return `
            <div class="startup-tab">
                <h3>Startup Apps</h3>
                <p class="tab-description">Manage which apps run at startup</p>
                
                <div class="startup-list">
                    ${startupApps.length > 0 ? startupApps.map(app => `
                        <div class="startup-item">
                            <div class="startup-info">
                                <span class="startup-icon">${app.icon || '📱'}</span>
                                <span class="startup-name">${app.name}</span>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" ${app.enabled ? 'checked' : ''} 
                                       onchange="taskManager.toggleStartup('${app.id}', this.checked)">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    `).join('') : `
                        <div class="empty-state">
                            <p>No startup apps configured</p>
                        </div>
                    `}
                </div>
                
                <div class="startup-actions">
                    <button class="add-startup-btn" onclick="taskManager.addStartupApp()">
                        ➕ Add App
                    </button>
                    <button class="disable-all-btn" onclick="taskManager.disableAllStartup()">
                        🔌 Disable All
                    </button>
                </div>
            </div>
        `;
    }
    
    renderUsersTab() {
        const users = this.os.modules.UserManager?.getAllUsers() || [];
        const currentUser = this.os.modules.UserManager?.getCurrentUser();
        
        return `
            <div class="users-tab">
                <h3>Active Users</h3>
                
                <div class="users-list">
                    ${users.map(user => `
                        <div class="user-session-item ${user.id === currentUser?.id ? 'current-user' : ''}">
                            <div class="user-avatar">${user.avatar?.value || '👤'}</div>
                            <div class="user-details">
                                <div class="user-name">${user.name}</div>
                                <div class="user-username">@${user.username}</div>
                            </div>
                            <div class="user-status ${user.presence || 'offline'}">
                                <span class="status-dot"></span>
                                ${user.presence || 'Offline'}
                            </div>
                            <div class="user-session-info">
                                <span>PID: ${1000 + users.indexOf(user)}</span>
                                <span>CPU: ${(Math.random() * 5).toFixed(1)}%</span>
                                <span>Mem: ${(Math.random() * 100 + 20).toFixed(0)} MB</span>
                            </div>
                            ${user.id !== currentUser?.id ? `
                                <button class="disconnect-btn" onclick="taskManager.disconnectUser('${user.id}')">
                                    Disconnect
                                </button>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // ==================== EVENT HANDLERS ====================
    
    addEventListeners() {
        // Process selection
        const processList = document.getElementById('process-list');
        if (processList) {
            processList.addEventListener('click', (e) => {
                const row = e.target.closest('.process-row');
                if (row) {
                    document.querySelectorAll('.process-row').forEach(r => r.classList.remove('selected'));
                    row.classList.add('selected');
                    document.getElementById('end-task-btn').disabled = false;
                }
            });
        }
    }
    
    // ==================== TAB NAVIGATION ====================
    
    switchTab(tab) {
        this.currentTab = tab;
        this.renderTaskManager();
        
        // Draw charts if needed
        if (tab === 'performance') {
            setTimeout(() => this.drawCharts(), 100);
        } else if (tab === 'history') {
            setTimeout(() => this.drawHistoryChart(), 100);
        }
    }
    
    // ==================== PROCESS MANAGEMENT ====================
    
    sortProcesses() {
        return [...this.processes].sort((a, b) => {
            let aVal = a[this.sortBy];
            let bVal = b[this.sortBy];
            
            if (this.sortBy === 'memory') {
                aVal = a.memory;
                bVal = b.memory;
            }
            
            if (this.sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });
    }
    
    sortBy(field) {
        if (this.sortBy === field) {
            this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortBy = field;
            this.sortOrder = 'desc';
        }
        this.renderTaskManager();
    }
    
    endProcess(pid) {
        if (confirm('End this process? Unsaved data may be lost.')) {
            this.os.modules.SystemMonitor?.killProcess(pid);
            setTimeout(() => this.refresh(), 500);
        }
    }
    
    endTask() {
        const selected = document.querySelector('.process-row.selected');
        if (selected) {
            const pid = selected.dataset.pid;
            this.endProcess(pid);
        }
    }
    
    // ==================== PERFORMANCE ACTIONS ====================
    
    async optimizeMemory() {
        await this.os.modules.SystemMonitor?.optimizeMemory();
        this.refresh();
    }
    
    async cleanStorage() {
        await this.os.modules.SystemMonitor?.cleanStorage();
        this.refresh();
    }
    
    // ==================== STARTUP MANAGEMENT ====================
    
    toggleStartup(appId, enabled) {
        const startupApps = this.os.modules.Settings?.get('system.startupApps') || [];
        const app = startupApps.find(a => a.id === appId);
        if (app) {
            app.enabled = enabled;
            this.os.modules.Settings?.set('system.startupApps', startupApps);
        }
    }
    
    addStartupApp() {
        const apps = this.os.modules.AppStore?.getInstalledApps() || [];
        const appNames = apps.map(a => a.name).join('\n');
        const appName = prompt(`Enter app name to add at startup:\nAvailable apps:\n${appNames}`);
        
        if (appName) {
            const app = apps.find(a => a.name.toLowerCase() === appName.toLowerCase());
            if (app) {
                const startupApps = this.os.modules.Settings?.get('system.startupApps') || [];
                startupApps.push({
                    id: app.id,
                    name: app.name,
                    icon: app.icon,
                    enabled: true
                });
                this.os.modules.Settings?.set('system.startupApps', startupApps);
                this.renderTaskManager();
            } else {
                alert('App not found');
            }
        }
    }
    
    disableAllStartup() {
        if (confirm('Disable all startup apps?')) {
            const startupApps = this.os.modules.Settings?.get('system.startupApps') || [];
            startupApps.forEach(app => app.enabled = false);
            this.os.modules.Settings?.set('system.startupApps', startupApps);
            this.renderTaskManager();
        }
    }
    
    // ==================== USER MANAGEMENT ====================
    
    disconnectUser(userId) {
        if (confirm('Disconnect this user?')) {
            this.os.modules.UserManager?.logout(userId);
            setTimeout(() => this.refresh(), 500);
        }
    }
    
    // ==================== CHART DRAWING ====================
    
    drawCharts() {
        this.drawCpuChart();
        this.drawNetworkChart();
    }
    
    drawCpuChart() {
        const canvas = document.getElementById('cpu-chart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const history = this.os.modules.SystemMonitor?.history.cpu || [];
        const data = history.map(h => h.value).slice(-20);
        
        this.drawLineChart(ctx, data, '#4CAF50');
    }
    
    drawNetworkChart() {
        const canvas = document.getElementById('network-chart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const history = this.os.modules.SystemMonitor?.history.network || [];
        const data = history.map(h => h.rx / 1024).slice(-20); // Convert to KB
        
        this.drawLineChart(ctx, data, '#2196F3');
    }
    
    drawHistoryChart() {
        const canvas = document.getElementById('history-chart');
        if (!canvas) return;
        
        const metric = document.getElementById('history-metric')?.value || 'cpu';
        const timespan = parseInt(document.getElementById('history-timespan')?.value || '60');
        
        let data = [];
        let max = 0;
        
        if (metric === 'cpu') {
            data = this.history.cpu.slice(-timespan/60).map(h => h.value);
            max = 100;
        } else if (metric === 'memory') {
            data = this.history.memory.slice(-timespan/60).map(h => h.value);
            max = 100;
        } else {
            data = this.history.network.slice(-timespan/60).map(h => h.rx / 1024);
            max = Math.max(...data, 1000);
        }
        
        const ctx = canvas.getContext('2d');
        this.drawLineChart(ctx, data, metric === 'cpu' ? '#4CAF50' : metric === 'memory' ? '#2196F3' : '#FF9800', max);
        
        // Update stats
        const avg = data.reduce((a, b) => a + b, 0) / data.length || 0;
        const peak = Math.max(...data, 0);
        const current = data[data.length - 1] || 0;
        
        document.getElementById('history-avg').textContent = metric === 'network' ? 
            this.formatBytes(avg * 1024) + '/s' : avg.toFixed(1) + '%';
        document.getElementById('history-peak').textContent = metric === 'network' ? 
            this.formatBytes(peak * 1024) + '/s' : peak.toFixed(1) + '%';
        document.getElementById('history-current').textContent = metric === 'network' ? 
            this.formatBytes(current * 1024) + '/s' : current.toFixed(1) + '%';
    }
    
    drawLineChart(ctx, data, color, max = null) {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const maxValue = max || Math.max(...data, 1);
        
        ctx.clearRect(0, 0, width, height);
        
        if (data.length === 0) return;
        
        // Draw grid
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        
        for (let i = 0; i <= 4; i++) {
            const y = height * i / 4;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Draw line
        const points = data.map((value, index) => {
            const x = (index / (data.length - 1)) * width;
            const y = height - (value / maxValue) * height;
            return { x, y };
        });
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        points.forEach((point, i) => {
            if (i === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        
        ctx.stroke();
        
        // Fill under line
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fillStyle = color + '20';
        ctx.fill();
        
        // Draw points
        points.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    }
    
    updateHistoryChart() {
        this.drawHistoryChart();
    }
    
    refreshHistory() {
        this.history = this.os.modules.SystemMonitor?.getHistory() || this.getDefaultHistory();
        this.drawHistoryChart();
    }
    
    // ==================== DATA REFRESH ====================
    
    startUpdates() {
        this.updateInterval = setInterval(() => {
            this.refresh();
        }, 2000);
    }
    
    async refresh() {
        await this.loadData();
        
        if (this.currentTab === 'processes') {
            const processList = document.getElementById('process-list');
            if (processList) {
                processList.innerHTML = this.sortProcesses().map(proc => this.renderProcessRow(proc)).join('');
            }
        } else if (this.currentTab === 'performance') {
            this.renderPerformanceTab();
            setTimeout(() => this.drawCharts(), 100);
        } else if (this.currentTab === 'history') {
            this.history = this.os.modules.SystemMonitor?.getHistory() || this.getDefaultHistory();
            this.drawHistoryChart();
        }
        
        // Update footer
        const footer = this.container.querySelector('.task-manager-footer');
        if (footer) {
            footer.innerHTML = `
                <span>${this.processes.length} processes</span>
                <span>CPU: ${this.metrics.cpu.usage.toFixed(1)}%</span>
                <span>Memory: ${this.formatBytes(this.metrics.memory.used)} / ${this.formatBytes(this.metrics.memory.total)}</span>
                <span>Uptime: ${this.formatUptime(this.metrics.uptime)}</span>
            `;
        }
    }
    
    // ==================== UTILITY METHODS ====================
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
    }
    
    formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        const parts = [];
        if (hours > 0) parts.push(hours + 'h');
        if (minutes > 0) parts.push(minutes + 'm');
        if (secs > 0 || parts.length === 0) parts.push(secs + 's');
        
        return parts.join(' ');
    }
    
    formatTime(seconds) {
        if (seconds === 0) return 'Unknown';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) return hours + 'h ' + minutes + 'm';
        return minutes + 'm';
    }
    
    // ==================== CLEANUP ====================
    
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
    
    // ==================== STYLES ====================
    
    addStyles() {
        if (document.getElementById('task-manager-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'task-manager-styles';
        style.textContent = `
            .task-manager {
                height: 100%;
                display: flex;
                flex-direction: column;
                padding: 16px;
                font-size: 13px;
            }
            
            .task-manager-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }
            
            .task-manager-title {
                font-size: 20px;
                font-weight: 500;
            }
            
            .action-btn {
                padding: 6px 12px;
                margin-left: 8px;
                background: transparent;
                border: 1px solid var(--mica-border);
                border-radius: 4px;
                color: white;
                cursor: pointer;
            }
            
            .action-btn:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .action-btn:disabled {
                opacity: 0.3;
                cursor: default;
            }
            
            .task-manager-tabs {
                display: flex;
                gap: 4px;
                margin-bottom: 16px;
                border-bottom: 1px solid var(--mica-border);
                padding-bottom: 8px;
            }
            
            .tab-btn {
                padding: 6px 12px;
                background: transparent;
                border: none;
                color: white;
                cursor: pointer;
                border-radius: 4px;
            }
            
            .tab-btn:hover {
                background: rgba(255,255,255,0.05);
            }
            
            .tab-btn.active {
                background: var(--accent);
            }
            
            .task-manager-content {
                flex: 1;
                overflow-y: auto;
                margin-bottom: 16px;
            }
            
            .task-manager-footer {
                padding: 8px 12px;
                background: rgba(0,0,0,0.2);
                border-top: 1px solid var(--mica-border);
                display: flex;
                gap: 20px;
                font-size: 11px;
                opacity: 0.7;
            }
            
            /* Processes Tab */
            .process-list-header {
                display: grid;
                grid-template-columns: 2fr 1fr 1fr 1fr 1fr 80px;
                padding: 8px;
                background: rgba(255,255,255,0.05);
                border-radius: 4px;
                font-weight: 500;
                margin-bottom: 8px;
            }
            
            .process-row {
                display: grid;
                grid-template-columns: 2fr 1fr 1fr 1fr 1fr 80px;
                padding: 8px;
                border-bottom: 1px solid var(--mica-border);
                align-items: center;
            }
            
            .process-row:hover {
                background: rgba(255,255,255,0.02);
            }
            
            .process-row.selected {
                background: rgba(var(--accent-rgb), 0.1);
            }
            
            .process-col {
                cursor: pointer;
            }
            
            .cpu-col.high-cpu {
                color: #ff5252;
            }
            
            .cpu-col.medium-cpu {
                color: #FF9800;
            }
            
            .mem-col.high-mem {
                color: #ff5252;
            }
            
            .status-running {
                color: #4CAF50;
            }
            
            .status-suspended {
                color: #FF9800;
            }
            
            .process-end-btn {
                padding: 4px 8px;
                background: #ff5252;
                border: none;
                border-radius: 4px;
                color: white;
                font-size: 11px;
                cursor: pointer;
            }
            
            /* Performance Tab */
            .performance-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 16px;
                margin-bottom: 20px;
            }
            
            .performance-card {
                padding: 16px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
            }
            
            .performance-card h3 {
                margin-bottom: 12px;
                font-size: 14px;
                opacity: 0.8;
            }
            
            .performance-value {
                font-size: 28px;
                font-weight: 300;
                margin-bottom: 12px;
            }
            
            .performance-bar {
                height: 6px;
                background: rgba(255,255,255,0.1);
                border-radius: 3px;
                margin-bottom: 12px;
                overflow: hidden;
            }
            
            .performance-bar-fill {
                height: 100%;
                background: var(--accent);
                border-radius: 3px;
                transition: width 0.3s;
            }
            
            .performance-detail {
                display: flex;
                justify-content: space-between;
                font-size: 12px;
                opacity: 0.7;
                margin-bottom: 4px;
            }
            
            .performance-subdetail {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                opacity: 0.5;
            }
            
            .network-stats {
                display: flex;
                justify-content: space-around;
                margin-bottom: 12px;
            }
            
            .network-stat {
                text-align: center;
            }
            
            .network-stat .stat-label {
                display: block;
                font-size: 11px;
                opacity: 0.7;
                margin-bottom: 4px;
            }
            
            .network-stat .stat-value {
                font-size: 16px;
                font-weight: 500;
            }
            
            .performance-actions {
                display: flex;
                gap: 10px;
                justify-content: center;
            }
            
            .performance-btn {
                padding: 8px 16px;
                background: transparent;
                border: 1px solid var(--mica-border);
                border-radius: 4px;
                color: white;
                cursor: pointer;
            }
            
            .performance-btn:hover {
                background: rgba(255,255,255,0.05);
            }
            
            /* History Tab */
            .history-controls {
                display: flex;
                gap: 10px;
                margin-bottom: 20px;
            }
            
            .history-controls select {
                padding: 6px 10px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 4px;
                color: white;
            }
            
            .history-refresh {
                padding: 6px 12px;
                background: transparent;
                border: 1px solid var(--mica-border);
                border-radius: 4px;
                color: white;
                cursor: pointer;
            }
            
            .history-chart-container {
                background: rgba(0,0,0,0.2);
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 16px;
            }
            
            .history-stats {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 16px;
                text-align: center;
            }
            
            .stat-item .stat-label {
                display: block;
                font-size: 11px;
                opacity: 0.7;
                margin-bottom: 4px;
            }
            
            .stat-item .stat-value {
                font-size: 18px;
                font-weight: 500;
            }
            
            /* Startup Tab */
            .tab-description {
                margin-bottom: 16px;
                opacity: 0.7;
            }
            
            .startup-list {
                margin-bottom: 20px;
            }
            
            .startup-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px;
                border-bottom: 1px solid var(--mica-border);
            }
            
            .startup-info {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .startup-icon {
                font-size: 20px;
            }
            
            .startup-actions {
                display: flex;
                gap: 10px;
            }
            
            .add-startup-btn,
            .disable-all-btn {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            
            .add-startup-btn {
                background: var(--accent);
                color: white;
            }
            
            .disable-all-btn {
                background: transparent;
                border: 1px solid var(--mica-border);
                color: white;
            }
            
            /* Users Tab */
            .users-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .user-session-item {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
            }
            
            .user-session-item.current-user {
                background: rgba(var(--accent-rgb), 0.1);
                border: 1px solid var(--accent);
            }
            
            .user-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: var(--accent);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
            }
            
            .user-details {
                flex: 1;
            }
            
            .user-name {
                font-size: 14px;
                font-weight: 500;
                margin-bottom: 2px;
            }
            
            .user-username {
                font-size: 12px;
                opacity: 0.7;
            }
            
            .user-status {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                min-width: 80px;
            }
            
            .status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
            }
            
            .user-status.online .status-dot { background: #4CAF50; }
            .user-status.away .status-dot { background: #FF9800; }
            .user-status.busy .status-dot { background: #FF5252; }
            .user-status.offline .status-dot { background: #9E9E9E; }
            
            .user-session-info {
                display: flex;
                gap: 16px;
                font-size: 11px;
                opacity: 0.7;
            }
            
            .disconnect-btn {
                padding: 6px 12px;
                background: #ff5252;
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
                font-size: 11px;
            }
            
            .empty-state {
                text-align: center;
                padding: 40px;
                opacity: 0.7;
            }
            
            /* Light theme */
            .light-theme .task-manager {
                color: black;
            }
            
            .light-theme .tab-btn {
                color: black;
            }
            
            .light-theme .action-btn,
            .light-theme .performance-btn,
            .light-theme .history-refresh,
            .light-theme .disable-all-btn {
                color: black;
            }
            
            .light-theme .history-controls select {
                color: black;
            }
        `;
        
        document.head.appendChild(style);
    }
}

window.TaskManagerApp = TaskManagerApp;
window.taskManager = null; // Will be set when app is instantiated
