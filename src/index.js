require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const logger = require('./utils/logger');
const envValidator = require('./utils/envValidator');
const commandHandler = require('./handlers/commandHandler');
const eventHandler = require('./handlers/eventHandler');
const errorHandler = require('./handlers/errorHandler');
const database = require('./utils/database');
const scheduler = require('./utils/scheduler');

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Initialize collections
client.commands = new Collection();
client.slashCommands = new Collection();

// Global error handlers
process.on('unhandledRejection', async (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    
    // Don't try to log database connection errors to prevent loops
    if (reason && reason.code !== 'ECONNREFUSED' && !reason.message?.includes('Database not connected')) {
        try {
            await errorHandler.logError('unhandledRejection', reason, { promise: promise.toString() });
        } catch (logError) {
            logger.warn('Could not log unhandled rejection to database');
        }
    }
});

process.on('uncaughtException', async (error) => {
    logger.error('Uncaught Exception:', error);
    
    // Don't try to log database connection errors to prevent loops
    if (error.code !== 'ECONNREFUSED' && !error.message?.includes('Database not connected')) {
        try {
            await errorHandler.logError('uncaughtException', error);
        } catch (logError) {
            logger.warn('Could not log uncaught exception to database');
        }
    }
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await database.end();
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await database.end();
    client.destroy();
    process.exit(0);
});

// Initialize bot
async function initialize() {
    try {
        // Validate environment variables first
        const validationPassed = envValidator.validate();
        if (!validationPassed) {
            logger.error('Environment validation failed. Please check your .env file and ensure all required variables are set.');
            process.exit(1);
        }

        // Try to establish database connection
        try {
            await database.testConnection();
            logger.info('Database connection established successfully');
        } catch (dbError) {
            logger.warn('Database connection failed, bot will continue without database logging:', dbError.message);
            // Don't exit, continue without database
        }

        // Load commands and events
        await commandHandler.loadCommands(client);
        await eventHandler.loadEvents(client);
        
        // Initialize scheduler
        scheduler.initialize(client);
        
        // Login to Discord
        await client.login(process.env.DISCORD_TOKEN);
        
    } catch (error) {
        logger.error('Failed to initialize bot:', error);
        // Try to log the error, but don't fail if database is unavailable
        try {
            await errorHandler.logError('initialization', error);
        } catch (logError) {
            logger.warn('Could not log initialization error to database');
        }
        process.exit(1);
    }
}

// Start the bot
initialize();

module.exports = client;
