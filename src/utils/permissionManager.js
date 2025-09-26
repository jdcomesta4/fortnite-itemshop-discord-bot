const { PermissionFlagsBits } = require('discord.js');
const database = require('./database');
const logger = require('./logger');

class PermissionManager {
    /**
     * Check if a user can use shop commands
     * @param {GuildMember} member - Discord guild member
     * @param {string} guildId - Guild ID
     * @returns {Promise<boolean>} - Whether user has permission
     */
    static async canUseShopCommands(member, guildId) {
        try {
            // Always allow administrators
            if (member.permissions.has(PermissionFlagsBits.Administrator)) {
                return true;
            }

            // Get guild configuration
            const guildConfig = await database.getGuildConfig(guildId);
            
            // If no trusted role is set, allow everyone to use basic commands
            if (!guildConfig || !guildConfig.trusted_role_id) {
                return true;
            }

            // Check if user has the trusted role
            return member.roles.cache.has(guildConfig.trusted_role_id);

        } catch (error) {
            logger.error('Error checking shop command permissions:', error);
            // On error, default to allowing everyone for basic commands
            return true;
        }
    }

    /**
     * Get permission error embed for users without access
     * @param {string} trustedRoleId - ID of the trusted role (if any)
     * @returns {EmbedBuilder} - Permission denied embed
     */
    static getPermissionDeniedEmbed(trustedRoleId = null) {
        const { EmbedBuilder } = require('discord.js');
        
        let description = 'You need Administrator permissions to use this command.';
        if (trustedRoleId) {
            description = `You need Administrator permissions or the <@&${trustedRoleId}> role to use this command.`;
        }

        return new EmbedBuilder()
            .setTitle('❌ Permission Denied')
            .setDescription(description)
            .setColor(0xFF0000)
            .setTimestamp();
    }
}

module.exports = PermissionManager;