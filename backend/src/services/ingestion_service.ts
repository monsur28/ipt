import axios from 'axios';
import parser from 'iptv-playlist-parser';
import { StreamSource } from '@prisma/client';
import prisma from '../config/db';
import { CacheService } from './cache_service';

export class IngestionService {
  private static autoAssignCategory(name: string, groupTitle: string): string {
    const normName = name.toLowerCase();
    const normGroup = (groupTitle || '').toLowerCase();

    if (
      normName.includes('football') ||
      normName.includes('soccer') ||
      normName.includes('laliga') ||
      normName.includes('premier') ||
      normName.includes('serie a') ||
      normName.includes('champions league') ||
      normGroup.includes('football') ||
      normGroup.includes('soccer')
    ) {
      return 'Football';
    }
    if (
      normName.includes('cricket') ||
      normName.includes('ipl') ||
      normName.includes('t20') ||
      normName.includes('odi') ||
      normName.includes('ashes') ||
      normGroup.includes('cricket')
    ) {
      return 'Cricket';
    }
    if (
      normName.includes('basketball') ||
      normName.includes('nba') ||
      normName.includes('euroleague') ||
      normGroup.includes('basketball') ||
      normGroup.includes('nba')
    ) {
      return 'Basketball';
    }
    if (
      normName.includes('tennis') ||
      normName.includes('wimbledon') ||
      normName.includes('us open') ||
      normName.includes('atp') ||
      normGroup.includes('tennis')
    ) {
      return 'Tennis';
    }
    if (
      normName.includes('ufc') ||
      normName.includes('mma') ||
      normName.includes('fight') ||
      normName.includes('bellator') ||
      normGroup.includes('ufc') ||
      normGroup.includes('mma') ||
      normGroup.includes('fight')
    ) {
      return 'UFC / MMA';
    }
    return groupTitle ? groupTitle : 'Sports';
  }

  static async importPlaylist(url: string, name: string): Promise<{ success: boolean; importedCount: number; message: string }> {
    try {
      console.log(`Fetching M3U playlist from: ${url}`);
      const response = await axios.get(url, { timeout: 15000 });
      
      if (!response.data) {
        throw new Error('Playlist content is empty');
      }

      console.log('Parsing M3U playlist...');
      const parsed = parser.parse(response.data);
      console.log(`Parsed ${parsed.items.length} items from M3U.`);

      let importedCount = 0;

      // Wrap in a transaction or iterate and save
      for (const item of parsed.items) {
        if (!item.url || !item.name) continue;

        const categoryName = this.autoAssignCategory(item.name, item.group.title);

        // 1. Ensure Category exists
        await prisma.category.upsert({
          where: { name: categoryName },
          create: {
            name: categoryName,
            slug: categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          },
          update: {},
        });

        // 2. Check if channel exists by name
        let channel = await prisma.channel.findFirst({
          where: { name: item.name },
          include: { streamSources: true },
        });

        if (!channel) {
          // Create Channel
          channel = await prisma.channel.create({
            data: {
              name: item.name,
              logo: item.tvg.logo || null,
              categoryName: categoryName,
              isLive: item.name.toLowerCase().includes('live') || item.name.toLowerCase().includes('tv'),
              status: 'ONLINE',
            },
            include: { streamSources: true },
          });
          importedCount++;
        }

        // 3. Check if stream source URL exists for this channel
        const streamExists = channel.streamSources.some((s: StreamSource) => s.url === item.url);
        if (!streamExists) {
          const priority = channel.streamSources.length + 1;
          await prisma.streamSource.create({
            data: {
              channelId: channel.id,
              url: item.url,
              priority: priority,
              isActive: priority === 1, // Set primary to active
            },
          });
        }
      }

      // Track the playlist import
      await prisma.playlist.upsert({
        where: { sourceUrl: url },
        create: {
          name: name,
          sourceUrl: url,
          lastFetchedAt: new Date(),
        },
        update: {
          name: name,
          lastFetchedAt: new Date(),
        },
      });

      // Clear cache upon change
      await CacheService.invalidateChannelCache();

      return {
        success: true,
        importedCount: importedCount,
        message: `Successfully processed ${parsed.items.length} items. Imported ${importedCount} new channels.`,
      };
    } catch (error: any) {
      console.error('Playlist import failed:', error);
      return {
        success: false,
        importedCount: 0,
        message: error.message || 'Unknown error occurred during import',
      };
    }
  }
}
