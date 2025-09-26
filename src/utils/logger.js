const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
fs.ensureDirSync(logsDir);

// Custom format for logs
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
        return `${timestamp} [${level.toUpperCase()} ===> ${stack || message}`;
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: logFormat,
    transports: [
        // Console transport
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                logFormat
            )
        }),
        
        // File transports
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5
        }),
        
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 5
        }),
        
        new winston.transports.File({
            filename: path.join(logsDir, 'api.log'),
            level: 'debug',
            maxsize: 5242880, // 5MB
            maxFiles: 3
        })
    ]
});

// Add custom methods
logger.api = (message, data = {}) => {
    logger.debug(`[API] ${message}`, data);
};

logger.command = (message, data = {}) => {
    logger.info(`[COMMAND] ${message}`, data);
};

logger.interaction = (message, data = {}) => {
    logger.info(`[INTERACTION] ${message}`, data);
};

logger.shop = (message, data = {}) => {
    logger.info(`[SHOP] ${message}`, data);
};

module.exports = logger;
