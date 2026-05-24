import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../config/db';
import { FFmpegService } from '../services/ffmpeg_service';
import { LogService } from '../services/log_service';

interface StreamSource {
  id: string;
  channelId: string;
  url: string;
  priority: number;
  isActive: boolean;
}

export class StreamController {
  static async getStreamUrl(req: FastifyRequest, reply: FastifyReply) {
    const { channelId } = req.params as { channelId: string };
    const { json } = req.query as { json?: string };

    try {
      // 1. Fetch channel and active stream sources from database
      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        include: { streamSources: true }
      });

      if (!channel) {
        return reply.status(404).send({ error: 'Channel not found' });
      }

      if (channel.streamSources.length === 0) {
        return reply.status(404).send({ error: 'No stream sources configured for this channel' });
      }

      // 2. Select active source or fallback to priority 1
      let source = channel.streamSources.find((s: StreamSource) => s.isActive) ||
                   [...channel.streamSources].sort((a: StreamSource, b: StreamSource) => a.priority - b.priority)[0];

      // 3. Start or join the FFmpeg restreaming task
      let localHlsPath: string;
      try {
        localHlsPath = await FFmpegService.startStream(channelId, source.url);
      } catch (err: any) {
        console.error(`Failed to start FFmpeg worker for channel ${channelId}:`, err);
        return reply.status(500).send({ error: 'Failed to initialize stream worker.', details: err.message });
      }

      // Track active viewing connection on connection exit
      req.raw.on('close', () => {
        FFmpegService.decrementViewer(channelId);
      });

      const protocol = req.protocol === 'http' && !req.hostname.includes('localhost') && !req.hostname.includes('127.0.0.1') ? 'https' : req.protocol;
      const host = req.hostname;
      const isRemote = localHlsPath.startsWith('http');
      const fullUrl = isRemote ? localHlsPath : `${protocol}://${host}${localHlsPath}`;

      if (json === 'true' || req.headers.accept?.includes('application/json')) {
        return reply.send({
          success: true,
          channelId,
          channelName: channel.name,
          streamUrl: fullUrl,
          status: channel.status
        });
      } else {
        // Redirect client directly to HLS server playlist (remote node or local segment folder)
        return reply.redirect(302, localHlsPath);
      }
    } catch (error) {
      console.error(`Error in getStreamUrl for channel ${channelId}:`, error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  }

  static async getStreamStatus(req: FastifyRequest, reply: FastifyReply) {
    const { channelId } = req.params as { channelId: string };

    try {
      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        include: { streamSources: { orderBy: { priority: 'asc' } } }
      });

      if (!channel) {
        return reply.status(404).send({ error: 'Channel not found' });
      }

      const activeStreams = FFmpegService.getActiveStreams();
      const processInfo = activeStreams.find((s: any) => s.channelId === channelId);

      const activeSource = channel.streamSources.find((s: StreamSource) => s.isActive) || channel.streamSources[0];

      // Mask URL for security
      const maskUrl = (url: string) => {
        try {
          const parsed = new URL(url);
          return `${parsed.protocol}//***hidden***${parsed.pathname}`;
        } catch {
          return 'http://***hidden***';
        }
      };

      return reply.send({
        channelId,
        channelName: channel.name,
        status: channel.status,
        processState: processInfo ? 'RUNNING' : 'STOPPED',
        activeSource: activeSource ? {
          id: activeSource.id,
          url: maskUrl(activeSource.url),
          priority: activeSource.priority,
          isActive: activeSource.isActive
        } : null,
        viewers: processInfo ? processInfo.viewers : 0,
        uptimeSeconds: processInfo ? processInfo.uptimeSeconds : 0,
        bitrateEstimationKbps: processInfo ? Math.floor(Math.random() * 800) + 1800 : 0 // Mocked for metrics
      });
    } catch (error) {
      console.error(`Failed to get stream status for channel ${channelId}:`, error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  }

  static async restartStream(req: FastifyRequest, reply: FastifyReply) {
    const { channelId } = req.params as { channelId: string };

    try {
      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        include: { streamSources: true }
      });

      if (!channel) {
        return reply.status(404).send({ error: 'Channel not found' });
      }

      LogService.log('WARNING', 'AdminAction', `Manual transcode pipeline restart requested for ${channel.name} (ID: ${channelId})`);
      await FFmpegService.stopStream(channelId);

      if (channel.streamSources.length === 0) {
        LogService.log('ERROR', 'AdminAction', `No stream sources to start for channel ${channelId}`);
        return reply.status(400).send({ error: 'No stream sources to start' });
      }

      const source = channel.streamSources.find((s: StreamSource) => s.isActive) ||
                     [...channel.streamSources].sort((a: StreamSource, b: StreamSource) => a.priority - b.priority)[0];

      const localHlsPath = await FFmpegService.startStream(channelId, source.url);
      LogService.log('SUCCESS', 'AdminAction', `Transcode pipeline restarted successfully for ${channel.name} (ID: ${channelId})`);

      return reply.send({
        success: true,
        message: 'Stream restarted successfully',
        streamUrl: localHlsPath
      });
    } catch (error: any) {
      LogService.log('ERROR', 'AdminAction', `Failed to restart stream for channel ${channelId}: ${error.message || error}`);
      return reply.status(500).send({ error: 'Failed to restart stream', details: error.message });
    }
  }

  static async prewarmStream(req: FastifyRequest, reply: FastifyReply) {
    const { channelId } = req.params as { channelId: string };

    try {
      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        include: { streamSources: true }
      });

      if (!channel) {
        return reply.status(404).send({ error: 'Channel not found' });
      }

      if (channel.streamSources.length === 0) {
        return reply.status(404).send({ error: 'No stream sources configured for this channel' });
      }

      const activeStreams = FFmpegService.getActiveStreams();
      const processInfo = activeStreams.find((s: any) => s.channelId === channelId);

      if (processInfo) {
        // Stream already running or pre-warmed
        return reply.send({ success: true, message: 'Stream already active or pre-warmed.' });
      }

      const source = channel.streamSources.find((s: StreamSource) => s.isActive) ||
                     [...channel.streamSources].sort((a: StreamSource, b: StreamSource) => a.priority - b.priority)[0];

      // Trigger asynchronous background pre-warming process (prewarm = true)
      FFmpegService.startStream(channelId, source.url, true).catch(err => {
        console.error(`Failed to prewarm stream for channel ${channelId}:`, err);
      });

      return reply.send({
        success: true,
        message: 'Stream pre-warming initiated successfully.'
      });
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to pre-warm stream', details: error.message });
    }
  }
}
