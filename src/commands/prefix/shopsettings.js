const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const database = require('../../utils/database');
const logger = require('../../utils/logger');

module.exports = {
    name: 'shopsettings',
    description: 'View or manage shop channel settings (Admin only)',
    usage: 'shopsettings [view|toggle|remove] [parameters]',
    aliases: ['shopconfig', 'shopcfg'],
    
    async execute(message, args) {
        try {
            // Check permissions
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                const noPermEmbed = new EmbedBuilder()
                    .setTitle('❌ Permission Denied')
                    .setDescription('You need Administrator permissions to use this command.')
                    .setColor(0xFF0000)
                    .setTimestamp();
                
                await message.reply({ embeds: [noPermEmbed] });
                return;
            }

            const subcommand = args[0]?.toLowerCase() || 'view';
            const guildConfig = await database.getGuildConfig(message.guildId);

            switch (subcommand) {
                case 'view':
                case 'show':
                case 'status':
                    await handleViewSettings(message, guildConfig);
                    break;
                case 'toggle':
                case 'switch':
                    await handleToggleUpdates(message, args, guildConfig);
                    break;
                case 'remove':
                case 'delete':
                case 'clear':
                    await handleRemoveConfig(message, guildConfig);
                    break;
                default:
                    await showHelp(message);
                    break;
            }

        } catch (error) {
            logger.error('Error in shopsettings prefix command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Settings Error')
                .setDescription('An error occurred while managing shop settings. Please try again later.')
                .setColor(0xFF0000)
                .setTimestamp();
            
            await message.reply({ embeds: [errorEmbed] });
            throw error;
        }
    }
};

async function showHelp(message) {
    const helpEmbed = new EmbedBuilder()
        .setTitle('⚙️ Shop Settings Command')
        .setDescription('View or manage shop channel settings')
        .addFields([
            { name: 'View Settings', value: `\`${process.env.PREFIX || 'jd!'}shopsettings view\``, inline: false },
            { name: 'Toggle Daily Updates', value: `\`${process.env.PREFIX || 'jd!'}shopsettings toggle [true/false]\``, inline: false },
            { name: 'Remove Configuration', value: `\`${process.env.PREFIX || 'jd!'}shopsettings remove\``, inline: false },
            { name: 'Examples', value: `\`${process.env.PREFIX || 'jd!'}shopsettings\` - View current settings\n\`${process.env.PREFIX || 'jd!'}shopsettings toggle false\` - Disable daily updates\n\`${process.env.PREFIX || 'jd!'}shopsettings remove\` - Remove all configuration`, inline: false }
        ])
        .setColor(0x00AE86)
        .setTimestamp();
    
    await message.reply({ embeds: [helpEmbed] });
}

async function handleViewSettings(message, guildConfig) {
    if (!guildConfig) {
        const noConfigEmbed = new EmbedBuilder()
            .setTitle('📋 Shop Settings')
            .setDescription('No shop channel has been configured for this server yet.')
            .addFields([
                { name: '⚙️ Setup Instructions', value: `Use \`${process.env.PREFIX || 'jd!'}setshopchannel\` to configure a channel for daily shop updates.`, inline: false }
            ])
            .setColor(0xFFB347)
            .setTimestamp();
        
        await message.reply({ embeds: [noConfigEmbed] });
        return;
    }

    // Try to get the channel
    let channelMention = `<#${guildConfig.shop_channel_id}>`;
    let channelStatus = '✅ Active';
    
    try {
        const channel = await message.guild.channels.fetch(guildConfig.shop_channel_id);
        if (!channel) {
            channelMention = `~~${guildConfig.shop_channel_id}~~ (Deleted)`;
            channelStatus = '❌ Channel Deleted';
        }
    } catch (error) {
        channelMention = `~~${guildConfig.shop_channel_id}~~ (Not Found)`;
        channelStatus = '❌ Channel Not Found';
    }

    const settingsEmbed = new EmbedBuilder()
        .setTitle('📋 Shop Settings')
        .setDescription(`Current shop configuration for **${message.guild.name}**`)
        .addFields([
            { name: '📺 Shop Channel', value: channelMention, inline: true },
            { name: '📊 Channel Status', value: channelStatus, inline: true },
            { name: '🔄 Daily Updates', value: guildConfig.daily_updates_enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: '👤 Configured By', value: `<@${guildConfig.configured_by}>`, inline: true },
            { name: '📅 Configured Date', value: new Date(guildConfig.configured_at).toLocaleDateString(), inline: true },
            { name: '🕐 Last Updated', value: new Date(guildConfig.last_updated).toLocaleDateString(), inline: true }
        ])
        .setColor(guildConfig.daily_updates_enabled ? 0x00FF00 : 0xFFB347)
        .setTimestamp()
        .setFooter({ text: 'Daily updates occur at 1:30 AM UTC ' });

    await message.reply({ embeds: [settingsEmbed] });
}

async function handleToggleUpdates(message, args, guildConfig) {
    if (!guildConfig) {
        const noConfigEmbed = new EmbedBuilder()
            .setTitle('❌ No Configuration Found')
            .setDescription(`No shop channel has been configured for this server. Use \`${process.env.PREFIX || 'jd!'}setshopchannel\` first.`)
            .setColor(0xFF0000)
            .setTimestamp();
        
        await message.reply({ embeds: [noConfigEmbed] });
        return;
    }

    let enabled = !guildConfig.daily_updates_enabled; // Toggle by default
    
    if (args[1]) {
        const enableArg = args[1].toLowerCase();
        if (enableArg === 'true' || enableArg === 'yes' || enableArg === '1' || enableArg === 'on') {
            enabled = true;
        } else if (enableArg === 'false' || enableArg === 'no' || enableArg === '0' || enableArg === 'off') {
            enabled = false;
        }
    }
    
    await database.toggleGuildDailyUpdates(message.guildId, enabled);
    
    const toggleEmbed = new EmbedBuilder()
        .setTitle(`✅ Daily Updates ${enabled ? 'Enabled' : 'Disabled'}`)
        .setDescription(`Daily shop updates have been **${enabled ? 'enabled' : 'disabled'}** for this server.`)
        .addFields([
            { name: '📺 Channel', value: `<#${guildConfig.shop_channel_id}>`, inline: true },
            { name: '🔄 Status', value: enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: '👤 Changed By', value: `${message.author}`, inline: true }
        ])
        .setColor(enabled ? 0x00FF00 : 0xFF6B6B)
        .setTimestamp();

    if (enabled) {
        toggleEmbed.setFooter({ text: 'Next update: 1:30 AM UTC ' });
    }

    await message.reply({ embeds: [toggleEmbed] });
    
    logger.info(`Daily updates ${enabled ? 'enabled' : 'disabled'} for guild ${message.guild.name} (${message.guildId}) by ${message.author.username}`);
}

async function handleRemoveConfig(message, guildConfig) {
    if (!guildConfig) {
        const noConfigEmbed = new EmbedBuilder()
            .setTitle('❌ No Configuration Found')
            .setDescription('No shop channel configuration exists for this server.')
            .setColor(0xFF0000)
            .setTimestamp();
        
        await message.reply({ embeds: [noConfigEmbed] });
        return;
    }

    await database.removeGuildConfig(message.guildId);
    
    const removeEmbed = new EmbedBuilder()
        .setTitle('🗑️ Configuration Removed')
        .setDescription('Shop channel configuration has been removed from this server.')
        .addFields([
            { name: '📺 Previous Channel', value: `<#${guildConfig.shop_channel_id}>`, inline: true },
            { name: '👤 Removed By', value: `${message.author}`, inline: true },
            { name: '📝 Note', value: `Daily updates are now disabled. Use \`${process.env.PREFIX || 'jd!'}setshopchannel\` to reconfigure.`, inline: false }
        ])
        .setColor(0xFF6B6B)
        .setTimestamp();

    await message.reply({ embeds: [removeEmbed] });
    
    logger.info(`Shop configuration removed for guild ${message.guild.name} (${message.guildId}) by ${message.author.username}`);
}