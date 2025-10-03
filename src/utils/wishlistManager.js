const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const database = require('./database');
const logger = require('./logger');
const apiClient = require('./apiClient');
const { createWishlistConfirmationEmbed, formatType, formatRarity, formatPrice } = require('./wishlistEmbeds');

class WishlistManager {
    constructor() {
        this.activeInteractions = new Map(); // Track active pagination sessions
        this.maxSessions = 50; // Maximum number of active sessions
        
        // Setup cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, 5 * 60 * 1000); // Every 5 minutes
    }

    /**
     * Create paginated wishlist embed
     * @param {Array} wishlistItems - Array of wishlist items
     * @param {number} page - Current page (0-indexed)
     * @param {Object} stats - Wishlist statistics
     * @param {string} userId - User ID
     * @returns {Object} - Embed and components
     */
    async createWishlistEmbed(wishlistItems, page = 0, stats, userId) {
        if (wishlistItems.length === 0) {
            const emptyEmbed = new EmbedBuilder()
                .setColor('#9B59B6')
                .setTitle('📋 Your Wishlist is Empty')
                .setDescription(
                    '**How to add items to your wishlist:**\n\n' +
                    '• Use `/addtowishlist <name>` command\n' +
                    '• Click "➕ Add to Wishlist" buttons in `/showcurrentitemshop`\n' +
                    '• Search for items with `/searchitem` and add them'
                )
                .setTimestamp();
            return { embeds: [emptyEmbed], components: [] };
        }

        // Calculate pagination
        const ITEMS_PER_PAGE = 6; // 1 header + 6 items = 7 embeds (leaving room for navigation)
        const totalPages = Math.ceil(wishlistItems.length / ITEMS_PER_PAGE);
        const currentPage = Math.max(0, Math.min(page, totalPages - 1));
        const startIndex = currentPage * ITEMS_PER_PAGE;
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, wishlistItems.length);
        const displayItems = wishlistItems.slice(startIndex, endIndex);

        // Create header embed with stats and pagination info
        const headerEmbed = new EmbedBuilder()
            .setColor('#F1C40F')
            .setTitle('📋 Your Fortnite Wishlist')
            .setDescription(
                `📊 **Total Items:** ${stats.total_items}\n` +
                `💎 **Total V-Bucks:** ${stats.total_vbucks.toLocaleString()} V-Bucks`
            )
            .setTimestamp();

        // Add pagination info to header if there are multiple pages
        if (totalPages > 1) {
            headerEmbed.addFields([
                { name: '📄 Page', value: `${currentPage + 1}/${totalPages}`, inline: true },
                { name: '📋 Showing Items', value: `${startIndex + 1}-${endIndex} of ${wishlistItems.length}`, inline: true }
            ]);
        }

        const embeds = [headerEmbed];

        // Fetch shop history for items
        const shopHistoryMap = new Map();
        try {
            if (displayItems.length > 0) {
                const historyPromises = displayItems.map(item => 
                    apiClient.getItemShopHistory(item.item_name, item.item_id || item.item_api_id || item.cosmetic_id)
                        .then(lastSeen => ({ name: item.item_name.toLowerCase(), lastSeen }))
                        .catch(() => ({ name: item.item_name.toLowerCase(), lastSeen: null }))
                );

                const historyResults = await Promise.all(historyPromises);
                historyResults.forEach(result => {
                    if (result.lastSeen) {
                        shopHistoryMap.set(result.name, result.lastSeen);
                    }
                });
            }
        } catch (error) {
            logger.warn('Failed to fetch shop history for wishlist items:', error.message);
        }

        // Create embeds for items on current page
        for (let i = 0; i < displayItems.length; i++) {
            const item = displayItems[i];
            const dateAdded = formatDate(item.added_at);
            const price = formatPrice(item.item_price);
            const lastSeenValue = shopHistoryMap.get(item.item_name.toLowerCase()) || item.last_seen || null;
            const lastSeen = formatDate(lastSeenValue);
            
            const itemEmbed = new EmbedBuilder()
                .setColor(apiClient.getRarityColor(item.item_rarity || ''))
                .setTitle(item.item_name)
                .setThumbnail(item.item_icon_url || null)
                .addFields(
                    { name: '🏷️ Type', value: formatType(item.item_type), inline: true },
                    { name: '💠 Rarity', value: formatRarity(item.item_rarity), inline: true },
                    { name: '💎 Price', value: price, inline: true },
                    { name: '👁️ Last Seen', value: lastSeen, inline: true },
                    { name: '📅 Added', value: dateAdded, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true } // Empty field for spacing
                );
            
            embeds.push(itemEmbed);
        }

        // Create action rows
        const components = this.createWishlistButtons(displayItems, userId, currentPage, totalPages);

        return { embeds, components };
    }

    /**
     * Create navigation and action buttons for wishlist
     * @param {Array} displayItems - Items displayed on current page
     * @param {string} userId - User ID
     * @param {number} currentPage - Current page number
     * @param {number} totalPages - Total number of pages
     * @returns {Array} - Array of ActionRowBuilder
     */
    createWishlistButtons(displayItems, userId, currentPage, totalPages) {
        const components = [];
        
        // Remove buttons for displayed items (max 2 rows of 5 buttons each)
        if (displayItems.length > 0) {
            let currentRow = new ActionRowBuilder();
            let buttonCount = 0;

            for (const item of displayItems.slice(0, 10)) { // Max 10 items (2 rows)
                if (buttonCount === 5) {
                    components.push(currentRow);
                    currentRow = new ActionRowBuilder();
                    buttonCount = 0;
                }

                const itemName = item.item_name.length > 20 ? 
                    item.item_name.substring(0, 17) + '...' : 
                    item.item_name;

                currentRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`wishlist_remove_${userId}_${Buffer.from(item.item_name).toString('base64')}`)
                        .setLabel(`🗑️ ${itemName}`)
                        .setStyle(ButtonStyle.Danger)
                );

                buttonCount++;
            }

            if (buttonCount > 0) {
                components.push(currentRow);
            }
        }

        // Add navigation buttons only if there are multiple pages
        if (totalPages > 1) {
            const navRow = new ActionRowBuilder();

            // First page button
            navRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`wishlist_firstpage_${userId}`)
                    .setLabel('⏮️ First')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0)
            );

            // Previous page button
            navRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`wishlist_prev_${userId}`)
                    .setLabel('◀️ Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === 0)
            );

            // Page indicator
            navRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`wishlist_pageinfo_${userId}`)
                    .setLabel(`Page ${currentPage + 1}/${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

            // Next page button
            navRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`wishlist_next_${userId}`)
                    .setLabel('Next ▶️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage >= totalPages - 1)
            );

            // Last page button
            navRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`wishlist_lastpage_${userId}`)
                    .setLabel('Last ⏭️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage >= totalPages - 1)
            );

            components.push(navRow);
        }

        return components;
    }

    /**
     * Handle wishlist button interactions
     * @param {Interaction} interaction - Discord interaction
     * @returns {boolean} - Whether the interaction was handled
     */
    async handleButtonInteraction(interaction) {
        const customId = interaction.customId;

        // Handle navigation buttons (including first/last page)
        if (customId.startsWith('wishlist_prev_') || 
            customId.startsWith('wishlist_next_') ||
            customId.startsWith('wishlist_firstpage_') ||
            customId.startsWith('wishlist_lastpage_') ||
            customId.startsWith('wishlist_pageinfo_')) {
            return await this.handlePaginationButton(interaction);
        }

        // Handle remove buttons
        if (customId.startsWith('wishlist_remove_')) {
            return await this.handleRemoveButton(interaction);
        }

        // Handle remove confirmation buttons from remove command
        if (customId.startsWith('wishlist_remove_confirm_')) {
            return await this.handleRemoveConfirmButton(interaction);
        }

        // Handle shop wishlist buttons (both old and new format)
        if (customId.startsWith('shop_wishlist_') || customId.startsWith('shop_wl_')) {
            return await this.handleShopWishlistButton(interaction);
        }

        // Handle add wishlist buttons from commands
        if (customId.startsWith('wishlist_add_')) {
            return await this.handleAddButton(interaction);
        }

        // Handle search wishlist buttons
        if (customId.startsWith('search_wishlist_add_')) {
            return await this.handleSearchWishlistButton(interaction);
        }

        return false;
    }

    async handlePaginationButton(interaction) {
        try {
            const userId = interaction.user.id;
            const customId = interaction.customId;
            
            // Check if this is a page info button (disabled, do nothing)
            if (customId.startsWith('wishlist_pageinfo_')) {
                return true;
            }
            
            // Extract direction from custom ID
            let direction = '';
            if (customId.startsWith('wishlist_next_')) {
                direction = 'next';
            } else if (customId.startsWith('wishlist_prev_')) {
                direction = 'prev';
            } else if (customId.startsWith('wishlist_firstpage_')) {
                direction = 'first';
            } else if (customId.startsWith('wishlist_lastpage_')) {
                direction = 'last';
            }
            
            // Check if this is the user's wishlist
            if (!customId.includes(userId)) {
                await interaction.reply({ 
                    content: '❌ You can only navigate your own wishlist!', 
                    flags: MessageFlags.Ephemeral 
                });
                return true;
            }

            // Get current session or create new one
            let session = this.activeInteractions.get(userId);
            if (!session) {
                // Get user's wishlist
                const wishlistItems = await database.getUserWishlist(userId);
                const stats = await database.getWishlistStats(userId);
                
                session = {
                    userId,
                    wishlistItems,
                    stats,
                    currentPage: 0,
                    lastActivity: Date.now()
                };
                this.activeInteractions.set(userId, session);
            }

            // Update page based on direction
            const ITEMS_PER_PAGE = 6;
            const totalPages = Math.ceil(session.wishlistItems.length / ITEMS_PER_PAGE);
            
            switch (direction) {
                case 'first':
                    session.currentPage = 0;
                    break;
                case 'prev':
                    session.currentPage = Math.max(0, session.currentPage - 1);
                    break;
                case 'next':
                    session.currentPage = Math.min(totalPages - 1, session.currentPage + 1);
                    break;
                case 'last':
                    session.currentPage = totalPages - 1;
                    break;
            }

            session.lastActivity = Date.now();

            // Create updated embed
            const { embeds, components } = await this.createWishlistEmbed(
                session.wishlistItems, 
                session.currentPage, 
                session.stats, 
                userId
            );

            await interaction.update({ embeds, components });

            // Log interaction
            await database.logUserInteraction(
                userId,
                interaction.user.username,
                'pagination',
                { 
                    action: 'wishlist_navigate',
                    page: session.currentPage,
                    direction: direction
                },
                interaction.guildId
            );

            return true;

        } catch (error) {
            logger.error('Error handling wishlist pagination:', error);
            
            // Try to respond appropriately based on interaction state
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ 
                        content: '❌ An error occurred while navigating your wishlist.', 
                        flags: MessageFlags.Ephemeral 
                    });
                } else {
                    await interaction.reply({ 
                        content: '❌ An error occurred while navigating your wishlist.', 
                        flags: MessageFlags.Ephemeral 
                    });
                }
            } catch (replyError) {
                logger.error('Failed to send error message:', replyError);
            }
            
            return true;
        }
    }

    async handleRemoveButton(interaction) {
        try {
            const customId = interaction.customId;
            const parts = customId.split('_');
            
            if (parts.length < 4) return false;
            
            const userId = parts[2];
            const encodedItemName = parts.slice(3).join('_');
            
            // Check if this is the user's wishlist
            if (userId !== interaction.user.id) {
                await interaction.reply({ 
                    content: '❌ You can only remove items from your own wishlist!', 
                    flags: MessageFlags.Ephemeral 
                });
                return true;
            }

            // Decode item name
            const itemName = Buffer.from(encodedItemName, 'base64').toString('utf8');
            
            // Remove from database
            const removed = await database.removeFromWishlist(userId, itemName);
            
            if (removed) {
                // Update session if it exists
                const session = this.activeInteractions.get(userId);
                if (session) {
                    session.wishlistItems = session.wishlistItems.filter(item => item.item_name !== itemName);
                    session.stats = await database.getWishlistStats(userId);
                    session.lastActivity = Date.now();
                    
                    // Adjust page if necessary
                    const ITEMS_PER_PAGE = 6;
                    const totalPages = Math.ceil(session.wishlistItems.length / ITEMS_PER_PAGE);
                    if (session.currentPage >= totalPages && totalPages > 0) {
                        session.currentPage = totalPages - 1;
                    }
                    
                    // Create updated embed
                    const { embeds, components } = await this.createWishlistEmbed(
                        session.wishlistItems, 
                        session.currentPage, 
                        session.stats, 
                        userId
                    );
                    
                    await interaction.update({ embeds, components });
                } else {
                    await interaction.update({ 
                        content: '✅ Item removed from wishlist! Use `/mywishlist` to view updated list.', 
                        embeds: [], 
                        components: [] 
                    });
                }

                // Log interaction
                await database.logUserInteraction(
                    userId,
                    interaction.user.username,
                    'button',
                    { 
                        action: 'wishlist_remove',
                        itemName: itemName
                    },
                    interaction.guildId
                );

            } else {
                await interaction.reply({ 
                    content: '❌ Item not found in your wishlist.', 
                    flags: MessageFlags.Ephemeral 
                });
            }

            return true;

        } catch (error) {
            logger.error('Error handling wishlist remove:', error);
            await interaction.reply({ 
                content: '❌ An error occurred while removing the item from your wishlist.', 
                flags: MessageFlags.Ephemeral 
            });
            return true;
        }
    }

    async handleRemoveConfirmButton(interaction) {
        try {
            const customId = interaction.customId;
            // Expected format: wishlist_remove_confirm_[userId]_[encodedItemName]
            const parts = customId.split('_');
            
            if (parts.length < 5) return false;
            
            const userId = parts[3];
            const encodedItemName = parts.slice(4).join('_');
            
            // Check if this is the user's wishlist
            if (userId !== interaction.user.id) {
                await interaction.reply({ 
                    content: '❌ You can only remove items from your own wishlist!', 
                    flags: MessageFlags.Ephemeral 
                });
                return true;
            }

            // Decode item name
            const itemName = Buffer.from(encodedItemName, 'base64').toString('utf8');
            
            // Remove from database
            const removed = await database.removeFromWishlist(userId, itemName);
            
            if (removed) {
                await interaction.reply({
                    content: `✅ **${itemName}** has been removed from your wishlist!`,
                    flags: MessageFlags.Ephemeral
                });

                // Log interaction
                await database.logUserInteraction(
                    userId,
                    interaction.user.username,
                    'button',
                    { 
                        action: 'wishlist_remove_from_command',
                        itemName: itemName
                    },
                    interaction.guildId
                );
            } else {
                await interaction.reply({ 
                    content: '❌ Item not found in your wishlist.', 
                    flags: MessageFlags.Ephemeral 
                });
            }

            return true;

        } catch (error) {
            logger.error('Error handling wishlist remove confirmation:', error);
            await interaction.reply({ 
                content: '❌ An error occurred while removing the item from your wishlist.', 
                flags: MessageFlags.Ephemeral 
            });
            return true;
        }
    }

    async handleShopWishlistButton(interaction) {
        try {
            const customId = interaction.customId;
            // Expected format: shop_wl_[sessionId]_[itemIdHash]_[base64name]
            const parts = customId.split('_');
            
            if (parts.length < 5) return false;
            
            const userId = interaction.user.id;
            const sessionId = parts[2];
            const itemIdHash = parts[3];
            
            // Extract base64 encoded item name (last part)
            const itemNameBase64 = parts[parts.length - 1];
            
            // Decode item name
            let itemName;
            try {
                itemName = Buffer.from(itemNameBase64, 'base64').toString('utf8');
            } catch (decodeError) {
                logger.error('Failed to decode item name from shop wishlist button:', decodeError);
                await interaction.reply({
                    content: '❌ Failed to identify the item. Please try again.',
                    flags: MessageFlags.Ephemeral
                });
                return true;
            }

            logger.debug(`Attempting to add to wishlist - User: ${userId}, Item: ${itemName}, ID Hash: ${itemIdHash}`);

            // Check if item already exists in wishlist FIRST
            const existingItem = await database.checkWishlistItem(userId, itemName);
            
            if (existingItem) {
                await interaction.reply({
                    content: `❌ **${itemName}** is already in your wishlist!`,
                    flags: MessageFlags.Ephemeral
                });
                return true;
            }

            // Fetch item details from API (using limit of 25 to avoid API issues)
            let searchResults;
            try {
                searchResults = await apiClient.searchItems(itemName, null, 25);
            } catch (apiError) {
                logger.error(`API search failed for "${itemName}":`, apiError);
                
                // If the API fails, try with a lower limit as a fallback
                try {
                    logger.debug(`Retrying search with limit=10`);
                    searchResults = await apiClient.searchItems(itemName, null, 10);
                } catch (retryError) {
                    logger.error(`Retry search also failed for "${itemName}":`, retryError);
                    await interaction.reply({
                        content: `❌ Unable to search for **${itemName}** at this time. The API might be experiencing issues. Please try again later.`,
                        flags: MessageFlags.Ephemeral
                    });
                    return true;
                }
            }
            
            if (!searchResults?.data || searchResults.data.length === 0) {
                await interaction.reply({
                    content: `❌ Could not find item details for **${itemName}**. Please try again.`,
                    flags: MessageFlags.Ephemeral
                });
                return true;
            }

            // Find exact match by ID hash first (most accurate), then by exact name match
            let item = searchResults.data.find(i => i.id && i.id.endsWith(itemIdHash));
            if (!item) {
                // Fallback: exact name match (case-sensitive for better accuracy)
                item = searchResults.data.find(i => i.name === itemName);
            }
            if (!item) {
                // Fallback: case-insensitive name match
                item = searchResults.data.find(i => i.name.toLowerCase() === itemName.toLowerCase());
            }
            if (!item) {
                // Last resort: first result
                item = searchResults.data[0];
            }

            const itemData = {
                name: item.name,
                type: item.readableType || item.type || 'Unknown',
                rarity: item.rarity?.displayValue || item.rarity || 'Unknown',
                icon_url: item.images?.icon || null,
                price: typeof item.price === 'string'
                    ? parseInt(item.price.replace(/[^0-9]/g, ''), 10) || 0
                    : Number(item.price) || 0
            };

            logger.debug(`Item data for wishlist:`, itemData);

            // Add to wishlist
            const added = await database.addToWishlist(userId, itemData);

            if (added) {
                const confirmationEmbed = createWishlistConfirmationEmbed(itemData, {
                    viewCommand: '/mywishlist'
                });

                await interaction.reply({
                    embeds: [confirmationEmbed],
                    flags: MessageFlags.Ephemeral
                });

                // Log interaction
                await database.logUserInteraction(
                    userId,
                    interaction.user.username,
                    'button',
                    { 
                        action: 'wishlist_add_from_shop',
                        itemName: item.name
                    },
                    interaction.guildId
                );
            } else {
                // Item already exists (duplicate entry)
                await interaction.reply({
                    content: `❌ **${item.name}** is already in your wishlist!`,
                    flags: MessageFlags.Ephemeral
                });
            }

            return true;

        } catch (error) {
            logger.error('Error handling shop wishlist button:', error);
            
            // Check if we already replied
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred while adding the item to your wishlist.',
                    flags: MessageFlags.Ephemeral
                });
            }
            return true;
        }
    }

    async handleAddButton(interaction) {
        try {
            const customId = interaction.customId;
            // Expected format: wishlist_add_[base64EncodedItemData]
            const parts = customId.split('_');
            
            if (parts.length < 3) return false;
            
            const encodedItemData = parts.slice(2).join('_');
            const userId = interaction.user.id;

            // Decode item data
            let itemData;
            try {
                const decodedData = Buffer.from(encodedItemData, 'base64').toString('utf8');
                itemData = JSON.parse(decodedData);
            } catch (decodeError) {
                logger.error('Failed to decode item data:', decodeError);
                await interaction.reply({
                    content: '❌ Invalid item data. Please try adding the item again.',
                    flags: MessageFlags.Ephemeral
                });
                return true;
            }

            // Check if item already exists in wishlist
            const existingItem = await database.checkWishlistItem(userId, itemData.name);
            
            if (existingItem) {
                await interaction.reply({
                    content: `❌ **${itemData.name}** is already in your wishlist!`,
                    flags: MessageFlags.Ephemeral
                });
                return true;
            }

            // Add to wishlist
            const added = await database.addToWishlist(userId, itemData);
            
            if (added) {
                const confirmationEmbed = createWishlistConfirmationEmbed(itemData, {
                    viewCommand: '/mywishlist'
                });

                await interaction.reply({
                    embeds: [confirmationEmbed],
                    flags: MessageFlags.Ephemeral
                });

                // Log interaction
                await database.logUserInteraction(
                    userId,
                    interaction.user.username,
                    'button',
                    { 
                        action: 'wishlist_add_from_search',
                        itemName: itemData.name
                    },
                    interaction.guildId
                );
            } else {
                await interaction.reply({
                    content: `❌ Failed to add **${itemData.name}** to your wishlist. Please try again.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            return true;

        } catch (error) {
            logger.error('Error handling wishlist add button:', error);
            await interaction.reply({
                content: '❌ An error occurred while adding the item to your wishlist.',
                flags: MessageFlags.Ephemeral
            });
            return true;
        }
    }

    async handleSearchWishlistButton(interaction) {
        try {
            const customId = interaction.customId;
            const parts = customId.split('_');
            const userId = interaction.user.id;
            
            logger.debug(`Processing search wishlist button: ${customId}`);
            logger.debug(`Button parts:`, parts);
            
            let itemNameBase64;
            
            // Handle different button formats:
            // Format 1 (single item): search_wishlist_add_userId_base64Name (5 parts)
            // Format 2 (multiple items): search_wishlist_add_search_userId_timestamp_base64Name (7 parts)
            
            if (parts.length === 5) {
                // Single item format: search_wishlist_add_userId_base64Name
                itemNameBase64 = parts[4];
                logger.debug(`Single item format detected, base64: ${itemNameBase64}`);
            } else if (parts.length === 7) {
                // Multiple items format: search_wishlist_add_search_userId_timestamp_base64Name
                itemNameBase64 = parts[6];
                logger.debug(`Multiple items format detected, base64: ${itemNameBase64}`);
            } else {
                logger.warn('Invalid search wishlist button format - unexpected part count:', customId);
                logger.error(`Expected 5 or 7 parts, got ${parts.length} parts:`, parts);
                await interaction.reply({
                    content: '❌ Invalid button format. Please try the search again.',
                    flags: MessageFlags.Ephemeral
                });
                return true;
            }
            
            // Decode item name
            let itemName;
            try {
                itemName = Buffer.from(itemNameBase64, 'base64').toString('utf8');
            } catch (decodeError) {
                logger.error('Failed to decode item name from search button:', decodeError);
                logger.error('Button ID parts:', parts);
                logger.error('Attempting to decode:', itemNameBase64);
                await interaction.reply({
                    content: '❌ Invalid item data. Please try the search again.',
                    flags: MessageFlags.Ephemeral
                });
                return true;
            }

            logger.debug(`Attempting to add to wishlist - User: ${userId}, Item: ${itemName}`);
            
            if (!itemName || itemName.trim() === '') {
                logger.error(`Missing required fields - userId: ${userId}, itemName: '${itemName}'`);
                logger.error('Button parts for debugging:', parts);
                await interaction.reply({
                    content: '❌ Failed to identify the item. Please try again.',
                    flags: MessageFlags.Ephemeral
                });
                return true;
            }

            // Check if item already exists in wishlist BEFORE attempting to add
            const existingItem = await database.checkWishlistItem(userId, itemName);
            
            if (existingItem) {
                await interaction.reply({
                    content: `❌ **${itemName}** is already in your wishlist!`,
                    flags: MessageFlags.Ephemeral
                });
                return true;
            }

            // For search buttons, we need to fetch the full item data since we only have the name
            const searchResults = await apiClient.searchItems(itemName, null, 1);
            
            if (!searchResults?.data || searchResults.data.length === 0) {
                await interaction.reply({
                    content: `❌ Could not find item details for **${itemName}**. Please try again.`,
                    flags: MessageFlags.Ephemeral
                });
                return true;
            }

            // Find exact match or best match
            const item = searchResults.data.find(i => i.name.toLowerCase() === itemName.toLowerCase()) || searchResults.data[0];

            const itemData = {
                name: item.name,
                type: item.readableType || item.type || 'Unknown',
                rarity: item.rarity?.displayValue || item.rarity || 'Unknown',
                icon_url: item.images?.icon || null,
                price: typeof item.price === 'string'
                    ? parseInt(item.price.replace(/[^0-9]/g, ''), 10) || 0
                    : Number(item.price) || 0
            };

            // Try to add to wishlist (only once)
            const added = await database.addToWishlist(userId, itemData);

            if (added) {
                const confirmationEmbed = createWishlistConfirmationEmbed(itemData, {
                    viewCommand: '/mywishlist'
                });

                await interaction.reply({
                    embeds: [confirmationEmbed],
                    flags: MessageFlags.Ephemeral
                });

                // Log interaction
                await database.logUserInteraction(
                    userId,
                    interaction.user.username,
                    'button',
                    { 
                        action: 'wishlist_add_from_search_button',
                        itemName: item.name
                    },
                    interaction.guildId
                );
            } else {
                // This means the item already exists (race condition or duplicate)
                await interaction.reply({
                    content: `❌ **${item.name}** is already in your wishlist!`,
                    flags: MessageFlags.Ephemeral
                });
            }

            return true;

        } catch (error) {
            logger.error('Error handling search wishlist button:', error);
            
            // Only reply if we haven't already replied or deferred
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({
                        content: '❌ An error occurred while adding the item to your wishlist.',
                        flags: MessageFlags.Ephemeral
                    });
                } catch (replyError) {
                    logger.error('Failed to send error reply:', replyError);
                }
            }
            return true;
        }
    }

    /**
     * Clean up expired sessions
     */
    cleanupExpiredSessions() {
        const now = Date.now();
        const expireTime = 30 * 60 * 1000; // 30 minutes

        for (const [userId, session] of this.activeInteractions.entries()) {
            if (now - session.lastActivity > expireTime) {
                this.activeInteractions.delete(userId);
                logger.debug(`Cleaned up expired wishlist session for user ${userId}`);
            }
        }

        // Also enforce max sessions limit
        if (this.activeInteractions.size > this.maxSessions) {
            const sortedSessions = Array.from(this.activeInteractions.entries())
                .sort((a, b) => a[1].lastActivity - b[1].lastActivity);
            
            const toRemove = sortedSessions.slice(0, this.activeInteractions.size - this.maxSessions);
            for (const [userId] of toRemove) {
                this.activeInteractions.delete(userId);
            }
            
            logger.info(`Cleaned up ${toRemove.length} wishlist sessions due to max limit`);
        }
    }

    /**
     * Get or create a session for pagination
     */
    async getOrCreateSession(userId) {
        let session = this.activeInteractions.get(userId);
        
        if (!session) {
            const wishlistItems = await database.getUserWishlist(userId);
            const stats = await database.getWishlistStats(userId);
            
            session = {
                userId,
                wishlistItems,
                stats,
                currentPage: 0,
                lastActivity: Date.now()
            };
            
            this.activeInteractions.set(userId, session);
        } else {
            session.lastActivity = Date.now();
        }
        
        return session;
    }
}

function formatDate(dateInput) {
    if (!dateInput) return 'Unknown';

    try {
        const date = new Date(dateInput);
        if (Number.isNaN(date.getTime())) {
            return 'Unknown';
        }

        const now = new Date();
        
        // Compare calendar dates (not just time difference)
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const diffTime = todayStart - dateStart;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        if (diffDays === 0) {
            return `${formattedDate} (Today)`;
        }
        if (diffDays === 1) {
            return `${formattedDate} (Yesterday)`;
        }
        if (diffDays > 1 && diffDays < 7) {
            return `${formattedDate} (${diffDays} days ago)`;
        }
        if (diffDays >= 7 && diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `${formattedDate} (${weeks} week${weeks > 1 ? 's' : ''} ago)`;
        }

        return formattedDate;
    } catch (error) {
        return 'Unknown';
    }
}

module.exports = new WishlistManager();