const { SlashCommandBuilder } = require('discord.js');
const permissionManager = require('../../utils/permissionManager');
const database = require('../../utils/database');
const wishlistManager = require('../../utils/wishlistManager');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mywishlist')
        .setDescription('View and manage your personal wishlist'),
    
    async execute(interaction) {
        const startTime = Date.now();
        
        try {
            // Check permissions
            const hasPermission = await permissionManager.canUseShopCommands(interaction.member, interaction.guildId);
            if (!hasPermission) {
                const guildConfig = await database.getGuildConfig(interaction.guildId);
                const deniedEmbed = permissionManager.getPermissionDeniedEmbed(guildConfig?.trusted_role_id);
                await interaction.reply({ embeds: [deniedEmbed], ephemeral: true });
                return;
            }

            console.log(`🔍 Slash mywishlist - Starting for user: ${interaction.user.username}`);
            
            await interaction.deferReply({ ephemeral: true });
            console.log(`⏳ Interaction deferred successfully`);

            const userId = interaction.user.id;

            logger.command(`Viewing wishlist for user: ${interaction.user.username}`);

            // Get user's wishlist and stats
            const wishlistItems = await database.getUserWishlist(userId);
            const stats = await database.getWishlistStats(userId);
            
            console.log(`📊 Slash Debug - Items: ${wishlistItems.length}, Stats:`, stats);

            // Create wishlist embeds using the manager
            const { embeds, components } = await wishlistManager.createWishlistEmbed(
                wishlistItems, 
                0, // Start at page 0
                stats, 
                userId
            );

            // Ensure embeds is always an array
            const embedsArray = Array.isArray(embeds) ? embeds : [embeds];
            console.log(`📨 Slash - Sending reply with ${embedsArray.length} embeds`);
            
            await interaction.editReply({ embeds: embedsArray, components });
            console.log(`✅ Slash reply sent successfully`);

            // Create or update pagination session if there are items
            if (wishlistItems.length > 0) {
                const session = await wishlistManager.getOrCreateSession(userId);
                session.wishlistItems = wishlistItems;
                session.stats = stats;
                session.currentPage = 0;
            }

            // Log command usage
            await database.logCommandUsage(
                interaction.user.id,
                interaction.user.username,
                'mywishlist',
                { itemCount: wishlistItems.length },
                interaction.guildId,
                interaction.guild?.name,
                Date.now() - startTime,
                true
            );

            // Log user interaction
            await database.logUserInteraction(
                userId,
                interaction.user.username,
                'command',
                { 
                    action: 'view_wishlist',
                    itemCount: wishlistItems.length,
                    totalVBucks: stats.total_vbucks
                },
                interaction.guildId
            );

        } catch (error) {
            logger.error('Error in mywishlist command:', error);
            
            const errorEmbed = {
                color: 0xE74C3C,
                title: '❌ Error',
                description: 'An error occurred while retrieving your wishlist. Please try again later.',
                timestamp: new Date().toISOString()
            };

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Log command usage with error
            await database.logCommandUsage(
                interaction.user.id,
                interaction.user.username,
                'mywishlist',
                {},
                interaction.guildId,
                interaction.guild?.name,
                Date.now() - startTime,
                false,
                error.message
            );
        }
    }
};