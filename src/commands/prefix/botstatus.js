const { EmbedBuilder } = require('discord.js');
const database = require('../../utils/database');
const logger = require('../../utils/logger');

module.exports = {
    name: 'botstatus',
    description: 'View bot status across all guilds (Bot owner only)',
    usage: 'botstatus',
    aliases: ['status', 'botinfo'],
    
    async execute(message, args) {
        try {
            // This command should only be available to the bot owner
            const BOT_OWNER_ID = process.env.BOT_OWNER_ID || '772820081562091551'; // jdcomesta4's user ID
            
            if (message.author.id !== BOT_OWNER_ID) {
                const noPermEmbed = new EmbedBuilder()
                    .setTitle('❌ Access Denied')
                    .setDescription('This command is only available to the bot owner.')
                    .setColor(0xFF0000)
                    .setTimestamp();
                
                await message.reply({ embeds: [noPermEmbed] });
                return;
            }

            const loadingMessage = await message.reply('🔄 Gathering bot status information...');

            // Get bot statistics
            const client = message.client;
            const guildCount = client.guilds.cache.size;
            const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
            
            // Get guild configurations
            const allConfigs = await database.getAllGuildConfigs();
            const configuredGuilds = allConfigs.length;
            const activeGuilds = allConfigs.filter(config => config.daily_updates_enabled).length;

            // Get recent activity
            const recentCommandsResult = await database.query(
                'SELECT COUNT(*) as count FROM command_usage WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'
            );
            const recentCommands = recentCommandsResult?.[0]?.count || 0;

            // Create status embed
            const statusEmbed = new EmbedBuilder()
                .setTitle('🤖 Bot Status Report')
                .setDescription('Current status across all guilds')
                .addFields([
                    { name: '🏠 Total Guilds', value: guildCount.toString(), inline: true },
                    { name: '👥 Total Users', value: userCount.toLocaleString(), inline: true },
                    { name: '⚙️ Configured Guilds', value: `${configuredGuilds}/${guildCount}`, inline: true },
                    { name: '🔄 Active Daily Updates', value: activeGuilds.toString(), inline: true },
                    { name: '📊 Commands (24h)', value: recentCommands.toString(), inline: true },
                    { name: '🟢 Bot Status', value: 'Online', inline: true }
                ])
                .setColor(0x00FF00)
                .setTimestamp()
                .setFooter({ text: `Bot ID: ${client.user.id}` });

            // Add guild details if requested
            if (allConfigs.length > 0) {
                const guildDetails = allConfigs
                    .sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated))
                    .slice(0, 10) // Show top 10 most recently updated
                    .map(config => {
                        let status = config.daily_updates_enabled ? '✅' : '❌';
                        let guildName = config.guild_name || 'Unknown Guild';
                        if (guildName.length > 25) guildName = guildName.substring(0, 22) + '...';
                        return `${status} ${guildName}`;
                    })
                    .join('\n');

                statusEmbed.addFields([
                    { name: '📋 Recent Guild Configurations', value: guildDetails || 'None', inline: false }
                ]);
            }

            await loadingMessage.edit({ content: '', embeds: [statusEmbed] });

            logger.command(`Bot status viewed by ${message.author.username}`);

        } catch (error) {
            logger.error('Error in botstatus prefix command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Status Error')
                .setDescription('An error occurred while fetching bot status.')
                .setColor(0xFF0000)
                .setTimestamp();
            
            await message.reply({ embeds: [errorEmbed] });
            throw error;
        }
    }
};
