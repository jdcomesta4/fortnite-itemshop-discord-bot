const permissionManager = require('../../utils/permissionManager');
const database = require('../../utils/database');
const wishlistManager = require('../../utils/wishlistManager');
const logger = require('../../utils/logger');

module.exports = {
    name: 'mywishlist',
    aliases: ['wishlist', 'wl', 'mywish'],
    description: 'View and manage your personal wishlist',
    usage: 'mywishlist',
    examples: [
        'mywishlist',
        'wishlist',
        'wl'
    ],
    
    async execute(message, args) {
        const startTime = Date.now();
        
        try {
            // Check permissions
            const hasPermission = await permissionManager.canUseShopCommands(message.member, message.guildId);
            if (!hasPermission) {
                const guildConfig = await database.getGuildConfig(message.guildId);
                const deniedEmbed = permissionManager.getPermissionDeniedEmbed(guildConfig?.trusted_role_id);
                await message.reply({ embeds: [deniedEmbed] });
                return;
            }

            const userId = message.author.id;

            logger.command(`Viewing wishlist for user: ${message.author.username}`);

            // Get user's wishlist and stats
            const wishlistItems = await database.getUserWishlist(userId);
            const stats = await database.getWishlistStats(userId);

            console.log(`📊 Debug - Wishlist items: ${wishlistItems.length}, Stats:`, stats);
            
            // Create wishlist embed using the manager
            const { embeds, components } = await wishlistManager.createWishlistEmbed(
                wishlistItems, 
                0, // Start at page 0
                stats, 
                userId
            );

            console.log(`📨 Sending reply with ${embeds.length} embeds`);
            const reply = await message.reply({ embeds, components });
            console.log(`✅ Reply sent successfully`);

            // Create or update pagination session if there are items (simplified)
            if (wishlistItems.length > 0) {
                try {
                    const session = await wishlistManager.getOrCreateSession(userId);
                    session.wishlistItems = wishlistItems;
                    session.stats = stats;
                    session.currentPage = 0;
                    session.messageId = reply.id;
                } catch (sessionError) {
                    console.log(`⚠️ Session error (non-critical):`, sessionError.message);
                }
            }

            // Log command usage
            await database.logCommandUsage(
                message.author.id,
                message.author.username,
                'mywishlist',
                { itemCount: wishlistItems.length },
                message.guildId,
                message.guild?.name,
                Date.now() - startTime,
                true
            );

            // Log user interaction
            await database.logUserInteraction(
                userId,
                message.author.username,
                'command',
                { 
                    action: 'view_wishlist',
                    itemCount: wishlistItems.length,
                    totalVBucks: stats.total_vbucks
                },
                message.guildId
            );

        } catch (error) {
            logger.error('Error in mywishlist prefix command:', error);
            
            const errorEmbed = {
                color: 0xE74C3C,
                title: '❌ Error',
                description: 'An error occurred while retrieving your wishlist. Please try again later.',
                timestamp: new Date().toISOString()
            };

            await message.reply({ embeds: [errorEmbed] });

            // Log command usage with error
            await database.logCommandUsage(
                message.author.id,
                message.author.username,
                'mywishlist',
                {},
                message.guildId,
                message.guild?.name,
                Date.now() - startTime,
                false,
                error.message
            );
        }
    }
};