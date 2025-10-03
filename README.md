# 🛍️ Fortnite Item Shop Discord Bot

A comprehensive, production-ready Discord bot that displays the current Fortnite item shop with advanced features including wishlist tracking, daily automated updates, item search with shop history, and detailed analytics.

[![Discord.js](https://img.shields.io/badge/discord.js-v14.14.1-blue.svg)](https://discord.js.org/)
[![Node.js](https://img.shields.io/badge/node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## ✨ Features

### 🛍️ Shop Display
- **📅 Daily Automated Updates** - Posts the current Fortnite item shop to designated channels at 1:30 AM UTC
- **🎯 Interactive Navigation** - Browse through shop sections and pages with button-based navigation
- **�️ Rich Embeds** - Beautiful item displays with thumbnails, rarity colors, prices, and types
- **📦 Section Organization** - Items organized by shop sections (Featured, Daily, etc.)
- **⚡ Real-time Data** - Fetches live shop data from FNBR.co API

### ⭐ Wishlist System
- **💝 Personal Wishlists** - Users can track items they want to purchase
- **🔔 Smart Notifications** - Automatic alerts when wishlist items appear in the shop
- **📊 Wishlist Management** - Add, remove, and view items with pagination
- **🎯 Quick Actions** - Add items directly from shop embeds with ➕ buttons
- **� Last Seen Tracking** - See when wishlist items were last in the shop
- **🔕 Privacy Controls** - Users can disable notifications at any time

### � Advanced Search
- **🔎 Multi-Criteria Search** - Search by name, type, or rarity
- **📜 Shop History** - See when items were last available in the shop
- **🎨 Visual Display** - Full item details with images and descriptions
- **⚡ Fast Results** - Cached search results for quick responses
- **➕ Wishlist Integration** - Add items to wishlist directly from search results

### 👮 Permission & Security
- **🔐 Role-Based Access** - Optional trusted role system for shop commands
- **🛡️ Admin Controls** - Full configuration management for server administrators
- **🔒 Environment Validation** - Comprehensive startup checks for all required variables
- **✅ Permission Checks** - Proper validation at every interaction
- **📝 Audit Logging** - Track all command usage and configuration changes

### 📊 Analytics & Monitoring
- **📈 Command Usage Tracking** - Detailed statistics on all command executions
- **🕐 API Response Monitoring** - Track API performance and response times
- **📋 Shop History** - Historical data on daily shop contents
- **⚠️ Error Tracking** - Comprehensive error logging with severity levels
- **👥 User Engagement** - Track user interactions and button clicks
- **🔍 Search Analytics** - Monitor popular search terms and results

### 🛠️ Technical Features
- **💾 MySQL Database** - Persistent storage for configurations and analytics
- **🔄 Automatic Retries** - Smart retry logic for API failures with exponential backoff
- **📦 Caching System** - Intelligent caching to reduce API calls and improve performance
- **🧹 Session Management** - Automatic cleanup of expired sessions and memory management
- **📝 Winston Logging** - Professional logging with file rotation and levels
- **🔧 Centralized Config** - Easy configuration management in one place
- **⚡ Multi-Guild Support** - Independent settings for each Discord server

---

## � Quick Start

### Prerequisites
- **Node.js** 18.0.0 or higher
- **MySQL** 5.7 or higher (optional for database features)
- **Discord Bot Token** from [Discord Developer Portal](https://discord.com/developers/applications)
- **FNBR.co API Key** from [FNBR.co](https://fnbr.co/api/docs)
- **Fortnite API Key** from [fortnite-api.com](https://fortnite-api.com)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jdcomesta4/fortnite-itemshop-discord-bot.git
   cd fortnite-itemshop-discord-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Required
   DISCORD_TOKEN=your_discord_bot_token
   CLIENT_ID=your_bot_client_id
   FNBR_API_KEY=your_fnbr_api_key
   FORTNITE_API_KEY=your_fortnite_api_key 

   # Database (all or none - bot works without database)
   DB_HOST=localhost
   DB_USER=your_database_user
   DB_PASSWORD=your_database_password
   DB_NAME=fortnite_shop_bot
   DB_PORT=3306

   # Optional
   BOT_OWNER_ID=your_discord_user_id       # For error notifications
   PREFIX=jd!                               # Command prefix (default: jd!)
   NODE_ENV=production                      # Environment mode
   ```

4. **Set up the database** (Optional - skip if not using database)
   ```bash
   mysql -u your_username -p your_database_name < src/config/database.sql
   ```
   The bot will automatically create tables if they don't exist.

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

   For safe development with pre-run tests:
   ```bash
   npm run dev-safe
   ```

---

## 📖 Commands

### 👤 User Commands

#### Shop Commands
- `/showcurrentitemshop` - Display the current Fortnite item shop with interactive navigation
- `/searchitem <name> [type] [rarity]` - Search for specific items with shop history

#### Wishlist Commands
- `/addtowishlist <name>` - Add an item to your personal wishlist
- `/mywishlist` - View and manage your wishlist with pagination
- `/removefromwishlist <name>` - Remove an item from your wishlist
- `/wishlistsettings` - Configure your notification preferences
- `/help` - Display comprehensive help information

### 👨‍💼 Admin Commands

- `/setshopchannel <channel>` - Set up daily shop updates (1:30 AM UTC)
- `/setupdateschannel <channel>` - Set channel for wishlist notifications
- `/shopsettings [action] [value]` - Manage shop configuration
- `/wishlistsettings [action] [value]` - Manage wishlist notifications
- `/botstatus` - View bot statistics and system information

### 🔖 Prefix Commands

All slash commands available with `jd!` prefix. Common aliases:
- `jd!shop`, `jd!itemshop` → showcurrentitemshop
- `jd!search`, `jd!item` → searchitem
- `jd!addwish`, `jd!wadd` → addtowishlist
- `jd!wishlist`, `jd!wl` → mywishlist
- `jd!removewish`, `jd!wremove` → removefromwishlist

See full command list with `/help` or `jd!help`

---

## 🔧 Configuration

### Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application and navigate to the "Bot" section
3. Enable these **Privileged Gateway Intents**:
   - ✅ Server Members Intent
   - ✅ Message Content Intent
4. Copy the bot token to your `.env` file as `DISCORD_TOKEN`
5. Go to "OAuth2" → "URL Generator" and select:
   - **Scopes**: `bot`, `applications.commands`
   - **Bot Permissions**: Send Messages, Embed Links, Read Message History, Add Reactions, Use Slash Commands
6. Use the generated URL to invite the bot to your server

### API Keys

#### FNBR.co API (Required)
1. Visit [FNBR.co API Documentation](https://fnbr.co/api/docs)
2. Sign up and request an API key
3. Add to `.env` as `FNBR_API_KEY`

#### Fortnite-API.com (Optional - Enhanced Features)
1. Visit [Fortnite-API.com](https://fortnite-api.com/)
2. Generate an API key from the dashboard
3. Add to `.env` as `FORTNITE_API_KEY`
4. Enables shop history tracking and "Last Seen" dates

### Database Setup (Optional)

The bot works without a database but loses analytics and persistent configuration.

```sql
CREATE DATABASE fortnite_shop_bot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'bot_user'@'localhost' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON fortnite_shop_bot.* TO 'bot_user'@'localhost';
FLUSH PRIVILEGES;
```

Tables are created automatically on first run.

---

## 📂 Project Structure

```
fortnite-itemshop-discord-bot/
├── src/
│   ├── commands/
│   │   ├── prefix/              # Prefix commands (jd!)
│   │   └── slash/               # Slash commands (/)
│   ├── config/
│   │   ├── config.js            # Centralized configuration
│   │   └── database.sql         # Database schema
│   ├── events/                  # Discord.js event handlers
│   ├── handlers/                # Command and error handlers
│   └── utils/                   # Utility modules
│       ├── apiClient.js         # API client
│       ├── database.js          # Database operations
│       ├── envValidator.js      # Environment validation
│       ├── logger.js            # Winston logger
│       ├── scheduler.js         # Cron jobs
│       ├── shopManager.js       # Shop display logic
│       ├── wishlistManager.js   # Wishlist operations
│       └── wishlistNotifier.js  # Notification system
├── scripts/                     # Utility scripts
├── logs/                        # Log files
├── stats/                       # Exported data
├── deploy-commands.js           # Command deployment
├── package.json
├── .env                         # Environment variables (create this)
├── README.md                    # This file
├── CODE_IMPROVEMENTS.md         # Recent improvements
└── CONFIGURATION.md             # Detailed setup guide
```

---

## 🎮 Usage Guide

### For Server Administrators

```
/setshopchannel #shop-updates
/setupdateschannel #wishlist-notifications
/shopsettings trustedrole @ShopAccess
/shopsettings toggle true
```

### For Users

```
/showcurrentitemshop              # View current shop
/searchitem galaxy                # Search items
/addtowishlist Skull Trooper      # Track items
/mywishlist                       # View wishlist
/wishlistsettings disable         # Manage notifications
```

---

## 🔔 Wishlist Notification System

### How It Works

1. Users add items with `/addtowishlist`
2. Bot checks daily at 1:30 AM UTC during shop update
3. Smart partial name matching finds items
4. Notifications sent via guild channel or DM
5. One notification per item per day

### Privacy & Control

- Disable notifications: `/wishlistsettings disable`
- Remove items anytime: `/removefromwishlist`
- Complete privacy control

---

## � Analytics & Monitoring

### Available Metrics
- Command usage and popularity
- API performance monitoring
- Shop history tracking
- Error rates and categorization
- User engagement patterns

### Export Data
```bash
npm run db-export
```
Creates JSON file in `stats/` with all analytics.

### View Bot Status
```
/botstatus
```
Shows uptime, sessions, cache stats, and more.

---

## 🧪 Testing

```bash
npm run test           # Run all tests
npm run dev-safe       # Start with pre-run tests
```

Manual testing available via `src/utils/testUtilities.js`

---

## 🐛 Troubleshooting

### Bot Not Responding
- Check bot permissions in channel
- Verify `DISCORD_TOKEN` in `.env`
- Run `node deploy-commands.js` for slash commands

### Database Connection Errors
- Verify database credentials
- Ensure MySQL server is running
- Bot works without database (remove DB variables)

### API Errors
- Verify FNBR.co API key
- Check rate limits
- Monitor `logs/api.log`

### Shop Not Updating
- Check `/shopsettings view`
- Verify bot permissions in shop channel
- Daily updates run at 1:30 AM UTC

**See full troubleshooting guide in `CONFIGURATION.md`**

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes (follow existing code style)
4. Test your changes: `npm run test`
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style
- Use meaningful variable names
- Add JSDoc comments for functions
- Use `logger` instead of `console.log`
- Follow existing patterns

---

## 📝 Recent Improvements

**Version 2.0.0** - October 2025

- ✅ Fixed logger format string bug
- ✅ Replaced all console.log statements with logger
- ✅ Fixed database validation bug
- ✅ Removed hardcoded credentials (security)
- ✅ Added comprehensive environment validation
- ✅ Fixed memory leaks in session management
- ✅ Improved permission system implementation
- ✅ Centralized configuration in config.js
- ✅ Created dedicated test utilities
- ✅ Enhanced cleanup and monitoring

---

## 🔗 Links

- **Discord Server**: [Join Our Community](https://discord.gg/gMPavvZ53v)
- **FNBR.co API**: [Documentation](https://fnbr.co/api/docs)
- **Fortnite-API.com**: [Documentation](https://fortnite-api.com/)
- **Discord Developer Portal**: [Create Bot](https://discord.com/developers/applications)
- **Discord.js Guide**: [Documentation](https://discordjs.guide/)

---

## 📞 Support

Need help?

1. **Documentation**: Read this README
2. **Troubleshooting**: See troubleshooting section above
3. **Logs**: Review logs in `logs/` directory
4. **Issues**: [Create a GitHub Issue](https://github.com/jdcomesta4/fortnite-itemshop-discord-bot/issues)
5. **Discord**: [Join our server](https://discord.gg/gMPavvZ53v)

---

## 🎯 Roadmap

Future planned features:

- [ ] Web dashboard for configuration
- [ ] Wishlist sharing between users
- [ ] Custom notification schedules
- [ ] Item comparison tools
- [ ] Bundle tracking and price alerts

---

## 👏 Acknowledgments

- **Epic Games** - For creating Fortnite
- **FNBR.co** - For providing the shop API
- **Fortnite-API.com** - For shop history data
- **Discord.js** - For the excellent Discord library
- **Community** - For feedback and support

---

## 💖 Support the Project

If you find this bot useful:
- ⭐ Star the repository on GitHub
- 🐛 Report bugs and issues
- 💡 Suggest new features
- 🤝 Contribute code and improvements
- 📢 Share with your Discord communities

---

<div align="center">

**Made with ❤️ by [jdcomesta4](https://github.com/jdcomesta4)**

**Bot Version 2.0.0** • **Last Updated: October 2025**

[⬆ Back to Top](#-fortnite-item-shop-discord-bot)

</div>
