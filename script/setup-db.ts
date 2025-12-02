import mysql from 'mysql2/promise';
import { config } from '../config/env.config';

async function setupDb() {
    try {
        const connection = await mysql.createConnection({
            host: config.db.host,
            user: config.db.user,
            password: config.db.password,
        });

        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.database}\`;`);
        console.log(`Database '${config.db.database}' created or already exists.`);

        await connection.end();
    } catch (error) {
        console.error('Error creating database:', error);
        process.exit(1);
    }
}

setupDb();
