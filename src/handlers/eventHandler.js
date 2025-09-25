const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');

class EventHandler {
    async loadEvents(client) {
        try {
            const eventsDir = path.join(__dirname, '../events');
            
            if (!await fs.pathExists(eventsDir)) {
                logger.warn('Events directory not found');
                return;
            }

            const files = await fs.readdir(eventsDir);
            const jsFiles = files.filter(file => file.endsWith('.js'));
            
            for (const file of jsFiles) {
                try {
                    const filePath = path.join(eventsDir, file);
                    delete require.cache[require.resolve(filePath)];
                    const event = require(filePath);
                    
                    if (event.name && event.execute) {
                        if (event.once) {
                            client.once(event.name, (...args) => event.execute(...args, client));
                        } else {
                            client.on(event.name, (...args) => event.execute(...args, client));
                        }
                        
                        logger.debug(`Loaded event: ${event.name}`);
                    } else {
                        logger.warn(`Invalid event structure in ${file}`);
                    }
                } catch (error) {
                    logger.error(`Failed to load event ${file}:`, error);
                }
            }
            
            logger.info(`Loaded ${jsFiles.length} events`);
            
        } catch (error) {
            logger.error('Failed to load events:', error);
            throw error;
        }
    }
}

module.exports = new EventHandler();
