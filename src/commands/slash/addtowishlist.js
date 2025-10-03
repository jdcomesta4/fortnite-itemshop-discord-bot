const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
    data: new SlashCommandBuilder()
        .setName('addtowishlist')
        .setDescription('Add an item to your personal wishlist')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The name of the item to search for')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Item type filter')
                .setRequired(false)
                .addChoices(
                    ...itemTypes.map(type => ({ name: type.charAt(0).toUpperCase() + type.slice(1), value: type }))
                ))
        .addStringOption(option =>
            option.setName('rarity')
                .setDescription('Item rarity filter')
                .setRequired(false)
                .addChoices(
                    ...rarities.map(rarity => ({ name: rarity.charAt(0).toUpperCase() + rarity.slice(1), value: rarity }))
                )),
    
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

            const itemName = interaction.options.getString('name');
            const itemType = interaction.options.getString('type');
            const itemRarity = interaction.options.getString('rarity');

            // Check if interaction is already acknowledged
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral: true });
            }

            logger.command(`Searching items for wishlist: "${itemName}" by ${interaction.user.username}`);

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

                await interaction.editReply({ embeds: [noResultsEmbed] });
                return;
            }

            const items = searchResults.data.slice(0, 25); // Discord button limit

            // If only one item found, add directly
            if (items.length === 1) {
                await this.addSingleItemToWishlist(interaction, items[0], startTime);
                return;
            }

            // Multiple items found - show selection
            await this.showItemSelection(interaction, items, itemName, itemType, itemRarity);

            // Log search analytics
            await database.logSearchAnalytics(
                interaction.user.id,
                itemName,
                itemType,
                itemRarity,
                items.length,
                Date.now() - startTime
            );

        } catch (error) {
            logger.error('Error in addtowishlist command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Error')
                .setDescription('An error occurred while searching for items. Please try again later.')
                .setTimestamp();

            try {
                if (interaction.deferred && !interaction.replied) {
                    await interaction.editReply({ embeds: [errorEmbed] });
                } else if (!interaction.replied) {
                    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }
            } catch (responseError) {
                logger.error('Failed to send error response:', responseError);
            }

            // Log command usage with error  
            try {
                await database.logCommandUsage(
                    interaction.user.id,
                    interaction.user.username,
                    'addtowishlist',
                    { name: interaction.options?.getString('name'), type: interaction.options?.getString('type'), rarity: interaction.options?.getString('rarity') },
                    interaction.guildId,
                    interaction.guild?.name,
                    Date.now() - startTime,
                    false,
                    error.message
                );
            } catch (logError) {
                logger.error('Failed to log command usage:', logError);
            }
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

    async addSingleItemToWishlist(interaction, item, startTime) {
        try {
            const userId = interaction.user.id;
            
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

                await interaction.editReply({ embeds: [existsEmbed] });
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
            console.log(`🔄 Calling addToWishlist with userId: ${userId}`);
            let added = false;
            
            try {
                added = await database.addToWishlist(userId, itemData);
                console.log(`📊 addToWishlist result: ${added}`);
            } catch (error) {
                console.error(`❌ Failed to add to wishlist:`, error);
                
                const errorEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('❌ Database Error')
                    .setDescription(`Failed to add **${item.name}** to your wishlist due to a database error.\n\nError: ${error.message}`)
                    .setTimestamp();

                await interaction.editReply({ embeds: [errorEmbed] });
                return;
            }
            
            if (added) {
                const confirmationEmbed = createWishlistConfirmationEmbed(itemData, {
                    viewCommand: '/mywishlist'
                });

                await interaction.editReply({ embeds: [confirmationEmbed] });

                // Log successful command usage
                await database.logCommandUsage(
                    interaction.user.id,
                    interaction.user.username,
                    'addtowishlist',
                    { itemName: item.name, added: true },
                    interaction.guildId,
                    interaction.guild?.name,
                    Date.now() - startTime,
                    true
                );

            } else {
                // This shouldn't happen since we checked above, but handle it
                const errorEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('❌ Error')
                    .setDescription('Failed to add item to wishlist. It may already exist.')
                    .setTimestamp();

                await interaction.editReply({ embeds: [errorEmbed] });
            }

        } catch (error) {
            logger.error('Error adding single item to wishlist:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Error')
                .setDescription('An error occurred while adding the item to your wishlist.')
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
            throw error;
        }
    },

    async showItemSelection(interaction, items, searchTerm, itemType, itemRarity) {
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

            await interaction.editReply({ embeds: [selectionEmbed], components });

        } catch (error) {
            logger.error('Error showing item selection:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Error')
                .setDescription('An error occurred while displaying the search results.')
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
            throw error;
        }
    }
};