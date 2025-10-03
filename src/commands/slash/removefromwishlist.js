const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const permissionManager = require('../../utils/permissionManager');
const database = require('../../utils/database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removefromwishlist')
        .setDescription('Remove an item from your wishlist')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The name of the item to remove')
                .setRequired(true)),
    
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

            const searchTerm = interaction.options.getString('name');
            const userId = interaction.user.id;

            await interaction.deferReply({ ephemeral: true });

            logger.command(`Removing item from wishlist: "${searchTerm}" by ${interaction.user.username}`);

            // Get user's wishlist items that match the search term
            const wishlistItems = await database.getUserWishlist(userId);
            
            if (wishlistItems.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setColor('#6C7B7F')
                    .setTitle('📋 Wishlist Empty')
                    .setDescription('Your wishlist is empty. Use `/addtowishlist` to add items!')
                    .setTimestamp();

                await interaction.editReply({ embeds: [emptyEmbed] });
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
                        'Make sure you spelled the item name correctly, or use `/mywishlist` to see all your items.'
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [noMatchEmbed] });
                return;
            }

            // If only one item matches, remove it directly
            if (matchingItems.length === 1) {
                await this.removeSingleItem(interaction, matchingItems[0], startTime);
                return;
            }

            // Multiple items match - show selection
            await this.showRemovalSelection(interaction, matchingItems, searchTerm);

            // Log command usage
            await database.logCommandUsage(
                interaction.user.id,
                interaction.user.username,
                'removefromwishlist',
                { searchTerm, matchCount: matchingItems.length },
                interaction.guildId,
                interaction.guild?.name,
                Date.now() - startTime,
                true
            );

        } catch (error) {
            logger.error('Error in removefromwishlist command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Error')
                .setDescription('An error occurred while searching your wishlist. Please try again later.')
                .setTimestamp();

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Log command usage with error
            await database.logCommandUsage(
                interaction.user.id,
                interaction.user.username,
                'removefromwishlist',
                { searchTerm: interaction.options.getString('name') },
                interaction.guildId,
                interaction.guild?.name,
                Date.now() - startTime,
                false,
                error.message
            );
        }
    },

    async removeSingleItem(interaction, item, startTime) {
        try {
            const userId = interaction.user.id;
            
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
                    .setFooter({ text: 'Use /mywishlist to view your remaining wishlist items' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

                // Log user interaction
                await database.logUserInteraction(
                    userId,
                    interaction.user.username,
                    'command',
                    { 
                        action: 'remove_wishlist_item',
                        itemName: item.item_name
                    },
                    interaction.guildId
                );

            } else {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('❌ Error')
                    .setDescription('Failed to remove item from wishlist. It may have already been removed.')
                    .setTimestamp();

                await interaction.editReply({ embeds: [errorEmbed] });
            }

        } catch (error) {
            logger.error('Error removing single item from wishlist:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Error')
                .setDescription('An error occurred while removing the item from your wishlist.')
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
            throw error;
        }
    },

    async showRemovalSelection(interaction, matchingItems, searchTerm) {
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
                const userId = interaction.user.id;

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

            await interaction.editReply({ embeds: [selectionEmbed], components });

        } catch (error) {
            logger.error('Error showing removal selection:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Error')
                .setDescription('An error occurred while displaying the matching items.')
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
            throw error;
        }
    }
};