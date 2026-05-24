import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iptv_sports/main.dart';
import 'package:iptv_sports/services/storage_service.dart';
import 'package:iptv_sports/providers/channel_providers.dart';
import 'package:iptv_sports/models/channel.dart';
import 'package:iptv_sports/models/category.dart';

// An in-memory mock of StorageService to run headless widget tests without Hive native errors
class MockStorageService implements StorageService {
  final Map<String, dynamic> _data = {};

  @override
  Future<void> init() async {}

  @override
  bool isFavorite(String channelId) => _data.containsKey(channelId);

  @override
  Future<void> toggleFavorite(String channelId) async {
    if (isFavorite(channelId)) {
      _data.remove(channelId);
    } else {
      _data[channelId] = true;
    }
  }

  @override
  List<String> getFavoriteIds() => _data.keys.toList();

  @override
  bool isAmoledTheme() => _data['is_amoled'] ?? true;

  @override
  Future<void> setAmoledTheme(bool isAmoled) async {
    _data['is_amoled'] = isAmoled;
  }

  @override
  Future<void> clearAll() async {
    _data.clear();
  }
}

void main() {
  testWidgets('IPTV Sports Platform boots up successfully', (WidgetTester tester) async {
    final mockStorage = MockStorageService();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          storageServiceProvider.overrideWithValue(mockStorage),
          channelsProvider.overrideWith((ref) => const [
            Channel(
              id: '1',
              name: 'Test Channel',
              category: 'Football',
              isLive: true,
              status: 'ONLINE',
              viewCount: 1500,
              currentShow: 'UCL Final',
            ),
          ]),
          liveChannelsProvider.overrideWith((ref) => const [
            Channel(
              id: '1',
              name: 'Test Channel',
              category: 'Football',
              isLive: true,
              status: 'ONLINE',
              viewCount: 1500,
              currentShow: 'UCL Final',
            ),
          ]),
          categoriesProvider.overrideWith((ref) => const [
            Category(
              id: '1',
              name: 'Football',
              slug: 'football',
              channelCount: 1,
            ),
          ]),
        ],
        child: const IPTVApp(),
      ),
    );

    // Wait for the app frame to render (pump manually to avoid infinite pulse animation timeouts)
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    // Verify that the IPTV Sports Platform renders the title or some home widgets
    // It should render the Home Screen widgets (e.g. Featured Match title, Categories list)
    expect(find.byType(IPTVApp), findsOneWidget);
    expect(find.text('Categories'), findsOneWidget);
  });
}
