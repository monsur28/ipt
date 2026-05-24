/// Environment configuration for API endpoints.
///
/// Override at build time using `--dart-define`:
/// ```
/// flutter run --dart-define=API_BASE_URL=https://your-server.com/api
/// flutter run --dart-define=STREAM_BASE_URL=https://your-server.com/api/stream
/// ```
class Env {
  Env._();

  /// Base URL for the REST API (Fastify backend from Phase 2).
  /// Defaults to Android emulator → host machine localhost.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8080/api',
  );

  /// Base URL for the stream proxy layer (Phase 3).
  /// Streams are fetched as: `$streamBaseUrl/$channelId?json=true`
  static const String streamBaseUrl = String.fromEnvironment(
    'STREAM_BASE_URL',
    defaultValue: 'http://10.0.2.2:8080/api/stream',
  );

  /// Timeout for API connections (seconds).
  static const int connectTimeoutSeconds = 10;

  /// Timeout for API response receive (seconds).
  static const int receiveTimeoutSeconds = 15;

  /// Test stream URL — ONLY used as absolute last resort fallback.
  static const String testStreamUrl =
      'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
}
