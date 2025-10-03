const { EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
    name: 'help',
    description: 'Display help information and available commands',
    aliases: ['commands', 'info', 'h'],
    
    async execute(message, args) {
        try {
            const isAdmin = message.member.permissions.has('Administrator');
            const prefix = process.env.PREFIX || 'jd!';
            
            const helpEmbed = new EmbedBuilder()
                .setTitle('🤖 Fortnite Item Shop Bot - Help')
                .setDescription('A comprehensive bot for tracking the Fortnite item shop with wishlist features, daily updates, and advanced analytics.')
                .setColor(0x00AE86)
                .setThumbnail(message.client.user.displayAvatarURL())
                .setTimestamp();

            // User Commands
            helpEmbed.addFields([
                {
                    name: '🛍️ Shop Commands',
                    value: `\`${prefix}showcurrentitemshop\` - Display the current Fortnite item shop\n\`${prefix}searchitem <name>\` - Search for specific items by name, type, or rarity`,
                    inline: false
                },
                {
                    name: '⭐ Wishlist Commands',
                    value: `\`${prefix}addtowishlist <name>\` - Add an item to your wishlist\n\`${prefix}mywishlist\` - View your personal wishlist\n\`${prefix}removefromwishlist <name>\` - Remove an item from your wishlist`,
                    inline: false
                }
            ]);

            // Admin Commands (only show if user is admin)
            if (isAdmin) {
                helpEmbed.addFields([
                    {
                        name: '⚙️ Admin Commands',
                        value: `\`${prefix}setshopchannel <#channel>\` - Set up daily shop updates\n\`${prefix}setupdateschannel <#channel>\` - Set wishlist notification channel\n\`${prefix}shopsettings\` - View and manage shop configuration\n\`${prefix}botstatus\` - View bot statistics and system info`,
                        inline: false
                    }
                ]);
            }

            // Features & Aliases
            helpEmbed.addFields([
                {
                    name: '✨ Key Features',
                    value: '• **Daily Shop Updates** at 1:30 AM UTC\n• **Wishlist Notifications** when items appear\n• **Interactive Navigation** with buttons\n• **Shop History** tracking\n• **Role-Based Access** control\n• **Multi-Guild Support**',
                    inline: false
                },
                {
                    name: '🔗 Command Aliases',
                    value: `• \`${prefix}shop\`, \`${prefix}itemshop\` → showcurrentitemshop\n• \`${prefix}search\`, \`${prefix}item\` → searchitem\n• \`${prefix}addwish\`, \`${prefix}wadd\` → addtowishlist\n• \`${prefix}wishlist\`, \`${prefix}wl\` → mywishlist\n• \`${prefix}removewish\`, \`${prefix}wremove\` → removefromwishlist\n• \`${prefix}setshop\` → setshopchannel`,
                    inline: false
                },
                {
                    name: '� Pro Tips',
                    value: `• Try slash commands with \`/\` for better Discord integration\n• Use ➕ buttons in shop embeds to quickly add to wishlist\n• Navigate shop pages with ◀️ ▶️ buttons\n• Type \`${prefix}help\` anytime to see this message`,
                    inline: false
                }
            ]);

            // Footer with additional info
            helpEmbed.setFooter({ 
                text: `v2.0.0 • Prefix: ${prefix} • Also supports /slash commands`,
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