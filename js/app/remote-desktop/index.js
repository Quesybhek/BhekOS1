/**
 * Remote Desktop Application - Remote access and screen sharing
 */
class RemoteDesktopApp {
    constructor(os, windowId) {
        this.os = os;
        this.windowId = windowId;
        this.currentView = 'host'; // host, client, sessions
        this.connection = null;
        this.sessions = [];
        this.isHosting = false;
        this.isSharing = false;
        this.remoteStream = null;
        this.localStream = null;
        this.remoteCursors = new Map();
    }
    
    async render(container, options = {}) {
        this.container = container;
        
        if (options.sessionId) {
            await this.connectToSession(options.sessionId);
        }
        
        await this.loadSessions();
        await this.renderRemoteDesktop();
        this.setupEventListeners();
        this.addStyles();
    }
    
    async loadSessions() {
        // Load active sessions
        this.sessions = this.getMockSessions();
    }
    
    getMockSessions() {
        const now = Date.now();
        return [
            {
                id: 'session1',
                hostName: 'Office PC',
                hostUser: 'john.doe',
                startedAt: now - 7200000,
                clients: 1,
                status: 'active',
                quality: 'high'
            },
            {
                id: 'session2',
                hostName: 'Home Laptop',
                hostUser: 'jane.smith',
                startedAt: now - 3600000,
                clients: 0,
                status: 'waiting',
                quality: 'medium'
            },
            {
                id: 'session3',
                hostName: 'Development Server',
                hostUser: 'dev-user',
                startedAt: now - 86400000,
                clients: 3,
                status: 'active',
                quality: 'high'
            }
        ];
    }
    
    async renderRemoteDesktop() {
        this.container.innerHTML = `
            <div class="remote-desktop-app">
                <!-- Header -->
                <div class="rd-header">
                    <h1 class="rd-title">
                        <span class="rd-icon">🖥️</span>
                        Remote Desktop
                    </h1>
                    <div class="rd-actions">
                        <button class="action-btn ${this.isHosting ? 'active' : ''}" 
                                onclick="remoteDesktop.toggleHosting()">
                            ${this.isHosting ? '⏹️ Stop Hosting' : '🎥 Start Hosting'}
                        </button>
                        <button class="action-btn" onclick="remoteDesktop.showConnect()">
                            🔌 Connect
                        </button>
                    </div>
                </div>
                
                <!-- Tabs -->
                <div class="rd-tabs">
                    <button class="tab-btn ${this.currentView === 'host' ? 'active' : ''}" 
                            onclick="remoteDesktop.switchView('host')">🎥 Host</button>
                    <button class="tab-btn ${this.currentView === 'client' ? 'active' : ''}" 
                            onclick="remoteDesktop.switchView('client')">🖥️ Remote</button>
                    <button class="tab-btn ${this.currentView === 'sessions' ? 'active' : ''}" 
                            onclick="remoteDesktop.switchView('sessions')">📋 Sessions</button>
                </div>
                
                <!-- Content -->
                <div class="rd-content">
                    ${this.renderCurrentView()}
                </div>
                
                <!-- Status Bar -->
                <div class="rd-status">
                    <span>Status: ${this.isHosting ? 'Hosting' : 'Idle'}</span>
                    <span>Quality: ${this.getConnectionQuality()}</span>
                    <span>Latency: ${this.getLatency()}ms</span>
                    ${this.isSharing ? '<span class="recording-indicator">● Recording</span>' : ''}
                </div>
            </div>
        `;
        
        this.addEventListeners();
    }
    
    renderCurrentView() {
        switch(this.currentView) {
            case 'host':
                return this.renderHostView();
            case 'client':
                return this.renderClientView();
            case 'sessions':
                return this.renderSessionsView();
            default:
                return this.renderHostView();
        }
    }
    
    renderHostView() {
        return `
            <div class="host-view">
                <div class="host-controls">
                    <h2>Host a Session</h2>
                    <p>Share your screen for remote access</p>
                    
                    <div class="host-options">
                        <div class="option-group">
                            <label>Session Name</label>
                            <input type="text" id="session-name" value="My Session" 
                                   ${this.isHosting ? 'disabled' : ''}>
                        </div>
                        
                        <div class="option-group">
                            <label>Quality</label>
                            <select id="session-quality" ${this.isHosting ? 'disabled' : ''}>
                                <option value="low">Low (Faster)</option>
                                <option value="medium" selected>Medium (Balanced)</option>
                                <option value="high">High (Better quality)</option>
                                <option value="ultra">Ultra (Best quality)</option>
                            </select>
                        </div>
                        
                        <div class="option-group">
                            <label>Permissions</label>
                            <div class="checkbox-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="allow-control" checked 
                                           ${this.isHosting ? 'disabled' : ''}>
                                    Allow remote control
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" id="allow-clipboard" checked
                                           ${this.isHosting ? 'disabled' : ''}>
                                    Share clipboard
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" id="allow-filetransfer"
                                           ${this.isHosting ? 'disabled' : ''}>
                                    Allow file transfer
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" id="require-approval" checked
                                           ${this.isHosting ? 'disabled' : ''}>
                                    Require approval for connections
                                </label>
                            </div>
                        </div>
                        
                        <div class="option-group">
                            <label>Password Protection</label>
                            <input type="password" id="session-password" 
                                   placeholder="Leave empty for no password"
                                   ${this.isHosting ? 'disabled' : ''}>
                        </div>
                    </div>
                    
                    ${this.isHosting ? this.renderActiveSession() : ''}
                    
                    <div class="host-actions">
                        ${!this.isHosting ? `
                            <button class="start-hosting-btn" onclick="remoteDesktop.startHosting()">
                                Start Hosting
                            </button>
                        ` : `
                            <button class="stop-hosting-btn" onclick="remoteDesktop.stopHosting()">
                                Stop Hosting
                            </button>
                        `}
                    </div>
                </div>
                
                ${this.isHosting ? `
                    <div class="active-session-preview">
                        <h3>Session Preview</h3>
                        <div class="preview-screen" id="host-preview">
                            <video autoplay muted></video>
                            <div class="preview-overlay">
                                <span>Screen sharing active</span>
                                <span>Connected: ${this.getConnectedClients()} clients</span>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    renderActiveSession() {
        const sessionCode = this.getSessionCode();
        const connectionLink = this.getConnectionLink();
        
        return `
            <div class="active-session-info">
                <h3>Session Active</h3>
                
                <div class="session-details">
                    <div class="detail-item">
                        <span class="detail-label">Session Code:</span>
                        <span class="detail-value code">${sessionCode}</span>
                        <button class="copy-btn" onclick="remoteDesktop.copySessionCode()">📋</button>
                    </div>
                    
                    <div class="detail-item">
                        <span class="detail-label">Connection Link:</span>
                        <span class="detail-value">${connectionLink}</span>
                        <button class="copy-btn" onclick="remoteDesktop.copyConnectionLink()">📋</button>
                    </div>
                    
                    <div class="detail-item">
                        <span class="detail-label">Connected Clients:</span>
                        <span class="detail-value">${this.getConnectedClients()}</span>
                    </div>
                    
                    <div class="detail-item">
                        <span class="detail-label">Session Started:</span>
                        <span class="detail-value">${new Date().toLocaleTimeString()}</span>
                    </div>
                </div>
                
                <div class="connected-clients-list">
                    <h4>Connected Clients</h4>
                    ${this.renderConnectedClients()}
                </div>
            </div>
        `;
    }
    
    renderConnectedClients() {
        const clients = [
            { id: 'client1', name: 'John\'s Laptop', user: 'john', connected: Date.now() - 300000 },
            { id: 'client2', name: 'Office PC', user: 'jane', connected: Date.now() - 600000 }
        ];
        
        return clients.map(client => `
            <div class="client-item">
                <span class="client-icon">🖥️</span>
                <span class="client-name">${client.name}</span>
                <span class="client-user">@${client.user}</span>
                <span class="client-time">${this.formatDuration(client.connected)}</span>
                <button class="disconnect-client" onclick="remoteDesktop.disconnectClient('${client.id}')">
                    Disconnect
                </button>
            </div>
        `).join('');
    }
    
    renderClientView() {
        return `
            <div class="client-view">
                <div class="remote-screen-container">
                    <div class="remote-screen" id="remote-screen">
                        <video autoplay muted id="remote-video" style="display: none;"></video>
                        <canvas id="remote-canvas"></canvas>
                        
                        ${!this.remoteStream ? `
                            <div class="connect-prompt">
                                <div class="connect-icon">🔌</div>
                                <h3>Connect to a Remote Session</h3>
                                <p>Enter a session code or connection link</p>
                                
                                <div class="connect-input-group">
                                    <input type="text" id="session-code" 
                                           placeholder="Enter session code">
                                    <button onclick="remoteDesktop.connectToCode()">
                                        Connect
                                    </button>
                                </div>
                                
                                <div class="recent-sessions">
                                    <h4>Recent Sessions</h4>
                                    ${this.renderRecentSessions()}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${this.remoteStream ? `
                            <div class="remote-overlay">
                                <div class="connection-info">
                                    <span>Connected to: ${this.currentSession?.hostName || 'Remote'}</span>
                                    <span>Quality: ${this.currentSession?.quality || 'High'}</span>
                                </div>
                                
                                <div class="remote-controls">
                                    <button class="ctrl-btn" onclick="remoteDesktop.toggleFullscreen()">
                                        ⛶ Fullscreen
                                    </button>
                                    <button class="ctrl-btn" onclick="remoteDesktop.toggleControl()">
                                        ${this.remoteControlEnabled ? '🔒 Disable Control' : '🔓 Enable Control'}
                                    </button>
                                    <button class="ctrl-btn" onclick="remoteDesktop.showKeyboard()">
                                        ⌨️ Keyboard
                                    </button>
                                    <button class="disconnect-btn" onclick="remoteDesktop.disconnect()">
                                        Disconnect
                                    </button>
                                </div>
                                
                                <div class="remote-cursors" id="remote-cursors"></div>
                            </div>
                        ` : ''}
                    </div>
                    
                    ${this.remoteStream ? `
                        <div class="chat-sidebar" id="remote-chat">
                            <div class="chat-header">
                                <h4>Session Chat</h4>
                                <button onclick="remoteDesktop.toggleChat()">✕</button>
                            </div>
                            <div class="chat-messages" id="remote-chat-messages">
                                ${this.renderChatMessages()}
                            </div>
                            <div class="chat-input">
                                <input type="text" placeholder="Type a message..." 
                                       id="remote-chat-input">
                                <button onclick="remoteDesktop.sendChatMessage()">Send</button>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    renderSessionsView() {
        return `
            <div class="sessions-view">
                <h2>Active Sessions</h2>
                
                <div class="sessions-list">
                    ${this.sessions.map(session => `
                        <div class="session-card">
                            <div class="session-header">
                                <span class="session-icon">🖥️</span>
                                <span class="session-name">${session.hostName}</span>
                                <span class="session-status ${session.status}">${session.status}</span>
                            </div>
                            
                            <div class="session-details">
                                <div class="detail-row">
                                    <span class="detail-label">Host:</span>
                                    <span>${session.hostUser}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Started:</span>
                                    <span>${new Date(session.startedAt).toLocaleString()}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Clients:</span>
                                    <span>${session.clients}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Quality:</span>
                                    <span class="quality-${session.quality}">${session.quality}</span>
                                </div>
                            </div>
                            
                            <div class="session-actions">
                                <button class="join-btn" onclick="remoteDesktop.joinSession('${session.id}')">
                                    Join Session
                                </button>
                                <button class="info-btn" onclick="remoteDesktop.sessionInfo('${session.id}')">
                                    ℹ️ Info
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="session-stats">
                    <h3>Statistics</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-value">${this.sessions.length}</span>
                            <span class="stat-label">Active Sessions</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${this.sessions.reduce((sum, s) => sum + s.clients, 0)}</span>
                            <span class="stat-label">Total Clients</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${this.formatTotalTime()}</span>
                            <span class="stat-label">Total Time</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderRecentSessions() {
        return this.sessions.slice(0, 3).map(session => `
            <div class="recent-session-item" onclick="remoteDesktop.connectToSession('${session.id}')">
                <span class="recent-icon">🖥️</span>
                <span class="recent-name">${session.hostName}</span>
                <span class="recent-time">${this.formatTimeAgo(session.startedAt)}</span>
            </div>
        `).join('');
    }
    
    renderChatMessages() {
        const messages = [
            { user: 'Host', text: 'Welcome to the session!', time: Date.now() - 60000 },
            { user: 'You', text: 'Thanks, glad to be here', time: Date.now() - 30000 },
            { user: 'Host', text: 'Feel free to ask questions', time: Date.now() - 10000 }
        ];
        
        return messages.map(msg => `
            <div class="chat-message ${msg.user === 'You' ? 'own' : ''}">
                <span class="message-user">${msg.user}</span>
                <span class="message-text">${msg.text}</span>
                <span class="message-time">${this.formatTime(msg.time)}</span>
            </div>
        `).join('');
    }
    
    // ==================== EVENT HANDLERS ====================
    
    setupEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.remoteControlEnabled && this.connection) {
                // Send keyboard events to remote
                this.sendRemoteEvent('keyboard', {
                    type: e.type,
                    key: e.key,
                    code: e.code,
                    shiftKey: e.shiftKey,
                    ctrlKey: e.ctrlKey,
                    altKey: e.altKey
                });
            }
        });
        
        // Mouse events for remote control
        const remoteScreen = document.getElementById('remote-screen');
        if (remoteScreen) {
            remoteScreen.addEventListener('mousemove', (e) => {
                if (this.remoteControlEnabled && this.connection) {
                    const rect = remoteScreen.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / rect.width;
                    const y = (e.clientY - rect.top) / rect.height;
                    
                    this.sendRemoteEvent('mousemove', { x, y });
                }
            });
            
            remoteScreen.addEventListener('mousedown', (e) => {
                if (this.remoteControlEnabled && this.connection) {
                    this.sendRemoteEvent('mousedown', { button: e.button });
                }
            });
            
            remoteScreen.addEventListener('mouseup', (e) => {
                if (this.remoteControlEnabled && this.connection) {
                    this.sendRemoteEvent('mouseup', { button: e.button });
                }
            });
        }
    }
    
    // ==================== VIEW NAVIGATION ====================
    
    switchView(view) {
        this.currentView = view;
        this.renderRemoteDesktop();
    }
    
    // ==================== HOSTING ACTIONS ====================
    
    toggleHosting() {
        if (this.isHosting) {
            this.stopHosting();
        } else {
            this.startHosting();
        }
    }
    
    async startHosting() {
        try {
            // Request screen sharing
            this.localStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });
            
            this.isHosting = true;
            this.isSharing = true;
            
            // Set up video preview
            const video = document.querySelector('#host-preview video');
            if (video) {
                video.srcObject = this.localStream;
                video.play();
            }
            
            this.os.notify('Remote Desktop', 'Screen sharing started', 'success');
            this.renderRemoteDesktop();
            
            // Listen for stream end
            this.localStream.getVideoTracks()[0].onended = () => {
                this.stopHosting();
            };
            
        } catch (error) {
            this.os.notify('Error', 'Failed to start screen sharing: ' + error.message, 'error');
        }
    }
    
    stopHosting() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        this.isHosting = false;
        this.isSharing = false;
        
        this.os.notify('Remote Desktop', 'Screen sharing stopped', 'info');
        this.renderRemoteDesktop();
    }
    
    // ==================== CLIENT ACTIONS ====================
    
    async connectToCode() {
        const code = document.getElementById('session-code')?.value;
        if (!code) return;
        
        await this.connectToSession(code);
    }
    
    async connectToSession(sessionId) {
        this.os.notify('Connecting', 'Connecting to remote session...', 'info');
        
        // Simulate connection
        setTimeout(() => {
            this.currentSession = this.sessions.find(s => s.id === sessionId) || {
                id: sessionId,
                hostName: 'Remote Session',
                quality: 'high'
            };
            
            // Simulate receiving remote stream
            this.remoteStream = true;
            this.remoteControlEnabled = false;
            
            this.renderRemoteDesktop();
            this.os.notify('Connected', 'Connected to remote session', 'success');
            
            // Start receiving remote updates
            this.startReceivingUpdates();
        }, 2000);
    }
    
    disconnect() {
        this.remoteStream = null;
        this.currentSession = null;
        this.remoteControlEnabled = false;
        this.remoteCursors.clear();
        
        this.os.notify('Disconnected', 'Disconnected from remote session', 'info');
        this.renderRemoteDesktop();
    }
    
    disconnectClient(clientId) {
        if (confirm('Disconnect this client?')) {
            // Remove client
            this.renderRemoteDesktop();
        }
    }
    
    joinSession(sessionId) {
        this.connectToSession(sessionId);
        this.currentView = 'client';
    }
    
    sessionInfo(sessionId) {
        alert('Session info coming soon!');
    }
    
    // ==================== REMOTE CONTROL ====================
    
    toggleControl() {
        this.remoteControlEnabled = !this.remoteControlEnabled;
        
        if (this.remoteControlEnabled) {
            this.os.notify('Remote Control', 'Remote control enabled', 'info');
        } else {
            this.os.notify('Remote Control', 'Remote control disabled', 'info');
        }
    }
    
    sendRemoteEvent(type, data) {
        // Send event to remote host
        console.log('Sending remote event:', type, data);
    }
    
    startReceivingUpdates() {
        // Simulate receiving screen updates
        const canvas = document.getElementById('remote-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = 800;
        canvas.height = 600;
        
        // Draw placeholder
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#333';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Remote Screen', canvas.width/2, canvas.height/2);
        
        // Simulate remote cursor
        setInterval(() => {
            if (this.remoteCursors.size > 0) {
                this.renderRemoteCursors();
            }
        }, 50);
    }
    
    renderRemoteCursors() {
        const container = document.getElementById('remote-cursors');
        if (!container) return;
        
        let html = '';
        this.remoteCursors.forEach((cursor, userId) => {
            html += `
                <div class="remote-cursor" style="left: ${cursor.x}px; top: ${cursor.y}px; background-color: ${cursor.color}">
                    <span class="cursor-label">${cursor.user}</span>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    // ==================== CHAT FUNCTIONS ====================
    
    toggleChat() {
        const chat = document.getElementById('remote-chat');
        if (chat) {
            chat.classList.toggle('collapsed');
        }
    }
    
    sendChatMessage() {
        const input = document.getElementById('remote-chat-input');
        const message = input.value.trim();
        
        if (message && this.connection) {
            // Send message
            console.log('Sending chat message:', message);
            input.value = '';
            
            // Add to chat
            const messages = document.getElementById('remote-chat-messages');
            messages.innerHTML += `
                <div class="chat-message own">
                    <span class="message-user">You</span>
                    <span class="message-text">${message}</span>
                    <span class="message-time">now</span>
                </div>
            `;
            messages.scrollTop = messages.scrollHeight;
        }
    }
    
    // ==================== UTILITY FUNCTIONS ====================
    
    getSessionCode() {
        return 'RD-' + Math.random().toString(36).substr(2, 8).toUpperCase();
    }
    
    getConnectionLink() {
        return `https://remote.bhekos.local/connect/${this.getSessionCode()}`;
    }
    
    getConnectedClients() {
        return 2; // Mock value
    }
    
    getConnectionQuality() {
        return this.currentSession?.quality || 'High';
    }
    
    getLatency() {
        return Math.floor(Math.random() * 50 + 10); // Mock latency
    }
    
    formatDuration(timestamp) {
        const minutes = Math.floor((Date.now() - timestamp) / 60000);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    }
    
    formatTimeAgo(timestamp) {
        const minutes = Math.floor((Date.now() - timestamp) / 60000);
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }
    
    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    formatTotalTime() {
        const total = this.sessions.reduce((sum, s) => sum + (Date.now() - s.startedAt), 0);
        const hours = Math.floor(total / 3600000);
        return `${hours}h`;
    }
    
    copySessionCode() {
        const code = this.getSessionCode();
        navigator.clipboard.writeText(code);
        this.os.notify('Copied', 'Session code copied to clipboard', 'success');
    }
    
    copyConnectionLink() {
        const link = this.getConnectionLink();
        navigator.clipboard.writeText(link);
        this.os.notify('Copied', 'Connection link copied to clipboard', 'success');
    }
    
    toggleFullscreen() {
        const screen = document.getElementById('remote-screen');
        if (screen) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                screen.requestFullscreen();
            }
        }
    }
    
    showKeyboard() {
        alert('Virtual keyboard coming soon!');
    }
    
    // ==================== STYLES ====================
    
    addStyles() {
        if (document.getElementById('remote-desktop-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'remote-desktop-styles';
        style.textContent = `
            .remote-desktop-app {
                height: 100%;
                display: flex;
                flex-direction: column;
                padding: 16px;
            }
            
            .rd-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }
            
            .rd-title {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 20px;
            }
            
            .rd-icon {
                font-size: 24px;
            }
            
            .action-btn {
                padding: 8px 16px;
                margin-left: 8px;
                background: transparent;
                border: 1px solid var(--mica-border);
                border-radius: 6px;
                color: white;
                cursor: pointer;
            }
            
            .action-btn:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .action-btn.active {
                background: var(--accent);
                border-color: var(--accent);
            }
            
            .rd-tabs {
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
            
            .rd-content {
                flex: 1;
                overflow-y: auto;
                margin-bottom: 16px;
            }
            
            .rd-status {
                padding: 8px 12px;
                background: rgba(0,0,0,0.2);
                border-top: 1px solid var(--mica-border);
                display: flex;
                gap: 20px;
                font-size: 11px;
                opacity: 0.7;
            }
            
            .recording-indicator {
                color: #ff5252;
                animation: pulse 1s infinite;
            }
            
            /* Host View */
            .host-view {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                height: 100%;
            }
            
            .host-controls {
                padding-right: 20px;
            }
            
            .host-controls h2 {
                font-size: 18px;
                margin-bottom: 8px;
            }
            
            .host-controls p {
                opacity: 0.7;
                margin-bottom: 20px;
            }
            
            .host-options {
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 20px;
            }
            
            .option-group {
                margin-bottom: 16px;
            }
            
            .option-group label {
                display: block;
                margin-bottom: 6px;
                font-size: 13px;
                font-weight: 500;
            }
            
            .option-group input,
            .option-group select {
                width: 100%;
                padding: 8px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 4px;
                color: white;
            }
            
            .checkbox-group {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .checkbox-label {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                font-size: 13px;
            }
            
            .start-hosting-btn,
            .stop-hosting-btn {
                width: 100%;
                padding: 12px;
                border: none;
                border-radius: 6px;
                color: white;
                cursor: pointer;
                font-size: 14px;
            }
            
            .start-hosting-btn {
                background: var(--accent);
            }
            
            .stop-hosting-btn {
                background: #ff5252;
            }
            
            .active-session-info {
                background: rgba(76, 175, 80, 0.1);
                border: 1px solid #4CAF50;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 20px;
            }
            
            .session-details {
                margin: 16px 0;
            }
            
            .detail-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 0;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            
            .detail-label {
                min-width: 120px;
                opacity: 0.7;
            }
            
            .detail-value.code {
                font-family: monospace;
                background: rgba(0,0,0,0.3);
                padding: 4px 8px;
                border-radius: 4px;
            }
            
            .copy-btn {
                padding: 4px 8px;
                background: transparent;
                border: 1px solid var(--mica-border);
                border-radius: 4px;
                color: white;
                cursor: pointer;
            }
            
            .connected-clients-list h4 {
                margin: 16px 0 8px;
            }
            
            .client-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px;
                background: rgba(255,255,255,0.05);
                border-radius: 6px;
                margin-bottom: 4px;
            }
            
            .client-icon {
                font-size: 16px;
            }
            
            .client-name {
                flex: 1;
                font-weight: 500;
            }
            
            .client-user {
                opacity: 0.7;
                font-size: 12px;
            }
            
            .client-time {
                font-size: 11px;
                opacity: 0.5;
            }
            
            .disconnect-client {
                padding: 4px 8px;
                background: #ff5252;
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
                font-size: 11px;
            }
            
            .active-session-preview h3 {
                margin-bottom: 12px;
            }
            
            .preview-screen {
                position: relative;
                width: 100%;
                height: 300px;
                background: #1a1a1a;
                border-radius: 8px;
                overflow: hidden;
            }
            
            .preview-screen video {
                width: 100%;
                height: 100%;
                object-fit: contain;
            }
            
            .preview-overlay {
                position: absolute;
                bottom: 10px;
                left: 10px;
                background: rgba(0,0,0,0.7);
                padding: 8px 12px;
                border-radius: 4px;
                display: flex;
                gap: 16px;
            }
            
            /* Client View */
            .remote-screen-container {
                height: 100%;
                display: flex;
                gap: 16px;
            }
            
            .remote-screen {
                flex: 1;
                position: relative;
                background: #1a1a1a;
                border-radius: 8px;
                overflow: hidden;
            }
            
            #remote-canvas {
                width: 100%;
                height: 100%;
                object-fit: contain;
            }
            
            .connect-prompt {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                width: 80%;
                max-width: 400px;
            }
            
            .connect-icon {
                font-size: 64px;
                margin-bottom: 20px;
            }
            
            .connect-input-group {
                display: flex;
                gap: 8px;
                margin: 20px 0;
            }
            
            .connect-input-group input {
                flex: 1;
                padding: 10px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 6px;
                color: white;
            }
            
            .connect-input-group button {
                padding: 10px 20px;
                background: var(--accent);
                border: none;
                border-radius: 6px;
                color: white;
                cursor: pointer;
            }
            
            .recent-sessions {
                text-align: left;
                margin-top: 30px;
            }
            
            .recent-sessions h4 {
                margin-bottom: 12px;
                opacity: 0.7;
            }
            
            .recent-session-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px;
                border-radius: 6px;
                cursor: pointer;
            }
            
            .recent-session-item:hover {
                background: rgba(255,255,255,0.05);
            }
            
            .remote-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                pointer-events: none;
            }
            
            .connection-info {
                position: absolute;
                top: 10px;
                left: 10px;
                background: rgba(0,0,0,0.7);
                padding: 8px 12px;
                border-radius: 4px;
                display: flex;
                gap: 16px;
                pointer-events: none;
            }
            
            .remote-controls {
                position: absolute;
                bottom: 10px;
                right: 10px;
                display: flex;
                gap: 8px;
                pointer-events: auto;
            }
            
            .ctrl-btn {
                padding: 8px 12px;
                background: rgba(0,0,0,0.7);
                border: 1px solid var(--mica-border);
                border-radius: 4px;
                color: white;
                cursor: pointer;
            }
            
            .ctrl-btn:hover {
                background: rgba(0,0,0,0.9);
            }
            
            .disconnect-btn {
                padding: 8px 12px;
                background: #ff5252;
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
            }
            
            .remote-cursors {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                pointer-events: none;
            }
            
            .remote-cursor {
                position: absolute;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                transform: translate(-50%, -50%);
                pointer-events: none;
                z-index: 1000;
            }
            
            .cursor-label {
                position: absolute;
                left: 15px;
                top: -15px;
                background: inherit;
                color: white;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 10px;
                white-space: nowrap;
            }
            
            .chat-sidebar {
                width: 250px;
                background: rgba(0,0,0,0.3);
                border-left: 1px solid var(--mica-border);
                display: flex;
                flex-direction: column;
            }
            
            .chat-sidebar.collapsed {
                display: none;
            }
            
            .chat-header {
                padding: 12px;
                border-bottom: 1px solid var(--mica-border);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .chat-header h4 {
                font-size: 14px;
            }
            
            .chat-header button {
                background: transparent;
                border: none;
                color: white;
                cursor: pointer;
            }
            
            .chat-messages {
                flex: 1;
                overflow-y: auto;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .chat-message {
                padding: 8px;
                background: rgba(255,255,255,0.05);
                border-radius: 6px;
                font-size: 12px;
            }
            
            .chat-message.own {
                background: rgba(var(--accent-rgb), 0.2);
                align-self: flex-end;
            }
            
            .message-user {
                font-weight: 500;
                margin-right: 6px;
            }
            
            .message-time {
                font-size: 9px;
                opacity: 0.5;
                margin-left: 6px;
            }
            
            .chat-input {
                padding: 12px;
                border-top: 1px solid var(--mica-border);
                display: flex;
                gap: 8px;
            }
            
            .chat-input input {
                flex: 1;
                padding: 6px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 4px;
                color: white;
            }
            
            .chat-input button {
                padding: 6px 12px;
                background: var(--accent);
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
            }
            
            /* Sessions View */
            .sessions-view h2 {
                font-size: 18px;
                margin-bottom: 16px;
            }
            
            .sessions-list {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                gap: 16px;
                margin-bottom: 30px;
            }
            
            .session-card {
                padding: 16px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
            }
            
            .session-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--mica-border);
            }
            
            .session-icon {
                font-size: 20px;
            }
            
            .session-name {
                flex: 1;
                font-weight: 500;
            }
            
            .session-status {
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 11px;
                text-transform: uppercase;
            }
            
            .session-status.active {
                background: rgba(76, 175, 80, 0.2);
                color: #4CAF50;
            }
            
            .session-status.waiting {
                background: rgba(255, 152, 0, 0.2);
                color: #FF9800;
            }
            
            .detail-row {
                display: flex;
                justify-content: space-between;
                padding: 4px 0;
                font-size: 12px;
            }
            
            .quality-high {
                color: #4CAF50;
            }
            
            .quality-medium {
                color: #FF9800;
            }
            
            .quality-low {
                color: #ff5252;
            }
            
            .session-actions {
                display: flex;
                gap: 8px;
                margin-top: 12px;
            }
            
            .join-btn,
            .info-btn {
                flex: 1;
                padding: 8px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            
            .join-btn {
                background: var(--accent);
                color: white;
            }
            
            .info-btn {
                background: transparent;
                border: 1px solid var(--mica-border);
                color: white;
            }
            
            .session-stats {
                padding: 20px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
            }
            
            .session-stats h3 {
                margin-bottom: 16px;
            }
            
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 16px;
                text-align: center;
            }
            
            .stat-value {
                display: block;
                font-size: 24px;
                font-weight: 300;
                margin-bottom: 4px;
            }
            
            .stat-label {
                font-size: 11px;
                opacity: 0.7;
            }
            
            /* Light theme */
            .light-theme .remote-desktop-app {
                color: black;
            }
            
            .light-theme .action-btn,
            .light-theme .tab-btn,
            .light-theme .option-group input,
            .light-theme .option-group select,
            .light-theme .copy-btn,
            .light-theme .connect-input-group input,
            .light-theme .ctrl-btn,
            .light-theme .chat-input input,
            .light-theme .info-btn {
                color: black;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        `;
        
        document.head.appendChild(style);
    }
}

window.RemoteDesktopApp = RemoteDesktopApp;
window.remoteDesktop = null; // Will be set when app is instantiated
