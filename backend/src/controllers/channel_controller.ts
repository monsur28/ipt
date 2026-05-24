import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../config/db';
import { CacheService } from '../services/cache_service';
import { LogService } from '../services/log_service';

export class ChannelController {
  static async getChannels(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as { category?: string; page?: string; limit?: string };
    const category = query.category;
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '50');
    const skip = (page - 1) * limit;

    const cacheKey = `channels:cat_${category || 'all'}:p_${page}:l_${limit}`;

    // Try reading cache
    const cachedData = await CacheService.get<any>(cacheKey);
    if (cachedData) {
      return reply.send(cachedData);
    }

    // Build database query filters
    const where: any = {};
    if (category) {
      where.categoryName = category;
    }

    try {
      const [channels, total] = await Promise.all([
        prisma.channel.findMany({
          where,
          include: { streamSources: true },
          skip,
          take: limit,
          orderBy: { name: 'asc' },
        }),
        prisma.channel.count({ where }),
      ]);

      const response = {
        data: channels,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };

      // Set cache
      await CacheService.set(cacheKey, response);

      return reply.send(response);
    } catch (error) {
      console.error('Failed to get channels:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  }

  static async getChannelById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };

    try {
      const channel = await prisma.channel.findUnique({
        where: { id },
        include: {
          streamSources: {
            orderBy: { priority: 'asc' },
          },
          healthLogs: {
            take: 10,
            orderBy: { checkedAt: 'desc' },
          },
        },
      });

      if (!channel) {
        return reply.status(404).send({ error: 'Channel not found' });
      }

      return reply.send(channel);
    } catch (error) {
      console.error(`Failed to get channel details for ${id}:`, error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  }

  static async getLiveChannels(req: FastifyRequest, reply: FastifyReply) {
    const cacheKey = 'channels_live';
    const cached = await CacheService.get<any>(cacheKey);
    if (cached) {
      return reply.send(cached);
    }

    try {
      const channels = await prisma.channel.findMany({
        where: { isLive: true },
        include: { streamSources: true },
        orderBy: { name: 'asc' },
      });

      await CacheService.set(cacheKey, channels);
      return reply.send(channels);
    } catch (error) {
      console.error('Failed to get live channels:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  }

  static async searchChannels(req: FastifyRequest, reply: FastifyReply) {
    const { q } = req.query as { q?: string };
    if (!q) {
      return reply.send([]);
    }

    try {
      const channels = await prisma.channel.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { categoryName: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: { streamSources: true },
        take: 30,
      });

      return reply.send(channels);
    } catch (error) {
      console.error(`Failed to search channels for ${q}:`, error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  }

  static async getCategories(req: FastifyRequest, reply: FastifyReply) {
    const cacheKey = 'categories_all';
    const cached = await CacheService.get<any>(cacheKey);
    if (cached) {
      return reply.send(cached);
    }

    try {
      const categories = await prisma.category.findMany({
        include: {
          _count: {
            select: { channels: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      await CacheService.set(cacheKey, categories);
      return reply.send(categories);
    } catch (error) {
      console.error('Failed to get categories:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  }

  // Update channel (Admin actions)
  static async updateChannel(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const body = req.body as { name?: string; logo?: string; categoryName?: string; isLive?: boolean };

    try {
      const updatedChannel = await prisma.channel.update({
        where: { id },
        data: body,
      });

      LogService.log('INFO', 'AdminAction', `Channel ${updatedChannel.name} (ID: ${id}) updated by admin.`);
      await CacheService.invalidateChannelCache();
      return reply.send(updatedChannel);
    } catch (error) {
      LogService.log('ERROR', 'AdminAction', `Failed to update channel ${id}: ${error}`);
      return reply.status(500).send({ error: 'Failed to update channel' });
    }
  }

  // Delete channel (Admin actions)
  static async deleteChannel(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };

    try {
      const deletedChannel = await prisma.channel.delete({
        where: { id },
      });

      LogService.log('WARNING', 'AdminAction', `Channel ${deletedChannel.name} (ID: ${id}) deleted by admin.`);
      await CacheService.invalidateChannelCache();
      return reply.send({ success: true, message: 'Channel deleted successfully' });
    } catch (error) {
      LogService.log('ERROR', 'AdminAction', `Failed to delete channel ${id}: ${error}`);
      return reply.status(500).send({ error: 'Failed to delete channel' });
    }
  }
}
