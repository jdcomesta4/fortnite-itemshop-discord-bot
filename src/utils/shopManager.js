const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const apiClient = require('./apiClient');
const logger = require('./logger');
const database = require('./database');

class ShopManager {
    constructor() {
        this.currentShop = null;
        this.lastFetch = null;
        this.activeInteractions = new Map(); // Track active pagination sessions
        this.maxSessions = 100; // Maximum number of active sessions
        this.cleanupInterval = setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000); // Cleanup every 5 minutes
    }

    async fetchShopData(force = false) {
        try {
            // Check if we have recent data and don't need to force refresh
            if (!force && this.currentShop && this.lastFetch && 
                Date.now() - this.lastFetch < 6 * 60 * 60 * 1000) { // 6 hours
                logger.shop('Using cached shop data');
                return this.currentShop;
            }

            logger.shop('Fetching fresh shop data from API');
            const startTime = Date.now();
            
            const shopData = await apiClient.getShop();
            const responseTime = Date.now() - startTime;

            // Process shop data
            const processedShop = await this.processShopData(shopData.data);
            
            this.currentShop = processedShop;
            this.lastFetch = Date.now();

            // Log to database
            await database.logShopHistory(
                new Date().toISOString().split('T')[0],
                processedShop.totalItems,
                processedShop.sections.length,
                processedShop.sections,
                responseTime
            );

            logger.shop(`Shop data fetched successfully. ${processedShop.totalItems} items in ${processedShop.sections.length} sections`);
            return processedShop;

        } catch (error) {
            logger.error('Failed to fetch shop data:', error);
            
            // Return cached data if available
            if (this.currentShop) {
                logger.warn('Returning cached shop data due to API failure');
                return this.currentShop;
            }
            
            throw error;
        }
    }

    async processShopData(shopData) {
        try {
            const sections = shopData.sections || [];
            let totalItems = 0;
            const processedSections = [];

            // Process each section
            for (const section of sections) {
                if (!section.items || section.items.length === 0) continue;

                logger.shop(`Processing section: ${section.displayName} (${section.items.length} items)`);
                
                // Get item details for this section
                const itemDetails = await apiClient.getItemDetails(section.items);
                const validItems = [];

                for (const itemResponse of itemDetails) {
                    if (itemResponse?.data?.[0]) {
                        validItems.push(itemResponse.data[0]);
                    }
                }

                if (validItems.length > 0) {
                    processedSections.push({
                        ...section,
                        itemDetails: validItems
                    });
                    totalItems += validItems.length;
                }
            }

            return {
                date: shopData.date,
                sections: processedSections,
                totalItems,
                lastUpdated: new Date(),
                raw: shopData
            };

        } catch (error) {
            logger.error('Failed to process shop data:', error);
            throw error;
        }
    }

    createShopEmbeds(shopData, currentSection = 0, currentPage = 0) {
        const embeds = [];
        const section = shopData.sections[currentSection];
        
        if (!section) {
            return [this.createErrorEmbed('No shop section found')];
        }

        // Calculate pagination for items in this section
        const items = section.itemDetails || [];
        const maxItemsPerPage = 6; // Adjust based on Discord's 10 embed limit minus header
        const totalPages = Math.ceil(items.length / maxItemsPerPage);
        const startIndex = currentPage * maxItemsPerPage;
        const endIndex = Math.min(startIndex + maxItemsPerPage, items.length);
        const itemsToShow = items.slice(startIndex, endIndex);

        // Determine section display name with page number if needed
        let sectionDisplayName = section.displayName;
        if (totalPages > 1) {
            sectionDisplayName += ` (Page ${currentPage + 1}/${totalPages})`;
        }

        // Header embed
        const headerEmbed = new EmbedBuilder()
            .setTitle('🛍️ Fortnite Item Shop')
            .setDescription(`**${sectionDisplayName}**\nSection ${currentSection + 1} of ${shopData.sections.length}`)
            .setColor(0x00AE86)
            .setTimestamp()
            .setFooter({ 
                text: '', 
                iconURL: 'https://fnbr.co/favicon.ico' 
            });

        if (shopData.date) {
            headerEmbed.addFields([
                { name: '📅 Shop Date', value: new Date(shopData.date).toDateString(), inline: true },
                { name: '📊 Total Items', value: shopData.totalItems.toString(), inline: true },
                { name: '📦 Total Sections', value: shopData.sections.length.toString(), inline: true }
            ]);
        }

        // Add section info
        if (items.length > 0) {
            headerEmbed.addFields([
                { name: '🔢 Items in Section', value: `${items.length}`, inline: true },
                { name: '📄 Showing Items', value: `${startIndex + 1}-${endIndex}`, inline: true }
            ]);
        }

        embeds.push(headerEmbed);

        // Item embeds (only thumbnail, no large image, no description)
        for (const item of itemsToShow) {
            const itemEmbed = new EmbedBuilder()
                .setTitle(item.name)
                .setColor(apiClient.getRarityColor(item.rarity))
                .setThumbnail(item.images?.icon || null) // Only keep the small thumbnail
                .addFields([
                    { name: '💎 Rarity', value: item.rarity?.charAt(0).toUpperCase() + item.rarity?.slice(1) || 'Unknown', inline: true },
                    { name: '🏷️ Type', value: item.readableType || item.type || 'Unknown', inline: true },
                    { name: '💰 Price', value: item.price ? `${item.price} V-Bucks` : 'Not Available', inline: true }
                ]);

            // Removed description and large image for shop display

            embeds.push(itemEmbed);
        }

        return embeds;
    }

    createNavigationButtons(currentSection, totalSections, sessionId, currentPage = 0, totalPages = 1) {
        const rows = [];
        
        // Section navigation row
        const sectionRow = new ActionRowBuilder();

        // First section button
        sectionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`shop_firstsec_${sessionId}`)
                .setLabel('⏮️ First Sec')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentSection === 0)
        );

        // Previous section button  
        sectionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`shop_prevsec_${sessionId}`)
                .setLabel('◀️ Prev Sec')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentSection === 0)
        );

        // Section indicator
        sectionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`shop_secinfo_${sessionId}`)
                .setLabel(`Sec ${currentSection + 1}/${totalSections}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        // Next section button
        sectionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`shop_nextsec_${sessionId}`)
                .setLabel('Next Sec ▶️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentSection >= totalSections - 1)
        );

        // Last section button
        sectionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`shop_lastsec_${sessionId}`)
                .setLabel('Last Sec ⏭️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentSection >= totalSections - 1)
        );

        rows.push(sectionRow);

        // Page navigation row (only if there are multiple pages in current section)
        if (totalPages > 1) {
            const pageRow = new ActionRowBuilder();

            // First page button
            pageRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`shop_firstpage_${sessionId}`)
                    .setLabel('⏮️ First Page')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0)
            );

            // Previous page button
            pageRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`shop_prevpage_${sessionId}`)
                    .setLabel('◀️ Prev Page')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(currentPage === 0)
            );

            // Page indicator
            pageRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`shop_pageinfo_${sessionId}`)
                    .setLabel(`Page ${currentPage + 1}/${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

            // Next page button
            pageRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`shop_nextpage_${sessionId}`)
                    .setLabel('Next Page ▶️')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(currentPage >= totalPages - 1)
            );

            // Last page button
            pageRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`shop_lastpage_${sessionId}`)
                    .setLabel('Last Page ⏭️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage >= totalPages - 1)
            );

            rows.push(pageRow);
        }

        return rows;
    }

    refreshSessionTimeout(sessionId) {
        const sessionData = this.activeInteractions.get(sessionId);
        if (sessionData) {
            // Clear any existing timeout for this session
            if (sessionData.timeoutId) {
                clearTimeout(sessionData.timeoutId);
            }
            
            // Set new timeout
            const sessionTimeout = 30 * 60 * 1000; // 30 minutes
            const timeoutId = setTimeout(() => {
                this.activeInteractions.delete(sessionId);
                logger.debug(`Cleaned up shop session after extended timeout: ${sessionId}`);
            }, sessionTimeout);
            
            // Update session with new timeout ID
            this.activeInteractions.set(sessionId, {
                ...sessionData,
                timeoutId
            });
        }
    }

    async handleButtonInteraction(interaction) {
        try {
            const [action, direction, sessionId] = interaction.customId.split('_');
            
            if (action !== 'shop') return false;

            await interaction.deferUpdate();

            // Get session data
            let sessionData = this.activeInteractions.get(sessionId);
            if (!sessionData) {
                // Try to recreate session with current shop data
                try {
                    const shopData = await this.fetchShopData();
                    if (shopData && shopData.sections && shopData.sections.length > 0) {
                        // Recreate session with timeout
                        const newSessionTimeout = 30 * 60 * 1000; // 30 minutes
                        const timeoutId = setTimeout(() => {
                            this.activeInteractions.delete(sessionId);
                            logger.debug(`Cleaned up recreated shop session: ${sessionId}`);
                        }, newSessionTimeout);
                        
                        sessionData = {
                            userId: interaction.user.id,
                            shopData,
                            currentSection: 0,
                            currentPage: 0,
                            startTime: Date.now(),
                            timeoutId
                        };
                        
                        this.activeInteractions.set(sessionId, sessionData);
                        
                        // Log session refresh but don't show to user
                        logger.debug(`Recreated expired session for user ${interaction.user.username}`);
                    } else {
                        await interaction.followUp({ 
                            content: '❌ This shop session has expired and shop data is unavailable. Please run the command again.', 
                            ephemeral: true 
                        });
                        return true;
                    }
                } catch (error) {
                    logger.error('Failed to recreate expired session:', error);
                    await interaction.followUp({ 
                        content: '❌ This shop session has expired. Please run the command again.', 
                        ephemeral: true 
                    });
                    return true;
                }
            }

            const { shopData, currentSection, currentPage = 0 } = sessionData;
            let newSection = currentSection;
            let newPage = currentPage;

            // Calculate total pages for current section
            const currentSectionItems = shopData.sections[currentSection]?.itemDetails || [];
            const maxItemsPerPage = 6;
            const totalPages = Math.ceil(currentSectionItems.length / maxItemsPerPage);

            // Handle navigation
            switch (direction) {
                case 'firstsec':
                    newSection = 0;
                    newPage = 0;
                    break;
                case 'prevsec':
                    newSection = Math.max(0, currentSection - 1);
                    newPage = 0;
                    break;
                case 'nextsec':
                    newSection = Math.min(shopData.sections.length - 1, currentSection + 1);
                    newPage = 0;
                    break;
                case 'lastsec':
                    newSection = shopData.sections.length - 1;
                    newPage = 0;
                    break;
                case 'firstpage':
                    newPage = 0;
                    break;
                case 'prevpage':
                    newPage = Math.max(0, currentPage - 1);
                    break;
                case 'nextpage':
                    newPage = Math.min(totalPages - 1, currentPage + 1);
                    break;
                case 'lastpage':
                    newPage = totalPages - 1;
                    break;
                case 'secinfo':
                case 'pageinfo':
                    return true; // Do nothing for info buttons
            }

            // If section changed, reset page to 0
            if (newSection !== currentSection) {
                newPage = 0;
            }

            // Update session with refreshed timeout
            const updatedSessionData = {
                ...sessionData,
                currentSection: newSection,
                currentPage: newPage,
                lastInteraction: Date.now()
            };
            
            this.activeInteractions.set(sessionId, updatedSessionData);
            
            // Extend session timeout for active users
            this.refreshSessionTimeout(sessionId);

            // Calculate new page data
            const newSectionItems = shopData.sections[newSection]?.itemDetails || [];
            const newTotalPages = Math.ceil(newSectionItems.length / maxItemsPerPage);

            // Create new embeds and buttons
            const embeds = this.createShopEmbeds(shopData, newSection, newPage);
            const components = this.createNavigationButtons(newSection, shopData.sections.length, sessionId, newPage, newTotalPages);

            await interaction.editReply({
                embeds,
                components
            });

            // Log interaction
            await database.logUserInteraction(
                interaction.user.id,
                interaction.user.username,
                'button',
                { action: 'shop_navigation', direction, section: newSection, page: newPage },
                interaction.guildId,
                sessionId
            );

            logger.interaction(`User ${interaction.user.username} navigated to section ${newSection + 1}, page ${newPage + 1}`);
            return true;

        } catch (error) {
            logger.error('Error handling shop button interaction:', error);
            await interaction.followUp({ 
                content: '❌ An error occurred while navigating the shop.', 
                ephemeral: true 
            });
            return true;
        }
    }

    async displayShop(interaction, sectionIndex = 0) {
        try {
            const startTime = Date.now();
            
            // Show loading message
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: '🔄 Loading shop data...', embeds: [], components: [] });
            } else {
                await interaction.reply({ content: '🔄 Loading shop data...', ephemeral: false });
            }

            // Fetch shop data
            const shopData = await this.fetchShopData();
            
            if (!shopData || !shopData.sections || shopData.sections.length === 0) {
                await interaction.editReply({
                    content: '❌ No shop data available at the moment. Please try again later.',
                    embeds: [],
                    components: []
                });
                return;
            }

            // Validate section index
            if (sectionIndex >= shopData.sections.length) {
                sectionIndex = 0;
            }

            // Enforce session limits before creating new session
            this.enforceSessionLimit();

            // Create session
            const sessionId = `${interaction.user.id}_${Date.now()}`;
            const sessionTimeout = 30 * 60 * 1000; // 30 minutes

            // Auto-cleanup session
            const timeoutId = setTimeout(() => {
                this.activeInteractions.delete(sessionId);
                logger.debug(`Cleaned up shop session: ${sessionId}`);
            }, sessionTimeout);

            this.activeInteractions.set(sessionId, {
                userId: interaction.user.id,
                shopData,
                currentSection: sectionIndex,
                currentPage: 0,
                startTime: Date.now(),
                timeoutId
            });

            // Calculate pagination info for initial display
            const sectionItems = shopData.sections[sectionIndex]?.itemDetails || [];
            const maxItemsPerPage = 6;
            const totalPages = Math.ceil(sectionItems.length / maxItemsPerPage);

            // Create embeds and buttons
            const embeds = this.createShopEmbeds(shopData, sectionIndex, 0);
            const components = this.createNavigationButtons(sectionIndex, shopData.sections.length, sessionId, 0, totalPages);

            await interaction.editReply({
                content: '',
                embeds,
                components
            });

            const executionTime = Date.now() - startTime;
            
            // Log command usage
            await database.logCommandUsage(
                interaction.user.id,
                interaction.user.username,
                'showcurrentitemshop',
                { section: sectionIndex },
                interaction.guildId,
                interaction.guild?.name,
                executionTime,
                true
            );

            logger.command(`Shop displayed for ${interaction.user.username} in ${executionTime}ms`);

        } catch (error) {
            logger.error('Error displaying shop:', error);
            
            const errorEmbed = this.createErrorEmbed('Failed to load shop data. Please try again later.');
            
            await interaction.editReply({
                content: '',
                embeds: [errorEmbed],
                components: []
            });

            // Log error
            await database.logCommandUsage(
                interaction.user.id,
                interaction.user.username,
                'showcurrentitemshop',
                { section: sectionIndex },
                interaction.guildId,
                interaction.guild?.name,
                0,
                false,
                error.message
            );
        }
    }

    createErrorEmbed(message) {
        return new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription(message)
            .setColor(0xFF0000)
            .setTimestamp()
            .setFooter({ text: 'JD' });
    }

    async postDailyShop(client) {
        try {
            logger.shop('Starting daily shop post across all configured guilds...');
            
            // Get all guild configurations with shop channels
            const guildConfigs = await database.getAllGuildConfigs();
            
            if (guildConfigs.length === 0) {
                logger.warn('No guilds configured for daily shop posting');
                return;
            }

            // Fetch fresh shop data once for all guilds
            const shopData = await this.fetchShopData(true);
            
            if (!shopData || !shopData.sections || shopData.sections.length === 0) {
                logger.error('No shop data available for daily post');
                return;
            }

            // Calculate pagination info for initial display
            const sectionItems = shopData.sections[0]?.itemDetails || [];
            const maxItemsPerPage = 6;
            const totalPages = Math.ceil(sectionItems.length / maxItemsPerPage);

            let successCount = 0;
            let failureCount = 0;

            // Post to each configured guild
            for (const config of guildConfigs) {
                try {
                    const channel = await client.channels.fetch(config.shop_channel_id);
                    if (!channel) {
                        logger.warn(`Could not find shop channel with ID: ${config.shop_channel_id} in guild ${config.guild_name}`);
                        failureCount++;
                        continue;
                    }

                    // Create initial message
                    const embeds = this.createShopEmbeds(shopData, 0, 0);
                    const sessionId = `daily_${config.guild_id}_${Date.now()}`;
                    const components = this.createNavigationButtons(0, shopData.sections.length, sessionId, 0, totalPages);

                    // Create session for daily post
                    this.activeInteractions.set(sessionId, {
                        userId: 'system',
                        shopData,
                        currentSection: 0,
                        currentPage: 0,
                        startTime: Date.now(),
                        isDailyPost: true,
                        guildId: config.guild_id
                    });

                    // Send message
                    const message = await channel.send({
                        content: '🌅 **Daily Item Shop Update**',
                        embeds,
                        components
                    });

                    logger.shop(`Daily shop posted successfully to ${channel.name} in ${config.guild_name}. Message ID: ${message.id}`);
                    successCount++;

                    // Small delay between posts to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 500));

                } catch (error) {
                    logger.error(`Failed to post daily shop to guild ${config.guild_name} (${config.guild_id}):`, error);
                    failureCount++;
                    
                    await database.logError(
                        'daily_shop_post_guild',
                        error.message,
                        error.stack,
                        { 
                            guildId: config.guild_id,
                            guildName: config.guild_name,
                            channelId: config.shop_channel_id
                        },
                        null,
                        config.guild_id,
                        null,
                        'high'
                    );
                }
            }

            // Update database to mark as posted
            await database.logShopHistory(
                new Date().toISOString().split('T')[0],
                shopData.totalItems,
                shopData.sections.length,
                shopData.sections,
                null,
                true
            );

            logger.shop(`Daily shop posting completed. Success: ${successCount}, Failures: ${failureCount}, Total Guilds: ${guildConfigs.length}`);

        } catch (error) {
            logger.error('Failed to post daily shop:', error);
            
            await database.logError(
                'daily_shop_post',
                error.message,
                error.stack,
                { totalGuilds: guildConfigs?.length || 0 },
                null,
                null,
                null,
                'high'
            );
        }
    }

    getShopStats() {
        if (!this.currentShop) return null;

        return {
            totalItems: this.currentShop.totalItems,
            totalSections: this.currentShop.sections.length,
            lastUpdated: this.lastFetch,
            activeSessions: this.activeInteractions.size,
            sections: this.currentShop.sections.map(section => ({
                name: section.displayName,
                itemCount: section.itemDetails?.length || 0
            }))
        };
    }

    cleanupExpiredSessions() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [sessionId, sessionData] of this.activeInteractions.entries()) {
            // Clean up sessions older than 45 minutes
            if (now - sessionData.startTime > 45 * 60 * 1000) {
                if (sessionData.timeoutId) {
                    clearTimeout(sessionData.timeoutId);
                }
                this.activeInteractions.delete(sessionId);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            logger.debug(`Cleaned up ${cleaned} expired shop sessions`);
        }
    }

    enforceSessionLimit() {
        if (this.activeInteractions.size >= this.maxSessions) {
            // Remove oldest sessions
            const sessions = Array.from(this.activeInteractions.entries())
                .sort((a, b) => a[1].startTime - b[1].startTime);
            
            const toRemove = sessions.slice(0, sessions.length - this.maxSessions + 10);
            
            for (const [sessionId, sessionData] of toRemove) {
                if (sessionData.timeoutId) {
                    clearTimeout(sessionData.timeoutId);
                }
                this.activeInteractions.delete(sessionId);
            }
            
            logger.debug(`Enforced session limit, removed ${toRemove.length} oldest sessions`);
        }
    }

    clearCache() {
        // Clean up all active session timeouts
        for (const [sessionId, sessionData] of this.activeInteractions.entries()) {
            if (sessionData.timeoutId) {
                clearTimeout(sessionData.timeoutId);
            }
        }
        
        this.currentShop = null;
        this.lastFetch = null;
        this.activeInteractions.clear();
        
        // Clear cleanup interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        logger.shop('Shop cache and active sessions cleared');
    }
}

module.exports = new ShopManager();
