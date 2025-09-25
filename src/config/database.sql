CREATE DATABASE IF NOT EXISTS fortnite_shop_bot;
USE fortnite_shop_bot;

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
