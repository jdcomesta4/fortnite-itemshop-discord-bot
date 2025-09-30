# 🛍️ Fortnite Item Shop Discord Bot

A comprehensive Discord bot that displays the current Fortnite item shop with advanced features including daily updates, item search, and permission management.

![Discord.js](https://img.shields.io/badge/discord.js-v14.14.1-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-%3E%3D18.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## ✨ Features

- **📅 Daily Shop Updates**: Automatically posts the current Fortnite item shop to designated channels
- **🔍 Item Search**: Search for specific items by name, type, or rarity
- **🎯 Interactive Navigation**: Browse through shop sections with reaction buttons
- **👮 Permission Management**: Role-based access control for shop commands
- **📊 Analytics & Logging**: Comprehensive tracking of command usage and shop history
- **⚡ Error Handling**: Robust error management with detailed logging
- **🔄 Auto Retry**: Automatic retry logic for API requests
- **💾 Database Storage**: MySQL database for configuration and analytics

## 🚀 Commands

### User Commands
- `/showcurrentitemshop` - Display the current Fortnite item shop with navigation
- `/searchitem <name>` - Search for specific items by name, type, or rarity
- `/help` - Display help information and available commands

### Admin Commands
- `/setshopchannel <channel>` - Set up daily shop updates for a channel
- `/shopsettings` - Manage shop channel settings
- `/shopsettings view` - View current server configuration
- `/shopsettings toggle <true/false>` - Toggle daily updates on/off
- `/shopsettings trustedrole <role>` - Set trusted role for shop commands
- `/shopsettings remove` - Remove shop configuration
- `/botstatus` - View bot status and statistics

### Prefix Commands
All slash commands are also available as prefix commands for flexibility.

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- MySQL database
- Discord bot token
- FNBR.co API key

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jdcomesta4/fortnite-itemshop-discord-bot.git
   cd fortnite-itemshop-discord-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Discord Bot Configuration
   DISCORD_TOKEN=your_discord_bot_token
   CLIENT_ID=your_bot_client_id
   
   # Database Configuration
   DB_HOST=localhost
   DB_USER=your_database_user
   DB_PASSWORD=your_database_password
   DB_NAME=your_database_name
   DB_PORT=3306
   
   # API Configuration
   FNBR_API_KEY=your_fnbr_api_key
   
   # Optional: Logging Configuration
   LOG_LEVEL=info
   ```

4. **Set up the database**
   
   Import the database schema:
   ```bash
   mysql -u your_username -p your_database_name < src/config/database.sql
   ```

5. **Deploy slash commands**
   ```bash
   node deploy-commands.js
   ```

6. **Start the bot**
   ```bash
   npm start
   ```

   For development with auto-restart:
   ```bash
   npm run dev
   ```

## 🔧 Configuration

### Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application and bot
3. Copy the bot token and client ID to your `.env` file
4. Enable the following bot permissions:
   - Send Messages
   - Use Slash Commands
   - Embed Links
   - Add Reactions
   - Read Message History
   - Manage Messages (for navigation)

### FNBR.co API Setup

1. Visit [FNBR.co](https://fnbr.co/api/docs) to get an API key
2. Add your API key to the `.env` file

### Fortnite API Setup

1. Vist [Fortnite-API](https://fortnite-api.com/) to get an API key
2. Add your API key to the `.env` file

### Database Setup

The bot uses MySQL to store:
- Server configurations
- Command usage analytics
- Shop history
- Error logs
- User statistics

## 📂 Project Structure

```
├── src/
│   ├── commands/
│   │   ├── prefix/          # Prefix-based commands
│   │   └── slash/           # Slash commands
│   ├── config/
│   │   └── database.sql     # Database schema
│   ├── events/              # Discord.js event handlers
│   ├── handlers/            # Command and error handlers
│   └── utils/               # Utility modules
│       ├── apiClient.js     # FNBR.co API client
│       ├── database.js      # Database connection
│       ├── logger.js        # Winston logger
│       ├── permissionManager.js
│       ├── scheduler.js     # Cron job scheduler
│       └── shopManager.js   # Shop display logic
├── deploy-commands.js       # Slash command deployment
├── package.json
└── README.md
```

## 🎮 Usage

### Setting Up Daily Updates

1. Use `/setshopchannel #your-channel` to set up automatic daily shop updates
2. Configure permissions with `/shopsettings trustedrole @role`
3. Toggle updates on/off with `/shopsettings toggle true/false`

### Viewing the Shop

- Use `/showcurrentitemshop` to display the current item shop
- Navigate through different sections using the reaction buttons
- Items are displayed with images, prices, and rarity information

### Searching Items

- Use `/searchitem fortnite` to search for items containing "fortnite"
- Search by rarity: `/searchitem legendary`
- Search by type: `/searchitem pickaxe`

## 🔍 Analytics & Monitoring

The bot tracks various metrics including:
- Command usage statistics
- API response times
- Shop update history
- Error rates and types
- User engagement metrics

View bot statistics with `/botstatus` (admin only).

## 🛡️ Permission System

- **Public Commands**: `showcurrentitemshop`, `searchitem`, `help`
- **Admin Commands**: `setshopchannel`, `shopsettings`, `botstatus`
- **Trusted Role**: Configurable role that can use shop commands even if not admin

## 🐛 Troubleshooting

### Common Issues

1. **Bot not responding to commands**
   - Check if the bot has proper permissions in the channel
   - Verify the bot token in `.env`
   - Check the console for error messages

2. **Database connection errors**
   - Verify database credentials in `.env`
   - Ensure MySQL server is running
   - Check if the database schema is properly imported

3. **API errors**
   - Verify your FNBR.co API key
   - Check if you've exceeded API rate limits
   - Monitor the logs for specific API error messages

### Logs

The bot uses Winston for logging. Logs are output to the console and can be configured to write to files. Check the logs for detailed error information.

## 📊 Database Schema

The bot creates several tables for data storage:
- `command_usage` - Command execution tracking
- `shop_history` - Historical shop data
- `guild_configs` - Server-specific settings
- `error_logs` - Error tracking
- `api_requests` - API usage analytics

## 📊 Database Export

Export your bot's database analytics and data to JSON format:

```bash
# Export with automatic timestamped filename
node scripts/database-export.js

# Export with custom filename
node scripts/database-export.js my-backup.json

# Using npm script
npm run db-export
```

This creates a comprehensive JSON file in the `stats/` folder containing:
- All database records (command usage, shop history, errors, etc.)
- Performance analytics and statistics
- Recent activity summaries
- Error analysis for debugging

Perfect for backing up data, analyzing bot performance, or troubleshooting issues.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and commit: `git commit -m 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## 🔗 Links

- [Discord Server](https://discord.gg/gMPavvZ53v)
- [FNBR.co API Documentation](https://fnbr.co/api/docs)
- [Fortnite API Documentation](https://dash.fortnite-api.com/)
- [Discord Developer Portal](https://discord.com/developers/applications)

## 📞 Support

If you encounter any issues or have questions:
1. Check the troubleshooting section above
2. Review the logs for error details
3. Open an issue on GitHub with relevant error messages and context

---

**Made with ❤️ by jdcomesta4**