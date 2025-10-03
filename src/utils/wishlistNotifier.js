const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const database = require('./database');
const logger = require('./logger');

class WishlistNotifier {
    constructor() {
        this.isProcessing = false;
        this.lastNotificationCheck = null;
    }

    /**
     * Process daily shop and send notifications for wishlist items
     * @param {Object} shopData - Current shop data
     * @param {Object} client - Discord client
     */
    async processShopNotifications(shopData, client) {
        if (this.isProcessing) {
            logger.warn('Wishlist notification processing already in progress');
            return;
        }

        try {
            this.isProcessing = true;
            logger.info('Starting wishlist notification processing...');

            if (!shopData || !shopData.sections || shopData.sections.length === 0) {
                logger.warn('No shop data available for wishlist notifications');
                return;
            }

            // Extract all shop item names
            const shopItemNames = [];
            for (const section of shopData.sections) {
                if (section.itemDetails) {
                    for (const item of section.itemDetails) {
                        if (item.name) {
                            shopItemNames.push(item.name.toLowerCase());
                        }
                    }
                }
            }

            if (shopItemNames.length === 0) {
                logger.warn('No item names found in shop data');
                return;
            }

            logger.info(`Found ${shopItemNames.length} items in current shop`);

            // Get all wishlist items that match shop items
            const matchingItems = await this.findMatchingWishlistItems(shopItemNames);
            
            if (matchingItems.length === 0) {
                logger.info('No wishlist items match current shop items');
                return;
            }

            logger.info(`Found ${matchingItems.length} matching wishlist items`);

            // Group by user
            const userMatches = this.groupMatchesByUser(matchingItems, shopData);

            // Process notifications for each user
            let notificationsSent = 0;
            for (const [userId, userMatchData] of Object.entries(userMatches)) {
                try {
                    const sent = await this.sendUserNotification(userId, userMatchData, client);
                    if (sent) {
                        notificationsSent++;
                        
                        // Update last_notified for all items
                        const itemNames = userMatchData.items.map(item => item.item_name);
                        await database.updateLastNotified(userId, itemNames, new Date().toISOString().split('T')[0]);
                    }
                } catch (error) {
                    logger.error(`Failed to send notification to user ${userId}:`, error);
                    
                    // Log error for admin notification
                    await database.logError(
                        'wishlist_notification_failed',
                        `Failed to send wishlist notification to user ${userId}: ${error.message}`,
                        error.stack,
                        { userId, itemCount: userMatchData.items.length },
                        userId,
                        null,
                        'wishlist_notify',
                        'medium'
                    );
                }
            }

            logger.info(`Wishlist notification processing complete. Sent ${notificationsSent} notifications.`);
            this.lastNotificationCheck = new Date();

        } catch (error) {
            logger.error('Error in wishlist notification processing:', error);
            
            await database.logError(
                'wishlist_notification_system_error',
                `Wishlist notification system error: ${error.message}`,
                error.stack,
                { shopItemCount: shopData?.sections?.length || 0 },
                null,
                null,
                'wishlist_notify',
                'high'
            );
            
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Find wishlist items that match current shop items
     * @param {Array} shopItemNames - Array of shop item names
     * @returns {Array} - Array of matching wishlist items
     */
    async findMatchingWishlistItems(shopItemNames) {
        try {
            // Get all wishlist items
            const allWishlistItems = await database.getAllWishlistItems();
            
            if (allWishlistItems.length === 0) {
                return [];
            }

            // Find matches using partial string matching
            const matches = [];
            const today = new Date().toISOString().split('T')[0];

            for (const wishlistItem of allWishlistItems) {
                const wishlistName = wishlistItem.item_name.toLowerCase();
                
                // Check if any shop item matches this wishlist item
                for (const shopItemName of shopItemNames) {
                    if (this.itemsMatch(wishlistName, shopItemName)) {
                        // Get full item details including last_notified check
                        const fullItemDetails = await database.getItemsToNotify(wishlistItem.user_id);
                        const itemToNotify = fullItemDetails.find(item => 
                            item.item_name.toLowerCase() === wishlistName
                        );
                        
                        if (itemToNotify) {
                            matches.push({
                                ...itemToNotify,
                                matched_shop_item: shopItemName
                            });
                        }
                        break; // Found a match, no need to check other shop items
                    }
                }
            }

            return matches;

        } catch (error) {
            logger.error('Error finding matching wishlist items:', error);
            return [];
        }
    }

    /**
     * Check if two item names match (partial matching)
     * @param {string} wishlistName - Wishlist item name (lowercase)
     * @param {string} shopItemName - Shop item name (lowercase)
     * @returns {boolean} - Whether items match
     */
    itemsMatch(wishlistName, shopItemName) {
        // Exact match
        if (wishlistName === shopItemName) {
            return true;
        }

        // Check if wishlist item name is contained in shop item name
        if (shopItemName.includes(wishlistName)) {
            return true;
        }

        // Check if shop item name is contained in wishlist item name
        if (wishlistName.includes(shopItemName)) {
            return true;
        }

        // More sophisticated matching could be added here
        // (e.g., fuzzy matching, removing common words, etc.)
        
        return false;
    }

    /**
     * Group matching items by user
     * @param {Array} matchingItems - Array of matching wishlist items
     * @param {Object} shopData - Current shop data
     * @returns {Object} - Object with userId as keys
     */
    groupMatchesByUser(matchingItems, shopData) {
        const userGroups = {};

        for (const item of matchingItems) {
            const userId = item.user_id;
            
            if (!userGroups[userId]) {
                userGroups[userId] = {
                    items: [],
                    shopData: shopData
                };
            }

            // Find the full shop item details
            let fullShopItem = null;
            for (const section of shopData.sections) {
                if (section.itemDetails) {
                    fullShopItem = section.itemDetails.find(shopItem => 
                        this.itemsMatch(item.item_name.toLowerCase(), shopItem.name.toLowerCase())
                    );
                    if (fullShopItem) break;
                }
            }

            userGroups[userId].items.push({
                ...item,
                shop_item_details: fullShopItem
            });
        }

        return userGroups;
    }

    /**
     * Send notification to a specific user
     * @param {string} userId - User ID
     * @param {Object} userMatchData - User's matching items data
     * @param {Object} client - Discord client
     * @returns {boolean} - Whether notification was sent successfully
     */
    async sendUserNotification(userId, userMatchData, client) {
        try {
            // Check user notification preferences
            const userPrefs = await database.getNotificationPreference(userId);
            if (!userPrefs.wishlist_notifications_enabled) {
                logger.info(`Skipping notification for user ${userId} - notifications disabled`);
                return false;
            }

            const user = await client.users.fetch(userId).catch(() => null);
            if (!user) {
                logger.warn(`Could not fetch user ${userId} for wishlist notification`);
                return false;
            }

            // Determine where to send notification
            const notificationTarget = await this.determineNotificationTarget(userId, client);
            
            if (!notificationTarget) {
                logger.warn(`No valid notification target found for user ${userId}`);
                
                // Notify bot owner about failed notification
                await this.notifyBotOwnerOfFailure(userId, userMatchData.items, client);
                return false;
            }

            // Create notification embed
            const embed = await this.createNotificationEmbed(userMatchData, user);
            
            // Create optional button
            const components = [];
            const buttonRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('view_shop')
                        .setLabel('🛒 View Shop')
                        .setStyle(ButtonStyle.Primary)
                );
            components.push(buttonRow);

            // Send notification
            const notificationMessage = notificationTarget.type === 'channel' 
                ? `<@${userId}> Your wishlist items are now available!`
                : null;

            await notificationTarget.target.send({
                content: notificationMessage,
                embeds: [embed],
                components: components
            });

            // Log successful notification
            await database.logUserInteraction(
                userId,
                user.username,
                'notification',
                {
                    type: 'wishlist_notification',
                    target_type: notificationTarget.type,
                    item_count: userMatchData.items.length,
                    items: userMatchData.items.map(item => item.item_name)
                },
                notificationTarget.guildId || null
            );

            logger.info(`Sent wishlist notification to user ${userId} (${notificationTarget.type})`);
            return true;

        } catch (error) {
            logger.error(`Error sending notification to user ${userId}:`, error);
            return false;
        }
    }

    /**
     * Determine where to send the notification (channel or DM)
     * @param {string} userId - User ID
     * @param {Object} client - Discord client
     * @returns {Object|null} - Notification target info
     */
    async determineNotificationTarget(userId, client) {
        try {
            // Get all guilds the user is in
            const userGuilds = [];
            
            for (const [guildId, guild] of client.guilds.cache) {
                try {
                    const member = await guild.members.fetch(userId).catch(() => null);
                    if (member) {
                        userGuilds.push(guild);
                    }
                } catch (error) {
                    // User not in this guild, continue
                }
            }

            // Check each guild for wishlist notification channel
            for (const guild of userGuilds) {
                const config = await database.getUpdatesChannel(guild.id);
                
                if (config && config.notifications_enabled) {
                    const channel = guild.channels.cache.get(config.updates_channel_id);
                    
                    if (channel && channel.isTextBased()) {
                        // Check if bot has permissions
                        const botMember = guild.members.cache.get(client.user.id);
                        if (botMember && 
                            channel.permissionsFor(botMember).has(['SendMessages', 'EmbedLinks'])) {
                            
                            return {
                                type: 'channel',
                                target: channel,
                                guildId: guild.id
                            };
                        } else {
                            logger.warn(`Bot lacks permissions in channel ${channel.id} for guild ${guild.id}`);
                        }
                    } else {
                        logger.warn(`Invalid updates channel ${config.updates_channel_id} for guild ${guild.id}`);
                    }
                }
            }

            // No valid guild channel found, try DM
            const user = await client.users.fetch(userId).catch(() => null);
            if (user) {
                try {
                    // Test if we can send DM
                    const dmChannel = await user.createDM();
                    return {
                        type: 'dm',
                        target: dmChannel,
                        guildId: null
                    };
                } catch (error) {
                    logger.warn(`Cannot send DM to user ${userId}: ${error.message}`);
                }
            }

            return null;

        } catch (error) {
            logger.error(`Error determining notification target for user ${userId}:`, error);
            return null;
        }
    }

    /**
     * Create notification embed
     * @param {Object} userMatchData - User's matching items data
     * @param {Object} user - Discord user object
     * @returns {EmbedBuilder} - Notification embed
     */
    async createNotificationEmbed(userMatchData, user) {
        const embed = new EmbedBuilder()
            .setColor('#F1C40F')
            .setTitle('🎁 Wishlist Items in Shop!')
            .setDescription(`**${user.username}**, your wishlist items are now available in the shop!`)
            .setThumbnail(user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: 'Use /mywishlist to manage your wishlist' });

        // Add up to 10 items to avoid embed limits
        const itemsToShow = userMatchData.items.slice(0, 10);
        
        for (const item of itemsToShow) {
            const shopItem = item.shop_item_details;
            let fieldValue = `**Type:** ${item.item_type || 'Unknown'} | **Rarity:** ${item.item_rarity || 'Unknown'}\n`;
            
            if (item.item_price) {
                fieldValue += `**Price:** ${item.item_price.toLocaleString()} V-Bucks\n`;
            }
            
            fieldValue += `**Status:** Available Now!`;

            embed.addFields({
                name: item.item_name,
                value: fieldValue,
                inline: true
            });

            // Set thumbnail to first item's icon
            if (itemsToShow.indexOf(item) === 0 && item.item_icon_url) {
                embed.setThumbnail(item.item_icon_url);
            }
        }

        if (userMatchData.items.length > 10) {
            embed.setDescription(
                embed.data.description + 
                `\n\n*Showing ${itemsToShow.length} of ${userMatchData.items.length} items*`
            );
        }

        return embed;
    }

    /**
     * Notify bot owner of failed notifications
     * @param {string} userId - User ID that failed
     * @param {Array} items - Items that couldn't be notified
     * @param {Object} client - Discord client
     */
    async notifyBotOwnerOfFailure(userId, items, client) {
        try {
            const botOwnerId = process.env.BOT_OWNER_ID;
            if (!botOwnerId) return;

            const owner = await client.users.fetch(botOwnerId).catch(() => null);
            if (!owner) return;

            const embed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('⚠️ Wishlist Notification Failed')
                .setDescription(
                    `**User:** <@${userId}> (${userId})\n` +
                    `**Reason:** No accessible notification channels or DMs disabled\n` +
                    `**Items:** ${items.map(item => item.item_name).join(', ')}`
                )
                .setTimestamp();

            await owner.send({ embeds: [embed] });

        } catch (error) {
            logger.error('Failed to notify bot owner of notification failure:', error);
        }
    }

    /**
     * Test notification system (for development/debugging)
     * @param {Object} client - Discord client
     * @param {string} testUserId - User ID to test with
     */
    async testNotificationSystem(client, testUserId) {
        logger.info(`Testing wishlist notification system for user ${testUserId}`);
        
        try {
            // Create fake shop data for testing
            const testShopData = {
                sections: [{
                    itemDetails: [
                        { name: 'Test Item', type: 'outfit', rarity: 'epic' }
                    ]
                }]
            };

            // Get user's wishlist
            const userWishlist = await database.getUserWishlist(testUserId);
            
            if (userWishlist.length === 0) {
                logger.warn(`User ${testUserId} has no wishlist items for testing`);
                return;
            }

            // Create fake match data
            const userMatchData = {
                items: [userWishlist[0]], // Use first wishlist item
                shopData: testShopData
            };

            // Send test notification
            await this.sendUserNotification(testUserId, userMatchData, client);
            logger.info('Test notification sent successfully');

        } catch (error) {
            logger.error('Error in test notification system:', error);
        }
    }
}

module.exports = new WishlistNotifier();