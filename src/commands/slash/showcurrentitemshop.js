const { SlashCommandBuilder } = require('discord.js');
const shopManager = require('../../utils/shopManager');
const permissionManager = require('../../utils/permissionManager');
const database = require('../../utils/database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('showcurrentitemshop')
        .setDescription('Display the current Fortnite item shop with navigation'),
    
    async execute(interaction) {
        try {
            // Check permissions
            const hasPermission = await permissionManager.canUseShopCommands(interaction.member, interaction.guildId);
            if (!hasPermission) {
                const guildConfig = await database.getGuildConfig(interaction.guildId);
                const deniedEmbed = permissionManager.getPermissionDeniedEmbed(guildConfig?.trusted_role_id);
                await interaction.reply({ embeds: [deniedEmbed], ephemeral: true });
                return;
            }

            await interaction.deferReply();
            await shopManager.displayShop(interaction, 0);
        } catch (error) {
            logger.error('Error in showcurrentitemshop slash command:', error);
            throw error;
        }
    }
};
