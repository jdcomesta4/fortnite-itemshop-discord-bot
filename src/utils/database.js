const mysql = require('mysql2/promise');
const logger = require('./logger');

class Database {
    constructor() {
        this.pool = null;
        this.isConnected = false;
        this.reconnectInterval = null;
        // Only initialize if we're not in a test environment
        if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
            this.initialize();
        }
    }

    async initialize() {
        try {
            // Check if required environment variables are set
            if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
                logger.warn('Missing database environment variables. Database functionality will be disabled.');
                this.isConnected = false;
                return;
            }

            logger.info(`Attempting to connect to database: ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}`);

            this.pool = mysql.createPool({
                host: process.env.DB_HOST,
                port: parseInt(process.env.DB_PORT) || 3306,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                charset: 'utf8mb4',
                // Valid MySQL2 pool options
                idleTimeout: 900000, // 15 minutes
                // Connection options
                connectTimeout: 20000
            });

            // Test initial connection
            await this.testConnection();
            this.isConnected = true;
            logger.info('Database pool initialized successfully');

            // Initialize database schema
            await this.initializeSchema();

        } catch (error) {
            logger.error('Database initialization failed:', error);
            this.isConnected = false;
            // Don't schedule reconnect here, let the main app handle it
            throw error;
        }
    }

    async testConnection() {
        try {
            if (!this.pool) {
                throw new Error('Database pool not initialized');
            }
            const connection = await this.pool.getConnection();
            await connection.ping();
            connection.release();
            this.isConnected = true;
            return true;
        } catch (error) {
            logger.error('Database connection test failed:', error);
            this.isConnected = false;
            throw error;
        }
    }

    async initializeSchema() {
        try {
            if (!this.isDatabaseAvailable()) {
                throw new Error('Database not available for schema initialization');
            }

            logger.info('Initializing database schema...');

            // Create tables
            const tables = [
                // Command usage tracking
                `CREATE TABLE IF NOT EXISTS command_usage (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    username VARCHAR(100),
                    command_name VARCHAR(50) NOT NULL,
                    parameters TEXT,
                    guild_id VARCHAR(20),
                    guild_name VARCHAR(100),
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    execution_time_ms INT,
                    success BOOLEAN DEFAULT TRUE,
                    error_message TEXT,
                    INDEX idx_user_id (user_id),
                    INDEX idx_command_name (command_name),
                    INDEX idx_timestamp (timestamp)
                )`,

                // Shop history and analytics
                `CREATE TABLE IF NOT EXISTS shop_history (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    date DATE UNIQUE NOT NULL,
                    total_items INT NOT NULL,
                    sections_count INT NOT NULL,
                    sections_data JSON,
                    api_response_time_ms INT,
                    fetch_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    posted_to_discord BOOLEAN DEFAULT FALSE,
                    post_timestamp DATETIME,
                    INDEX idx_date (date),
                    INDEX idx_fetch_timestamp (fetch_timestamp)
                )`,

                // Comprehensive error logging
                `CREATE TABLE IF NOT EXISTS error_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    error_type VARCHAR(100) NOT NULL,
                    error_message TEXT NOT NULL,
                    stack_trace TEXT,
                    context_data JSON,
                    user_id VARCHAR(20),
                    guild_id VARCHAR(20),
                    command_name VARCHAR(50),
                    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
                    resolved BOOLEAN DEFAULT FALSE,
                    INDEX idx_timestamp (timestamp),
                    INDEX idx_error_type (error_type),
                    INDEX idx_severity (severity)
                )`,

                // User interaction tracking
                `CREATE TABLE IF NOT EXISTS user_interactions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    username VARCHAR(100),
                    interaction_type ENUM('command', 'button', 'search', 'pagination') NOT NULL,
                    details JSON,
                    guild_id VARCHAR(20),
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    session_id VARCHAR(50),
                    INDEX idx_user_id (user_id),
                    INDEX idx_interaction_type (interaction_type),
                    INDEX idx_timestamp (timestamp)
                )`,

                // API request tracking
                `CREATE TABLE IF NOT EXISTS api_requests (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    endpoint VARCHAR(200) NOT NULL,
                    method VARCHAR(10) DEFAULT 'GET',
                    response_time_ms INT,
                    status_code INT,
                    success BOOLEAN,
                    error_message TEXT,
                    request_size_bytes INT,
                    response_size_bytes INT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_endpoint (endpoint),
                    INDEX idx_timestamp (timestamp),
                    INDEX idx_success (success)
                )`,

                // Item search analytics
                `CREATE TABLE IF NOT EXISTS search_analytics (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    search_query VARCHAR(200) NOT NULL,
                    search_type VARCHAR(50),
                    search_rarity VARCHAR(50),
                    results_found INT,
                    execution_time_ms INT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_search_query (search_query),
                    INDEX idx_timestamp (timestamp),
                    INDEX idx_user_id (user_id)
                )`,

                // Guild configurations
                `CREATE TABLE IF NOT EXISTS guild_configs (
                    guild_id VARCHAR(20) PRIMARY KEY,
                    guild_name VARCHAR(100),
                    shop_channel_id VARCHAR(20),
                    daily_updates_enabled BOOLEAN DEFAULT TRUE,
                    trusted_role_id VARCHAR(20),
                    configured_by VARCHAR(20),
                    configured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_shop_channel_id (shop_channel_id),
                    INDEX idx_configured_at (configured_at)
                )`,

                // User wishlists
                `CREATE TABLE IF NOT EXISTS user_wishlists (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    item_name VARCHAR(200) NOT NULL,
                    item_type VARCHAR(100),
                    item_rarity VARCHAR(50),
                    item_icon_url TEXT,
                    item_price INT,
                    date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_notified DATE DEFAULT NULL,
                    INDEX idx_user_id (user_id),
                    INDEX idx_item_name (item_name),
                    INDEX idx_date_added (date_added),
                    UNIQUE KEY unique_user_item (user_id, item_name)
                )`,

                // Wishlist notification configuration
                `CREATE TABLE IF NOT EXISTS wishlist_notifications_config (
                    guild_id VARCHAR(20) PRIMARY KEY,
                    updates_channel_id VARCHAR(20) NOT NULL,
                    notifications_enabled BOOLEAN DEFAULT TRUE,
                    configured_by VARCHAR(20),
                    configured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_updates_channel_id (updates_channel_id)
                )`,

                // User notification preferences
                `CREATE TABLE IF NOT EXISTS user_notification_preferences (
                    user_id VARCHAR(20) PRIMARY KEY,
                    wishlist_notifications_enabled BOOLEAN DEFAULT TRUE,
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )`
            ];

            // Execute each table creation
            for (const tableSQL of tables) {
                await this.query(tableSQL);
            }

            // Add trusted_role_id column if it doesn't exist (migration)
            try {
                // First check if column exists
                const checkColumn = await this.query(`
                    SELECT COLUMN_NAME 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = ? 
                    AND TABLE_NAME = 'guild_configs' 
                    AND COLUMN_NAME = 'trusted_role_id'
                `, [process.env.DB_NAME]);

                if (checkColumn.length === 0) {
                    // Column doesn't exist, add it
                    await this.query(`
                        ALTER TABLE guild_configs 
                        ADD COLUMN trusted_role_id VARCHAR(20) AFTER daily_updates_enabled
                    `);
                    logger.info('Database migration: trusted_role_id column added successfully');
                } else {
                    logger.debug('Migration: trusted_role_id column already exists');
                }
            } catch (error) {
                logger.warn('Migration warning: Could not add trusted_role_id column:', error.message);
            }

            logger.info('Database schema initialized successfully');
            return true;

        } catch (error) {
            logger.error('Failed to initialize database schema:', error);
            throw error;
        }
    }

    // Helper method to check if database is available
    isDatabaseAvailable() {
        return this.isConnected && this.pool !== null;
    }

    scheduleReconnect() {
        if (this.reconnectInterval) return;
        
        logger.info('Scheduling database reconnection attempts...');
        this.reconnectInterval = setInterval(async () => {
            try {
                logger.info('Attempting database reconnection...');
                await this.testConnection();
                this.isConnected = true;
                logger.info('Database reconnected successfully');
                clearInterval(this.reconnectInterval);
                this.reconnectInterval = null;
            } catch (error) {
                logger.warn('Database reconnection attempt failed:', error.message);
            }
        }, 30000); // Try every 30 seconds
    }

    async query(sql, params = [], options = {}) {
        const { suppressErrorsOnInsert = false } = options;
        if (!this.isConnected || !this.pool) {
            logger.warn('Database not connected, skipping query');
            return null; // Return null instead of throwing
        }

        try {
            const [results] = await this.pool.execute(sql, params);
            return results;
        } catch (error) {
            logger.error('Database query failed:', { sql, params, error: error.message });
            
            if (error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'ECONNREFUSED') {
                this.isConnected = false;
                this.scheduleReconnect();
            }
            
            if (suppressErrorsOnInsert && sql.trim().toUpperCase().startsWith('INSERT INTO')) {
                logger.warn('Logging query failed, continuing without database logging');
                return null;
            }
            
            throw error;
        }
    }

    // Logging methods
    async logCommandUsage(userId, username, commandName, parameters, guildId, guildName, executionTime, success = true, errorMessage = null) {
        try {
            await this.query(
                `INSERT INTO command_usage (user_id, username, command_name, parameters, guild_id, guild_name, execution_time_ms, success, error_message) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, username, commandName, JSON.stringify(parameters), guildId, guildName, executionTime, success, errorMessage],
                { suppressErrorsOnInsert: true }
            );
        } catch (error) {
            logger.error('Failed to log command usage:', error);
        }
    }

    async logShopHistory(date, totalItems, sectionsCount, sectionsData, apiResponseTime, postedToDiscord = false) {
        try {
            await this.query(
                `INSERT INTO shop_history (date, total_items, sections_count, sections_data, api_response_time_ms, posted_to_discord, post_timestamp) 
                 VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE 
                 total_items = VALUES(total_items), sections_count = VALUES(sections_count), 
                 sections_data = VALUES(sections_data), api_response_time_ms = VALUES(api_response_time_ms),
                 posted_to_discord = VALUES(posted_to_discord), post_timestamp = VALUES(post_timestamp)`,
                [date, totalItems, sectionsCount, JSON.stringify(sectionsData), apiResponseTime, postedToDiscord, postedToDiscord ? new Date() : null],
                { suppressErrorsOnInsert: true }
            );
        } catch (error) {
            logger.error('Failed to log shop history:', error);
        }
    }

    async logError(errorType, errorMessage, stackTrace, contextData, userId = null, guildId = null, commandName = null, severity = 'medium') {
        try {
            const result = await this.query(
                `INSERT INTO error_logs (error_type, error_message, stack_trace, context_data, user_id, guild_id, command_name, severity) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [errorType, errorMessage, stackTrace, JSON.stringify(contextData), userId, guildId, commandName, severity],
                { suppressErrorsOnInsert: true }
            );
            // If query returns null (database not connected), just log to console
            if (result === null) {
                logger.warn('Database unavailable - error logged to console only');
            }
        } catch (error) {
            // Prevent infinite loops when logging database errors
            if (!error.message.includes('Database not connected')) {
                logger.error('Failed to log error to database:', error);
            }
        }
    }

    async logUserInteraction(userId, username, interactionType, details, guildId, sessionId = null) {
        try {
            await this.query(
                `INSERT INTO user_interactions (user_id, username, interaction_type, details, guild_id, session_id) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [userId, username, interactionType, JSON.stringify(details), guildId, sessionId],
                { suppressErrorsOnInsert: true }
            );
        } catch (error) {
            logger.error('Failed to log user interaction:', error);
        }
    }

    async logApiRequest(endpoint, method, responseTime, statusCode, success, errorMessage = null, requestSize = 0, responseSize = 0) {
        try {
            await this.query(
                `INSERT INTO api_requests (endpoint, method, response_time_ms, status_code, success, error_message, request_size_bytes, response_size_bytes) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [endpoint, method, responseTime, statusCode, success, errorMessage, requestSize, responseSize],
                { suppressErrorsOnInsert: true }
            );
        } catch (error) {
            logger.error('Failed to log API request:', error);
        }
    }

    async logSearchAnalytics(userId, searchQuery, searchType, searchRarity, resultsFound, executionTime) {
        try {
            await this.query(
                `INSERT INTO search_analytics (user_id, search_query, search_type, search_rarity, results_found, execution_time_ms) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [userId, searchQuery, searchType, searchRarity, resultsFound, executionTime],
                { suppressErrorsOnInsert: true }
            );
        } catch (error) {
            logger.error('Failed to log search analytics:', error);
        }
    }

    // Guild configuration methods
    async setGuildShopChannel(guildId, guildName, channelId, configuredBy) {
        try {
            await this.query(
                `INSERT INTO guild_configs (guild_id, guild_name, shop_channel_id, configured_by) 
                 VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE 
                 guild_name = VALUES(guild_name), shop_channel_id = VALUES(shop_channel_id), 
                 configured_by = VALUES(configured_by), last_updated = CURRENT_TIMESTAMP`,
                [guildId, guildName, channelId, configuredBy]
            );
            logger.info(`Shop channel configured for guild ${guildName} (${guildId}) to channel ${channelId}`);
        } catch (error) {
            logger.error('Failed to set guild shop channel:', error);
            throw error;
        }
    }

    async getGuildConfig(guildId) {
        try {
            const result = await this.query(
                'SELECT * FROM guild_configs WHERE guild_id = ?',
                [guildId]
            );
            return result && result.length > 0 ? result[0] : null;
        } catch (error) {
            logger.error('Failed to get guild config:', error);
            return null;
        }
    }

    async getAllGuildConfigs() {
        try {
            const result = await this.query(
                'SELECT * FROM guild_configs WHERE shop_channel_id IS NOT NULL AND daily_updates_enabled = TRUE'
            );
            return result || [];
        } catch (error) {
            logger.error('Failed to get all guild configs:', error);
            return [];
        }
    }

    async toggleGuildDailyUpdates(guildId, enabled) {
        try {
            await this.query(
                'UPDATE guild_configs SET daily_updates_enabled = ?, last_updated = CURRENT_TIMESTAMP WHERE guild_id = ?',
                [enabled, guildId]
            );
            logger.info(`Daily updates ${enabled ? 'enabled' : 'disabled'} for guild ${guildId}`);
        } catch (error) {
            logger.error('Failed to toggle guild daily updates:', error);
            throw error;
        }
    }

    async setGuildTrustedRole(guildId, roleId) {
        try {
            await this.query(
                'UPDATE guild_configs SET trusted_role_id = ?, last_updated = CURRENT_TIMESTAMP WHERE guild_id = ?',
                [roleId, guildId]
            );
            logger.info(`Set trusted role ${roleId} for guild ${guildId}`);
        } catch (error) {
            logger.error('Failed to set guild trusted role:', error);
            throw error;
        }
    }

    async removeGuildConfig(guildId) {
        try {
            await this.query(
                'DELETE FROM guild_configs WHERE guild_id = ?',
                [guildId]
            );
            logger.info(`Removed guild config for ${guildId}`);
        } catch (error) {
            logger.error('Failed to remove guild config:', error);
            throw error;
        }
    }

    // ============ WISHLIST OPERATIONS ============

    async addToWishlist(userId, itemData) {
        try {
            logger.debug(`Attempting to add to wishlist - User: ${userId}, Item: ${itemData.name}`);
            logger.debug(`Item data:`, itemData);
            
            // Validate required fields
            if (!userId || !itemData.name) {
                logger.error(`Missing required fields - userId: ${userId}, itemName: ${itemData.name}`);
                return false;
            }

            const normalizedName = itemData.name.trim();
            const normalizedType = typeof itemData.type === 'string' ? itemData.type : (itemData.type?.displayValue || 'Unknown');
            const normalizedRarity = typeof itemData.rarity === 'string' ? itemData.rarity : (itemData.rarity?.displayValue || 'Unknown');
            const normalizedIcon = itemData.icon_url || itemData.icon || null;
            const normalizedPrice = typeof itemData.price === 'string' 
                ? parseInt(itemData.price.replace(/[^0-9]/g, ''), 10) || 0
                : Number(itemData.price) >= 0
                    ? Math.floor(Number(itemData.price))
                    : 0;
            
            const result = await this.query(
                `INSERT INTO user_wishlists (user_id, item_name, item_type, item_rarity, item_icon_url, item_price) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [userId, normalizedName, normalizedType || 'Unknown', normalizedRarity || 'Unknown', normalizedIcon, normalizedPrice]
            );

            if (!result || typeof result.affectedRows === 'undefined' || result.affectedRows === 0) {
                logger.warn(`Wishlist insert returned no affected rows for user ${userId} and item ${normalizedName}`);
                return false;
            }
            
            logger.debug(`Successfully added item "${normalizedName}" to wishlist for user ${userId}`);
            logger.debug(`Insert result:`, result);
            return true;
        } catch (error) {
            logger.error(`Database error adding "${itemData.name}" to wishlist for user ${userId}:`);
            logger.error(`Error message: ${error.message}`);
            logger.error(`Error code: ${error.code}`);
            logger.error(`SQL State: ${error.sqlState}`);
            logger.error(`Full error:`, error);
            
            if (error.code === 'ER_DUP_ENTRY') {
                logger.debug(`Item "${itemData.name}" already exists in wishlist for user ${userId}`);
                return false; // Item already exists
            }
            
            // IMPORTANT: Don't return false on real errors, throw them so they're visible
            throw error;
        }
    }

    async removeFromWishlist(userId, itemName) {
        try {
            if (!this.isConnected) {
                logger.warn('Database not connected, cannot remove from wishlist');
                return false;
            }
            
            const result = await this.query(
                'DELETE FROM user_wishlists WHERE user_id = ? AND item_name = ?',
                [userId, itemName]
            );
            
            // Handle null result when database is not connected
            if (!result) {
                logger.warn('Database query returned null, assuming removal failed');
                return false;
            }
            
            const removed = result.affectedRows > 0;
            if (removed) {
                logger.info(`Removed item "${itemName}" from wishlist for user ${userId}`);
            }
            return removed;
        } catch (error) {
            logger.error('Failed to remove item from wishlist:', error);
            return false; // Don't throw, return false to indicate failure
        }
    }

    async getUserWishlist(userId, orderBy = 'added_at DESC') {
        try {
            if (!this.isConnected) {
                logger.warn('Database not connected, returning empty wishlist');
                return [];
            }
            
            const result = await this.query(
                `SELECT * FROM user_wishlists WHERE user_id = ? ORDER BY ${orderBy}`,
                [userId]
            );
            return result || [];
        } catch (error) {
            logger.error('Failed to get user wishlist:', error);
            return [];
        }
    }

    async checkWishlistItem(userId, itemName) {
        try {
            const result = await this.query(
                'SELECT * FROM user_wishlists WHERE user_id = ? AND item_name = ?',
                [userId, itemName]
            );
            return result && result.length > 0 ? result[0] : null;
        } catch (error) {
            logger.error('Failed to check wishlist item:', error);
            return null;
        }
    }

    async getWishlistStats(userId) {
        try {
            if (!this.isConnected) {
                logger.warn('Database not connected, returning zero stats');
                return { total_items: 0, total_vbucks: 0 };
            }
            
            const result = await this.query(
                'SELECT COUNT(*) as total_items, COALESCE(SUM(item_price), 0) as total_vbucks FROM user_wishlists WHERE user_id = ?',
                [userId]
            );
            return result && result.length > 0 ? result[0] : { total_items: 0, total_vbucks: 0 };
        } catch (error) {
            logger.error('Failed to get wishlist stats:', error);
            return { total_items: 0, total_vbucks: 0 };
        }
    }

    async updateLastNotified(userId, itemNames, date) {
        try {
            if (!itemNames || itemNames.length === 0) return;
            
            const placeholders = itemNames.map(() => '?').join(',');
            await this.query(
                `UPDATE user_wishlists SET last_notified = ? WHERE user_id = ? AND item_name IN (${placeholders})`,
                [date, userId, ...itemNames]
            );
            logger.info(`Updated last_notified for ${itemNames.length} items for user ${userId}`);
        } catch (error) {
            logger.error('Failed to update last notified:', error);
            throw error;
        }
    }

    // ============ NOTIFICATION CONFIG OPERATIONS ============

    async setUpdatesChannel(guildId, channelId, configuredBy) {
        try {
            await this.query(
                `INSERT INTO wishlist_notifications_config (guild_id, updates_channel_id, configured_by, notifications_enabled)
                 VALUES (?, ?, ?, TRUE)
                 ON DUPLICATE KEY UPDATE 
                 updates_channel_id = VALUES(updates_channel_id),
                 configured_by = VALUES(configured_by),
                 notifications_enabled = TRUE,
                 last_updated = CURRENT_TIMESTAMP`,
                [guildId, channelId, configuredBy]
            );
            logger.info(`Set updates channel ${channelId} for guild ${guildId}`);
        } catch (error) {
            logger.error('Failed to set updates channel:', error);
            throw error;
        }
    }

    async getUpdatesChannel(guildId) {
        try {
            const result = await this.query(
                'SELECT * FROM wishlist_notifications_config WHERE guild_id = ?',
                [guildId]
            );
            return result && result.length > 0 ? result[0] : null;
        } catch (error) {
            logger.error('Failed to get updates channel:', error);
            return null;
        }
    }

    async toggleUpdatesChannel(guildId, enabled) {
        try {
            await this.query(
                'UPDATE wishlist_notifications_config SET notifications_enabled = ?, last_updated = CURRENT_TIMESTAMP WHERE guild_id = ?',
                [enabled, guildId]
            );
            logger.info(`${enabled ? 'Enabled' : 'Disabled'} wishlist notifications for guild ${guildId}`);
        } catch (error) {
            logger.error('Failed to toggle updates channel:', error);
            throw error;
        }
    }

    async removeUpdatesChannel(guildId) {
        try {
            await this.query(
                'DELETE FROM wishlist_notifications_config WHERE guild_id = ?',
                [guildId]
            );
            logger.info(`Removed updates channel config for guild ${guildId}`);
        } catch (error) {
            logger.error('Failed to remove updates channel:', error);
            throw error;
        }
    }

    // ============ USER PREFERENCES ============

    async setNotificationPreference(userId, enabled) {
        try {
            await this.query(
                `INSERT INTO user_notification_preferences (user_id, wishlist_notifications_enabled)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE 
                 wishlist_notifications_enabled = VALUES(wishlist_notifications_enabled),
                 last_updated = CURRENT_TIMESTAMP`,
                [userId, enabled]
            );
            logger.info(`Set notification preference to ${enabled} for user ${userId}`);
        } catch (error) {
            logger.error('Failed to set notification preference:', error);
            throw error;
        }
    }

    async getNotificationPreference(userId) {
        try {
            const result = await this.query(
                'SELECT * FROM user_notification_preferences WHERE user_id = ?',
                [userId]
            );
            return result && result.length > 0 ? result[0] : { wishlist_notifications_enabled: true };
        } catch (error) {
            logger.error('Failed to get notification preference:', error);
            return { wishlist_notifications_enabled: true };
        }
    }

    // ============ NOTIFICATION QUERIES ============

    async getAllWishlistItems() {
        try {
            const result = await this.query(
                'SELECT DISTINCT user_id, item_name FROM user_wishlists ORDER BY user_id, item_name'
            );
            return result || [];
        } catch (error) {
            logger.error('Failed to get all wishlist items:', error);
            return [];
        }
    }

    async getUsersWithWishlistMatches(shopItems) {
        try {
            if (!shopItems || shopItems.length === 0) return [];
            
            // Create LIKE conditions for partial matching
            const likeConditions = shopItems.map(() => 'item_name LIKE ?').join(' OR ');
            const likeParams = shopItems.map(item => `%${item}%`);
            
            const result = await this.query(
                `SELECT DISTINCT user_id, item_name FROM user_wishlists WHERE (${likeConditions})`,
                likeParams
            );
            return result || [];
        } catch (error) {
            logger.error('Failed to get users with wishlist matches:', error);
            return [];
        }
    }

    async getItemsToNotify(userId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const result = await this.query(
                'SELECT * FROM user_wishlists WHERE user_id = ? AND (last_notified IS NULL OR last_notified != ?)',
                [userId, today]
            );
            return result || [];
        } catch (error) {
            logger.error('Failed to get items to notify:', error);
            return [];
        }
    }

    async end() {
        try {
            if (this.reconnectInterval) {
                clearInterval(this.reconnectInterval);
            }
            if (this.pool) {
                await this.pool.end();
                logger.info('Database pool closed');
            }
        } catch (error) {
            logger.error('Error closing database pool:', error);
        }
    }
}

module.exports = new Database();
