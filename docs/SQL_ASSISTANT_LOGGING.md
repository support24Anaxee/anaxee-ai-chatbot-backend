# SQL Assistant Logging System

## Overview

A comprehensive logging system has been implemented to track all SQL assistant queries, execution metrics, and token usage for analytics and optimization.

## Database Schema

### `sql_assistant_logs` Table

```sql
CREATE TABLE sql_assistant_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chat_id INT,
    project_id INT NOT NULL,
    user_message TEXT NOT NULL,
    generated_sql TEXT,
    execution_time_ms INT,
    schema_fetch_time_ms INT,
    sql_generation_time_ms INT,
    query_execution_time_ms INT,
    response_generation_time_ms INT,
    row_count INT,
    token_usage JSON,
    status VARCHAR(50) NOT NULL DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Tracked Metrics

### Timing Metrics
- **execution_time_ms**: Total end-to-end execution time
- **schema_fetch_time_ms**: Time to fetch schema (cache hit/miss)
- **sql_generation_time_ms**: Time for AI to generate SQL query
- **query_execution_time_ms**: Time to execute SQL on database
- **response_generation_time_ms**: Time for AI to generate natural language response

### Token Usage
Stored as JSON with fields:
- `promptTokens`: Tokens in the input prompt
- `candidatesTokens`: Tokens in the generated response
- `totalTokens`: Total tokens used
- `cachedContentTokens`: Tokens served from cache

### Status
- `success`: Query executed successfully
- `error`: Query failed with error
- `no_data`: Query executed but returned no results

## Usage

### Automatic Logging

All queries through `askStream()` are automatically logged:

```typescript
// Logs are created automatically
for await (const event of assistant.askStream(query, chatHistory, chatId)) {
    // Process events...
}
// Log entry created with all metrics
```

### Query Logs

```typescript
import { createLog } from './services/sql-assistant-logging.service';

await createLog({
    chatId: 123,
    projectId: 1,
    userMessage: 'How many users?',
    generatedSql: 'SELECT COUNT(*) FROM users',
    executionTimeMs: 1500,
    schemaFetchTimeMs: 10,
    sqlGenerationTimeMs: 800,
    queryExecutionTimeMs: 50,
    responseGenerationTimeMs: 640,
    rowCount: 1,
    tokenUsage: {
        promptTokens: 150,
        candidatesTokens: 50,
        totalTokens: 200
    },
    status: 'success'
});
```

### Retrieve Logs

```typescript
import { getLogsByProject, getLogsByChat } from './services/sql-assistant-logging.service';

// Get logs for a project
const projectLogs = await getLogsByProject(projectId, 100);

// Get logs for a specific chat
const chatLogs = await getLogsByChat(chatId);
```

### Analytics

```typescript
import { getProjectAnalytics } from './services/sql-assistant-logging.service';

const analytics = await getProjectAnalytics(projectId);
// Returns:
// {
//     totalQueries: 150,
//     successfulQueries: 140,
//     errorQueries: 5,
//     noDataQueries: 5,
//     avgExecutionTime: 1200,  // ms
//     avgTokens: 180
// }
```

## SQL Queries for Analysis

### View Recent Logs

```sql
SELECT 
    id,
    user_message,
    generated_sql,
    execution_time_ms,
    row_count,
    JSON_EXTRACT(token_usage, '$.totalTokens') as total_tokens,
    status,
    created_at
FROM sql_assistant_logs
ORDER BY created_at DESC
LIMIT 10;
```

### Performance Analysis

```sql
SELECT 
    AVG(execution_time_ms) as avg_total_time,
    AVG(schema_fetch_time_ms) as avg_schema_time,
    AVG(sql_generation_time_ms) as avg_sql_gen_time,
    AVG(query_execution_time_ms) as avg_query_exec_time,
    AVG(response_generation_time_ms) as avg_response_time
FROM sql_assistant_logs
WHERE status = 'success'
    AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY);
```

### Token Usage Analysis

```sql
SELECT 
    DATE(created_at) as date,
    COUNT(*) as query_count,
    SUM(JSON_EXTRACT(token_usage, '$.totalTokens')) as total_tokens,
    AVG(JSON_EXTRACT(token_usage, '$.totalTokens')) as avg_tokens_per_query
FROM sql_assistant_logs
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Error Analysis

```sql
SELECT 
    error_message,
    COUNT(*) as error_count,
    MAX(created_at) as last_occurrence
FROM sql_assistant_logs
WHERE status = 'error'
GROUP BY error_message
ORDER BY error_count DESC;
```

### Slowest Queries

```sql
SELECT 
    user_message,
    generated_sql,
    execution_time_ms,
    schema_fetch_time_ms,
    sql_generation_time_ms,
    query_execution_time_ms,
    response_generation_time_ms,
    created_at
FROM sql_assistant_logs
WHERE status = 'success'
ORDER BY execution_time_ms DESC
LIMIT 10;
```

## Migration

Run the migration SQL:

```bash
mysql -u root -p your_database < migrations/create_sql_assistant_logs.sql
```

## Benefits

1. **Performance Monitoring**: Track execution times to identify bottlenecks
2. **Cost Tracking**: Monitor token usage for API cost management
3. **Error Analysis**: Identify common failure patterns
4. **Query Optimization**: Find slow queries and optimize
5. **Usage Analytics**: Understand user behavior and popular queries
6. **Debugging**: Full audit trail for troubleshooting
7. **Cache Effectiveness**: Measure schema cache hit rates

## Dashboard Ideas

### Metrics to Display
- Total queries today/week/month
- Average execution time trend
- Token usage trend
- Success rate percentage
- Most common queries
- Error rate and types
- Cache hit rate (schema_fetch_time_ms < 50ms)

### Example Dashboard Query

```sql
SELECT 
    COUNT(*) as total_queries,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
    AVG(execution_time_ms) as avg_time,
    SUM(JSON_EXTRACT(token_usage, '$.totalTokens')) as total_tokens,
    SUM(CASE WHEN schema_fetch_time_ms < 50 THEN 1 ELSE 0 END) as cache_hits
FROM sql_assistant_logs
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR);
```
