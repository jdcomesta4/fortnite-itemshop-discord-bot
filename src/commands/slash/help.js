const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Display help information and available commands'),
    
    async execute(interaction) {
        try {
            const isAdmin = interaction.member.permissions.has('Administrator');
            
            const helpEmbed = new EmbedBuilder()
                .setTitle('🤖 Fortnite Item Shop Bot - Help')
                .setDescription('A comprehensive bot for tracking the Fortnite item shop with wishlist features, daily updates, and advanced analytics.')
                .setColor(0x00AE86)
                .setThumbnail(interaction.client.user.displayAvatarURL())
                .setTimestamp();

            // User Commands
            helpEmbed.addFields([
                {
                    name: '🛍️ Shop Commands',
                    value: '`/showcurrentitemshop` - Display the current Fortnite item shop with interactive navigation\n`/searchitem <name>` - Search for specific items by name, type, or rarity with shop history',
                    inline: false
                },
                {
                    name: '⭐ Wishlist Commands',
                    value: '`/addtowishlist <name>` - Add an item to your personal wishlist\n`/mywishlist` - View and manage your wishlist with pagination\n`/removefromwishlist <name>` - Remove an item from your wishlist\n`/wishlistsettings` - Configure your notification preferences',
                    inline: false
                }
            ]);

            // Admin Commands (only show if user is admin)
            if (isAdmin) {
                helpEmbed.addFields([
                    {
                        name: '⚙️ Admin Commands',
                        value: '`/setshopchannel <channel>` - Set up daily shop updates at 1:30 AM UTC\n`/setupdateschannel <channel>` - Set channel for wishlist notifications\n`/shopsettings` - Manage shop configuration (view, toggle, trusted role)\n`/wishlistsettings` - Configure guild-wide wishlist notification settings\n`/botstatus` - View bot statistics, uptime, and system information',
                    inline: false
                }
                ]);
            }

            // Features
            helpEmbed.addFields([
                {
                    name: '✨ Key Features',
                    value: '• **Daily Shop Updates** - Automatic shop posts at 1:30 AM UTC\n• **Wishlist Notifications** - Get notified when your items appear\n• **Interactive Navigation** - Browse shop sections with buttons\n• **Shop History** - Track when items were last seen\n• **Role-Based Access** - Optional trusted role configuration\n• **Multi-Guild Support** - Independent settings per server',
                    inline: false
                },
                {
                    name: '📋 Getting Started',
                    value: isAdmin 
                        ? '1. Use `/setshopchannel #channel` to enable daily updates\n2. Use `/setupdateschannel #channel` for wishlist notifications\n3. Optionally set a trusted role with `/shopsettings trustedrole`\n4. Users can track items with `/addtowishlist <item>`'
                        : '• Use `/showcurrentitemshop` to view the current shop\n• Use `/searchitem` to find specific items\n• Use `/addtowishlist` to track items you want\n• You\'ll be notified when your wishlist items appear!',
                    inline: false
                },
                {
                    name: '🔔 Wishlist System',
                    value: '• **Smart Matching** - Partial name matching finds your items\n• **Automatic Notifications** - DM or server channel notifications\n• **Daily Tracking** - Only one notification per day per item\n• **Quick Actions** - Add items directly from shop embeds\n• **Privacy Controls** - Disable notifications with `/wishlistsettings`',
                    inline: false
                },
                {
                    name: '💡 Pro Tips',
                    value: '• Use the ➕ buttons in shop embeds for quick wishlist adds\n• Navigate shop pages with ◀️ ▶️ buttons for all sections\n• Search items show "Last Seen" dates from shop history\n• Admin role always bypasses trusted role requirements\n• Both slash (`/`) and prefix (`jd!`) commands available',
                    inline: false
                }
            ]);

            // Footer with additional info
            helpEmbed.setFooter({ 
                text: `v2.0.0 • Daily updates: 1:30 AM UTC • Prefix: ${process.env.PREFIX || 'jd!'} • Multi-guild`,
                iconURL: 'https://fnbr.co/favicon.ico'
            });

            await interaction.reply({ embeds: [helpEmbed] });

        } catch (error) {
            logger.error('Error in help command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Help Error')
                .setDescription('An error occurred while displaying help information.')
                .setColor(0xFF0000)
                .setTimestamp();
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            } else if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
};