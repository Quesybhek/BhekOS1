/**
 * Users Application - User management and profiles
 */
class UsersApp {
    constructor(os, windowId) {
        this.os = os;
        this.windowId = windowId;
        this.currentView = 'list'; // list, add, edit, details
        this.currentUser = null;
        this.searchQuery = '';
        this.filterRole = 'all';
    }
    
    async render(container, options = {}) {
        this.container = container;
        
        if (options.userId) {
            await this.showUserDetails(options.userId);
        } else if (options.action === 'add') {
            this.showAddUser();
        } else {
            await this.renderUserList();
        }
        
        this.addStyles();
    }
    
    async renderUserList() {
        const users = this.os.modules.UserManager?.getAllUsers() || [];
        const currentUser = this.os.modules.UserManager?.getCurrentUser();
        
        const filteredUsers = this.filterUsers(users);
        
        this.container.innerHTML = `
            <div class="users-app">
                <!-- Header -->
                <div class="users-header">
                    <h1 class="users-title">
                        <span class="users-icon">👥</span>
                        User Management
                    </h1>
                    <div class="users-actions">
                        <button class="add-user-btn" onclick="usersApp.showAddUser()">
                            ➕ Add User
                        </button>
                    </div>
                </div>
                
                <!-- Search and Filter -->
                <div class="users-search-section">
                    <div class="search-box">
                        <span class="search-icon">🔍</span>
                        <input type="text" 
                               placeholder="Search users..." 
                               id="user-search"
                               value="${this.searchQuery}">
                    </div>
                    
                    <select class="role-filter" id="role-filter">
                        <option value="all" ${this.filterRole === 'all' ? 'selected' : ''}>All Roles</option>
                        <option value="admin" ${this.filterRole === 'admin' ? 'selected' : ''}>Administrators</option>
                        <option value="user" ${this.filterRole === 'user' ? 'selected' : ''}>Users</option>
                        <option value="guest" ${this.filterRole === 'guest' ? 'selected' : ''}>Guests</option>
                    </select>
                </div>
                
                <!-- Users Grid -->
                <div class="users-grid">
                    ${filteredUsers.map(user => `
                        <div class="user-card ${user.id === currentUser?.id ? 'current-user' : ''}" 
                             onclick="usersApp.showUserDetails('${user.id}')">
                            <div class="user-card-avatar">${user.avatar?.value || '👤'}</div>
                            <div class="user-card-info">
                                <div class="user-card-name">${user.name}</div>
                                <div class="user-card-username">@${user.username}</div>
                                <div class="user-card-role">${user.role}</div>
                            </div>
                            <div class="user-card-status ${user.presence || 'offline'}">
                                <span class="status-dot"></span>
                                ${user.presence || 'Offline'}
                            </div>
                            ${user.id !== currentUser?.id ? `
                                <div class="user-card-actions">
                                    <button class="edit-user-btn" onclick="event.stopPropagation(); usersApp.editUser('${user.id}')">
                                        ✏️
                                    </button>
                                    <button class="delete-user-btn" onclick="event.stopPropagation(); usersApp.deleteUser('${user.id}')">
                                        🗑️
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                    
                    ${filteredUsers.length === 0 ? `
                        <div class="no-users">
                            <div class="no-users-icon">👥</div>
                            <h3>No Users Found</h3>
                            <p>Try adjusting your search or filter</p>
                        </div>
                    ` : ''}
                </div>
                
                <!-- Stats Footer -->
                <div class="users-footer">
                    <span>Total Users: ${users.length}</span>
                    <span>Admins: ${users.filter(u => u.role === 'admin').length}</span>
                    <span>Online: ${users.filter(u => u.presence === 'online').length}</span>
                </div>
            </div>
        `;
        
        this.addEventListeners();
    }
    
    async showUserDetails(userId) {
        const user = this.os.modules.UserManager?.getUser(userId);
        if (!user) {
            this.currentView = 'list';
            this.renderUserList();
            return;
        }
        
        this.currentUser = user;
        this.currentView = 'details';
        
        const groups = this.os.modules.UserManager?.getUserGroups(userId) || [];
        const activity = this.os.modules.UserManager?.getActivityLog({ userId }).slice(0, 10) || [];
        
        this.container.innerHTML = `
            <div class="user-details-view">
                <!-- Header -->
                <div class="details-header">
                    <button class="back-btn" onclick="usersApp.showUserList()">← Back</button>
                    <h2>User Details</h2>
                    <div class="header-actions">
                        <button class="edit-btn" onclick="usersApp.editUser('${user.id}')">✏️ Edit</button>
                        ${user.role !== 'admin' ? `
                            <button class="delete-btn" onclick="usersApp.deleteUser('${user.id}')">🗑️ Delete</button>
                        ` : ''}
                    </div>
                </div>
                
                <!-- User Profile -->
                <div class="user-profile-section">
                    <div class="profile-avatar-large">${user.avatar?.value || '👤'}</div>
                    <div class="profile-info">
                        <h3 class="profile-name">${user.name}</h3>
                        <div class="profile-username">@${user.username}</div>
                        <div class="profile-email">${user.email || 'No email'}</div>
                        <div class="profile-role-badge ${user.role}">${user.role}</div>
                        <div class="profile-status ${user.presence || 'offline'}">
                            <span class="status-dot"></span>
                            ${user.presence || 'Offline'}
                        </div>
                    </div>
                </div>
                
                <!-- User Details Grid -->
                <div class="details-grid">
                    <!-- Account Info -->
                    <div class="details-card">
                        <h4>Account Information</h4>
                        <div class="detail-row">
                            <span class="detail-label">User ID:</span>
                            <span class="detail-value">${user.id}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Created:</span>
                            <span class="detail-value">${new Date(user.createdAt).toLocaleString()}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Last Login:</span>
                            <span class="detail-value">${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Last Active:</span>
                            <span class="detail-value">${user.lastActive ? new Date(user.lastActive).toLocaleString() : 'Never'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Login Count:</span>
                            <span class="detail-value">${user.loginCount || 0}</span>
                        </div>
                    </div>
                    
                    <!-- Groups -->
                    <div class="details-card">
                        <h4>Groups</h4>
                        ${groups.length > 0 ? groups.map(group => `
                            <div class="group-item" style="border-left-color: ${group.color}">
                                <span class="group-icon">${group.icon || '👥'}</span>
                                <span class="group-name">${group.name}</span>
                                <span class="group-badge">${group.permissions?.length || 0} perms</span>
                            </div>
                        `).join('') : '<p class="no-data">No groups assigned</p>'}
                        
                        <button class="manage-groups-btn" onclick="usersApp.manageGroups('${user.id}')">
                            Manage Groups
                        </button>
                    </div>
                    
                    <!-- Permissions -->
                    <div class="details-card">
                        <h4>Permissions</h4>
                        <div class="permissions-list">
                            ${user.permissions && user.permissions.length > 0 ? 
                                user.permissions.map(p => `
                                    <span class="permission-tag">${p}</span>
                                `).join('') : 
                                '<p class="no-data">No specific permissions</p>'
                            }
                        </div>
                        
                        <button class="manage-permissions-btn" onclick="usersApp.managePermissions('${user.id}')">
                            Manage Permissions
                        </button>
                    </div>
                    
                    <!-- Security -->
                    <div class="details-card">
                        <h4>Security</h4>
                        <div class="detail-row">
                            <span class="detail-label">2FA Enabled:</span>
                            <span class="detail-value">${user.twoFactorEnabled ? '✅ Yes' : '❌ No'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Trusted Devices:</span>
                            <span class="detail-value">${user.trustedDevices?.length || 0}</span>
                        </div>
                        
                        <button class="reset-password-btn" onclick="usersApp.resetPassword('${user.id}')">
                            Reset Password
                        </button>
                    </div>
                </div>
                
                <!-- Activity Log -->
                <div class="activity-section">
                    <h4>Recent Activity</h4>
                    <div class="activity-list">
                        ${activity.length > 0 ? activity.map(act => `
                            <div class="activity-item">
                                <span class="activity-icon">${this.getActivityIcon(act.action)}</span>
                                <span class="activity-action">${act.action}</span>
                                <span class="activity-time">${new Date(act.timestamp).toLocaleString()}</span>
                            </div>
                        `).join('') : '<p class="no-data">No recent activity</p>'}
                    </div>
                </div>
            </div>
        `;
    }
    
    showAddUser() {
        this.currentView = 'add';
        
        this.container.innerHTML = `
            <div class="user-form-view">
                <div class="form-header">
                    <button class="back-btn" onclick="usersApp.showUserList()">← Back</button>
                    <h2>Add New User</h2>
                </div>
                
                <form class="user-form" onsubmit="usersApp.createUser(event)">
                    <div class="form-group">
                        <label>Username *</label>
                        <input type="text" id="username" required pattern="[a-zA-Z0-9_]+" 
                               title="Only letters, numbers, and underscores">
                    </div>
                    
                    <div class="form-group">
                        <label>Full Name *</label>
                        <input type="text" id="fullname" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="email">
                    </div>
                    
                    <div class="form-group">
                        <label>Password *</label>
                        <input type="password" id="password" required minlength="8">
                        <small class="form-hint">Minimum 8 characters</small>
                    </div>
                    
                    <div class="form-group">
                        <label>Confirm Password *</label>
                        <input type="password" id="confirm-password" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Role</label>
                        <select id="role">
                            <option value="user">User</option>
                            <option value="admin">Administrator</option>
                            <option value="guest">Guest</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Groups</label>
                        <div class="groups-checkboxes">
                            ${this.renderGroupCheckboxes()}
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="cancel-btn" onclick="usersApp.showUserList()">Cancel</button>
                        <button type="submit" class="submit-btn">Create User</button>
                    </div>
                </form>
            </div>
        `;
    }
    
    async editUser(userId) {
        const user = this.os.modules.UserManager?.getUser(userId);
        if (!user) return;
        
        this.currentUser = user;
        this.currentView = 'edit';
        
        this.container.innerHTML = `
            <div class="user-form-view">
                <div class="form-header">
                    <button class="back-btn" onclick="usersApp.showUserDetails('${userId}')">← Back</button>
                    <h2>Edit User: ${user.username}</h2>
                </div>
                
                <form class="user-form" onsubmit="usersApp.updateUser(event, '${userId}')">
                    <div class="form-group">
                        <label>Full Name *</label>
                        <input type="text" id="edit-fullname" value="${user.name}" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="edit-email" value="${user.email || ''}">
                    </div>
                    
                    <div class="form-group">
                        <label>Role</label>
                        <select id="edit-role">
                            <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrator</option>
                            <option value="guest" ${user.role === 'guest' ? 'selected' : ''}>Guest</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Groups</label>
                        <div class="groups-checkboxes">
                            ${this.renderGroupCheckboxes(user.groups)}
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="cancel-btn" onclick="usersApp.showUserDetails('${userId}')">Cancel</button>
                        <button type="submit" class="submit-btn">Update User</button>
                    </div>
                </form>
            </div>
        `;
    }
    
    renderGroupCheckboxes(selectedGroups = []) {
        const groups = this.os.modules.UserManager?.getGroups() || [];
        
        return groups.map(group => `
            <label class="checkbox-label">
                <input type="checkbox" value="${group.id}" 
                       ${selectedGroups.includes(group.id) ? 'checked' : ''}>
                <span class="group-color-dot" style="background: ${group.color}"></span>
                ${group.name}
            </label>
        `).join('');
    }
    
    // ==================== EVENT HANDLERS ====================
    
    addEventListeners() {
        const searchInput = document.getElementById('user-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.renderUserList();
            });
        }
        
        const filterSelect = document.getElementById('role-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.filterRole = e.target.value;
                this.renderUserList();
            });
        }
    }
    
    // ==================== NAVIGATION ====================
    
    showUserList() {
        this.currentView = 'list';
        this.currentUser = null;
        this.renderUserList();
    }
    
    async showUserDetails(userId) {
        await this.showUserDetails(userId);
    }
    
    // ==================== USER OPERATIONS ====================
    
    filterUsers(users) {
        return users.filter(user => {
            // Search filter
            if (this.searchQuery) {
                const query = this.searchQuery.toLowerCase();
                const matches = user.name.toLowerCase().includes(query) ||
                               user.username.toLowerCase().includes(query) ||
                               (user.email && user.email.toLowerCase().includes(query));
                if (!matches) return false;
            }
            
            // Role filter
            if (this.filterRole !== 'all' && user.role !== this.filterRole) {
                return false;
            }
            
            return true;
        });
    }
    
    async createUser(event) {
        event.preventDefault();
        
        const username = document.getElementById('username').value;
        const fullname = document.getElementById('fullname').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirm = document.getElementById('confirm-password').value;
        const role = document.getElementById('role').value;
        
        // Get selected groups
        const groups = Array.from(document.querySelectorAll('.groups-checkboxes input:checked'))
            .map(cb => cb.value);
        
        // Validate passwords
        if (password !== confirm) {
            alert('Passwords do not match');
            return;
        }
        
        try {
            await this.os.modules.UserManager?.createUser({
                username,
                name: fullname,
                email: email || undefined,
                password,
                role,
                groups
            });
            
            this.os.notify('Success', 'User created successfully', 'success');
            this.showUserList();
        } catch (error) {
            alert(error.message);
        }
    }
    
    async updateUser(event, userId) {
        event.preventDefault();
        
        const fullname = document.getElementById('edit-fullname').value;
        const email = document.getElementById('edit-email').value;
        const role = document.getElementById('edit-role').value;
        
        // Get selected groups
        const groups = Array.from(document.querySelectorAll('.groups-checkboxes input:checked'))
            .map(cb => cb.value);
        
        try {
            await this.os.modules.UserManager?.updateUser(userId, {
                name: fullname,
                email: email || undefined,
                role,
                groups
            });
            
            this.os.notify('Success', 'User updated successfully', 'success');
            this.showUserDetails(userId);
        } catch (error) {
            alert(error.message);
        }
    }
    
    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user?')) return;
        
        try {
            await this.os.modules.UserManager?.deleteUser(userId);
            this.os.notify('Success', 'User deleted', 'success');
            this.showUserList();
        } catch (error) {
            alert(error.message);
        }
    }
    
    async resetPassword(userId) {
        const newPassword = prompt('Enter new password (minimum 8 characters):');
        if (!newPassword) return;
        
        if (newPassword.length < 8) {
            alert('Password must be at least 8 characters');
            return;
        }
        
        try {
            await this.os.modules.UserManager?.resetPassword(userId, newPassword);
            this.os.notify('Success', 'Password reset successfully', 'success');
        } catch (error) {
            alert(error.message);
        }
    }
    
    manageGroups(userId) {
        alert('Group management coming soon');
    }
    
    managePermissions(userId) {
        alert('Permission management coming soon');
    }
    
    // ==================== UTILITY METHODS ====================
    
    getActivityIcon(action) {
        const icons = {
            'login': '🔓',
            'logout': '🔒',
            'password_changed': '🔑',
            'user_created': '➕',
            'user_updated': '✏️',
            'user_deleted': '🗑️',
            'permission_granted': '🔓',
            'permission_revoked': '🔒'
        };
        return icons[action] || '📝';
    }
    
    // ==================== STYLES ====================
    
    addStyles() {
        if (document.getElementById('users-app-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'users-app-styles';
        style.textContent = `
            .users-app {
                height: 100%;
                display: flex;
                flex-direction: column;
                padding: 20px;
            }
            
            .users-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }
            
            .users-title {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 24px;
            }
            
            .users-icon {
                font-size: 32px;
            }
            
            .add-user-btn {
                padding: 10px 20px;
                background: var(--accent);
                border: none;
                border-radius: 6px;
                color: white;
                cursor: pointer;
                font-size: 14px;
            }
            
            .users-search-section {
                display: flex;
                gap: 10px;
                margin-bottom: 20px;
            }
            
            .search-box {
                flex: 1;
                position: relative;
            }
            
            .search-box input {
                width: 100%;
                padding: 10px 10px 10px 35px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 6px;
                color: white;
                font-size: 14px;
            }
            
            .search-icon {
                position: absolute;
                left: 12px;
                top: 50%;
                transform: translateY(-50%);
                opacity: 0.7;
            }
            
            .role-filter {
                padding: 10px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 6px;
                color: white;
                min-width: 150px;
            }
            
            .users-grid {
                flex: 1;
                overflow-y: auto;
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                gap: 16px;
                padding: 5px;
            }
            
            .user-card {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px;
                background: rgba(255,255,255,0.05);
                border-radius: 10px;
                cursor: pointer;
                transition: 0.2s;
                border: 1px solid transparent;
                position: relative;
            }
            
            .user-card:hover {
                background: rgba(255,255,255,0.1);
                transform: translateY(-2px);
                border-color: var(--accent);
            }
            
            .user-card.current-user {
                background: rgba(var(--accent-rgb), 0.1);
                border-color: var(--accent);
            }
            
            .user-card-avatar {
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background: var(--accent);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
            }
            
            .user-card-info {
                flex: 1;
            }
            
            .user-card-name {
                font-size: 16px;
                font-weight: 500;
                margin-bottom: 4px;
            }
            
            .user-card-username {
                font-size: 12px;
                opacity: 0.7;
                margin-bottom: 2px;
            }
            
            .user-card-role {
                font-size: 11px;
                opacity: 0.6;
                text-transform: uppercase;
            }
            
            .user-card-status {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                min-width: 70px;
            }
            
            .status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
            }
            
            .user-card-status.online .status-dot { background: #4CAF50; }
            .user-card-status.away .status-dot { background: #FF9800; }
            .user-card-status.busy .status-dot { background: #FF5252; }
            .user-card-status.offline .status-dot { background: #9E9E9E; }
            
            .user-card-actions {
                position: absolute;
                top: 8px;
                right: 8px;
                display: flex;
                gap: 4px;
                opacity: 0;
                transition: opacity 0.2s;
            }
            
            .user-card:hover .user-card-actions {
                opacity: 1;
            }
            
            .edit-user-btn,
            .delete-user-btn {
                padding: 4px 8px;
                background: transparent;
                border: none;
                color: white;
                cursor: pointer;
                border-radius: 4px;
            }
            
            .edit-user-btn:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .delete-user-btn:hover {
                background: #ff5252;
            }
            
            .no-users {
                grid-column: 1 / -1;
                text-align: center;
                padding: 60px 20px;
                opacity: 0.7;
            }
            
            .no-users-icon {
                font-size: 48px;
                margin-bottom: 16px;
            }
            
            .users-footer {
                margin-top: 20px;
                padding: 12px;
                background: rgba(0,0,0,0.2);
                border-top: 1px solid var(--mica-border);
                display: flex;
                gap: 20px;
                font-size: 12px;
                opacity: 0.7;
            }
            
            /* User Details View */
            .user-details-view {
                height: 100%;
                overflow-y: auto;
                padding: 20px;
            }
            
            .details-header {
                display: flex;
                align-items: center;
                gap: 20px;
                margin-bottom: 30px;
            }
            
            .back-btn {
                padding: 8px 16px;
                background: transparent;
                border: 1px solid var(--mica-border);
                border-radius: 6px;
                color: white;
                cursor: pointer;
            }
            
            .header-actions {
                margin-left: auto;
                display: flex;
                gap: 10px;
            }
            
            .edit-btn,
            .delete-btn {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            
            .edit-btn {
                background: var(--accent);
                color: white;
            }
            
            .delete-btn {
                background: #ff5252;
                color: white;
            }
            
            .user-profile-section {
                display: flex;
                align-items: center;
                gap: 30px;
                padding: 30px;
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                margin-bottom: 30px;
            }
            
            .profile-avatar-large {
                width: 100px;
                height: 100px;
                border-radius: 50%;
                background: var(--accent);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 48px;
            }
            
            .profile-info {
                flex: 1;
            }
            
            .profile-name {
                font-size: 24px;
                margin-bottom: 8px;
            }
            
            .profile-username {
                font-size: 16px;
                opacity: 0.7;
                margin-bottom: 4px;
            }
            
            .profile-email {
                font-size: 14px;
                opacity: 0.6;
                margin-bottom: 12px;
            }
            
            .profile-role-badge {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                text-transform: uppercase;
                margin-bottom: 12px;
            }
            
            .profile-role-badge.admin {
                background: #ff5252;
                color: white;
            }
            
            .profile-role-badge.user {
                background: #4CAF50;
                color: white;
            }
            
            .profile-role-badge.guest {
                background: #FF9800;
                color: white;
            }
            
            .profile-status {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
            }
            
            .details-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            
            .details-card {
                padding: 20px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
            }
            
            .details-card h4 {
                font-size: 16px;
                margin-bottom: 16px;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--mica-border);
            }
            
            .detail-row {
                display: flex;
                padding: 8px 0;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            
            .detail-label {
                width: 120px;
                font-weight: 500;
                opacity: 0.7;
            }
            
            .detail-value {
                flex: 1;
            }
            
            .group-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px;
                margin-bottom: 8px;
                background: rgba(255,255,255,0.03);
                border-radius: 6px;
                border-left: 3px solid;
            }
            
            .group-icon {
                font-size: 16px;
            }
            
            .group-name {
                flex: 1;
                font-size: 13px;
            }
            
            .group-badge {
                font-size: 11px;
                opacity: 0.6;
            }
            
            .manage-groups-btn,
            .manage-permissions-btn,
            .reset-password-btn {
                width: 100%;
                padding: 10px;
                margin-top: 12px;
                background: transparent;
                border: 1px solid var(--mica-border);
                border-radius: 4px;
                color: white;
                cursor: pointer;
            }
            
            .permissions-list {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 12px;
            }
            
            .permission-tag {
                padding: 4px 10px;
                background: rgba(var(--accent-rgb), 0.2);
                border: 1px solid var(--accent);
                border-radius: 20px;
                font-size: 11px;
            }
            
            .activity-section {
                padding: 20px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
            }
            
            .activity-section h4 {
                font-size: 16px;
                margin-bottom: 16px;
            }
            
            .activity-list {
                max-height: 200px;
                overflow-y: auto;
            }
            
            .activity-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px 12px;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            
            .activity-icon {
                font-size: 16px;
                min-width: 24px;
            }
            
            .activity-action {
                flex: 1;
                font-size: 13px;
            }
            
            .activity-time {
                font-size: 11px;
                opacity: 0.6;
            }
            
            .no-data {
                text-align: center;
                padding: 20px;
                opacity: 0.5;
            }
            
            /* User Form */
            .user-form-view {
                height: 100%;
                overflow-y: auto;
                padding: 20px;
            }
            
            .form-header {
                display: flex;
                align-items: center;
                gap: 20px;
                margin-bottom: 30px;
            }
            
            .user-form {
                max-width: 600px;
                margin: 0 auto;
            }
            
            .form-group {
                margin-bottom: 20px;
            }
            
            .form-group label {
                display: block;
                margin-bottom: 6px;
                font-size: 13px;
                font-weight: 500;
            }
            
            .form-group input,
            .form-group select {
                width: 100%;
                padding: 10px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 6px;
                color: white;
                font-size: 14px;
            }
            
            .form-hint {
                display: block;
                margin-top: 4px;
                font-size: 11px;
                opacity: 0.6;
            }
            
            .groups-checkboxes {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 10px;
                padding: 10px;
                background: rgba(255,255,255,0.05);
                border-radius: 6px;
            }
            
            .checkbox-label {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                font-size: 13px;
            }
            
            .group-color-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
            }
            
            .form-actions {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
                margin-top: 30px;
            }
            
            .cancel-btn,
            .submit-btn {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
            }
            
            .cancel-btn {
                background: transparent;
                border: 1px solid var(--mica-border);
                color: white;
            }
            
            .submit-btn {
                background: var(--accent);
                color: white;
            }
            
            /* Light theme */
            .light-theme .users-app,
            .light-theme .user-details-view,
            .light-theme .user-form-view {
                color: black;
            }
            
            .light-theme .search-box input,
            .light-theme .role-filter,
            .light-theme .form-group input,
            .light-theme .form-group select,
            .light-theme .back-btn,
            .light-theme .cancel-btn {
                color: black;
            }
            
            .light-theme .edit-user-btn {
                color: black;
            }
        `;
        
        document.head.appendChild(style);
    }
}

window.UsersApp = UsersApp;
window.usersApp = null; // Will be set when app is instantiated
