import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import prisma from '../config/db';
import { CoordinatorService } from './coordinator_service';
import { LogService } from './log_service';
import { WebSocketService } from './websocket_service';

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
  private static getFFmpegCommand(): string {
    const customPath = 'C:\\Users\\monsu\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';
    if (fs.existsSync(customPath)) {
      return customPath;
    }
    return process.env.FFMPEG_PATH || 'ffmpeg';
  }

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

  static async startStream(channelId: string, sourceUrl: string, prewarm = false): Promise<string> {
    this.touchStream(channelId);

    // Acquire lock in distributed cluster environment
    const lock = await CoordinatorService.acquireStreamOwnership(channelId);
    if (!lock.success) {
      LogService.log('INFO', 'Cluster', `Lock acquired by another node (${lock.ownerNodeId}) for stream ${channelId}. Routing request.`);
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
        if (!prewarm) {
          active.viewers++;
        }
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

    LogService.log('INFO', 'Transcoder', `Starting FFmpeg HLS stream pipeline for channel ${channelId}`);

    // Input options to allow connection to secured private channels
    const ffmpegArgs = [
      '-tls_verify', '0',
      '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '-i', sourceUrl,
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-f', 'hls',
      '-hls_time', '2',
      '-hls_list_size', '6',
      '-hls_flags', 'delete_segments+append_list+independent_segments',
      outputPlaylist
    ];

    const ffmpegCmd = this.getFFmpegCommand();
    const child = spawn(ffmpegCmd, ffmpegArgs, {
      stdio: ['ignore', 'ignore', 'pipe'],
      detached: false
    });

    child.stderr?.on('data', (data) => {
      console.log(`[FFMPEG-STDERR-${channelId}] ${data.toString().trim()}`);
    });

    // Handle startup errors (like ENOENT when FFmpeg is not found) to prevent crash
    child.on('error', (err) => {
      LogService.log('ERROR', 'Transcoder', `FFmpeg failed to start for channel ${channelId}: ${err.message}`);
      WebSocketService.broadcast('stream_failure', { channelId, code: 1, signal: err.message });
      
      const current = this.activeProcesses.get(channelId);
      if (current) {
        this.activeProcesses.delete(channelId);
        this.cleanupHlsFiles(channelOutputDir);
      }
    });

    const streamProcess: StreamProcess = {
      channelId,
      process: child,
      sourceUrl,
      lastAccessed: Date.now(),
      viewers: prewarm ? 0 : 1,
      outputDir: channelOutputDir
    };

    this.activeProcesses.set(channelId, streamProcess);

    child.on('exit', (code, signal) => {
      LogService.log('WARNING', 'Transcoder', `FFmpeg process for channel ${channelId} exited with code ${code} (signal ${signal})`);
      
      // Broadcast stream failure to websocket if exit is abnormal
      if (code !== 0 && code !== null) {
        WebSocketService.broadcast('stream_failure', { channelId, code, signal });
      }

      const current = this.activeProcesses.get(channelId);
      if (current && current.process.pid === child.pid) {
        this.activeProcesses.delete(channelId);
        this.cleanupHlsFiles(channelOutputDir);
        // Trigger automated failover rotation
        this.handleStreamFailover(channelId, sourceUrl);
      }
    });

    if (prewarm) {
      return `/hls/${channelId}/master.m3u8`;
    }

    // Wait until master.m3u8 playlist file is generated (max 30s wait)
    const playlistReady = await this.waitForPlaylist(outputPlaylist, 30000);
    if (!playlistReady) {
      await this.handleStreamFailover(channelId, sourceUrl);
      await this.stopStream(channelId);
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

    LogService.log('INFO', 'Transcoder', `Stopping FFmpeg stream for channel: ${channelId}`);
    active.process.removeAllListeners('exit');
    
    try {
      active.process.kill('SIGKILL');
    } catch (err) {
      LogService.log('ERROR', 'Transcoder', `Failed to kill FFmpeg process: ${err}`);
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

  private static waitForPlaylist(playlistPath: string, timeoutMs: number = 30000): Promise<boolean> {
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
        LogService.log('INFO', 'Transcoder', `Channel ${channelId} has been idle with no viewers for too long. Stopping stream...`);
        this.stopStream(channelId);
      }
    }
  }

  private static async handleStreamFailover(channelId: string, failedUrl: string) {
    try {
      LogService.log('WARNING', 'Failover', `Failover initiated for channel ${channelId} due to failed stream: ${failedUrl}`);

      // Fetch sources
      const sources = await prisma.streamSource.findMany({
        where: { channelId },
        orderBy: { priority: 'asc' }
      });

      if (sources.length <= 1) {
        LogService.log('ERROR', 'Failover', `No fallback stream sources configured for channel ${channelId}. Setting status to OFFLINE.`);
        await prisma.channel.update({
          where: { id: channelId },
          data: { status: 'OFFLINE' }
        });
        WebSocketService.broadcast('channel_status', { id: channelId, status: 'OFFLINE' });
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
        LogService.log('SUCCESS', 'Failover', `Found fallback source (Priority: ${nextSource.priority}) for channel ${channelId}. Activating...`);
        await prisma.streamSource.update({
          where: { id: nextSource.id },
          data: { isActive: true }
        });

        // Set status to DEGRADED (meaning it is active on backup)
        await prisma.channel.update({
          where: { id: channelId },
          data: { status: 'DEGRADED' }
        });
        WebSocketService.broadcast('channel_status', { id: channelId, status: 'DEGRADED' });

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
        WebSocketService.broadcast('channel_status', { id: channelId, status: 'OFFLINE' });
      }
    } catch (err) {
      LogService.log('ERROR', 'Failover', `Failed to execute failover for channel ${channelId}: ${err}`);
    }
  }
}
