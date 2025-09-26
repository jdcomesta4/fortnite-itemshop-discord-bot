const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const database = require('../../utils/database');
const logger = require('../../utils/logger');

module.exports = {
    name: 'setshopchannel',
    description: 'Set the channel for daily Fortnite item shop updates (Admin only)',
    usage: 'setshopchannel <#channel> [enable_daily: true/false]',
    aliases: ['setshop', 'shopchannel'],
    
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

            if (args.length === 0) {
                const helpEmbed = new EmbedBuilder()
                    .setTitle('⚙️ Set Shop Channel Command')
                    .setDescription('Set the channel for daily Fortnite item shop updates')
                    .addFields([
                        { name: 'Usage', value: `\`${process.env.PREFIX || 'jd!'}setshopchannel <#channel> [enable_daily]\``, inline: false },
                        { name: 'Examples', value: `\`${process.env.PREFIX || 'jd!'}setshopchannel #shop-updates\`\n\`${process.env.PREFIX || 'jd!'}setshopchannel #fortnite true\`\n\`${process.env.PREFIX || 'jd!'}setshopchannel #updates false\``, inline: false },
                        { name: 'Parameters', value: '• `#channel` - The channel to post updates\n• `enable_daily` - Enable daily updates (true/false, default: true)', inline: false }
                    ])
                    .setColor(0x00AE86)
                    .setTimestamp();
                
                await message.reply({ embeds: [helpEmbed] });
                return;
            }

            const loadingMessage = await message.reply('⚙️ Configuring shop channel...');

            // Parse channel mention
            const channelMention = args[0];
            const channelId = channelMention.replace(/[<#>]/g, '');
            const channel = message.guild.channels.cache.get(channelId);

            if (!channel) {
                const invalidChannelEmbed = new EmbedBuilder()
                    .setTitle('❌ Invalid Channel')
                    .setDescription('Please mention a valid channel. Example: `#shop-updates`')
                    .setColor(0xFF0000)
                    .setTimestamp();
                
                await loadingMessage.edit({ content: '', embeds: [invalidChannelEmbed] });
                return;
            }

            // Verify the channel is a text channel
            if (!channel.isTextBased()) {
                const invalidChannelEmbed = new EmbedBuilder()
                    .setTitle('❌ Invalid Channel')
                    .setDescription('Please select a text channel for shop updates.')
                    .setColor(0xFF0000)
                    .setTimestamp();
                
                await loadingMessage.edit({ content: '', embeds: [invalidChannelEmbed] });
                return;
            }

            // Parse enable_daily parameter
            let enableDaily = true;
            if (args[1]) {
                const dailyArg = args[1].toLowerCase();
                if (dailyArg === 'false' || dailyArg === 'no' || dailyArg === '0') {
                    enableDaily = false;
                }
            }

            // Check if bot has permission to send messages in the channel
            const botMember = await message.guild.members.fetch(message.client.user.id);
            const permissions = channel.permissionsFor(botMember);
            
            if (!permissions.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
                const noPermsEmbed = new EmbedBuilder()
                    .setTitle('❌ Missing Permissions')
                    .setDescription(`I don't have permission to send messages or embed links in ${channel}. Please ensure I have the following permissions in that channel:\n\n• Send Messages\n• Embed Links\n• Use External Emojis (recommended)`)
                    .setColor(0xFF0000)
                    .setTimestamp();
                
                await loadingMessage.edit({ content: '', embeds: [noPermsEmbed] });
                return;
            }

            // Save configuration to database
            await database.setGuildShopChannel(
                message.guildId,
                message.guild.name,
                channel.id,
                message.author.id
            );

            // Set daily updates preference
            if (!enableDaily) {
                await database.toggleGuildDailyUpdates(message.guildId, false);
            }

            // Send confirmation
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Shop Channel Configured')
                .setDescription(`Successfully configured the shop channel settings for **${message.guild.name}**`)
                .addFields([
                    { name: '📺 Channel', value: `${channel}`, inline: true },
                    { name: '🔄 Daily Updates', value: enableDaily ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: '👤 Configured By', value: `${message.author}`, inline: true }
                ])
                .setColor(0x00FF00)
                .setTimestamp()
                .setFooter({ text: `Guild ID: ${message.guildId}` });

            await loadingMessage.edit({ content: '', embeds: [successEmbed] });

            // Send a test message to the configured channel
            try {
                const testEmbed = new EmbedBuilder()
                    .setTitle('🛍️ Shop Channel Configured!')
                    .setDescription('This channel has been set up to receive daily Fortnite item shop updates.')
                    .addFields([
                        { name: '📅 Daily Updates', value: enableDaily ? 'Enabled at 1:30 AM UTC ' : 'Disabled', inline: false },
                        { name: '⚙️ Configuration', value: `Configured by ${message.author} at ${new Date().toLocaleString()}`, inline: false }
                    ])
                    .setColor(0x00AE86)
                    .setTimestamp();

                await channel.send({ embeds: [testEmbed] });
                
                logger.info(`Shop channel configured for guild ${message.guild.name} (${message.guildId}) by ${message.author.username}`);
                
            } catch (error) {
                logger.warn('Could not send test message to configured channel:', error);
                
                const warningEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Configuration Saved with Warning')
                    .setDescription('The channel was configured successfully, but I couldn\'t send a test message. Please check the channel permissions.')
                    .setColor(0xFFB347)
                    .setTimestamp();
                
                await message.reply({ embeds: [warningEmbed] });
            }

        } catch (error) {
            logger.error('Error in setshopchannel prefix command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Configuration Error')
                .setDescription('An error occurred while configuring the shop channel. Please try again later.')
                .setColor(0xFF0000)
                .setTimestamp();
            
            await message.reply({ embeds: [errorEmbed] });
            throw error;
        }
    }
};