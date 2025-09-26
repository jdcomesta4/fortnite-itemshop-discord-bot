const shopManager = require('../../utils/shopManager');
const permissionManager = require('../../utils/permissionManager');
const database = require('../../utils/database');
const logger = require('../../utils/logger');

module.exports = {
    name: 'showcurrentitemshop',
    description: 'Display the current Fortnite item shop with navigation',
    aliases: ['shop', 'itemshop'],
    
    async execute(message, args) {
        try {
            // Check permissions
            const hasPermission = await permissionManager.canUseShopCommands(message.member, message.guildId);
            if (!hasPermission) {
                const guildConfig = await database.getGuildConfig(message.guildId);
                const deniedEmbed = permissionManager.getPermissionDeniedEmbed(guildConfig?.trusted_role_id);
                await message.reply({ embeds: [deniedEmbed] });
                return;
            }

            // Create a fake interaction object for compatibility with shopManager
            const fakeInteraction = {
                user: message.author,
                guild: message.guild,
                guildId: message.guildId,
                channelId: message.channelId,
                channel: message.channel,
                deferred: false,
                replied: false,
                reply: async (options) => {
                    const msg = await message.reply(options);
                    fakeInteraction.replied = true;
                    fakeInteraction._message = msg;
                    return msg;
                },
                editReply: async (options) => {
                    if (fakeInteraction._message) {
                        return await fakeInteraction._message.edit(options);
                    }
                    return await message.reply(options);
                }
            };
            
            await shopManager.displayShop(fakeInteraction, 0);
            
        } catch (error) {
            logger.error('Error in showcurrentitemshop prefix command:', error);
            await message.reply('❌ An error occurred while fetching the shop data. Please try again later.');
            throw error;
        }
    }
};
