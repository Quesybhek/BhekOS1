/**
 * BhekOS Collaboration System - Real-time collaboration features
 */
const Collaboration = {
    os: null,
    
    // Connection status
    connected: false,
    connectionId: null,
    
    // Room/Channel management
    rooms: new Map(),
    currentRoom: null,
    
    // Active users
    activeUsers: new Map(),
    
    // Session data
    session: {
        id: null,
        started: null,
        activities: []
    },
    
    // Collaboration settings
    settings: {
        enabled: true,
        serverUrl: 'wss://collab.bhekos.local',
        autoConnect: true,
        presenceEnabled: true,
        showTyping: true,
        showCursors: true,
        showEdits: true,
        allowRemoteControl: false,
        maxParticipants: 10,
        heartbeatInterval: 30000,
        reconnectAttempts: 5,
        reconnectDelay: 1000
    },
    
    // Room settings
    roomSettings: {
        allowChat: true,
        allowScreenShare: true,
        allowFileShare: true,
        allowWhiteboard: true,
        allowAnnotations: true,
        allowRemoteControl: false,
        requireApproval: true,
        recording: false,
        muteOnEntry: true
    },
    
    // WebSocket connection
    ws: null,
    reconnectAttempts: 0,
    heartbeatTimer: null,
    
    // Event handlers
    handlers: new Map(),
    
    async init(os) {
        this.os = os;
        console.log('Collaboration System initializing...');
        
        await this.loadSettings();
        this.setupListeners();
        this.registerHandlers();
        
        if (this.settings.autoConnect && this.settings.enabled) {
            this.connect();
        }
        
        console.log('Collaboration System ready');
        return this;
    },
    
    async loadSettings() {
        const saved = await this.os.modules.Storage.get('collab_settings', {});
        this.settings = { ...this.settings, ...saved };
    },
    
    async saveSettings() {
        await this.os.modules.Storage.set('collab_settings', this.settings);
    },
    
    setupListeners() {
        // Listen for user presence changes
        this.os.modules.EventBus.on('user:login', (data) => {
            this.broadcastPresence('online');
        });
        
        this.os.modules.EventBus.on('user:logout', () => {
            this.broadcastPresence('offline');
        });
        
        this.os.modules.EventBus.on('user:presence', (data) => {
            this.updateUserPresence(data.userId, data.status);
        });
        
        // Listen for window events to broadcast
        this.os.modules.EventBus.on('window:created', (data) => {
            if (this.currentRoom) {
                this.broadcast('window_created', {
                    windowId: data.windowId,
                    app: data.app,
                    room: this.currentRoom
                });
            }
        });
        
        this.os.modules.EventBus.on('window:closed', (data) => {
            if (this.currentRoom) {
                this.broadcast('window_closed', {
                    windowId: data.windowId,
                    room: this.currentRoom
                });
            }
        });
    },
    
    registerHandlers() {
        this.handlers.set('presence', this.handlePresence.bind(this));
        this.handlers.set('message', this.handleMessage.bind(this));
        this.handlers.set('cursor', this.handleCursor.bind(this));
        this.handlers.set('typing', this.handleTyping.bind(this));
        this.handlers.set('edit', this.handleEdit.bind(this));
        this.handlers.set('annotation', this.handleAnnotation.bind(this));
        this.handlers.set('screen_share', this.handleScreenShare.bind(this));
        this.handlers.set('file_share', this.handleFileShare.bind(this));
        this.handlers.set('room_join', this.handleRoomJoin.bind(this));
        this.handlers.set('room_leave', this.handleRoomLeave.bind(this));
        this.handlers.set('remote_control', this.handleRemoteControl.bind(this));
    },
    
    // ==================== CONNECTION MANAGEMENT ====================
    
    connect() {
        if (!this.settings.enabled) return;
        
        const wsUrl = this.buildWebSocketUrl();
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('Collaboration WebSocket connected');
            this.connected = true;
            this.connectionId = BhekHelpers.generateUUID();
            this.reconnectAttempts = 0;
            
            // Send initial presence
            this.sendPresence();
            
            // Start heartbeat
            this.startHeartbeat();
            
            this.os.modules.EventBus.emit('collab:connected', {
                connectionId: this.connectionId
            });
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('Failed to parse message:', error);
            }
        };
        
        this.ws.onclose = () => {
            console.log('Collaboration WebSocket disconnected');
            this.connected = false;
            this.connectionId = null;
            this.stopHeartbeat();
            
            this.os.modules.EventBus.emit('collab:disconnected');
            
            // Attempt reconnect
            if (this.reconnectAttempts < this.settings.reconnectAttempts) {
                this.reconnectAttempts++;
                const delay = this.settings.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
                setTimeout(() => this.connect(), delay);
            }
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.os.modules.EventBus.emit('collab:error', error);
        };
    },
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        this.connectionId = null;
        this.activeUsers.clear();
    },
    
    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.connected) {
                this.send({
                    type: 'heartbeat',
                    timestamp: Date.now()
                });
            }
        }, this.settings.heartbeatInterval);
    },
    
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    },
    
    buildWebSocketUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        return `${protocol}//${host}/collab`;
    },
    
    // ==================== MESSAGE HANDLING ====================
    
    send(data) {
        if (!this.connected || !this.ws) return;
        
        const message = {
            ...data,
            connectionId: this.connectionId,
            userId: this.os.modules.UserManager?.getCurrentUser()?.id,
            username: this.os.modules.UserManager?.getCurrentUser()?.username,
            timestamp: Date.now()
        };
        
        this.ws.send(JSON.stringify(message));
    },
    
    broadcast(type, data) {
        this.send({
            type,
            room: this.currentRoom,
            ...data
        });
    },
    
    handleMessage(message) {
        // Route to appropriate handler
        const handler = this.handlers.get(message.type);
        if (handler) {
            handler(message);
        }
        
        // Emit event for other modules
        this.os.modules.EventBus.emit(`collab:${message.type}`, message);
    },
    
    // ==================== PRESENCE HANDLING ====================
    
    sendPresence() {
        const user = this.os.modules.UserManager?.getCurrentUser();
        if (!user) return;
        
        this.broadcast('presence', {
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                avatar: user.avatar,
                color: this.os.modules.UserManager?.getUserColor(user.username)
            },
            status: user.presence || 'online',
            rooms: Array.from(this.rooms.keys())
        });
    },
    
    handlePresence(data) {
        const { userId, username, status, rooms } = data;
        
        // Update active users
        this.activeUsers.set(userId, {
            id: userId,
            username: data.user?.username || username,
            name: data.user?.name,
            avatar: data.user?.avatar,
            color: data.user?.color,
            status,
            rooms,
            lastSeen: data.timestamp
        });
        
        this.os.modules.EventBus.emit('collab:user_presence', {
            userId,
            status,
            user: data.user
        });
    },
    
    updateUserPresence(userId, status) {
        if (!this.connected) return;
        
        const user = this.activeUsers.get(userId);
        if (user) {
            user.status = status;
            user.lastSeen = Date.now();
            
            this.broadcast('presence_update', {
                userId,
                status
            });
        }
    },
    
    // ==================== ROOM MANAGEMENT ====================
    
    createRoom(name, options = {}) {
        const roomId = 'room_' + BhekHelpers.generateId();
        const room = {
            id: roomId,
            name,
            createdBy: this.os.modules.UserManager?.getCurrentUser()?.id,
            created: Date.now(),
            participants: new Map(),
            settings: { ...this.roomSettings, ...options },
            activities: []
        };
        
        this.rooms.set(roomId, room);
        
        this.broadcast('room_created', {
            roomId,
            name,
            createdBy: room.createdBy,
            settings: room.settings
        });
        
        return roomId;
    },
    
    joinRoom(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) throw new Error('Room not found');
        
        const user = this.os.modules.UserManager?.getCurrentUser();
        if (!user) throw new Error('Not logged in');
        
        // Check if room is full
        if (room.participants.size >= room.settings.maxParticipants) {
            throw new Error('Room is full');
        }
        
        // Add user to room
        room.participants.set(user.id, {
            id: user.id,
            username: user.username,
            name: user.name,
            joined: Date.now(),
            permissions: this.getRoomPermissions(user, room)
        });
        
        this.currentRoom = roomId;
        
        this.broadcast('room_joined', {
            roomId,
            user: {
                id: user.id,
                username: user.username,
                name: user.name
            }
        });
        
        return room;
    },
    
    leaveRoom(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        
        const user = this.os.modules.UserManager?.getCurrentUser();
        if (!user) return;
        
        room.participants.delete(user.id);
        
        if (this.currentRoom === roomId) {
            this.currentRoom = null;
        }
        
        this.broadcast('room_left', {
            roomId,
            userId: user.id
        });
        
        // Delete room if empty
        if (room.participants.size === 0) {
            this.rooms.delete(roomId);
            this.broadcast('room_deleted', { roomId });
        }
    },
    
    getRoomPermissions(user, room) {
        // Calculate user permissions for room
        const permissions = [];
        
        if (user.id === room.createdBy) {
            permissions.push('admin', 'moderate', 'share', 'record');
        }
        
        if (room.settings.allowChat) permissions.push('chat');
        if (room.settings.allowScreenShare) permissions.push('screen_share');
        if (room.settings.allowFileShare) permissions.push('file_share');
        if (room.settings.allowWhiteboard) permissions.push('whiteboard');
        if (room.settings.allowAnnotations) permissions.push('annotate');
        if (room.settings.allowRemoteControl) permissions.push('remote_control');
        
        return permissions;
    },
    
    handleRoomJoin(data) {
        const { roomId, user } = data;
        const room = this.rooms.get(roomId);
        
        if (room) {
            room.participants.set(user.id, {
                ...user,
                joined: data.timestamp
            });
            
            this.os.modules.EventBus.emit('collab:user_joined', {
                roomId,
                user
            });
        }
    },
    
    handleRoomLeave(data) {
        const { roomId, userId } = data;
        const room = this.rooms.get(roomId);
        
        if (room) {
            room.participants.delete(userId);
            
            this.os.modules.EventBus.emit('collab:user_left', {
                roomId,
                userId
            });
        }
    },
    
    // ==================== REAL-TIME COLLABORATION ====================
    
    sendCursor(position, target = null) {
        if (!this.settings.showCursors) return;
        
        this.broadcast('cursor', {
            position,
            target
        });
    },
    
    handleCursor(data) {
        const { userId, username, position, target } = data;
        
        this.os.modules.EventBus.emit('collab:cursor', {
            userId,
            username,
            position,
            target
        });
    },
    
    sendTyping(isTyping, target = null) {
        if (!this.settings.showTyping) return;
        
        this.broadcast('typing', {
            isTyping,
            target
        });
    },
    
    handleTyping(data) {
        const { userId, username, isTyping, target } = data;
        
        this.os.modules.EventBus.emit('collab:typing', {
            userId,
            username,
            isTyping,
            target
        });
    },
    
    sendEdit(path, content, operation) {
        if (!this.settings.showEdits) return;
        
        this.broadcast('edit', {
            path,
            content,
            operation
        });
    },
    
    handleEdit(data) {
        const { userId, username, path, content, operation } = data;
        
        this.os.modules.EventBus.emit('collab:edit', {
            userId,
            username,
            path,
            content,
            operation
        });
    },
    
    sendAnnotation(path, annotation) {
        this.broadcast('annotation', {
            path,
            annotation
        });
    },
    
    handleAnnotation(data) {
        const { userId, username, path, annotation } = data;
        
        this.os.modules.EventBus.emit('collab:annotation', {
            userId,
            username,
            path,
            annotation
        });
    },
    
    // ==================== SCREEN SHARE ====================
    
    async startScreenShare(options = {}) {
        if (!this.currentRoom) throw new Error('Not in a room');
        
        const room = this.rooms.get(this.currentRoom);
        if (!room.settings.allowScreenShare) throw new Error('Screen sharing not allowed');
        
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: options.includeAudio
            });
            
            this.broadcast('screen_share', {
                action: 'start',
                streamId: stream.id,
                options
            });
            
            return stream;
        } catch (error) {
            console.error('Screen share failed:', error);
            throw error;
        }
    },
    
    stopScreenShare() {
        this.broadcast('screen_share', {
            action: 'stop'
        });
    },
    
    handleScreenShare(data) {
        const { userId, username, action, streamId, options } = data;
        
        this.os.modules.EventBus.emit('collab:screen_share', {
            userId,
            username,
            action,
            streamId,
            options
        });
    },
    
    // ==================== FILE SHARE ====================
    
    async shareFile(file) {
        if (!this.currentRoom) throw new Error('Not in a room');
        
        const room = this.rooms.get(this.currentRoom);
        if (!room.settings.allowFileShare) throw new Error('File sharing not allowed');
        
        // Convert file to base64
        const reader = new FileReader();
        const base64 = await new Promise((resolve) => {
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
        
        const fileInfo = {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
        };
        
        this.broadcast('file_share', {
            action: 'share',
            file: fileInfo,
            data: base64
        });
        
        return fileInfo;
    },
    
    handleFileShare(data) {
        const { userId, username, action, file, data: fileData } = data;
        
        this.os.modules.EventBus.emit('collab:file_share', {
            userId,
            username,
            action,
            file,
            data: fileData
        });
    },
    
    // ==================== REMOTE CONTROL ====================
    
    async requestRemoteControl(targetUserId) {
        if (!this.currentRoom) throw new Error('Not in a room');
        
        const room = this.rooms.get(this.currentRoom);
        if (!room.settings.allowRemoteControl) throw new Error('Remote control not allowed');
        
        this.broadcast('remote_control', {
            action: 'request',
            target: targetUserId
        });
    },
    
    acceptRemoteControl(requestUserId) {
        this.broadcast('remote_control', {
            action: 'accept',
            target: requestUserId
        });
    },
    
    denyRemoteControl(requestUserId) {
        this.broadcast('remote_control', {
            action: 'deny',
            target: requestUserId
        });
    },
    
    stopRemoteControl() {
        this.broadcast('remote_control', {
            action: 'stop'
        });
    },
    
    sendRemoteControlEvent(event) {
        this.broadcast('remote_control', {
            action: 'event',
            event: {
                type: event.type,
                key: event.key,
                button: event.button,
                x: event.x,
                y: event.y,
                delta: event.delta
            }
        });
    },
    
    handleRemoteControl(data) {
        const { userId, username, action, target, event } = data;
        
        this.os.modules.EventBus.emit('collab:remote_control', {
            userId,
            username,
            action,
            target,
            event
        });
    },
    
    // ==================== ACTIVITY LOGGING ====================
    
    logActivity(type, data) {
        const activity = {
            id: BhekHelpers.generateId('act-'),
            type,
            userId: this.os.modules.UserManager?.getCurrentUser()?.id,
            timestamp: Date.now(),
            room: this.currentRoom,
            ...data
        };
        
        this.session.activities.push(activity);
        
        // Trim activities
        if (this.session.activities.length > 1000) {
            this.session.activities = this.session.activities.slice(-1000);
        }
        
        this.os.modules.EventBus.emit('collab:activity', activity);
    },
    
    // ==================== UTILITY METHODS ====================
    
    getActiveUsers(roomId = null) {
        if (roomId) {
            const room = this.rooms.get(roomId);
            return room ? Array.from(room.participants.values()) : [];
        }
        return Array.from(this.activeUsers.values());
    },
    
    getRooms() {
        return Array.from(this.rooms.values()).map(room => ({
            id: room.id,
            name: room.name,
            participantCount: room.participants.size,
            settings: room.settings,
            created: room.created
        }));
    },
    
    getCurrentRoom() {
        return this.currentRoom ? this.rooms.get(this.currentRoom) : null;
    },
    
    isConnected() {
        return this.connected;
    },
    
    getStatus() {
        return {
            connected: this.connected,
            connectionId: this.connectionId,
            currentRoom: this.currentRoom,
            activeUsers: this.activeUsers.size,
            rooms: this.rooms.size,
            settings: this.settings
        };
    },
    
    async updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        await this.saveSettings();
        
        if (this.settings.enabled && !this.connected) {
            this.connect();
        } else if (!this.settings.enabled && this.connected) {
            this.disconnect();
        }
    }
};

window.Collaboration = Collaboration;
