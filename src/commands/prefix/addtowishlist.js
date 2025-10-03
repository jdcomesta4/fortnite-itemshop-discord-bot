const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const apiClient = require('../../utils/apiClient');
const permissionManager = require('../../utils/permissionManager');
const database = require('../../utils/database');
const logger = require('../../utils/logger');
const { createWishlistConfirmationEmbed } = require('../../utils/wishlistEmbeds');

const itemTypes = [
    'outfit', 'backpack', 'pickaxe', 'glider', 'emote', 'wrap', 'loading', 'music',
    'pet', 'spray', 'toy', 'banner', 'emoticon', 'contrail', 'lego-outfit', 'lego-kit'
];

const rarities = [
    'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'transcendent',
    'exotic', 'gaming', 'shadow', 'lava', 'frozen', 'marvel', 'dc', 'starwars', 'icon'
];

module.exports = {
    name: 'addtowishlist',
    aliases: ['addwish', 'wishlistadd', 'wadd'],
    description: 'Add an item to your personal wishlist',
    usage: 'addtowishlist <item name> [type] [rarity]',
    examples: [
        'addtowishlist "Raven"',
        'addtowishlist "Travis Scott" outfit',
        'addtowishlist "Reaper" pickaxe legendary'
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

            if (args.length === 0) {
                const helpEmbed = new EmbedBuilder()
                    .setColor('#3498DB')
                    .setTitle('💡 Command Usage')
                    .setDescription(
                        `**Usage:** \`${message.prefix || '!'}${this.name} <item name> [type] [rarity]\`\n\n` +
                        '**Examples:**\n' +
                        `• \`${message.prefix || '!'}addtowishlist Raven\`\n` +
                        `• \`${message.prefix || '!'}addtowishlist "Travis Scott" outfit\`\n` +
                        `• \`${message.prefix || '!'}addtowishlist Reaper pickaxe legendary\`\n\n` +
                        '**Available Types:** ' + itemTypes.join(', ') + '\n\n' +
                        '**Available Rarities:** ' + rarities.join(', ')
                    )
                    .setFooter({ text: 'Use quotes around item names with spaces' });

                await message.reply({ embeds: [helpEmbed] });
                return;
            }

            // Parse arguments
            let itemName, itemType, itemRarity;
            
            // Handle quoted strings
            const quotedMatch = args.join(' ').match(/^"([^"]+)"\s*(.*)$/);
            if (quotedMatch) {
                itemName = quotedMatch[1];
                const remaining = quotedMatch[2].trim().split(/\s+/);
                itemType = remaining[0]?.toLowerCase();
                itemRarity = remaining[1]?.toLowerCase();
            } else {
                // Try to parse without quotes - assume first word is item name unless it's a known type/rarity
                const firstArg = args[0].toLowerCase();
                if (itemTypes.includes(firstArg) || rarities.includes(firstArg)) {
                    // No item name provided
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#E74C3C')
                        .setTitle('❌ Invalid Usage')
                        .setDescription(
                            'Please provide an item name first.\n\n' +
                            `**Correct usage:** \`${message.prefix || '!'}addtowishlist <item name> [type] [rarity]\``
                        );
                    await message.reply({ embeds: [errorEmbed] });
                    return;
                }
                
                itemName = args[0];
                itemType = args[1]?.toLowerCase();
                itemRarity = args[2]?.toLowerCase();
            }

            // Validate type and rarity
            if (itemType && !itemTypes.includes(itemType)) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('❌ Invalid Type')
                    .setDescription(
                        `"${itemType}" is not a valid item type.\n\n` +
                        `**Valid types:** ${itemTypes.join(', ')}`
                    );
                await message.reply({ embeds: [errorEmbed] });
                return;
            }

            if (itemRarity && !rarities.includes(itemRarity)) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('❌ Invalid Rarity')
                    .setDescription(
                        `"${itemRarity}" is not a valid item rarity.\n\n` +
                        `**Valid rarities:** ${rarities.join(', ')}`
                    );
                await message.reply({ embeds: [errorEmbed] });
                return;
            }

            const processingEmbed = new EmbedBuilder()
                .setColor('#F39C12')
                .setTitle('🔍 Searching...')
                .setDescription(`Searching for items matching **"${itemName}"**...`)
                .setTimestamp();

            const processingMessage = await message.reply({ embeds: [processingEmbed] });

            logger.command(`Searching items for wishlist: "${itemName}" by ${message.author.username}`);

            // Search for items using the API
            const searchResults = await apiClient.searchItems(itemName, itemType, itemRarity);
            
            if (!searchResults || !searchResults.data || searchResults.data.length === 0) {
                const noResultsEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('❌ No Items Found')
                    .setDescription(
                        `No items found matching **"${itemName}"**` +
                        (itemType ? ` with type **${itemType}**` : '') +
                        (itemRarity ? ` and rarity **${itemRarity}**` : '') +
                        '\n\nTry refining your search terms or using different filters.'
                    )
                    .setTimestamp();

                await processingMessage.edit({ embeds: [noResultsEmbed] });
                return;
            }

            const items = searchResults.data.slice(0, 25); // Discord button limit

            // If only one item found, add directly
            if (items.length === 1) {
                await this.addSingleItemToWishlist(processingMessage, items[0], message.author.id, startTime);
                return;
            }

            // Multiple items found - show selection
            await this.showItemSelection(processingMessage, items, itemName, itemType, itemRarity);

            // Log search analytics
            await database.logSearchAnalytics(
                message.author.id,
                itemName,
                itemType,
                itemRarity,
                items.length,
                Date.now() - startTime
            );

        } catch (error) {
            logger.error('Error in addtowishlist prefix command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Error')
                .setDescription('An error occurred while searching for items. Please try again later.')
                .setTimestamp();

            await message.reply({ embeds: [errorEmbed] });

            // Log command usage with error
            await database.logCommandUsage(
                message.author.id,
                message.author.username,
                'addtowishlist',
                { name: itemName, type: itemType, rarity: itemRarity },
                message.guildId,
                message.guild?.name,
                Date.now() - startTime,
                false,
                error.message
            );
        }
    },

    extractItemType(item) {
        // Try various possible locations for item type
        return item.type?.displayValue || 
               item.type?.value || 
               item.type || 
               item.category?.displayValue ||
               item.category?.value ||
               item.category ||
               item.cosmetic?.type?.displayValue ||
               item.cosmetic?.type?.value ||
               'Unknown';
    },

    extractItemRarity(item) {
        // Try various possible locations for item rarity
        return item.rarity?.displayValue || 
               item.rarity?.value || 
               item.rarity || 
               item.series?.displayValue ||
               item.series?.value ||
               item.series ||
               item.cosmetic?.rarity?.displayValue ||
               item.cosmetic?.rarity?.value ||
               'Unknown';
    },

    extractItemPrice(item) {
        // Try various possible locations for item price
        let price = item.price?.regularPrice || 
                   item.price?.finalPrice ||
                   item.price ||
                   item.cost ||
                   item.vbucks ||
                   item.cosmetic?.price ||
                   null;
        
        // Ensure we return a proper integer for database storage
        if (price === null || price === undefined) {
            return null;
        }
        
        // If it's already a number, return it
        if (typeof price === 'number') {
            return Math.floor(price);
        }
        
        // If it's a string, try to parse it (remove commas, etc.)
        if (typeof price === 'string') {
            // Remove commas, spaces, and other formatting
            const cleanPrice = price.replace(/[^0-9]/g, '');
            const parsedPrice = parseInt(cleanPrice, 10);
            return isNaN(parsedPrice) ? null : parsedPrice;
        }
        
        return null;
    },

    async addSingleItemToWishlist(message, item, userId, startTime) {
        try {
            // Check if item already exists in wishlist
            const existingItem = await database.checkWishlistItem(userId, item.name);
            
            if (existingItem) {
                const existsEmbed = new EmbedBuilder()
                    .setColor('#F39C12')
                    .setTitle('⚠️ Already in Wishlist')
                    .setDescription(`**${item.name}** is already in your wishlist!`)
                    .setThumbnail(item.images?.icon || null)
                    .addFields(
                        { name: 'Type', value: item.type?.displayValue || 'Unknown', inline: true },
                        { name: 'Rarity', value: item.rarity?.displayValue || 'Unknown', inline: true },
                        { name: 'Added', value: new Date(existingItem.added_at).toLocaleDateString(), inline: true }
                    )
                    .setTimestamp();

                await message.edit({ embeds: [existsEmbed] });
                return;
            }

            // Debug: Log the item object to understand its structure
            logger.debug(`Item object for "${item.name}":`, JSON.stringify(item, null, 2));
            
            // Prepare item data with enhanced extraction logic
            const itemData = {
                name: item.name,
                type: this.extractItemType(item),
                rarity: this.extractItemRarity(item),
                icon_url: item.images?.icon || item.icon || null,
                price: this.extractItemPrice(item)
            };
            
            logger.debug(`Extracted item data:`, JSON.stringify(itemData, null, 2));

            // Add to wishlist
            const added = await database.addToWishlist(userId, itemData);
            
            if (added) {
                const confirmationEmbed = createWishlistConfirmationEmbed(itemData, {
                    viewCommand: '!mywishlist'
                });

                await message.edit({ embeds: [confirmationEmbed] });

                // Log successful command usage
                await database.logCommandUsage(
                    userId,
                    message.author?.username,
                    'addtowishlist',
                    { itemName: item.name, added: true },
                    message.guildId,
                    message.guild?.name,
                    Date.now() - startTime,
                    true
                );

            } else {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('❌ Error')
                    .setDescription('Failed to add item to wishlist. It may already exist.')
                    .setTimestamp();

                await message.edit({ embeds: [errorEmbed] });
            }

        } catch (error) {
            logger.error('Error adding single item to wishlist:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Error')
                .setDescription('An error occurred while adding the item to your wishlist.')
                .setTimestamp();

            await message.edit({ embeds: [errorEmbed] });
            throw error;
        }
    },

    async showItemSelection(message, items, searchTerm, itemType, itemRarity) {
        try {
            // Create embed showing all found items
            const selectionEmbed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle('🔍 Multiple Items Found')
                .setDescription(
                    `Found **${items.length}** items matching **"${searchTerm}"**` +
                    (itemType ? ` with type **${itemType}**` : '') +
                    (itemRarity ? ` and rarity **${itemRarity}**` : '') +
                    '\n\nClick a button below to add an item to your wishlist:'
                )
                .setTimestamp();

            // Add fields for each item (show first 5 in embed)
            const itemsToShow = items.slice(0, 5);
            for (const item of itemsToShow) {
                const price = item.price?.regularPrice ? `${item.price.regularPrice.toLocaleString()} V-Bucks` : 'Unknown';

                selectionEmbed.addFields({
                    name: item.name,
                    value: 
                        `**Type:** ${item.type?.displayValue || 'Unknown'} | **Rarity:** ${item.rarity?.displayValue || 'Unknown'}\n` +
                        `**Price:** ${price}`,
                    inline: false
                });
            }

            if (items.length > 5) {
                selectionEmbed.setFooter({ text: `Showing first 5 of ${items.length} items. All items available in buttons below.` });
            }

            // Create buttons for all items (up to 25)
            const components = [];
            let currentRow = new ActionRowBuilder();
            
            for (let i = 0; i < items.length; i++) {
                if (i % 5 === 0 && i > 0) {
                    components.push(currentRow);
                    currentRow = new ActionRowBuilder();
                }

                const item = items[i];
                const itemId = Buffer.from(JSON.stringify({
                    name: item.name,
                    type: item.type?.displayValue || item.type?.value || 'Unknown',
                    rarity: item.rarity?.displayValue || item.rarity?.value || 'Unknown',
                    icon_url: item.images?.icon || null,
                    price: item.price?.regularPrice || null
                })).toString('base64');

                const buttonLabel = item.name.length > 80 ? 
                    item.name.substring(0, 77) + '...' : 
                    item.name;

                currentRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`wishlist_add_${itemId}`)
                        .setLabel(`➕ ${buttonLabel}`)
                        .setStyle(ButtonStyle.Primary)
                );
            }

            if (currentRow.components.length > 0) {
                components.push(currentRow);
            }

            await message.edit({ embeds: [selectionEmbed], components });

        } catch (error) {
            logger.error('Error showing item selection:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Error')
                .setDescription('An error occurred while displaying the search results.')
                .setTimestamp();

            await message.edit({ embeds: [errorEmbed] });
            throw error;
        }
    }
};