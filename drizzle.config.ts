import { defineConfig } from 'drizzle-kit';
import { config } from './config/env.config';

export default defineConfig({
    schema: './models/index.ts',
    out: './drizzle',
    dialect: 'mysql',
    dbCredentials: {
        host: config.db.host,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
    },
});
