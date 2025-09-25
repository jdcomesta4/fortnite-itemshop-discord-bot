const { SlashCommandBuilder } = require('discord.js');
const shopManager = require('../../utils/shopManager');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('showcurrentitemshop')
        .setDescription('Display the current Fortnite item shop with navigation'),
    
    async execute(interaction) {
        try {
            await interaction.deferReply();
            await shopManager.displayShop(interaction, 0);
        } catch (error) {
            logger.error('Error in showcurrentitemshop slash command:', error);
            throw error;
        }
    }
};
