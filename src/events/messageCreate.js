const { Events } = require('discord.js');
const logger = require('../utils/logger');
const database = require('../utils/database');
const errorHandler = require('../handlers/errorHandler');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        try {
            // Ignore bots and DMs
            if (message.author.bot || !message.guild) return;
            
            const prefix = process.env.PREFIX || 'jd!';
            
            // Check if message starts with prefix
            if (!message.content.startsWith(prefix)) return;
            
            // Parse command and arguments
            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift()?.toLowerCase();
            
            if (!commandName) return;
            
            // Get command
            const command = client.commands.get(commandName);
            if (!command) return;
            
            // Check permissions
            const hasPermission = await checkPermissions(message);
            if (!hasPermission) {
                await message.reply('❌ You don\'t have permission to use this command. You need the trusted role.');
                
                await database.logUserInteraction(
                    message.author.id,
                    message.author.username,
                    'command',
                    { 
                        commandName,
                        authorized: false,
                        reason: 'missing_role',
                        prefix: true
                    },
                    message.guildId
                );
                
                return;
            }
            
            const startTime = Date.now();
            
            try {
                logger.command(`Executing prefix command: ${commandName} by ${message.author.username}`);
                
                await command.execute(message, args);
                
                const executionTime = Date.now() - startTime;
                
                await database.logCommandUsage(
                    message.author.id,
                    message.author.username,
                    commandName,
                    { args, prefix: true },
                    message.guildId,
                    message.guild?.name,
                    executionTime,
                    true
                );
                
            } catch (error) {
                const executionTime = Date.now() - startTime;
                
                await database.logCommandUsage(
                    message.author.id,
                    message.author.username,
                    commandName,
                    { args, prefix: true },
                    message.guildId,
                    message.guild?.name,
                    executionTime,
                    false,
                    error.message
                );
                
                throw error;
            }
            
        } catch (error) {
            logger.error('Error in messageCreate event:', error);
            await errorHandler.logError('prefix_command', error, {
                messageId: message.id,
                channelId: message.channelId,
                guildId: message.guildId
            }, message.author.id, message.guildId);
        }
    }
};

async function checkPermissions(message) {
    // Allow all users to use prefix commands
    // Admin-specific commands would need to be handled individually if added as prefix commands
    return true;
}
