/**
 * Chat Application - Real-time messaging and collaboration
 */
class ChatApp {
    constructor(os, windowId) {
        this.os = os;
        this.windowId = windowId;
        this.currentConversation = null;
        this.conversations = [];
        this.messages = [];
        this.typingUsers = new Set();
        this.messageInput = null;
        this.messageList = null;
        this.autoScroll = true;
        this.userStatuses = new Map();
    }
    
    async render(container, options = {}) {
        this.container = container;
        
        if (options.conversationId) {
            await this.loadConversation(options.conversationId);
        }
        
        await this.loadConversations();
        await this.renderChat();
        this.setupEventListeners();
        this.startTypingDetection();
        this.addStyles();
    }
    
    async loadConversations() {
        // Get conversations from chat system
        if (this.os.modules.ChatSystem) {
            this.conversations = this.os.modules.ChatSystem.getConversations();
        } else {
            // Mock data for demo
            this.conversations = this.getMockConversations();
        }
    }
    
    getMockConversations() {
        return [
            {
                id: 'conv1',
                type: 'direct',
                name: 'John Doe',
                participants: [{ id: 'user2', name: 'John Doe', status: 'online' }],
                lastMessage: { content: 'Hey, how are you?', timestamp: Date.now() - 3600000 },
                unread: 2
            },
            {
                id: 'conv2',
                type: 'group',
                name: 'Team Chat',
                participants: [
                    { id: 'user2', name: 'John Doe' },
                    { id: 'user3', name: 'Jane Smith' },
                    { id: 'user4', name: 'Bob Johnson' }
                ],
                lastMessage: { content: 'Meeting at 3pm', timestamp: Date.now() - 7200000 },
                unread: 0
            },
            {
                id: 'conv3',
                type: 'direct',
                name: 'Jane Smith',
                participants: [{ id: 'user3', name: 'Jane Smith', status: 'away' }],
                lastMessage: { content: 'Thanks for the help!', timestamp: Date.now() - 86400000 },
                unread: 0
            }
        ];
    }
    
    async loadConversation(conversationId) {
        if (this.os.modules.ChatSystem) {
            this.messages = this.os.modules.ChatSystem.getMessages(conversationId, 50);
            this.currentConversation = this.conversations.find(c => c.id === conversationId);
        } else {
            // Mock data for demo
            this.messages = this.getMockMessages(conversationId);
            this.currentConversation = this.conversations.find(c => c.id === conversationId);
        }
    }
    
    getMockMessages(conversationId) {
        const now = Date.now();
        return [
            {
                id: 'msg1',
                sender: { id: 'user2', name: 'John Doe' },
                content: 'Hey, how are you?',
                timestamp: now - 3600000,
                read: true
            },
            {
                id: 'msg2',
                sender: { id: 'user1', name: 'Me' },
                content: 'I\'m good, thanks! How about you?',
                timestamp: now - 3500000,
                read: true
            },
            {
                id: 'msg3',
                sender: { id: 'user2', name: 'John Doe' },
                content: 'Doing great! Just working on some projects.',
                timestamp: now - 3400000,
                read: true
            },
            {
                id: 'msg4',
                sender: { id: 'user2', name: 'John Doe' },
                content: 'Want to collaborate on something?',
                timestamp: now - 3300000,
                read: false
            }
        ];
    }
    
    async renderChat() {
        this.container.innerHTML = `
            <div class="chat-app">
                <!-- Sidebar -->
                <div class="chat-sidebar">
                    <div class="sidebar-header">
                        <h3>Chats</h3>
                        <button class="new-chat-btn" onclick="chatApp.newChat()">➕</button>
                    </div>
                    
                    <div class="conversations-list" id="conversations-list">
                        ${this.renderConversations()}
                    </div>
                    
                    <div class="online-users">
                        <h4>Online</h4>
                        <div class="users-list">
                            ${this.renderOnlineUsers()}
                        </div>
                    </div>
                </div>
                
                <!-- Main Chat Area -->
                <div class="chat-main">
                    ${this.currentConversation ? this.renderChatArea() : this.renderWelcomeScreen()}
                </div>
            </div>
        `;
        
        if (this.currentConversation) {
            this.messageList = document.getElementById('chat-messages');
            this.messageInput = document.getElementById('message-input');
            this.scrollToBottom();
        }
    }
    
    renderConversations() {
        return this.conversations.map(conv => {
            const isActive = this.currentConversation?.id === conv.id;
            const lastMessage = conv.lastMessage?.content || '';
            const time = conv.lastMessage?.timestamp ? 
                this.formatTime(conv.lastMessage.timestamp) : '';
            
            return `
                <div class="conversation-item ${isActive ? 'active' : ''} ${conv.unread ? 'unread' : ''}"
                     onclick="chatApp.selectConversation('${conv.id}')">
                    <div class="conv-avatar">${this.getConversationAvatar(conv)}</div>
                    <div class="conv-info">
                        <div class="conv-name">${conv.name}</div>
                        <div class="conv-last">${this.truncate(lastMessage, 30)}</div>
                    </div>
                    <div class="conv-meta">
                        <div class="conv-time">${time}</div>
                        ${conv.unread ? `<div class="unread-badge">${conv.unread}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    renderOnlineUsers() {
        const users = this.getOnlineUsers();
        return users.map(user => `
            <div class="online-user-item">
                <div class="user-avatar-small">${user.avatar || '👤'}</div>
                <div class="user-name">${user.name}</div>
                <div class="user-status ${user.status}"></div>
            </div>
        `).join('');
    }
    
    renderChatArea() {
        return `
            <div class="chat-header">
                <div class="chat-info">
                    <div class="chat-avatar">${this.getConversationAvatar(this.currentConversation)}</div>
                    <div class="chat-details">
                        <h3>${this.currentConversation.name}</h3>
                        <div class="chat-participants">
                            ${this.renderParticipants()}
                        </div>
                    </div>
                </div>
                <div class="chat-actions">
                    <button class="action-btn" onclick="chatApp.showInfo()">ℹ️</button>
                    <button class="action-btn" onclick="chatApp.showFiles()">📁</button>
                    <button class="action-btn" onclick="chatApp.videoCall()">📹</button>
                </div>
            </div>
            
            <div class="chat-messages" id="chat-messages">
                ${this.renderMessages()}
                <div class="typing-indicator" id="typing-indicator" style="display: none;">
                    <span class="typing-dots">
                        <span>.</span><span>.</span><span>.</span>
                    </span>
                </div>
            </div>
            
            <div class="chat-input-area">
                <button class="emoji-btn" onclick="chatApp.showEmojiPicker()">😊</button>
                <button class="attach-btn" onclick="chatApp.attachFile()">📎</button>
                <input type="text" id="message-input" 
                       placeholder="Type a message..." 
                       onkeydown="chatApp.handleInputKey(event)">
                <button class="send-btn" onclick="chatApp.sendMessage()">Send</button>
            </div>
        `;
    }
    
    renderWelcomeScreen() {
        return `
            <div class="welcome-screen">
                <div class="welcome-icon">💬</div>
                <h2>Welcome to Chat</h2>
                <p>Select a conversation to start messaging</p>
                <button class="new-chat-large" onclick="chatApp.newChat()">
                    Start New Chat
                </button>
            </div>
        `;
    }
    
    renderMessages() {
        let lastDate = null;
        
        return this.messages.map(msg => {
            const isMe = msg.sender.id === 'user1'; // Current user
            const date = new Date(msg.timestamp).toLocaleDateString();
            
            let dateHeader = '';
            if (date !== lastDate) {
                dateHeader = `<div class="message-date">${date}</div>`;
                lastDate = date;
            }
            
            return `
                ${dateHeader}
                <div class="message ${isMe ? 'message-out' : 'message-in'}">
                    ${!isMe ? `<div class="message-sender">${msg.sender.name}</div>` : ''}
                    <div class="message-bubble">
                        <div class="message-content">${this.formatMessage(msg.content)}</div>
                        <div class="message-meta">
                            <span class="message-time">${this.formatTime(msg.timestamp)}</span>
                            ${isMe ? `<span class="message-status">${msg.read ? '✓✓' : '✓'}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    renderParticipants() {
        if (this.currentConversation.type === 'direct') {
            const participant = this.currentConversation.participants[0];
            return `
                <span class="participant-status ${participant.status || 'offline'}"></span>
                <span>${participant.status || 'Offline'}</span>
            `;
        } else {
            return `${this.currentConversation.participants.length} participants`;
        }
    }
    
    // ==================== EVENT HANDLERS ====================
    
    setupEventListeners() {
        // Listen for new messages
        this.os.modules.EventBus?.on('chat:message_received', (data) => {
            if (data.conversationId === this.currentConversation?.id) {
                this.messages.push(data.message);
                this.renderMessages();
                this.scrollToBottom();
            }
            this.loadConversations(); // Refresh sidebar
        });
        
        // Listen for typing indicators
        this.os.modules.EventBus?.on('chat:typing', (data) => {
            if (data.conversationId === this.currentConversation?.id) {
                if (data.isTyping) {
                    this.typingUsers.add(data.username);
                } else {
                    this.typingUsers.delete(data.username);
                }
                this.updateTypingIndicator();
            }
        });
        
        // Listen for presence updates
        this.os.modules.EventBus?.on('user:presence', (data) => {
            this.userStatuses.set(data.userId, data.status);
            this.renderChat(); // Refresh UI
        });
    }
    
    handleInputKey(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    }
    
    startTypingDetection() {
        let typingTimeout;
        
        if (this.messageInput) {
            this.messageInput.addEventListener('input', () => {
                if (this.currentConversation && this.os.modules.ChatSystem) {
                    this.os.modules.ChatSystem.sendTyping(this.currentConversation.id, true);
                    
                    clearTimeout(typingTimeout);
                    typingTimeout = setTimeout(() => {
                        if (this.os.modules.ChatSystem) {
                            this.os.modules.ChatSystem.sendTyping(this.currentConversation.id, false);
                        }
                    }, 3000);
                }
            });
        }
    }
    
    // ==================== MESSAGE ACTIONS ====================
    
    async sendMessage() {
        if (!this.messageInput || !this.messageInput.value.trim()) return;
        
        const content = this.messageInput.value.trim();
        this.messageInput.value = '';
        
        if (this.os.modules.ChatSystem) {
            await this.os.modules.ChatSystem.sendMessage(this.currentConversation.id, content);
        } else {
            // Mock sending
            const mockMessage = {
                id: 'msg' + Date.now(),
                sender: { id: 'user1', name: 'Me' },
                content: content,
                timestamp: Date.now(),
                read: false
            };
            this.messages.push(mockMessage);
            this.renderMessages();
            this.scrollToBottom();
        }
    }
    
    formatMessage(content) {
        // Simple formatting - links, emoji, etc.
        let formatted = content;
        
        // Convert URLs to links
        formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
        
        // Convert emoji shortcodes
        formatted = this.replaceEmoji(formatted);
        
        return formatted;
    }
    
    replaceEmoji(text) {
        const emojiMap = {
            ':)': '😊',
            ':(': '😞',
            ':D': '😃',
            ';)': '😉',
            ':P': '😛',
            '<3': '❤️',
            'lol': '😂',
            'omg': '😱'
        };
        
        let result = text;
        for (const [key, value] of Object.entries(emojiMap)) {
            result = result.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        }
        
        return result;
    }
    
    // ==================== CONVERSATION ACTIONS ====================
    
    async selectConversation(conversationId) {
        await this.loadConversation(conversationId);
        this.renderChat();
        
        if (this.os.modules.ChatSystem) {
            this.os.modules.ChatSystem.setCurrentConversation(conversationId);
        }
    }
    
    newChat() {
        const type = confirm('Start group chat?') ? 'group' : 'direct';
        
        if (type === 'direct') {
            const username = prompt('Enter username to chat with:');
            if (username) {
                // Create direct conversation
                const conversation = {
                    id: 'conv' + Date.now(),
                    type: 'direct',
                    name: username,
                    participants: [{ id: 'user2', name: username, status: 'offline' }],
                    lastMessage: null,
                    unread: 0
                };
                this.conversations.unshift(conversation);
                this.selectConversation(conversation.id);
            }
        } else {
            // Create group chat
            this.showGroupCreation();
        }
    }
    
    showGroupCreation() {
        alert('Group creation coming soon!');
    }
    
    showInfo() {
        alert('Conversation info coming soon!');
    }
    
    showFiles() {
        alert('Shared files coming soon!');
    }
    
    videoCall() {
        alert('Video calls coming soon!');
    }
    
    showEmojiPicker() {
        alert('Emoji picker coming soon!');
    }
    
    attachFile() {
        alert('File attachment coming soon!');
    }
    
    // ==================== UTILITY METHODS ====================
    
    getConversationAvatar(conv) {
        if (conv.type === 'direct') {
            return conv.participants[0]?.avatar || '👤';
        }
        return '👥';
    }
    
    getOnlineUsers() {
        const users = [];
        this.conversations.forEach(conv => {
            conv.participants.forEach(p => {
                if (!users.find(u => u.id === p.id)) {
                    users.push({
                        id: p.id,
                        name: p.name,
                        avatar: p.avatar,
                        status: p.status || 'offline'
                    });
                }
            });
        });
        return users.filter(u => u.status === 'online' || u.status === 'away');
    }
    
    updateTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (!indicator) return;
        
        if (this.typingUsers.size > 0) {
            const users = Array.from(this.typingUsers);
            if (users.length === 1) {
                indicator.innerHTML = `${users[0]} is typing...`;
            } else if (users.length === 2) {
                indicator.innerHTML = `${users[0]} and ${users[1]} are typing...`;
            } else {
                indicator.innerHTML = 'Several people are typing...';
            }
            indicator.style.display = 'flex';
        } else {
            indicator.style.display = 'none';
        }
    }
    
    scrollToBottom() {
        if (this.messageList && this.autoScroll) {
            this.messageList.scrollTop = this.messageList.scrollHeight;
        }
    }
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    }
    
    truncate(str, length) {
        if (str.length <= length) return str;
        return str.substr(0, length) + '...';
    }
    
    // ==================== STYLES ====================
    
    addStyles() {
        if (document.getElementById('chat-app-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'chat-app-styles';
        style.textContent = `
            .chat-app {
                height: 100%;
                display: flex;
                background: rgba(0,0,0,0.2);
            }
            
            /* Sidebar */
            .chat-sidebar {
                width: 280px;
                border-right: 1px solid var(--mica-border);
                display: flex;
                flex-direction: column;
                background: rgba(0,0,0,0.3);
            }
            
            .sidebar-header {
                padding: 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid var(--mica-border);
            }
            
            .sidebar-header h3 {
                font-size: 16px;
                font-weight: 500;
            }
            
            .new-chat-btn {
                width: 32px;
                height: 32px;
                border-radius: 6px;
                background: transparent;
                border: 1px solid var(--mica-border);
                color: white;
                cursor: pointer;
            }
            
            .new-chat-btn:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .conversations-list {
                flex: 1;
                overflow-y: auto;
                padding: 8px;
            }
            
            .conversation-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                border-radius: 8px;
                cursor: pointer;
                transition: 0.2s;
                margin-bottom: 4px;
            }
            
            .conversation-item:hover {
                background: rgba(255,255,255,0.05);
            }
            
            .conversation-item.active {
                background: rgba(var(--accent-rgb), 0.2);
            }
            
            .conversation-item.unread {
                background: rgba(76, 175, 80, 0.1);
            }
            
            .conv-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: var(--accent);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
            }
            
            .conv-info {
                flex: 1;
                min-width: 0;
            }
            
            .conv-name {
                font-size: 14px;
                font-weight: 500;
                margin-bottom: 2px;
            }
            
            .conv-last {
                font-size: 11px;
                opacity: 0.6;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .conv-meta {
                text-align: right;
            }
            
            .conv-time {
                font-size: 10px;
                opacity: 0.5;
                margin-bottom: 2px;
            }
            
            .unread-badge {
                background: var(--accent);
                color: white;
                font-size: 10px;
                min-width: 18px;
                height: 18px;
                border-radius: 9px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-left: auto;
            }
            
            .online-users {
                padding: 16px;
                border-top: 1px solid var(--mica-border);
            }
            
            .online-users h4 {
                font-size: 12px;
                opacity: 0.7;
                margin-bottom: 8px;
            }
            
            .online-user-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px;
                border-radius: 4px;
            }
            
            .user-avatar-small {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: var(--accent);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
            }
            
            .user-name {
                flex: 1;
                font-size: 12px;
            }
            
            .user-status {
                width: 8px;
                height: 8px;
                border-radius: 50%;
            }
            
            .user-status.online { background: #4CAF50; }
            .user-status.away { background: #FF9800; }
            .user-status.busy { background: #FF5252; }
            
            /* Main Chat Area */
            .chat-main {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            
            .chat-header {
                padding: 16px;
                border-bottom: 1px solid var(--mica-border);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .chat-info {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .chat-avatar {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: var(--accent);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
            }
            
            .chat-details h3 {
                font-size: 18px;
                margin-bottom: 4px;
            }
            
            .chat-participants {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                opacity: 0.7;
            }
            
            .participant-status {
                width: 8px;
                height: 8px;
                border-radius: 50%;
            }
            
            .participant-status.online { background: #4CAF50; }
            .participant-status.away { background: #FF9800; }
            .participant-status.busy { background: #FF5252; }
            
            .chat-actions {
                display: flex;
                gap: 8px;
            }
            
            .action-btn {
                padding: 8px;
                background: transparent;
                border: 1px solid var(--mica-border);
                border-radius: 6px;
                color: white;
                cursor: pointer;
            }
            
            .action-btn:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .chat-messages {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .message-date {
                text-align: center;
                font-size: 11px;
                opacity: 0.5;
                margin: 16px 0 8px;
            }
            
            .message {
                display: flex;
                flex-direction: column;
                max-width: 70%;
            }
            
            .message-out {
                align-self: flex-end;
            }
            
            .message-in {
                align-self: flex-start;
            }
            
            .message-sender {
                font-size: 11px;
                opacity: 0.7;
                margin-bottom: 2px;
                margin-left: 8px;
            }
            
            .message-bubble {
                padding: 10px 14px;
                border-radius: 18px;
                position: relative;
            }
            
            .message-out .message-bubble {
                background: var(--accent);
                color: white;
                border-bottom-right-radius: 4px;
            }
            
            .message-in .message-bubble {
                background: rgba(255,255,255,0.1);
                border-bottom-left-radius: 4px;
            }
            
            .message-content {
                font-size: 13px;
                line-height: 1.4;
                word-wrap: break-word;
            }
            
            .message-content a {
                color: inherit;
                opacity: 0.9;
            }
            
            .message-meta {
                display: flex;
                align-items: center;
                gap: 4px;
                margin-top: 2px;
                font-size: 10px;
                opacity: 0.7;
                justify-content: flex-end;
            }
            
            .typing-indicator {
                padding: 8px 12px;
                font-size: 12px;
                opacity: 0.7;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .typing-dots span {
                animation: typing 1.4s infinite;
                opacity: 0;
            }
            
            .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
            .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
            
            @keyframes typing {
                0%, 60%, 100% { opacity: 0; }
                30% { opacity: 1; }
            }
            
            .chat-input-area {
                padding: 16px;
                border-top: 1px solid var(--mica-border);
                display: flex;
                gap: 8px;
                align-items: center;
            }
            
            .emoji-btn,
            .attach-btn {
                padding: 8px;
                background: transparent;
                border: 1px solid var(--mica-border);
                border-radius: 6px;
                color: white;
                cursor: pointer;
            }
            
            .chat-input-area input {
                flex: 1;
                padding: 10px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 20px;
                color: white;
                font-size: 14px;
            }
            
            .chat-input-area input:focus {
                outline: none;
                border-color: var(--accent);
            }
            
            .send-btn {
                padding: 8px 16px;
                background: var(--accent);
                border: none;
                border-radius: 6px;
                color: white;
                cursor: pointer;
            }
            
            .welcome-screen {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: 40px;
            }
            
            .welcome-icon {
                font-size: 64px;
                margin-bottom: 20px;
            }
            
            .new-chat-large {
                margin-top: 20px;
                padding: 12px 24px;
                background: var(--accent);
                border: none;
                border-radius: 8px;
                color: white;
                cursor: pointer;
            }
            
            /* Light theme */
            .light-theme .chat-app {
                color: black;
            }
            
            .light-theme .new-chat-btn,
            .light-theme .action-btn,
            .light-theme .emoji-btn,
            .light-theme .attach-btn,
            .light-theme .chat-input-area input {
                color: black;
            }
            
            .light-theme .message-in .message-bubble {
                background: #e9e9e9;
                color: black;
            }
        `;
        
        document.head.appendChild(style);
    }
}

window.ChatApp = ChatApp;
window.chatApp = null; // Will be set when app is instantiated
