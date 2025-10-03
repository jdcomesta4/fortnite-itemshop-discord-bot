const axios = require('axios');
const logger = require('./logger');
const database = require('./database');

class ApiClient {
    constructor() {
        this.baseURL = 'https://fnbr.co/api';
        this.apiKey = process.env.FNBR_API_KEY;
        this.cache = new Map();
        this.retryConfig = {
            retries: 3,
            retryDelay: (attempt) => Math.pow(2, attempt) * 1000,
            retryCondition: (error) => error.response?.status >= 500 || error.code === 'ECONNRESET'
        };
        
        // Initialize axios instance
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 30000,
            headers: {
                'x-api-key': this.apiKey,
                'User-Agent': 'Discord Bot - Fortnite Item Shop'
            }
        });

        // Request interceptor
        this.client.interceptors.request.use(
            (config) => {
                config.metadata = { startTime: Date.now() };
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor
        this.client.interceptors.response.use(
            (response) => {
                const endTime = Date.now();
                const duration = endTime - response.config.metadata.startTime;
                
                this.logApiRequest(
                    response.config.url,
                    response.config.method?.toUpperCase(),
                    duration,
                    response.status,
                    true,
                    null,
                    JSON.stringify(response.config.data || {}).length,
                    JSON.stringify(response.data).length
                );
                
                return response;
            },
            (error) => {
                const endTime = Date.now();
                const duration = error.config?.metadata ? endTime - error.config.metadata.startTime : 0;
                
                this.logApiRequest(
                    error.config?.url || 'unknown',
                    error.config?.method?.toUpperCase() || 'GET',
                    duration,
                    error.response?.status || 0,
                    false,
                    error.message,
                    JSON.stringify(error.config?.data || {}).length,
                    JSON.stringify(error.response?.data || {}).length
                );
                
                return Promise.reject(error);
            }
        );

        // Start cache cleanup interval
        this.startCacheCleanup();
    }

    async logApiRequest(endpoint, method, responseTime, statusCode, success, errorMessage, requestSize, responseSize) {
        try {
            await database.logApiRequest(endpoint, method, responseTime, statusCode, success, errorMessage, requestSize, responseSize);
        } catch (error) {
            logger.error('Failed to log API request to database:', error);
        }
    }

    startCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            let cleaned = 0;
            
            for (const [key, value] of this.cache.entries()) {
                if (now - value.timestamp > value.ttl) {
                    this.cache.delete(key);
                    cleaned++;
                }
            }
            
            if (cleaned > 0) {
                logger.debug(`Cleaned ${cleaned} expired cache entries`);
            }
        }, 60 * 60 * 1000); // Run every hour
    }

    getCacheKey(endpoint, params = {}) {
        return `${endpoint}_${JSON.stringify(params)}`;
    }

    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        const now = Date.now();
        if (now - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        logger.debug(`Cache hit for key: ${key}`);
        return cached.data;
    }

    setCache(key, data, ttl = 6 * 60 * 60 * 1000) { // Default 6 hours
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
        logger.debug(`Cached data for key: ${key} (TTL: ${ttl}ms)`);
    }

    async makeRequest(endpoint, params = {}, useCache = true, cacheTTL = 6 * 60 * 60 * 1000) {
        const cacheKey = this.getCacheKey(endpoint, params);
        
        // Try cache first
        if (useCache) {
            const cached = this.getFromCache(cacheKey);
            if (cached) return cached;
        }

        let lastError;
        
        for (let attempt = 1; attempt <= this.retryConfig.retries + 1; attempt++) {
            try {
                logger.api(`Making request to ${endpoint} (attempt ${attempt})`);
                logger.debug(`Request params: ${JSON.stringify(params)}`);
                
                const response = await this.client.get(endpoint, { params });
                
                if (response.data.status !== 200) {
                    throw new Error(`API returned status ${response.data.status}: ${response.data.error || 'Unknown error'}`);
                }

                // Cache successful response
                if (useCache) {
                    this.setCache(cacheKey, response.data, cacheTTL);
                }

                logger.api(`Successfully fetched data from ${endpoint}`);
                return response.data;

            } catch (error) {
                lastError = error;
                logger.warn(`Request to ${endpoint} failed (attempt ${attempt}):`, error.message);
                if (error.response?.data) {
                    logger.debug(`API error response: ${JSON.stringify(error.response.data)}`);
                }

                if (attempt <= this.retryConfig.retries && this.retryConfig.retryCondition(error)) {
                    const delay = this.retryConfig.retryDelay(attempt);
                    logger.info(`Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    break;
                }
            }
        }

        // If all retries failed, try to return stale cache data
        if (useCache) {
            const staleCache = this.cache.get(cacheKey);
            if (staleCache && Date.now() - staleCache.timestamp < 48 * 60 * 60 * 1000) { // 48 hours max
                logger.warn(`Returning stale cache data for ${endpoint} due to API failure`);
                return staleCache.data;
            }
        }

        throw lastError;
    }

    async getShop() {
        try {
            return await this.makeRequest('/shop', {}, true, 6 * 60 * 60 * 1000); // 6 hours
        } catch (error) {
            logger.error('Failed to fetch shop data:', error);
            throw new Error(`Failed to fetch shop data: ${error.message}`);
        }
    }

    async searchItems(name, type = null, limit = 15) {
        try {
            const validTypes = ['outfit', 'backpack', 'pickaxe', 'glider', 'emote', 'wrap', 'loading', 'music', 'pet', 'spray', 'toy', 'banner', 'emoticon', 'contrail', 'lego-outfit', 'lego-kit'];
            
            const params = { search: name, limit };
            // Only add type if it's valid
            if (type && validTypes.includes(type.toLowerCase())) {
                params.type = type.toLowerCase();
            }
            
            // Get main data from fnbr.co
            const searchResults = await this.makeRequest('/images', params, true, 30 * 60 * 1000); // 30 minutes
            
            // Enhance with shop history from Fortnite-API.com
            if (searchResults?.data && Array.isArray(searchResults.data)) {
                searchResults.data = await this.enhanceWithShopHistory(searchResults.data);
            }
            
            return searchResults;
        } catch (error) {
            logger.error('Failed to search items:', error);
            throw new Error(`Failed to search items: ${error.message}`);
        }
    }

    async enhanceWithShopHistory(items) {
        try {
            const fortniteApiKey = process.env.FORTNITE_API_KEY;
            if (!fortniteApiKey) {
                logger.warn('No Fortnite-API key provided, skipping shop history enhancement');
                return items;
            }

            const fortniteClient = axios.create({
                baseURL: 'https://fortnite-api.com/v2',
                timeout: 15000,
                headers: { 
                    'Authorization': fortniteApiKey,
                    'User-Agent': 'Discord Bot - Fortnite Item Shop'
                }
            });

            // Process items in batches
            const batchSize = 3;
            const enhancedItems = [];

            for (let i = 0; i < items.length; i += batchSize) {
                const batch = items.slice(i, i + batchSize);
                const batchPromises = batch.map(async (item) => {
                    try {
                        let response = null;
                        
                        // Try ID lookup first if available
                        if (item.id) {
                            try {
                                response = await fortniteClient.get(`/cosmetics/br/${item.id}`, {
                                    params: { responseFlags: 4 }
                                });
                            } catch (idError) {
                                logger.debug(`ID lookup failed for ${item.id}`);
                            }
                        }
                        
                        // Fall back to name search
                        if (!response) {
                            response = await fortniteClient.get('/cosmetics/br/search/all', {
                                params: {
                                    name: item.name,
                                    matchMethod: 'full',
                                    language: 'en',
                                    responseFlags: 4
                                }
                            });
                        }

                        if (response.data?.status === 200 && response.data?.data) {
                            let match = null;
                            
                            if (!Array.isArray(response.data.data)) {
                                match = response.data.data;
                            } else if (response.data.data.length > 0) {
                                match = response.data.data.find(apiItem => 
                                    apiItem.name.toLowerCase() === item.name.toLowerCase()
                                );
                            }

                            if (match && match.shopHistory && Array.isArray(match.shopHistory) && match.shopHistory.length > 0) {
                                // Get the most recent shop appearance
                                const sortedHistory = [...match.shopHistory].sort((a, b) => 
                                    new Date(b) - new Date(a)
                                );
                                const lastSeen = sortedHistory[0];
                                
                                logger.debug(`Found shop history for ${item.name}: ${lastSeen}`);
                                
                                return {
                                    ...item,
                                    lastSeen: lastSeen,
                                    shopAppearances: match.shopHistory.length
                                };
                            }
                        }
                    } catch (error) {
                        logger.debug(`Failed to enhance ${item.name}: ${error.message}`);
                    }
                    return item;
                });

                const batchResults = await Promise.all(batchPromises);
                enhancedItems.push(...batchResults);

                // Delay between batches
                if (i + batchSize < items.length) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }

            return enhancedItems;
        } catch (error) {
            logger.warn('Failed to enhance items with shop history:', error.message);
            return items;
        }
    }

    async getItemShopHistory(itemName, itemId = null) {
        try {
            const fortniteApiKey = process.env.FORTNITE_API_KEY;
            if (!fortniteApiKey) {
                return null;
            }

            const fortniteClient = axios.create({
                baseURL: 'https://fortnite-api.com/v2',
                timeout: 10000,
                headers: { 'Authorization': fortniteApiKey }
            });

            let response = null;

            // Try ID first if available
            if (itemId) {
                try {
                    response = await fortniteClient.get(`/cosmetics/br/${itemId}`, {
                        params: { responseFlags: 4 }
                    });
                } catch (error) {
                    logger.debug(`ID lookup failed for ${itemId}`);
                }
            }

            // Fall back to name search
            if (!response) {
                response = await fortniteClient.get('/cosmetics/br/search/all', {
                    params: {
                        name: itemName,
                        matchMethod: 'full',
                        language: 'en',
                        responseFlags: 4
                    }
                });
            }

            if (response.data?.status === 200 && response.data?.data) {
                let match = null;
                
                if (!Array.isArray(response.data.data)) {
                    match = response.data.data;
                } else if (response.data.data.length > 0) {
                    match = response.data.data.find(apiItem => 
                        apiItem.name.toLowerCase() === itemName.toLowerCase()
                    );
                }

                if (match && match.shopHistory && Array.isArray(match.shopHistory) && match.shopHistory.length > 0) {
                    const sortedHistory = [...match.shopHistory].sort((a, b) => 
                        new Date(b) - new Date(a)
                    );
                    return sortedHistory[0];
                }
            }

            return null;
        } catch (error) {
            logger.debug(`Failed to get shop history for ${itemName}: ${error.message}`);
            return null;
        }
    }

    async getItemDetails(itemIds) {
        try {
            if (!Array.isArray(itemIds)) {
                itemIds = [itemIds];
            }

            const results = [];
            const batchSize = 5; // Process in batches to avoid overwhelming the API
            
            for (let i = 0; i < itemIds.length; i += batchSize) {
                const batch = itemIds.slice(i, i + batchSize);
                const batchPromises = batch.map(id => 
                    this.makeRequest('/images', { search: id }, true, 60 * 60 * 1000) // 1 hour
                        .catch(error => {
                            logger.warn(`Failed to fetch details for item ${id}:`, error.message);
                            return null;
                        })
                );
                
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults.filter(result => result !== null));
                
                // Small delay between batches
                if (i + batchSize < itemIds.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            return results;
        } catch (error) {
            logger.error('Failed to get item details:', error);
            throw new Error(`Failed to get item details: ${error.message}`);
        }
    }

    getRarityColor(rarity) {
        const colors = {
            common: 0x808080,      // Gray
            uncommon: 0x00FF00,    // Green
            rare: 0x0099FF,        // Blue
            epic: 0x9900FF,        // Purple
            legendary: 0xFF9900,   // Orange
            mythic: 0xFFD700,      // Gold
            transcendent: 0xFF1493, // Deep Pink
            exotic: 0x00FFFF,      // Cyan
            gaming: 0xFF69B4,      // Hot Pink
            gaming_legends: 0x4B0082, // Dark Purple (Indigo)
            'gaming legends': 0x4B0082, // Dark Purple (Indigo)
            gaminglegends: 0x4B0082,   // Dark Purple (Indigo)
            shadow: 0x2F4F4F,      // Dark Slate Gray
            lava: 0xFF4500,        // Orange Red
            frozen: 0x87CEEB,      // Sky Blue
            marvel: 0xED1C24,      // Marvel Red
            dc: 0x0078F0,          // DC Blue
            starwars: 0xFFE81F,    // Star Wars Yellow
            icon: 0x2596BE,        // Icon Series - Updated color (#2596be)
            'icon series': 0x2596BE, // Icon Series (spaced format)
            icon_series: 0x2596BE  // Icon Series (underscore format)
        };
        
        const normalizedRarity = rarity?.toLowerCase().replace(/_/g, ' ');
        return colors[normalizedRarity] || colors[rarity?.toLowerCase()] || colors.common;
    }

    async checkItemInCurrentShop(itemId) {
        try {
            const shopData = await this.getShop();
            if (!shopData?.data?.sections) return null;

            for (const section of shopData.data.sections) {
                if (section.items && section.items.includes(itemId)) {
                    return {
                        inShop: true,
                        sectionName: section.displayName,
                        shopDate: shopData.data.date
                    };
                }
            }
            return { inShop: false };
        } catch (error) {
            logger.error('Failed to check item in current shop:', error);
            return null;
        }
    }

    clearCache() {
        const size = this.cache.size;
        this.cache.clear();
        logger.info(`Cleared ${size} cache entries`);
    }

    getCacheStats() {
        const now = Date.now();
        let expired = 0;
        let valid = 0;
        
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > value.ttl) {
                expired++;
            } else {
                valid++;
            }
        }
        
        return { total: this.cache.size, valid, expired };
    }
}

module.exports = new ApiClient();
