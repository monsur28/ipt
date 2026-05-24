import '../../core/constants/env.dart';
import '../../models/stream_status.dart';
import '../services/api_service.dart';
import '../services/api_exception.dart';

/// Repository for stream delivery API operations.
///
/// Handles fetching proxy stream URLs and stream health status.
/// **Frontend NEVER accesses raw IPTV URLs** — only proxy URLs from this repo.
class StreamRepository {
  final ApiService _api;

  StreamRepository(this._api);

  /// Get the proxied HLS stream URL for a channel.
  ///
  /// Calls `GET /api/stream/:channelId?json=true` which returns:
  /// ```json
  /// {
  ///   "success": true,
  ///   "channelId": "uuid",
  ///   "streamUrl": "http://proxy/hls/uuid/playlist.m3u8",
  ///   "status": "ONLINE"
  /// }
  /// ```
  ///
  /// The [streamUrl] is a stable, masked proxy URL — never a raw IPTV source.
  Future<String> getStreamUrl(String channelId) async {
    try {
      final response = await _api.get(
        '/stream/$channelId',
        queryParameters: {'json': 'true'},
      );

      final streamUrl = response['streamUrl'] as String?;
      if (streamUrl == null || streamUrl.isEmpty) {
        throw const ApiException(
          message: 'Stream URL not available for this channel.',
        );
      }

      return streamUrl;
    } on NotFoundException {
      // Channel has no configured stream sources
      rethrow;
    } on ApiException {
      rethrow;
    }
  }

  /// Get real-time stream status and health metrics.
  Future<StreamStatus> getStreamStatus(String channelId) async {
    final response = await _api.get('/stream/$channelId/status');
    return StreamStatus.fromJson(response as Map<String, dynamic>);
  }

  /// Attempt to get stream URL with retry logic.
  ///
  /// Retries [maxRetries] times before falling back to test stream.
  /// On each retry, waits [retryDelayMs] before the next attempt.
  Future<String> getStreamUrlWithRetry(
    String channelId, {
    int maxRetries = 2,
    int retryDelayMs = 1500,
  }) async {
    ApiException? lastError;

    for (int attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await getStreamUrl(channelId);
      } on ApiException catch (e) {
        lastError = e;
        if (attempt < maxRetries) {
          await Future.delayed(Duration(milliseconds: retryDelayMs));
        }
      }
    }

    // All retries exhausted — use test stream as absolute last resort
    // This ensures the player doesn't crash, but shows degraded quality
    if (Env.testStreamUrl.isNotEmpty) {
      return Env.testStreamUrl;
    }

    throw lastError ??
        const ApiException(message: 'Failed to load stream after retries.');
  }
}
