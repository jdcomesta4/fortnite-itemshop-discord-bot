/**
 * Manual Test Utilities
 * Functions for manually testing bot features during development
 */

const logger = require('../utils/logger');
const scheduler = require('../utils/scheduler');

class TestUtilities {
    /**
     * Manually trigger a daily shop post
     * @param {Object} client - Discord client
     */
    async testDailyShop(client) {
        logger.info('🧪 Testing daily shop post manually...');
        try {
            await scheduler.handleDailyShopPost(client);
            logger.info('✅ Test daily shop post completed');
        } catch (error) {
            logger.error('❌ Test daily shop post failed:', error);
        }
    }

    /**
     * Manually trigger cache cleanup
     */
    async testCacheCleanup() {
        logger.info('🧪 Testing cache cleanup manually...');
        try {
            await scheduler.handleCacheCleanup();
            logger.info('✅ Test cache cleanup completed');
        } catch (error) {
            logger.error('❌ Test cache cleanup failed:', error);
        }
    }

    /**
     * Manually trigger database maintenance
     */
    async testDatabaseMaintenance() {
        logger.info('🧪 Testing database maintenance manually...');
        try {
            await scheduler.handleDatabaseMaintenance();
            logger.info('✅ Test database maintenance completed');
        } catch (error) {
            logger.error('❌ Test database maintenance failed:', error);
        }
    }

    /**
     * Test wishlist notification system
     * @param {Object} client - Discord client
     * @param {string} userId - User ID to test with
     */
    async testWishlistNotification(client, userId) {
        logger.info(`🧪 Testing wishlist notification for user ${userId}...`);
        try {
            const wishlistNotifier = require('../utils/wishlistNotifier');
            await wishlistNotifier.testNotificationSystem(client, userId);
            logger.info('✅ Test wishlist notification completed');
        } catch (error) {
            logger.error('❌ Test wishlist notification failed:', error);
        }
    }

    /**
     * Display current scheduler status
     */
    getSchedulerStatus() {
        logger.info('📊 Current scheduler status:');
        const status = scheduler.getJobStatus();
        console.log(JSON.stringify(status, null, 2));
        return status;
    }

    /**
     * Test database connection
     */
    async testDatabaseConnection() {
        logger.info('🧪 Testing database connection...');
        try {
            const database = require('../utils/database');
            await database.testConnection();
            logger.info('✅ Database connection test passed');
            return true;
        } catch (error) {
            logger.error('❌ Database connection test failed:', error);
            return false;
        }
    }

    /**
     * Test API connectivity
     */
    async testApiConnection() {
        logger.info('🧪 Testing API connectivity...');
        try {
            const apiClient = require('../utils/apiClient');
            const shopData = await apiClient.getShop();
            logger.info(`✅ API connection test passed - Found ${shopData.data?.sections?.length || 0} shop sections`);
            return true;
        } catch (error) {
            logger.error('❌ API connection test failed:', error);
            return false;
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        logger.info('📊 Cache statistics:');
        const apiClient = require('../utils/apiClient');
        const stats = apiClient.getCacheStats();
        console.log(JSON.stringify(stats, null, 2));
        return stats;
    }

    /**
     * Clear all caches
     */
    clearAllCaches() {
        logger.info('🧹 Clearing all caches...');
        try {
            const apiClient = require('../utils/apiClient');
            const shopManager = require('../utils/shopManager');
            
            apiClient.clearCache();
            shopManager.clearCache();
            
            logger.info('✅ All caches cleared');
        } catch (error) {
            logger.error('❌ Failed to clear caches:', error);
        }
    }

    /**
     * Run all system tests
     * @param {Object} client - Discord client (optional for some tests)
     */
    async runAllTests(client = null) {
        logger.info('🧪 Running all system tests...\n');
        
        const results = {
            database: await this.testDatabaseConnection(),
            api: await this.testApiConnection(),
            scheduler: this.getSchedulerStatus(),
            cache: this.getCacheStats()
        };

        console.log('\n📋 Test Results Summary:');
        console.log(`  Database: ${results.database ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`  API: ${results.api ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`  Scheduler: ${Object.keys(results.scheduler).length} jobs configured`);
        console.log(`  Cache: ${results.cache.total} entries (${results.cache.valid} valid, ${results.cache.expired} expired)`);

        return results;
    }
}

module.exports = new TestUtilities();
