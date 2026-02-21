/**
 * App Store Application - Browse and install applications
 */
class AppStoreApp {
    constructor(os, windowId) {
        this.os = os;
        this.windowId = windowId;
        this.currentView = 'home';
        this.currentCategory = 'all';
        this.currentApp = null;
        this.searchQuery = '';
        this.searchTimeout = null;
    }
    
    async render(container, options = {}) {
        this.container = container;
        await this.renderHome();
        this.addStyles();
    }
    
    async renderHome() {
        const featured = this.os.modules.AppStore.getFeaturedApps();
        const categories = this.os.modules.AppStore.categories;
        const recentlyUpdated = this.os.modules.AppStore.getRecentlyUpdated();
        
        this.container.innerHTML = `
            <div class="app-store">
                <!-- Header -->
                <div class="app-store-header">
                    <h1 class="app-store-title">
                        <span class="app-store-icon">📱</span>
                        BhekOS App Store
                    </h1>
                    <div class="app-store-search">
                        <span class="search-icon">🔍</span>
                        <input type="text" placeholder="Search apps..." id="app-store-search-input"
                               value="${this.searchQuery}">
                    </div>
                </div>
                
                <!-- Navigation Tabs -->
                <div class="app-store-tabs">
                    <button class="tab-btn ${this.currentView === 'home' ? 'active' : ''}" 
                            onclick="appStoreUI.switchView('home')">🏠 Home</button>
                    <button class="tab-btn ${this.currentView === 'browse' ? 'active' : ''}" 
                            onclick="appStoreUI.switchView('browse')">📋 Browse</button>
                    <button class="tab-btn ${this.currentView === 'installed' ? 'active' : ''}" 
                            onclick="appStoreUI.switchView('installed')">📦 Installed</button>
                    <button class="tab-btn ${this.currentView === 'updates' ? 'active' : ''}" 
                            onclick="appStoreUI.switchView('updates')">🔄 Updates</button>
                    <button class="tab-btn ${this.currentView === 'categories' ? 'active' : ''}" 
                            onclick="appStoreUI.switchView('categories')">📑 Categories</button>
                </div>
                
                <!-- Content Area -->
                <div class="app-store-content">
                    ${this.renderCurrentView()}
                </div>
            </div>
        `;
        
        this.addEventListeners();
    }
    
    renderCurrentView() {
        switch(this.currentView) {
            case 'home':
                return this.renderHomeView();
            case 'browse':
                return this.renderBrowseView();
            case 'installed':
                return this.renderInstalledView();
            case 'updates':
                return this.renderUpdatesView();
            case 'categories':
                return this.renderCategoriesView();
            case 'details':
                return this.renderDetailsView();
            default:
                return this.renderHomeView();
        }
    }
    
    renderHomeView() {
        const featured = this.os.modules.AppStore.getFeaturedApps();
        const categories = this.os.modules.AppStore.categories.slice(1, 5);
        const recentlyUpdated = this.os.modules.AppStore.getRecentlyUpdated();
        
        return `
            <!-- Featured Section -->
            <div class="featured-section">
                <h2 class="section-title">Featured Apps</h2>
                <div class="featured-grid">
                    ${featured.map(app => this.renderFeaturedCard(app)).join('')}
                </div>
            </div>
            
            <!-- Categories Section -->
            <div class="categories-section">
                <h2 class="section-title">Browse by Category</h2>
                <div class="categories-grid">
                    ${categories.map(cat => `
                        <div class="category-card" onclick="appStoreUI.browseCategory('${cat.id}')">
                            <span class="category-icon">${cat.icon}</span>
                            <span class="category-name">${cat.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Recently Updated -->
            <div class="recent-section">
                <h2 class="section-title">Recently Updated</h2>
                <div class="apps-list">
                    ${recentlyUpdated.map(app => this.renderAppListItem(app)).join('')}
                </div>
            </div>
        `;
    }
    
    renderBrowseView() {
        const apps = this.os.modules.AppStore.getAvailableApps(this.currentCategory);
        
        return `
            <div class="browse-header">
                <h2 class="page-title">Browse Apps</h2>
                <select class="category-select" onchange="appStoreUI.changeCategory(this.value)">
                    <option value="all">All Categories</option>
                    ${this.os.modules.AppStore.categories.slice(1).map(cat => `
                        <option value="${cat.id}" ${this.currentCategory === cat.id ? 'selected' : ''}>
                            ${cat.icon} ${cat.name}
                        </option>
                    `).join('')}
                </select>
            </div>
            
            <div class="apps-grid">
                ${apps.map(app => this.renderAppCard(app)).join('')}
            </div>
        `;
    }
    
    renderInstalledView() {
        const apps = this.os.modules.AppStore.getInstalledApps();
        
        if (apps.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📦</div>
                    <h3>No Apps Installed</h3>
                    <p>Visit the Browse tab to find apps to install</p>
                    <button class="browse-btn" onclick="appStoreUI.switchView('browse')">Browse Apps</button>
                </div>
            `;
        }
        
        return `
            <h2 class="page-title">Installed Apps</h2>
            <div class="installed-apps-list">
                ${apps.map(app => `
                    <div class="installed-app-item" data-app-id="${app.id}">
                        <div class="app-icon-large">${app.icon}</div>
                        <div class="app-info">
                            <div class="app-name">${app.name}</div>
                            <div class="app-version">Version ${app.version}</div>
                            <div class="app-install-date">Installed: ${new Date(app.installDate).toLocaleDateString()}</div>
                        </div>
                        <div class="app-actions">
                            <button class="open-btn" onclick="appStoreUI.launchApp('${app.id}')">Open</button>
                            <button class="details-btn" onclick="appStoreUI.showAppDetails('${app.id}')">Details</button>
                            ${!app.builtin ? `
                                <button class="uninstall-btn" onclick="appStoreUI.uninstallApp('${app.id}')">Uninstall</button>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    renderUpdatesView() {
        const updates = this.os.modules.AppStore.updates;
        
        if (updates.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">✅</div>
                    <h3>All Apps are Up to Date</h3>
                    <p>No updates available at this time</p>
                </div>
            `;
        }
        
        return `
            <div class="updates-header">
                <h2 class="page-title">Available Updates</h2>
                <button class="update-all-btn" onclick="appStoreUI.updateAllApps()">
                    Update All (${updates.length})
                </button>
            </div>
            
            <div class="updates-list">
                ${updates.map(update => `
                    <div class="update-item">
                        <div class="update-icon">${this.os.modules.AppStore.getApp(update.id).icon}</div>
                        <div class="update-info">
                            <div class="update-name">${update.name}</div>
                            <div class="update-versions">${update.currentVersion} → ${update.newVersion}</div>
                            <div class="update-size">Size: ${update.size}</div>
                        </div>
                        <button class="update-btn" onclick="appStoreUI.updateApp('${update.id}')">Update</button>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    renderCategoriesView() {
        const categories = this.os.modules.AppStore.categories;
        
        return `
            <h2 class="page-title">Categories</h2>
            <div class="categories-grid-large">
                ${categories.slice(1).map(cat => {
                    const count = this.os.modules.AppStore.getAppsByCategory(cat.id).length;
                    return `
                        <div class="category-card-large" onclick="appStoreUI.browseCategory('${cat.id}')">
                            <div class="category-icon-large">${cat.icon}</div>
                            <div class="category-info">
                                <h3 class="category-name-large">${cat.name}</h3>
                                <span class="category-count">${count} apps</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    renderDetailsView() {
        if (!this.currentApp) return '';
        
        const app = this.currentApp;
        const installed = this.os.modules.AppStore.isInstalled(app.id);
        const ratings = this.os.modules.AppStore.getAppRatings(app.id);
        const reviews = this.os.modules.AppStore.getAppReviews(app.id);
        
        return `
            <div class="app-details">
                <div class="app-details-header">
                    <button class="back-btn" onclick="appStoreUI.goBack()">← Back</button>
                    <h1>App Details</h1>
                </div>
                
                <div class="app-details-content">
                    <div class="app-details-icon-large">${app.icon}</div>
                    
                    <div class="app-details-main">
                        <h2 class="app-details-name">${app.name}</h2>
                        
                        <div class="app-details-meta">
                            <span class="app-details-rating">${'⭐'.repeat(app.rating)} (${ratings.total})</span>
                            <span class="app-details-downloads">⬇️ ${this.formatNumber(app.downloads)}</span>
                            <span class="app-details-size">📦 ${app.size}</span>
                            <span class="app-details-version">Version ${app.version}</span>
                        </div>
                        
                        <p class="app-details-description">${app.longDescription || app.description}</p>
                        
                        <div class="app-details-features">
                            <h3>Features</h3>
                            <ul>
                                ${(app.features || []).map(f => `<li>✓ ${f}</li>`).join('')}
                            </ul>
                        </div>
                        
                        <div class="app-details-info">
                            <div class="info-row">
                                <span class="info-label">Developer:</span>
                                <span class="info-value">${app.author}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Category:</span>
                                <span class="info-value">${app.category}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">License:</span>
                                <span class="info-value">${app.license || 'Proprietary'}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Requirements:</span>
                                <span class="info-value">${app.requirements || 'BhekOS 6.0+'}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Last Updated:</span>
                                <span class="info-value">${new Date().toLocaleDateString()}</span>
                            </div>
                        </div>
                        
                        <div class="app-details-permissions">
                            <h3>Permissions</h3>
                            <ul>
                                ${(app.permissions || ['None']).map(p => `<li>🔒 ${p}</li>`).join('')}
                            </ul>
                        </div>
                        
                        <!-- Reviews Section -->
                        <div class="app-details-reviews">
                            <h3>Reviews</h3>
                            ${reviews.length > 0 ? reviews.slice(0, 3).map(review => `
                                <div class="review-item">
                                    <div class="review-header">
                                        <span class="review-author">${review.user}</span>
                                        <span class="review-rating">${'⭐'.repeat(review.rating)}</span>
                                        <span class="review-date">${new Date(review.date).toLocaleDateString()}</span>
                                    </div>
                                    <p class="review-text">${review.review}</p>
                                    <button class="helpful-btn" onclick="appStoreUI.markHelpful('${app.id}', ${reviews.indexOf(review)})">
                                        Helpful (${review.helpful})
                                    </button>
                                </div>
                            `).join('') : '<p>No reviews yet</p>'}
                            
                            <button class="write-review-btn" onclick="appStoreUI.writeReview('${app.id}')">
                                Write a Review
                            </button>
                        </div>
                        
                        <div class="app-details-actions">
                            ${installed ? `
                                <button class="open-btn large" onclick="appStoreUI.launchApp('${app.id}')">
                                    Open App
                                </button>
                                ${!app.builtin ? `
                                    <button class="uninstall-btn large" onclick="appStoreUI.uninstallApp('${app.id}')">
                                        Uninstall
                                    </button>
                                ` : ''}
                            ` : `
                                <button class="install-btn large" onclick="appStoreUI.installApp('${app.id}')">
                                    ${app.price === 'Free' ? 'Install for Free' : `Buy for ${app.price}`}
                                </button>
                            `}
                            <button class="share-btn" onclick="appStoreUI.shareApp('${app.id}')">
                                📤 Share
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderFeaturedCard(app) {
        const installed = this.os.modules.AppStore.isInstalled(app.id);
        
        return `
            <div class="featured-card" onclick="appStoreUI.showAppDetails('${app.id}')">
                <div class="featured-icon">${app.icon}</div>
                <div class="featured-info">
                    <h3 class="featured-name">${app.name}</h3>
                    <p class="featured-desc">${app.description}</p>
                    <div class="featured-meta">
                        <span class="featured-rating">${'⭐'.repeat(app.rating)}</span>
                        <span class="featured-price">${app.price || 'Free'}</span>
                    </div>
                    <button class="install-btn ${installed ? 'installed' : ''}" 
                            onclick="event.stopPropagation(); appStoreUI.toggleInstall('${app.id}')">
                        ${installed ? '✓ Installed' : 'Install'}
                    </button>
                </div>
            </div>
        `;
    }
    
    renderAppCard(app) {
        const installed = this.os.modules.AppStore.isInstalled(app.id);
        
        return `
            <div class="app-card" onclick="appStoreUI.showAppDetails('${app.id}')">
                <div class="app-card-icon">${app.icon}</div>
                <div class="app-card-info">
                    <h3 class="app-card-name">${app.name}</h3>
                    <p class="app-card-desc">${app.description}</p>
                    <div class="app-card-meta">
                        <span class="app-card-rating">${'⭐'.repeat(app.rating)}</span>
                        <span class="app-card-price">${app.price || 'Free'}</span>
                    </div>
                    <button class="install-btn-small ${installed ? 'installed' : ''}" 
                            onclick="event.stopPropagation(); appStoreUI.toggleInstall('${app.id}')">
                        ${installed ? '✓' : '⬇️'}
                    </button>
                </div>
            </div>
        `;
    }
    
    renderAppListItem(app) {
        return `
            <div class="app-list-item" onclick="appStoreUI.showAppDetails('${app.id}')">
                <div class="app-list-icon">${app.icon}</div>
                <div class="app-list-info">
                    <div class="app-list-name">${app.name}</div>
                    <div class="app-list-desc">${app.description}</div>
                </div>
                <div class="app-list-meta">
                    <span class="app-list-rating">${'⭐'.repeat(app.rating)}</span>
                    <span class="app-list-price">${app.price || 'Free'}</span>
                </div>
            </div>
        `;
    }
    
    // ==================== EVENT HANDLERS ====================
    
    addEventListeners() {
        const searchInput = document.getElementById('app-store-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchTimeout);
                this.searchQuery = e.target.value;
                this.searchTimeout = setTimeout(() => {
                    this.performSearch();
                }, 300);
            });
        }
    }
    
    // ==================== VIEW NAVIGATION ====================
    
    switchView(view) {
        this.currentView = view;
        this.renderHome();
    }
    
    goBack() {
        if (this.currentView === 'details') {
            this.currentView = 'home';
            this.currentApp = null;
            this.renderHome();
        }
    }
    
    browseCategory(categoryId) {
        this.currentCategory = categoryId;
        this.currentView = 'browse';
        this.renderHome();
    }
    
    changeCategory(categoryId) {
        this.currentCategory = categoryId;
        this.renderHome();
    }
    
    async showAppDetails(appId) {
        const app = this.os.modules.AppStore.getApp(appId);
        if (app) {
            this.currentApp = app;
            this.currentView = 'details';
            this.renderHome();
        }
    }
    
    // ==================== SEARCH ====================
    
    async performSearch() {
        if (!this.searchQuery.trim()) {
            this.currentView = 'home';
            this.renderHome();
            return;
        }
        
        const results = this.os.modules.AppStore.searchApps(this.searchQuery);
        
        this.container.innerHTML = `
            <div class="app-store">
                <div class="app-store-header">
                    <h1 class="app-store-title">Search: "${this.searchQuery}"</h1>
                    <button class="back-btn" onclick="appStoreUI.goBack()">← Back</button>
                </div>
                
                <div class="search-results">
                    ${results.length === 0 ? `
                        <div class="no-results">
                            <div class="no-results-icon">🔍</div>
                            <h3>No Results Found</h3>
                            <p>Try different keywords</p>
                        </div>
                    ` : `
                        <div class="apps-grid">
                            ${results.map(app => this.renderAppCard(app)).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
        
        this.currentView = 'search';
    }
    
    // ==================== APP ACTIONS ====================
    
    async toggleInstall(appId) {
        const installed = this.os.modules.AppStore.isInstalled(appId);
        
        if (installed) {
            this.launchApp(appId);
        } else {
            await this.installApp(appId);
        }
    }
    
    async installApp(appId) {
        try {
            await this.os.modules.AppStore.installApp(appId);
            this.refreshCurrentView();
        } catch (error) {
            this.os.notify('Error', error.message, 'error');
        }
    }
    
    async uninstallApp(appId) {
        try {
            await this.os.modules.AppStore.uninstallApp(appId);
            this.refreshCurrentView();
        } catch (error) {
            this.os.notify('Error', error.message, 'error');
        }
    }
    
    launchApp(appId) {
        this.os.launchApp(appId);
    }
    
    async updateApp(appId) {
        try {
            await this.os.modules.AppStore.updateApp(appId);
            this.refreshCurrentView();
        } catch (error) {
            this.os.notify('Error', error.message, 'error');
        }
    }
    
    async updateAllApps() {
        const count = await this.os.modules.AppStore.updateAllApps();
        this.os.notify('Updates', `Updated ${count} apps`, 'success');
        this.refreshCurrentView();
    }
    
    async shareApp(appId) {
        const user = this.os.modules.UserManager?.getCurrentUser();
        const username = prompt('Enter username to share with:');
        
        if (username) {
            await this.os.modules.AppStore.shareApp(appId, username);
            this.os.notify('Shared', `App shared with ${username}`, 'success');
        }
    }
    
    async writeReview(appId) {
        const rating = prompt('Enter rating (1-5):');
        const review = prompt('Enter your review:');
        
        if (rating && review) {
            await this.os.modules.AppStore.rateApp(appId, parseInt(rating), review);
            this.os.notify('Review', 'Thank you for your review!', 'success');
        }
    }
    
    async markHelpful(appId, reviewIndex) {
        await this.os.modules.AppStore.markReviewHelpful(appId, reviewIndex);
        this.refreshCurrentView();
    }
    
    // ==================== UTILITY ====================
    
    refreshCurrentView() {
        if (this.currentView === 'details' && this.currentApp) {
            this.showAppDetails(this.currentApp.id);
        } else {
            this.renderHome();
        }
    }
    
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }
    
    // ==================== STYLES ====================
    
    addStyles() {
        if (document.getElementById('app-store-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'app-store-styles';
        style.textContent = `
            .app-store {
                height: 100%;
                display: flex;
                flex-direction: column;
                padding: 20px;
                overflow: hidden;
            }
            
            .app-store-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                flex-shrink: 0;
            }
            
            .app-store-title {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 24px;
            }
            
            .app-store-icon {
                font-size: 32px;
            }
            
            .app-store-search {
                position: relative;
                width: 300px;
            }
            
            .app-store-search input {
                width: 100%;
                padding: 10px 10px 10px 35px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 20px;
                color: white;
                font-size: 14px;
            }
            
            .app-store-search .search-icon {
                position: absolute;
                left: 12px;
                top: 50%;
                transform: translateY(-50%);
                opacity: 0.7;
            }
            
            .app-store-tabs {
                display: flex;
                gap: 10px;
                margin-bottom: 20px;
                border-bottom: 1px solid var(--mica-border);
                padding-bottom: 10px;
                flex-shrink: 0;
            }
            
            .tab-btn {
                padding: 8px 16px;
                background: transparent;
                border: none;
                color: white;
                font-size: 14px;
                cursor: pointer;
                border-radius: 20px;
                transition: 0.2s;
            }
            
            .tab-btn:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .tab-btn.active {
                background: var(--accent);
            }
            
            .app-store-content {
                flex: 1;
                overflow-y: auto;
                padding-right: 5px;
            }
            
            .section-title {
                font-size: 18px;
                margin: 20px 0 15px;
                opacity: 0.9;
            }
            
            .featured-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            
            .featured-card {
                display: flex;
                gap: 15px;
                padding: 15px;
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                cursor: pointer;
                transition: 0.2s;
                border: 1px solid transparent;
            }
            
            .featured-card:hover {
                transform: translateY(-2px);
                background: rgba(255,255,255,0.1);
                border-color: var(--accent);
            }
            
            .featured-icon {
                font-size: 48px;
                min-width: 60px;
                height: 60px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(255,255,255,0.1);
                border-radius: 12px;
            }
            
            .featured-info {
                flex: 1;
            }
            
            .featured-name {
                font-size: 16px;
                margin-bottom: 4px;
            }
            
            .featured-desc {
                font-size: 12px;
                opacity: 0.7;
                margin-bottom: 8px;
                line-height: 1.4;
            }
            
            .featured-meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                font-size: 12px;
            }
            
            .categories-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 15px;
                margin-bottom: 30px;
            }
            
            .category-card {
                padding: 20px;
                background: rgba(255,255,255,0.05);
                border-radius: 10px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
                cursor: pointer;
                transition: 0.2s;
                border: 1px solid transparent;
            }
            
            .category-card:hover {
                background: rgba(255,255,255,0.1);
                border-color: var(--accent);
                transform: translateY(-2px);
            }
            
            .category-icon {
                font-size: 32px;
            }
            
            .category-name {
                font-size: 14px;
            }
            
            .apps-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 16px;
                padding: 10px 0;
            }
            
            .app-card {
                padding: 16px;
                background: rgba(255,255,255,0.05);
                border-radius: 10px;
                cursor: pointer;
                transition: 0.2s;
                border: 1px solid transparent;
                position: relative;
            }
            
            .app-card:hover {
                transform: translateY(-2px);
                background: rgba(255,255,255,0.1);
                border-color: var(--accent);
            }
            
            .app-card-icon {
                font-size: 48px;
                text-align: center;
                margin-bottom: 12px;
            }
            
            .app-card-name {
                font-size: 14px;
                margin-bottom: 4px;
                text-align: center;
            }
            
            .app-card-desc {
                font-size: 11px;
                opacity: 0.7;
                margin-bottom: 8px;
                text-align: center;
                height: 30px;
                overflow: hidden;
            }
            
            .app-card-meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 11px;
                margin-bottom: 8px;
            }
            
            .install-btn-small {
                position: absolute;
                top: 8px;
                right: 8px;
                padding: 4px 8px;
                background: var(--accent);
                border: none;
                border-radius: 4px;
                color: white;
                font-size: 12px;
                cursor: pointer;
            }
            
            .install-btn-small.installed {
                background: #4CAF50;
            }
            
            .installed-apps-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .installed-app-item {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px;
                background: rgba(255,255,255,0.05);
                border-radius: 10px;
                border: 1px solid var(--mica-border);
            }
            
            .app-icon-large {
                font-size: 48px;
                min-width: 60px;
                text-align: center;
            }
            
            .app-info {
                flex: 1;
            }
            
            .app-name {
                font-size: 16px;
                font-weight: 500;
                margin-bottom: 4px;
            }
            
            .app-version,
            .app-install-date {
                font-size: 12px;
                opacity: 0.7;
                margin-bottom: 2px;
            }
            
            .app-actions {
                display: flex;
                gap: 8px;
            }
            
            .open-btn,
            .details-btn,
            .uninstall-btn {
                padding: 6px 12px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            }
            
            .open-btn {
                background: var(--accent);
                color: white;
            }
            
            .details-btn {
                background: transparent;
                border: 1px solid var(--mica-border);
                color: white;
            }
            
            .uninstall-btn {
                background: #ff5252;
                color: white;
            }
            
            .updates-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }
            
            .update-all-btn {
                padding: 8px 16px;
                background: var(--accent);
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
            }
            
            .update-item {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                margin-bottom: 10px;
            }
            
            .update-icon {
                font-size: 32px;
            }
            
            .update-info {
                flex: 1;
            }
            
            .update-name {
                font-size: 14px;
                font-weight: 500;
                margin-bottom: 4px;
            }
            
            .update-versions {
                font-size: 12px;
                color: #4CAF50;
            }
            
            .update-size {
                font-size: 11px;
                opacity: 0.7;
            }
            
            .update-btn {
                padding: 6px 12px;
                background: var(--accent);
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
            }
            
            .categories-grid-large {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 16px;
            }
            
            .category-card-large {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 20px;
                background: rgba(255,255,255,0.05);
                border-radius: 10px;
                cursor: pointer;
                transition: 0.2s;
            }
            
            .category-card-large:hover {
                background: rgba(255,255,255,0.1);
                transform: translateY(-2px);
            }
            
            .category-icon-large {
                font-size: 32px;
            }
            
            .category-name-large {
                font-size: 16px;
                margin-bottom: 4px;
            }
            
            .category-count {
                font-size: 12px;
                opacity: 0.7;
            }
            
            .app-details {
                padding: 20px;
            }
            
            .app-details-header {
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
            
            .app-details-content {
                display: flex;
                gap: 30px;
                flex-wrap: wrap;
            }
            
            .app-details-icon-large {
                font-size: 96px;
                min-width: 120px;
                text-align: center;
                padding: 20px;
                background: rgba(255,255,255,0.05);
                border-radius: 20px;
            }
            
            .app-details-main {
                flex: 1;
                min-width: 300px;
            }
            
            .app-details-name {
                font-size: 28px;
                margin-bottom: 10px;
            }
            
            .app-details-meta {
                display: flex;
                flex-wrap: wrap;
                gap: 20px;
                margin-bottom: 20px;
                font-size: 14px;
            }
            
            .app-details-description {
                font-size: 14px;
                line-height: 1.6;
                margin-bottom: 30px;
            }
            
            .app-details-features,
            .app-details-permissions,
            .app-details-reviews {
                margin-bottom: 30px;
            }
            
            .app-details-features h3,
            .app-details-permissions h3,
            .app-details-reviews h3 {
                font-size: 18px;
                margin-bottom: 15px;
            }
            
            .app-details-features ul,
            .app-details-permissions ul {
                list-style: none;
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 10px;
            }
            
            .app-details-features li,
            .app-details-permissions li {
                padding: 8px 12px;
                background: rgba(255,255,255,0.05);
                border-radius: 4px;
                font-size: 13px;
            }
            
            .info-row {
                display: flex;
                padding: 8px 0;
                border-bottom: 1px solid var(--mica-border);
            }
            
            .info-label {
                width: 120px;
                font-weight: 500;
                opacity: 0.7;
            }
            
            .info-value {
                flex: 1;
            }
            
            .review-item {
                padding: 16px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                margin-bottom: 12px;
            }
            
            .review-header {
                display: flex;
                gap: 12px;
                margin-bottom: 8px;
                font-size: 13px;
            }
            
            .review-author {
                font-weight: 500;
            }
            
            .review-rating {
                color: gold;
            }
            
            .review-date {
                opacity: 0.5;
            }
            
            .review-text {
                font-size: 13px;
                line-height: 1.5;
                margin-bottom: 10px;
            }
            
            .helpful-btn {
                padding: 4px 8px;
                background: transparent;
                border: 1px solid var(--mica-border);
                border-radius: 4px;
                color: white;
                font-size: 11px;
                cursor: pointer;
            }
            
            .write-review-btn {
                padding: 10px 20px;
                background: transparent;
                border: 1px solid var(--accent);
                border-radius: 6px;
                color: var(--accent);
                cursor: pointer;
                width: 100%;
                margin-top: 10px;
            }
            
            .app-details-actions {
                display: flex;
                gap: 12px;
                margin-top: 30px;
            }
            
            .install-btn.large,
            .open-btn.large,
            .uninstall-btn.large,
            .share-btn {
                padding: 12px 24px;
                font-size: 16px;
                border-radius: 6px;
                border: none;
                cursor: pointer;
            }
            
            .install-btn.large {
                background: var(--accent);
                color: white;
            }
            
            .open-btn.large {
                background: #4CAF50;
                color: white;
            }
            
            .uninstall-btn.large {
                background: #ff5252;
                color: white;
            }
            
            .share-btn {
                background: transparent;
                border: 1px solid var(--mica-border);
                color: white;
            }
            
            .empty-state {
                text-align: center;
                padding: 60px 20px;
                opacity: 0.7;
            }
            
            .empty-icon {
                font-size: 64px;
                margin-bottom: 20px;
            }
            
            .no-results {
                text-align: center;
                padding: 40px;
            }
            
            .no-results-icon {
                font-size: 48px;
                margin-bottom: 16px;
            }
            
            .browse-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }
            
            .category-select {
                padding: 8px 12px;
                background: rgba(255,255,255,0.1);
                border: 1px solid var(--mica-border);
                border-radius: 6px;
                color: white;
                font-size: 14px;
            }
            
            /* Light theme */
            .light-theme .app-store input,
            .light-theme .category-select {
                color: black;
            }
            
            .light-theme .back-btn {
                color: black;
            }
            
            .light-theme .details-btn {
                color: black;
            }
            
            .light-theme .share-btn {
                color: black;
            }
        `;
        
        document.head.appendChild(style);
    }
}

window.AppStoreApp = AppStoreApp;
window.appStoreUI = null; // Will be set when app is instantiated
