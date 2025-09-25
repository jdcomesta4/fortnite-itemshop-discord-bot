const mysql = require('mysql2/promise');
const logger = require('./logger');

class Database {
    constructor() {
        this.pool = null;
        this.isConnected = false;
        this.reconnectInterval = null;
        this.initialize();
    }

    async initialize() {
        try {
            this.pool = mysql.createPool({
                host: process.env.DB_HOST,
                port: process.env.DB_PORT || 3306,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                acquireTimeout: 60000,
                timeout: 60000,
                reconnect: true,
                charset: 'utf8mb4'
            });

            // Test initial connection
            await this.testConnection();
            this.isConnected = true;
            logger.info('Database pool initialized successfully');

        } catch (error) {
            logger.error('Database initialization failed:', error);
            this.scheduleReconnect();
            throw error;
        }
    }

    async testConnection() {
        try {
            const connection = await this.pool.getConnection();
            await connection.ping();
            connection.release();
            return true;
        } catch (error) {
            logger.error('Database connection test failed:', error);
            this.isConnected = false;
            throw error;
        }
    }

    scheduleReconnect() {
        if (this.reconnectInterval) return;
        
        this.reconnectInterval = setInterval(async () => {
            try {
                await this.testConnection();
                this.isConnected = true;
                logger.info('Database reconnected successfully');
                clearInterval(this.reconnectInterval);
                this.reconnectInterval = null;
            } catch (error) {
                logger.warn('Database reconnection attempt failed');
            }
        }, 30000); // Try every 30 seconds
    }

    async query(sql, params = []) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        try {
            const [results] = await this.pool.execute(sql, params);
            return results;
        } catch (error) {
            logger.error('Database query failed:', { sql, params, error: error.message });
            
            if (error.code === 'PROTOCOL_CONNECTION_LOST') {
                this.isConnected = false;
                this.scheduleReconnect();
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
                [userId, username, commandName, JSON.stringify(parameters), guildId, guildName, executionTime, success, errorMessage]
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
                [date, totalItems, sectionsCount, JSON.stringify(sectionsData), apiResponseTime, postedToDiscord, postedToDiscord ? new Date() : null]
            );
        } catch (error) {
            logger.error('Failed to log shop history:', error);
        }
    }

    async logError(errorType, errorMessage, stackTrace, contextData, userId = null, guildId = null, commandName = null, severity = 'medium') {
        try {
            await this.query(
                `INSERT INTO error_logs (error_type, error_message, stack_trace, context_data, user_id, guild_id, command_name, severity) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [errorType, errorMessage, stackTrace, JSON.stringify(contextData), userId, guildId, commandName, severity]
            );
        } catch (error) {
            logger.error('Failed to log error to database:', error);
        }
    }

    async logUserInteraction(userId, username, interactionType, details, guildId, sessionId = null) {
        try {
            await this.query(
                `INSERT INTO user_interactions (user_id, username, interaction_type, details, guild_id, session_id) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [userId, username, interactionType, JSON.stringify(details), guildId, sessionId]
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
                [endpoint, method, responseTime, statusCode, success, errorMessage, requestSize, responseSize]
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
                [userId, searchQuery, searchType, searchRarity, resultsFound, executionTime]
            );
        } catch (error) {
            logger.error('Failed to log search analytics:', error);
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
