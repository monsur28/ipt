import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../config/db';
import { IngestionService } from '../services/ingestion_service';
import { CacheService } from '../services/cache_service';

export class PlaylistController {
  static async importPlaylist(req: FastifyRequest, reply: FastifyReply) {
    const { url, name } = req.body as { url: string; name: string };

    if (!url || !name) {
      return reply.status(400).send({ error: 'url and name are required' });
    }

    try {
      // Run ingestion
      const result = await IngestionService.importPlaylist(url, name);
      if (!result.success) {
        return reply.status(500).send({ error: result.message });
      }
      return reply.send(result);
    } catch (error) {
      console.error('Failed to import playlist:', error);
      return reply.status(500).send({ error: 'Failed to process import' });
    }
  }

  static async getPlaylists(req: FastifyRequest, reply: FastifyReply) {
    try {
      const playlists = await prisma.playlist.findMany({
        orderBy: { lastFetchedAt: 'desc' },
      });
      return reply.send(playlists);
    } catch (error) {
      console.error('Failed to get playlists:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  }

  // Stream Source operations
  static async addStreamSource(req: FastifyRequest, reply: FastifyReply) {
    const { channelId, url, priority } = req.body as { channelId: string; url: string; priority?: number };

    if (!channelId || !url) {
      return reply.status(400).send({ error: 'channelId and url are required' });
    }

    try {
      // Get current sources count for auto priority
      const count = await prisma.streamSource.count({
        where: { channelId },
      });

      const source = await prisma.streamSource.create({
        data: {
          channelId,
          url,
          priority: priority ?? (count + 1),
          isActive: count === 0, // Make primary if first source
        },
      });

      await CacheService.invalidateChannelCache();
      return reply.send(source);
    } catch (error) {
      console.error(`Failed to add stream source for channel ${channelId}:`, error);
      return reply.status(500).send({ error: 'Failed to add source' });
    }
  }

  static async updateStreamSource(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const body = req.body as { url?: string; priority?: number; isActive?: boolean };

    try {
      // If we are setting this source as active, we must deactivate other sources of the same channel
      if (body.isActive === true) {
        const source = await prisma.streamSource.findUnique({ where: { id } });
        if (source) {
          await prisma.streamSource.updateMany({
            where: { channelId: source.channelId },
            data: { isActive: false },
          });
        }
      }

      const updated = await prisma.streamSource.update({
        where: { id },
        data: body,
      });

      await CacheService.invalidateChannelCache();
      return reply.send(updated);
    } catch (error) {
      console.error(`Failed to update stream source ${id}:`, error);
      return reply.status(500).send({ error: 'Failed to update source' });
    }
  }

  static async deleteStreamSource(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };

    try {
      await prisma.streamSource.delete({
        where: { id },
      });

      await CacheService.invalidateChannelCache();
      return reply.send({ success: true, message: 'Stream source deleted' });
    } catch (error) {
      console.error(`Failed to delete stream source ${id}:`, error);
      return reply.status(500).send({ error: 'Failed to delete source' });
    }
  }

  // General System Overview metrics endpoint
  static async getSystemMetrics(req: FastifyRequest, reply: FastifyReply) {
    try {
      const [totalChannels, liveChannels, offlineChannels, activePlaylists] = await Promise.all([
        prisma.channel.count(),
        prisma.channel.count({ where: { status: 'ONLINE', isLive: true } }),
        prisma.channel.count({ where: { status: 'OFFLINE' } }),
        prisma.playlist.count(),
      ]);

      // Mock active viewers as random dynamic data for phase 2 visualization
      const mockActiveViewers = totalChannels > 0 ? Math.floor(Math.random() * 5000) + 1200 : 0;

      return reply.send({
        totalChannels,
        liveChannels,
        offlineChannels,
        activePlaylists,
        activeViewers: mockActiveViewers,
        systemStatus: offlineChannels > (totalChannels * 0.3) ? 'WARNING' : 'HEALTHY',
      });
    } catch (error) {
      console.error('Failed to fetch system metrics:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  }
}
