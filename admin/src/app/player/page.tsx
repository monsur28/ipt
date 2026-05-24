"use client";

import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Hls, { HlsConfig } from "hls.js";

interface Channel {
  id: string;
  name: string;
  logo: string | null;
  categoryName: string;
  status: string;
  isLive: boolean;
}

interface Category {
  name: string;
  slug: string;
}

function PlayerPage() {
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [bufferProfile, setBufferProfile] = useState<"low-latency" | "netflix-adaptive" | "high-buffer">("netflix-adaptive");
  const [bufferLength, setBufferLength] = useState(0);
  const [bandwidth, setBandwidth] = useState<number | null>(null);
  const [currentResolution, setCurrentResolution] = useState<string>("Detecting...");
  const [engineStatus, setEngineStatus] = useState<"STABLE" | "BUFFER_CACHING" | "RECOVERING">("STABLE");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Mouse Drag-to-Scroll support for categories horizontal pills container
  const categoriesScrollRef = useRef<HTMLDivElement>(null);
  const [isDragScrolling, setIsDragScrolling] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragScrollLeft, setDragScrollLeft] = useState(0);

  const handleCategoriesMouseDown = (e: React.MouseEvent) => {
    const el = categoriesScrollRef.current;
    if (!el) return;
    setIsDragScrolling(true);
    setDragStartX(e.pageX - el.offsetLeft);
    setDragScrollLeft(el.scrollLeft);
  };

  const handleCategoriesMouseLeave = () => {
    setIsDragScrolling(false);
  };

  const handleCategoriesMouseUp = () => {
    setIsDragScrolling(false);
  };

  const handleCategoriesMouseMove = (e: React.MouseEvent) => {
    const el = categoriesScrollRef.current;
    if (!el || !isDragScrolling) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - dragStartX) * 1.5; // scrolling speed multiplier
    el.scrollLeft = dragScrollLeft - walk;
  };

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/categories`);
      if (!res.ok) throw new Error("Failed to load categories");
      return res.json();
    },
  });

  // Fetch channels
  const { data: channelsData, isLoading: isLoadingChannels } = useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/channels?limit=1000`);
      if (!res.ok) throw new Error("Failed to load channels");
      return res.json();
    },
  });

  const channels: Channel[] = channelsData?.data || [];

  // Filter channels
  const filteredChannels = channels.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.categoryName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || c.categoryName === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const updateBufferMetrics = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    // 1. Calculate current buffer length in seconds
    let currentBuffer = 0;
    const time = video.currentTime;
    for (let i = 0; i < video.buffered.length; i++) {
      const start = video.buffered.start(i);
      const end = video.buffered.end(i);
      if (time >= start && time <= end) {
        currentBuffer = end - time;
        break;
      }
    }
    const roundedBuffer = Math.round(currentBuffer * 10) / 10;
    setBufferLength(roundedBuffer);

    // 2. Set engine state based on buffer size
    if (video.paused) {
      setEngineStatus("STABLE");
    } else if (roundedBuffer < 3) {
      setEngineStatus("RECOVERING");
    } else if (roundedBuffer < 10) {
      setEngineStatus("BUFFER_CACHING");
    } else {
      setEngineStatus("STABLE");
    }
    
    // 3. Extract hls.js active diagnostics
    if (hlsRef.current) {
      const hls = hlsRef.current;
      if (hls.bandwidthEstimate > 0) {
        // Bandwidth is in bps, convert to Mbps
        setBandwidth(Math.round((hls.bandwidthEstimate / 1000000) * 100) / 100);
      }
      if (hls.currentLevel >= 0 && hls.levels[hls.currentLevel]) {
        const lvl = hls.levels[hls.currentLevel];
        setCurrentResolution(`${lvl.width}x${lvl.height} @ ${Math.round(lvl.bitrate / 1000)} Kbps`);
      } else if (hls.levels && hls.levels.length > 0) {
        const lvl = hls.levels[0];
        setCurrentResolution(`${lvl.width}x${lvl.height}`);
      }
    }
  };

  // Handle HLS stream initialization
  const playStream = async (channel: Channel) => {
    if (!videoRef.current) return;
    setPlaybackError(null);
    setIsBuffering(true);
    setRetryCount(0);
    setBufferLength(0);
    setBandwidth(null);
    setCurrentResolution("Detecting...");
    setEngineStatus("STABLE");

    // Destroy existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const initHlsPlayer = async (currentRetry = 0) => {
      try {
        setIsBuffering(true);
        // 1. Fetch direct HLS stream URL from secure backend proxy
        const res = await fetch(`${apiUrl}/api/stream/${channel.id}?json=true`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server responded with status ${res.status}`);
        }

        const data = await res.json();
        if (!data.success || !data.streamUrl) {
          throw new Error(data.error || "Failed to initialize stream worker.");
        }

        const realStreamUrl = data.streamUrl;
        console.log(`[PLAYER] Loading secure stream URL: ${realStreamUrl}`);

        if (!videoRef.current) return;

        if (Hls.isSupported()) {
          // Destroy previous if any was left
          if (hlsRef.current) {
            hlsRef.current.destroy();
          }

          // Buffer profiles configuration (Netflix-style ABR optimization)
          let hlsConfig: Partial<HlsConfig>;
          if (bufferProfile === "low-latency") {
            hlsConfig = {
              enableWorker: true,
              lowLatencyMode: true,
              maxBufferLength: 4,      // short buffer for low latency
              maxMaxBufferLength: 8,
              backBufferLength: 2,
              liveSyncDurationCount: 2,
              liveMaxLatencyDurationCount: 4,
              fragLoadingMaxRetry: 3,
              fragLoadingRetryDelay: 500,
            };
          } else if (bufferProfile === "netflix-adaptive") {
            hlsConfig = {
              enableWorker: true,
              lowLatencyMode: false,
              maxBufferLength: 25,     // dynamic Netflix-style caching buffer
              maxMaxBufferLength: 45,
              backBufferLength: 10,
              // Extremely high loading resilience to prevent buffer starvation
              fragLoadingMaxRetry: 8,
              fragLoadingRetryDelay: 1000,
              fragLoadingMaxRetryDelay: 10000,
              manifestLoadingMaxRetry: 6,
              manifestLoadingRetryDelay: 1000,
              levelLoadingMaxRetry: 6,
              levelLoadingRetryDelay: 1000,
              // Bandwidth conservative EWMA upscales
              abrBandwidthFactor: 0.85,
              abrBandwidthUpFactor: 0.70,
            };
          } else {
            hlsConfig = {
              enableWorker: true,
              lowLatencyMode: false,
              maxBufferLength: 50,     // massive smooth buffer
              maxMaxBufferLength: 90,
              backBufferLength: 30,
              fragLoadingMaxRetry: 12,
              fragLoadingRetryDelay: 1500,
              fragLoadingMaxRetryDelay: 15000,
              manifestLoadingMaxRetry: 8,
              manifestLoadingRetryDelay: 1500,
            };
          }

          const hls = new Hls(hlsConfig);
          hlsRef.current = hls;

          hls.loadSource(realStreamUrl);
          hls.attachMedia(videoRef.current);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setIsBuffering(false);
            setPlaybackError(null);
            updateBufferMetrics();
            videoRef.current?.play().catch((err) => {
              console.warn("Autoplay blocked by browser policy, waiting for user click.", err);
            });
          });

          // Dynamic telemetry subscriptions
          hls.on(Hls.Events.FRAG_BUFFERED, updateBufferMetrics);
          hls.on(Hls.Events.LEVEL_SWITCHED, updateBufferMetrics);

          hls.on(Hls.Events.ERROR, (event, errorData) => {
            if (errorData.fatal) {
              console.error("Fatal HLS Error:", errorData.type, errorData.details);
              setIsBuffering(false);

              if (currentRetry < 2) {
                const nextRetry = currentRetry + 1;
                setRetryCount(nextRetry);
                setPlaybackError(`Fatal HLS playback error. Retrying connection (${nextRetry}/2)...`);
                setTimeout(() => {
                  if (hlsRef.current === hls) {
                    hls.destroy();
                    hlsRef.current = null;
                  }
                  initHlsPlayer(nextRetry);
                }, 3000);
              } else {
                setPlaybackError(
                  "Channel stream failed to load. The stream source is offline or FFmpeg transcoding encountered a critical error. Please try restarting the stream from the delivery dashboard."
                );
                hls.destroy();
                hlsRef.current = null;
              }
            }
          });

          // Buffer state notifications
          videoRef.current.onwaiting = () => setIsBuffering(true);
          videoRef.current.onplaying = () => setIsBuffering(false);

        } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
          // Native HLS for Safari/iOS
          videoRef.current.src = realStreamUrl;
          
          const handleLoadedMetadata = () => {
            setIsBuffering(false);
            setPlaybackError(null);
            updateBufferMetrics();
            videoRef.current?.play().catch((e) => console.log(e));
          };
          
          const handleNativeError = () => {
            setIsBuffering(false);
            if (currentRetry < 2) {
              const nextRetry = currentRetry + 1;
              setRetryCount(nextRetry);
              setPlaybackError(`Native playback error. Retrying connection (${nextRetry}/2)...`);
              setTimeout(() => {
                initHlsPlayer(nextRetry);
              }, 3000);
            } else {
              setPlaybackError("Native playback failed. The stream might be offline.");
            }
          };

          videoRef.current.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
          videoRef.current.addEventListener("error", handleNativeError, { once: true });
        } else {
          setPlaybackError("HLS playback is not supported in this browser. Please use Chrome, Safari, or Firefox.");
        }
      } catch (err: any) {
        console.error("[PLAYER] Stream initialization error:", err);
        setIsBuffering(false);
        if (currentRetry < 2) {
          const nextRetry = currentRetry + 1;
          setRetryCount(nextRetry);
          setPlaybackError(`Failed to initiate restream worker. Retrying (${nextRetry}/2)...`);
          setTimeout(() => {
            initHlsPlayer(nextRetry);
          }, 3000);
        } else {
          setPlaybackError(err.message || "Failed to initialize stream worker.");
        }
      }
    };

    await initHlsPlayer(0);
  };

  // Play stream when selected channel or buffer profile updates
  useEffect(() => {
    if (selectedChannel) {
      playStream(selectedChannel);
    }
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [selectedChannel, bufferProfile]);

  // Handle auto-select first channel
  useEffect(() => {
    if (channels.length > 0 && !selectedChannel) {
      setSelectedChannel(channels[0]);
    }
  }, [channels, selectedChannel]);

  // Lock root window scrolling to ensure only inner lists scroll (fit-to-screen application layout)
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyHeight = document.body.style.height;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalHtmlHeight = document.documentElement.style.height;

    document.body.style.overflow = "hidden";
    document.body.style.height = "100vh";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.height = "100vh";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.height = originalBodyHeight;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.documentElement.style.height = originalHtmlHeight;
    };
  }, []);

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;

    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error("Fullscreen request rejected:", err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  // Fullscreen state sync
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#0b1326] text-[#dae2fd] overflow-hidden">
      {/* Header bar */}
      <header className="bg-[#0b1326]/70 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 flex justify-between items-center px-6 py-4 w-full">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#ff3366] text-2xl animate-pulse">live_tv</span>
          <h1 className="text-xl font-bold text-white tracking-tight">Web IPTV Stream Player</h1>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to Dashboard
          </a>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/35">
            <span className="w-2 h-2 rounded-full bg-emerald-400 status-pulse"></span>
            <span className="text-xs font-bold text-emerald-400 tracking-wider">HLS PLAYER</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Sidebar: Channel Navigation */}
        <aside className="w-[320px] bg-[#060e20] border-r border-white/10 flex flex-col z-40 h-full overflow-hidden">
          {/* Search bar */}
          <div className="p-4 border-b border-white/10 flex flex-col gap-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-white/40 text-lg">search</span>
              <input
                type="text"
                placeholder="Search channels..."
                className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-[#ff3366] text-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Category horizontal scrolling pills */}
            <div 
              ref={categoriesScrollRef}
              onMouseDown={handleCategoriesMouseDown}
              onMouseLeave={handleCategoriesMouseLeave}
              onMouseUp={handleCategoriesMouseUp}
              onMouseMove={handleCategoriesMouseMove}
              className="flex gap-1.5 overflow-x-auto pb-1.5 w-full max-w-[288px] custom-h-scrollbar select-none cursor-grab active:cursor-grabbing"
            >
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wide transition-all shrink-0 ${
                  selectedCategory === "all"
                    ? "bg-[#ff3366] text-white"
                    : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
                }`}
              >
                ALL
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wide transition-all shrink-0 uppercase ${
                    selectedCategory === cat.name
                      ? "bg-[#ff3366] text-white"
                      : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Channels Scrollable list */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar">
            {isLoadingChannels ? (
              <div className="flex flex-col items-center justify-center p-8 gap-2 text-white/40">
                <span className="material-symbols-outlined text-3xl animate-spin">sync</span>
                <span className="text-xs">Loading channel lists...</span>
              </div>
            ) : filteredChannels.length === 0 ? (
              <div className="text-center text-white/40 text-xs py-8">No channels found</div>
            ) : (
              filteredChannels.map((c) => {
                const isActive = selectedChannel?.id === c.id;
                const isOffline = c.status === "OFFLINE";

                return (
                  <button
                    key={c.id}
                    onClick={() => !isOffline && setSelectedChannel(c)}
                    onMouseEnter={() => {
                      if (!isOffline && selectedChannel?.id !== c.id) {
                        fetch(`${apiUrl}/api/stream/prewarm/${c.id}`, { method: 'POST' }).catch(() => {});
                      }
                    }}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
                      isOffline ? "opacity-40 cursor-not-allowed border-white/5" : ""
                    } ${
                      isActive
                        ? "bg-[#ff3366]/10 border-[#ff3366] text-white"
                        : "bg-white/5 border-white/5 hover:border-white/15 text-white/80 hover:text-white"
                    }`}
                    disabled={isOffline}
                  >
                    <div className="w-10 h-10 rounded-md bg-black/40 border border-white/10 flex items-center justify-center text-white/50 shrink-0 overflow-hidden">
                      {c.logo ? (
                        <img src={c.logo} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-lg">tv</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{c.name}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-white/50 font-bold uppercase tracking-wide">
                          {c.categoryName}
                        </span>
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isOffline ? "bg-rose-500" : "bg-emerald-400 status-pulse"
                          }`}
                        ></span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Area: HLS Premium Video Screen */}
        <main className="flex-1 bg-[#060e20] p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar h-full">
          <div className="flex flex-col xl:flex-row gap-6">
            {/* Player Container */}
            <div className="flex-1 flex flex-col gap-4">
              <div
                ref={playerContainerRef}
                className="relative bg-black rounded-xl overflow-hidden aspect-video border border-white/10 shadow-2xl flex items-center justify-center group"
              >
                {/* Video Tag */}
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  controls={!playbackError}
                  playsInline
                  onTimeUpdate={updateBufferMetrics}
                  onProgress={updateBufferMetrics}
                />

                {/* Frosty Glass Loading Overlay */}
                {isBuffering && !playbackError && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-3 transition-opacity">
                    <span className="material-symbols-outlined text-4xl text-[#ff3366] animate-spin">sync</span>
                    <span className="text-xs tracking-wider font-semibold text-white">BUFFERING SECURE STREAM...</span>
                  </div>
                )}

                {/* Error Overlay with Premium UI */}
                {playbackError && (
                  <div className="absolute inset-0 bg-[#0b1326]/95 backdrop-blur-md p-8 flex flex-col items-center justify-center text-center gap-4 border border-rose-500/20">
                    <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500 flex items-center justify-center text-rose-500">
                      <span className="material-symbols-outlined text-2xl">error</span>
                    </div>
                    <div className="max-w-md">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Stream Playback Failed</h3>
                      <p className="text-xs text-white/60 leading-relaxed font-mono">{playbackError}</p>
                    </div>
                    {selectedChannel && (
                      <button
                        onClick={() => playStream(selectedChannel)}
                        className="bg-[#ff3366] hover:opacity-90 active:scale-95 text-white text-xs font-bold py-2 px-6 rounded-lg transition-all flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm">replay</span>
                        Retry Loading Stream
                      </button>
                    )}
                  </div>
                )}

                {/* Custom Overlay badges for clean player aesthetics */}
                {selectedChannel && !playbackError && (
                  <div className="absolute top-4 left-4 right-4 flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-white pointer-events-auto">
                      <span className="w-2 h-2 rounded-full bg-[#ff3366] status-pulse"></span>
                      <span className="text-[10px] font-bold tracking-widest">LIVE</span>
                      <span className="text-white/20">|</span>
                      <span className="text-[10px] font-semibold tracking-wide truncate max-w-[200px]">{selectedChannel.name}</span>
                    </div>

                    <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 pointer-events-auto">
                      <button
                        onClick={() => {
                          const nextProfile = bufferProfile === "low-latency" ? "netflix-adaptive" : bufferProfile === "netflix-adaptive" ? "high-buffer" : "low-latency";
                          setBufferProfile(nextProfile);
                        }}
                        className="text-[9px] px-2 py-0.5 rounded font-bold uppercase bg-[#ff3366] text-white transition-all hover:opacity-90 active:scale-95"
                        title="Cycle buffering profiles: Low Latency, Netflix Adaptive, or High Buffer"
                      >
                        {bufferProfile === "low-latency" ? "Low Latency" : bufferProfile === "netflix-adaptive" ? "Adaptive" : "High Buffer"}
                      </button>
                      <button
                        onClick={toggleFullscreen}
                        className="text-white/60 hover:text-white p-1 rounded transition-colors material-symbols-outlined text-sm"
                        title="Fullscreen playback"
                      >
                        {isFullscreen ? "fullscreen_exit" : "fullscreen"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Selected Channel Metadata Info */}
              {selectedChannel && (
                <div className="glass-card p-5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl flex flex-col sm:flex-row gap-4 items-center justify-between shadow-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center text-white/40 shrink-0 overflow-hidden shadow-inner">
                      {selectedChannel.logo ? (
                        <img src={selectedChannel.logo} alt={selectedChannel.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-2xl">tv</span>
                      )}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white leading-tight">{selectedChannel.name}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded bg-[#ff3366]/20 border border-[#ff3366]/30 text-[9px] font-bold text-[#ff3366] uppercase tracking-wider">
                          {selectedChannel.categoryName}
                        </span>
                        <span className="text-[10px] text-white/40 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">security</span> Secured Backend Proxy
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex flex-col bg-black/30 border border-white/5 rounded-lg px-4 py-2 text-center min-w-[100px]">
                      <span className="text-[9px] text-white/40 uppercase font-semibold">Buffering Profile</span>
                      <span className="text-xs font-bold text-white mt-0.5 capitalize">
                        {bufferProfile === "low-latency" ? "Low Latency" : bufferProfile === "netflix-adaptive" ? "Adaptive" : "Max Smooth"}
                      </span>
                    </div>
                    <div className="flex flex-col bg-black/30 border border-white/5 rounded-lg px-4 py-2 text-center min-w-[100px]">
                      <span className="text-[9px] text-white/40 uppercase font-semibold">Active Pipeline</span>
                      <span className="text-xs font-bold text-emerald-400 mt-0.5 uppercase flex items-center justify-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse"></span> Running
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Diagnostics and platform unification panel */}
            <div className="w-full xl:w-[350px] flex flex-col gap-6">

              <section className="glass-card p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#ff3366] text-lg animate-pulse">network_check</span>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">ABR Buffer Engine</h3>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded font-bold tracking-widest uppercase ${
                    engineStatus === "STABLE" 
                      ? "bg-emerald-500/10 border border-emerald-500/35 text-emerald-400"
                      : engineStatus === "BUFFER_CACHING"
                      ? "bg-amber-500/10 border border-amber-500/35 text-amber-400 animate-pulse"
                      : "bg-rose-500/10 border border-rose-500/35 text-rose-400 animate-pulse"
                  }`}>
                    {engineStatus === "STABLE" ? "STABLE FEED" : engineStatus === "BUFFER_CACHING" ? "CACHING" : "RECOVERING"}
                  </span>
                </div>

                {/* Profile cards */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] text-white/40 uppercase font-semibold">Select Buffer Strategy</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "low-latency", name: "Low Lat", desc: "Ultra low lag" },
                      { id: "netflix-adaptive", name: "Adaptive", desc: "ABR Resilience" },
                      { id: "high-buffer", name: "Max Smooth", desc: "Large buffer" }
                    ].map((p) => {
                      const isActive = bufferProfile === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => setBufferProfile(p.id as any)}
                          className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${
                            isActive
                              ? "bg-[#ff3366]/10 border-[#ff3366] text-white"
                              : "bg-white/5 border-white/5 hover:border-white/15 text-white/50 hover:text-white"
                          }`}
                        >
                          <span className="text-[10px] font-bold tracking-wide">{p.name}</span>
                          <span className="text-[7px] text-white/40 mt-0.5 truncate max-w-full">{p.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Buffer Length Indicator Bar */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-white/40 uppercase font-semibold">Buffered Video</span>
                    <span className="text-white font-bold font-mono">{bufferLength}s</span>
                  </div>
                  <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden border border-white/5">
                    <div 
                      className={`h-full transition-all duration-300 rounded-full ${
                        bufferLength > 12 
                          ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" 
                          : bufferLength > 5 
                          ? "bg-amber-500 shadow-[0_0_8px_#f59e0b]" 
                          : "bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-pulse"
                      }`}
                      style={{ 
                        width: `${Math.min((bufferLength / (bufferProfile === "low-latency" ? 8 : bufferProfile === "netflix-adaptive" ? 40 : 80)) * 100, 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>

                {/* Metrics Details */}
                <div className="grid grid-cols-2 gap-3 bg-black/20 border border-white/5 p-3 rounded-lg text-[10px]">
                  <div className="flex flex-col">
                    <span className="text-white/40 uppercase font-semibold">Net Bandwidth</span>
                    <span className="text-white font-bold mt-1 font-mono flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px] text-sky-400">download</span>
                      {bandwidth !== null ? `${bandwidth} Mbps` : "Caching..."}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white/40 uppercase font-semibold">Active Bitrate</span>
                    <span className="text-white font-bold mt-1 font-mono truncate" title={currentResolution}>
                      {currentResolution}
                    </span>
                  </div>
                </div>

                <div className="text-[9px] text-white/40 leading-relaxed font-mono mt-1 border-t border-white/5 pt-2">
                  Adaptive ABR estimates connection speeds in the background. It dynamically retries failed video segments with exponential backoffs to prevent stream stuttering.
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

import dynamic from "next/dynamic";
export default dynamic(() => Promise.resolve(PlayerPage), { ssr: false });
