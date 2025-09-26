const { EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
    name: 'help',
    description: 'Display help information and available commands',
    aliases: ['commands', 'info'],
    
    async execute(message, args) {
        try {
            const isAdmin = message.member.permissions.has('Administrator');
            const prefix = process.env.PREFIX || 'jd!';
            
            const helpEmbed = new EmbedBuilder()
                .setTitle('🤖 Fortnite Item Shop Bot - Help')
                .setDescription('Here are all the available commands:')
                .setColor(0x00AE86)
                .setThumbnail(message.client.user.displayAvatarURL())
                .setTimestamp();

            // User Commands
            helpEmbed.addFields([
                {
                    name: '🛍️ Shop Commands',
                    value: `\`${prefix}showcurrentitemshop\` - Display the current Fortnite item shop\n\`${prefix}searchitem <name>\` - Search for specific items by name, type, or rarity`,
                    inline: false
                }
            ]);

            // Admin Commands (only show if user is admin)
            if (isAdmin) {
                helpEmbed.addFields([
                    {
                        name: '⚙️ Admin Commands',
                        value: `\`${prefix}setshopchannel <#channel>\` - Set up daily shop updates\n\`${prefix}shopsettings\` - View current shop configuration\n\`${prefix}shopsettings toggle <true/false>\` - Toggle daily updates\n\`${prefix}shopsettings remove\` - Remove shop configuration`,
                        inline: false
                    }
                ]);
            }

            // Features
            helpEmbed.addFields([
                {
                    name: '📋 Getting Started',
                    value: isAdmin 
                        ? `1. Use \`${prefix}setshopchannel #channel\` to set up daily updates\n2. Use \`${prefix}showcurrentitemshop\` to view the current shop\n3. Use \`${prefix}searchitem\` to find specific items`
                        : `• Use \`${prefix}showcurrentitemshop\` to view the current shop\n• Use \`${prefix}searchitem\` to find specific items\n• Ask an administrator to set up daily updates`,
                    inline: false
                },
                {
                    name: '🔗 Command Aliases',
                    value: `• \`${prefix}shop\`, \`${prefix}itemshop\` → showcurrentitemshop\n• \`${prefix}search\`, \`${prefix}item\` → searchitem\n• \`${prefix}setshop\`, \`${prefix}shopchannel\` → setshopchannel\n• \`${prefix}shopconfig\`, \`${prefix}shopcfg\` → shopsettings`,
                    inline: false
                }
            ]);

            // Footer with additional info
            helpEmbed.setFooter({ 
                text: `Daily updates: 1:30 AM UTC • Prefix: ${prefix}`,
                iconURL: 'https://fnbr.co/favicon.ico'
            });

            await message.reply({ embeds: [helpEmbed] });

        } catch (error) {
            logger.error('Error in help prefix command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Help Error')
                .setDescription('An error occurred while displaying help information.')
                .setColor(0xFF0000)
                .setTimestamp();
            
            await message.reply({ embeds: [errorEmbed] });
        }
    }
};