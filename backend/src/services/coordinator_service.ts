import os from 'os';
import { redis } from '../config/redis';

export class CoordinatorService {
  private static NODE_ID = process.env.HOSTNAME || `node_${os.hostname()}_${Math.random().toString(36).substring(2, 9)}`;
  private static advertiseAddress = process.env.POD_IP 
    ? `http://${process.env.POD_IP}:8080` 
    : `http://localhost:${process.env.PORT || '8080'}`;

  static init() {
    // Register node presence and set a heartbeat loop
    this.registerNodeHeartbeat();
    setInterval(() => {
      this.registerNodeHeartbeat();
    }, 15000);

    console.log(`Coordinator initialized. Node ID: ${this.NODE_ID}, Advertise URL: ${this.advertiseAddress}`);
  }

  private static async registerNodeHeartbeat() {
    try {
      // Store node address map in Redis with 30s TTL
      await redis.set(`node:addr:${this.NODE_ID}`, this.advertiseAddress, 'EX', 30);
    } catch (err) {
      console.error('Failed to write coordinator heartbeat to Redis:', err);
    }
  }

  static getNodeId(): string {
    return this.NODE_ID;
  }

  /**
   * Attempts to acquire the transcoding job lock for a channel.
   * Lock expires after 10 seconds.
   */
  static async acquireStreamOwnership(channelId: string): Promise<{ success: boolean; ownerNodeId: string }> {
    const lockKey = `stream:owner:${channelId}`;
    try {
      // Set key if not exists (NX) with 10 seconds expiration (EX)
      const acquired = await redis.set(lockKey, this.NODE_ID, 'EX', 10, 'NX');
      
      if (acquired === 'OK') {
        return { success: true, ownerNodeId: this.NODE_ID };
      }

      // If not acquired, read current owner
      const currentOwner = await redis.get(lockKey);
      if (!currentOwner) {
        // Edge case: lock expired between set and get, try acquiring again
        return this.acquireStreamOwnership(channelId);
      }

      const success = currentOwner === this.NODE_ID;
      return { success, ownerNodeId: currentOwner };
    } catch (err) {
      console.error(`Error acquiring stream ownership for channel ${channelId}:`, err);
      // Fallback: assume local ownership in case Redis fails
      return { success: true, ownerNodeId: this.NODE_ID };
    }
  }

  /**
   * Refreshes the lock expiration for streams owned by this node.
   */
  static async refreshStreamOwnership(channelId: string): Promise<boolean> {
    const lockKey = `stream:owner:${channelId}`;
    try {
      const owner = await redis.get(lockKey);
      if (owner === this.NODE_ID) {
        await redis.expire(lockKey, 10);
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Error refreshing ownership for channel ${channelId}:`, err);
      return false;
    }
  }

  /**
   * Releases stream ownership lock.
   */
  static async releaseStreamOwnership(channelId: string): Promise<void> {
    const lockKey = `stream:owner:${channelId}`;
    try {
      const owner = await redis.get(lockKey);
      if (owner === this.NODE_ID) {
        await redis.del(lockKey);
      }
    } catch (err) {
      console.error(`Error releasing ownership lock for channel ${channelId}:`, err);
    }
  }

  /**
   * Retrieves the URL of the node owning a stream.
   */
  static async getOwnerAddress(ownerNodeId: string): Promise<string | null> {
    if (ownerNodeId === this.NODE_ID) {
      return this.advertiseAddress;
    }
    try {
      return await redis.get(`node:addr:${ownerNodeId}`);
    } catch (err) {
      console.error(`Error looking up address for node ${ownerNodeId}:`, err);
      return null;
    }
  }
}
