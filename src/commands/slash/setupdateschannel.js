const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const database = require('../../utils/database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupdateschannel')
        .setDescription('Configure wishlist update notifications')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set the channel for wishlist notifications')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to send wishlist notifications')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View current wishlist notification configuration'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Enable or disable wishlist notifications')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Whether wishlist notifications should be enabled')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove wishlist notification configuration')),
    
    async execute(interaction) {
        const startTime = Date.now();
        
        try {
            // Check if user has administrator permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                const noPermEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('❌ Insufficient Permissions')
                    .setDescription('You need Administrator permissions to use this command.')
                    .setTimestamp();

                await interaction.reply({ embeds: [noPermEmbed], ephemeral: true });
                return;
            }

            const subcommand = interaction.options.getSubcommand();
            const guildId = interaction.guildId;

            logger.command(`Setup updates channel ${subcommand} by ${interaction.user.username} in guild ${guildId}`);

            switch (subcommand) {
                case 'set':
                    await this.handleSetChannel(interaction, guildId, startTime);
                    break;
                case 'view':
                    await this.handleViewConfig(interaction, guildId, startTime);
                    break;
                case 'toggle':
                    await this.handleToggle(interaction, guildId, startTime);
                    break;
                case 'remove':
                    await this.handleRemoveConfig(interaction, guildId, startTime);
                    break;
                default:
                    throw new Error(`Unknown subcommand: ${subcommand}`);
            }

        } catch (error) {
            logger.error('Error in setupdateschannel command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Error')
                .setDescription('An error occurred while configuring wishlist notifications.')
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
                'setupdateschannel',
                { subcommand: interaction.options.getSubcommand() },
                interaction.guildId,
                interaction.guild?.name,
                Date.now() - startTime,
                false,
                error.message
            );
        }
    },

    async handleSetChannel(interaction, guildId, startTime) {
        try {
            const channel = interaction.options.getChannel('channel');

            // Verify bot permissions in the selected channel
            const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
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

                await interaction.reply({ embeds: [permissionEmbed], ephemeral: true });
                return;
            }

            await interaction.deferReply();

            // Set the updates channel in database
            await database.setUpdatesChannel(guildId, channel.id, interaction.user.id);

            const successEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('✅ Wishlist Notifications Configured')
                .setDescription(`Wishlist notifications will be sent to ${channel}`)
                .addFields(
                    { name: 'Channel', value: `${channel}`, inline: true },
                    { name: 'Configured by', value: `${interaction.user}`, inline: true },
                    { name: 'Status', value: 'Enabled', inline: true }
                )
                .setFooter({ 
                    text: 'Users will receive notifications when their wishlist items appear in the daily shop' 
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            // Log command usage
            await database.logCommandUsage(
                interaction.user.id,
                interaction.user.username,
                'setupdateschannel',
                { subcommand: 'set', channelId: channel.id },
                interaction.guildId,
                interaction.guild?.name,
                Date.now() - startTime,
                true
            );

        } catch (error) {
            logger.error('Error setting updates channel:', error);
            throw error;
        }
    },

    async handleViewConfig(interaction, guildId, startTime) {
        try {
            await interaction.deferReply();

            const config = await database.getUpdatesChannel(guildId);

            if (!config) {
                const noConfigEmbed = new EmbedBuilder()
                    .setColor('#6C7B7F')
                    .setTitle('📋 No Configuration Found')
                    .setDescription(
                        'Wishlist notifications are not configured for this server.\n\n' +
                        'Use `/setupdateschannel set` to configure a notification channel.'
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [noConfigEmbed] });
                return;
            }

            const channel = interaction.guild.channels.cache.get(config.updates_channel_id);
            const configuredBy = await interaction.client.users.fetch(config.configured_by).catch(() => null);

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
                    text: 'Use /setupdateschannel toggle to enable/disable notifications' 
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
                const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
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

            await interaction.editReply({ embeds: [viewEmbed] });

            // Log command usage
            await database.logCommandUsage(
                interaction.user.id,
                interaction.user.username,
                'setupdateschannel',
                { subcommand: 'view' },
                interaction.guildId,
                interaction.guild?.name,
                Date.now() - startTime,
                true
            );

        } catch (error) {
            logger.error('Error viewing updates channel config:', error);
            throw error;
        }
    },

    async handleToggle(interaction, guildId, startTime) {
        try {
            const enabled = interaction.options.getBoolean('enabled');

            await interaction.deferReply();

            // Check if config exists
            const config = await database.getUpdatesChannel(guildId);
            if (!config) {
                const noConfigEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('❌ No Configuration Found')
                    .setDescription(
                        'You must first set up a notification channel using `/setupdateschannel set` before toggling notifications.'
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [noConfigEmbed] });
                return;
            }

            // Toggle the setting
            await database.toggleUpdatesChannel(guildId, enabled);

            const channel = interaction.guild.channels.cache.get(config.updates_channel_id);
            const statusEmbed = new EmbedBuilder()
                .setColor(enabled ? '#2ECC71' : '#E74C3C')
                .setTitle(`${enabled ? '✅' : '🔴'} Wishlist Notifications ${enabled ? 'Enabled' : 'Disabled'}`)
                .setDescription(
                    enabled 
                        ? `Wishlist notifications are now **enabled** and will be sent to ${channel || 'the configured channel'}.`
                        : 'Wishlist notifications are now **disabled**. Users will not receive notifications when their wishlist items appear in the shop.'
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [statusEmbed] });

            // Log command usage
            await database.logCommandUsage(
                interaction.user.id,
                interaction.user.username,
                'setupdateschannel',
                { subcommand: 'toggle', enabled },
                interaction.guildId,
                interaction.guild?.name,
                Date.now() - startTime,
                true
            );

        } catch (error) {
            logger.error('Error toggling updates channel:', error);
            throw error;
        }
    },

    async handleRemoveConfig(interaction, guildId, startTime) {
        try {
            await interaction.deferReply();

            // Check if config exists
            const config = await database.getUpdatesChannel(guildId);
            if (!config) {
                const noConfigEmbed = new EmbedBuilder()
                    .setColor('#6C7B7F')
                    .setTitle('📋 No Configuration Found')
                    .setDescription('There is no wishlist notification configuration to remove.')
                    .setTimestamp();

                await interaction.editReply({ embeds: [noConfigEmbed] });
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

            await interaction.editReply({ embeds: [removedEmbed] });

            // Log command usage
            await database.logCommandUsage(
                interaction.user.id,
                interaction.user.username,
                'setupdateschannel',
                { subcommand: 'remove' },
                interaction.guildId,
                interaction.guild?.name,
                Date.now() - startTime,
                true
            );

        } catch (error) {
            logger.error('Error removing updates channel config:', error);
            throw error;
        }
    }
};