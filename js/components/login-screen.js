/**
 * BhekOS Login Screen Component - User login interface with emoji icons
 */
const LoginScreen = {
    os: null,
    element: null,
    
    async init(os) {
        this.os = os;
        this.element = document.getElementById('login-screen');
        
        return this;
    },
    
    show() {
        if (!this.element) {
            this.createLoginScreen();
        }
        
        this.element.style.display = 'flex';
        
        setTimeout(() => {
            document.getElementById('login-username')?.focus();
        }, 100);
    },
    
    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    },
    
    createLoginScreen() {
        this.element = document.createElement('div');
        this.element.id = 'login-screen';
        
        const users = this.os.modules.UserManager?.getAllUsers() || [];
        
        this.element.innerHTML = `
            <div class="login-screen-container">
                <div class="login-screen-background"></div>
                
                <div class="login-screen-content">
                    <div class="login-screen-header">
                        <div class="login-screen-logo">🖥️</div>
                        <h1 class="login-screen-title">BhekOS</h1>
                        <p class="login-screen-subtitle">Sign in to your account</p>
                    </div>
                    
                    <div class="login-screen-users">
                        ${users.map(user => `
                            <div class="login-user-card" data-username="${user.username}">
                                <div class="login-user-avatar">${user.avatar?.value || '👤'}</div>
                                <div class="login-user-name">${user.name}</div>
                                <div class="login-user-role">${this.getRoleIcon(user.role)} ${user.role}</div>
                            </div>
                        `).join('')}
                        
                        <div class="login-user-card other-user">
                            <div class="login-user-avatar">➕</div>
                            <div class="login-user-name">Other User</div>
                            <div class="login-user-role">👤 Enter credentials</div>
                        </div>
                    </div>
                    
                    <div class="login-screen-form">
                        <div class="input-with-icon">
                            <span class="input-icon">👤</span>
                            <input type="text" 
                                   class="login-input" 
                                   id="login-username" 
                                   placeholder="Username"
                                   autocomplete="off">
                        </div>
                        
                        <div class="input-with-icon">
                            <span class="input-icon">🔒</span>
                            <input type="password" 
                                   class="login-input" 
                                   id="login-password" 
                                   placeholder="Password"
                                   onkeydown="if(event.key === 'Enter') LoginScreen.login()">
                        </div>
                        
                        <div class="login-options">
                            <label class="login-checkbox">
                                <input type="checkbox" id="login-remember">
                                <span class="checkbox-emoji">✅</span>
                                <span>Remember me</span>
                            </label>
                            
                            <a href="#" class="login-forgot" onclick="LoginScreen.forgotPassword()">
                                🔑 Forgot password?
                            </a>
                        </div>
                        
                        <button class="login-button" onclick="LoginScreen.login()">
                            <span class="button-icon">🔓</span> Sign In
                        </button>
                        
                        <div id="login-error" class="login-error"></div>
                    </div>
                    
                    <div class="login-screen-footer">
                        <button class="login-footer-btn" onclick="LoginScreen.shutdown()">
                            <span class="btn-icon">⏻</span> Shut Down
                        </button>
                        <button class="login-footer-btn" onclick="LoginScreen.restart()">
                            <span class="btn-icon">🔄</span> Restart
                        </button>
                        <button class="login-footer-btn" onclick="LoginScreen.accessibility()">
                            <span class="btn-icon">♿</span> Accessibility
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.element);
        this.addStyles();
        this.setupEventListeners();
    },
    
    getRoleIcon(role) {
        const icons = {
            'admin': '👑',
            'user': '👤',
            'guest': '👥'
        };
        return icons[role] || '👤';
    },
    
    setupEventListeners() {
        this.element.querySelectorAll('.login-user-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const username = card.dataset.username;
                if (username) {
                    document.getElementById('login-username').value = username;
                    document.getElementById('login-password').focus();
                } else {
                    document.getElementById('login-username').value = '';
                    document.getElementById('login-username').focus();
                }
                
                this.element.querySelectorAll('.login-user-card').forEach(c => {
                    c.classList.remove('selected');
                });
                card.classList.add('selected');
            });
        });
    },
    
    async login() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const remember = document.getElementById('login-remember')?.checked || false;
        const errorEl = document.getElementById('login-error');
        
        if (!username || !password) {
            errorEl.innerHTML = '⚠️ Please enter username and password';
            return;
        }
        
        try {
            errorEl.innerHTML = '⏳ Signing in...';
            
            const result = await this.os.modules.Security?.login(username, password, remember);
            
            if (result?.requires2FA) {
                this.showTwoFactorPrompt(result.userId, remember);
            } else {
                this.hide();
                this.os.notify('Welcome', `👋 Welcome back, ${result?.user?.name || username}!`, 'success');
            }
        } catch (error) {
            errorEl.innerHTML = `❌ ${error.message}`;
            document.getElementById('login-password').value = '';
            document.getElementById('login-password').focus();
            
            const form = document.querySelector('.login-screen-form');
            form.classList.add('shake');
            setTimeout(() => form.classList.remove('shake'), 500);
        }
    },
    
    showTwoFactorPrompt(userId, remember) {
        const form = document.querySelector('.login-screen-form');
        
        form.innerHTML = `
            <h3 style="margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
                <span>🔐</span> Two-Factor Authentication
            </h3>
            <p style="margin-bottom: 20px; opacity: 0.8;">
                Enter the verification code from your authenticator app
            </p>
            
            <div class="input-with-icon">
                <span class="input-icon">🔢</span>
                <input type="text" 
                       class="login-input" 
                       id="2fa-code" 
                       placeholder="6-digit code"
                       maxlength="6"
                       autocomplete="off"
                       onkeydown="if(event.key === 'Enter') LoginScreen.verifyTwoFactor('${userId}', ${remember})">
            </div>
            
            <button class="login-button" onclick="LoginScreen.verifyTwoFactor('${userId}', ${remember})">
                <span class="button-icon">✓</span> Verify
            </button>
            
            <button class="login-button secondary" onclick="LoginScreen.backToLogin()" style="margin-top: 10px;">
                <span class="button-icon">←</span> Back
            </button>
            
            <div id="login-error" class="login-error"></div>
        `;
        
        document.getElementById('2fa-code').focus();
    },
    
    async verifyTwoFactor(userId, remember) {
        const code = document.getElementById('2fa-code').value;
        const errorEl = document.getElementById('login-error');
        
        if (code.length !== 6 || !/^\d+$/.test(code)) {
            errorEl.innerHTML = '⚠️ Please enter a valid 6-digit code';
            return;
        }
        
        try {
            const result = await this.os.modules.Security?.verify2FA(userId, code, remember);
            this.hide();
            this.os.notify('Welcome', `👋 Welcome back, ${result?.user?.name}!`, 'success');
        } catch (error) {
            errorEl.innerHTML = `❌ ${error.message}`;
        }
    },
    
    backToLogin() {
        this.element.remove();
        this.createLoginScreen();
    },
    
    forgotPassword() {
        this.os.notify('Password Reset', '🔑 Contact your system administrator', 'info');
    },
    
    accessibility() {
        this.os.notify('Accessibility', '♿ Accessibility options coming soon', 'info');
    },
    
    shutdown() {
        this.os.shutdown?.();
    },
    
    restart() {
        this.os.restart?.();
    },
    
    // ==================== STYLES ====================
    
    addStyles() {
        if (document.getElementById('login-screen-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'login-screen-styles';
        style.textContent = `
            #login-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                z-index: 99998;
                font-family: var(--font);
            }
            
            .login-screen-container {
                width: 100%;
                height: 100%;
                position: relative;
            }
            
            .login-screen-background {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            
            .login-screen-content {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 90%;
                max-width: 500px;
                background: rgba(255,255,255,0.1);
                backdrop-filter: blur(20px);
                border-radius: 20px;
                padding: 40px;
                color: white;
                border: 1px solid rgba(255,255,255,0.2);
                box-shadow: 0 25px 50px rgba(0,0,0,0.3);
            }
            
            .login-screen-header {
                text-align: center;
                margin-bottom: 40px;
            }
            
            .login-screen-logo {
                font-size: 64px;
                margin-bottom: 20px;
                animation: float 3s ease-in-out infinite;
            }
            
            @keyframes float {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
            }
            
            .login-screen-title {
                font-size: 32px;
                font-weight: 300;
                margin-bottom: 10px;
            }
            
            .login-screen-subtitle {
                opacity: 0.8;
            }
            
            .login-screen-users {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                gap: 15px;
                margin-bottom: 30px;
            }
            
            .login-user-card {
                padding: 15px 10px;
                background: rgba(255,255,255,0.1);
                border-radius: 10px;
                text-align: center;
                cursor: pointer;
                transition: 0.2s;
                border: 2px solid transparent;
            }
            
            .login-user-card:hover {
                background: rgba(255,255,255,0.15);
                transform: translateY(-2px);
            }
            
            .login-user-card.selected {
                border-color: white;
                background: rgba(255,255,255,0.2);
                box-shadow: 0 0 20px rgba(255,255,255,0.3);
            }
            
            .login-user-avatar {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: var(--accent);
                margin: 0 auto 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            }
            
            .login-user-name {
                font-size: 14px;
                font-weight: 500;
                margin-bottom: 4px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .login-user-role {
                font-size: 11px;
                opacity: 0.7;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
            }
            
            .login-screen-form {
                animation: fadeIn 0.5s;
            }
            
            .input-with-icon {
                position: relative;
                margin-bottom: 15px;
            }
            
            .input-icon {
                position: absolute;
                left: 12px;
                top: 50%;
                transform: translateY(-50%);
                font-size: 16px;
                opacity: 0.7;
                z-index: 1;
            }
            
            .login-input {
                width: 100%;
                padding: 15px 15px 15px 40px;
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 8px;
                color: white;
                font-size: 16px;
                transition: 0.2s;
            }
            
            .login-input:focus {
                outline: none;
                border-color: white;
                background: rgba(255,255,255,0.15);
                box-shadow: 0 0 15px rgba(255,255,255,0.2);
            }
            
            .login-input::placeholder {
                color: rgba(255,255,255,0.5);
            }
            
            .login-options {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                font-size: 14px;
            }
            
            .login-checkbox {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
            }
            
            .login-checkbox input {
                display: none;
            }
            
            .checkbox-emoji {
                font-size: 18px;
                opacity: 0.5;
                transition: 0.2s;
            }
            
            .login-checkbox input:checked + .checkbox-emoji {
                opacity: 1;
                filter: drop-shadow(0 0 5px #4CAF50);
            }
            
            .login-forgot {
                color: rgba(255,255,255,0.8);
                text-decoration: none;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .login-forgot:hover {
                color: white;
                text-decoration: underline;
            }
            
            .login-button {
                width: 100%;
                padding: 15px;
                background: white;
                border: none;
                border-radius: 8px;
                color: #764ba2;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            
            .login-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 20px rgba(0,0,0,0.2);
            }
            
            .login-button.secondary {
                background: transparent;
                color: white;
                border: 1px solid rgba(255,255,255,0.3);
            }
            
            .login-button.secondary:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .button-icon {
                font-size: 18px;
            }
            
            .login-error {
                color: #ff6b6b;
                margin-top: 15px;
                text-align: center;
                font-size: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
            }
            
            .login-screen-footer {
                margin-top: 30px;
                display: flex;
                gap: 10px;
                justify-content: center;
            }
            
            .login-footer-btn {
                padding: 8px 16px;
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 6px;
                color: white;
                cursor: pointer;
                font-size: 13px;
                transition: 0.2s;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .login-footer-btn:hover {
                background: rgba(255,255,255,0.15);
                transform: translateY(-1px);
            }
            
            .btn-icon {
                font-size: 14px;
            }
            
            .shake {
                animation: shake 0.5s;
            }
            
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                20%, 40%, 60%, 80% { transform: translateX(5px); }
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            /* Light theme adjustments */
            .light-theme .login-screen-content {
                background: rgba(255,255,255,0.9);
                color: #333;
            }
            
            .light-theme .login-input {
                background: rgba(0,0,0,0.05);
                border-color: rgba(0,0,0,0.1);
                color: #333;
            }
            
            .light-theme .login-input::placeholder {
                color: rgba(0,0,0,0.3);
            }
            
            .light-theme .login-user-card {
                background: rgba(0,0,0,0.05);
            }
            
            .light-theme .login-user-card:hover {
                background: rgba(0,0,0,0.08);
            }
            
            .light-theme .login-user-card.selected {
                background: rgba(var(--accent-rgb), 0.2);
                border-color: var(--accent);
            }
            
            .light-theme .login-footer-btn {
                color: #333;
                border-color: rgba(0,0,0,0.1);
            }
        `;
        
        document.head.appendChild(style);
    }
};

window.LoginScreen = LoginScreen;
