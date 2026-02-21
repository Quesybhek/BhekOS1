/**
 * BhekOS Chat System - Real-time messaging and chat
 */
const ChatSystem = {
    os: null,
    
    // Conversations
    conversations: new Map(),
    
    // Messages
    messages: new Map(),
    
    // Unread counts
    unread: new Map(),
    
    // Current conversation
    currentConversation: null,
    
    // Chat settings
    settings: {
        enabled: true,
        notifications: true,
        soundEnabled: true,
        showTyping: true,
        showReadReceipts: true,
        showOnlineStatus: true,
        messageHistory: 1000,
        autoSave: true,
        maxMessageLength: 5000,
        allowFileSharing: true,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowEmoji: true,
        allowMarkdown: true,
        allowCodeBlocks: true,
        allowMentions: true
    },
    
    // Emoji sets
    emojis: {
        smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇'],
        people: ['👋', '👍', '👎', '👏', '🙌', '👐', '🤝', '✌️', '🤞', '👌'],
        animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐸'],
        food: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒'],
        objects: ['💻', '📱', '⌨️', '🖥️', '📷', '🎥', '📞', '☎️', '📧', '✉️']
    },
    
    // Typing indicators
    typing: new Map(),
    
    async init(os) {
        this.os = os;
        console.log('Chat System initializing...');
        
        await this.loadSettings();
        await this.loadConversations();
        this.setupListeners();
        
        console.log('Chat System ready');
        return this;
    },
    
    async loadSettings() {
        const saved = await this.os.modules.Storage.get('chat_settings', {});
        this.settings = { ...this.settings, ...saved };
    },
    
    async saveSettings() {
        await this.os.modules.Storage.set('chat_settings', this.settings);
    },
    
    async loadConversations() {
        const saved = await this.os.modules.Storage.get('chat_conversations', []);
        
        saved.forEach(conv => {
            this.conversations.set(conv.id, conv);
        });
        
        const savedMessages = await this.os.modules.Storage.get('chat_messages', []);
        savedMessages.forEach(msg => {
            if (!this.messages.has(msg.conversationId)) {
                this.messages.set(msg.conversationId, []);
            }
            this.messages.get(msg.conversationId).push(msg);
        });
    },
    
    async saveConversations() {
        const conversations = Array.from(this.conversations.values());
        await this.os.modules.Storage.set('chat_conversations', conversations);
    },
    
    async saveMessages() {
        const allMessages = [];
        this.messages.forEach(msgs => {
            allMessages.push(...msgs);
        });
        await this.os.modules.Storage.set('chat_messages', allMessages.slice(-1000));
    },
    
    setupListeners() {
        // Listen for collaboration messages
        this.os.modules.EventBus.on('collab:message', (data) => {
            this.handleIncomingMessage(data);
        });
        
        this.os.modules.EventBus.on('collab:typing', (data) => {
            this.handleTypingIndicator(data);
        });
        
        this.os.modules.EventBus.on('collab:user_presence', (data) => {
            this.updateUserPresence(data.userId, data.status);
        });
    },
    
    // ==================== CONVERSATION MANAGEMENT ====================
    
    createConversation(participants, options = {}) {
        const id = 'conv_' + BhekHelpers.generateId();
        const currentUser = this.os.modules.UserManager?.getCurrentUser();
        
        const conversation = {
            id,
            type: participants.length === 2 ? 'direct' : 'group',
            name: options.name || this.generateConversationName(participants),
            participants: participants.map(p => ({
                id: p.id || p,
                username: p.username || p,
                name: p.name || p,
                role: p.id === currentUser?.id ? 'owner' : 'member',
                joined: Date.now()
            })),
            createdBy: currentUser?.id,
            createdAt: Date.now(),
            lastMessage: null,
            lastActivity: Date.now(),
            unread: 0,
            settings: {
                muted: false,
                pinned: false,
                archived: false,
                ...options.settings
            },
            metadata: options.metadata || {}
        };
        
        this.conversations.set(id, conversation);
        this.messages.set(id, []);
        this.unread.set(id, 0);
        
        this.saveConversations();
        
        this.os.modules.EventBus.emit('chat:conversation_created', {
            conversationId: id,
            conversation
        });
        
        return conversation;
    },
    
    getConversation(conversationId) {
        return this.conversations.get(conversationId);
    },
    
    getConversations() {
        const currentUser = this.os.modules.UserManager?.getCurrentUser();
        if (!currentUser) return [];
        
        return Array.from(this.conversations.values())
            .filter(conv => conv.participants.some(p => p.id === currentUser.id))
            .sort((a, b) => b.lastActivity - a.lastActivity);
    },
    
    getUnreadCount(conversationId = null) {
        if (conversationId) {
            return this.unread.get(conversationId) || 0;
        }
        
        let total = 0;
        this.unread.forEach(count => total += count);
        return total;
    },
    
    markAsRead(conversationId) {
        this.unread.set(conversationId, 0);
        
        const conversation = this.conversations.get(conversationId);
        if (conversation) {
            conversation.unread = 0;
        }
        
        this.os.modules.EventBus.emit('chat:read', { conversationId });
    },
    
    archiveConversation(conversationId) {
        const conversation = this.conversations.get(conversationId);
        if (conversation) {
            conversation.settings.archived = true;
            this.saveConversations();
            
            this.os.modules.EventBus.emit('chat:archived', { conversationId });
        }
    },
    
    deleteConversation(conversationId) {
        this.conversations.delete(conversationId);
        this.messages.delete(conversationId);
        this.unread.delete(conversationId);
        
        this.saveConversations();
        this.saveMessages();
        
        if (this.currentConversation === conversationId) {
            this.currentConversation = null;
        }
        
        this.os.modules.EventBus.emit('chat:deleted', { conversationId });
    },
    
    generateConversationName(participants) {
        const names = participants.map(p => p.name || p.username || p);
        return names.join(', ');
    },
    
    // ==================== MESSAGE MANAGEMENT ====================
    
    async sendMessage(conversationId, content, options = {}) {
        const conversation = this.conversations.get(conversationId);
        if (!conversation) throw new Error('Conversation not found');
        
        const currentUser = this.os.modules.UserManager?.getCurrentUser();
        if (!currentUser) throw new Error('Not logged in');
        
        // Check message length
        if (content.length > this.settings.maxMessageLength) {
            throw new Error(`Message too long (max ${this.settings.maxMessageLength} characters)`);
        }
        
        // Process content
        const processed = this.processMessage(content, options);
        
        const message = {
            id: 'msg_' + BhekHelpers.generateId(),
            conversationId,
            sender: {
                id: currentUser.id,
                username: currentUser.username,
                name: currentUser.name,
                avatar: currentUser.avatar
            },
            content: processed,
            type: options.type || 'text',
            attachments: options.attachments || [],
            mentions: this.extractMentions(content),
            reactions: [],
            timestamp: Date.now(),
            edited: null,
            deleted: false,
            read: []
        };
        
        // Add to messages
        if (!this.messages.has(conversationId)) {
            this.messages.set(conversationId, []);
        }
        this.messages.get(conversationId).push(message);
        
        // Update conversation
        conversation.lastMessage = {
            id: message.id,
            content: this.getPreview(content),
            sender: message.sender.username,
            timestamp: message.timestamp
        };
        conversation.lastActivity = message.timestamp;
        
        // Trim messages
        const messages = this.messages.get(conversationId);
        if (messages.length > this.settings.messageHistory) {
            this.messages.set(conversationId, messages.slice(-this.settings.messageHistory));
        }
        
        this.saveConversations();
        if (this.settings.autoSave) {
            this.saveMessages();
        }
        
        // Broadcast via collaboration
        if (this.os.modules.Collaboration) {
            this.os.modules.Collaboration.broadcast('message', {
                conversationId,
                message
            });
        }
        
        this.os.modules.EventBus.emit('chat:message_sent', {
            conversationId,
            message
        });
        
        return message;
    },
    
    async sendFileMessage(conversationId, file) {
        if (!this.settings.allowFileSharing) {
            throw new Error('File sharing is disabled');
        }
        
        if (file.size > this.settings.maxFileSize) {
            throw new Error(`File too large (max ${this.formatBytes(this.settings.maxFileSize)})`);
        }
        
        // Convert file to base64 for storage
        const reader = new FileReader();
        const base64 = await new Promise((resolve) => {
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
        
        return this.sendMessage(conversationId, null, {
            type: 'file',
            attachments: [{
                name: file.name,
                size: file.size,
                type: file.type,
                data: base64
            }]
        });
    },
    
    async editMessage(conversationId, messageId, newContent) {
        const messages = this.messages.get(conversationId);
        if (!messages) throw new Error('Conversation not found');
        
        const message = messages.find(m => m.id === messageId);
        if (!message) throw new Error('Message not found');
        
        const currentUser = this.os.modules.UserManager?.getCurrentUser();
        if (message.sender.id !== currentUser?.id) {
            throw new Error('Cannot edit another user\'s message');
        }
        
        message.content = this.processMessage(newContent);
        message.edited = Date.now();
        
        if (this.settings.autoSave) {
            this.saveMessages();
        }
        
        this.os.modules.EventBus.emit('chat:message_edited', {
            conversationId,
            messageId,
            newContent
        });
        
        return message;
    },
    
    async deleteMessage(conversationId, messageId) {
        const messages = this.messages.get(conversationId);
        if (!messages) throw new Error('Conversation not found');
        
        const message = messages.find(m => m.id === messageId);
        if (!message) throw new Error('Message not found');
        
        const currentUser = this.os.modules.UserManager?.getCurrentUser();
        if (message.sender.id !== currentUser?.id) {
            throw new Error('Cannot delete another user\'s message');
        }
        
        message.deleted = true;
        message.content = '[deleted]';
        
        if (this.settings.autoSave) {
            this.saveMessages();
        }
        
        this.os.modules.EventBus.emit('chat:message_deleted', {
            conversationId,
            messageId
        });
    },
    
    async reactToMessage(conversationId, messageId, emoji) {
        const messages = this.messages.get(conversationId);
        if (!messages) throw new Error('Conversation not found');
        
        const message = messages.find(m => m.id === messageId);
        if (!message) throw new Error('Message not found');
        
        const currentUser = this.os.modules.UserManager?.GetCurrentUser();
        const existingReaction = message.reactions.find(r => 
            r.emoji === emoji && r.userId === currentUser?.id
        );
        
        if (existingReaction) {
            // Remove reaction
            message.reactions = message.reactions.filter(r => 
                !(r.emoji === emoji && r.userId === currentUser?.id)
            );
        } else {
            // Add reaction
            message.reactions.push({
                emoji,
                userId: currentUser?.id,
                username: currentUser?.username,
                timestamp: Date.now()
            });
        }
        
        if (this.settings.autoSave) {
            this.saveMessages();
        }
        
        this.os.modules.EventBus.emit('chat:reaction', {
            conversationId,
            messageId,
            emoji,
            userId: currentUser?.id,
            action: existingReaction ? 'removed' : 'added'
        });
    },
    
    getMessages(conversationId, limit = 50, before = null) {
        const messages = this.messages.get(conversationId) || [];
        
        let filtered = [...messages];
        if (before) {
            filtered = filtered.filter(m => m.timestamp < before);
        }
        
        return filtered
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    },
    
    searchMessages(query, options = {}) {
        const results = [];
        const queryLower = query.toLowerCase();
        
        this.messages.forEach((messages, conversationId) => {
            messages.forEach(message => {
                if (message.deleted) return;
                
                const content = typeof message.content === 'string' 
                    ? message.content.toLowerCase() 
                    : '';
                
                if (content.includes(queryLower)) {
                    results.push({
                        ...message,
                        conversationId,
                        highlight: this.getHighlight(message.content, query)
                    });
                }
            });
        });
        
        return results.sort((a, b) => b.timestamp - a.timestamp);
    },
    
    // ==================== MESSAGE PROCESSING ====================
    
    processMessage(content, options = {}) {
        if (options.type === 'text') {
            let processed = this.escapeHtml(content);
            
            if (this.settings.allowEmoji) {
                processed = this.replaceEmoji(processed);
            }
            
            if (this.settings.allowMarkdown) {
                processed = this.renderMarkdown(processed);
            }
            
            if (this.settings.allowCodeBlocks) {
                processed = this.renderCodeBlocks(processed);
            }
            
            if (this.settings.allowMentions) {
                processed = this.renderMentions(processed);
            }
            
            return processed;
        }
        
        return content;
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    replaceEmoji(text) {
        // Simple emoji replacement
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
            result = result.replace(new RegExp(key, 'g'), value);
        }
        
        return result;
    },
    
    renderMarkdown(text) {
        // Bold
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
        
        // Italic
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        text = text.replace(/_(.*?)_/g, '<em>$1</em>');
        
        // Strikethrough
        text = text.replace(/~~(.*?)~~/g, '<del>$1</del>');
        
        // Links
        text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
        
        return text;
    },
    
    renderCodeBlocks(text) {
        // Inline code
        text = text.replace(/`(.*?)`/g, '<code>$1</code>');
        
        // Code blocks
        text = text.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
        
        return text;
    },
    
    renderMentions(text) {
        return text.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
    },
    
    extractMentions(text) {
        const mentions = [];
        const matches = text.match(/@(\w+)/g);
        
        if (matches) {
            matches.forEach(match => {
                const username = match.slice(1);
                mentions.push(username);
            });
        }
        
        return mentions;
    },
    
    getPreview(text, length = 100) {
        if (!text) return '';
        const plain = text.replace(/<[^>]*>/g, '');
        return plain.length > length ? plain.slice(0, length) + '...' : plain;
    },
    
    getHighlight(text, query) {
        const index = text.toLowerCase().indexOf(query.toLowerCase());
        if (index === -1) return text;
        
        const start = Math.max(0, index - 30);
        const end = Math.min(text.length, index + query.length + 30);
        let highlight = text.slice(start, end);
        
        if (start > 0) highlight = '...' + highlight;
        if (end < text.length) highlight = highlight + '...';
        
        return highlight;
    },
    
    // ==================== TYPING INDICATORS ====================
    
    sendTyping(conversationId, isTyping) {
        const currentUser = this.os.modules.UserManager?.getCurrentUser();
        if (!currentUser) return;
        
        if (!this.typing.has(conversationId)) {
            this.typing.set(conversationId, new Set());
        }
        
        if (isTyping) {
            this.typing.get(conversationId).add(currentUser.id);
        } else {
            this.typing.get(conversationId).delete(currentUser.id);
        }
        
        if (this.os.modules.Collaboration) {
            this.os.modules.Collaboration.sendTyping(isTyping, {
                conversationId
            });
        }
        
        // Clear typing after 3 seconds
        if (isTyping) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = setTimeout(() => {
                this.sendTyping(conversationId, false);
            }, 3000);
        }
    },
    
    getTypingUsers(conversationId) {
        const typingIds = this.typing.get(conversationId) || new Set();
        const conversation = this.conversations.get(conversationId);
        
        if (!conversation) return [];
        
        return Array.from(typingIds)
            .map(id => conversation.participants.find(p => p.id === id))
            .filter(Boolean);
    },
    
    handleTypingIndicator(data) {
        const { userId, username, isTyping, target } = data;
        
        if (target?.conversationId) {
            if (!this.typing.has(target.conversationId)) {
                this.typing.set(target.conversationId, new Set());
            }
            
            if (isTyping) {
                this.typing.get(target.conversationId).add(userId);
            } else {
                this.typing.get(target.conversationId).delete(userId);
            }
            
            this.os.modules.EventBus.emit('chat:typing', {
                conversationId: target.conversationId,
                userId,
                username,
                isTyping
            });
        }
    },
    
    // ==================== INCOMING MESSAGES ====================
    
    handleIncomingMessage(data) {
        const { conversationId, message } = data;
        
        // Add to messages
        if (!this.messages.has(conversationId)) {
            this.messages.set(conversationId, []);
        }
        
        const messages = this.messages.get(conversationId);
        messages.push(message);
        
        // Trim if needed
        if (messages.length > this.settings.messageHistory) {
            this.messages.set(conversationId, messages.slice(-this.settings.messageHistory));
        }
        
        // Update conversation
        const conversation = this.conversations.get(conversationId);
        if (conversation) {
            conversation.lastMessage = {
                id: message.id,
                content: this.getPreview(message.content),
                sender: message.sender.username,
                timestamp: message.timestamp
            };
            conversation.lastActivity = message.timestamp;
            
            // Increment unread if not current conversation
            if (this.currentConversation !== conversationId) {
                conversation.unread = (conversation.unread || 0) + 1;
                this.unread.set(conversationId, conversation.unread);
                
                // Show notification
                if (this.settings.notifications) {
                    this.showNotification(conversation, message);
                }
                
                // Play sound
                if (this.settings.soundEnabled) {
                    this.playNotificationSound();
                }
            }
        }
        
        this.os.modules.EventBus.emit('chat:message_received', {
            conversationId,
            message
        });
    },
    
    showNotification(conversation, message) {
        if (!('Notification' in window)) return;
        
        if (Notification.permission === 'granted') {
            new Notification(`Message from ${message.sender.name}`, {
                body: this.getPreview(message.content),
                icon: message.sender.avatar || '/icons/icon-192.png'
            });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    },
    
    playNotificationSound() {
        // Play notification sound
        const audio = new Audio('/sounds/notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
    },
    
    // ==================== USER PRESENCE ====================
    
    updateUserPresence(userId, status) {
        this.conversations.forEach(conv => {
            const participant = conv.participants.find(p => p.id === userId);
            if (participant) {
                participant.status = status;
                participant.lastSeen = Date.now();
            }
        });
        
        this.os.modules.EventBus.emit('chat:presence', {
            userId,
            status
        });
    },
    
    getUserStatus(userId) {
        for (const conv of this.conversations.values()) {
            const participant = conv.participants.find(p => p.id === userId);
            if (participant) {
                return participant.status || 'offline';
            }
        }
        return 'offline';
    },
    
    // ==================== EMOJI PICKER ====================
    
    getEmojis(category = null) {
        if (category) {
            return this.emojis[category] || [];
        }
        
        return this.emojis;
    },
    
    // ==================== UTILITY METHODS ====================
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
    },
    
    setCurrentConversation(conversationId) {
        this.currentConversation = conversationId;
        this.markAsRead(conversationId);
        
        this.os.modules.EventBus.emit('chat:conversation_changed', {
            conversationId
        });
    },
    
    async updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        await this.saveSettings();
    },
    
    getStatus() {
        return {
            conversations: this.conversations.size,
            messages: Array.from(this.messages.values()).reduce((sum, msgs) => sum + msgs.length, 0),
            unread: this.getUnreadCount(),
            currentConversation: this.currentConversation,
            settings: this.settings
        };
    }
};

window.ChatSystem = ChatSystem;
