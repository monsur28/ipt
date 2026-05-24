import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import '../../models/channel.dart';
import '../../providers/channel_providers.dart';
import '../widgets/live_pulse_badge.dart';
import 'shimmer_channel_card.dart';

class ChannelCard extends ConsumerWidget {
  final Channel channel;
  final double width;
  final double height;

  const ChannelCard({
    super.key,
    required this.channel,
    this.width = 200,
    this.height = 130,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final favorites = ref.watch(favoritesProvider);
    final isFav = favorites.contains(channel.id);

    return Container(
      width: width,
      height: height,
      margin: const EdgeInsets.only(right: 12),
      child: Card(
        clipBehavior: Clip.antiAlias,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(
            color: theme.colorScheme.outline.withOpacity(0.1),
            width: 1,
          ),
        ),
        child: InkWell(
          onTap: () {
            // Add to recently watched
            ref.read(recentlyWatchedProvider.notifier).addChannel(channel);
            // Navigate to player
            context.push('/player', extra: channel);
          },
          child: Stack(
            children: [
              // Logo/Thumbnail image
              Positioned.fill(
                child: CachedNetworkImage(
                  imageUrl: channel.logo ?? '',
                  fit: BoxFit.cover,
                  placeholder: (context, url) => const ShimmerChannelCard(),
                  errorWidget: (context, url, error) => Container(
                    color: theme.cardColor,
                    child: const Center(
                      child: Icon(Icons.broken_image, color: Colors.grey),
                    ),
                  ),
                ),
              ),

              // Shadow Gradient Overlay
              Positioned.fill(
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.black.withOpacity(0.15),
                        Colors.black.withOpacity(0.3),
                        Colors.black.withOpacity(0.85),
                      ],
                      stops: const [0.0, 0.4, 1.0],
                    ),
                  ),
                ),
              ),

              // Live Status Badge
              if (channel.isLive)
                const Positioned(
                  top: 10,
                  left: 10,
                  child: LivePulseBadge(),
                ),

              // Favorite Heart Toggle Button
              Positioned(
                top: 6,
                right: 6,
                child: ClipOval(
                  child: Container(
                    color: Colors.black.withOpacity(0.4),
                    child: IconButton(
                      icon: Icon(
                        isFav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                        color: isFav ? theme.colorScheme.primary : Colors.white,
                        size: 18,
                      ),
                      onPressed: () {
                        ref.read(favoritesProvider.notifier).toggleFavorite(channel.id);
                        ScaffoldMessenger.of(context).clearSnackBars();
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              isFav
                                  ? 'Removed from Favorites'
                                  : 'Added to Favorites',
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            duration: const Duration(seconds: 1),
                            backgroundColor: isFav
                                ? Colors.grey[900]
                                : theme.colorScheme.primary.withOpacity(0.9),
                            behavior: SnackBarBehavior.floating,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            margin: const EdgeInsets.only(bottom: 20, left: 20, right: 20),
                          ),
                        );
                      },
                    ),
                  ),
                ),
              ),

              // Channel Info (Bottom overlay)
              Positioned(
                bottom: 12,
                left: 12,
                right: 12,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Category Tag
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.primary.withOpacity(0.8),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        channel.category.toUpperCase(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 8,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    // Channel Name
                    Text(
                      channel.name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        letterSpacing: -0.2,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    // Current Show or viewers count
                    Text(
                      channel.isLive
                          ? (channel.currentShow ?? channel.formattedViewers)
                          : 'OFFLINE',
                      style: TextStyle(
                        color: channel.isLive ? Colors.red[300] : Colors.grey[400],
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
