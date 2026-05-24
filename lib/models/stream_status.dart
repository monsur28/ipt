/// Stream status model from `GET /api/stream/:channelId/status`.
///
/// Used for displaying real-time stream health in the player UI.
class StreamStatus {
  final String channelId;
  final String channelName;
  final String status; // ONLINE, OFFLINE
  final String processState; // RUNNING, STOPPED
  final int viewers;
  final int uptimeSeconds;
  final int bitrateEstimationKbps;

  const StreamStatus({
    required this.channelId,
    required this.channelName,
    required this.status,
    required this.processState,
    this.viewers = 0,
    this.uptimeSeconds = 0,
    this.bitrateEstimationKbps = 0,
  });

  factory StreamStatus.fromJson(Map<String, dynamic> json) {
    return StreamStatus(
      channelId: json['channelId'] as String,
      channelName: json['channelName'] as String? ?? '',
      status: json['status'] as String? ?? 'OFFLINE',
      processState: json['processState'] as String? ?? 'STOPPED',
      viewers: json['viewers'] as int? ?? 0,
      uptimeSeconds: json['uptimeSeconds'] as int? ?? 0,
      bitrateEstimationKbps: json['bitrateEstimationKbps'] as int? ?? 0,
    );
  }

  bool get isOnline => status == 'ONLINE';
  bool get isRunning => processState == 'RUNNING';

  String get formattedViewers {
    if (viewers >= 1000000) {
      return '${(viewers / 1000000).toStringAsFixed(1)}M watching';
    } else if (viewers >= 1000) {
      return '${(viewers / 1000).toStringAsFixed(1)}K watching';
    }
    return '$viewers watching';
  }

  String get formattedUptime {
    final hours = uptimeSeconds ~/ 3600;
    final minutes = (uptimeSeconds % 3600) ~/ 60;
    if (hours > 0) return '${hours}h ${minutes}m';
    return '${minutes}m';
  }
}
