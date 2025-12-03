-- SQL Assistant Schema Migration
-- Run this to add new columns to the projects table

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS tables JSON COMMENT 'Array of table names to query',
ADD COLUMN IF NOT EXISTS business_rule TEXT COMMENT 'Project-specific SQL generation rules',
ADD COLUMN IF NOT EXISTS db_config JSON COMMENT 'Database connection configuration';

-- Example: Update existing project with SQL assistant configuration
UPDATE projects 
SET 
  tables = JSON_ARRAY('users', 'orders', 'products'),
  business_rule = '1. Always filter by active records\n2. Use created_at for date ranges\n3. Join tables on primary keys',
  db_config = JSON_OBJECT(
    'host', 'localhost',
    'user', 'root',
    'password', 'your_password',
    'database', 'your_database',
    'port', 3306
  )
WHERE slug = 'your-project-slug';

-- Verify the changes
SELECT id, name, slug, tables, business_rule, db_config 
FROM projects 
WHERE slug = 'your-project-slug';
