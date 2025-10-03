const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const database = require('../../utils/database');
const logger = require('../../utils/logger');

module.exports = {
    name: 'setupdateschannel',
    description: 'Configure wishlist update notifications',
    usage: 'setupdateschannel <set|view|toggle|remove> [channel|enabled]',
    aliases: ['setupupdates', 'updateschannel'],
    
    async execute(message, args) {
        const startTime = Date.now();
        
        try {
            // Check if user has administrator permissions
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                const noPermEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('❌ Insufficient Permissions')
                    .setDescription('You need Administrator permissions to use this command.')
                    .setTimestamp();

                await message.reply({ embeds: [noPermEmbed] });
                return;
            }

            const subcommand = args[0]?.toLowerCase();
            const guildId = message.guildId;

            if (!subcommand || !['set', 'view', 'toggle', 'remove'].includes(subcommand)) {
                const helpEmbed = new EmbedBuilder()
                    .setTitle('⚙️ Setup Updates Channel Command')
                    .setDescription('Configure wishlist update notifications')
                    .addFields([
                        { 
                            name: 'Usage', 
                            value: `\`${process.env.PREFIX || 'jd!'}setupdateschannel <subcommand> [options]\``, 
                            inline: false 
                        },
                        { 
                            name: 'Subcommands', 
                            value: 
                                `\`set #channel\` - Set the notification channel\n` +
                                `\`view\` - View current configuration\n` +
                                `\`toggle <enabled|disabled>\` - Enable or disable notifications\n` +
                                `\`remove\` - Remove configuration`,
                            inline: false 
                        },
                        { 
                            name: 'Examples', 
                            value: 
                                `\`${process.env.PREFIX || 'jd!'}setupdateschannel set #wishlist-alerts\`\n` +
                                `\`${process.env.PREFIX || 'jd!'}setupdateschannel view\`\n` +
                                `\`${process.env.PREFIX || 'jd!'}setupdateschannel toggle enabled\``,
                            inline: false 
                        }
                    ])
                    .setColor(0x00AE86)
                    .setTimestamp();
                
                await message.reply({ embeds: [helpEmbed] });
                return;
            }

            logger.command(`Setup updates channel ${subcommand} by ${message.author.username} in guild ${guildId}`);

            switch (subcommand) {
                case 'set':
                    await this.handleSetChannel(message, args, guildId, startTime);
                    break;
                case 'view':
                    await this.handleViewConfig(message, guildId, startTime);
                    break;
                case 'toggle':
                    await this.handleToggle(message, args, guildId, startTime);
                    break;
                case 'remove':
                    await this.handleRemoveConfig(message, guildId, startTime);
                    break;
            }

        } catch (error) {
            logger.error('Error in setupdateschannel prefix command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Error')
                .setDescription('An error occurred while configuring wishlist notifications.')
                .setTimestamp();

            await message.reply({ embeds: [errorEmbed] });

            // Log command usage with error
            await database.logCommandUsage(
                message.author.id,
                message.author.username,
                'setupdateschannel',
                { subcommand: args[0] },
                message.guildId,
                message.guild?.name,
                Date.now() - startTime,
                false,
                error.message
            );
        }
    },

    async handleSetChannel(message, args, guildId, startTime) {
        try {
            // Get channel from mention or ID
            const channelMention = args[1];
            if (!channelMention) {
                const noChannelEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('❌ Missing Channel')
                    .setDescription(`Please mention a channel.\n\nUsage: \`${process.env.PREFIX || 'jd!'}setupdateschannel set #channel\``)
                    .setTimestamp();
                
                await message.reply({ embeds: [noChannelEmbed] });
                return;
            }

            const channel = message.mentions.channels.first() || 
                           message.guild.channels.cache.get(channelMention.replace(/[<>#]/g, ''));

            if (!channel) {
                const invalidChannelEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('❌ Invalid Channel')
                    .setDescription('Could not find the specified channel.')
                    .setTimestamp();
                
                await message.reply({ embeds: [invalidChannelEmbed] });
                return;
            }

            // Check if it's a text channel
            if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
                const wrongTypeEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('❌ Invalid Channel Type')
                    .setDescription('Please select a text channel or announcement channel.')
                    .setTimestamp();
                
                await message.reply({ embeds: [wrongTypeEmbed] });
                return;
            }

            // Verify bot permissions in the selected channel
            const botMember = message.guild.members.cache.get(message.client.user.id);
            const channelPermissions = channel.permissionsFor(botMember);

            if (!channelPermissions.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
                const permissionEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('❌ Insufficient Bot Permissions')
                    .setDescription(
                        `I don't have the required permissions in ${channel}.\n\n` +
                        '**Required Permissions:**\n' +
                        '• Send Messages\n' +
                        '• Embed Links'
                    )
                    .setTimestamp();

                await message.reply({ embeds: [permissionEmbed] });
                return;
            }

            // Set the updates channel in database
            await database.setUpdatesChannel(guildId, channel.id, message.author.id);

            const successEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('✅ Wishlist Notifications Configured')
                .setDescription(`Wishlist notifications will be sent to ${channel}`)
                .addFields(
                    { name: 'Channel', value: `${channel}`, inline: true },
                    { name: 'Configured by', value: `${message.author}`, inline: true },
                    { name: 'Status', value: 'Enabled', inline: true }
                )
                .setFooter({ 
                    text: 'Users will receive notifications when their wishlist items appear in the daily shop' 
                })
                .setTimestamp();

            await message.reply({ embeds: [successEmbed] });

            // Log command usage
            await database.logCommandUsage(
                message.author.id,
                message.author.username,
                'setupdateschannel',
                { subcommand: 'set', channelId: channel.id },
                message.guildId,
                message.guild?.name,
                Date.now() - startTime,
                true
            );

        } catch (error) {
            logger.error('Error setting updates channel:', error);
            throw error;
        }
    },

    async handleViewConfig(message, guildId, startTime) {
        try {
            const config = await database.getUpdatesChannel(guildId);

            if (!config) {
                const noConfigEmbed = new EmbedBuilder()
                    .setColor('#6C7B7F')
                    .setTitle('📋 No Configuration Found')
                    .setDescription(
                        'Wishlist notifications are not configured for this server.\n\n' +
                        `Use \`${process.env.PREFIX || 'jd!'}setupdateschannel set #channel\` to configure a notification channel.`
                    )
                    .setTimestamp();

                await message.reply({ embeds: [noConfigEmbed] });
                return;
            }

            const channel = message.guild.channels.cache.get(config.updates_channel_id);
            const configuredBy = await message.client.users.fetch(config.configured_by).catch(() => null);

            const viewEmbed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle('⚙️ Wishlist Notification Configuration')
                .addFields(
                    { 
                        name: 'Channel', 
                        value: channel ? `${channel}` : `Unknown Channel (${config.updates_channel_id})`, 
                        inline: true 
                    },
                    { 
                        name: 'Status', 
                        value: config.notifications_enabled ? '🟢 Enabled' : '🔴 Disabled', 
                        inline: true 
                    },
                    { 
                        name: 'Configured by', 
                        value: configuredBy ? `${configuredBy.tag}` : 'Unknown User', 
                        inline: true 
                    },
                    { 
                        name: 'Configured', 
                        value: new Date(config.configured_at).toLocaleDateString(), 
                        inline: true 
                    },
                    { 
                        name: 'Last Updated', 
                        value: new Date(config.last_updated).toLocaleDateString(), 
                        inline: true 
                    }
                )
                .setFooter({ 
                    text: `Use ${process.env.PREFIX || 'jd!'}setupdateschannel toggle to enable/disable notifications` 
                })
                .setTimestamp();

            // Check if channel still exists and bot has permissions
            if (!channel) {
                viewEmbed.setColor('#F39C12');
                viewEmbed.addFields({ 
                    name: '⚠️ Warning', 
                    value: 'The configured channel no longer exists or is not accessible.', 
                    inline: false 
                });
            } else {
                const botMember = message.guild.members.cache.get(message.client.user.id);
                const channelPermissions = channel.permissionsFor(botMember);
                
                if (!channelPermissions.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
                    viewEmbed.setColor('#F39C12');
                    viewEmbed.addFields({ 
                        name: '⚠️ Warning', 
                        value: 'Bot lacks required permissions in the configured channel.', 
                        inline: false 
                    });
                }
            }

            await message.reply({ embeds: [viewEmbed] });

            // Log command usage
            await database.logCommandUsage(
                message.author.id,
                message.author.username,
                'setupdateschannel',
                { subcommand: 'view' },
                message.guildId,
                message.guild?.name,
                Date.now() - startTime,
                true
            );

        } catch (error) {
            logger.error('Error viewing updates channel config:', error);
            throw error;
        }
    },

    async handleToggle(message, args, guildId, startTime) {
        try {
            const enabledArg = args[1]?.toLowerCase();
            
            if (!enabledArg || !['enabled', 'disabled', 'true', 'false', 'on', 'off'].includes(enabledArg)) {
                const helpEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('❌ Invalid Argument')
                    .setDescription(`Usage: \`${process.env.PREFIX || 'jd!'}setupdateschannel toggle <enabled|disabled>\``)
                    .setTimestamp();
                
                await message.reply({ embeds: [helpEmbed] });
                return;
            }

            const enabled = ['enabled', 'true', 'on'].includes(enabledArg);

            // Check if config exists
            const config = await database.getUpdatesChannel(guildId);
            if (!config) {
                const noConfigEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('❌ No Configuration Found')
                    .setDescription(
                        `You must first set up a notification channel using \`${process.env.PREFIX || 'jd!'}setupdateschannel set #channel\` before toggling notifications.`
                    )
                    .setTimestamp();

                await message.reply({ embeds: [noConfigEmbed] });
                return;
            }

            // Toggle the setting
            await database.toggleUpdatesChannel(guildId, enabled);

            const channel = message.guild.channels.cache.get(config.updates_channel_id);
            const statusEmbed = new EmbedBuilder()
                .setColor(enabled ? '#2ECC71' : '#E74C3C')
                .setTitle(`${enabled ? '✅' : '🔴'} Wishlist Notifications ${enabled ? 'Enabled' : 'Disabled'}`)
                .setDescription(
                    enabled 
                        ? `Wishlist notifications are now **enabled** and will be sent to ${channel || 'the configured channel'}.`
                        : 'Wishlist notifications are now **disabled**. Users will not receive notifications when their wishlist items appear in the shop.'
                )
                .setTimestamp();

            await message.reply({ embeds: [statusEmbed] });

            // Log command usage
            await database.logCommandUsage(
                message.author.id,
                message.author.username,
                'setupdateschannel',
                { subcommand: 'toggle', enabled },
                message.guildId,
                message.guild?.name,
                Date.now() - startTime,
                true
            );

        } catch (error) {
            logger.error('Error toggling updates channel:', error);
            throw error;
        }
    },

    async handleRemoveConfig(message, guildId, startTime) {
        try {
            // Check if config exists
            const config = await database.getUpdatesChannel(guildId);
            if (!config) {
                const noConfigEmbed = new EmbedBuilder()
                    .setColor('#6C7B7F')
                    .setTitle('📋 No Configuration Found')
                    .setDescription('There is no wishlist notification configuration to remove.')
                    .setTimestamp();

                await message.reply({ embeds: [noConfigEmbed] });
                return;
            }

            // Remove the configuration
            await database.removeUpdatesChannel(guildId);

            const removedEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('✅ Configuration Removed')
                .setDescription(
                    'Wishlist notification configuration has been removed.\n\n' +
                    'Users in this server will no longer receive wishlist notifications through this server. ' +
                    'They may still receive notifications via direct message or other servers.'
                )
                .setTimestamp();

            await message.reply({ embeds: [removedEmbed] });

            // Log command usage
            await database.logCommandUsage(
                message.author.id,
                message.author.username,
                'setupdateschannel',
                { subcommand: 'remove' },
                message.guildId,
                message.guild?.name,
                Date.now() - startTime,
                true
            );

        } catch (error) {
            logger.error('Error removing updates channel config:', error);
            throw error;
        }
    }
};
