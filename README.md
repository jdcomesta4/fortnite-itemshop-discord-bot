# Fortnite Item Shop Discord Bot

A comprehensive Discord bot built with Discord.js v14+ that displays Fortnite item shop data with advanced pagination, search functionality, and analytics. Integrates with the FNBR.co API to provide real-time shop information.

## Features

- 🛍️ **Daily Item Shop Display** - Automatically posts the current item shop at 1:30 AM UTC+1
- 🔍 **Advanced Item Search** - Search for items by name, type, and rarity with smart filtering
- 📱 **Interactive Navigation** - Paginated embeds with intuitive button controls
- 🎯 **Role-Based Permissions** - Restrict commands to trusted users
- 📊 **Comprehensive Analytics** - Track usage, errors, and performance metrics
- ⚡ **Smart Caching** - Efficient API usage with intelligent cache management
- 🔄 **Auto-Retry Logic** - Robust error handling with exponential backoff
- 📝 **Detailed Logging** - Complete audit trail of all bot activities

## Commands

### Slash Commands
- `/showcurrentitemshop` - Display the current Fortnite item shop
- `/searchitem <name> [type] [rarity]` - Search for specific items

### Prefix Commands
- `jd!showcurrentitemshop` - Display the current Fortnite item shop
- `jd!searchitem <name> [type] [rarity]` - Search for specific items

## Installation

### Prerequisites
- Node.js 18.0.0 or higher
- MySQL 5.7+ or MariaDB 10.3+
- Discord Bot Token
- FNBR.co API Key

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd item_shop
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Database Setup**
   ```bash
   # Create MySQL database and import schema
   mysql -u root -p < src/config/database.sql
   ```

4. **Environment Configuration**
   ```bash
   # Copy example environment file
   cp .env.example .env
   
   # Edit .env with your credentials
   DISCORD_TOKEN=your_discord_bot_token
   FNBR_API_KEY=your_fnbr_api_key
   PREFIX=jd!
   TRUSTED_ROLE_ID=your_trusted_role_id
   SHOP_CHANNEL_ID=your_shop_channel_id
   DB_HOST=localhost
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=your_db_name
   ```

5. **Start the bot**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_TOKEN` | Your Discord bot token | ✅ |
| `FNBR_API_KEY` | FNBR.co API key for item data | ✅ |
| `PREFIX` | Command prefix (default: jd!) | ✅ |
| `TRUSTED_ROLE_ID` | Role ID for command permissions | ✅ |
| `SHOP_CHANNEL_ID` | Channel for daily shop posts | ✅ |
| `DB_HOST` | MySQL host | ✅ |
| `DB_USER` | MySQL username | ✅ |
| `DB_PASSWORD` | MySQL password | ✅ |
| `DB_NAME` | MySQL database name | ✅ |
| `DB_PORT` | MySQL port (default: 3306) | ❌ |

### Bot Permissions

The bot requires the following Discord permissions:
- Send Messages
- Embed Links
- Read Message History
- Use Slash Commands
- Add Reactions (for pagination)

## Architecture

```
src/
├── commands/
│   ├── slash/           # Slash command implementations
│   └── prefix/          # Prefix command implementations
├── handlers/
│   ├── commandHandler.js # Command loading and registration
│   ├── eventHandler.js   # Event loading
│   └── errorHandler.js   # Centralized error handling
├── events/
│   ├── ready.js         # Bot ready event
│   ├── interactionCreate.js # Slash commands & buttons
│   └── messageCreate.js # Prefix commands
├── utils/
│   ├── shopManager.js   # Shop display and pagination
│   ├── apiClient.js     # FNBR.co API integration
│   ├── database.js      # MySQL operations
│   ├── logger.js        # Winston logging
│   └── scheduler.js     # Cron job management
├── config/
│   └── database.sql     # Database schema
└── index.js            # Main entry point
```

## API Integration

This bot integrates with the [FNBR.co API](https://fnbr.co/api) to fetch:
- Current item shop data
- Item search results
- Item images and metadata

### Rate Limits
- 600 requests per minute with API key
- Intelligent caching reduces API usage
- Automatic retry with exponential backoff

## Database Schema

The bot maintains several tables for analytics:
- `command_usage` - Track command executions
- `shop_history` - Store daily shop data
- `error_logs` - Comprehensive error logging
- `user_interactions` - User behavior analytics
- `api_requests` - API performance monitoring
- `search_analytics` - Search query analysis

## Scheduled Tasks

- **Daily Shop Posting**: 1:30 AM UTC+1 (2:30 AM CET)
- **Cache Cleanup**: Every 6 hours
- **Database Maintenance**: Sundays at 2:00 AM UTC

## Error Handling

- Multi-level error recovery
- Automatic retries with exponential backoff
- Graceful degradation to cached data
- User-friendly error messages
- Comprehensive error logging

## Performance Optimization

- **Memory Management**: Efficient cache cleanup
- **API Optimization**: Smart caching with TTL
- **Database**: Connection pooling and prepared statements
- **Concurrency**: Limited concurrent API requests

## Deployment (Cybrancee Hosting)

1. **Upload files** to your Cybrancee server
2. **Install dependencies**: `npm install --production`
3. **Configure environment**: Set up `.env` file
4. **Database setup**: Import `database.sql`
5. **Process management**: Use PM2 or similar
6. **Start bot**: `npm start`

### PM2 Configuration
```bash
# Install PM2
npm install -g pm2

# Start bot with PM2
pm2 start src/index.js --name "fortnite-shop-bot"

# Save PM2 configuration
pm2 save

# Setup auto-restart
pm2 startup
```

## Monitoring

### Logs Location
- `logs/combined.log` - All log levels
- `logs/error.log` - Error logs only
- `logs/api.log` - API request logs

### Health Checks
The bot includes comprehensive logging for monitoring:
- Command execution times
- API response times
- Database query performance
- Error rates and types

## Troubleshooting

### Common Issues

**Database Connection Failed**
- Verify MySQL credentials in `.env`
- Ensure database exists and schema is imported
- Check network connectivity

**API Rate Limiting**
- Verify FNBR.co API key is valid
- Check API quota usage
- Review caching configuration

**Permission Errors**
- Verify bot has required Discord permissions
- Check trusted role ID configuration
- Ensure bot role is high enough in hierarchy

**Daily Shop Not Posting**
- Check `SHOP_CHANNEL_ID` configuration
- Verify bot permissions in target channel
- Review scheduler logs for errors

### Debug Mode
Set `NODE_ENV=development` for verbose logging.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Credits

- **API**: [FNBR.co](https://fnbr.co) for Fortnite item data
- **Author**: jdcomesta4
- **Framework**: Discord.js v14

## Support

For support or questions:
1. Check this README first
2. Review the logs for error details
3. Create an issue with relevant log information

---

**Note**: This bot requires valid FNBR.co API credentials. Please leave credit to fnbr.co when using their API as requested in their documentation.
