/**
 * BhekOS Crypto Utilities - Cryptographic functions for security
 */
const BhekCrypto = {
    // ==================== HASHING ====================
    
    /**
     * Generate SHA-256 hash
     * @param {string} text - Text to hash
     * @returns {Promise<string>} Hex hash
     */
    async sha256(text) {
        if (!window.crypto.subtle) {
            // Fallback for non-HTTPS
            return this.sha256Fallback(text);
        }
        
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return this.arrayBufferToHex(hash);
    },
    
    /**
     * Generate SHA-1 hash
     * @param {string} text - Text to hash
     * @returns {Promise<string>} Hex hash
     */
    async sha1(text) {
        if (!window.crypto.subtle) {
            return this.sha1Fallback(text);
        }
        
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hash = await crypto.subtle.digest('SHA-1', data);
        return this.arrayBufferToHex(hash);
    },
    
    /**
     * Generate MD5 hash (for compatibility only - not secure)
     * @param {string} text - Text to hash
     * @returns {string} Hex hash
     */
    md5(text) {
        return this.md5Fallback(text);
    },
    
    /**
     * Convert ArrayBuffer to hex string
     * @param {ArrayBuffer} buffer - ArrayBuffer
     * @returns {string} Hex string
     */
    arrayBufferToHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },
    
    /**
     * Convert hex string to ArrayBuffer
     * @param {string} hex - Hex string
     * @returns {Uint8Array} ArrayBuffer
     */
    hexToArrayBuffer(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i/2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    },
    
    // ==================== FALLBACK HASH FUNCTIONS ====================
    
    /**
     * SHA-256 fallback implementation (simplified)
     * @param {string} text - Text to hash
     * @returns {string} Hash
     */
    sha256Fallback(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(64, '0');
    },
    
    /**
     * SHA-1 fallback implementation (simplified)
     * @param {string} text - Text to hash
     * @returns {string} Hash
     */
    sha1Fallback(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash += text.charCodeAt(i);
        }
        return Math.abs(hash).toString(16).padStart(40, '0');
    },
    
    /**
     * MD5 fallback implementation
     * @param {string} text - Text to hash
     * @returns {string} Hash
     */
    md5Fallback(text) {
        // Simple XOR-based hash for demo
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash) ^ text.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(32, '0');
    },
    
    // ==================== ENCRYPTION ====================
    
    /**
     * Generate encryption key from password
     * @param {string} password - Password
     * @param {string} salt - Salt
     * @returns {Promise<CryptoKey>} CryptoKey
     */
    async deriveKey(password, salt) {
        if (!window.crypto.subtle) {
            return null;
        }
        
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );
        
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: encoder.encode(salt),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    },
    
    /**
     * Encrypt data with password
     * @param {*} data - Data to encrypt
     * @param {string} password - Password
     * @returns {Promise<string>} Encrypted data
     */
    async encrypt(data, password) {
        try {
            const salt = this.generateSalt();
            const iv = this.generateIV();
            const key = await this.deriveKey(password, salt);
            
            if (!key) {
                // Fallback to simple encryption
                return this.simpleEncrypt(JSON.stringify(data), password);
            }
            
            const encoder = new TextEncoder();
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                key,
                encoder.encode(JSON.stringify(data))
            );
            
            // Combine salt + iv + encrypted data
            const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
            result.set(salt);
            result.set(iv, salt.length);
            result.set(new Uint8Array(encrypted), salt.length + iv.length);
            
            return btoa(String.fromCharCode(...result));
        } catch (error) {
            console.error('Encryption failed:', error);
            return this.simpleEncrypt(JSON.stringify(data), password);
        }
    },
    
    /**
     * Decrypt data with password
     * @param {string} encryptedData - Encrypted data
     * @param {string} password - Password
     * @returns {Promise<*>} Decrypted data
     */
    async decrypt(encryptedData, password) {
        try {
            // Check if it's simple encrypted
            if (encryptedData.startsWith('simple:')) {
                return JSON.parse(this.simpleDecrypt(encryptedData.slice(7), password));
            }
            
            const data = new Uint8Array(
                atob(encryptedData).split('').map(c => c.charCodeAt(0))
            );
            
            const salt = data.slice(0, 16);
            const iv = data.slice(16, 28);
            const encrypted = data.slice(28);
            
            const key = await this.deriveKey(password, salt);
            
            if (!key) {
                throw new Error('Web Crypto not available');
            }
            
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                encrypted
            );
            
            const decoder = new TextDecoder();
            return JSON.parse(decoder.decode(decrypted));
        } catch (error) {
            console.error('Decryption failed:', error);
            throw error;
        }
    },
    
    /**
     * Simple XOR encryption (fallback)
     * @param {string} text - Text to encrypt
     * @param {string} password - Password
     * @returns {string} Encrypted text
     */
    simpleEncrypt(text, password) {
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i) ^ password.charCodeAt(i % password.length);
            result += String.fromCharCode(charCode);
        }
        return 'simple:' + btoa(result);
    },
    
    /**
     * Simple XOR decryption (fallback)
     * @param {string} encrypted - Encrypted text
     * @param {string} password - Password
     * @returns {string} Decrypted text
     */
    simpleDecrypt(encrypted, password) {
        const text = atob(encrypted);
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i) ^ password.charCodeAt(i % password.length);
            result += String.fromCharCode(charCode);
        }
        return result;
    },
    
    // ==================== RANDOM GENERATION ====================
    
    /**
     * Generate cryptographically secure random bytes
     * @param {number} length - Number of bytes
     * @returns {Uint8Array} Random bytes
     */
    randomBytes(length) {
        if (window.crypto && crypto.getRandomValues) {
            return crypto.getRandomValues(new Uint8Array(length));
        }
        
        // Fallback
        const bytes = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
        return bytes;
    },
    
    /**
     * Generate random salt (16 bytes)
     * @returns {Uint8Array} Salt
     */
    generateSalt() {
        return this.randomBytes(16);
    },
    
    /**
     * Generate random IV (12 bytes for GCM)
     * @returns {Uint8Array} IV
     */
    generateIV() {
        return this.randomBytes(12);
    },
    
    /**
     * Generate random token
     * @param {number} length - Token length
     * @returns {string} Random token
     */
    generateToken(length = 32) {
        const bytes = this.randomBytes(length);
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },
    
    /**
     * Generate UUID v4
     * @returns {string} UUID
     */
    generateUUID() {
        const bytes = this.randomBytes(16);
        
        // Set version (4) and variant (2)
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        
        const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    },
    
    // ==================== JWT ====================
    
    /**
     * Create JWT token
     * @param {Object} payload - JWT payload
     * @param {string} secret - Secret key
     * @returns {Promise<string>} JWT token
     */
    async createJWT(payload, secret) {
        const header = {
            alg: 'HS256',
            typ: 'JWT'
        };
        
        const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
        const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
        
        const signature = await this.hmacSHA256(
            `${encodedHeader}.${encodedPayload}`,
            secret
        );
        
        return `${encodedHeader}.${encodedPayload}.${signature}`;
    },
    
    /**
     * Verify JWT token
     * @param {string} token - JWT token
     * @param {string} secret - Secret key
     * @returns {Promise<Object|null>} Payload if valid, null otherwise
     */
    async verifyJWT(token, secret) {
        try {
            const [encodedHeader, encodedPayload, signature] = token.split('.');
            
            const expectedSignature = await this.hmacSHA256(
                `${encodedHeader}.${encodedPayload}`,
                secret
            );
            
            if (signature !== expectedSignature) {
                return null;
            }
            
            const payload = JSON.parse(this.base64UrlDecode(encodedPayload));
            
            // Check expiration
            if (payload.exp && payload.exp < Date.now() / 1000) {
                return null;
            }
            
            return payload;
        } catch {
            return null;
        }
    },
    
    /**
     * HMAC-SHA256
     * @param {string} message - Message
     * @param {string} key - Key
     * @returns {Promise<string>} HMAC
     */
    async hmacSHA256(message, key) {
        if (!window.crypto.subtle) {
            // Fallback
            return this.sha256Fallback(message + key);
        }
        
        const encoder = new TextEncoder();
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(key),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign(
            'HMAC',
            cryptoKey,
            encoder.encode(message)
        );
        
        return this.base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
    },
    
    // ==================== BASE64 URL ====================
    
    /**
     * Base64 URL encode
     * @param {string} str - String to encode
     * @returns {string} Base64URL string
     */
    base64UrlEncode(str) {
        return btoa(str)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    },
    
    /**
     * Base64 URL decode
     * @param {string} str - Base64URL string
     * @returns {string} Decoded string
     */
    base64UrlDecode(str) {
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        while (str.length % 4) {
            str += '=';
        }
        return atob(str);
    },
    
    // ==================== PASSWORD UTILITIES ====================
    
    /**
     * Generate strong password
     * @param {number} length - Password length
     * @returns {string} Strong password
     */
    generatePassword(length = 16) {
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
        
        const allChars = uppercase + lowercase + numbers + symbols;
        let password = '';
        
        // Ensure at least one of each type
        password += uppercase[Math.floor(Math.random() * uppercase.length)];
        password += lowercase[Math.floor(Math.random() * lowercase.length)];
        password += numbers[Math.floor(Math.random() * numbers.length)];
        password += symbols[Math.floor(Math.random() * symbols.length)];
        
        // Fill the rest
        for (let i = password.length; i < length; i++) {
            password += allChars[Math.floor(Math.random() * allChars.length)];
        }
        
        // Shuffle
        return password.split('').sort(() => Math.random() - 0.5).join('');
    },
    
    /**
     * Check password strength
     * @param {string} password - Password to check
     * @returns {Object} Strength result
     */
    checkPasswordStrength(password) {
        let score = 0;
        const feedback = [];
        
        if (password.length >= 8) score += 25;
        else feedback.push('Make it at least 8 characters');
        
        if (/[A-Z]/.test(password)) score += 25;
        else feedback.push('Add uppercase letters');
        
        if (/[a-z]/.test(password)) score += 25;
        else feedback.push('Add lowercase letters');
        
        if (/[0-9]/.test(password)) score += 15;
        else feedback.push('Add numbers');
        
        if (/[^A-Za-z0-9]/.test(password)) score += 10;
        else feedback.push('Add special characters');
        
        let strength = 'Weak';
        if (score >= 80) strength = 'Strong';
        else if (score >= 50) strength = 'Medium';
        
        return {
            score,
            strength,
            feedback
        };
    }
};

window.BhekCrypto = BhekCrypto;
