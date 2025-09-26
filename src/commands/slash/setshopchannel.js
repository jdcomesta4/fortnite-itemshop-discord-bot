const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const database = require('../../utils/database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setshopchannel')
        .setDescription('Set the channel for daily Fortnite item shop updates (Admin only)')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel where daily shop updates will be posted')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('enable_daily')
                .setDescription('Enable or disable daily automatic updates')
                .setRequired(false))
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

            const channel = interaction.options.getChannel('channel');
            const enableDaily = interaction.options.getBoolean('enable_daily') ?? true;

            // Verify the channel is a text channel
            if (!channel.isTextBased()) {
                const invalidChannelEmbed = new EmbedBuilder()
                    .setTitle('❌ Invalid Channel')
                    .setDescription('Please select a text channel for shop updates.')
                    .setColor(0xFF0000)
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [invalidChannelEmbed] });
                return;
            }

            // Check if bot has permission to send messages in the channel
            const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
            const permissions = channel.permissionsFor(botMember);
            
            if (!permissions.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
                const noPermsEmbed = new EmbedBuilder()
                    .setTitle('❌ Missing Permissions')
                    .setDescription(`I don't have permission to send messages or embed links in ${channel}. Please ensure I have the following permissions in that channel:\n\n• Send Messages\n• Embed Links\n• Use External Emojis (recommended)`)
                    .setColor(0xFF0000)
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [noPermsEmbed] });
                return;
            }

            // Save configuration to database
            await database.setGuildShopChannel(
                interaction.guildId,
                interaction.guild.name,
                channel.id,
                interaction.user.id
            );

            // Set daily updates preference
            if (!enableDaily) {
                await database.toggleGuildDailyUpdates(interaction.guildId, false);
            }

            // Send confirmation
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Shop Channel Configured')
                .setDescription(`Successfully configured the shop channel settings for **${interaction.guild.name}**`)
                .addFields([
                    { name: '📺 Channel', value: `${channel}`, inline: true },
                    { name: '🔄 Daily Updates', value: enableDaily ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: '👤 Configured By', value: `${interaction.user}`, inline: true }
                ])
                .setColor(0x00FF00)
                .setTimestamp()
                .setFooter({ text: `Guild ID: ${interaction.guildId}` });

            await interaction.editReply({ embeds: [successEmbed] });

            // Send a test message to the configured channel
            try {
                const testEmbed = new EmbedBuilder()
                    .setTitle('🛍️ Shop Channel Configured!')
                    .setDescription('This channel has been set up to receive daily Fortnite item shop updates.')
                    .addFields([
                        { name: '📅 Daily Updates', value: enableDaily ? 'Enabled at 1:30 AM UTC ' : 'Disabled', inline: false },
                        { name: '⚙️ Configuration', value: `Configured by ${interaction.user} at ${new Date().toLocaleString()}`, inline: false }
                    ])
                    .setColor(0x00AE86)
                    .setTimestamp();

                await channel.send({ embeds: [testEmbed] });
                
                logger.info(`Shop channel configured for guild ${interaction.guild.name} (${interaction.guildId}) by ${interaction.user.username}`);
                
            } catch (error) {
                logger.warn('Could not send test message to configured channel:', error);
                
                const warningEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Configuration Saved with Warning')
                    .setDescription('The channel was configured successfully, but I couldn\'t send a test message. Please check the channel permissions.')
                    .setColor(0xFFB347)
                    .setTimestamp();
                
                await interaction.followUp({ embeds: [warningEmbed], ephemeral: true });
            }

        } catch (error) {
            logger.error('Error in setshopchannel command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Configuration Error')
                .setDescription('An error occurred while configuring the shop channel. Please try again later.')
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