import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/channel.dart';
import '../models/category.dart';
import '../services/storage_service.dart';
import '../data/services/api_service.dart';
import '../data/repositories/channel_repository.dart';
import '../data/repositories/stream_repository.dart';

// ============================================================
// SERVICE & REPOSITORY PROVIDERS (Dependency Injection)
// ============================================================

/// Storage Service Provider — overridden in main.dart after Hive init.
final storageServiceProvider = Provider<StorageService>((ref) {
  throw UnimplementedError('storageService has not been initialized');
});

/// Centralized Dio HTTP client.
final apiServiceProvider = Provider<ApiService>((ref) {
  return ApiService();
});

/// Channel & category repository.
final channelRepositoryProvider = Provider<ChannelRepository>((ref) {
  return ChannelRepository(ref.read(apiServiceProvider));
});

/// Stream URL & status repository.
final streamRepositoryProvider = Provider<StreamRepository>((ref) {
  return StreamRepository(ref.read(apiServiceProvider));
});

// ============================================================
// THEME PROVIDER (Local — Hive, unchanged from Phase 1)
// ============================================================

final themeModeProvider = StateNotifierProvider<ThemeModeNotifier, bool>((ref) {
  final storage = ref.read(storageServiceProvider);
  return ThemeModeNotifier(storage);
});

class ThemeModeNotifier extends StateNotifier<bool> {
  final StorageService _storage;

  ThemeModeNotifier(this._storage) : super(_storage.isAmoledTheme());

  Future<void> toggleTheme() async {
    state = !state;
    await _storage.setAmoledTheme(state);
  }
}

// ============================================================
// FAVORITES PROVIDER (Local — Hive, unchanged from Phase 1)
// ============================================================

final favoritesProvider = StateNotifierProvider<FavoritesNotifier, List<String>>((ref) {
  final storage = ref.read(storageServiceProvider);
  return FavoritesNotifier(storage);
});

class FavoritesNotifier extends StateNotifier<List<String>> {
  final StorageService _storage;

  FavoritesNotifier(this._storage) : super([]) {
    _loadFavorites();
  }

  void _loadFavorites() {
    state = _storage.getFavoriteIds();
  }

  Future<void> toggleFavorite(String channelId) async {
    await _storage.toggleFavorite(channelId);
    _loadFavorites();
  }

  bool isFavorite(String channelId) {
    return state.contains(channelId);
  }
}

// ============================================================
// CHANNEL PROVIDERS (Async — from Backend API)
// ============================================================

/// All channels (paginated, first page).
final channelsProvider = FutureProvider<List<Channel>>((ref) async {
  final repo = ref.read(channelRepositoryProvider);
  return repo.getChannels(limit: 200);
});

/// Live channels only.
final liveChannelsProvider = FutureProvider<List<Channel>>((ref) async {
  final repo = ref.read(channelRepositoryProvider);
  return repo.getLiveChannels();
});

/// Channels filtered by category name.
final channelsByCategoryProvider =
    FutureProvider.family<List<Channel>, String>((ref, category) async {
  final repo = ref.read(channelRepositoryProvider);
  return repo.getChannels(category: category, limit: 200);
});

/// Single channel by ID.
final channelDetailProvider =
    FutureProvider.family<Channel, String>((ref, channelId) async {
  final repo = ref.read(channelRepositoryProvider);
  return repo.getChannelById(channelId);
});

// ============================================================
// CATEGORY PROVIDERS (Async — from Backend API)
// ============================================================

/// All categories with channel counts.
final categoriesProvider = FutureProvider<List<Category>>((ref) async {
  final repo = ref.read(channelRepositoryProvider);
  return repo.getCategories();
});

// ============================================================
// SEARCH PROVIDERS
// ============================================================

/// Current search query text.
final searchQueryProvider = StateProvider<String>((ref) => '');

/// Selected category filter for search.
final selectedCategoryProvider = StateProvider<String>((ref) => 'All');

/// Debounced search results from API.
///
/// Watches [searchQueryProvider] and [selectedCategoryProvider].
/// When the query is non-empty, calls backend search API.
/// When query is empty but category is selected, fetches by category.
/// When both are default, returns all channels.
final searchResultsProvider = FutureProvider<List<Channel>>((ref) async {
  final query = ref.watch(searchQueryProvider).trim();
  final category = ref.watch(selectedCategoryProvider);
  final repo = ref.read(channelRepositoryProvider);

  if (query.isNotEmpty) {
    // Server-side search
    final results = await repo.searchChannels(query);
    // Apply local category filter on search results if needed
    if (category != 'All') {
      return results
          .where((c) => c.category.toLowerCase() == category.toLowerCase())
          .toList();
    }
    return results;
  }

  if (category != 'All') {
    return repo.getChannels(category: category, limit: 200);
  }

  return repo.getChannels(limit: 200);
});

// ============================================================
// STREAM PROVIDERS (Async — from Proxy Layer)
// ============================================================

/// Fetch proxied stream URL for a channel (with retry logic).
final streamUrlProvider =
    FutureProvider.family<String, String>((ref, channelId) async {
  final repo = ref.read(streamRepositoryProvider);
  return repo.getStreamUrlWithRetry(channelId);
});

// ============================================================
// RECENTLY WATCHED (Session-based, unchanged from Phase 1)
// ============================================================

final recentlyWatchedProvider =
    StateNotifierProvider<RecentlyWatchedNotifier, List<Channel>>((ref) {
  return RecentlyWatchedNotifier();
});

class RecentlyWatchedNotifier extends StateNotifier<List<Channel>> {
  RecentlyWatchedNotifier() : super([]);

  void addChannel(Channel channel) {
    final list = List<Channel>.from(state)
      ..removeWhere((c) => c.id == channel.id);
    state = [channel, ...list].take(5).toList();
  }
}

// ============================================================
// SERVER HEALTH CHECK
// ============================================================

/// Check if the backend is reachable.
final serverHealthProvider = FutureProvider<bool>((ref) async {
  final api = ref.read(apiServiceProvider);
  return api.checkHealth();
});
