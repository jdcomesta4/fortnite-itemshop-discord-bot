const { EmbedBuilder } = require('discord.js');
const apiClient = require('../../utils/apiClient');
const database = require('../../utils/database');
const logger = require('../../utils/logger');

module.exports = {
    name: 'searchitem',
    description: 'Search for Fortnite items by name',
    usage: 'searchitem <name> [type] [rarity]',
    aliases: ['search', 'item'],
    
    async execute(message, args) {
        const startTime = Date.now();
        
        try {
            if (args.length === 0) {
                const helpEmbed = new EmbedBuilder()
                    .setTitle('🔍 Search Item Command')
                    .setDescription('Search for Fortnite items by name, type, and rarity')
                    .addFields([
                        { name: 'Usage', value: `\`${process.env.PREFIX || 'jd!'}searchitem <name> [type] [rarity]\``, inline: false },
                        { name: 'Examples', value: `\`${process.env.PREFIX || 'jd!'}searchitem ghoul trooper\`\n\`${process.env.PREFIX || 'jd!'}searchitem raven outfit\`\n\`${process.env.PREFIX || 'jd!'}searchitem drift epic\``, inline: false },
                        { name: 'Valid Types', value: 'outfit, backpack, pickaxe, glider, emote, wrap, etc.', inline: false },
                        { name: 'Valid Rarities', value: 'common, uncommon, rare, epic, legendary, mythic', inline: false }
                    ])
                    .setColor(0x00AE86)
                    .setTimestamp();
                
                await message.reply({ embeds: [helpEmbed] });
                return;
            }
            
            const searchName = args[0];
            const searchType = args[1]?.toLowerCase();
            const searchRarity = args[2]?.toLowerCase();
            
            logger.command(`Prefix search: name="${searchName}", type="${searchType}", rarity="${searchRarity}"`);
            
            const loadingMessage = await message.reply('🔄 Searching for items...');
            
            // Search for items
            const searchResults = await apiClient.searchItems(searchName, searchType, 15);
            
            if (!searchResults?.data || searchResults.data.length === 0) {
                const noResultsEmbed = new EmbedBuilder()
                    .setTitle('🔍 Search Results')
                    .setDescription(`No items found matching **${searchName}**${searchType ? ` (${searchType})` : ''}${searchRarity ? ` (${searchRarity} rarity)` : ''}`)
                    .setColor(0xFF6B6B)
                    .setTimestamp()
                    .setFooter({ text: 'Powered by fnbr.co' });
                
                await loadingMessage.edit({ content: '', embeds: [noResultsEmbed] });
                
                const executionTime = Date.now() - startTime;
                await database.logSearchAnalytics(message.author.id, searchName, searchType, searchRarity, 0, executionTime);
                
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
                
                await loadingMessage.edit({ content: '', embeds: [noResultsEmbed] });
                
                const executionTime = Date.now() - startTime;
                await database.logSearchAnalytics(message.author.id, searchName, searchType, searchRarity, 0, executionTime);
                
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
                            value: `• Use \`${process.env.PREFIX || 'jd!'}searchitem ${searchName} [type]\`\n• Use \`${process.env.PREFIX || 'jd!'}searchitem ${searchName} [type] [rarity]\`\n• Use a more specific item name` 
                        }
                    ])
                    .setColor(0xFFB347)
                    .setTimestamp()
                    .setFooter({ text: 'Powered by fnbr.co' });
                
                await loadingMessage.edit({ content: '', embeds: [tooManyEmbed] });
                
                const executionTime = Date.now() - startTime;
                await database.logSearchAnalytics(message.author.id, searchName, searchType, searchRarity, filteredResults.length, executionTime);
                
                return;
            }
            
            // Display results
            const embeds = filteredResults.map((item, index) => {
                const embed = new EmbedBuilder()
                    .setTitle(`🔍 ${item.name}`)
                    .setColor(apiClient.getRarityColor(item.rarity))
                    .setThumbnail(item.images?.icon || null)
                    .addFields([
                        { name: '💎 Rarity', value: item.rarity?.charAt(0).toUpperCase() + item.rarity?.slice(1) || 'Unknown', inline: true },
                        { name: '🏷️ Type', value: item.readableType || item.type || 'Unknown', inline: true },
                        { name: '💰 Price', value: item.price ? `${item.price} V-Bucks` : 'Not Available', inline: true }
                    ])
                    .setTimestamp()
                    .setFooter({ text: `Result ${index + 1}/${filteredResults.length} • Powered by fnbr.co` });
                
                if (item.description) {
                    embed.setDescription(item.description);
                }
                
                if (item.images?.featured) {
                    embed.setImage(item.images.featured);
                }
                
                return embed;
            });
            
            if (embeds.length === 1) {
                await loadingMessage.edit({ content: '', embeds: [embeds[0]] });
            } else {
                // Send multiple embeds (Discord allows up to 10 per message)
                await loadingMessage.edit({ content: '', embeds: embeds.slice(0, 10) });
            }
            
            const executionTime = Date.now() - startTime;
            await database.logSearchAnalytics(message.author.id, searchName, searchType, searchRarity, filteredResults.length, executionTime);
            
        } catch (error) {
            logger.error('Error in searchitem prefix command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Search Error')
                .setDescription('Failed to search for items. Please try again later.')
                .setColor(0xFF0000)
                .setTimestamp();
            
            await message.reply({ embeds: [errorEmbed] });
            
            const executionTime = Date.now() - startTime;
            await database.logSearchAnalytics(message.author.id, args[0] || 'unknown', args[1], args[2], 0, executionTime);
            
            throw error;
        }
    }
};
