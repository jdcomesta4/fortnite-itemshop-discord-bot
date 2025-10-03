const { Events } = require('discord.js');
const logger = require('../utils/logger');
const database = require('../utils/database');
const errorHandler = require('../handlers/errorHandler');
const shopManager = require('../utils/shopManager');
const wishlistManager = require('../utils/wishlistManager');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            logger.debug(`Interaction received: ${interaction.type} - ${interaction.isCommand() ? interaction.commandName : interaction.customId}`);
            
            // Handle slash commands
            if (interaction.isChatInputCommand()) {
                logger.debug(`Processing slash command: ${interaction.commandName}`);
                await handleSlashCommand(interaction, client);
            }
            // Handle button interactions
            else if (interaction.isButton()) {
                logger.debug(`Processing button: ${interaction.customId}`);
                await handleButtonInteraction(interaction, client);
            }
        } catch (error) {
            logger.error('Error in interactionCreate event:', error);
            await errorHandler.handleCommandError(error, interaction, 'interactionCreate');
        }
    }
};

async function handleSlashCommand(interaction, client) {
    const command = client.slashCommands.get(interaction.commandName);
    
    if (!command) {
        logger.warn(`Unknown slash command: ${interaction.commandName}`);
        return;
    }

    // Check permissions
    const hasPermission = await checkPermissions(interaction);
    if (!hasPermission) {
        await interaction.reply({ 
            content: '❌ You don\'t have permission to use this command. You need the trusted role.', 
            ephemeral: true 
        });
        
        await database.logUserInteraction(
            interaction.user.id,
            interaction.user.username,
            'command',
            { 
                commandName: interaction.commandName,
                authorized: false,
                reason: 'missing_role'
            },
            interaction.guildId
        );
        
        return;
    }

    const startTime = Date.now();
    
    try {
        logger.command(`Executing slash command: ${interaction.commandName} by ${interaction.user.username}`);
        
        await command.execute(interaction);
        
        const executionTime = Date.now() - startTime;
        
        await database.logCommandUsage(
            interaction.user.id,
            interaction.user.username,
            interaction.commandName,
            interaction.options?.data || {},
            interaction.guildId,
            interaction.guild?.name,
            executionTime,
            true
        );
        
    } catch (error) {
        const executionTime = Date.now() - startTime;
        
        await database.logCommandUsage(
            interaction.user.id,
            interaction.user.username,
            interaction.commandName,
            interaction.options?.data || {},
            interaction.guildId,
            interaction.guild?.name,
            executionTime,
            false,
            error.message
        );
        
        throw error;
    }
}

async function handleButtonInteraction(interaction, client) {
    // Handle shop wishlist buttons first (shop_wl_ prefix)
    if (interaction.customId.startsWith('shop_wl_')) {
        const handled = await wishlistManager.handleButtonInteraction(interaction);
        if (handled) return;
    }
    
    // Handle shop navigation buttons
    if (interaction.customId.startsWith('shop_')) {
        const handled = await shopManager.handleButtonInteraction(interaction);
        if (handled) return;
    }
    
    // Handle other wishlist buttons
    if (interaction.customId.startsWith('wishlist_') || 
        interaction.customId.startsWith('search_wishlist_') ||
        interaction.customId.includes('wishlist')) {
        const handled = await wishlistManager.handleButtonInteraction(interaction);
        if (handled) return;
    }
    
    // Handle other button interactions here
    logger.warn(`Unhandled button interaction: ${interaction.customId}`);
}

async function checkPermissions(interaction) {
    // Commands that require administrator permissions (built into command definitions)
    const adminCommands = ['setshopchannel', 'setupdateschannel', 'shopsettings', 'wishlistsettings'];
    
    // Commands that require trusted role (if configured)
    const trustedCommands = ['showcurrentitemshop', 'searchitem'];
    
    // Admin commands - rely on Discord's built-in permission system
    if (adminCommands.includes(interaction.commandName)) {
        return true; // Permission check is in the command definition
    }
    
    // Check trusted role for specific commands if configured
    if (trustedCommands.includes(interaction.commandName) && interaction.guild) {
        try {
            const guildConfig = await database.getGuildConfig(interaction.guildId);
            
            // If no trusted role is configured, allow everyone
            if (!guildConfig || !guildConfig.trusted_role_id) {
                return true;
            }
            
            // Check if user has the trusted role
            const member = interaction.member;
            if (member && member.roles.cache.has(guildConfig.trusted_role_id)) {
                return true;
            }
            
            // Check if user is administrator (always allow)
            if (member && member.permissions.has('Administrator')) {
                return true;
            }
            
            logger.debug(`User ${interaction.user.username} lacks trusted role for ${interaction.commandName}`);
            return false;
            
        } catch (error) {
            logger.error('Error checking trusted role permissions:', error);
            // On error, allow access to prevent command lockout
            return true;
        }
    }
    
    // All other commands are available to everyone
    return true;
}
