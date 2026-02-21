/**
 * BhekOS File Share Dialog - Share files with other users
 */
const FileShareDialog = {
    os: null,
    element: null,
    currentFile: null,
    
    async init(os) {
        this.os = os;
        this.createDialog();
        this.setupListeners();
        
        return this;
    },
    
    createDialog() {
        this.element = document.createElement('div');
        this.element.className = 'share-dialog';
        this.element.id = 'shareDialog';
        this.element.innerHTML = this.render();
        document.body.appendChild(this.element);
        this.addStyles();
    },
    
    render() {
        const users = this.os.modules.UserManager?.getAllUsers() || [];
        const currentUser = this.os.modules.UserManager?.getCurrentUser();
        const otherUsers = users.filter(u => u.id !== currentUser?.id);
        
        return `
            <div class="share-dialog-container">
                <div class="share-dialog-header">
                    <h3>
                        <span class="header-icon">📤</span>
                        Share File
                    </h3>
                    <button class="close-btn" onclick="FileShareDialog.hide()">✕</button>
                </div>
                
                <div class="share-dialog-content">
                    <div class="file-info" id="shareFileInfo">
                        <div class="file-icon">📄</div>
                        <div class="file-details">
                            <div class="file-name">Select a file to share</div>
                            <div class="file-meta"></div>
                        </div>
                    </div>
                    
                    <div class="share-method-tabs">
                        <button class="tab-btn active" data-tab="users" onclick="FileShareDialog.switchTab('users')">
                            👥 Share with users
                        </button>
                        <button class="tab-btn" data-tab="link" onclick="FileShareDialog.switchTab('link')">
                            🔗 Create link
                        </button>
                        <button class="tab-btn" data-tab="email" onclick="FileShareDialog.switchTab('email')">
                            📧 Email
                        </button>
                    </div>
                    
                    <div class="tab-content active" id="usersTab">
                        <div class="user-search">
                            <input type="text" placeholder="Search users..." id="userSearch">
                        </div>
                        
                        <div class="users-list" id="usersList">
                            ${otherUsers.map(user => `
                                <div class="user-item" data-userid="${user.id}">
                                    <div class="user-avatar">${user.avatar?.value || '👤'}</div>
                                    <div class="user-info">
                                        <div class="user-name">${user.name}</div>
                                        <div class="user-email">${user.email || user.username}</div>
                                    </div>
                                    <div class="user-checkbox">
                                        <input type="checkbox" class="user-select" value="${user.id}">
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        
                        <div class="share-permissions">
                            <h4>Permissions</h4>
                            <div class="permission-options">
                                <label class="permission-option">
                                    <input type="radio" name="permission" value="read" checked>
                                    <span class="permission-icon">👁️</span>
                                    <span class="permission-name">Can view</span>
                                </label>
                                <label class="permission-option">
                                    <input type="radio" name="permission" value="edit">
                                    <span class="permission-icon">✏️</span>
                                    <span class="permission-name">Can edit</span>
                                </label>
                                <label class="permission-option">
                                    <input type="radio" name="permission" value="full">
                                    <span class="permission-icon">⚙️</span>
                                    <span class="permission-name">Full control</span>
                                </label>
                            </div>
                        </div>
                        
                        <div class="share-options">
                            <label class="option-checkbox">
                                <input type="checkbox" id="notifyUsers">
                                <span>Notify users via notification</span>
                            </label>
                            <label class="option-checkbox">
                                <input type="checkbox" id="expireShare">
                                <span>Set expiration</span>
                            </label>
                            <div class="expire-options" id="expireOptions" style="display: none;">
                                <select id="expireAfter">
                                    <option value="3600000">1 hour</option>
                                    <option value="86400000">1 day</option>
                                    <option value="604800000">1 week</option>
                                    <option value="2592000000">30 days</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="tab-content" id="linkTab">
                        <div class="link-options">
                            <div class="link-permissions">
                                <h4>Link permissions</h4>
                                <select id="linkPermission">
                                    <option value="read">Anyone with link can view</option>
                                    <option value="edit">Anyone with link can edit</option>
                                    <option value="restricted">Restricted</option>
                                </select>
                            </div>
                            
                            <div class="link-protection">
                                <h4>Protection</h4>
                                <label class="option-checkbox">
                                    <input type="checkbox" id="requirePassword">
                                    <span>Require password</span>
                                </label>
                                <div class="password-field" id="linkPasswordField" style="display: none;">
                                    <input type="text" placeholder="Enter password" id="linkPassword">
                                    <button onclick="FileShareDialog.generatePassword()">Generate</button>
                                </div>
                                
                                <label class="option-checkbox">
                                    <input type="checkbox" id="setExpiration">
                                    <span>Set expiration</span>
                                </label>
                            </div>
                        </div>
                        
                        <div class="generated-link" id="generatedLink" style="display: none;">
                            <h4>Share link</h4>
                            <div class="link-display">
                                <input type="text" readonly id="shareLink">
                                <button onclick="FileShareDialog.copyLink()">Copy</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="tab-content" id="emailTab">
                        <div class="email-form">
                            <div class="form-group">
                                <label>To:</label>
                                <input type="email" placeholder="Enter email address" id="emailTo">
                            </div>
                            
                            <div class="form-group">
                                <label>Subject:</label>
                                <input type="text" value="Shared file: " id="emailSubject">
                            </div>
                            
                            <div class="form-group">
                                <label>Message (optional):</label>
                                <textarea rows="3" id="emailMessage" placeholder="Add a message..."></textarea>
                            </div>
                            
                            <div class="email-permissions">
                                <label class="option-checkbox">
                                    <input type="checkbox" id="emailCanEdit">
                                    <span>Recipient can edit</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="share-dialog-footer">
                    <button class="cancel-btn" onclick="FileShareDialog.hide()">Cancel</button>
                    <button class="share-btn" onclick="FileShareDialog.share()">Share</button>
                </div>
            </div>
        `;
    },
    
    setupListeners() {
        // User search
        const searchInput = document.getElementById('userSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterUsers(e.target.value);
            });
        }
        
        // Expiration checkbox
        const expireCheck = document.getElementById('expireShare');
        if (expireCheck) {
            expireCheck.addEventListener('change', (e) => {
                document.getElementById('expireOptions').style.display = e.target.checked ? 'block' : 'none';
            });
        }
        
        // Password checkbox
        const passwordCheck = document.getElementById('requirePassword');
        if (passwordCheck) {
            passwordCheck.addEventListener('change', (e) => {
                document.getElementById('linkPasswordField').style.display = e.target.checked ? 'block' : 'none';
            });
        }
        
        // Set expiration checkbox
        const setExpire = document.getElementById('setExpiration');
        if (setExpire) {
            setExpire.addEventListener('change', (e) => {
                // Handle link expiration
            });
        }
    },
    
    // ==================== DIALOG CONTROL ====================
    
    show(file = null) {
        this.currentFile = file;
        this.updateFileInfo();
        this.element.classList.add('visible');
    },
    
    hide() {
        this.element.classList.remove('visible');
        this.currentFile = null;
        this.resetForm();
    },
    
    resetForm() {
        document.getElementById('usersTab').innerHTML = this.renderUsersTab();
        document.getElementById('linkTab').innerHTML = this.renderLinkTab();
        document.getElementById('emailTab').innerHTML = this.renderEmailTab();
        document.getElementById('generatedLink').style.display = 'none';
    },
    
    // ==================== TAB MANAGEMENT ====================
    
    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tab + 'Tab');
        });
    },
    
    // ==================== FILE MANAGEMENT ====================
    
    setFile(file) {
        this.currentFile = file;
        this.updateFileInfo();
    },
    
    updateFileInfo() {
        const fileInfo = document.getElementById('shareFileInfo');
        if (!fileInfo || !this.currentFile) return;
        
        fileInfo.innerHTML = `
            <div class="file-icon">${this.currentFile.icon || '📄'}</div>
            <div class="file-details">
                <div class="file-name">${this.currentFile.name}</div>
                <div class="file-meta">${BhekHelpers.formatBytes(this.currentFile.size)} • Modified ${BhekHelpers.formatRelativeTime(this.currentFile.modified)}</div>
            </div>
        `;
    },
    
    // ==================== USER SHARING ====================
    
    filterUsers(query) {
        const items = document.querySelectorAll('.user-item');
        const queryLower = query.toLowerCase();
        
        items.forEach(item => {
            const name = item.querySelector('.user-name').textContent.toLowerCase();
            const email = item.querySelector('.user-email').textContent.toLowerCase();
            const matches = name.includes(queryLower) || email.includes(queryLower);
            item.style.display = matches ? 'flex' : 'none';
        });
    },
    
    getSelectedUsers() {
        const checkboxes = document.querySelectorAll('.user-select:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    },
    
    getSelectedPermission() {
        return document.querySelector('input[name="permission"]:checked')?.value || 'read';
    },
    
    // ==================== LINK SHARING ====================
    
    async generateShareLink() {
        const permission = document.getElementById('linkPermission')?.value || 'read';
        const password = document.getElementById('requirePassword')?.checked ? 
            document.getElementById('linkPassword')?.value : null;
        const expiration = document.getElementById('setExpiration')?.checked ? 
            Date.now() + 86400000 : null; // Default 1 day
        
        // Generate unique share ID
        const shareId = 'share_' + BhekHelpers.generateId();
        
        // Create share link
        const link = `${window.location.origin}/share/${shareId}`;
        
        // Store share info
        await this.os.modules.Storage.set(`share_${shareId}`, {
            file: this.currentFile,
            permission,
            password: password ? await BhekCrypto?.hashPassword(password) : null,
            expiration,
            created: Date.now(),
            createdBy: this.os.modules.UserManager?.getCurrentUser()?.id
        });
        
        return { link, shareId };
    },
    
    async createLink() {
        const { link } = await this.generateShareLink();
        
        document.getElementById('generatedLink').style.display = 'block';
        document.getElementById('shareLink').value = link;
    },
    
    copyLink() {
        const link = document.getElementById('shareLink');
        link.select();
        document.execCommand('copy');
        
        this.os.notify('Link copied', 'Share link copied to clipboard', 'success');
    },
    
    generatePassword() {
        const password = BhekHelpers.randomString(12);
        document.getElementById('linkPassword').value = password;
    },
    
    // ==================== EMAIL SHARING ====================
    
    async sendEmail() {
        const to = document.getElementById('emailTo')?.value;
        const subject = document.getElementById('emailSubject')?.value;
        const message = document.getElementById('emailMessage')?.value;
        const canEdit = document.getElementById('emailCanEdit')?.checked;
        
        if (!to || !this.isValidEmail(to)) {
            this.os.notify('Invalid email', 'Please enter a valid email address', 'error');
            return;
        }
        
        // Generate share link
        const { link } = await this.generateShareLink();
        
        // In a real app, this would send an email via backend
        console.log('Sending email:', { to, subject, message, link, canEdit });
        
        this.os.notify('Email sent', `Share link sent to ${to}`, 'success');
        this.hide();
    },
    
    // ==================== MAIN SHARE ACTION ====================
    
    async share() {
        if (!this.currentFile) {
            this.os.notify('No file', 'Please select a file to share', 'error');
            return;
        }
        
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
        
        try {
            switch(activeTab) {
                case 'users':
                    await this.shareWithUsers();
                    break;
                case 'link':
                    await this.createLink();
                    break;
                case 'email':
                    await this.sendEmail();
                    break;
            }
        } catch (error) {
            this.os.notify('Share failed', error.message, 'error');
        }
    },
    
    async shareWithUsers() {
        const userIds = this.getSelectedUsers();
        const permission = this.getSelectedPermission();
        const notify = document.getElementById('notifyUsers')?.checked;
        
        if (userIds.length === 0) {
            this.os.notify('No users selected', 'Please select at least one user', 'error');
            return;
        }
        
        // Share with each user
        for (const userId of userIds) {
            await this.os.modules.FileSystem?.shareFile(
                this.currentFile.path,
                userId,
                { permissions: permission }
            );
            
            if (notify) {
                // Send notification
                const user = this.os.modules.UserManager?.getUser(userId);
                if (user) {
                    this.os.modules.Collaboration?.sendNotification(userId, {
                        type: 'file_shared',
                        title: 'File Shared',
                        message: `${this.os.modules.UserManager?.getCurrentUser()?.name} shared "${this.currentFile.name}" with you`,
                        data: { file: this.currentFile, permission }
                    });
                }
            }
        }
        
        this.os.notify('File shared', `Shared with ${userIds.length} user(s)`, 'success');
        this.hide();
    },
    
    // ==================== UTILITY METHODS ====================
    
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    // ==================== STYLES ====================
    
    addStyles() {
        if (document.getElementById('share-dialog-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'share-dialog-styles';
        style.textContent = `
            .share-dialog {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.5);
                backdrop-filter: blur(5px);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 100000;
            }
            
            .share-dialog.visible {
                display: flex;
            }
            
            .share-dialog-container {
                width: 500px;
                max-width: 90vw;
                max-height: 80vh;
                background: var(--mica);
                backdrop-filter: var(--glass);
                border: 1px solid var(--mica-border);
                border-radius: 12px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                animation: scaleIn 0.3s;
            }
            
            .share-dialog-header {
                padding: 16px 20px;
                border-bottom: 1px solid var(--mica-border);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .share-dialog-header h3 {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 18px;
                font-weight: 500;
            }
            
            .close-btn {
                background: transparent;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                width: 32px;
                height: 32px;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .close-btn:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .share-dialog-content {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
            }
            
            .file-info {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                margin-bottom: 20px;
            }
            
            .file-icon {
                font-size: 32px;
            }
            
            .file-details {
                flex: 1;
            }
            
            .file-name {
                font-size: 16px;
                font-weight: 500;
                margin-bottom: 4px;
            }
            
            .file-meta {
                font-size: 12px;
                opacity: 0.7;
            }
            
            .share-method-tabs {
                display: flex;
                gap: 4px;
                margin-bottom: 20px;
                border-bottom: 1px solid var(--mica-border);
                padding-bottom: 10px;
            }
            
            .tab-btn {
                flex: 1;
                padding: 8px;
                background: transparent;
                border: none;
                color: white;
                font-size: 13px;
                cursor: pointer;
                border-radius: 6px;
                transition: 0.2s;
            }
            
            .tab-btn:hover {
                background: rgba(255,255,255,0.05);
            }
            
            .tab-btn.active {
                background: rgba(var(--accent-rgb), 0.2);
                color: var(--accent);
            }
            
            .tab-content {
                display: none;
            }
            
            .tab-content.active {
                display: block;
            }
            
            /* Users tab */
            .user-search {
                margin-bottom: 16px;
            }
            
            .user-search input {
                width: 100%;
                padding: 10px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 6px;
                color: white;
                font-size: 14px;
            }
            
            .users-list {
                max-height: 200px;
                overflow-y: auto;
                margin-bottom: 20px;
            }
            
            .user-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px;
                border-radius: 6px;
                cursor: pointer;
                transition: 0.2s;
            }
            
            .user-item:hover {
                background: rgba(255,255,255,0.05);
            }
            
            .user-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: var(--accent);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
            }
            
            .user-info {
                flex: 1;
            }
            
            .user-name {
                font-size: 14px;
                font-weight: 500;
                margin-bottom: 2px;
            }
            
            .user-email {
                font-size: 11px;
                opacity: 0.7;
            }
            
            .user-checkbox input {
                width: 18px;
                height: 18px;
                cursor: pointer;
            }
            
            .share-permissions {
                margin-bottom: 20px;
            }
            
            .share-permissions h4 {
                font-size: 14px;
                margin-bottom: 12px;
            }
            
            .permission-options {
                display: flex;
                gap: 12px;
            }
            
            .permission-option {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
                padding: 12px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                cursor: pointer;
                text-align: center;
            }
            
            .permission-option input {
                display: none;
            }
            
            .permission-option:has(input:checked) {
                background: rgba(var(--accent-rgb), 0.2);
                border: 1px solid var(--accent);
            }
            
            .permission-icon {
                font-size: 20px;
            }
            
            .permission-name {
                font-size: 12px;
            }
            
            .share-options {
                margin-top: 20px;
            }
            
            .option-checkbox {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 12px;
                cursor: pointer;
                font-size: 13px;
            }
            
            .expire-options {
                margin-left: 24px;
                margin-top: 8px;
            }
            
            .expire-options select {
                width: 100%;
                padding: 8px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 4px;
                color: white;
            }
            
            /* Link tab */
            .link-options {
                margin-bottom: 20px;
            }
            
            .link-options h4 {
                font-size: 14px;
                margin: 16px 0 8px;
            }
            
            .link-options select {
                width: 100%;
                padding: 10px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 6px;
                color: white;
            }
            
            .password-field {
                display: flex;
                gap: 8px;
                margin: 8px 0 12px 24px;
            }
            
            .password-field input {
                flex: 1;
                padding: 8px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 4px;
                color: white;
            }
            
            .password-field button {
                padding: 8px 12px;
                background: var(--accent);
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
            }
            
            .generated-link {
                margin-top: 20px;
                padding: 16px;
                background: rgba(76,175,80,0.1);
                border: 1px solid #4CAF50;
                border-radius: 8px;
            }
            
            .generated-link h4 {
                font-size: 14px;
                margin-bottom: 12px;
                color: #4CAF50;
            }
            
            .link-display {
                display: flex;
                gap: 8px;
            }
            
            .link-display input {
                flex: 1;
                padding: 8px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 4px;
                color: white;
            }
            
            .link-display button {
                padding: 8px 16px;
                background: #4CAF50;
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
            }
            
            /* Email tab */
            .email-form .form-group {
                margin-bottom: 16px;
            }
            
            .email-form label {
                display: block;
                margin-bottom: 4px;
                font-size: 13px;
            }
            
            .email-form input,
            .email-form textarea {
                width: 100%;
                padding: 8px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 4px;
                color: white;
                font-family: inherit;
            }
            
            .email-form textarea {
                resize: vertical;
            }
            
            .email-permissions {
                margin-top: 8px;
            }
            
            /* Footer */
            .share-dialog-footer {
                padding: 16px 20px;
                border-top: 1px solid var(--mica-border);
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            
            .cancel-btn,
            .share-btn {
                padding: 8px 20px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                cursor: pointer;
                transition: 0.2s;
            }
            
            .cancel-btn {
                background: transparent;
                border: 1px solid var(--mica-border);
                color: white;
            }
            
            .cancel-btn:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .share-btn {
                background: var(--accent);
                color: white;
            }
            
            .share-btn:hover {
                background: var(--accent-hover);
                transform: translateY(-1px);
            }
            
            /* Light theme */
            .light-theme .share-dialog {
                color: black;
            }
            
            .light-theme .close-btn {
                color: black;
            }
            
            .light-theme .tab-btn {
                color: black;
            }
            
            .light-theme .user-search input,
            .light-theme .link-options select,
            .light-theme .password-field input,
            .light-theme .email-form input,
            .light-theme .email-form textarea,
            .light-theme .expire-options select {
                color: black;
            }
            
            .light-theme .cancel-btn {
                color: black;
            }
        `;
        
        document.head.appendChild(style);
    }
};

window.FileShareDialog = FileShareDialog;
