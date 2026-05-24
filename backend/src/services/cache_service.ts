import { redis } from '../config/redis';

export class CacheService {
  private static DEFAULT_TTL = 300; // 5 minutes

  static async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  static async set(key: string, value: any, ttlSeconds: number = this.DEFAULT_TTL): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }

  static async delete(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  }

  static async invalidateChannelCache(): Promise<void> {
    try {
      // Find and delete all channel-related keys
      const keys = await redis.keys('channels:*');
      const allKeys = [...keys, 'channels_all', 'channels_live', 'categories_all'];
      if (allKeys.length > 0) {
        await redis.del(...allKeys);
        console.log(`Cache invalidated for ${allKeys.length} keys.`);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }
}
