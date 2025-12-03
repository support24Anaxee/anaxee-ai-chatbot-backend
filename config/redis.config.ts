import Redis from 'ioredis';
import { config } from './env.config';
import logger from '../utils/logger';

/**
 * Redis client configuration and initialization
 */
class RedisClient {
    private static instance: Redis | null = null;

    static getInstance(): Redis {
        if (!this.instance) {
            console.log(config.redis)
            this.instance = new Redis({
                username:'default',
                host: config.redis?.host || 'localhost',
                port: config.redis?.port || 6379,
                password: config.redis?.password,
                // db: config.redis?.db || 0,
                retryStrategy: (times: number) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
                maxRetriesPerRequest: 3,
                tls: config.nodeEnv === 'development' ? undefined: {},
            });

            this.instance.on('connect', () => {
                logger.info('Redis client connected');
            });

            this.instance.on('error', (err) => {
                logger.error('Redis client error:', err);
                console.log(err)
            });

            this.instance.on('ready', () => {
                logger.info('Redis client ready');
            });
        }

        return this.instance;
    }

    static async disconnect(): Promise<void> {
        if (this.instance) {
            await this.instance.quit();
            this.instance = null;
            logger.info('Redis client disconnected');
        }
    }
}

export const redis = RedisClient.getInstance();
export default RedisClient;
