import { redis } from '../config/redis.config';
import { CacheError } from '../types/errors';
import logger from './logger';

/**
 * Cache utility functions
 */

/**
 * Get value from cache
 */
export const getCached = async <T>(key: string): Promise<T | null> => {
    try {
        const cached = await redis.get(key);
        if (!cached) {
            return null;
        }
        return JSON.parse(cached) as T;
    } catch (error) {
        logger.error(`Cache get error for key ${key}:`, error);
        throw new CacheError(`Failed to get cached value: ${error}`);
    }
};

/**
 * Set value in cache with TTL
 */
export const setCached = async <T>(
    key: string,
    value: T,
    ttl: number
): Promise<void> => {
    try {
        await redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
        logger.error(`Cache set error for key ${key}:`, error);
        throw new CacheError(`Failed to set cached value: ${error}`);
    }
};

/**
 * Delete value from cache
 */
export const deleteCached = async (key: string): Promise<void> => {
    try {
        await redis.del(key);
    } catch (error) {
        logger.error(`Cache delete error for key ${key}:`, error);
        throw new CacheError(`Failed to delete cached value: ${error}`);
    }
};

/**
 * Delete multiple keys matching a pattern
 */
export const deletePattern = async (pattern: string): Promise<void> => {
    try {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
            await redis.del(...keys);
        }
    } catch (error) {
        logger.error(`Cache delete pattern error for ${pattern}:`, error);
        throw new CacheError(`Failed to delete cached pattern: ${error}`);
    }
};

/**
 * Check if key exists in cache
 */
export const existsInCache = async (key: string): Promise<boolean> => {
    try {
        const exists = await redis.exists(key);
        return exists === 1;
    } catch (error) {
        logger.error(`Cache exists error for key ${key}:`, error);
        return false;
    }
};

/**
 * Get or set cached value with a factory function
 */
export const getOrSetCached = async <T>(
    key: string,
    ttl: number,
    factory: () => Promise<T>
): Promise<T> => {
    try {
        // Try to get from cache
        const cached = await getCached<T>(key);
        if (cached !== null) {
            logger.info(`Cache hit for key: ${key}`);
            return cached;
        }

        // Cache miss, generate value
        logger.info(`Cache miss for key: ${key}`);
        const value = await factory();

        // Store in cache
        await setCached(key, value, ttl);

        return value;
    } catch (error) {
        logger.error(`Get or set cache error for key ${key}:`, error);
        throw error;
    }
};
