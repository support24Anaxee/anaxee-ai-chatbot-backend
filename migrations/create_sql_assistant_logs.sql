-- SQL Assistant Logging Table Migration
-- Tracks all SQL assistant queries with execution metrics and token usage

CREATE TABLE IF NOT EXISTS sql_assistant_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chat_id INT,
    project_id INT NOT NULL,
    user_message TEXT NOT NULL,
    generated_sql TEXT,
    execution_time_ms INT COMMENT 'Total execution time in milliseconds',
    schema_fetch_time_ms INT COMMENT 'Time to fetch schema from cache/DB',
    sql_generation_time_ms INT COMMENT 'Time for AI to generate SQL',
    query_execution_time_ms INT COMMENT 'Time to execute SQL query',
    response_generation_time_ms INT COMMENT 'Time for AI to generate response',
    row_count INT COMMENT 'Number of rows returned by query',
    token_usage JSON COMMENT 'AI token usage metadata',
    status VARCHAR(50) NOT NULL DEFAULT 'success' COMMENT 'success, error, no_data',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE SET NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    
    INDEX idx_project_id (project_id),
    INDEX idx_chat_id (chat_id),
    INDEX idx_created_at (created_at),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Example query to view logs
-- SELECT 
--     id,
--     user_message,
--     generated_sql,
--     execution_time_ms,
--     row_count,
--     JSON_EXTRACT(token_usage, '$.totalTokens') as total_tokens,
--     status,
--     created_at
-- FROM sql_assistant_logs
-- ORDER BY created_at DESC
-- LIMIT 10;
