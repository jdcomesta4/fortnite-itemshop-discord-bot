const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const permissionManager = require('../../utils/permissionManager');
const database = require('../../utils/database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wishlistsettings')
        .setDescription('Manage your personal wishlist notification preferences')
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Enable or disable wishlist notifications for yourself')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Whether you want to receive wishlist notifications')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View your current wishlist notification preferences')),
    
    async execute(interaction) {
        const startTime = Date.now();
        
        try {
            // Check permissions (users can manage their own settings)
            const hasPermission = await permissionManager.canUseShopCommands(interaction.member, interaction.guildId);
            if (!hasPermission) {
                const guildConfig = await database.getGuildConfig(interaction.guildId);
                const deniedEmbed = permissionManager.getPermissionDeniedEmbed(guildConfig?.trusted_role_id);
                await interaction.reply({ embeds: [deniedEmbed], ephemeral: true });
                return;
            }

            const subcommand = interaction.options.getSubcommand();
            const userId = interaction.user.id;

            logger.command(`Wishlist settings ${subcommand} by ${interaction.user.username}`);

            switch (subcommand) {
                case 'toggle':
                    await this.handleToggleNotifications(interaction, userId, startTime);
                    break;
                case 'view':
                    await this.handleViewSettings(interaction, userId, startTime);
                    break;
                default:
                    throw new Error(`Unknown subcommand: ${subcommand}`);
            }

        } catch (error) {
            logger.error('Error in wishlistsettings command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Error')
                .setDescription('An error occurred while managing your wishlist settings.')
                .setTimestamp();

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Log command usage with error
            await database.logCommandUsage(
                interaction.user.id,
                interaction.user.username,
                'wishlistsettings',
                { subcommand: interaction.options.getSubcommand() },
                interaction.guildId,
                interaction.guild?.name,
                Date.now() - startTime,
                false,
                error.message
            );
        }
    },

    async handleToggleNotifications(interaction, userId, startTime) {
        try {
            const enabled = interaction.options.getBoolean('enabled');

            await interaction.deferReply({ ephemeral: true });

            // Update user preferences
            await database.setNotificationPreference(userId, enabled);

            const statusEmbed = new EmbedBuilder()
                .setColor(enabled ? '#2ECC71' : '#E74C3C')
                .setTitle(`${enabled ? '🔔' : '🔕'} Wishlist Notifications ${enabled ? 'Enabled' : 'Disabled'}`)
                .setDescription(
                    enabled 
                        ? '**Wishlist notifications are now enabled!**\n\n' +
                          'You will receive notifications when your wishlist items appear in the daily shop. ' +
                          'Notifications will be sent to configured server channels or via direct message.'
                        : '**Wishlist notifications are now disabled.**\n\n' +
                          'You will no longer receive notifications when your wishlist items appear in the shop. ' +
                          'You can still manage your wishlist using `/addtowishlist` and `/mywishlist` commands.'
                )
                .addFields(
                    { 
                        name: 'How notifications work', 
                        value: enabled 
                            ? '• Notifications are sent once per day when items appear\n' +
                              '• You\'ll be notified in servers with configured notification channels\n' +
                              '• If no server channel is available, you\'ll receive a direct message'
                            : '• Use `/wishlistsettings toggle enabled:true` to re-enable notifications\n' +
                              '• Your wishlist items are still saved and can be viewed anytime\n' +
                              '• You can still add and remove items from your wishlist',
                        inline: false 
                    }
                )
                .setFooter({ 
                    text: enabled 
                        ? 'Use /wishlistsettings view to see your current settings'
                        : 'You can re-enable notifications anytime using /wishlistsettings toggle'
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [statusEmbed] });

            // Log user interaction
            await database.logUserInteraction(
                userId,
                interaction.user.username,
                'command',
                { 
                    action: 'toggle_notifications',
                    enabled: enabled
                },
                interaction.guildId
            );

            // Log command usage
            await database.logCommandUsage(
                interaction.user.id,
                interaction.user.username,
                'wishlistsettings',
                { subcommand: 'toggle', enabled },
                interaction.guildId,
                interaction.guild?.name,
                Date.now() - startTime,
                true
            );

        } catch (error) {
            logger.error('Error toggling wishlist notifications:', error);
            throw error;
        }
    },

    async handleViewSettings(interaction, userId, startTime) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // Get user preferences and wishlist stats
            const preferences = await database.getNotificationPreference(userId);
            const wishlistStats = await database.getWishlistStats(userId);

            const settingsEmbed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle('⚙️ Your Wishlist Settings')
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    { 
                        name: '🔔 Notifications', 
                        value: preferences.wishlist_notifications_enabled 
                            ? '🟢 **Enabled** - You will receive notifications'
                            : '🔴 **Disabled** - You will not receive notifications', 
                        inline: false 
                    },
                    { 
                        name: '📋 Wishlist Stats', 
                        value: 
                            `**Items:** ${wishlistStats.total_items}\n` +
                            `**Total Value:** ${wishlistStats.total_vbucks.toLocaleString()} V-Bucks`, 
                        inline: true 
                    },
                    { 
                        name: '📅 Last Updated', 
                        value: preferences.last_updated 
                            ? new Date(preferences.last_updated).toLocaleDateString()
                            : 'Never', 
                        inline: true 
                    }
                )
                .setFooter({ 
                    text: 'Use /wishlistsettings toggle to change your notification preferences' 
                })
                .setTimestamp();

            // Add information about how notifications work
            if (preferences.wishlist_notifications_enabled) {
                settingsEmbed.addFields({
                    name: '📤 How Notifications Work',
                    value: 
                        '• You get notified once per day when your items appear in shop\n' +
                        '• Notifications are sent to server channels (if configured) or DMs\n' +
                        '• You won\'t be spammed - only one notification per item per day',
                    inline: false
                });
            } else {
                settingsEmbed.addFields({
                    name: '💡 About Notifications',
                    value: 
                        '• Notifications are currently disabled for your account\n' +
                        '• Your wishlist is still active and items are saved\n' +
                        '• Use `/wishlistsettings toggle enabled:true` to enable notifications',
                    inline: false
                });
            }

            // Add quick action tips
            settingsEmbed.addFields({
                name: '🎯 Quick Actions',
                value: 
                    '`/mywishlist` - View your current wishlist\n' +
                    '`/addtowishlist` - Add items to your wishlist\n' +
                    '`/removefromwishlist` - Remove items from your wishlist',
                inline: false
            });

            await interaction.editReply({ embeds: [settingsEmbed] });

            // Log command usage
            await database.logCommandUsage(
                interaction.user.id,
                interaction.user.username,
                'wishlistsettings',
                { subcommand: 'view', notificationsEnabled: preferences.wishlist_notifications_enabled },
                interaction.guildId,
                interaction.guild?.name,
                Date.now() - startTime,
                true
            );

        } catch (error) {
            logger.error('Error viewing wishlist settings:', error);
            throw error;
        }
    }
};