/**
 * BhekOS User Manager - Multi-user support with profiles and permissions
 */
const UserManager = {
    os: null,
    
    // Users database
    users: new Map(),
    
    // Current user
    currentUser: null,
    
    // User groups
    groups: new Map(),
    
    // Online users
    onlineUsers: new Map(),
    
    // User presence
    presence: {
        online: new Set(),
        away: new Set(),
        busy: new Set(),
        offline: new Set()
    },
    
    // User settings
    settings: {
        allowGuest: true,
        maxUsers: 10,
        sessionTimeout: 3600000, // 1 hour
        requireEmailVerification: false,
        allowUserRegistration: false,
        defaultUserGroup: 'users',
        presenceEnabled: true,
        presenceTimeout: 300000, // 5 minutes
        showOfflineUsers: true,
        allowUserSearch: true
    },
    
    // User activity log
    activityLog: [],
    
    async init(os) {
        this.os = os;
        console.log('User Manager initializing...');
        
        await this.loadSettings();
        await this.loadUsers();
        await this.loadGroups();
        this.setupListeners();
        this.startPresenceMonitoring();
        
        console.log(`User Manager ready: ${this.users.size} users, ${this.groups.size} groups`);
        return this;
    },
    
    async loadSettings() {
        const saved = await this.os.modules.Storage.get('user_settings', {});
        this.settings = { ...this.settings, ...saved };
    },
    
    async saveSettings() {
        await this.os.modules.Storage.set('user_settings', this.settings);
    },
    
    async loadUsers() {
        const saved = await this.os.modules.Storage.get('users', []);
        
        saved.forEach(userData => {
            // Don't store passwords in memory
            const { password, ...user } = userData;
            this.users.set(user.id, user);
        });
        
        // Create default admin if no users
        if (this.users.size === 0) {
            await this.createDefaultAdmin();
        }
    },
    
    async saveUsers() {
        const users = Array.from(this.users.values()).map(user => ({
            ...user,
            password: undefined // Don't save password
        }));
        await this.os.modules.Storage.set('users', users, { encrypt: true });
    },
    
    async createDefaultAdmin() {
        const admin = {
            id: 'user_' + BhekHelpers.generateId(),
            username: 'admin',
            name: 'Administrator',
            email: 'admin@bhekos.local',
            role: 'admin',
            groups: ['administrators'],
            password: await BhekCrypto?.hashPassword('admin') || 'admin',
            avatar: null,
            status: 'offline',
            presence: 'offline',
            lastSeen: null,
            lastActive: null,
            createdAt: new Date().toISOString(),
            createdBy: 'system',
            preferences: {
                theme: 'dark',
                notifications: true,
                language: 'en'
            },
            permissions: ['*'],
            twoFactorEnabled: false,
            twoFactorSecret: null,
            trustedDevices: []
        };
        
        this.users.set(admin.id, admin);
        await this.saveUsers();
    },
    
    async loadGroups() {
        const saved = await this.os.modules.Storage.get('groups', []);
        
        if (saved.length === 0) {
            // Create default groups
            const defaultGroups = [
                {
                    id: 'group_1',
                    name: 'Administrators',
                    description: 'Full system access',
                    permissions: ['*'],
                    color: '#ff5252',
                    icon: '👑',
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'group_2',
                    name: 'Users',
                    description: 'Standard users',
                    permissions: ['read', 'write', 'execute'],
                    color: '#4CAF50',
                    icon: '👤',
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'group_3',
                    name: 'Guests',
                    description: 'Limited access',
                    permissions: ['read'],
                    color: '#FF9800',
                    icon: '👥',
                    createdAt: new Date().toISOString()
                }
            ];
            
            defaultGroups.forEach(group => this.groups.set(group.id, group));
            await this.saveGroups();
        } else {
            saved.forEach(group => this.groups.set(group.id, group));
        }
    },
    
    async saveGroups() {
        const groups = Array.from(this.groups.values());
        await this.os.modules.Storage.set('groups', groups);
    },
    
    setupListeners() {
        // Listen for authentication events
        this.os.modules.EventBus.on('user:login', (data) => {
            this.handleUserLogin(data.user);
        });
        
        this.os.modules.EventBus.on('user:logout', (data) => {
            this.handleUserLogout(data.user);
        });
        
        // Listen for activity
        document.addEventListener('mousemove', () => this.updateUserActivity());
        document.addEventListener('keydown', () => this.updateUserActivity());
        document.addEventListener('click', () => this.updateUserActivity());
    },
    
    startPresenceMonitoring() {
        setInterval(() => {
            this.checkPresence();
        }, 60000); // Check every minute
    },
    
    // ==================== USER MANAGEMENT ====================
    
    async createUser(userData) {
        // Check permissions
        if (!this.hasPermission('manage_users')) {
            throw new Error('Permission denied');
        }
        
        // Validate
        if (this.findUserByUsername(userData.username)) {
            throw new Error('Username already exists');
        }
        
        if (userData.email && this.findUserByEmail(userData.email)) {
            throw new Error('Email already exists');
        }
        
        // Create user
        const user = {
            id: 'user_' + BhekHelpers.generateId(),
            username: userData.username,
            name: userData.name || userData.username,
            email: userData.email,
            role: userData.role || 'user',
            groups: userData.groups || ['group_2'],
            password: await BhekCrypto?.hashPassword(userData.password) || userData.password,
            avatar: userData.avatar || this.generateAvatar(userData.username),
            status: 'offline',
            presence: 'offline',
            lastSeen: null,
            lastActive: null,
            createdAt: new Date().toISOString(),
            createdBy: this.currentUser?.id || 'system',
            preferences: userData.preferences || {
                theme: 'dark',
                notifications: true,
                language: 'en'
            },
            permissions: userData.permissions || [],
            twoFactorEnabled: false,
            twoFactorSecret: null,
            trustedDevices: []
        };
        
        this.users.set(user.id, user);
        await this.saveUsers();
        
        this.logActivity('user_created', { userId: user.id, by: this.currentUser?.id });
        this.os.modules.EventBus.emit('user:created', user);
        
        return { ...user, password: undefined };
    },
    
    async updateUser(userId, updates) {
        const user = this.users.get(userId);
        if (!user) throw new Error('User not found');
        
        // Check permissions
        if (userId !== this.currentUser?.id && !this.hasPermission('manage_users')) {
            throw new Error('Permission denied');
        }
        
        // Update fields
        Object.assign(user, updates);
        
        await this.saveUsers();
        this.logActivity('user_updated', { userId, by: this.currentUser?.id });
        this.os.modules.EventBus.emit('user:updated', user);
        
        return { ...user, password: undefined };
    },
    
    async deleteUser(userId) {
        if (!this.hasPermission('manage_users')) {
            throw new Error('Permission denied');
        }
        
        const user = this.users.get(userId);
        if (!user) throw new Error('User not found');
        
        if (user.role === 'admin' && this.getAdminCount() === 1) {
            throw new Error('Cannot delete last administrator');
        }
        
        this.users.delete(userId);
        await this.saveUsers();
        
        this.logActivity('user_deleted', { userId, by: this.currentUser?.id });
        this.os.modules.EventBus.emit('user:deleted', { userId });
    },
    
    async changePassword(userId, oldPassword, newPassword) {
        const user = this.users.get(userId);
        if (!user) throw new Error('User not found');
        
        // Verify old password
        const isValid = await BhekCrypto?.verifyPassword(oldPassword, user.password);
        if (!isValid) throw new Error('Current password is incorrect');
        
        // Update password
        user.password = await BhekCrypto?.hashPassword(newPassword);
        user.passwordChanged = new Date().toISOString();
        
        await this.saveUsers();
        this.logActivity('password_changed', { userId });
        
        return true;
    },
    
    async resetPassword(userId, newPassword) {
        if (!this.hasPermission('manage_users')) {
            throw new Error('Permission denied');
        }
        
        const user = this.users.get(userId);
        if (!user) throw new Error('User not found');
        
        user.password = await BhekCrypto?.hashPassword(newPassword);
        user.passwordReset = new Date().toISOString();
        user.passwordResetBy = this.currentUser?.id;
        
        await this.saveUsers();
        this.logActivity('password_reset', { userId, by: this.currentUser?.id });
        
        return true;
    },
    
    // ==================== AUTHENTICATION ====================
    
    async authenticate(username, password) {
        const user = this.findUserByUsername(username);
        if (!user) return null;
        
        const isValid = await BhekCrypto?.verifyPassword(password, user.password);
        if (!isValid) return null;
        
        return user;
    },
    
    async login(username, password, remember = false) {
        const user = await this.authenticate(username, password);
        if (!user) {
            this.logActivity('login_failed', { username });
            throw new Error('Invalid credentials');
        }
        
        // Check 2FA
        if (user.twoFactorEnabled) {
            return { requires2FA: true, userId: user.id };
        }
        
        return this.completeLogin(user, remember);
    },
    
    async verify2FA(userId, code) {
        const user = this.users.get(userId);
        if (!user) throw new Error('User not found');
        
        const isValid = BhekCrypto?.verifyTOTP(code, user.twoFactorSecret);
        if (!isValid) throw new Error('Invalid 2FA code');
        
        return this.completeLogin(user, true);
    },
    
    completeLogin(user, remember = false) {
        // Update user status
        user.status = 'online';
        user.presence = 'online';
        user.lastSeen = new Date().toISOString();
        user.lastActive = new Date().toISOString();
        user.loginCount = (user.loginCount || 0) + 1;
        
        this.currentUser = user;
        this.onlineUsers.set(user.id, user);
        this.presence.online.add(user.id);
        
        // Save session
        if (remember) {
            this.saveSession(user);
        }
        
        this.saveUsers();
        this.logActivity('login', { userId: user.id });
        
        // Broadcast presence
        this.broadcastPresence(user.id, 'online');
        
        return {
            success: true,
            user: this.sanitizeUser(user)
        };
    },
    
    logout() {
        if (this.currentUser) {
            const user = this.currentUser;
            
            user.status = 'offline';
            user.presence = 'offline';
            user.lastSeen = new Date().toISOString();
            
            this.onlineUsers.delete(user.id);
            this.presence.online.delete(user.id);
            this.presence.offline.add(user.id);
            
            this.saveUsers();
            this.logActivity('logout', { userId: user.id });
            
            // Broadcast presence
            this.broadcastPresence(user.id, 'offline');
            
            // Clear session
            this.os.modules.Storage.remove('session');
        }
        
        this.currentUser = null;
    },
    
    saveSession(user) {
        const session = {
            userId: user.id,
            expires: Date.now() + this.settings.sessionTimeout,
            token: BhekHelpers.generateUUID()
        };
        
        this.os.modules.Storage.set('session', session, { encrypt: true });
    },
    
    async restoreSession() {
        const session = await this.os.modules.Storage.get('session');
        if (!session || session.expires < Date.now()) return null;
        
        const user = this.users.get(session.userId);
        if (user) {
            this.currentUser = user;
            user.status = 'online';
            user.presence = 'online';
            user.lastActive = new Date().toISOString();
            
            this.onlineUsers.set(user.id, user);
            this.presence.online.add(user.id);
            
            this.broadcastPresence(user.id, 'online');
        }
        
        return user;
    },
    
    // ==================== PRESENCE MANAGEMENT ====================
    
    updateUserActivity() {
        if (!this.currentUser) return;
        
        const user = this.currentUser;
        const now = Date.now();
        
        user.lastActive = new Date().toISOString();
        
        // Update presence if away
        if (user.presence === 'away') {
            user.presence = 'online';
            this.presence.away.delete(user.id);
            this.presence.online.add(user.id);
            this.broadcastPresence(user.id, 'online');
        }
    },
    
    checkPresence() {
        const now = Date.now();
        
        this.onlineUsers.forEach(user => {
            const lastActive = new Date(user.lastActive).getTime();
            const inactive = now - lastActive;
            
            if (inactive > this.settings.presenceTimeout && user.presence === 'online') {
                user.presence = 'away';
                this.presence.online.delete(user.id);
                this.presence.away.add(user.id);
                this.broadcastPresence(user.id, 'away');
            }
        });
    },
    
    setPresence(status) {
        if (!this.currentUser) return;
        
        const user = this.currentUser;
        const oldStatus = user.presence;
        
        // Remove from old set
        this.presence[oldStatus]?.delete(user.id);
        
        // Add to new set
        user.presence = status;
        this.presence[status]?.add(user.id);
        
        this.broadcastPresence(user.id, status);
        this.logActivity('presence_changed', { userId: user.id, status });
    },
    
    broadcastPresence(userId, status) {
        const user = this.users.get(userId);
        if (!user) return;
        
        this.os.modules.EventBus.emit('user:presence', {
            userId,
            username: user.username,
            name: user.name,
            status,
            timestamp: Date.now()
        });
    },
    
    // ==================== PERMISSIONS ====================
    
    hasPermission(permission, userId = null) {
        const user = userId ? this.users.get(userId) : this.currentUser;
        if (!user) return false;
        
        // Admin has all permissions
        if (user.role === 'admin' || user.permissions?.includes('*')) {
            return true;
        }
        
        // Check user permissions
        if (user.permissions?.includes(permission)) {
            return true;
        }
        
        // Check group permissions
        if (user.groups) {
            for (const groupId of user.groups) {
                const group = this.groups.get(groupId);
                if (group?.permissions?.includes('*') || group?.permissions?.includes(permission)) {
                    return true;
                }
            }
        }
        
        return false;
    },
    
    async grantPermission(userId, permission) {
        if (!this.hasPermission('manage_permissions')) {
            throw new Error('Permission denied');
        }
        
        const user = this.users.get(userId);
        if (!user) throw new Error('User not found');
        
        if (!user.permissions) user.permissions = [];
        if (!user.permissions.includes(permission)) {
            user.permissions.push(permission);
            await this.saveUsers();
            this.logActivity('permission_granted', { userId, permission, by: this.currentUser?.id });
        }
    },
    
    async revokePermission(userId, permission) {
        if (!this.hasPermission('manage_permissions')) {
            throw new Error('Permission denied');
        }
        
        const user = this.users.get(userId);
        if (!user) throw new Error('User not found');
        
        if (user.permissions) {
            user.permissions = user.permissions.filter(p => p !== permission);
            await this.saveUsers();
            this.logActivity('permission_revoked', { userId, permission, by: this.currentUser?.id });
        }
    },
    
    // ==================== GROUPS ====================
    
    async createGroup(groupData) {
        if (!this.hasPermission('manage_groups')) {
            throw new Error('Permission denied');
        }
        
        const group = {
            id: 'group_' + BhekHelpers.generateId(),
            name: groupData.name,
            description: groupData.description,
            permissions: groupData.permissions || [],
            color: groupData.color || '#0078d4',
            icon: groupData.icon || '👥',
            members: [],
            createdBy: this.currentUser?.id,
            createdAt: new Date().toISOString()
        };
        
        this.groups.set(group.id, group);
        await this.saveGroups();
        
        this.logActivity('group_created', { groupId: group.id, by: this.currentUser?.id });
        
        return group;
    },
    
    async updateGroup(groupId, updates) {
        if (!this.hasPermission('manage_groups')) {
            throw new Error('Permission denied');
        }
        
        const group = this.groups.get(groupId);
        if (!group) throw new Error('Group not found');
        
        Object.assign(group, updates);
        await this.saveGroups();
        
        this.logActivity('group_updated', { groupId, by: this.currentUser?.id });
        
        return group;
    },
    
    async deleteGroup(groupId) {
        if (!this.hasPermission('manage_groups')) {
            throw new Error('Permission denied');
        }
        
        if (!this.groups.has(groupId)) return;
        
        // Remove group from users
        this.users.forEach(user => {
            if (user.groups) {
                user.groups = user.groups.filter(g => g !== groupId);
            }
        });
        
        this.groups.delete(groupId);
        await this.saveGroups();
        await this.saveUsers();
        
        this.logActivity('group_deleted', { groupId, by: this.currentUser?.id });
    },
    
    async addUserToGroup(userId, groupId) {
        if (!this.hasPermission('manage_groups')) {
            throw new Error('Permission denied');
        }
        
        const user = this.users.get(userId);
        const group = this.groups.get(groupId);
        
        if (!user || !group) throw new Error('User or group not found');
        
        if (!user.groups) user.groups = [];
        if (!user.groups.includes(groupId)) {
            user.groups.push(groupId);
            await this.saveUsers();
            
            if (!group.members) group.members = [];
            if (!group.members.includes(userId)) {
                group.members.push(userId);
                await this.saveGroups();
            }
            
            this.logActivity('user_added_to_group', { userId, groupId, by: this.currentUser?.id });
        }
    },
    
    async removeUserFromGroup(userId, groupId) {
        if (!this.hasPermission('manage_groups')) {
            throw new Error('Permission denied');
        }
        
        const user = this.users.get(userId);
        const group = this.groups.get(groupId);
        
        if (!user || !group) return;
        
        if (user.groups) {
            user.groups = user.groups.filter(g => g !== groupId);
            await this.saveUsers();
        }
        
        if (group.members) {
            group.members = group.members.filter(m => m !== userId);
            await this.saveGroups();
        }
        
        this.logActivity('user_removed_from_group', { userId, groupId, by: this.currentUser?.id });
    },
    
    // ==================== 2FA ====================
    
    async enable2FA(secret, code) {
        if (!this.currentUser) throw new Error('Not logged in');
        
        const isValid = BhekCrypto?.verifyTOTP(code, secret);
        if (!isValid) throw new Error('Invalid verification code');
        
        this.currentUser.twoFactorEnabled = true;
        this.currentUser.twoFactorSecret = secret;
        
        await this.saveUsers();
        this.logActivity('2fa_enabled', { userId: this.currentUser.id });
    },
    
    async disable2FA(password) {
        if (!this.currentUser) throw new Error('Not logged in');
        
        const isValid = await BhekCrypto?.verifyPassword(password, this.currentUser.password);
        if (!isValid) throw new Error('Invalid password');
        
        this.currentUser.twoFactorEnabled = false;
        this.currentUser.twoFactorSecret = null;
        
        await this.saveUsers();
        this.logActivity('2fa_disabled', { userId: this.currentUser.id });
    },
    
    // ==================== ACTIVITY LOGGING ====================
    
    logActivity(action, data) {
        const entry = {
            id: BhekHelpers.generateId('log-'),
            timestamp: new Date().toISOString(),
            action,
            userId: this.currentUser?.id,
            username: this.currentUser?.username,
            data,
            ip: '127.0.0.1', // Would get real IP in production
            userAgent: navigator.userAgent
        };
        
        this.activityLog.push(entry);
        
        // Trim log
        if (this.activityLog.length > 1000) {
            this.activityLog = this.activityLog.slice(-1000);
        }
        
        this.os.modules.EventBus.emit('user:activity', entry);
    },
    
    getActivityLog(filters = {}) {
        let log = [...this.activityLog];
        
        if (filters.userId) {
            log = log.filter(e => e.userId === filters.userId);
        }
        
        if (filters.action) {
            log = log.filter(e => e.action === filters.action);
        }
        
        if (filters.from) {
            log = log.filter(e => new Date(e.timestamp) >= new Date(filters.from));
        }
        
        if (filters.to) {
            log = log.filter(e => new Date(e.timestamp) <= new Date(filters.to));
        }
        
        return log;
    },
    
    // ==================== UTILITY METHODS ====================
    
    getCurrentUser() {
        return this.currentUser ? this.sanitizeUser(this.currentUser) : null;
    },
    
    getUser(userId) {
        const user = this.users.get(userId);
        return user ? this.sanitizeUser(user) : null;
    },
    
    findUserByUsername(username) {
        for (const user of this.users.values()) {
            if (user.username.toLowerCase() === username.toLowerCase()) {
                return user;
            }
        }
        return null;
    },
    
    findUserByEmail(email) {
        for (const user of this.users.values()) {
            if (user.email?.toLowerCase() === email.toLowerCase()) {
                return user;
            }
        }
        return null;
    },
    
    getAllUsers() {
        return Array.from(this.users.values()).map(user => this.sanitizeUser(user));
    },
    
    getOnlineUsers() {
        return Array.from(this.onlineUsers.values()).map(user => this.sanitizeUser(user));
    },
    
    getUsersByPresence(status) {
        const userIds = this.presence[status] || new Set();
        return Array.from(userIds).map(id => this.sanitizeUser(this.users.get(id))).filter(Boolean);
    },
    
    getGroups() {
        return Array.from(this.groups.values());
    },
    
    getUserGroups(userId) {
        const user = this.users.get(userId);
        if (!user || !user.groups) return [];
        
        return user.groups
            .map(groupId => this.groups.get(groupId))
            .filter(Boolean);
    },
    
    getAdminCount() {
        let count = 0;
        for (const user of this.users.values()) {
            if (user.role === 'admin') count++;
        }
        return count;
    },
    
    sanitizeUser(user) {
        const { password, twoFactorSecret, trustedDevices, ...safe } = user;
        return safe;
    },
    
    generateAvatar(username) {
        // Generate avatar from username initials
        const initials = username
            .split(/[._-]/)
            .map(part => part[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
        
        return {
            type: 'initials',
            value: initials,
            color: this.getUserColor(username)
        };
    },
    
    getUserColor(username) {
        const colors = [
            '#FF5252', '#4CAF50', '#2196F3', '#FFC107', '#9C27B0',
            '#FF9800', '#00BCD4', '#E91E63', '#8BC34A', '#673AB7'
        ];
        
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = ((hash << 5) - hash) + username.charCodeAt(i);
            hash = hash & hash;
        }
        
        return colors[Math.abs(hash) % colors.length];
    }
};

window.UserManager = UserManager;
