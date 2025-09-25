const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const apiClient = require('./apiClient');
const logger = require('./logger');
const database = require('./database');

class ShopManager {
    constructor() {
        this.currentShop = null;
        this.lastFetch = null;
        this.activeInteractions = new Map(); // Track active pagination sessions
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

    createShopEmbeds(shopData, currentSection = 0) {
        const embeds = [];
        const section = shopData.sections[currentSection];
        
        if (!section) {
            return [this.createErrorEmbed('No shop section found')];
        }

        // Header embed
        const headerEmbed = new EmbedBuilder()
            .setTitle('🛍️ Fortnite Item Shop')
            .setDescription(`**${section.displayName}**\nSection ${currentSection + 1} of ${shopData.sections.length}`)
            .setColor(0x00AE86)
            .setTimestamp()
            .setFooter({ 
                text: 'Powered by fnbr.co', 
                iconURL: 'https://fnbr.co/favicon.ico' 
            });

        if (shopData.date) {
            headerEmbed.addFields([
                { name: '📅 Shop Date', value: new Date(shopData.date).toDateString(), inline: true },
                { name: '📊 Total Items', value: shopData.totalItems.toString(), inline: true },
                { name: '📦 Total Sections', value: shopData.sections.length.toString(), inline: true }
            ]);
        }

        embeds.push(headerEmbed);

        // Item embeds
        const items = section.itemDetails || [];
        const maxItemsPerPage = 6; // Adjust based on Discord's 10 embed limit
        const itemsToShow = items.slice(0, maxItemsPerPage);

        for (const item of itemsToShow) {
            const itemEmbed = new EmbedBuilder()
                .setTitle(item.name)
                .setColor(apiClient.getRarityColor(item.rarity))
                .setThumbnail(item.images?.icon || null)
                .addFields([
                    { name: '💎 Rarity', value: item.rarity?.charAt(0).toUpperCase() + item.rarity?.slice(1) || 'Unknown', inline: true },
                    { name: '🏷️ Type', value: item.readableType || item.type || 'Unknown', inline: true },
                    { name: '💰 Price', value: item.price ? `${item.price} V-Bucks` : 'Not Available', inline: true }
                ]);

            if (item.description) {
                itemEmbed.setDescription(item.description);
            }

            if (item.images?.featured) {
                itemEmbed.setImage(item.images.featured);
            }

            embeds.push(itemEmbed);
        }

        // Add info if there are more items
        if (items.length > maxItemsPerPage) {
            const remainingItems = items.length - maxItemsPerPage;
            const infoEmbed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setDescription(`📝 **Note:** ${remainingItems} more item(s) in this section not shown to stay within Discord limits.`);
            embeds.push(infoEmbed);
        }

        return embeds;
    }

    createNavigationButtons(currentSection, totalSections, sessionId) {
        const row = new ActionRowBuilder();

        // First button
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`shop_first_${sessionId}`)
                .setLabel('⏮️ First')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentSection === 0)
        );

        // Previous button  
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`shop_prev_${sessionId}`)
                .setLabel('◀️ Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentSection === 0)
        );

        // Section indicator
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`shop_info_${sessionId}`)
                .setLabel(`${currentSection + 1}/${totalSections}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        // Next button
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`shop_next_${sessionId}`)
                .setLabel('Next ▶️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentSection >= totalSections - 1)
        );

        // Last button
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`shop_last_${sessionId}`)
                .setLabel('Last ⏭️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentSection >= totalSections - 1)
        );

        return [row];
    }

    async handleButtonInteraction(interaction) {
        try {
            const [action, direction, sessionId] = interaction.customId.split('_');
            
            if (action !== 'shop') return false;

            await interaction.deferUpdate();

            // Get session data
            const sessionData = this.activeInteractions.get(sessionId);
            if (!sessionData) {
                await interaction.followUp({ 
                    content: '❌ This shop session has expired. Please run the command again.', 
                    ephemeral: true 
                });
                return true;
            }

            const { shopData, currentSection } = sessionData;
            let newSection = currentSection;

            // Handle navigation
            switch (direction) {
                case 'first':
                    newSection = 0;
                    break;
                case 'prev':
                    newSection = Math.max(0, currentSection - 1);
                    break;
                case 'next':
                    newSection = Math.min(shopData.sections.length - 1, currentSection + 1);
                    break;
                case 'last':
                    newSection = shopData.sections.length - 1;
                    break;
                case 'info':
                    return true; // Do nothing for info button
            }

            // Update session
            this.activeInteractions.set(sessionId, {
                ...sessionData,
                currentSection: newSection
            });

            // Create new embeds and buttons
            const embeds = this.createShopEmbeds(shopData, newSection);
            const components = this.createNavigationButtons(newSection, shopData.sections.length, sessionId);

            await interaction.editReply({
                embeds,
                components
            });

            // Log interaction
            await database.logUserInteraction(
                interaction.user.id,
                interaction.user.username,
                'button',
                { action: 'shop_navigation', direction, section: newSection },
                interaction.guildId,
                sessionId
            );

            logger.interaction(`User ${interaction.user.username} navigated to section ${newSection + 1}`);
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

            // Create session
            const sessionId = `${interaction.user.id}_${Date.now()}`;
            const sessionTimeout = 15 * 60 * 1000; // 15 minutes

            this.activeInteractions.set(sessionId, {
                userId: interaction.user.id,
                shopData,
                currentSection: sectionIndex,
                startTime: Date.now()
            });

            // Auto-cleanup session
            setTimeout(() => {
                this.activeInteractions.delete(sessionId);
                logger.debug(`Cleaned up shop session: ${sessionId}`);
            }, sessionTimeout);

            // Create embeds and buttons
            const embeds = this.createShopEmbeds(shopData, sectionIndex);
            const components = this.createNavigationButtons(sectionIndex, shopData.sections.length, sessionId);

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
            .setFooter({ text: 'Powered by fnbr.co' });
    }

    async postDailyShop(client) {
        try {
            const channelId = process.env.SHOP_CHANNEL_ID;
            if (!channelId) {
                logger.warn('No shop channel ID configured for daily posting');
                return;
            }

            const channel = await client.channels.fetch(channelId);
            if (!channel) {
                logger.error(`Could not find shop channel with ID: ${channelId}`);
                return;
            }

            logger.shop('Starting daily shop post...');
            
            // Fetch fresh shop data
            const shopData = await this.fetchShopData(true);
            
            if (!shopData || !shopData.sections || shopData.sections.length === 0) {
                logger.error('No shop data available for daily post');
                return;
            }

            // Create initial message
            const embeds = this.createShopEmbeds(shopData, 0);
            const sessionId = `daily_${Date.now()}`;
            const components = this.createNavigationButtons(0, shopData.sections.length, sessionId);

            // Create session for daily post
            this.activeInteractions.set(sessionId, {
                userId: 'system',
                shopData,
                currentSection: 0,
                startTime: Date.now(),
                isDailyPost: true
            });

            // Send message
            const message = await channel.send({
                content: '🌅 **Daily Item Shop Update**',
                embeds,
                components
            });

            // Update database to mark as posted
            await database.logShopHistory(
                new Date().toISOString().split('T')[0],
                shopData.totalItems,
                shopData.sections.length,
                shopData.sections,
                null,
                true
            );

            logger.shop(`Daily shop posted successfully to ${channel.name}. Message ID: ${message.id}`);

        } catch (error) {
            logger.error('Failed to post daily shop:', error);
            
            await database.logError(
                'daily_shop_post',
                error.message,
                error.stack,
                { channelId: process.env.SHOP_CHANNEL_ID },
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

    clearCache() {
        this.currentShop = null;
        this.lastFetch = null;
        this.activeInteractions.clear();
        logger.shop('Shop cache cleared');
    }
}

module.exports = new ShopManager();
