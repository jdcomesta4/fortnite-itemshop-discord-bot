const { Events } = require('discord.js');
const logger = require('../utils/logger');
const database = require('../utils/database');
const errorHandler = require('../handlers/errorHandler');
const shopManager = require('../utils/shopManager');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            // Handle slash commands
            if (interaction.isChatInputCommand()) {
                await handleSlashCommand(interaction, client);
            }
            // Handle button interactions
            else if (interaction.isButton()) {
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
    // Handle shop navigation buttons
    if (interaction.customId.startsWith('shop_')) {
        const handled = await shopManager.handleButtonInteraction(interaction);
        if (handled) return;
    }
    
    // Handle other button interactions here
    logger.warn(`Unhandled button interaction: ${interaction.customId}`);
}

async function checkPermissions(interaction) {
    const trustedRoleId = process.env.TRUSTED_ROLE_ID;
    
    if (!trustedRoleId) {
        logger.warn('No trusted role ID configured, allowing all users');
        return true;
    }
    
    if (!interaction.guild) {
        logger.warn('Command used outside of guild');
        return false;
    }
    
    const member = interaction.guild.members.cache.get(interaction.user.id) || 
                  await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    
    if (!member) {
        logger.warn(`Could not fetch member: ${interaction.user.id}`);
        return false;
    }
    
    return member.roles.cache.has(trustedRoleId) || member.permissions.has('Administrator');
}
