import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:better_player_enhanced/better_player.dart';
import 'dart:async';
import '../../models/channel.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/live_pulse_badge.dart';
import '../../providers/channel_providers.dart';

class PlayerScreen extends ConsumerStatefulWidget {
  final Channel channel;

  const PlayerScreen({
    super.key,
    required this.channel,
  });

  @override
  ConsumerState<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends ConsumerState<PlayerScreen> {
  BetterPlayerController? _betterPlayerController;
  bool _areControlsVisible = true;
  Timer? _controlsTimer;
  bool _isPlaying = false;
  bool _isLoading = true;
  bool _hasError = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _startControlsTimer();

    // Force Landscape for premium cinematic video player
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);

    // Hide Status Bars
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }

  /// Initialize the player with a resolved stream URL from the proxy.
  void _setupPlayer(String streamUrl) {
    // Dispose existing controller if retrying
    _betterPlayerController?.dispose();

    final betterPlayerConfiguration = BetterPlayerConfiguration(
      aspectRatio: 16 / 9,
      fit: BoxFit.contain,
      autoPlay: true,
      looping: false,
      placeholder: Container(
        color: Colors.black,
        child: const Center(
          child: CircularProgressIndicator(color: AppTheme.liveRed),
        ),
      ),
      controlsConfiguration: const BetterPlayerControlsConfiguration(
        showControls: false, // Custom overlay controls
      ),
    );

    final dataSource = BetterPlayerDataSource(
      BetterPlayerDataSourceType.network,
      streamUrl,
      liveStream: widget.channel.isLive,
    );

    _betterPlayerController = BetterPlayerController(betterPlayerConfiguration);
    _betterPlayerController!.setupDataSource(dataSource);

    // Listen to video state changes
    _betterPlayerController!.addEventsListener((event) {
      if (!mounted) return;
      if (event.betterPlayerEventType == BetterPlayerEventType.play) {
        setState(() {
          _isPlaying = true;
          _isLoading = false;
          _hasError = false;
        });
      } else if (event.betterPlayerEventType == BetterPlayerEventType.pause) {
        setState(() {
          _isPlaying = false;
        });
      } else if (event.betterPlayerEventType ==
          BetterPlayerEventType.bufferingStart) {
        setState(() {
          _isLoading = true;
        });
      } else if (event.betterPlayerEventType ==
          BetterPlayerEventType.bufferingEnd) {
        setState(() {
          _isLoading = false;
        });
      } else if (event.betterPlayerEventType ==
          BetterPlayerEventType.exception) {
        setState(() {
          _hasError = true;
          _isLoading = false;
          _errorMessage = 'Playback error. Tap retry to reconnect.';
        });
      }
    });

    setState(() {
      _isLoading = false;
      _isPlaying = true;
    });
  }

  void _startControlsTimer() {
    _controlsTimer?.cancel();
    _controlsTimer = Timer(const Duration(seconds: 4), () {
      if (mounted && _isPlaying) {
        setState(() {
          _areControlsVisible = false;
        });
      }
    });
  }

  void _toggleControls() {
    setState(() {
      _areControlsVisible = !_areControlsVisible;
    });
    if (_areControlsVisible) {
      _startControlsTimer();
    }
  }

  void _playPause() {
    if (_betterPlayerController == null) return;
    if (_isPlaying) {
      _betterPlayerController!.pause();
    } else {
      _betterPlayerController!.play();
    }
    _startControlsTimer();
  }

  /// Retry fetching stream URL and reinitialize player.
  void _retryStream() {
    setState(() {
      _hasError = false;
      _isLoading = true;
      _errorMessage = null;
    });
    // Invalidate the stream URL provider to re-fetch from backend
    ref.invalidate(streamUrlProvider(widget.channel.id));
  }

  @override
  void dispose() {
    _controlsTimer?.cancel();
    _betterPlayerController?.dispose();

    // Restore normal system orientations on player exit
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
    ]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Watch the stream URL provider (async, with retry logic)
    final streamUrlAsync = ref.watch(streamUrlProvider(widget.channel.id));

    return Scaffold(
      backgroundColor: Colors.black,
      body: streamUrlAsync.when(
        loading: () => _buildStreamLoading(),
        error: (error, stack) => _buildStreamError(error),
        data: (streamUrl) {
          // Initialize player when we get a valid stream URL
          if (_betterPlayerController == null && !_hasError) {
            // Use post-frame callback to avoid setState during build
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) _setupPlayer(streamUrl);
            });
          }

          if (_hasError) {
            return _buildPlaybackError();
          }

          return _buildPlayerUI();
        },
      ),
    );
  }

  // ── Stream URL Loading State ──────────────────────────────────

  Widget _buildStreamLoading() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(
            color: AppTheme.liveRed,
            strokeWidth: 4,
          ),
          const SizedBox(height: 24),
          Text(
            'Connecting to ${widget.channel.name}...',
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 16,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Fetching stream from proxy server',
            style: TextStyle(color: Colors.white38, fontSize: 12),
          ),
        ],
      ),
    );
  }

  // ── Stream URL Fetch Error ────────────────────────────────────

  Widget _buildStreamError(Object error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.signal_wifi_connected_no_internet_4_rounded,
              color: AppTheme.liveRed,
              size: 60,
            ),
            const SizedBox(height: 24),
            const Text(
              'Stream Unavailable',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              error.toString(),
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white54, fontSize: 14),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                OutlinedButton.icon(
                  icon: const Icon(Icons.arrow_back_rounded, size: 18),
                  label: const Text('Go Back'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white24),
                  ),
                  onPressed: () => Navigator.of(context).pop(),
                ),
                const SizedBox(width: 16),
                ElevatedButton.icon(
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: const Text('Retry'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.liveRed,
                  ),
                  onPressed: _retryStream,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ── Playback Error (stream connected but failed mid-play) ─────

  Widget _buildPlaybackError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.error_outline_rounded,
              color: AppTheme.liveRed,
              size: 60,
            ),
            const SizedBox(height: 24),
            const Text(
              'Playback Error',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              _errorMessage ?? 'An error occurred during playback.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white54, fontSize: 14),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                OutlinedButton.icon(
                  icon: const Icon(Icons.arrow_back_rounded, size: 18),
                  label: const Text('Go Back'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white24),
                  ),
                  onPressed: () => Navigator.of(context).pop(),
                ),
                const SizedBox(width: 16),
                ElevatedButton.icon(
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: const Text('Retry Stream'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.liveRed,
                  ),
                  onPressed: _retryStream,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ── Main Player UI ────────────────────────────────────────────

  Widget _buildPlayerUI() {
    return GestureDetector(
      onTap: _toggleControls,
      child: Stack(
        children: [
          // 1. BetterPlayer Video Widget
          if (_betterPlayerController != null)
            Center(
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: BetterPlayer(
                  controller: _betterPlayerController!,
                ),
              ),
            )
          else
            const Center(
              child: CircularProgressIndicator(
                color: AppTheme.liveRed,
                strokeWidth: 4,
              ),
            ),

          // 2. Playback Loading Indicator Overlay
          if (_isLoading)
            const Positioned.fill(
              child: Center(
                child: CircularProgressIndicator(
                  color: AppTheme.liveRed,
                  strokeWidth: 4,
                ),
              ),
            ),

          // 3. Custom UI Controls Overlay
          AnimatedOpacity(
            opacity: _areControlsVisible ? 1.0 : 0.0,
            duration: const Duration(milliseconds: 300),
            child: IgnorePointer(
              ignoring: !_areControlsVisible,
              child: Stack(
                children: [
                  // Backdrop Shadow
                  Positioned.fill(
                    child: Container(
                      color: Colors.black.withOpacity(0.55),
                    ),
                  ),

                  // Top Bar (Back button, Channel name)
                  Positioned(
                    top: 24,
                    left: 24,
                    right: 24,
                    child: Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.arrow_back_ios_new_rounded,
                              color: Colors.white),
                          onPressed: () => Navigator.of(context).pop(),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                widget.channel.name,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: -0.5,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 2),
                              Row(
                                children: [
                                  if (widget.channel.isLive) ...[
                                    const LivePulseBadge(size: 6),
                                    const SizedBox(width: 8),
                                  ],
                                  Text(
                                    widget.channel.category,
                                    style: TextStyle(
                                      color: Colors.white.withOpacity(0.7),
                                      fontSize: 11,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        // Stream quality indicator
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            '1080p Auto',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Center Play/Pause button
                  if (_betterPlayerController != null)
                    Positioned.fill(
                      child: Center(
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            // 10s Rewind
                            IconButton(
                              iconSize: 36,
                              icon: const Icon(Icons.replay_10_rounded,
                                  color: Colors.white),
                              onPressed: () {
                                _betterPlayerController!.seekTo(
                                  _betterPlayerController!
                                          .videoPlayerController!
                                          .value
                                          .position -
                                      const Duration(seconds: 10),
                                );
                                _startControlsTimer();
                              },
                            ),
                            const SizedBox(width: 40),
                            // Core Play / Pause
                            IconButton(
                              iconSize: 64,
                              icon: Icon(
                                _isPlaying
                                    ? Icons.pause_circle_filled_rounded
                                    : Icons.play_circle_filled_rounded,
                                color: Colors.white,
                              ),
                              onPressed: _playPause,
                            ),
                            const SizedBox(width: 40),
                            // 10s Fast-Forward
                            IconButton(
                              iconSize: 36,
                              icon: const Icon(Icons.forward_10_rounded,
                                  color: Colors.white),
                              onPressed: () {
                                _betterPlayerController!.seekTo(
                                  _betterPlayerController!
                                          .videoPlayerController!
                                          .value
                                          .position +
                                      const Duration(seconds: 10),
                                );
                                _startControlsTimer();
                              },
                            ),
                          ],
                        ),
                      ),
                    ),

                  // Bottom Bar
                  if (_betterPlayerController != null &&
                      _betterPlayerController!.videoPlayerController != null)
                    Positioned(
                      bottom: 24,
                      left: 24,
                      right: 24,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // Seek bar
                          ValueListenableBuilder(
                            valueListenable:
                                _betterPlayerController!.videoPlayerController!,
                            builder:
                                (context, VideoPlayerValue value, child) {
                              final int duration =
                                  value.duration?.inSeconds ?? 0;
                              final int position = value.position.inSeconds;
                              final double progress =
                                  duration > 0 ? position / duration : 0.0;

                              return Column(
                                children: [
                                  SliderTheme(
                                    data: SliderThemeData(
                                      trackHeight: 3,
                                      thumbShape:
                                          const RoundSliderThumbShape(
                                              enabledThumbRadius: 6),
                                      activeTrackColor: AppTheme.liveRed,
                                      inactiveTrackColor:
                                          Colors.white.withOpacity(0.3),
                                      thumbColor: AppTheme.liveRed,
                                    ),
                                    child: Slider(
                                      value: progress.clamp(0.0, 1.0),
                                      onChanged: (newValue) {
                                        if (duration > 0) {
                                          _betterPlayerController!.seekTo(
                                            Duration(
                                                seconds:
                                                    (newValue * duration)
                                                        .toInt()),
                                          );
                                        }
                                      },
                                    ),
                                  ),
                                  // Time representation
                                  Padding(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 16.0),
                                    child: Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          _formatDuration(value.position),
                                          style: const TextStyle(
                                              color: Colors.white60,
                                              fontSize: 11),
                                        ),
                                        Text(
                                          widget.channel.isLive
                                              ? 'LIVE'
                                              : _formatDuration(
                                                  value.duration ??
                                                      Duration.zero),
                                          style: TextStyle(
                                            color: widget.channel.isLive
                                                ? AppTheme.liveRed
                                                : Colors.white60,
                                            fontSize: 11,
                                            fontWeight:
                                                widget.channel.isLive
                                                    ? FontWeight.bold
                                                    : FontWeight.normal,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              );
                            },
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              const Icon(Icons.volume_up_rounded,
                                  color: Colors.white, size: 20),
                              const SizedBox(width: 8),
                              const Text(
                                'Audio Track: English',
                                style: TextStyle(
                                    color: Colors.white, fontSize: 12),
                              ),
                              const Spacer(),
                              // Fullscreen / aspect ratio toggle
                              IconButton(
                                icon: const Icon(
                                    Icons.fullscreen_rounded,
                                    color: Colors.white),
                                onPressed: () {
                                  setState(() {
                                    final currentFit =
                                        _betterPlayerController!
                                            .betterPlayerConfiguration
                                            .fit;
                                    _betterPlayerController!
                                        .setOverriddenFit(
                                      currentFit == BoxFit.contain
                                          ? BoxFit.cover
                                          : BoxFit.contain,
                                    );
                                  });
                                  _startControlsTimer();
                                },
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDuration(Duration duration) {
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);
    return '${twoDigits(minutes)}:${twoDigits(seconds)}';
  }
}
