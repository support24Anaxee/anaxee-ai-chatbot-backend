import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { config } from './env.config';

export const pool = mysql.createPool({
  host: config.db.host,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
});

export const db = drizzle(pool, { mode: 'default' });
