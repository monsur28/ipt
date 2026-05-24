import 'package:hive_flutter/hive_flutter.dart';

class StorageService {
  static const String favoritesBoxName = 'favorites_box';
  static const String settingsBoxName = 'settings_box';

  late Box _favoritesBox;
  late Box _settingsBox;

  Future<void> init() async {
    await Hive.initFlutter();
    _favoritesBox = await Hive.openBox(favoritesBoxName);
    _settingsBox = await Hive.openBox(settingsBoxName);
  }

  // Favorites Operations
  bool isFavorite(String channelId) {
    return _favoritesBox.containsKey(channelId);
  }

  Future<void> toggleFavorite(String channelId) async {
    if (isFavorite(channelId)) {
      await _favoritesBox.delete(channelId);
    } else {
      await _favoritesBox.put(channelId, true);
    }
  }

  List<String> getFavoriteIds() {
    return _favoritesBox.keys.cast<String>().toList();
  }

  // Settings Operations
  bool isAmoledTheme() {
    return _settingsBox.get('is_amoled', defaultValue: true) as bool;
  }

  Future<void> setAmoledTheme(bool isAmoled) async {
    await _settingsBox.put('is_amoled', isAmoled);
  }

  // Clear cache & settings mock
  Future<void> clearAll() async {
    await _favoritesBox.clear();
    await _settingsBox.clear();
  }
}
