/// Channel model aligned with backend Prisma `Channel` table.
///
/// Key differences from Phase 1:
/// - `streamUrl` removed — streams are fetched from proxy via [StreamRepository]
/// - `categoryName` maps to backend field (aliased as `category` for UI compat)
/// - `status` (ONLINE/OFFLINE) added
/// - `viewCount` (int) replaces mock `viewers` string
/// - `currentShow` made optional (not in backend schema)
/// - `logo` made nullable (matches backend)
class Channel {
  final String id;
  final String name;
  final String? logo;
  final String category;
  final bool isLive;
  final String status;
  final int viewCount;
  final String? currentShow;
  final String? country;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const Channel({
    required this.id,
    required this.name,
    this.logo,
    required this.category,
    required this.isLive,
    this.status = 'ONLINE',
    this.viewCount = 0,
    this.currentShow,
    this.country,
    this.createdAt,
    this.updatedAt,
  });

  /// Parse from backend JSON response.
  ///
  /// Backend sends `categoryName` which we map to `category`.
  /// The `streamSources` array is ignored here — stream URLs
  /// are fetched separately through the proxy layer.
  factory Channel.fromJson(Map<String, dynamic> json) {
    return Channel(
      id: json['id'] as String,
      name: json['name'] as String,
      logo: json['logo'] as String?,
      category: json['categoryName'] as String? ?? json['category'] as String? ?? 'Unknown',
      isLive: json['isLive'] as bool? ?? false,
      status: json['status'] as String? ?? 'ONLINE',
      viewCount: json['viewCount'] as int? ?? 0,
      currentShow: json['currentShow'] as String?,
      country: json['country'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'logo': logo,
      'categoryName': category,
      'isLive': isLive,
      'status': status,
      'viewCount': viewCount,
      'currentShow': currentShow,
      'country': country,
    };
  }

  /// Formatted viewer count for display.
  String get formattedViewers {
    if (viewCount >= 1000000) {
      return '${(viewCount / 1000000).toStringAsFixed(1)}M watching';
    } else if (viewCount >= 1000) {
      return '${(viewCount / 1000).toStringAsFixed(1)}K watching';
    }
    return '$viewCount watching';
  }

  bool get isOnline => status == 'ONLINE';

  Channel copyWith({
    String? id,
    String? name,
    String? logo,
    String? category,
    bool? isLive,
    String? status,
    int? viewCount,
    String? currentShow,
    String? country,
  }) {
    return Channel(
      id: id ?? this.id,
      name: name ?? this.name,
      logo: logo ?? this.logo,
      category: category ?? this.category,
      isLive: isLive ?? this.isLive,
      status: status ?? this.status,
      viewCount: viewCount ?? this.viewCount,
      currentShow: currentShow ?? this.currentShow,
      country: country ?? this.country,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }
}
