import mysql from 'mysql2/promise';
import { config } from '../config/env.config';

async function migrate() {
    try {
        const connection = await mysql.createConnection({
            host: config.db.host,
            user: config.db.user,
            password: config.db.password,
            database: config.db.database,
        });

        console.log('Starting migration...');

        // Create projects table
        await connection.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        script_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        console.log('Created projects table');

        // Insert default project if not exists
        await connection.query(`
      INSERT IGNORE INTO projects (id, name, slug, script_name) 
      VALUES (1, 'Default Project', 'default', 'apar_sql');
    `);
        console.log('Inserted default project');

        // Check if project_id column exists
        const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = '${config.db.database}' 
        AND TABLE_NAME = 'chats' 
        AND COLUMN_NAME = 'project_id';
    `);

        if ((columns as any[]).length === 0) {
            // Add project_id column to chats table
            await connection.query(`
        ALTER TABLE chats 
        ADD COLUMN project_id INT NOT NULL DEFAULT 1;
      `);
            console.log('Added project_id column to chats');

            // Add foreign key constraint
            await connection.query(`
        ALTER TABLE chats 
        ADD CONSTRAINT chats_project_id_projects_id_fk 
        FOREIGN KEY (project_id) REFERENCES projects(id)
        ON DELETE RESTRICT ON UPDATE CASCADE;
      `);
            console.log('Added foreign key constraint');
        } else {
            console.log('project_id column already exists');
        }

        await connection.end();
        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
