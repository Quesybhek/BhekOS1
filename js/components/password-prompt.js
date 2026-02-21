/**
 * BhekOS Password Prompt Component - Secure password input dialog
 */
const PasswordPrompt = {
    os: null,
    prompts: new Map(),
    
    init(os) {
        this.os = os;
        return this;
    },
    
    /**
     * Show password prompt
     * @param {Object} options - Prompt options
     * @returns {Promise<string>} Password
     */
    show(options = {}) {
        return new Promise((resolve, reject) => {
            const {
                title = 'Authentication Required',
                message = 'Enter your password to continue',
                confirmText = 'Confirm',
                cancelText = 'Cancel',
                requireReason = false,
                appName = null,
                action = null,
                icon = '🔐'
            } = options;
            
            const promptId = 'prompt_' + BhekHelpers.generateId();
            
            const promptHtml = `
                <div class="password-prompt-overlay" id="${promptId}">
                    <div class="password-prompt">
                        <div class="password-prompt-header">
                            <div class="prompt-header-icon">${icon}</div>
                            <h3>${title}</h3>
                            <button class="password-prompt-close" onclick="PasswordPrompt.close('${promptId}')">✕</button>
                        </div>
                        
                        <div class="password-prompt-content">
                            <p>${message}</p>
                            
                            ${appName ? `
                                <div class="password-prompt-app">
                                    <span class="app-icon">${this.getAppIcon(appName)}</span>
                                    <span>${appName}</span>
                                </div>
                            ` : ''}
                            
                            ${action ? `
                                <div class="password-prompt-action">
                                    <span class="action-icon">⚡</span>
                                    <span>${action}</span>
                                </div>
                            ` : ''}
                            
                            ${requireReason ? `
                                <textarea class="password-prompt-reason" 
                                          id="${promptId}-reason"
                                          placeholder="Reason for access (optional)"
                                          rows="3"></textarea>
                            ` : ''}
                            
                            <div class="password-input-container">
                                <input type="password" 
                                       class="password-prompt-input" 
                                       id="${promptId}-input" 
                                       placeholder="Enter password"
                                       autofocus>
                                <button class="password-toggle" onclick="PasswordPrompt.togglePassword('${promptId}')">👁️</button>
                            </div>
                            
                            <div class="caps-lock-warning" id="${promptId}-caps" style="display: none;">
                                ⚠️ Caps Lock is on
                            </div>
                            
                            <div class="password-prompt-error" id="${promptId}-error"></div>
                            
                            ${options.showForgot ? `
                                <div class="forgot-password">
                                    <a href="#" onclick="PasswordPrompt.forgotPassword('${promptId}')">Forgot password?</a>
                                </div>
                            ` : ''}
                        </div>
                        
                        <div class="password-prompt-footer">
                            <button class="password-prompt-btn cancel" onclick="PasswordPrompt.close('${promptId}')">
                                ${cancelText}
                            </button>
                            <button class="password-prompt-btn confirm" onclick="PasswordPrompt.submit('${promptId}')">
                                ${confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', promptHtml);
            
            this.prompts.set(promptId, { resolve, reject, options });
            
            setTimeout(() => {
                document.getElementById(`${promptId}-input`).focus();
                this.checkCapsLock(promptId);
            }, 100);
            
            document.getElementById(`${promptId}-input`).addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    this.submit(promptId);
                }
                this.checkCapsLock(promptId);
            });
            
            this.addStyles();
        });
    },
    
    async submit(promptId) {
        const input = document.getElementById(`${promptId}-input`);
        const errorEl = document.getElementById(`${promptId}-error`);
        const reasonEl = document.getElementById(`${promptId}-reason`);
        const password = input.value;
        
        if (!password) {
            errorEl.textContent = 'Password is required';
            return;
        }
        
        const prompt = this.prompts.get(promptId);
        if (prompt) {
            // Validate password if validator provided
            if (prompt.options.validate) {
                const isValid = await prompt.options.validate(password);
                if (!isValid) {
                    errorEl.textContent = 'Invalid password';
                    input.value = '';
                    input.focus();
                    return;
                }
            }
            
            prompt.resolve({
                password,
                reason: reasonEl?.value
            });
            
            this.prompts.delete(promptId);
            document.getElementById(promptId).remove();
        }
    },
    
    close(promptId) {
        const prompt = this.prompts.get(promptId);
        if (prompt) {
            prompt.reject(new Error('Prompt cancelled'));
            this.prompts.delete(promptId);
        }
        document.getElementById(promptId)?.remove();
    },
    
    togglePassword(promptId) {
        const input = document.getElementById(`${promptId}-input`);
        const type = input.type === 'password' ? 'text' : 'password';
        input.type = type;
    },
    
    checkCapsLock(promptId) {
        const event = window.event;
        const capsWarning = document.getElementById(`${promptId}-caps`);
        if (capsWarning) {
            const isCapsOn = event?.getModifierState('CapsLock');
            capsWarning.style.display = isCapsOn ? 'block' : 'none';
        }
    },
    
    forgotPassword(promptId) {
        this.close(promptId);
        this.os.notify('Password Reset', 'Contact your system administrator', 'info');
    },
    
    getAppIcon(appName) {
        const icons = {
            'Settings': '⚙️',
            'Terminal': '💻',
            'File Explorer': '📁',
            'App Store': '📱',
            'System': '🖥️'
        };
        return icons[appName] || '📱';
    },
    
    // ==================== STYLES ====================
    
    addStyles() {
        if (document.getElementById('password-prompt-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'password-prompt-styles';
        style.textContent = `
            .password-prompt-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.5);
                backdrop-filter: blur(5px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 100000;
                animation: fadeIn 0.2s;
            }
            
            .password-prompt {
                width: 90%;
                max-width: 400px;
                background: var(--mica);
                backdrop-filter: var(--glass);
                border: 1px solid var(--mica-border);
                border-radius: 12px;
                overflow: hidden;
                animation: slideUp 0.3s;
                box-shadow: 0 25px 50px rgba(0,0,0,0.5);
            }
            
            .password-prompt-header {
                padding: 20px;
                background: rgba(0,0,0,0.3);
                border-bottom: 1px solid var(--mica-border);
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .prompt-header-icon {
                font-size: 24px;
            }
            
            .password-prompt-header h3 {
                flex: 1;
                font-size: 18px;
                font-weight: 500;
            }
            
            .password-prompt-close {
                background: transparent;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                width: 30px;
                height: 30px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .password-prompt-close:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .password-prompt-content {
                padding: 20px;
            }
            
            .password-prompt-content p {
                margin-bottom: 15px;
                opacity: 0.9;
            }
            
            .password-prompt-app {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                margin-bottom: 15px;
            }
            
            .app-icon {
                font-size: 20px;
            }
            
            .password-prompt-action {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px;
                background: rgba(255,193,7,0.1);
                border: 1px solid rgba(255,193,7,0.3);
                border-radius: 8px;
                margin-bottom: 15px;
                color: #ffc107;
            }
            
            .password-prompt-reason {
                width: 100%;
                padding: 12px;
                background: rgba(255,255,255,0.05);
                border: 1px solid var(--mica-border);
                border-radius: 8px;
                color: white;
                font-size: 14px;
                margin-bottom: 15px;
                resize: vertical;
                font-family: inherit;
            }
            
            .password-prompt-reason:focus {
                outline: none;
                border-color: var(--accent);
            }
            
            .password-input-container {
                position: relative;
                margin-bottom: 10px;
            }
            
            .password-prompt-input {
                width: 100%;
                padding: 12px 40px 12px 12px;
                background: rgba(255,255,255,0.05);
                border: 1px solid var(--mica-border);
                border-radius: 8px;
                color: white;
                font-size: 16px;
            }
            
            .password-prompt-input:focus {
                outline: none;
                border-color: var(--accent);
            }
            
            .password-toggle {
                position: absolute;
                right: 8px;
                top: 50%;
                transform: translateY(-50%);
                background: transparent;
                border: none;
                color: white;
                cursor: pointer;
                font-size: 18px;
                padding: 4px;
                border-radius: 4px;
            }
            
            .password-toggle:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .caps-lock-warning {
                padding: 8px 12px;
                background: rgba(255,193,7,0.1);
                border: 1px solid #ffc107;
                border-radius: 6px;
                color: #ffc107;
                font-size: 12px;
                margin-bottom: 10px;
            }
            
            .password-prompt-error {
                margin-top: 10px;
                color: #ff5252;
                font-size: 13px;
                min-height: 20px;
            }
            
            .forgot-password {
                margin-top: 15px;
                text-align: center;
            }
            
            .forgot-password a {
                color: var(--accent);
                text-decoration: none;
                font-size: 13px;
            }
            
            .forgot-password a:hover {
                text-decoration: underline;
            }
            
            .password-prompt-footer {
                padding: 20px;
                background: rgba(0,0,0,0.2);
                border-top: 1px solid var(--mica-border);
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            
            .password-prompt-btn {
                padding: 10px 20px;
                border-radius: 6px;
                border: none;
                font-size: 14px;
                cursor: pointer;
                transition: 0.2s;
            }
            
            .password-prompt-btn.cancel {
                background: transparent;
                border: 1px solid var(--mica-border);
                color: white;
            }
            
            .password-prompt-btn.cancel:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .password-prompt-btn.confirm {
                background: var(--accent);
                color: white;
            }
            
            .password-prompt-btn.confirm:hover {
                background: var(--accent-hover);
                transform: translateY(-1px);
            }
            
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            /* Light theme */
            .light-theme .password-prompt {
                color: black;
            }
            
            .light-theme .password-prompt-close {
                color: black;
            }
            
            .light-theme .password-prompt-input {
                background: white;
                border-color: #ddd;
                color: black;
            }
            
            .light-theme .password-toggle {
                color: #666;
            }
            
            .light-theme .password-prompt-btn.cancel {
                color: black;
            }
        `;
        
        document.head.appendChild(style);
    }
};

window.PasswordPrompt = PasswordPrompt;
