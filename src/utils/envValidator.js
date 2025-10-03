/**
 * Environment Variable Validator
 * Validates all required environment variables at bot startup
 */

const logger = require('../utils/logger');

class EnvValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
    }

    /**
     * Validate all required environment variables
     * @returns {boolean} - Whether validation passed
     */
    validate() {
        console.log('🔍 Validating environment variables...\n');

        // Required variables
        this.validateRequired('DISCORD_TOKEN', 'Discord bot token');
        this.validateRequired('CLIENT_ID', 'Discord application client ID');
        this.validateRequired('FNBR_API_KEY', 'FNBR.co API key');
        
        // Database variables (required as a group)
        const dbVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
        const hasAnyDb = dbVars.some(v => process.env[v]);
        const hasAllDb = dbVars.every(v => process.env[v]);
        
        if (hasAnyDb && !hasAllDb) {
            dbVars.forEach(v => {
                if (!process.env[v]) {
                    this.errors.push(`Missing required database variable: ${v}`);
                }
            });
        } else if (!hasAnyDb) {
            this.warnings.push('No database variables set - bot will run without database logging');
        }

        // Optional but recommended variables
        this.validateOptional('FORTNITE_API_KEY', 'Fortnite-API.com key (for shop history)');
        this.validateOptional('BOT_OWNER_ID', 'Bot owner Discord user ID (for error notifications)');
        this.validateOptional('DB_PORT', 'Database port (defaults to 3306)', '3306');
        this.validateOptional('PREFIX', 'Command prefix (defaults to jd!)', 'jd!');
        this.validateOptional('NODE_ENV', 'Node environment (production/development)', 'development');

        // Validate formats
        this.validateFormat('CLIENT_ID', /^\d{17,19}$/, 'Discord client ID (17-19 digits)');
        if (process.env.BOT_OWNER_ID) {
            this.validateFormat('BOT_OWNER_ID', /^\d{17,19}$/, 'Discord user ID (17-19 digits)');
        }
        if (process.env.DB_PORT) {
            this.validateFormat('DB_PORT', /^\d{1,5}$/, 'Valid port number (1-65535)');
            const port = parseInt(process.env.DB_PORT);
            if (port < 1 || port > 65535) {
                this.errors.push('DB_PORT must be between 1 and 65535');
            }
        }

        // Print results
        this.printResults();

        return this.errors.length === 0;
    }

    /**
     * Validate a required environment variable
     */
    validateRequired(varName, description) {
        if (!process.env[varName]) {
            this.errors.push(`Missing required variable: ${varName} (${description})`);
            console.log(`❌ ${varName}: Missing (Required)`);
        } else {
            console.log(`✅ ${varName}: Set`);
        }
    }

    /**
     * Validate an optional environment variable
     */
    validateOptional(varName, description, defaultValue = null) {
        if (!process.env[varName]) {
            const defaultMsg = defaultValue ? ` (defaults to: ${defaultValue})` : '';
            this.warnings.push(`Optional variable not set: ${varName} (${description})${defaultMsg}`);
            console.log(`⚠️  ${varName}: Not set (Optional) - ${description}${defaultMsg}`);
        } else {
            console.log(`✅ ${varName}: Set`);
        }
    }

    /**
     * Validate environment variable format
     */
    validateFormat(varName, regex, description) {
        if (process.env[varName] && !regex.test(process.env[varName])) {
            this.errors.push(`Invalid format for ${varName}: Expected ${description}`);
        }
    }

    /**
     * Print validation results
     */
    printResults() {
        console.log('\n' + '='.repeat(60));
        
        if (this.errors.length > 0) {
            console.log('\n❌ VALIDATION FAILED\n');
            console.log('Errors:');
            this.errors.forEach(error => console.log(`  • ${error}`));
        }

        if (this.warnings.length > 0) {
            console.log('\n⚠️  WARNINGS\n');
            this.warnings.forEach(warning => console.log(`  • ${warning}`));
        }

        if (this.errors.length === 0) {
            console.log('\n✅ VALIDATION PASSED');
            if (this.warnings.length > 0) {
                console.log('   (with warnings - bot will continue)');
            }
        }

        console.log('\n' + '='.repeat(60) + '\n');
    }

    /**
     * Get validation summary for logging
     */
    getSummary() {
        return {
            passed: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings
        };
    }
}

module.exports = new EnvValidator();
