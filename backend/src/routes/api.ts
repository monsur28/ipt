import { FastifyInstance } from 'fastify';
import { ChannelController } from '../controllers/channel_controller';
import { PlaylistController } from '../controllers/playlist_controller';
import { StreamController } from '../controllers/stream_controller';
import { WebSocketService } from '../services/websocket_service';
import { LogService } from '../services/log_service';

export default async function apiRoutes(fastify: FastInstance) {
  // Real-time WebSocket connection
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    WebSocketService.registerConnection(connection.socket);
  });

  // System logs
  fastify.get('/logs', async (req, reply) => {
    return reply.send(LogService.getLogs());
  });

  // System metrics overview
  fastify.get('/system/metrics', PlaylistController.getSystemMetrics);

  // Channel routes
  fastify.get('/channels', ChannelController.getChannels);
  fastify.get('/channels/live', ChannelController.getLiveChannels);
  fastify.get('/channels/search', ChannelController.searchChannels);
  fastify.get('/channels/:id', ChannelController.getChannelById);
  fastify.patch('/channels/:id', ChannelController.updateChannel);
  fastify.delete('/channels/:id', ChannelController.deleteChannel);

  // Categories route
  fastify.get('/categories', ChannelController.getCategories);

  // Playlist imports & status
  fastify.get('/playlists', PlaylistController.getPlaylists);
  fastify.post('/playlists/import', PlaylistController.importPlaylist);
  fastify.post('/playlist/import', PlaylistController.importPlaylist); // Aligned alias

  // Stream source configurations
  fastify.post('/stream-sources', PlaylistController.addStreamSource);
  fastify.patch('/stream-sources/:id', PlaylistController.updateStreamSource);
  fastify.delete('/stream-sources/:id', PlaylistController.deleteStreamSource);

  // Stream Delivery routes
  fastify.get('/stream/:channelId', StreamController.getStreamUrl);
  fastify.get('/stream/:channelId/master.m3u8', StreamController.getStreamUrl);
  fastify.get('/stream/:channelId/status', StreamController.getStreamStatus);
  fastify.post('/stream/prewarm/:channelId', StreamController.prewarmStream);
  fastify.post('/stream/restart/:channelId', StreamController.restartStream);
  fastify.post('/channel/restart/:channelId', StreamController.restartStream); // Aligned alias
}

// FastifyInstance typing helper
type FastInstance = FastifyInstance;
