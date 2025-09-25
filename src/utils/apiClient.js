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
            const params = { search: name, limit };
            if (type) params.type = type;
            
            return await this.makeRequest('/images', params, true, 30 * 60 * 1000); // 30 minutes
        } catch (error) {
            logger.error('Failed to search items:', error);
            throw new Error(`Failed to search items: ${error.message}`);
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
            shadow: 0x2F4F4F,      // Dark Slate Gray
            lava: 0xFF4500,        // Orange Red
            frozen: 0x87CEEB,      // Sky Blue
            marvel: 0xED1C24,      // Marvel Red
            dc: 0x0078F0,          // DC Blue
            starwars: 0xFFE81F,    // Star Wars Yellow
            icon: 0x00D4AA         // Icon Series Teal
        };
        
        return colors[rarity?.toLowerCase()] || colors.common;
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
