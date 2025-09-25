const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');

class CommandHandler {
    async loadCommands(client) {
        try {
            // Load slash commands
            await this.loadSlashCommands(client);
            
            // Load prefix commands
            await this.loadPrefixCommands(client);
            
            logger.info('All commands loaded successfully');
        } catch (error) {
            logger.error('Failed to load commands:', error);
            throw error;
        }
    }

    async loadSlashCommands(client) {
        const slashDir = path.join(__dirname, '../commands/slash');
        
        if (!await fs.pathExists(slashDir)) {
            logger.warn('Slash commands directory not found');
            return;
        }

        const files = await fs.readdir(slashDir);
        const jsFiles = files.filter(file => file.endsWith('.js'));
        
        for (const file of jsFiles) {
            try {
                const filePath = path.join(slashDir, file);
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);
                
                if (command.data && command.execute) {
                    client.slashCommands.set(command.data.name, command);
                    logger.debug(`Loaded slash command: ${command.data.name}`);
                } else {
                    logger.warn(`Invalid slash command structure in ${file}`);
                }
            } catch (error) {
                logger.error(`Failed to load slash command ${file}:`, error);
            }
        }
        
        logger.info(`Loaded ${client.slashCommands.size} slash commands`);
    }

    async loadPrefixCommands(client) {
        const prefixDir = path.join(__dirname, '../commands/prefix');
        
        if (!await fs.pathExists(prefixDir)) {
            logger.warn('Prefix commands directory not found');
            return;
        }

        const files = await fs.readdir(prefixDir);
        const jsFiles = files.filter(file => file.endsWith('.js'));
        
        for (const file of jsFiles) {
            try {
                const filePath = path.join(prefixDir, file);
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);
                
                if (command.name && command.execute) {
                    client.commands.set(command.name, command);
                    logger.debug(`Loaded prefix command: ${command.name}`);
                } else {
                    logger.warn(`Invalid prefix command structure in ${file}`);
                }
            } catch (error) {
                logger.error(`Failed to load prefix command ${file}:`, error);
            }
        }
        
        logger.info(`Loaded ${client.commands.size} prefix commands`);
    }

    async registerSlashCommands(client) {
        try {
            const commands = Array.from(client.slashCommands.values()).map(cmd => cmd.data.toJSON());
            
            if (commands.length === 0) {
                logger.info('No slash commands to register');
                return;
            }

            await client.application.commands.set(commands);
            logger.info(`Registered ${commands.length} slash commands globally`);
            
        } catch (error) {
            logger.error('Failed to register slash commands:', error);
            throw error;
        }
    }
}

module.exports = new CommandHandler();
