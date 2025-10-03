-- CREATE DATABASE IF NOT EXISTS your_database_name;
-- USE your_database_name;
-- Note: Replace 'your_database_name' with the value from your DB_NAME environment variable

-- Command usage tracking
CREATE TABLE IF NOT EXISTS command_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    username VARCHAR(100),
    command_name VARCHAR(50) NOT NULL,
    parameters TEXT,
    guild_id VARCHAR(20),
    guild_name VARCHAR(100),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    INDEX idx_user_id (user_id),
    INDEX idx_command_name (command_name),
    INDEX idx_timestamp (timestamp)
);

-- Shop history and analytics
CREATE TABLE IF NOT EXISTS shop_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    total_items INT NOT NULL,
    sections_count INT NOT NULL,
    sections_data JSON,
    api_response_time_ms INT,
    fetch_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    posted_to_discord BOOLEAN DEFAULT FALSE,
    post_timestamp DATETIME,
    INDEX idx_date (date),
    INDEX idx_fetch_timestamp (fetch_timestamp)
);

-- Comprehensive error logging
CREATE TABLE IF NOT EXISTS error_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    error_type VARCHAR(100) NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    context_data JSON,
    user_id VARCHAR(20),
    guild_id VARCHAR(20),
    command_name VARCHAR(50),
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    resolved BOOLEAN DEFAULT FALSE,
    INDEX idx_timestamp (timestamp),
    INDEX idx_error_type (error_type),
    INDEX idx_severity (severity)
);

-- User interaction tracking
CREATE TABLE IF NOT EXISTS user_interactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    username VARCHAR(100),
    interaction_type ENUM('command', 'button', 'search', 'pagination') NOT NULL,
    details JSON,
    guild_id VARCHAR(20),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id VARCHAR(50),
    INDEX idx_user_id (user_id),
    INDEX idx_interaction_type (interaction_type),
    INDEX idx_timestamp (timestamp)
);

-- API request tracking
CREATE TABLE IF NOT EXISTS api_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    endpoint VARCHAR(200) NOT NULL,
    method VARCHAR(10) DEFAULT 'GET',
    response_time_ms INT,
    status_code INT,
    success BOOLEAN,
    error_message TEXT,
    request_size_bytes INT,
    response_size_bytes INT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_endpoint (endpoint),
    INDEX idx_timestamp (timestamp),
    INDEX idx_success (success)
);

-- Item search analytics
CREATE TABLE IF NOT EXISTS search_analytics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    search_query VARCHAR(200) NOT NULL,
    search_type VARCHAR(50),
    search_rarity VARCHAR(50),
    results_found INT,
    execution_time_ms INT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_search_query (search_query),
    INDEX idx_timestamp (timestamp),
    INDEX idx_user_id (user_id)
);

-- Guild configurations
CREATE TABLE IF NOT EXISTS guild_configs (
    guild_id VARCHAR(20) PRIMARY KEY,
    guild_name VARCHAR(100),
    shop_channel_id VARCHAR(20),
    daily_updates_enabled BOOLEAN DEFAULT TRUE,
    trusted_role_id VARCHAR(20),
    configured_by VARCHAR(20),
    configured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_shop_channel_id (shop_channel_id),
    INDEX idx_configured_at (configured_at)
);

-- User wishlists
CREATE TABLE IF NOT EXISTS user_wishlists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    item_name VARCHAR(200) NOT NULL,
    item_type VARCHAR(100),
    item_rarity VARCHAR(50),
    item_icon_url TEXT,
    item_price INT,
    date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_notified DATE DEFAULT NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_item_name (item_name),
    INDEX idx_date_added (date_added),
    UNIQUE KEY unique_user_item (user_id, item_name)
);

-- Wishlist notification configuration
CREATE TABLE IF NOT EXISTS wishlist_notifications_config (
    guild_id VARCHAR(20) PRIMARY KEY,
    updates_channel_id VARCHAR(20) NOT NULL,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    configured_by VARCHAR(20),
    configured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_updates_channel_id (updates_channel_id)
);

-- User notification preferences
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    user_id VARCHAR(20) PRIMARY KEY,
    wishlist_notifications_enabled BOOLEAN DEFAULT TRUE,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
