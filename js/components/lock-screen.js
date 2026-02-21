/**
 * BhekOS Lock Screen Component - System lock screen
 */
const LockScreen = {
    os: null,
    element: null,
    
    async init(os) {
        this.os = os;
        this.element = document.getElementById('lock-screen');
        this.setupEventListeners();
        
        return this;
    },
    
    show() {
        const user = this.os.modules.UserManager?.getCurrentUser();
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const date = new Date().toLocaleDateString([], { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
        });
        
        this.element.innerHTML = `
            <div class="lock-screen-container">
                <div class="lock-screen-background"></div>
                <div class="lock-screen-content">
                    <div class="lock-screen-time">${time}</div>
                    <div class="lock-screen-date">${date}</div>
                    
                    <div class="lock-screen-user">
                        <div class="lock-screen-avatar">
                            ${user?.avatar?.value || '👤'}
                        </div>
                        <div class="lock-screen-username">${user?.name || 'User'}</div>
                        <div class="lock-screen-email">${user?.email || 'user@bhekos.local'}</div>
                    </div>
                    
                    <div class="lock-screen-input-container">
                        <input type="password" 
                               class="lock-screen-input" 
                               id="lock-password" 
                               placeholder="Password"
                               autofocus>
                        <button class="lock-screen-submit" id="unlock-btn">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="lock-screen-footer">
                        <button class="lock-screen-footer-btn" onclick="LockScreen.switchUser()">
                            👥 Switch User
                        </button>
                        <button class="lock-screen-footer-btn" onclick="LockScreen.shutdown()">
                            ⏻ Shut Down
                        </button>
                        <button class="lock-screen-footer-btn" onclick="LockScreen.restart()">
                            🔄 Restart
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.element.style.display = 'flex';
        
        setTimeout(() => {
            document.getElementById('lock-password')?.focus();
        }, 100);
        
        this.addStyles();
    },
    
    hide() {
        this.element.style.display = 'none';
    },
    
    async unlock() {
        const input = document.getElementById('lock-password');
        const password = input.value;
        
        try {
            const success = await this.os.modules.Security?.unlock(password);
            if (success) {
                this.hide();
                this.os.notify('Security', 'System unlocked', 'success');
            } else {
                this.showError('Wrong password');
            }
        } catch (error) {
            this.showError(error.message);
        }
    },
    
    showError(message) {
        const input = document.getElementById('lock-password');
        input.value = '';
        input.placeholder = message;
        input.classList.add('error');
        
        setTimeout(() => {
            input.classList.remove('error');
            input.placeholder = 'Password';
        }, 2000);
    },
    
    switchUser() {
        this.hide();
        this.os.modules.LoginScreen?.show();
    },
    
    shutdown() {
        this.os.shutdown?.();
    },
    
    restart() {
        this.os.restart?.();
    },
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.element.style.display === 'flex') {
                this.unlock();
            }
        });
    },
    
    // ==================== STYLES ====================
    
    addStyles() {
        if (document.getElementById('lock-screen-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'lock-screen-styles';
        style.textContent = `
            #lock-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                z-index: 99999;
                display: none;
                font-family: var(--font);
            }
            
            .lock-screen-container {
                width: 100%;
                height: 100%;
                position: relative;
            }
            
            .lock-screen-background {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                filter: blur(10px);
                transform: scale(1.1);
            }
            
            .lock-screen-content {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                color: white;
                width: 100%;
                max-width: 400px;
                padding: 20px;
            }
            
            .lock-screen-time {
                font-size: 84px;
                font-weight: 300;
                margin-bottom: 10px;
                text-shadow: 0 2px 10px rgba(0,0,0,0.3);
            }
            
            .lock-screen-date {
                font-size: 24px;
                margin-bottom: 40px;
                opacity: 0.9;
                text-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }
            
            .lock-screen-user {
                margin-bottom: 40px;
            }
            
            .lock-screen-avatar {
                width: 100px;
                height: 100px;
                border-radius: 50%;
                background: rgba(255,255,255,0.2);
                margin: 0 auto 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 48px;
                border: 3px solid white;
                box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            }
            
            .lock-screen-username {
                font-size: 28px;
                font-weight: 500;
                margin-bottom: 5px;
            }
            
            .lock-screen-email {
                font-size: 16px;
                opacity: 0.8;
            }
            
            .lock-screen-input-container {
                display: flex;
                gap: 10px;
                background: rgba(255,255,255,0.2);
                border-radius: 50px;
                padding: 5px;
                backdrop-filter: blur(10px);
                border: 2px solid transparent;
                transition: 0.2s;
            }
            
            .lock-screen-input-container:focus-within {
                border-color: white;
                background: rgba(255,255,255,0.25);
            }
            
            .lock-screen-input {
                flex: 1;
                background: transparent;
                border: none;
                padding: 15px 20px;
                color: white;
                font-size: 16px;
                outline: none;
            }
            
            .lock-screen-input::placeholder {
                color: rgba(255,255,255,0.7);
            }
            
            .lock-screen-input.error {
                animation: shake 0.5s;
            }
            
            .lock-screen-submit {
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background: white;
                border: none;
                color: #764ba2;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: 0.2s;
            }
            
            .lock-screen-submit:hover {
                transform: scale(1.05);
                background: #f0f0f0;
            }
            
            .lock-screen-footer {
                margin-top: 60px;
                display: flex;
                gap: 10px;
                justify-content: center;
            }
            
            .lock-screen-footer-btn {
                padding: 10px 20px;
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 30px;
                color: white;
                cursor: pointer;
                font-size: 14px;
                backdrop-filter: blur(5px);
                transition: 0.2s;
            }
            
            .lock-screen-footer-btn:hover {
                background: rgba(255,255,255,0.2);
                transform: translateY(-2px);
            }
            
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                20%, 40%, 60%, 80% { transform: translateX(5px); }
            }
        `;
        
        document.head.appendChild(style);
    }
};

window.LockScreen = LockScreen;
