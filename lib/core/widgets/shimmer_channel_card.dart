import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

class ShimmerChannelCard extends StatelessWidget {
  final double? width;
  final double? height;

  const ShimmerChannelCard({super.key, this.width, this.height});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isAmoled = theme.scaffoldBackgroundColor == Colors.black;
    final baseColor = isAmoled ? Colors.grey[900]! : Colors.grey[800]!;
    final highlightColor = isAmoled ? Colors.grey[800]! : Colors.grey[700]!;

    return SizedBox(
      width: width,
      height: height,
      child: Shimmer.fromColors(
      baseColor: baseColor,
      highlightColor: highlightColor,
      child: Container(
        decoration: BoxDecoration(
          color: theme.cardColor,
          borderRadius: BorderRadius.circular(16.0),
          border: Border.all(color: theme.colorScheme.outline.withOpacity(0.5)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Logo area
            Expanded(
              flex: 3,
              child: Container(
                decoration: BoxDecoration(
                  color: baseColor,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(16.0)),
                ),
              ),
            ),
            // Info area
            Expanded(
              flex: 2,
              child: Padding(
                padding: const EdgeInsets.all(12.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 100,
                      height: 12,
                      decoration: BoxDecoration(
                        color: baseColor,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      width: 60,
                      height: 10,
                      decoration: BoxDecoration(
                        color: baseColor,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      ),
    );
  }
}

class ShimmerHeroBanner extends StatelessWidget {
  const ShimmerHeroBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isAmoled = theme.scaffoldBackgroundColor == Colors.black;
    final baseColor = isAmoled ? Colors.grey[900]! : Colors.grey[800]!;
    final highlightColor = isAmoled ? Colors.grey[800]! : Colors.grey[700]!;

    return Shimmer.fromColors(
      baseColor: baseColor,
      highlightColor: highlightColor,
      child: Container(
        height: 240,
        margin: const EdgeInsets.all(16.0),
        decoration: BoxDecoration(
          color: theme.cardColor,
          borderRadius: BorderRadius.circular(20),
        ),
      ),
    );
  }
}
