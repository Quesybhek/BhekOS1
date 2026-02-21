/**
 * BhekOS File Search System - Global file search with indexing
 */
const FileSearch = {
    os: null,
    
    // Search index
    index: new Map(),
    
    // Indexing status
    isIndexing: false,
    lastIndexed: null,
    indexingProgress: 0,
    
    // Search cache
    cache: new Map(),
    
    // Search settings
    settings: {
        enableIndexing: true,
        indexContent: true,
        maxResults: 100,
        fuzzyMatch: true,
        realtimeSearch: true,
        includeHidden: false,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        excludedFolders: ['/Trash', '/System'],
        excludedExtensions: ['.tmp', '.log', '.cache']
    },
    
    // Search history
    history: [],
    maxHistory: 50,
    
    // Indexing queue
    indexingQueue: [],
    isIndexingQueue: false,
    
    async init(os) {
        this.os = os;
        console.log('File Search initializing...');
        
        // Load settings
        const saved = await this.os.modules.Storage.get('search_settings', {});
        this.settings = { ...this.settings, ...saved };
        
        // Load search history
        await this.loadHistory();
        
        // Start indexing if enabled
        if (this.settings.enableIndexing) {
            this.startIndexing();
        }
        
        // Setup file watcher for real-time updates
        this.setupFileWatcher();
        
        console.log('File Search initialized');
        return this;
    },
    
    // ==================== INDEXING ====================
    
    async startIndexing() {
        if (this.isIndexing) return;
        
        this.isIndexing = true;
        this.indexingProgress = 0;
        this.os.notify('Search', 'Indexing files...', 'info');
        
        try {
            await this.buildIndex();
            this.lastIndexed = Date.now();
            this.os.notify('Search', 'Indexing complete', 'success');
        } catch (error) {
            console.error('Indexing failed:', error);
            this.os.notify('Search', 'Indexing failed', 'error');
        } finally {
            this.isIndexing = false;
        }
    },
    
    async buildIndex(path = '/') {
        if (!this.os.modules.FileSystem) return;
        
        const items = await this.os.modules.FileSystem.listDirectory(path, { 
            includeHidden: this.settings.includeHidden 
        });
        
        let processed = 0;
        const total = items.length;
        
        for (const item of items) {
            // Check if should index
            if (this.shouldIndex(item)) {
                await this.indexItem(item);
            }
            
            processed++;
            this.indexingProgress = (processed / total) * 100;
            
            // Recurse into folders
            if (item.type === 'folder' && !this.settings.excludedFolders.includes(item.path)) {
                await this.buildIndex(item.path);
            }
        }
    },
    
    shouldIndex(item) {
        // Check excluded folders
        if (this.settings.excludedFolders.some(f => item.path.startsWith(f))) {
            return false;
        }
        
        // Check file size
        if (item.type === 'file' && item.size > this.settings.maxFileSize) {
            return false;
        }
        
        // Check excluded extensions
        if (item.extension && this.settings.excludedExtensions.includes(`.${item.extension}`)) {
            return false;
        }
        
        return true;
    },
    
    async indexItem(item) {
        const indexEntry = {
            path: item.path,
            name: item.name,
            type: item.type,
            extension: item.extension,
            modified: item.modified,
            created: item.created,
            size: item.size,
            parent: item.parent,
            owner: item.owner,
            tags: item.tags || [],
            content: null,
            words: null,
            indexedAt: Date.now()
        };
        
        // Index content for text files
        if (this.settings.indexContent && item.type === 'file') {
            const textExtensions = ['txt', 'md', 'js', 'html', 'css', 'json', 'xml', 'ini', 'conf', 'log'];
            
            if (textExtensions.includes(item.extension)) {
                try {
                    const content = await this.os.modules.FileSystem.readFile(item.path);
                    if (typeof content === 'string') {
                        indexEntry.content = content.slice(0, 50000); // Limit size
                        indexEntry.words = this.extractWords(content);
                    }
                } catch (e) {
                    // Skip files that can't be read
                }
            }
        }
        
        this.index.set(item.path, indexEntry);
    },
    
    extractWords(text) {
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2)
            .reduce((map, word) => {
                map.set(word, (map.get(word) || 0) + 1);
                return map;
            }, new Map());
        
        return Array.from(words.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 100);
    },
    
    // ==================== SEARCH ====================
    
    async search(query, options = {}) {
        const {
            path = '/',
            type = 'all',
            maxResults = this.settings.maxResults,
            fuzzy = this.settings.fuzzyMatch,
            sortBy = 'relevance'
        } = options;
        
        // Check cache
        const cacheKey = `${query}:${path}:${type}:${fuzzy}`;
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 5000) { // 5 second cache
                return cached.results;
            }
            this.cache.delete(cacheKey);
        }
        
        const results = [];
        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);
        
        // Search through index
        for (const [filePath, file] of this.index) {
            // Filter by path
            if (!filePath.startsWith(path)) continue;
            
            // Filter by type
            if (type !== 'all' && file.type !== type) continue;
            
            // Calculate relevance score
            const score = this.calculateRelevance(file, queryLower, queryWords, fuzzy);
            
            if (score > 0) {
                results.push({
                    ...file,
                    score,
                    matches: this.getMatches(file, queryLower)
                });
            }
            
            if (results.length >= maxResults * 2) break; // Get more than needed for sorting
        }
        
        // Sort by score
        results.sort((a, b) => b.score - a.score);
        
        // Apply sort
        if (sortBy === 'name') {
            results.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortBy === 'date') {
            results.sort((a, b) => new Date(b.modified) - new Date(a.modified));
        } else if (sortBy === 'size') {
            results.sort((a, b) => b.size - a.size);
        }
        
        const finalResults = results.slice(0, maxResults);
        
        // Cache results
        this.cache.set(cacheKey, {
            results: finalResults,
            timestamp: Date.now()
        });
        
        // Add to search history
        this.addToHistory(query);
        
        return finalResults;
    },
    
    calculateRelevance(file, query, queryWords, fuzzy) {
        let score = 0;
        
        // Exact name match
        if (file.name.toLowerCase() === query) {
            score += 1000;
        }
        // Name starts with query
        else if (file.name.toLowerCase().startsWith(query)) {
            score += 500;
        }
        // Name contains query
        else if (file.name.toLowerCase().includes(query)) {
            score += 250;
        }
        // Fuzzy name match
        else if (fuzzy) {
            const nameScore = this.fuzzyMatch(file.name.toLowerCase(), query);
            score += nameScore * 100;
        }
        
        // Path relevance (closer to root is better)
        const depth = file.path.split('/').length;
        score += (10 - depth) * 5;
        
        // Recent files get bonus
        const daysSinceModified = (Date.now() - new Date(file.modified).getTime()) / (24 * 60 * 60 * 1000);
        if (daysSinceModified < 1) {
            score += 50;
        } else if (daysSinceModified < 7) {
            score += 25;
        } else if (daysSinceModified < 30) {
            score += 10;
        }
        
        // Word matches in content
        if (file.words) {
            for (const [word, count] of file.words) {
                if (queryWords.includes(word)) {
                    score += count * 10;
                }
            }
        }
        
        // Tag matches
        if (file.tags) {
            file.tags.forEach(tag => {
                if (tag.toLowerCase().includes(query)) {
                    score += 50;
                }
            });
        }
        
        return score;
    },
    
    fuzzyMatch(str, query) {
        if (query.length === 0) return 0;
        
        let score = 0;
        let queryIndex = 0;
        let lastMatch = -1;
        
        for (let i = 0; i < str.length && queryIndex < query.length; i++) {
            if (str[i] === query[queryIndex]) {
                // Bonus for consecutive matches
                if (lastMatch === i - 1) {
                    score += 2;
                } else {
                    score += 1;
                }
                
                // Bonus for word boundaries
                if (i === 0 || str[i-1] === ' ' || str[i-1] === '/' || str[i-1] === '-') {
                    score += 3;
                }
                
                lastMatch = i;
                queryIndex++;
            }
        }
        
        return queryIndex === query.length ? score / query.length : 0;
    },
    
    getMatches(file, query) {
        const matches = [];
        
        // Name matches
        const nameLower = file.name.toLowerCase();
        let index = nameLower.indexOf(query);
        while (index !== -1) {
            matches.push({
                field: 'name',
                text: file.name,
                start: index,
                end: index + query.length
            });
            index = nameLower.indexOf(query, index + 1);
        }
        
        // Content matches (if we have content)
        if (file.content) {
            const contentLower = file.content.toLowerCase();
            index = contentLower.indexOf(query);
            if (index !== -1) {
                // Get context around match
                const start = Math.max(0, index - 40);
                const end = Math.min(file.content.length, index + query.length + 40);
                matches.push({
                    field: 'content',
                    text: file.content.slice(start, end),
                    start: index - start,
                    end: index - start + query.length
                });
            }
        }
        
        return matches;
    },
    
    // ==================== QUICK SEARCH ====================
    
    async quickSearch(query) {
        if (query.length < 2) return [];
        
        const results = await this.search(query, {
            maxResults: 10,
            fuzzy: true
        });
        
        return results.slice(0, 5);
    },
    
    async searchByType(type) {
        const results = [];
        
        for (const file of this.index.values()) {
            if (file.type === type || file.extension === type) {
                results.push(file);
            }
        }
        
        return results.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    },
    
    async searchRecent(days = 7) {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        const results = [];
        
        for (const file of this.index.values()) {
            const modified = new Date(file.modified).getTime();
            if (modified > cutoff) {
                results.push(file);
            }
        }
        
        return results.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    },
    
    async searchByOwner(owner) {
        const results = [];
        
        for (const file of this.index.values()) {
            if (file.owner === owner) {
                results.push(file);
            }
        }
        
        return results;
    },
    
    // ==================== INDEX MANAGEMENT ====================
    
    async updateFile(path) {
        try {
            const file = await this.os.modules.FileSystem.get(path);
            if (file) {
                if (this.shouldIndex(file)) {
                    await this.indexItem(file);
                } else {
                    this.index.delete(path);
                }
            } else {
                this.index.delete(path);
            }
        } catch (error) {
            console.error('Failed to update index:', error);
        }
    },
    
    setupFileWatcher() {
        if (!this.os.modules.FileSystem) return;
        
        // Watch for file changes
        this.os.modules.FileSystem.watch('/', async (event, item) => {
            if (this.settings.realtimeSearch) {
                await this.updateFile(item.path);
            } else {
                // Queue for later indexing
                this.indexingQueue.push(item.path);
                this.processIndexingQueue();
            }
        });
    },
    
    async processIndexingQueue() {
        if (this.isIndexingQueue || this.indexingQueue.length === 0) return;
        
        this.isIndexingQueue = true;
        
        while (this.indexingQueue.length > 0) {
            const path = this.indexingQueue.shift();
            await this.updateFile(path);
        }
        
        this.isIndexingQueue = false;
    },
    
    // ==================== SEARCH HISTORY ====================
    
    addToHistory(query) {
        // Remove if already exists
        this.history = this.history.filter(q => q !== query);
        
        // Add to front
        this.history.unshift(query);
        
        // Trim
        if (this.history.length > this.maxHistory) {
            this.history.pop();
        }
        
        this.saveHistory();
    },
    
    getSearchHistory(limit = 10) {
        return this.history.slice(0, limit);
    },
    
    clearHistory() {
        this.history = [];
        this.saveHistory();
    },
    
    async loadHistory() {
        const saved = await this.os.modules.Storage.get('search_history', []);
        this.history = saved;
    },
    
    async saveHistory() {
        await this.os.modules.Storage.set('search_history', this.history);
    },
    
    // ==================== CACHE MANAGEMENT ====================
    
    clearCache() {
        this.cache.clear();
    },
    
    // ==================== INDEX MANAGEMENT ====================
    
    async rebuildIndex() {
        this.index.clear();
        this.clearCache();
        await this.startIndexing();
    },
    
    getIndexStats() {
        let totalFiles = 0;
        let totalFolders = 0;
        let totalSize = 0;
        let indexedContent = 0;
        
        for (const file of this.index.values()) {
            if (file.type === 'folder') {
                totalFolders++;
            } else {
                totalFiles++;
                totalSize += file.size;
                if (file.content) indexedContent++;
            }
        }
        
        return {
            totalItems: this.index.size,
            files: totalFiles,
            folders: totalFolders,
            totalSize,
            formattedSize: this.formatBytes(totalSize),
            indexedContent,
            lastIndexed: this.lastIndexed,
            isIndexing: this.isIndexing,
            progress: this.indexingProgress
        };
    },
    
    // ==================== UTILITY ====================
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
    }
};

window.FileSearch = FileSearch;
