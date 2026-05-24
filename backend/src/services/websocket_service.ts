import prisma from '../config/db';

export class WebSocketService {
  private static connections = new Set<any>();
  private static interval: NodeJS.Timeout | null = null;

  static registerConnection(socket: any) {
    this.connections.add(socket);
    
    // Send initial system logs
    try {
      const { LogService } = require('./log_service');
      socket.send(JSON.stringify({
        event: 'init_logs',
        data: LogService.getLogs(),
      }));
    } catch (e) {
      console.error('Error sending init logs:', e);
    }

    socket.on('close', () => {
      this.connections.delete(socket);
    });

    socket.on('error', (err: any) => {
      console.error('WebSocket client error:', err);
      this.connections.delete(socket);
    });
  }

  static broadcast(event: string, data: any) {
    const payload = JSON.stringify({ event, data });
    for (const socket of this.connections) {
      try {
        socket.send(payload);
      } catch (err) {
        // Socket could be broken or closed, remove it
        this.connections.delete(socket);
      }
    }
  }

  static startMetricsInterval() {
    if (this.interval) return;
    this.interval = setInterval(async () => {
      if (this.connections.size === 0) return;

      try {
        const { FFmpegService } = require('./ffmpeg_service');
        const activeStreams = FFmpegService.getActiveStreams();
        const totalViewers = activeStreams.reduce((sum: number, s: any) => sum + s.viewers, 0);

        // Fetch real database channel statistics
        const [totalChannels, onlineChannels, offlineChannels, activePlaylists] = await Promise.all([
          prisma.channel.count(),
          prisma.channel.count({ where: { status: 'ONLINE' } }),
          prisma.channel.count({ where: { status: 'OFFLINE' } }),
          prisma.playlist.count(),
        ]);

        this.broadcast('metrics_update', {
          totalChannels,
          onlineChannels,
          offlineChannels,
          activePlaylists,
          activeViewers: totalViewers,
          activeStreams,
          systemStatus: offlineChannels > (totalChannels * 0.3) ? 'WARNING' : 'HEALTHY',
        });
      } catch (err) {
        console.error('Error in WebSocket metrics broadcast:', err);
      }
    }, 5000);
  }
}
