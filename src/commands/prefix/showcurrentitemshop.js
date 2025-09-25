const shopManager = require('../../utils/shopManager');
const logger = require('../../utils/logger');

module.exports = {
    name: 'showcurrentitemshop',
    description: 'Display the current Fortnite item shop with navigation',
    aliases: ['shop', 'itemshop'],
    
    async execute(message, args) {
        try {
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
