import '../../models/channel.dart';
import '../../models/category.dart';
import '../services/api_service.dart';

/// Repository for channel and category API operations.
///
/// Encapsulates all REST API calls related to channels and categories.
/// Consumers (providers) never interact with [ApiService] directly.
class ChannelRepository {
  final ApiService _api;

  ChannelRepository(this._api);

  /// Fetch paginated channels, optionally filtered by category.
  ///
  /// Maps backend response shape:
  /// ```json
  /// { "data": [...], "meta": { "total": 50, "page": 1, ... } }
  /// ```
  Future<List<Channel>> getChannels({
    String? category,
    int page = 1,
    int limit = 50,
  }) async {
    final params = <String, dynamic>{
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (category != null && category.isNotEmpty) {
      params['category'] = category;
    }

    final response = await _api.get('/channels', queryParameters: params);

    // Backend wraps channels in `data` key with pagination meta
    final List<dynamic> channelList =
        response is Map ? (response['data'] as List<dynamic>? ?? []) : (response as List<dynamic>);

    return channelList
        .map((json) => Channel.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  /// Fetch only live channels.
  Future<List<Channel>> getLiveChannels() async {
    final response = await _api.get('/channels/live');

    final List<dynamic> channelList = response is List ? response : [];
    return channelList
        .map((json) => Channel.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  /// Server-side search by query string.
  Future<List<Channel>> searchChannels(String query) async {
    if (query.trim().isEmpty) return [];

    final response = await _api.get(
      '/channels/search',
      queryParameters: {'q': query.trim()},
    );

    final List<dynamic> channelList = response is List ? response : [];
    return channelList
        .map((json) => Channel.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  /// Fetch a single channel by ID with full details.
  Future<Channel> getChannelById(String id) async {
    final response = await _api.get('/channels/$id');
    return Channel.fromJson(response as Map<String, dynamic>);
  }

  /// Fetch all categories with channel counts.
  Future<List<Category>> getCategories() async {
    final response = await _api.get('/categories');

    final List<dynamic> catList = response is List ? response : [];
    return catList
        .map((json) => Category.fromJson(json as Map<String, dynamic>))
        .toList();
  }
}
