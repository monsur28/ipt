import fastify from 'fastify';
import cors from '@fastify/cors';
import path from 'path';
import fastifyStatic from '@fastify/static';
import cron from 'node-cron';
import fastifyWebsocket from '@fastify/websocket';
import apiRoutes from './routes/api';
import { HealthCheckService } from './services/health_check_service';
import { FFmpegService } from './services/ffmpeg_service';
import { CoordinatorService } from './services/coordinator_service';
import { MetricsService } from './services/metrics_service';
import { WebSocketService } from './services/websocket_service';
import { LogService } from './services/log_service';

const server = fastify({
  logger: true,
});

// Register WebSocket plugin
server.register(fastifyWebsocket);

// Configure CORS for local development and admin UI access
server.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

// Register static file serving for HLS streams (.m3u8 and .ts segments)
server.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'hls'),
  prefix: '/hls',
  decorateReply: false,
});

// Register REST API routes prefixing with /api
server.register(apiRoutes, { prefix: '/api' });

// Health check endpoint for container orchestration
server.get('/health', async () => {
  return { status: 'OK', timestamp: new Date() };
});

// Prometheus scraping metrics endpoint
server.get('/metrics', async (req, reply) => {
  const metrics = await MetricsService.getPrometheusMetrics();
  reply.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  return reply.send(metrics);
});

const start = async () => {
  try {
    // Initialize Coordinator Service
    CoordinatorService.init();
    // Initialize FFmpeg Service
    FFmpegService.init();
    
    // Start WebSocket metrics interval
    WebSocketService.startMetricsInterval();

    const port = parseInt(process.env.PORT || '8080');
    // Listen on 0.0.0.0 is critical for Docker containers to be reachable
    await server.listen({ port, host: '0.0.0.0' });
    LogService.log('SUCCESS', 'System', `Fastify core cluster booted. Running at http://localhost:${port}`);

    // Schedule Stream Health Monitoring Worker to run every 60 seconds
    cron.schedule('*/1 * * * *', async () => {
      console.log('Running scheduled health checks...');
      await HealthCheckService.runHealthChecks();
    });

    // Run health check worker once immediately at startup
    setTimeout(async () => {
      console.log('Running initial startup health checks...');
      await HealthCheckService.runHealthChecks();
    }, 5000);

  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
