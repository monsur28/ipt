import axios from 'axios';
import { StreamSource } from '@prisma/client';
import prisma from '../config/db';
import { CacheService } from './cache_service';
import { FFmpegService } from './ffmpeg_service';
import { LogService } from './log_service';
import { WebSocketService } from './websocket_service';

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
    LogService.log('INFO', 'HealthCheck', 'Starting parallel stream health check worker...');
    try {
      const channels = await prisma.channel.findMany({
        include: { streamSources: true },
      });

      let cacheInvalidationNeeded = false;
      const concurrency = 15; // Concurrent testing workers
      const queue = [...channels];

      const runWorker = async () => {
        while (queue.length > 0) {
          const channel = queue.shift();
          if (!channel) continue;

          try {
            if (channel.streamSources.length === 0) {
              if (channel.status !== 'OFFLINE') {
                await prisma.channel.update({
                  where: { id: channel.id },
                  data: { status: 'OFFLINE' },
                });
                cacheInvalidationNeeded = true;
                WebSocketService.broadcast('channel_status', { id: channel.id, name: channel.name, status: 'OFFLINE' });
                LogService.log('WARNING', 'HealthCheck', `Channel ${channel.name} set to OFFLINE due to no configured stream sources.`);
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
              LogService.log('WARNING', 'HealthCheck', `Primary source failed for channel: ${channel.name}. Searching for backups...`);
              
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
                LogService.log('INFO', 'HealthCheck', `Checking backup source (priority: ${backup.priority}) for channel: ${channel.name}`);
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
                  LogService.log('SUCCESS', 'HealthCheck', `Successfully switched to backup source for channel: ${channel.name}`);
                  
                  // Terminate any active FFmpeg worker so it restarts with the new backup URL on the next viewer touch
                  await FFmpegService.stopStream(channel.id);
                  break;
                }
              }

              if (!fallbackSuccess) {
                LogService.log('ERROR', 'HealthCheck', `All backup sources failed for channel: ${channel.name}`);
              }
            }

            // Update general channel status in DB if it changed
            if (channel.status !== finalStatus) {
              await prisma.channel.update({
                where: { id: channel.id },
                data: { status: finalStatus },
              });
              cacheInvalidationNeeded = true;
              WebSocketService.broadcast('channel_status', { id: channel.id, name: channel.name, status: finalStatus });
              if (finalStatus === 'OFFLINE') {
                LogService.log('ERROR', 'HealthCheck', `Channel status CRITICAL: ${channel.name} is now OFFLINE`);
              } else {
                LogService.log('INFO', 'HealthCheck', `Channel status updated: ${channel.name} is now ${finalStatus}`);
              }
            }
          } catch (err) {
            console.error(`Error checking health for channel ${channel.id}:`, err);
          }
        }
      };

      // Spawn concurrent workers to drain the queue in parallel
      const workers = Array.from({ length: concurrency }, () => runWorker());
      await Promise.all(workers);

      if (cacheInvalidationNeeded) {
        await CacheService.invalidateChannelCache();
      }
      LogService.log('INFO', 'HealthCheck', 'Stream health check worker cycle completed.');
    } catch (error) {
      LogService.log('ERROR', 'HealthCheck', `Error running stream health checks: ${error}`);
    }
  }
}
