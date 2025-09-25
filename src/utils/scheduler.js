const cron = require('node-cron');
const logger = require('./logger');
const shopManager = require('./shopManager');
const errorHandler = require('../handlers/errorHandler');

class Scheduler {
    constructor() {
        this.jobs = new Map();
        this.isInitialized = false;
    }

    initialize(client) {
        if (this.isInitialized) {
            logger.warn('Scheduler already initialized');
            return;
        }

        try {
            // Schedule daily shop posting at 1:30 AM UTC+1 (0:30 UTC)
            // Cron format: minute hour day month dayOfWeek
            const dailyShopJob = cron.schedule('30 0 * * *', async () => {
                await this.handleDailyShopPost(client);
            }, {
                scheduled: false,
                timezone: "UTC"
            });

            this.jobs.set('dailyShop', dailyShopJob);
            dailyShopJob.start();

            // Schedule cache cleanup every 6 hours
            const cacheCleanupJob = cron.schedule('0 */6 * * *', async () => {
                await this.handleCacheCleanup();
            }, {
                scheduled: false,
                timezone: "UTC"
            });

            this.jobs.set('cacheCleanup', cacheCleanupJob);
            cacheCleanupJob.start();

            // Schedule database maintenance every Sunday at 2 AM UTC
            const dbMaintenanceJob = cron.schedule('0 2 * * 0', async () => {
                await this.handleDatabaseMaintenance();
            }, {
                scheduled: false,
                timezone: "UTC"
            });

            this.jobs.set('dbMaintenance', dbMaintenanceJob);
            dbMaintenanceJob.start();

            this.isInitialized = true;
            logger.info('Scheduler initialized with 3 jobs:');
            logger.info('• Daily shop posting: 01:30 UTC (02:30 CET)');
            logger.info('• Cache cleanup: Every 6 hours');
            logger.info('• Database maintenance: Sundays at 02:00 UTC');

        } catch (error) {
            logger.error('Failed to initialize scheduler:', error);
            throw error;
        }
    }

    async handleDailyShopPost(client) {
        try {
            logger.shop('Starting scheduled daily shop post...');
            
            const startTime = Date.now();
            await shopManager.postDailyShop(client);
            const executionTime = Date.now() - startTime;
            
            logger.shop(`Daily shop post completed in ${executionTime}ms`);
            
        } catch (error) {
            logger.error('Daily shop post failed:', error);
            
            await errorHandler.logError(
                'scheduled_shop_post',
                error,
                { 
                    scheduledTime: new Date().toISOString(),
                    executionAttempt: 1
                },
                null,
                null,
                null,
                'critical'
            );

            // Retry after 5 minutes
            setTimeout(async () => {
                try {
                    logger.shop('Retrying daily shop post after failure...');
                    await shopManager.postDailyShop(client);
                    logger.shop('Daily shop post retry successful');
                } catch (retryError) {
                    logger.error('Daily shop post retry failed:', retryError);
                    
                    await errorHandler.logError(
                        'scheduled_shop_post_retry',
                        retryError,
                        { 
                            originalError: error.message,
                            retryAttempt: 1
                        },
                        null,
                        null,
                        null,
                        'critical'
                    );
                }
            }, 5 * 60 * 1000);
        }
    }

    async handleCacheCleanup() {
        try {
            logger.debug('Starting scheduled cache cleanup...');
            
            const apiClient = require('./apiClient');
            const beforeStats = apiClient.getCacheStats();
            
            // Clean expired cache entries (this happens automatically in apiClient)
            // But we can force a more aggressive cleanup here
            
            logger.debug(`Cache cleanup completed. Before: ${beforeStats.total} entries, After: ${apiClient.getCacheStats().total} entries`);
            
        } catch (error) {
            logger.error('Cache cleanup failed:', error);
            await errorHandler.logError('cache_cleanup', error, {}, null, null, null, 'low');
        }
    }

    async handleDatabaseMaintenance() {
        try {
            logger.info('Starting scheduled database maintenance...');
            
            const database = require('./database');
            
            // Clean old logs (keep last 30 days)
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            
            // Clean old command usage logs
            await database.query(
                'DELETE FROM command_usage WHERE timestamp < ?',
                [thirtyDaysAgo]
            );
            
            // Clean old resolved error logs
            await database.query(
                'DELETE FROM error_logs WHERE timestamp < ? AND resolved = TRUE',
                [thirtyDaysAgo]
            );
            
            // Clean old user interactions
            await database.query(
                'DELETE FROM user_interactions WHERE timestamp < ?',
                [thirtyDaysAgo]
            );
            
            // Clean old API request logs (keep last 7 days only)
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            await database.query(
                'DELETE FROM api_requests WHERE timestamp < ?',
                [sevenDaysAgo]
            );
            
            // Clean old search analytics (keep last 60 days)
            const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
            await database.query(
                'DELETE FROM search_analytics WHERE timestamp < ?',
                [sixtyDaysAgo]
            );
            
            // Optimize tables
            await database.query('OPTIMIZE TABLE command_usage');
            await database.query('OPTIMIZE TABLE shop_history');
            await database.query('OPTIMIZE TABLE error_logs');
            await database.query('OPTIMIZE TABLE user_interactions');
            await database.query('OPTIMIZE TABLE api_requests');
            await database.query('OPTIMIZE TABLE search_analytics');
            
            logger.info('Database maintenance completed successfully');
            
        } catch (error) {
            logger.error('Database maintenance failed:', error);
            await errorHandler.logError('db_maintenance', error, {}, null, null, null, 'medium');
        }
    }

    // Manual job control methods
    startJob(jobName) {
        const job = this.jobs.get(jobName);
        if (job) {
            job.start();
            logger.info(`Started job: ${jobName}`);
        } else {
            logger.warn(`Job not found: ${jobName}`);
        }
    }

    stopJob(jobName) {
        const job = this.jobs.get(jobName);
        if (job) {
            job.stop();
            logger.info(`Stopped job: ${jobName}`);
        } else {
            logger.warn(`Job not found: ${jobName}`);
        }
    }

    getJobStatus() {
        const status = {};
        for (const [name, job] of this.jobs) {
            status[name] = {
                running: job.running || false,
                lastDate: job.lastDate || null,
                nextDate: job.nextDate || null
            };
        }
        return status;
    }

    // Test methods for development
    async testDailyShop(client) {
        logger.info('Testing daily shop post manually...');
        await this.handleDailyShopPost(client);
    }

    async testCacheCleanup() {
        logger.info('Testing cache cleanup manually...');
        await this.handleCacheCleanup();
    }

    async testDatabaseMaintenance() {
        logger.info('Testing database maintenance manually...');
        await this.handleDatabaseMaintenance();
    }

    destroy() {
        for (const [name, job] of this.jobs) {
            job.destroy();
            logger.debug(`Destroyed job: ${name}`);
        }
        this.jobs.clear();
        this.isInitialized = false;
        logger.info('Scheduler destroyed');
    }
}

module.exports = new Scheduler();
