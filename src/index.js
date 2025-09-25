require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const logger = require('./utils/logger');
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
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    errorHandler.logError('unhandledRejection', reason, { promise: promise.toString() });
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    errorHandler.logError('uncaughtException', error);
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
        // Test database connection
        await database.testConnection();
        logger.info('Database connection established successfully');

        // Load commands and events
        await commandHandler.loadCommands(client);
        await eventHandler.loadEvents(client);
        
        // Initialize scheduler
        scheduler.initialize(client);
        
        // Login to Discord
        await client.login(process.env.DISCORD_TOKEN);
        
    } catch (error) {
        logger.error('Failed to initialize bot:', error);
        errorHandler.logError('initialization', error);
        process.exit(1);
    }
}

// Start the bot
initialize();

module.exports = client;
