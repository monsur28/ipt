import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/channel_providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/constants/env.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  void _clearCache(BuildContext context, WidgetRef ref, ThemeData theme) async {
    // Show confirmation dialog
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: theme.cardColor,
        title: const Text('Clear App Cache?'),
        content: const Text(
          'This will delete all saved favorite channels and reset application configurations. This action cannot be undone.',
        ),
        actions: [
          TextButton(
            child: const Text('Cancel', style: TextStyle(color: Colors.white)),
            onPressed: () => Navigator.of(context).pop(false),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.liveRed),
            child: const Text('Clear'),
            onPressed: () => Navigator.of(context).pop(true),
          ),
        ],
      ),
    );

    if (confirm == true) {
      if (!context.mounted) return;
      
      // Show loading indicator dialog
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => const Center(
          child: CircularProgressIndicator(color: AppTheme.liveRed),
        ),
      );

      // Perform clear
      await ref.read(storageServiceProvider).clearAll();
      // Reset providers state
      ref.invalidate(favoritesProvider);
      ref.invalidate(themeModeProvider);
      ref.invalidate(searchQueryProvider);
      ref.invalidate(selectedCategoryProvider);
      ref.invalidate(channelsProvider);
      ref.invalidate(categoriesProvider);
      ref.invalidate(liveChannelsProvider);

      await Future.delayed(const Duration(milliseconds: 800));

      if (!context.mounted) return;
      Navigator.of(context).pop(); // Dismiss loading indicator

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'Cache and preferences cleared successfully!',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          backgroundColor: Colors.green[800],
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final isAmoled = ref.watch(themeModeProvider);
    final serverHealthAsync = ref.watch(serverHealthProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
        children: [
          // Theme settings card
          _buildCard(
            theme,
            title: 'Appearance',
            children: [
              SwitchListTile(
                title: const Text(
                  'AMOLED Black Theme',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                ),
                subtitle: const Text(
                  'Pure pitch black background for OLED screens',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
                value: isAmoled,
                activeColor: theme.colorScheme.primary,
                inactiveThumbColor: Colors.grey,
                onChanged: (val) {
                  ref.read(themeModeProvider.notifier).toggleTheme();
                },
              ),
              ListTile(
                title: const Text(
                  'Theme Variant Status',
                  style: TextStyle(fontSize: 15),
                ),
                trailing: Text(
                  isAmoled ? 'AMOLED Black' : 'Midnight Charcoal',
                  style: TextStyle(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Server connection card
          _buildCard(
            theme,
            title: 'Server Connection',
            children: [
              ListTile(
                title: const Text(
                  'Backend Status',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                ),
                subtitle: const Text(
                  'Connection to IPTV backend server',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
                trailing: serverHealthAsync.when(
                  data: (isHealthy) => Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: isHealthy ? Colors.green : AppTheme.liveRed,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        isHealthy ? 'Connected' : 'Offline',
                        style: TextStyle(
                          color: isHealthy ? Colors.green : AppTheme.liveRed,
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                  loading: () => const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  error: (_, __) => Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 10,
                        height: 10,
                        decoration: const BoxDecoration(
                          color: AppTheme.liveRed,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'Offline',
                        style: TextStyle(
                          color: AppTheme.liveRed,
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                onTap: () {
                  ref.invalidate(serverHealthProvider);
                },
              ),
              const Divider(height: 1, indent: 16, endIndent: 16),
              ListTile(
                title: const Text(
                  'API Base URL',
                  style: TextStyle(fontSize: 15),
                ),
                trailing: Text(
                  Env.apiBaseUrl,
                  style: const TextStyle(color: Colors.grey, fontSize: 11),
                ),
              ),
              const Divider(height: 1, indent: 16, endIndent: 16),
              ListTile(
                title: const Text(
                  'Stream Proxy URL',
                  style: TextStyle(fontSize: 15),
                ),
                trailing: Text(
                  Env.streamBaseUrl,
                  style: const TextStyle(color: Colors.grey, fontSize: 11),
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Cache control card
          _buildCard(
            theme,
            title: 'Storage & Operations',
            children: [
              ListTile(
                title: const Text(
                  'Clear Cache & Reset Settings',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                ),
                subtitle: const Text(
                  'Wipe out local favorites lists and UI configurations',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
                trailing: const Icon(Icons.cleaning_services_rounded, color: AppTheme.liveRed),
                onTap: () => _clearCache(context, ref, theme),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // App Info card
          _buildCard(
            theme,
            title: 'App Info',
            children: [
              const ListTile(
                title: Text('Platform Version', style: TextStyle(fontSize: 15)),
                trailing: Text('2.0.0 (Phase 5 Live)', style: TextStyle(color: Colors.grey, fontSize: 13)),
              ),
              const Divider(height: 1, indent: 16, endIndent: 16),
              const ListTile(
                title: Text('Architecture Design', style: TextStyle(fontSize: 15)),
                trailing: Text('Feature-First + Repository Pattern', style: TextStyle(color: Colors.grey, fontSize: 13)),
              ),
              const Divider(height: 1, indent: 16, endIndent: 16),
              ListTile(
                title: const Text('Developer Workspace', style: TextStyle(fontSize: 15)),
                trailing: Text(
                  'Antigravity IDE',
                  style: TextStyle(color: theme.colorScheme.primary, fontWeight: FontWeight.w600, fontSize: 13),
                ),
              ),
            ],
          ),

          const SizedBox(height: 40),
          Center(
            child: Column(
              children: [
                Icon(
                  Icons.live_tv_rounded,
                  size: 40,
                  color: theme.colorScheme.primary.withOpacity(0.4),
                ),
                const SizedBox(height: 8),
                const Text(
                  'IPTV Sports Platform • Phase 5 Live',
                  style: TextStyle(color: Colors.grey, fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildCard(ThemeData theme, {required String title, required List<Widget> children}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 8.0, bottom: 8.0),
          child: Text(
            title.toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: Colors.grey,
              letterSpacing: 1.0,
            ),
          ),
        ),
        Card(
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: children,
          ),
        ),
      ],
    );
  }
}
