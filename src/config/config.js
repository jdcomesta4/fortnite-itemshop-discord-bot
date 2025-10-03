/**
 * Bot Configuration
 * Centralized configuration for the Fortnite Item Shop Discord Bot
 */

module.exports = {
    // Pagination settings
    pagination: {
        itemsPerPage: 6,
        wishlistItemsPerPage: 6,
        shopItemsPerPage: 6,
        maxEmbedFields: 25
    },

    // Session management
    sessions: {
        wishlistMaxSessions: 50,
        shopMaxSessions: 100,
        sessionTimeout: 30 * 60 * 1000, // 30 minutes
        sessionExtendedTimeout: 45 * 60 * 1000, // 45 minutes
        cleanupInterval: 5 * 60 * 1000 // 5 minutes
    },

    // Cache settings
    cache: {
        shopDataTTL: 6 * 60 * 60 * 1000, // 6 hours
        itemSearchTTL: 30 * 60 * 1000, // 30 minutes
        itemDetailsTTL: 60 * 60 * 1000, // 1 hour
        maxStaleAge: 48 * 60 * 60 * 1000, // 48 hours (for stale cache fallback)
        cleanupInterval: 60 * 60 * 1000 // 1 hour
    },

    // API settings
    api: {
        timeout: 30000, // 30 seconds
        retries: 3,
        retryDelay: (attempt) => Math.pow(2, attempt) * 1000,
        batchSize: 5,
        batchDelay: 100, // milliseconds between batches
        itemHistoryBatchSize: 3,
        itemHistoryBatchDelay: 300 // milliseconds
    },

    // Database settings
    database: {
        connectionLimit: 10,
        idleTimeout: 900000, // 15 minutes
        connectTimeout: 20000, // 20 seconds
        reconnectInterval: 30000, // 30 seconds
        maintenanceSchedule: {
            commandUsageRetention: 30, // days
            errorLogsRetention: 30, // days
            userInteractionsRetention: 30, // days
            apiRequestsRetention: 7, // days
            searchAnalyticsRetention: 60 // days
        }
    },

    // Logging settings
    logging: {
        maxFileSize: 10485760, // 10MB
        maxFiles: 5,
        apiLogMaxSize: 5242880, // 5MB
        apiLogMaxFiles: 3
    },

    // Discord settings
    discord: {
        maxButtonsPerRow: 5,
        maxRows: 5,
        maxEmbeds: 10,
        customIdMaxLength: 100,
        buttonLabelMaxLength: 80
    },

    // Scheduler settings
    scheduler: {
        dailyShopTime: '30 0 * * *', // 00:30 UTC (01:30 AM UTC+1)
        cacheCleanupTime: '0 */6 * * *', // Every 6 hours
        dbMaintenanceTime: '0 2 * * 0', // Sundays at 02:00 UTC
        shopRetryDelay: 5 * 60 * 1000 // 5 minutes
    },

    // Rate limiting (for future implementation)
    rateLimiting: {
        enabled: false, // Not yet implemented
        commandsPerMinute: 10,
        commandsPerHour: 100
    },

    // Bot metadata
    bot: {
        name: 'Fortnite Item Shop Bot',
        version: '2.0.0',
        author: 'jdcomesta4',
        supportServer: 'https://discord.gg/QNRSdhmyxu',
        defaultPrefix: 'jd!'
    }
};
