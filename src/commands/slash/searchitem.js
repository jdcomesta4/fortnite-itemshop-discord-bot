const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const apiClient = require('../../utils/apiClient');
const permissionManager = require('../../utils/permissionManager');
const database = require('../../utils/database');
const logger = require('../../utils/logger');

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
        .setName('searchitem')
        .setDescription('Search for Fortnite items by name, type, and rarity')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Item name to search for')
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

            await interaction.deferReply();
            
            const searchName = interaction.options.getString('name');
            const searchType = interaction.options.getString('type');
            const searchRarity = interaction.options.getString('rarity');
            
            logger.command(`Searching items: name="${searchName}", type="${searchType}", rarity="${searchRarity}"`);
            
            // Search for items
            const searchResults = await apiClient.searchItems(searchName, searchType, 15);
            
            // Log API response for debugging
            if (searchResults?.data && searchResults.data.length > 0) {
                logger.debug(`Search API returned ${searchResults.data.length} results for "${searchName}"`);
            }
            
            if (!searchResults?.data || searchResults.data.length === 0) {
                const noResultsEmbed = new EmbedBuilder()
                    .setTitle('🔍 Search Results')
                    .setDescription(`No items found matching **${searchName}**${searchType ? ` (${searchType})` : ''}${searchRarity ? ` (${searchRarity} rarity)` : ''}`)
                    .setColor(0xFF6B6B)
                    .setTimestamp()
                    .setFooter({ text: 'JD' });
                
                await interaction.editReply({ embeds: [noResultsEmbed] });
                
                const executionTime = Date.now() - startTime;
                await database.logSearchAnalytics(interaction.user.id, searchName, searchType, searchRarity, 0, executionTime);
                
                return;
            }
            
            // Filter by rarity if specified
            let filteredResults = searchResults.data;
            if (searchRarity) {
                filteredResults = searchResults.data.filter(item => 
                    item.rarity?.toLowerCase() === searchRarity.toLowerCase()
                );
            }
            
            if (filteredResults.length === 0) {
                const noResultsEmbed = new EmbedBuilder()
                    .setTitle('🔍 Search Results')
                    .setDescription(`No items found matching **${searchName}** with **${searchRarity}** rarity${searchType ? ` (${searchType})` : ''}`)
                    .setColor(0xFF6B6B)
                    .setTimestamp()
                    .setFooter({ text: 'JD' });
                
                await interaction.editReply({ embeds: [noResultsEmbed] });
                
                const executionTime = Date.now() - startTime;
                await database.logSearchAnalytics(interaction.user.id, searchName, searchType, searchRarity, 0, executionTime);
                
                return;
            }
            
            // Handle results based on count
            if (filteredResults.length > 5) {
                const tooManyEmbed = new EmbedBuilder()
                    .setTitle('🔍 Too Many Results')
                    .setDescription(`Found **${filteredResults.length}** items matching **${searchName}**. Please be more specific with your search criteria.`)
                    .addFields([
                        { 
                            name: '💡 Suggestions', 
                            value: '• Add a type filter (outfit, pickaxe, etc.)\n• Add a rarity filter\n• Use a more specific item name' 
                        }
                    ])
                    .setColor(0xFFB347)
                    .setTimestamp()
                    .setFooter({ text: 'JD' });
                
                await interaction.editReply({ embeds: [tooManyEmbed] });
                
                const executionTime = Date.now() - startTime;
                await database.logSearchAnalytics(interaction.user.id, searchName, searchType, searchRarity, filteredResults.length, executionTime);
                
                return;
            }
            
            // Display results (1-5 items)
            if (filteredResults.length === 1) {
                // Single item - detailed view with shop check
                const item = filteredResults[0];
                const shopStatus = await apiClient.checkItemInCurrentShop(item.id);
                const embed = await createDetailedItemEmbed(item, shopStatus);
                await interaction.editReply({ embeds: [embed] });
            } else {
                // Multiple items - create pagination
                await displayMultipleItems(interaction, filteredResults, searchName);
            }
            
            const executionTime = Date.now() - startTime;
            await database.logSearchAnalytics(interaction.user.id, searchName, searchType, searchRarity, filteredResults.length, executionTime);
            
        } catch (error) {
            logger.error('Error in searchitem slash command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Search Error')
                .setDescription('Failed to search for items. Please try again later.')
                .setColor(0xFF0000)
                .setTimestamp();
            
            await interaction.editReply({ embeds: [errorEmbed] });
            
            const executionTime = Date.now() - startTime;
            await database.logSearchAnalytics(interaction.user.id, interaction.options.getString('name'), 
                interaction.options.getString('type'), interaction.options.getString('rarity'), 0, executionTime);
            
            throw error;
        }
    }
};

async function createDetailedItemEmbed(item, shopStatus = null) {
    console.log('=== Creating embed for item ===');
    console.log('Item name:', item.name);
    console.log('Available fields:', Object.keys(item));
    
    const embed = new EmbedBuilder()
        .setTitle(`🔍 ${item.name}`)
        .setColor(apiClient.getRarityColor(item.rarity))
        .setTimestamp()
        .setFooter({ text: 'JD' });
    
    // Description
    if (item.description) {
        embed.setDescription(`*${item.description}*`);
        console.log('Added description:', item.description);
    } else {
        console.log('No description available');
    }

    // Start with basic fields
    const fields = [];
    
    // Core information
    fields.push(
        { name: '💎 Rarity', value: item.rarity?.charAt(0).toUpperCase() + item.rarity?.slice(1) || 'Unknown', inline: true },
        { name: '🏷️ Type', value: item.readableType || item.type || 'Unknown', inline: true }
    );

    // Price - check multiple possible fields
    if (item.price) {
        const priceText = item.priceIcon === 'vbucks' || !item.priceIcon ? 
            `${item.price} V-Bucks` : 
            `${item.price} ${item.priceIcon}`;
        fields.push({ name: '💰 Price', value: priceText, inline: true });
        console.log('Added price:', priceText);
    } else {
        fields.push({ name: '💰 Price', value: 'Not Available', inline: true });
        console.log('No price available');
    }

    // Shop status
    if (shopStatus) {
        if (shopStatus.inShop) {
            fields.push({ 
                name: '🛍️ Shop Status', 
                value: `✅ **Available Now!**\nIn section: ${shopStatus.sectionName}`, 
                inline: false 
            });
        } else {
            const lastSeenText = item.lastSeen ? formatDate(item.lastSeen) : 'Unknown';
            fields.push({ 
                name: '🛍️ Shop Status', 
                value: `❌ **Not in today's shop**\nLast seen: ${lastSeenText}`, 
                inline: false 
            });
        }
    }

    // Release information
    if (item.introduction) {
        fields.push({ name: '🆕 First Introduced', value: formatDate(item.introduction), inline: true });
        console.log('Added introduction date:', item.introduction);
    }

    if (item.firstReleaseDate && item.firstReleaseDate !== item.introduction) {
        fields.push({ name: '🚀 First Released', value: formatDate(item.firstReleaseDate), inline: true });
    }

    // Last seen (if not covered by shop status)
    if (item.lastSeen && !shopStatus) {
        fields.push({ name: '👁️ Last Seen', value: formatDate(item.lastSeen), inline: true });
        console.log('Added last seen:', item.lastSeen);
    }

    // Set information
    if (item.set) {
        let setValue = '';
        if (typeof item.set === 'string') {
            setValue = item.set;
        } else if (item.set.text) {
            setValue = item.set.text;
        } else if (item.set.backendValue) {
            setValue = item.set.backendValue;
        }
        if (setValue) {
            fields.push({ name: '📦 Set', value: setValue, inline: true });
            console.log('Added set:', setValue);
        }
    }

    // Series information
    if (item.series) {
        let seriesValue = '';
        if (typeof item.series === 'string') {
            seriesValue = item.series;
        } else if (item.series.text) {
            seriesValue = item.series.text;
        } else if (item.series.backendValue) {
            seriesValue = item.series.backendValue;
        }
        if (seriesValue) {
            fields.push({ name: '📚 Series', value: seriesValue, inline: true });
            console.log('Added series:', seriesValue);
        }
    }

    // Built-in emote
    if (item.builtInEmote) {
        const emoteName = item.builtInEmote.name || 'Available';
        fields.push({ name: '💃 Built-in Emote', value: emoteName, inline: true });
        console.log('Added built-in emote:', emoteName);
    }

    // Variants
    if (item.variants && Array.isArray(item.variants) && item.variants.length > 0) {
        const variantCount = item.variants.length;
        const channels = [...new Set(item.variants.map(v => v.channel || 'Style'))];
        const variantText = channels.length > 1 ? 
            `${variantCount} variants (${channels.slice(0, 2).join(', ')})` :
            `${variantCount} ${channels[0] || 'variants'}`;
        fields.push({ name: '🎨 Variants', value: variantText, inline: true });
        console.log('Added variants:', variantText);
    }

    // Shop history
    if (item.shopHistory && Array.isArray(item.shopHistory)) {
        fields.push({ name: '📊 Shop Appearances', value: `${item.shopHistory.length} times`, inline: true });
        console.log('Added shop history count:', item.shopHistory.length);
    }

    // LEGO compatibility
    if (item.legoAssoc !== undefined) {
        fields.push({ name: '🧱 LEGO Compatible', value: item.legoAssoc ? '✅ Yes' : '❌ No', inline: true });
    }

    // Special properties
    if (item.reactive) {
        fields.push({ name: '⚡ Reactive', value: '✅ Yes', inline: true });
    }

    if (item.traversal) {
        fields.push({ name: '🏃 Traversal', value: '✅ Yes', inline: true });
    }

    // Gameplay tags (filtered and cleaned)
    if (item.gameplayTags && Array.isArray(item.gameplayTags) && item.gameplayTags.length > 0) {
        const filteredTags = item.gameplayTags
            .filter(tag => {
                const lowerTag = tag.toLowerCase();
                return !lowerTag.includes('athena.') && 
                       !lowerTag.includes('cosmetics.') &&
                       !lowerTag.includes('frontend.') &&
                       !lowerTag.includes('source.');
            })
            .map(tag => tag.replace(/^[A-Za-z]+\./, '').replace(/_/g, ' '))
            .slice(0, 3);
            
        if (filteredTags.length > 0) {
            fields.push({ name: '🏷️ Tags', value: filteredTags.join(', '), inline: false });
            console.log('Added tags:', filteredTags.join(', '));
        }
    }

    // Add all fields to embed
    embed.addFields(fields);
    
    // Set main image - prioritize icon first, then featured, then gallery
    if (item.images?.icon) {
        embed.setImage(item.images.icon);
        console.log('Added icon image as main image');
    } else if (item.images?.featured) {
        embed.setImage(item.images.featured);
        console.log('Added featured image as main image');
    } else if (item.images?.gallery) {
        embed.setImage(item.images.gallery);
        console.log('Added gallery image as main image');
    }
    
    console.log('Total fields added:', fields.length);
    console.log('=== End embed creation ===');
    
    return embed;
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        const formattedDate = date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        // Add relative time for recent dates
        if (diffDays === 0) {
            return `${formattedDate} (Today)`;
        } else if (diffDays === 1) {
            return `${formattedDate} (Yesterday)`;
        } else if (diffDays < 7) {
            return `${formattedDate} (${diffDays} days ago)`;
        } else if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `${formattedDate} (${weeks} week${weeks > 1 ? 's' : ''} ago)`;
        }
        
        return formattedDate;
    } catch (error) {
        return 'Unknown';
    }
}

async function displayMultipleItems(interaction, items, searchQuery) {
    const sessionId = `search_${interaction.user.id}_${Date.now()}`;
    let currentIndex = 0;
    
    const createEmbed = async (index) => {
        const item = items[index];
        const shopStatus = await apiClient.checkItemInCurrentShop(item.id);
        const embed = await createDetailedItemEmbed(item, shopStatus);
        return embed.setTitle(`🔍 Search Results for "${searchQuery}" (${index + 1}/${items.length})`);
    };
    
    const createButtons = (index) => {
        const row = new ActionRowBuilder();
        
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`search_first_${sessionId}`)
                .setLabel('⏮️ First')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(index === 0)
        );
        
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`search_prev_${sessionId}`)
                .setLabel('◀️ Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(index === 0)
        );
        
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`search_info_${sessionId}`)
                .setLabel(`${index + 1}/${items.length}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );
        
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`search_next_${sessionId}`)
                .setLabel('Next ▶️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(index >= items.length - 1)
        );
        
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`search_last_${sessionId}`)
                .setLabel('Last ⏭️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(index >= items.length - 1)
        );
        
        return [row];
    };
    
    // Send initial message
    const embed = await createEmbed(currentIndex);
    const components = createButtons(currentIndex);
    
    await interaction.editReply({ embeds: [embed], components });
    
    // Create collector for button interactions
    const collector = interaction.channel.createMessageComponentCollector({
        filter: i => i.customId.includes(sessionId) && i.user.id === interaction.user.id,
        time: 300000 // 5 minutes
    });
    
    collector.on('collect', async (buttonInteraction) => {
        try {
            await buttonInteraction.deferUpdate();
            
            const [action, direction] = buttonInteraction.customId.split('_');
            
            switch (direction) {
                case 'first':
                    currentIndex = 0;
                    break;
                case 'prev':
                    currentIndex = Math.max(0, currentIndex - 1);
                    break;
                case 'next':
                    currentIndex = Math.min(items.length - 1, currentIndex + 1);
                    break;
                case 'last':
                    currentIndex = items.length - 1;
                    break;
                case 'info':
                    return; // Do nothing for info button
            }
            
            const newEmbed = await createEmbed(currentIndex);
            const newComponents = createButtons(currentIndex);
            
            await buttonInteraction.editReply({ embeds: [newEmbed], components: newComponents });
            
            // Log interaction
            await database.logUserInteraction(
                buttonInteraction.user.id,
                buttonInteraction.user.username,
                'button',
                { action: 'search_navigation', direction, itemIndex: currentIndex },
                buttonInteraction.guildId,
                sessionId
            );
            
        } catch (error) {
            logger.error('Error handling search button interaction:', error);
        }
    });
    
    collector.on('end', async () => {
        try {
            // Disable all buttons when collector expires
            const disabledComponents = createButtons(currentIndex);
            disabledComponents[0].components.forEach(button => button.setDisabled(true));
            
            await interaction.editReply({ components: disabledComponents });
        } catch (error) {
            logger.debug('Could not disable buttons after collector timeout:', error.message);
        }
    });
}