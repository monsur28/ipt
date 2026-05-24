import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shimmer/shimmer.dart';
import '../../core/widgets/channel_card.dart';
import '../../core/widgets/shimmer_channel_card.dart';
import '../../providers/channel_providers.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  /// Debounce search input by 300ms to avoid spamming the API.
  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      ref.read(searchQueryProvider.notifier).state = value;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final query = ref.watch(searchQueryProvider);
    final selectedCategory = ref.watch(selectedCategoryProvider);
    final searchResultsAsync = ref.watch(searchResultsProvider);
    final categoriesAsync = ref.watch(categoriesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Search Channels'),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Search Input Field
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
            child: TextField(
              controller: _searchController,
              focusNode: _focusNode,
              onChanged: _onSearchChanged,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Search by team, channel, league...',
                hintStyle: const TextStyle(color: Colors.grey, fontSize: 15),
                prefixIcon: const Icon(Icons.search_rounded, color: Colors.grey),
                suffixIcon: query.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear_rounded, color: Colors.grey),
                        onPressed: () {
                          _searchController.clear();
                          _debounce?.cancel();
                          ref.read(searchQueryProvider.notifier).state = '';
                        },
                      )
                    : null,
                filled: true,
                fillColor: theme.cardColor,
                contentPadding: const EdgeInsets.symmetric(vertical: 14),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16.0),
                  borderSide: BorderSide.none,
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16.0),
                  borderSide: BorderSide(
                    color: theme.colorScheme.primary, width: 1.0,
                  ),
                ),
              ),
            ),
          ),

          // Horizontal Category Filter Chips (from API)
          categoriesAsync.when(
            data: (categories) {
              final chipNames = ['All', ...categories.map((c) => c.name)];
              return SizedBox(
                height: 50,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16.0, vertical: 4.0,
                  ),
                  itemCount: chipNames.length,
                  itemBuilder: (context, index) {
                    final category = chipNames[index];
                    final isSelected = selectedCategory == category;

                    return Padding(
                      padding: const EdgeInsets.only(right: 8.0),
                      child: FilterChip(
                        label: Text(category),
                        selected: isSelected,
                        selectedColor: theme.colorScheme.primary,
                        checkmarkColor: Colors.white,
                        backgroundColor: theme.cardColor,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(
                            color: isSelected
                                ? Colors.transparent
                                : theme.colorScheme.outline.withOpacity(0.15),
                          ),
                        ),
                        onSelected: (bool selected) {
                          ref.read(selectedCategoryProvider.notifier).state =
                              selected ? category : 'All';
                        },
                      ),
                    );
                  },
                ),
              );
            },
            loading: () => SizedBox(
              height: 50,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16.0, vertical: 4.0,
                ),
                itemCount: 5,
                itemBuilder: (context, index) => Padding(
                  padding: const EdgeInsets.only(right: 8.0),
                  child: Shimmer.fromColors(
                    baseColor: Colors.grey[900]!,
                    highlightColor: Colors.grey[800]!,
                    child: Container(
                      width: 80,
                      height: 36,
                      decoration: BoxDecoration(
                        color: Colors.grey[900],
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            error: (_, __) => const SizedBox(height: 50),
          ),

          const SizedBox(height: 8),

          // Search Results Area
          Expanded(
            child: searchResultsAsync.when(
              loading: () => GridView.builder(
                padding: const EdgeInsets.all(16.0),
                gridDelegate:
                    const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  childAspectRatio: 1.4,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                ),
                itemCount: 6,
                itemBuilder: (context, index) =>
                    const ShimmerChannelCard(),
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
                        'Search Failed',
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
                        style: const TextStyle(
                          color: Colors.grey, fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton.icon(
                        icon: const Icon(Icons.refresh_rounded),
                        label: const Text('Retry'),
                        onPressed: () =>
                            ref.invalidate(searchResultsProvider),
                      ),
                    ],
                  ),
                ),
              ),
              data: (searchResults) {
                if (searchResults.isEmpty) {
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
                                Icons.search_off_rounded,
                                size: 50,
                                color: theme.colorScheme.primary
                                    .withOpacity(0.8),
                              ),
                            ),
                            const SizedBox(height: 24),
                            const Text(
                              'No Channels Found',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              query.isNotEmpty
                                  ? 'No matches found for "$query". Try spelling it differently or filtering a different category.'
                                  : 'Try searching or filter by other category chips above.',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.grey, fontSize: 14,
                              ),
                            ),
                            const SizedBox(height: 20),
                            if (query.isNotEmpty ||
                                selectedCategory != 'All')
                              ElevatedButton(
                                onPressed: () {
                                  _searchController.clear();
                                  _debounce?.cancel();
                                  ref
                                      .read(
                                          searchQueryProvider.notifier)
                                      .state = '';
                                  ref
                                      .read(selectedCategoryProvider
                                          .notifier)
                                      .state = 'All';
                                },
                                child: const Text('Reset Filters'),
                              ),
                          ],
                        ),
                      ),
                    ),
                  );
                }

                return GridView.builder(
                  padding: const EdgeInsets.all(16.0),
                  gridDelegate:
                      const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 1.4,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  itemCount: searchResults.length,
                  itemBuilder: (context, index) {
                    final channel = searchResults[index];
                    return ChannelCard(
                      channel: channel,
                      width: double.infinity,
                      height: double.infinity,
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
