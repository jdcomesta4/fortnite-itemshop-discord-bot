const logger = require('../utils/logger');
const database = require('../utils/database');

class ErrorHandler {
    async logError(type, error, context = {}, userId = null, guildId = null, commandName = null, severity = 'medium') {
        try {
            const errorMessage = error?.message || error?.toString() || 'Unknown error';
            const stackTrace = error?.stack || null;
            
            // Log to Winston
            logger.error(`[${type.toUpperCase()}] ${errorMessage}`, {
                type,
                context,
                userId,
                guildId,
                commandName,
                severity,
                stack: stackTrace
            });
            
            // Log to database
            await database.logError(type, errorMessage, stackTrace, context, userId, guildId, commandName, severity);
            
        } catch (dbError) {
            logger.error('Failed to log error to database:', dbError);
        }
    }

    handleDiscordError(error, context = {}) {
        let severity = 'medium';
        let type = 'discord_error';
        
        if (error.code) {
            switch (error.code) {
                case 10003: // Unknown Channel
                case 10004: // Unknown Guild
                case 10008: // Unknown Message
                    severity = 'low';
                    type = 'discord_not_found';
                    break;
                case 50013: // Missing Permissions
                    severity = 'high';
                    type = 'discord_permissions';
                    break;
                case 50035: // Invalid Form Body
                    severity = 'medium';
                    type = 'discord_validation';
                    break;
                default:
                    severity = 'medium';
                    type = 'discord_api';
            }
        }
        
        this.logError(type, error, { ...context, discordCode: error.code }, null, null, null, severity);
    }

    async handleCommandError(error, interaction, commandName) {
        const context = {
            commandName,
            userId: interaction?.user?.id,
            guildId: interaction?.guildId,
            channelId: interaction?.channelId
        };
        
        await this.logError('command_execution', error, context, interaction?.user?.id, interaction?.guildId, commandName, 'high');
        
        // Send user-friendly error message
        try {
            const errorMessage = '❌ An unexpected error occurred while executing this command. The issue has been logged and will be investigated.';
            
            if (interaction?.replied) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else if (interaction?.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        } catch (replyError) {
            logger.error('Failed to send error message to user:', replyError);
        }
    }

    getErrorSeverity(error) {
        if (error?.message?.toLowerCase().includes('critical') || 
            error?.code === 'ECONNREFUSED' ||
            error?.code === 'ENOTFOUND') {
            return 'critical';
        }
        
        if (error?.code === 50013 || // Discord permissions
            error?.message?.toLowerCase().includes('unauthorized')) {
            return 'high';
        }
        
        if (error?.code >= 10000 && error?.code < 20000) { // Discord API errors
            return 'low';
        }
        
        return 'medium';
    }
}

module.exports = new ErrorHandler();
