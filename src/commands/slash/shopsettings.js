const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const database = require('../../utils/database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shopsettings')
        .setDescription('View or manage shop channel settings (Admin only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View current shop settings'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Toggle daily updates on/off')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable or disable daily updates')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('trustedrole')
                .setDescription('Set or remove the trusted role for shop commands')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to give access to shop commands (leave empty to remove)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove shop channel configuration'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        try {
            // Double-check permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                const noPermEmbed = new EmbedBuilder()
                    .setTitle('❌ Permission Denied')
                    .setDescription('You need Administrator permissions to use this command.')
                    .setColor(0xFF0000)
                    .setTimestamp();
                
                await interaction.reply({ embeds: [noPermEmbed], ephemeral: true });
                return;
            }

            await interaction.deferReply();

            const subcommand = interaction.options.getSubcommand();
            const guildConfig = await database.getGuildConfig(interaction.guildId);

            switch (subcommand) {
                case 'view':
                    await handleViewSettings(interaction, guildConfig);
                    break;
                case 'toggle':
                    await handleToggleUpdates(interaction, guildConfig);
                    break;
                case 'trustedrole':
                    await handleTrustedRole(interaction, guildConfig);
                    break;
                case 'remove':
                    await handleRemoveConfig(interaction, guildConfig);
                    break;
            }

        } catch (error) {
            logger.error('Error in shopsettings command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Settings Error')
                .setDescription('An error occurred while managing shop settings. Please try again later.')
                .setColor(0xFF0000)
                .setTimestamp();
            
            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
            
            throw error;
        }
    }
};

async function handleViewSettings(interaction, guildConfig) {
    if (!guildConfig) {
        const noConfigEmbed = new EmbedBuilder()
            .setTitle('📋 Shop Settings')
            .setDescription('No shop channel has been configured for this server yet.')
            .addFields([
                { name: '⚙️ Setup Instructions', value: 'Use `/setshopchannel` to configure a channel for daily shop updates.', inline: false }
            ])
            .setColor(0xFFB347)
            .setTimestamp();
        
        await interaction.editReply({ embeds: [noConfigEmbed] });
        return;
    }

    // Try to get the channel
    let channelMention = `<#${guildConfig.shop_channel_id}>`;
    let channelStatus = '✅ Active';
    
    try {
        const channel = await interaction.guild.channels.fetch(guildConfig.shop_channel_id);
        if (!channel) {
            channelMention = `~~${guildConfig.shop_channel_id}~~ (Deleted)`;
            channelStatus = '❌ Channel Deleted';
        }
    } catch (error) {
        channelMention = `~~${guildConfig.shop_channel_id}~~ (Not Found)`;
        channelStatus = '❌ Channel Not Found';
    }

    // Get trusted role info
    let trustedRoleMention = 'None';
    if (guildConfig.trusted_role_id) {
        try {
            const role = await interaction.guild.roles.fetch(guildConfig.trusted_role_id);
            if (role) {
                trustedRoleMention = `<@&${guildConfig.trusted_role_id}>`;
            } else {
                trustedRoleMention = `~~${guildConfig.trusted_role_id}~~ (Deleted)`;
            }
        } catch (error) {
            trustedRoleMention = `~~${guildConfig.trusted_role_id}~~ (Not Found)`;
        }
    }

    const settingsEmbed = new EmbedBuilder()
        .setTitle('📋 Shop Settings')
        .setDescription(`Current shop configuration for **${interaction.guild.name}**`)
        .addFields([
            { name: '📺 Shop Channel', value: channelMention, inline: true },
            { name: '📊 Channel Status', value: channelStatus, inline: true },
            { name: '🔄 Daily Updates', value: guildConfig.daily_updates_enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: '🛡️ Trusted Role', value: trustedRoleMention, inline: true },
            { name: '👤 Configured By', value: `<@${guildConfig.configured_by}>`, inline: true },
            { name: '📅 Configured Date', value: new Date(guildConfig.configured_at).toLocaleDateString(), inline: true },
            { name: '🕐 Last Updated', value: new Date(guildConfig.last_updated).toLocaleDateString(), inline: true }
        ])
        .setColor(guildConfig.daily_updates_enabled ? 0x00FF00 : 0xFFB347)
        .setTimestamp()
        .setFooter({ text: 'Daily updates occur at 1:30 AM UTC ' });

    await interaction.editReply({ embeds: [settingsEmbed] });
}

async function handleToggleUpdates(interaction, guildConfig) {
    if (!guildConfig) {
        const noConfigEmbed = new EmbedBuilder()
            .setTitle('❌ No Configuration Found')
            .setDescription('No shop channel has been configured for this server. Use `/setshopchannel` first.')
            .setColor(0xFF0000)
            .setTimestamp();
        
        await interaction.editReply({ embeds: [noConfigEmbed] });
        return;
    }

    const enabled = interaction.options.getBoolean('enabled');
    
    await database.toggleGuildDailyUpdates(interaction.guildId, enabled);
    
    const toggleEmbed = new EmbedBuilder()
        .setTitle(`✅ Daily Updates ${enabled ? 'Enabled' : 'Disabled'}`)
        .setDescription(`Daily shop updates have been **${enabled ? 'enabled' : 'disabled'}** for this server.`)
        .addFields([
            { name: '📺 Channel', value: `<#${guildConfig.shop_channel_id}>`, inline: true },
            { name: '🔄 Status', value: enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: '👤 Changed By', value: `${interaction.user}`, inline: true }
        ])
        .setColor(enabled ? 0x00FF00 : 0xFF6B6B)
        .setTimestamp();

    if (enabled) {
        toggleEmbed.setFooter({ text: 'Next update: 1:30 AM UTC ' });
    }

    await interaction.editReply({ embeds: [toggleEmbed] });
    
    logger.info(`Daily updates ${enabled ? 'enabled' : 'disabled'} for guild ${interaction.guild.name} (${interaction.guildId}) by ${interaction.user.username}`);
}

async function handleRemoveConfig(interaction, guildConfig) {
    if (!guildConfig) {
        const noConfigEmbed = new EmbedBuilder()
            .setTitle('❌ No Configuration Found')
            .setDescription('No shop channel configuration exists for this server.')
            .setColor(0xFF0000)
            .setTimestamp();
        
        await interaction.editReply({ embeds: [noConfigEmbed] });
        return;
    }

    await database.removeGuildConfig(interaction.guildId);
    
    const removeEmbed = new EmbedBuilder()
        .setTitle('🗑️ Configuration Removed')
        .setDescription('Shop channel configuration has been removed from this server.')
        .addFields([
            { name: '📺 Previous Channel', value: `<#${guildConfig.shop_channel_id}>`, inline: true },
            { name: '👤 Removed By', value: `${interaction.user}`, inline: true },
            { name: '📝 Note', value: 'Daily updates are now disabled. Use `/setshopchannel` to reconfigure.', inline: false }
        ])
        .setColor(0xFF6B6B)
        .setTimestamp();

    await interaction.editReply({ embeds: [removeEmbed] });
    
    logger.info(`Shop configuration removed for guild ${interaction.guild.name} (${interaction.guildId}) by ${interaction.user.username}`);
}

async function handleTrustedRole(interaction, guildConfig) {
    const role = interaction.options.getRole('role');
    
    if (!role) {
        // Remove trusted role
        if (guildConfig) {
            await database.setGuildTrustedRole(interaction.guildId, null);
            
            const removeRoleEmbed = new EmbedBuilder()
                .setTitle('🗑️ Trusted Role Removed')
                .setDescription('The trusted role has been removed from this server.')
                .addFields([
                    { name: '📝 Note', value: 'Only administrators can now use shop commands.', inline: false },
                    { name: '👤 Removed By', value: `${interaction.user}`, inline: true }
                ])
                .setColor(0xFF6B6B)
                .setTimestamp();
            
            await interaction.editReply({ embeds: [removeRoleEmbed] });
            logger.info(`Trusted role removed for guild ${interaction.guild.name} (${interaction.guildId}) by ${interaction.user.username}`);
        } else {
            const noConfigEmbed = new EmbedBuilder()
                .setTitle('❌ No Configuration Found')
                .setDescription('No shop configuration exists for this server. Use `/setshopchannel` first.')
                .setColor(0xFF0000)
                .setTimestamp();
            
            await interaction.editReply({ embeds: [noConfigEmbed] });
        }
        return;
    }
    
    if (!guildConfig) {
        const noConfigEmbed = new EmbedBuilder()
            .setTitle('❌ No Configuration Found')
            .setDescription('No shop channel has been configured for this server. Use `/setshopchannel` first.')
            .setColor(0xFF0000)
            .setTimestamp();
        
        await interaction.editReply({ embeds: [noConfigEmbed] });
        return;
    }
    
    // Set trusted role
    await database.setGuildTrustedRole(interaction.guildId, role.id);
    
    const setRoleEmbed = new EmbedBuilder()
        .setTitle('✅ Trusted Role Set')
        .setDescription(`The trusted role has been set for this server.`)
        .addFields([
            { name: '🛡️ Trusted Role', value: `<@&${role.id}>`, inline: true },
            { name: '📝 Access', value: 'Members with this role can now use shop commands', inline: false },
            { name: '👤 Set By', value: `${interaction.user}`, inline: true }
        ])
        .setColor(0x00FF00)
        .setTimestamp();
    
    await interaction.editReply({ embeds: [setRoleEmbed] });
    logger.info(`Trusted role set to ${role.name} (${role.id}) for guild ${interaction.guild.name} (${interaction.guildId}) by ${interaction.user.username}`);
}