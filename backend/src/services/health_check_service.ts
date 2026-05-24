import axios from 'axios';
import { StreamSource } from '@prisma/client';
import prisma from '../config/db';
import { CacheService } from './cache_service';
import { FFmpegService } from './ffmpeg_service';

export class HealthCheckService {
  private static async testStreamUrl(url: string): Promise<{ isOnline: boolean; latency: number }> {
    const startTime = Date.now();
    try {
      // 1. Try HEAD request first (fast, no body download)
      const headResponse = await axios.head(url, {
        timeout: 5000,
        validateStatus: (status) => status >= 200 && status < 400,
      });
      return {
        isOnline: true,
        latency: Date.now() - startTime,
      };
    } catch (headError) {
      // 2. Fall back to GET request with byte range if HEAD is blocked/fails
      try {
        const getResponse = await axios.get(url, {
          headers: { Range: 'bytes=0-100' }, // Request small chunk only
          timeout: 5000,
          validateStatus: (status) => status >= 200 && status < 400,
        });
        return {
          isOnline: true,
          latency: Date.now() - startTime,
        };
      } catch (getError) {
        return {
          isOnline: false,
          latency: Date.now() - startTime,
        };
      }
    }
  }

  static async runHealthChecks(): Promise<void> {
    console.log('Starting stream health check worker...');
    try {
      const channels = await prisma.channel.findMany({
        include: { streamSources: true },
      });

      let cacheInvalidationNeeded = false;

      for (const channel of channels) {
        if (channel.streamSources.length === 0) {
          if (channel.status !== 'OFFLINE') {
            await prisma.channel.update({
              where: { id: channel.id },
              data: { status: 'OFFLINE' },
            });
            cacheInvalidationNeeded = true;
          }
          continue;
        }

        // Find current active source or fallback to priority 1
        let activeSource = channel.streamSources.find((s: StreamSource) => s.isActive) || 
                       channel.streamSources.sort((a: StreamSource, b: StreamSource) => a.priority - b.priority)[0];

        let testResult = await this.testStreamUrl(activeSource.url);
        let finalStatus = testResult.isOnline ? 'ONLINE' : 'OFFLINE';

        // Log health check results
        await prisma.healthLog.create({
          data: {
            channelId: channel.id,
            status: finalStatus,
            latency: testResult.latency,
          },
        });

        // Failover Logic: If active source is offline and backup sources exist
        if (!testResult.isOnline && channel.streamSources.length > 1) {
          console.log(`Primary source failed for channel: ${channel.name}. Searching for backups...`);
          
          // Deactivate current failing source
          await prisma.streamSource.update({
            where: { id: activeSource.id },
            data: { isActive: false },
          });

          // Find other sources sorted by priority
          const backups = channel.streamSources
            .filter((s: StreamSource) => s.id !== activeSource.id)
            .sort((a: StreamSource, b: StreamSource) => a.priority - b.priority);

          let fallbackSuccess = false;
          for (const backup of backups) {
            console.log(`Checking backup source (priority: ${backup.priority}) for channel: ${channel.name}`);
            const backupResult = await this.testStreamUrl(backup.url);
            
            await prisma.healthLog.create({
              data: {
                channelId: channel.id,
                status: backupResult.isOnline ? 'ONLINE' : 'OFFLINE',
                latency: backupResult.latency,
              },
            });

            if (backupResult.isOnline) {
              // Found a working backup! Make it active
              await prisma.streamSource.update({
                where: { id: backup.id },
                data: { isActive: true },
              });
              finalStatus = backup.priority > 1 ? 'DEGRADED' : 'ONLINE';
              fallbackSuccess = true;
              console.log(`Successfully switched to backup source for channel: ${channel.name}`);
              
              // Terminate any active FFmpeg worker so it restarts with the new backup URL on the next viewer touch
              await FFmpegService.stopStream(channel.id);
              break;
            }
          }

          if (!fallbackSuccess) {
            console.log(`All backup sources failed for channel: ${channel.name}`);
          }
        }

        // Update general channel status in DB if it changed
        if (channel.status !== finalStatus) {
          await prisma.channel.update({
            where: { id: channel.id },
            data: { status: finalStatus },
          });
          cacheInvalidationNeeded = true;
        }
      }

      if (cacheInvalidationNeeded) {
        await CacheService.invalidateChannelCache();
      }
      console.log('Stream health check worker cycle completed.');
    } catch (error) {
      console.error('Error running stream health checks:', error);
    }
  }
}
