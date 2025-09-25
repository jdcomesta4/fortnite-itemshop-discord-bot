const { Events } = require('discord.js');
const logger = require('../utils/logger');
const commandHandler = require('../handlers/commandHandler');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        try {
            logger.info(`Bot is ready! Logged in as ${client.user.tag}`);
            logger.info(`Bot is in ${client.guilds.cache.size} guilds`);
            
            // Register slash commands
            await commandHandler.registerSlashCommands(client);
            
            // Set bot activity
            client.user.setActivity('Fortnite Item Shop | jd!help', { type: 'WATCHING' });
            
            logger.info('Bot initialization completed successfully');
            
        } catch (error) {
            logger.error('Error during bot ready event:', error);
        }
    }
};
