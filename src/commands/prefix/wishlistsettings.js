const { EmbedBuilder } = require('discord.js');
const permissionManager = require('../../utils/permissionManager');
const database = require('../../utils/database');
const logger = require('../../utils/logger');

module.exports = {
    name: 'wishlistsettings',
    description: 'Manage your personal wishlist notification preferences',
    usage: 'wishlistsettings <toggle|view> [enabled|disabled]',
    aliases: ['wlsettings', 'wishlistconfig'],
    
    async execute(message, args) {
        const startTime = Date.now();
        
        try {
            // Check permissions (users can manage their own settings)
            const hasPermission = await permissionManager.canUseShopCommands(message.member, message.guildId);
            if (!hasPermission) {
                const guildConfig = await database.getGuildConfig(message.guildId);
                const deniedEmbed = permissionManager.getPermissionDeniedEmbed(guildConfig?.trusted_role_id);
                await message.reply({ embeds: [deniedEmbed] });
                return;
            }

            const subcommand = args[0]?.toLowerCase();
            const userId = message.author.id;

            if (!subcommand || !['toggle', 'view'].includes(subcommand)) {
                const helpEmbed = new EmbedBuilder()
                    .setTitle('⚙️ Wishlist Settings Command')
                    .setDescription('Manage your personal wishlist notification preferences')
                    .addFields([
                        { 
                            name: 'Usage', 
                            value: `\`${process.env.PREFIX || 'jd!'}wishlistsettings <subcommand> [options]\``, 
                            inline: false 
                        },
                        { 
                            name: 'Subcommands', 
                            value: 
                                `\`toggle <enabled|disabled>\` - Enable or disable wishlist notifications\n` +
                                `\`view\` - View your current preferences`,
                            inline: false 
                        },
                        { 
                            name: 'Examples', 
                            value: 
                                `\`${process.env.PREFIX || 'jd!'}wishlistsettings toggle enabled\`\n` +
                                `\`${process.env.PREFIX || 'jd!'}wishlistsettings view\``,
                            inline: false 
                        }
                    ])
                    .setColor(0x00AE86)
                    .setTimestamp();
                
                await message.reply({ embeds: [helpEmbed] });
                return;
            }

            logger.command(`Wishlist settings ${subcommand} by ${message.author.username}`);

            switch (subcommand) {
                case 'toggle':
                    await this.handleToggleNotifications(message, args, userId, startTime);
                    break;
                case 'view':
                    await this.handleViewSettings(message, userId, startTime);
                    break;
            }

        } catch (error) {
            logger.error('Error in wishlistsettings prefix command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Error')
                .setDescription('An error occurred while managing your wishlist settings.')
                .setTimestamp();

            await message.reply({ embeds: [errorEmbed] });

            // Log command usage with error
            await database.logCommandUsage(
                message.author.id,
                message.author.username,
                'wishlistsettings',
                { subcommand: args[0] },
                message.guildId,
                message.guild?.name,
                Date.now() - startTime,
                false,
                error.message
            );
        }
    },

    async handleToggleNotifications(message, args, userId, startTime) {
        try {
            const enabledArg = args[1]?.toLowerCase();
            
            if (!enabledArg || !['enabled', 'disabled', 'true', 'false', 'on', 'off'].includes(enabledArg)) {
                const helpEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('❌ Invalid Argument')
                    .setDescription(`Usage: \`${process.env.PREFIX || 'jd!'}wishlistsettings toggle <enabled|disabled>\``)
                    .setTimestamp();
                
                await message.reply({ embeds: [helpEmbed] });
                return;
            }

            const enabled = ['enabled', 'true', 'on'].includes(enabledArg);

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
                          'You can still manage your wishlist using the wishlist commands.'
                )
                .addFields(
                    { 
                        name: 'How notifications work', 
                        value: enabled 
                            ? '• Notifications are sent once per day when items appear\n' +
                              '• You\'ll be notified in servers with configured notification channels\n' +
                              '• If no server channel is available, you\'ll receive a direct message'
                            : `• Use \`${process.env.PREFIX || 'jd!'}wishlistsettings toggle enabled\` to re-enable notifications\n` +
                              '• Your wishlist items are still saved and can be viewed anytime\n' +
                              '• You can still add and remove items from your wishlist',
                        inline: false 
                    }
                )
                .setFooter({ 
                    text: enabled 
                        ? `Use ${process.env.PREFIX || 'jd!'}wishlistsettings view to see your current settings`
                        : `You can re-enable notifications anytime using ${process.env.PREFIX || 'jd!'}wishlistsettings toggle enabled`
                })
                .setTimestamp();

            await message.reply({ embeds: [statusEmbed] });

            // Log user interaction
            await database.logUserInteraction(
                userId,
                message.author.username,
                'command',
                { 
                    action: 'toggle_notifications',
                    enabled: enabled
                },
                message.guildId
            );

            // Log command usage
            await database.logCommandUsage(
                message.author.id,
                message.author.username,
                'wishlistsettings',
                { subcommand: 'toggle', enabled },
                message.guildId,
                message.guild?.name,
                Date.now() - startTime,
                true
            );

        } catch (error) {
            logger.error('Error toggling wishlist notifications:', error);
            throw error;
        }
    },

    async handleViewSettings(message, userId, startTime) {
        try {
            // Get user preferences and wishlist stats
            const preferences = await database.getNotificationPreference(userId);
            const wishlistStats = await database.getWishlistStats(userId);

            const settingsEmbed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle('⚙️ Your Wishlist Settings')
                .setThumbnail(message.author.displayAvatarURL())
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
                    text: `Use ${process.env.PREFIX || 'jd!'}wishlistsettings toggle to change your notification preferences` 
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
                        `• Use \`${process.env.PREFIX || 'jd!'}wishlistsettings toggle enabled\` to enable notifications`,
                    inline: false
                });
            }

            // Add quick action tips
            settingsEmbed.addFields({
                name: '🎯 Quick Actions',
                value: 
                    `\`${process.env.PREFIX || 'jd!'}mywishlist\` - View your current wishlist\n` +
                    `\`${process.env.PREFIX || 'jd!'}addtowishlist\` - Add items to your wishlist\n` +
                    `\`${process.env.PREFIX || 'jd!'}removefromwishlist\` - Remove items from your wishlist`,
                inline: false
            });

            await message.reply({ embeds: [settingsEmbed] });

            // Log command usage
            await database.logCommandUsage(
                message.author.id,
                message.author.username,
                'wishlistsettings',
                { subcommand: 'view', notificationsEnabled: preferences.wishlist_notifications_enabled },
                message.guildId,
                message.guild?.name,
                Date.now() - startTime,
                true
            );

        } catch (error) {
            logger.error('Error viewing wishlist settings:', error);
            throw error;
        }
    }
};
