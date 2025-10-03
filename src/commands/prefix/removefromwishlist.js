const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const permissionManager = require('../../utils/permissionManager');
const database = require('../../utils/database');
const logger = require('../../utils/logger');

module.exports = {
    name: 'removefromwishlist',
    aliases: ['removewish', 'wishlistremove', 'wremove', 'delwish'],
    description: 'Remove an item from your wishlist',
    usage: 'removefromwishlist <item name>',
    examples: [
        'removefromwishlist "Raven"',
        'removefromwishlist Travis',
        'wremove Reaper'
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
                        `**Usage:** \`${message.prefix || '!'}${this.name} <item name>\`\n\n` +
                        '**Examples:**\n' +
                        `• \`${message.prefix || '!'}removefromwishlist Raven\`\n` +
                        `• \`${message.prefix || '!'}removefromwishlist "Travis Scott"\`\n` +
                        `• \`${message.prefix || '!'}wremove Reaper\`\n\n` +
                        '**Note:** Use quotes around item names with spaces for exact matching.'
                    )
                    .setFooter({ text: 'This command supports partial matching of item names' });

                await message.reply({ embeds: [helpEmbed] });
                return;
            }

            // Parse search term
            let searchTerm;
            const quotedMatch = args.join(' ').match(/^"([^"]+)"$/);
            if (quotedMatch) {
                searchTerm = quotedMatch[1];
            } else {
                searchTerm = args.join(' ');
            }

            const userId = message.author.id;

            logger.command(`Removing item from wishlist: "${searchTerm}" by ${message.author.username}`);

            // Get user's wishlist items that match the search term
            const wishlistItems = await database.getUserWishlist(userId);
            
            if (wishlistItems.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setColor('#6C7B7F')
                    .setTitle('📋 Wishlist Empty')
                    .setDescription(
                        'Your wishlist is empty. Use `!addtowishlist` to add items!\n\n' +
                        '**Examples:**\n' +
                        '• `!addtowishlist Raven`\n' +
                        '• `!addtowishlist "Travis Scott" outfit`'
                    )
                    .setTimestamp();

                await message.reply({ embeds: [emptyEmbed] });
                return;
            }

            // Filter items that match the search term (case-insensitive partial matching)
            const matchingItems = wishlistItems.filter(item =>
                item.item_name.toLowerCase().includes(searchTerm.toLowerCase())
            );

            if (matchingItems.length === 0) {
                const noMatchEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('❌ No Items Found')
                    .setDescription(
                        `No items found in your wishlist matching **"${searchTerm}"**\n\n` +
                        'Make sure you spelled the item name correctly, or use `!mywishlist` to see all your items.'
                    )
                    .addFields({
                        name: '💡 Tip',
                        value: 'Try using just part of the item name for partial matching.',
                        inline: false
                    })
                    .setTimestamp();

                await message.reply({ embeds: [noMatchEmbed] });
                return;
            }

            // If only one item matches, remove it directly
            if (matchingItems.length === 1) {
                await this.removeSingleItem(message, matchingItems[0], startTime);
                return;
            }

            // Multiple items match - show selection
            await this.showRemovalSelection(message, matchingItems, searchTerm);

            // Log command usage
            await database.logCommandUsage(
                message.author.id,
                message.author.username,
                'removefromwishlist',
                { searchTerm, matchCount: matchingItems.length },
                message.guildId,
                message.guild?.name,
                Date.now() - startTime,
                true
            );

        } catch (error) {
            logger.error('Error in removefromwishlist prefix command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Error')
                .setDescription('An error occurred while searching your wishlist. Please try again later.')
                .setTimestamp();

            await message.reply({ embeds: [errorEmbed] });

            // Log command usage with error
            await database.logCommandUsage(
                message.author.id,
                message.author.username,
                'removefromwishlist',
                { searchTerm: args.join(' ') },
                message.guildId,
                message.guild?.name,
                Date.now() - startTime,
                false,
                error.message
            );
        }
    },

    async removeSingleItem(message, item, startTime) {
        try {
            const userId = message.author.id;
            
            // Remove from database
            const removed = await database.removeFromWishlist(userId, item.item_name);
            
            if (removed) {
                const successEmbed = new EmbedBuilder()
                    .setColor('#2ECC71')
                    .setTitle('✅ Removed from Wishlist')
                    .setDescription(`**${item.item_name}** has been removed from your wishlist!`)
                    .setThumbnail(item.item_icon_url || null)
                    .addFields(
                        { name: 'Type', value: item.item_type || 'Unknown', inline: true },
                        { name: 'Rarity', value: item.item_rarity || 'Unknown', inline: true },
                        { name: 'Was Added', value: new Date(item.added_at).toLocaleDateString(), inline: true }
                    )
                    .setFooter({ text: 'Use !mywishlist to view your remaining wishlist items' })
                    .setTimestamp();

                await message.reply({ embeds: [successEmbed] });

                // Log user interaction
                await database.logUserInteraction(
                    userId,
                    message.author.username,
                    'command',
                    { 
                        action: 'remove_wishlist_item',
                        itemName: item.item_name
                    },
                    message.guildId
                );

            } else {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('❌ Error')
                    .setDescription('Failed to remove item from wishlist. It may have already been removed.')
                    .setTimestamp();

                await message.reply({ embeds: [errorEmbed] });
            }

        } catch (error) {
            logger.error('Error removing single item from wishlist:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Error')
                .setDescription('An error occurred while removing the item from your wishlist.')
                .setTimestamp();

            await message.reply({ embeds: [errorEmbed] });
            throw error;
        }
    },

    async showRemovalSelection(message, matchingItems, searchTerm) {
        try {
            // Create embed showing all matching items
            const selectionEmbed = new EmbedBuilder()
                .setColor('#F39C12')
                .setTitle('🗑️ Multiple Items Found')
                .setDescription(
                    `Found **${matchingItems.length}** items in your wishlist matching **"${searchTerm}"**\n\n` +
                    'Click a button below to remove an item from your wishlist:'
                )
                .setTimestamp();

            // Add fields for each item (show first 10 in embed)
            const itemsToShow = matchingItems.slice(0, 10);
            for (const item of itemsToShow) {
                const price = item.item_price ? `${item.item_price.toLocaleString()} V-Bucks` : 'Unknown';
                const dateAdded = new Date(item.added_at).toLocaleDateString();

                selectionEmbed.addFields({
                    name: item.item_name,
                    value: 
                        `**Type:** ${item.item_type || 'Unknown'} | **Rarity:** ${item.item_rarity || 'Unknown'}\n` +
                        `**Price:** ${price} | **Added:** ${dateAdded}`,
                    inline: false
                });
            }

            if (matchingItems.length > 10) {
                selectionEmbed.setFooter({ text: `Showing first 10 of ${matchingItems.length} items. All items available in buttons below.` });
            }

            // Create buttons for all matching items (up to 25)
            const components = [];
            let currentRow = new ActionRowBuilder();
            
            for (let i = 0; i < Math.min(matchingItems.length, 25); i++) {
                if (i % 5 === 0 && i > 0) {
                    components.push(currentRow);
                    currentRow = new ActionRowBuilder();
                }

                const item = matchingItems[i];
                const encodedItemName = Buffer.from(item.item_name).toString('base64');
                const userId = message.author.id;

                const buttonLabel = item.item_name.length > 75 ? 
                    item.item_name.substring(0, 72) + '...' : 
                    item.item_name;

                currentRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`wishlist_remove_confirm_${userId}_${encodedItemName}`)
                        .setLabel(`🗑️ ${buttonLabel}`)
                        .setStyle(ButtonStyle.Danger)
                );
            }

            if (currentRow.components.length > 0) {
                components.push(currentRow);
            }

            await message.reply({ embeds: [selectionEmbed], components });

        } catch (error) {
            logger.error('Error showing removal selection:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Error')
                .setDescription('An error occurred while displaying the matching items.')
                .setTimestamp();

            await message.reply({ embeds: [errorEmbed] });
            throw error;
        }
    }
};