import prisma from '../config/db';
import { FFmpegService } from './ffmpeg_service';
import { CoordinatorService } from './coordinator_service';

export class MetricsService {
  static async getPrometheusMetrics(): Promise<string> {
    const lines: string[] = [];

    // Gather node information
    const nodeId = CoordinatorService.getNodeId();
    lines.push('# HELP iptv_node_info Node presence and metadata details.');
    lines.push('# TYPE iptv_node_info gauge');
    lines.push(`iptv_node_info{node_id="${nodeId}"} 1`);

    // Gather database counts
    try {
      const [totalChannels, liveChannels, offlineChannels, activePlaylists] = await Promise.all([
        prisma.channel.count(),
        prisma.channel.count({ where: { status: 'ONLINE', isLive: true } }),
        prisma.channel.count({ where: { status: 'OFFLINE' } }),
        prisma.playlist.count()
      ]);

      lines.push('# HELP iptv_database_channels_total Total number of registered channels in DB.');
      lines.push('# TYPE iptv_database_channels_total gauge');
      lines.push(`iptv_database_channels_total ${totalChannels}`);

      lines.push('# HELP iptv_database_channels_live Number of online live channels in DB.');
      lines.push('# TYPE iptv_database_channels_live gauge');
      lines.push(`iptv_database_channels_live ${liveChannels}`);

      lines.push('# HELP iptv_database_channels_offline Number of offline channels in DB.');
      lines.push('# TYPE iptv_database_channels_offline gauge');
      lines.push(`iptv_database_channels_offline ${offlineChannels}`);

      lines.push('# HELP iptv_database_playlists_total Total playlists registered.');
      lines.push('# TYPE iptv_database_playlists_total gauge');
      lines.push(`iptv_database_playlists_total ${activePlaylists}`);
    } catch (dbErr) {
      console.error('Failed to query DB telemetry metrics:', dbErr);
    }

    // Gather active streams from local FFmpeg processes
    const activeStreams = FFmpegService.getActiveStreams();
    const activeCount = activeStreams.length;

    lines.push('# HELP iptv_ffmpeg_active_processes Current active local transcode processes.');
    lines.push('# TYPE iptv_ffmpeg_active_processes gauge');
    lines.push(`iptv_ffmpeg_active_processes ${activeCount}`);

    // Stream-specific gauges
    lines.push('# HELP iptv_stream_viewers Count of concurrent viewers per channel.');
    lines.push('# TYPE iptv_stream_viewers gauge');
    
    lines.push('# HELP iptv_stream_uptime_seconds Process uptime duration per channel.');
    lines.push('# TYPE iptv_stream_uptime_seconds gauge');

    for (const stream of activeStreams) {
      lines.push(`iptv_stream_viewers{channel_id="${stream.channelId}"} ${stream.viewers}`);
      lines.push(`iptv_stream_uptime_seconds{channel_id="${stream.channelId}"} ${stream.uptimeSeconds}`);
    }

    return lines.join('\n') + '\n';
  }
}
