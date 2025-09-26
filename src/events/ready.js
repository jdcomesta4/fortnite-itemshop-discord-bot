const { Events, ActivityType } = require('discord.js');
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
            
            // Set bot activity - using Custom to display exactly what we want
            client.user.setActivity("use code 'sheready' in the itemshop", { type: ActivityType.Custom });
            
            logger.info("Bot status set to: use code 'sheready' in the itemshop");
            
            logger.info('Bot initialization completed successfully');
            
        } catch (error) {
            logger.error('Error during bot ready event:', error);
        }
    }
};
