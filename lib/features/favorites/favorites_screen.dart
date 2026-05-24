import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/widgets/channel_card.dart';
import '../../core/widgets/shimmer_channel_card.dart';
import '../../providers/channel_providers.dart';

class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final favoriteIds = ref.watch(favoritesProvider);
    final channelsAsync = ref.watch(channelsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Favorites'),
      ),
      body: channelsAsync.when(
        loading: () => GridView.builder(
          padding: const EdgeInsets.all(16.0),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            childAspectRatio: 1.4,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
          ),
          itemCount: 4,
          itemBuilder: (context, index) => const ShimmerChannelCard(),
        ),
        error: (error, stack) => Center(
          child: Padding(
            padding: const EdgeInsets.all(30.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.cloud_off_rounded,
                  size: 50,
                  color: theme.colorScheme.primary.withOpacity(0.8),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Failed to Load Channels',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  error.toString(),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.grey, fontSize: 14),
                ),
                const SizedBox(height: 20),
                ElevatedButton.icon(
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Retry'),
                  onPressed: () => ref.invalidate(channelsProvider),
                ),
              ],
            ),
          ),
        ),
        data: (allChannels) {
          // Map favorited IDs to actual Channel objects
          final favoriteChannels =
              allChannels.where((c) => favoriteIds.contains(c.id)).toList();

          if (favoriteChannels.isEmpty) {
            return Center(
              child: SingleChildScrollView(
                child: Padding(
                  padding: const EdgeInsets.all(30.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: theme.cardColor,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.favorite_border_rounded,
                          size: 50,
                          color: theme.colorScheme.primary.withOpacity(0.8),
                        ),
                      ),
                      const SizedBox(height: 24),
                      const Text(
                        'No Favorites Added Yet',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Tap the heart icon on any channel card to save it here for instant streaming access.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.grey, fontSize: 14),
                      ),
                      const SizedBox(height: 24),
                      ElevatedButton(
                        onPressed: () {
                          // Navigate to Home/Categories tab to explore channels
                          context.go('/');
                        },
                        child: const Text('Explore Sports Channels'),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(channelsProvider);
            },
            color: theme.colorScheme.primary,
            child: GridView.builder(
              padding: const EdgeInsets.all(16.0),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 1.4,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              itemCount: favoriteChannels.length,
              itemBuilder: (context, index) {
                final channel = favoriteChannels[index];
                return ChannelCard(
                  channel: channel,
                  width: double.infinity,
                  height: double.infinity,
                );
              },
            ),
          );
        },
      ),
    );
  }
}
