import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import prisma from '../config/db';
import { CoordinatorService } from './coordinator_service';

interface StreamProcess {
  channelId: string;
  process: ChildProcess;
  sourceUrl: string;
  lastAccessed: number;
  viewers: number;
  outputDir: string;
}

export class FFmpegService {
  private static activeProcesses = new Map<string, StreamProcess>();
  private static HLS_BASE_DIR = path.join(__dirname, '..', '..', 'hls');
  private static IDLE_TIMEOUT_MS = 180 * 1000; // 3 minutes
  private static startupTimer: NodeJS.Timeout | null = null;

  static init() {
    // Ensure base HLS directory exists
    if (!fs.existsSync(this.HLS_BASE_DIR)) {
      fs.mkdirSync(this.HLS_BASE_DIR, { recursive: true });
    }

    // Start idle stream monitor
    setInterval(() => {
      this.checkIdleStreams();
    }, 30000);

    // Periodically refresh ownership leases for running streams
    setInterval(async () => {
      for (const [channelId] of this.activeProcesses) {
        await CoordinatorService.refreshStreamOwnership(channelId);
      }
    }, 5000);

    // Clean up on server termination
    const cleanupAll = () => {
      console.log('Server shutting down. Terminating all active FFmpeg processes...');
      for (const [channelId] of this.activeProcesses) {
        this.stopStreamSync(channelId);
      }
    };
    process.on('exit', cleanupAll);
    process.on('SIGINT', () => { process.exit(0); });
    process.on('SIGTERM', () => { process.exit(0); });
  }

  static async startStream(channelId: string, sourceUrl: string): Promise<string> {
    this.touchStream(channelId);

    // Acquire lock in distributed cluster environment
    const lock = await CoordinatorService.acquireStreamOwnership(channelId);
    if (!lock.success) {
      console.log(`Lock acquired by another node (${lock.ownerNodeId}) for stream ${channelId}. Routing request.`);
      const ownerAddr = await CoordinatorService.getOwnerAddress(lock.ownerNodeId);
      if (ownerAddr) {
        // Return full remote cluster node URL path directly
        return `${ownerAddr}/hls/${channelId}/master.m3u8`;
      }
    }

    // If stream is already running for this URL, return HLS path
    const active = this.activeProcesses.get(channelId);
    if (active) {
      if (active.sourceUrl === sourceUrl) {
        active.viewers++;
        return `/hls/${channelId}/master.m3u8`;
      } else {
        // Source URL changed, stop old stream first
        await this.stopStream(channelId);
      }
    }

    const channelOutputDir = path.join(this.HLS_BASE_DIR, channelId);
    if (!fs.existsSync(channelOutputDir)) {
      fs.mkdirSync(channelOutputDir, { recursive: true });
    }

    const outputPlaylist = path.join(channelOutputDir, 'master.m3u8');

    console.log(`Starting FFmpeg stream process for channel: ${channelId} (URL: ${sourceUrl})`);

    // Input reconnect flags to avoid immediate exit on drop
    const ffmpegArgs = [
      '-reconnect', '1',
      '-reconnect_at_eof', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-re',
      '-i', sourceUrl,
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-f', 'hls',
      '-hls_time', '4',
      '-hls_list_size', '6',
      '-hls_flags', 'delete_segments+append_list+independent_segments',
      outputPlaylist
    ];

    const child = spawn('ffmpeg', ffmpegArgs, {
      stdio: 'ignore', // Ignore stdout/stderr to reduce I/O overload
      detached: false
    });

    const streamProcess: StreamProcess = {
      channelId,
      process: child,
      sourceUrl,
      lastAccessed: Date.now(),
      viewers: 1,
      outputDir: channelOutputDir
    };

    this.activeProcesses.set(channelId, streamProcess);

    child.on('exit', (code, signal) => {
      console.log(`FFmpeg process for channel ${channelId} exited with code ${code} (signal ${signal})`);
      const current = this.activeProcesses.get(channelId);
      if (current && current.process.pid === child.pid) {
        this.activeProcesses.delete(channelId);
        this.cleanupHlsFiles(channelOutputDir);
        // Trigger automated failover rotation
        this.handleStreamFailover(channelId, sourceUrl);
      }
    });

    // Wait until master.m3u8 playlist file is generated (max 10s wait)
    const playlistReady = await this.waitForPlaylist(outputPlaylist);
    if (!playlistReady) {
      this.stopStream(channelId);
      throw new Error('Timeout waiting for FFmpeg to generate HLS playlist.');
    }

    return `/hls/${channelId}/master.m3u8`;
  }

  static touchStream(channelId: string) {
    const active = this.activeProcesses.get(channelId);
    if (active) {
      active.lastAccessed = Date.now();
    }
  }

  static decrementViewer(channelId: string) {
    const active = this.activeProcesses.get(channelId);
    if (active && active.viewers > 0) {
      active.viewers--;
    }
  }

  static async stopStream(channelId: string): Promise<void> {
    const active = this.activeProcesses.get(channelId);
    if (!active) return;

    console.log(`Stopping FFmpeg stream for channel: ${channelId}`);
    active.process.removeAllListeners('exit');
    
    try {
      active.process.kill('SIGKILL');
    } catch (err) {
      console.error(`Failed to kill FFmpeg process:`, err);
    }

    await CoordinatorService.releaseStreamOwnership(channelId);
    this.activeProcesses.delete(channelId);
    this.cleanupHlsFiles(active.outputDir);
  }

  private static stopStreamSync(channelId: string): void {
    const active = this.activeProcesses.get(channelId);
    if (!active) return;
    active.process.removeAllListeners('exit');
    try {
      active.process.kill('SIGKILL');
    } catch (err) {}
    CoordinatorService.releaseStreamOwnership(channelId).catch(() => {});
    this.cleanupHlsFiles(active.outputDir);
  }

  static getActiveStreams() {
    return Array.from(this.activeProcesses.values()).map(p => ({
      channelId: p.channelId,
      sourceUrl: p.sourceUrl,
      viewers: p.viewers,
      uptimeSeconds: Math.floor((Date.now() - p.lastAccessed) / 1000),
      pid: p.process.pid
    }));
  }

  static getStreamState(channelId: string): 'RUNNING' | 'STOPPED' {
    return this.activeProcesses.has(channelId) ? 'RUNNING' : 'STOPPED';
  }

  private static cleanupHlsFiles(dir: string) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          fs.unlinkSync(path.join(dir, file));
        }
        fs.rmdirSync(dir);
        console.log(`Cleaned up HLS directory: ${dir}`);
      } catch (err) {
        console.error(`Error cleaning up directory ${dir}:`, err);
      }
    }
  }

  private static waitForPlaylist(playlistPath: string, timeoutMs: number = 10000): Promise<boolean> {
    return new Promise((resolve) => {
      const interval = 250;
      let elapsed = 0;

      const timer = setInterval(() => {
        if (fs.existsSync(playlistPath)) {
          // Read to ensure it is not empty
          try {
            const content = fs.readFileSync(playlistPath, 'utf8');
            if (content.includes('#EXTM3U') && content.includes('#EXT-X-VERSION')) {
              clearInterval(timer);
              resolve(true);
              return;
            }
          } catch (e) {}
        }

        elapsed += interval;
        if (elapsed >= timeoutMs) {
          clearInterval(timer);
          resolve(false);
        }
      }, interval);
    });
  }

  private static checkIdleStreams() {
    const now = Date.now();
    for (const [channelId, p] of this.activeProcesses) {
      if (p.viewers <= 0 && (now - p.lastAccessed) > this.IDLE_TIMEOUT_MS) {
        console.log(`Channel ${channelId} has been idle with no viewers for too long. Stopping stream...`);
        this.stopStream(channelId);
      }
    }
  }

  private static async handleStreamFailover(channelId: string, failedUrl: string) {
    try {
      console.log(`Failover initiated for channel ${channelId} due to failed stream: ${failedUrl}`);

      // Fetch sources
      const sources = await prisma.streamSource.findMany({
        where: { channelId },
        orderBy: { priority: 'asc' }
      });

      if (sources.length <= 1) {
        console.log(`No fallback stream sources configured for channel ${channelId}. Setting status to OFFLINE.`);
        await prisma.channel.update({
          where: { id: channelId },
          data: { status: 'OFFLINE' }
        });
        return;
      }

      // Mark the failed stream source as inactive
      const failedSource = sources.find(s => s.url === failedUrl);
      if (failedSource) {
        await prisma.streamSource.update({
          where: { id: failedSource.id },
          data: { isActive: false }
        });
      }

      // Find next backup source
      const nextSource = sources
        .filter(s => s.url !== failedUrl)
        .sort((a, b) => a.priority - b.priority)[0];

      if (nextSource) {
        console.log(`Found fallback source (Priority: ${nextSource.priority}) for channel ${channelId}. Activating...`);
        await prisma.streamSource.update({
          where: { id: nextSource.id },
          data: { isActive: true }
        });

        // Set status to DEGRADED (meaning it is active on backup)
        await prisma.channel.update({
          where: { id: channelId },
          data: { status: 'DEGRADED' }
        });

        // Log failover switch
        await prisma.healthLog.create({
          data: {
            channelId,
            status: 'DEGRADED',
            latency: 0
          }
        });
      } else {
        await prisma.channel.update({
          where: { id: channelId },
          data: { status: 'OFFLINE' }
        });
      }
    } catch (err) {
      console.error(`Failed to execute failover for channel ${channelId}:`, err);
    }
  }
}
