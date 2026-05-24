import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'routes/app_router.dart';
import 'services/storage_service.dart';
import 'providers/channel_providers.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Storage Service
  final storageService = StorageService();
  await storageService.init();

  runApp(
    ProviderScope(
      overrides: [
        // Override the storage service provider with our initialized instance
        storageServiceProvider.overrideWithValue(storageService),
      ],
      child: const IPTVApp(),
    ),
  );
}

class IPTVApp extends ConsumerWidget {
  const IPTVApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Watch the AMOLED theme preference (true: AMOLED Black, false: Midnight Charcoal)
    final isAmoled = ref.watch(themeModeProvider);

    return MaterialApp.router(
      title: 'IPTV Sports Platform',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.buildTheme(isAmoled: isAmoled),
      routerConfig: appRouter,
    );
  }
}
