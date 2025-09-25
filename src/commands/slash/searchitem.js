const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const apiClient = require('../../utils/apiClient');
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
            await interaction.deferReply();
            
            const searchName = interaction.options.getString('name');
            const searchType = interaction.options.getString('type');
            const searchRarity = interaction.options.getString('rarity');
            
            logger.command(`Searching items: name="${searchName}", type="${searchType}", rarity="${searchRarity}"`);
            
            // Search for items
            const searchResults = await apiClient.searchItems(searchName, searchType, 15);
            
            if (!searchResults?.data || searchResults.data.length === 0) {
                const noResultsEmbed = new EmbedBuilder()
                    .setTitle('🔍 Search Results')
                    .setDescription(`No items found matching **${searchName}**${searchType ? ` (${searchType})` : ''}${searchRarity ? ` (${searchRarity} rarity)` : ''}`)
                    .setColor(0xFF6B6B)
                    .setTimestamp()
                    .setFooter({ text: 'Powered by fnbr.co' });
                
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
                    .setFooter({ text: 'Powered by fnbr.co' });
                
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
                    .setFooter({ text: 'Powered by fnbr.co' });
                
                await interaction.editReply({ embeds: [tooManyEmbed] });
                
                const executionTime = Date.now() - startTime;
                await database.logSearchAnalytics(interaction.user.id, searchName, searchType, searchRarity, filteredResults.length, executionTime);
                
                return;
            }
            
            // Display results (1-5 items)
            if (filteredResults.length === 1) {
                // Single item - detailed view
                const item = filteredResults[0];
                const embed = createDetailedItemEmbed(item);
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

function createDetailedItemEmbed(item) {
    const embed = new EmbedBuilder()
        .setTitle(`🔍 ${item.name}`)
        .setColor(apiClient.getRarityColor(item.rarity))
        .setThumbnail(item.images?.icon || null)
        .addFields([
            { name: '💎 Rarity', value: item.rarity?.charAt(0).toUpperCase() + item.rarity?.slice(1) || 'Unknown', inline: true },
            { name: '🏷️ Type', value: item.readableType || item.type || 'Unknown', inline: true },
            { name: '💰 Price', value: item.price ? `${item.price} V-Bucks` : 'Not Available', inline: true },
            { name: '🆔 Item ID', value: `\`${item.id}\``, inline: true }
        ])
        .setTimestamp()
        .setFooter({ text: 'Powered by fnbr.co' });
    
    if (item.description) {
        embed.setDescription(item.description);
    }
    
    if (item.images?.featured) {
        embed.setImage(item.images.featured);
    }
    
    return embed;
}

async function displayMultipleItems(interaction, items, searchQuery) {
    const sessionId = `search_${interaction.user.id}_${Date.now()}`;
    let currentIndex = 0;
    
    const createEmbed = (index) => {
        const item = items[index];
        return createDetailedItemEmbed(item)
            .setTitle(`🔍 Search Results for "${searchQuery}" (${index + 1}/${items.length})`)
            .setDescription(item.description || `Showing result ${index + 1} of ${items.length}`);
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
    const embed = createEmbed(currentIndex);
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
            
            const newEmbed = createEmbed(currentIndex);
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
