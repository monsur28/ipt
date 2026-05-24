import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shimmer/shimmer.dart';
import '../../core/widgets/channel_card.dart';
import '../../core/widgets/live_pulse_badge.dart';
import '../../core/widgets/shimmer_channel_card.dart';
import '../../providers/channel_providers.dart';
import '../../models/channel.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final channelsAsync = ref.watch(channelsProvider);
    final liveChannelsAsync = ref.watch(liveChannelsProvider);
    final categoriesAsync = ref.watch(categoriesProvider);
    final recentlyWatched = ref.watch(recentlyWatchedProvider);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          // Invalidate all async providers to re-fetch from API
          ref.invalidate(channelsProvider);
          ref.invalidate(liveChannelsProvider);
          ref.invalidate(categoriesProvider);
        },
        color: theme.colorScheme.primary,
        child: channelsAsync.when(
          loading: () => _buildLoadingState(context),
          error: (error, stack) => _buildErrorState(context, ref, error),
          data: (allChannels) {
            if (allChannels.isEmpty) {
              return _buildEmptyState(context, ref);
            }

            // Select hero channel: first live channel or first channel
            final liveChannels = liveChannelsAsync.valueOrNull ?? 
                allChannels.where((c) => c.isLive).toList();
            final Channel heroChannel = liveChannels.isNotEmpty
                ? liveChannels.first
                : allChannels.first;

            final favorites = ref.watch(favoritesProvider);
            final isHeroFav = favorites.contains(heroChannel.id);

            return SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 1. Hero Banner Section
                  _buildHeroBanner(
                    context, ref, theme, heroChannel, isHeroFav,
                  ),

                  // 2. Horizontal Category Slider
                  categoriesAsync.when(
                    data: (categories) => Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16.0, vertical: 8.0,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Categories', style: theme.textTheme.titleMedium),
                          const SizedBox(height: 12),
                          SizedBox(
                            height: 50,
                            child: ListView.builder(
                              scrollDirection: Axis.horizontal,
                              itemCount: categories.length,
                              itemBuilder: (context, index) {
                                final cat = categories[index];
                                return Padding(
                                  padding: const EdgeInsets.only(right: 8.0),
                                  child: ActionChip(
                                    avatar: Icon(
                                      _getCategoryIcon(cat.name),
                                      color: Colors.white,
                                      size: 18,
                                    ),
                                    label: Text(
                                      '${cat.name} (${cat.channelCount})',
                                    ),
                                    backgroundColor: theme.cardColor,
                                    side: BorderSide(
                                      color: theme.colorScheme.outline
                                          .withOpacity(0.15),
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    onPressed: () {
                                      context.push(
                                        '/categories/detail/${cat.name}',
                                      );
                                    },
                                  ),
                                );
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                    loading: () => _buildCategoryShimmer(context),
                    error: (_, __) => const SizedBox.shrink(),
                  ),

                  // 3. Live Now Section
                  if (liveChannels.isNotEmpty)
                    _buildSection(
                      context,
                      title: 'Live Now',
                      channels: liveChannels,
                      isLive: true,
                    ),

                  // 4. Trending Section
                  _buildSection(
                    context,
                    title: 'Trending Channels',
                    channels: allChannels.take(8).toList(),
                  ),

                  // 5. Recently Watched Section
                  if (recentlyWatched.isNotEmpty)
                    _buildSection(
                      context,
                      title: 'Recently Watched',
                      channels: recentlyWatched,
                    ),

                  const SizedBox(height: 30),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildHeroBanner(
    BuildContext context,
    WidgetRef ref,
    ThemeData theme,
    Channel heroChannel,
    bool isHeroFav,
  ) {
    return Stack(
      children: [
        // Banner Image
        Container(
          height: MediaQuery.of(context).size.height * 0.45,
          width: double.infinity,
          foregroundDecoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.black.withOpacity(0.15),
                theme.scaffoldBackgroundColor.withOpacity(0.5),
                theme.scaffoldBackgroundColor,
              ],
              stops: const [0.0, 0.6, 1.0],
            ),
          ),
          child: CachedNetworkImage(
            imageUrl: heroChannel.logo ?? 
                'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1200&auto=format&fit=crop&q=80',
            fit: BoxFit.cover,
          ),
        ),

        // Hero Text & Controls
        Positioned(
          bottom: 20,
          left: 20,
          right: 20,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (heroChannel.isLive) ...[
                    const LivePulseBadge(),
                    const SizedBox(width: 8),
                  ],
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.amber[800],
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      'FEATURED MATCH',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                heroChannel.currentShow ?? heroChannel.name,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Streaming live on ${heroChannel.name} • ${heroChannel.formattedViewers}',
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  // Play Button
                  Expanded(
                    child: ElevatedButton.icon(
                      icon: const Icon(Icons.play_arrow_rounded, size: 24),
                      label: const Text('Watch Live'),
                      onPressed: () {
                        ref
                            .read(recentlyWatchedProvider.notifier)
                            .addChannel(heroChannel);
                        context.push('/player', extra: heroChannel);
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Favorite Button
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: IconButton(
                      icon: Icon(
                        isHeroFav
                            ? Icons.favorite_rounded
                            : Icons.favorite_border_rounded,
                        color: isHeroFav
                            ? theme.colorScheme.primary
                            : Colors.white,
                      ),
                      onPressed: () {
                        ref
                            .read(favoritesProvider.notifier)
                            .toggleFavorite(heroChannel.id);
                      },
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSection(
    BuildContext context, {
    required String title,
    required List<Channel> channels,
    bool isLive = false,
  }) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(top: 20.0, bottom: 8.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  title,
                  style: theme.textTheme.titleMedium,
                ),
                TextButton(
                  onPressed: () {
                    context.go('/categories');
                  },
                  child: const Text('See All'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 140,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              itemCount: channels.length,
              itemBuilder: (context, index) {
                return ChannelCard(channel: channels[index]);
              },
            ),
          ),
        ],
      ),
    );
  }

  // ── Loading State ──────────────────────────────────────────────

  Widget _buildLoadingState(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Hero shimmer
          Shimmer.fromColors(
            baseColor: Colors.grey[900]!,
            highlightColor: Colors.grey[800]!,
            child: Container(
              height: MediaQuery.of(context).size.height * 0.45,
              color: Colors.grey[900],
            ),
          ),
          // Category shimmer
          _buildCategoryShimmer(context),
          // Channel row shimmer
          Padding(
            padding: const EdgeInsets.only(top: 20.0, left: 16.0),
            child: Shimmer.fromColors(
              baseColor: Colors.grey[900]!,
              highlightColor: Colors.grey[800]!,
              child: Container(
                height: 20,
                width: 120,
                decoration: BoxDecoration(
                  color: Colors.grey[900],
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 140,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              itemCount: 5,
              itemBuilder: (context, index) =>
                  const ShimmerChannelCard(width: 200, height: 130),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryShimmer(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      child: SizedBox(
        height: 50,
        child: ListView.builder(
          scrollDirection: Axis.horizontal,
          itemCount: 5,
          itemBuilder: (context, index) => Padding(
            padding: const EdgeInsets.only(right: 8.0),
            child: Shimmer.fromColors(
              baseColor: Colors.grey[900]!,
              highlightColor: Colors.grey[800]!,
              child: Container(
                width: 100,
                height: 40,
                decoration: BoxDecoration(
                  color: Colors.grey[900],
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ── Error State ────────────────────────────────────────────────

  Widget _buildErrorState(BuildContext context, WidgetRef ref, Object error) {
    final theme = Theme.of(context);
    return Center(
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
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
                  Icons.wifi_off_rounded,
                  size: 50,
                  color: theme.colorScheme.primary.withOpacity(0.8),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Unable to Load Channels',
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
              const SizedBox(height: 24),
              ElevatedButton.icon(
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Retry'),
                onPressed: () {
                  ref.invalidate(channelsProvider);
                  ref.invalidate(liveChannelsProvider);
                  ref.invalidate(categoriesProvider);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Empty State ────────────────────────────────────────────────

  Widget _buildEmptyState(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return Center(
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Padding(
          padding: const EdgeInsets.all(30.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.live_tv_rounded,
                size: 60,
                color: theme.colorScheme.primary.withOpacity(0.5),
              ),
              const SizedBox(height: 24),
              const Text(
                'No Channels Available',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Import an M3U playlist via the admin panel to populate channels.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey, fontSize: 14),
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Refresh'),
                onPressed: () {
                  ref.invalidate(channelsProvider);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Helpers ────────────────────────────────────────────────────

  IconData _getCategoryIcon(String name) {
    switch (name.toLowerCase()) {
      case 'football':
        return Icons.sports_soccer_rounded;
      case 'cricket':
        return Icons.sports_cricket_rounded;
      case 'basketball':
        return Icons.sports_basketball_rounded;
      case 'tennis':
        return Icons.sports_tennis_rounded;
      case 'ufc / mma':
      case 'ufc':
      case 'mma':
        return Icons.sports_mma_rounded;
      default:
        return Icons.sports_handball_rounded;
    }
  }
}
