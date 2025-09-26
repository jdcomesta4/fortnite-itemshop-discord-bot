const { EmbedBuilder } = require('discord.js');
const apiClient = require('../../utils/apiClient');
const permissionManager = require('../../utils/permissionManager');
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
            
            // Parse arguments more intelligently
            // Check if last arg is a valid rarity
            const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'transcendent', 'exotic', 'gaming', 'shadow', 'lava', 'frozen', 'marvel', 'dc', 'starwars', 'icon'];
            const validTypes = ['outfit', 'backpack', 'pickaxe', 'glider', 'emote', 'wrap', 'loading', 'music', 'pet', 'spray', 'toy', 'banner', 'emoticon', 'contrail', 'lego-outfit', 'lego-kit'];
            
            let searchName, searchType, searchRarity;
            
            // Check if last argument is a valid rarity
            const lastArg = args[args.length - 1]?.toLowerCase();
            const secondLastArg = args[args.length - 2]?.toLowerCase();
            
            if (validRarities.includes(lastArg)) {
                searchRarity = lastArg;
                // Check if second to last is a valid type
                if (args.length > 2 && validTypes.includes(secondLastArg)) {
                    searchType = secondLastArg;
                    searchName = args.slice(0, -2).join(' ');
                } else {
                    searchName = args.slice(0, -1).join(' ');
                }
            } else if (validTypes.includes(lastArg)) {
                searchType = lastArg;
                searchName = args.slice(0, -1).join(' ');
            } else {
                // No valid type or rarity found, treat all as name
                searchName = args.join(' ');
            }
            
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
                    .setFooter({ text: 'JD' });
                
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
                    .setFooter({ text: 'JD' });
                
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
                    .setFooter({ text: 'JD' });
                
                await loadingMessage.edit({ content: '', embeds: [tooManyEmbed] });
                
                const executionTime = Date.now() - startTime;
                await database.logSearchAnalytics(message.author.id, searchName, searchType, searchRarity, filteredResults.length, executionTime);
                
                return;
            }
            
            // Display results
            const embeds = [];
            for (let i = 0; i < Math.min(filteredResults.length, 10); i++) {
                const item = filteredResults[i];
                const shopStatus = await apiClient.checkItemInCurrentShop(item.id);
                const embed = await createDetailedItemEmbed(item, shopStatus, i + 1, filteredResults.length);
                embeds.push(embed);
            }
            
            await loadingMessage.edit({ content: '', embeds: embeds });
            
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

async function createDetailedItemEmbed(item, shopStatus = null, resultIndex = null, totalResults = null) {
    const embed = new EmbedBuilder()
        .setTitle(`🔍 ${item.name}`)
        .setColor(apiClient.getRarityColor(item.rarity))
        .setTimestamp();
    
    if (resultIndex && totalResults) {
        embed.setFooter({ text: `Result ${resultIndex}/${totalResults} • ` });
    } else {
        embed.setFooter({ text: 'JD' });
    }

    // Description
    if (item.description) {
        embed.setDescription(`*${item.description}*`);
    }

    // Basic fields
    const fields = [
        { name: '💎 Rarity', value: item.rarity?.charAt(0).toUpperCase() + item.rarity?.slice(1) || 'Unknown', inline: true },
        { name: '🏷️ Type', value: item.readableType || item.type || 'Unknown', inline: true },
        { name: '💰 Price', value: item.price ? `${item.price} V-Bucks` : 'Not Available', inline: true }
    ];

    // Shop availability status
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

    // Dates and history
    if (item.introduction) {
        fields.push({ name: '🆕 First Introduced', value: formatDate(item.introduction), inline: true });
    }

    if (item.firstReleaseDate && item.firstReleaseDate !== item.introduction) {
        fields.push({ name: '🚀 First Released', value: formatDate(item.firstReleaseDate), inline: true });
    }

    if (item.lastSeen && !shopStatus) {
        fields.push({ name: '👁️ Last Seen in Shop', value: formatDate(item.lastSeen), inline: true });
    }

    // Set information
    if (item.set?.text) {
        fields.push({ name: '📦 Set', value: item.set.text, inline: true });
    }

    // Built-in emote
    if (item.builtInEmote?.name) {
        fields.push({ name: '💃 Built-in Emote', value: item.builtInEmote.name, inline: true });
    }

    // Variants/styles
    if (item.variants && item.variants.length > 0) {
        const variantNames = item.variants
            .map(v => v.channel || 'Style')
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .slice(0, 2);
        if (variantNames.length > 0) {
            fields.push({ name: '🎨 Variants', value: variantNames.join(', '), inline: true });
        }
    }

    // Series information
    if (item.series?.backendValue) {
        fields.push({ name: '📚 Series', value: item.series.backendValue, inline: true });
    }

    // Shop history count
    if (item.shopHistory && Array.isArray(item.shopHistory)) {
        fields.push({ name: '📊 Shop Appearances', value: `${item.shopHistory.length} times`, inline: true });
    }

    // Add all fields to embed
    embed.addFields(fields);
    
    // Set main image - prioritize icon first, then featured, then gallery (only for single results to save space)
    if (!resultIndex || totalResults === 1) {
        if (item.images?.icon) {
            embed.setImage(item.images.icon);
        } else if (item.images?.featured) {
            embed.setImage(item.images.featured);
        } else if (item.images?.gallery) {
            embed.setImage(item.images.gallery);
        }
    }
    
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