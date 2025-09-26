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
                .setDescription('Here are all the available commands:')
                .setColor(0x00AE86)
                .setThumbnail(interaction.client.user.displayAvatarURL())
                .setTimestamp();

            // User Commands
            helpEmbed.addFields([
                {
                    name: '🛍️ Shop Commands',
                    value: '`/showcurrentitemshop` - Display the current Fortnite item shop\n`/searchitem <name>` - Search for specific items by name, type, or rarity',
                    inline: false
                }
            ]);

            // Admin Commands (only show if user is admin)
            if (isAdmin) {
                helpEmbed.addFields([
                    {
                        name: '⚙️ Admin Commands',
                        value: '`/setshopchannel <channel>` - Set up daily shop updates\n`/shopsettings` - Manage shop channel settings\n`/shopsettings view` - View current configuration\n`/shopsettings toggle <true/false>` - Toggle daily updates\n`/shopsettings trustedrole <role>` - Set trusted role for shop commands\n`/shopsettings remove` - Remove shop configuration',
                        inline: false
                    }
                ]);
            }

            // Features
            helpEmbed.addFields([
                {
                    name: '📋 Getting Started',
                    value: isAdmin 
                        ? '1. Use `/setshopchannel #channel` to set up daily updates\n2. Use `/showcurrentitemshop` to view the current shop\n3. Use `/searchitem` to find specific items'
                        : '• Use `/showcurrentitemshop` to view the current shop\n• Use `/searchitem` to find specific items\n• Ask an administrator to set up daily updates',
                    inline: false
                }
            ]);

            // Footer with additional info
            helpEmbed.setFooter({ 
                text: `Daily updates: 1:30 AM UTC • Prefix: ${process.env.PREFIX || 'jd!'} • Multi-guild support`,
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
            
            // Check if interaction has already been replied to or deferred
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