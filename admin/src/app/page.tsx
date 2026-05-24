"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWebSocket } from "./providers";

interface StreamSource {
  id: string;
  channelId: string;
  url: string;
  priority: number;
  isActive: boolean;
}

interface Channel {
  id: string;
  name: string;
  logo: string | null;
  categoryName: string;
  status: string;
  isLive: boolean;
  streamSources: StreamSource[];
}

interface Category {
  name: string;
  slug: string;
  _count?: {
    channels: number;
  };
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { logs, metrics: wsMetrics, channelStatus: wsChannelStatus } = useWebSocket();

  // Selected channel for the management modal
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  
  // Importer state
  const [importUrl, setImportUrl] = useState("");
  const [importName, setImportName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importProgressLog, setImportProgressLog] = useState<string[]>([]);
  const [m3uPreviewItems, setM3uPreviewItems] = useState<{ name: string; url: string }[]>([]);

  // Search/Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 10;

  const logsEndRef = useRef<HTMLDivElement>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  // Fetch channels list with React Query
  const { data: channelsData, isLoading: isLoadingChannels } = useQuery({
    queryKey: ["channels", categoryFilter, page],
    queryFn: async () => {
      const catQuery = categoryFilter !== "all" ? `&category=${categoryFilter}` : "";
      const res = await fetch(`${apiUrl}/api/channels?page=${page}&limit=${limit}${catQuery}`);
      if (!res.ok) throw new Error("Failed to fetch channels");
      return res.json();
    },
  });

  // Fetch categories with React Query
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/categories`);
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const channels: Channel[] = channelsData?.data || [];
  const totalPages = channelsData?.meta?.totalPages || 1;
  const totalChannelsCount = channelsData?.meta?.total || 0;

  // Real-time channel status mapper that blends REST + WebSocket updates
  const getChannelStatus = (channel: Channel) => {
    return wsChannelStatus[channel.id] || channel.status;
  };

  // Scroll importer console to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, importProgressLog]);

  // REST API mutations
  const deleteChannelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${apiUrl}/api/channels/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`${apiUrl}/api/channels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Status update failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
  });

  // Ingestion Handlers
  const handlePreviewPlaylist = async () => {
    if (!importUrl) {
      alert("Please provide an M3U URL to preview streams.");
      return;
    }
    setIsImporting(true);
    setImportProgressLog((prev) => [...prev, `[INFO] Parsing raw headers from: ${importUrl}`]);
    try {
      const res = await fetch(importUrl);
      const m3uText = await res.text();
      // Simple parse to extract preview items
      const lines = m3uText.split("\n");
      const items: { name: string; url: string }[] = [];
      let tempName = "";
      for (const line of lines) {
        if (line.startsWith("#EXTINF:")) {
          const parts = line.split(",");
          tempName = parts[parts.length - 1].trim();
        } else if (line.startsWith("http")) {
          items.push({ name: tempName || "IPTV Source", url: line.trim() });
          tempName = "";
          if (items.length >= 10) break; // preview max 10
        }
      }
      setM3uPreviewItems(items);
      setImportProgressLog((prev) => [...prev, `[SUCCESS] Preview loaded successfully (${items.length} items parsed).`]);
    } catch (err: any) {
      setImportProgressLog((prev) => [...prev, `[ERROR] Failed to load preview: ${err.message || err}`]);
    } finally {
      setIsImporting(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl || !importName) {
      alert("Please provide both M3U URL and a playlist name.");
      return;
    }

    setIsImporting(true);
    setImportProgressLog((prev) => [
      ...prev,
      `[INFO] Ingestion requested for: ${importName}`,
      `[INFO] Contacting backend ingestion server...`,
    ]);

    try {
      const res = await fetch(`${apiUrl}/api/playlist/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl, name: importName }),
      });

      if (res.ok) {
        const data = await res.json();
        setImportProgressLog((prev) => [
          ...prev,
          `[SUCCESS] Ingestion completed.`,
          `[SUCCESS] ${data.message || "Import complete"}`,
        ]);
        setImportUrl("");
        setImportName("");
        setM3uPreviewItems([]);
        queryClient.invalidateQueries({ queryKey: ["channels"] });
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || "Server rejected playlist import");
      }
    } catch (err: any) {
      setImportProgressLog((prev) => [...prev, `[ERROR] Ingestion failed: ${err.message || err}`]);
    } finally {
      setIsImporting(false);
    }
  };

  // Toggle Stream status ONLINE <-> OFFLINE
  const handleToggleStatus = (channel: Channel) => {
    const nextStatus = getChannelStatus(channel) === "ONLINE" ? "OFFLINE" : "ONLINE";
    toggleStatusMutation.mutate({ id: channel.id, status: nextStatus });
  };

  // Delete channel completely
  const handleDeleteChannel = (id: string) => {
    if (confirm("Are you sure you want to delete this channel?")) {
      deleteChannelMutation.mutate(id);
    }
  };

  // In-modal mutations for detailed channel updates
  const updateChannelMetaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`${apiUrl}/api/channels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Metadata update failed");
      return res.json();
    },
    onSuccess: (updated) => {
      setEditingChannel((prev) => (prev ? { ...prev, ...updated } : null));
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
  });

  const addSourceMutation = useMutation({
    mutationFn: async (data: { channelId: string; url: string; priority: number }) => {
      const res = await fetch(`${apiUrl}/api/stream-sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Add source failed");
      return res.json();
    },
    onSuccess: () => {
      // Reload this editing channel details
      refetchEditingChannel();
    },
  });

  const updateSourceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`${apiUrl}/api/stream-sources/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Update source failed");
      return res.json();
    },
    onSuccess: () => {
      refetchEditingChannel();
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${apiUrl}/api/stream-sources/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete source failed");
      return res.json();
    },
    onSuccess: () => {
      refetchEditingChannel();
    },
  });

  const refetchEditingChannel = async () => {
    if (!editingChannel) return;
    const res = await fetch(`${apiUrl}/api/channels/${editingChannel.id}`);
    if (res.ok) {
      const fullDetails = await res.json();
      setEditingChannel(fullDetails);
    }
  };

  // Add source state
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newSourcePriority, setNewSourcePriority] = useState(1);

  // Active status counters
  const activeMetrics = wsMetrics || {
    totalChannels: totalChannelsCount,
    onlineChannels: totalChannelsCount,
    offlineChannels: 0,
    activePlaylists: 1,
    activeViewers: 0,
    systemStatus: "HEALTHY",
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0b1326] text-[#dae2fd]">
      {/* Header bar */}
      <header className="bg-[#0b1326]/70 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 flex justify-between items-center px-6 py-4 w-full">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#ff3366] text-2xl">leaderboard</span>
          <h1 className="text-xl font-bold text-white tracking-tight">IPTV Sports Panel</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/35">
            <span className="w-2 h-2 rounded-full bg-emerald-400 status-pulse"></span>
            <span className="text-xs font-bold text-emerald-400 tracking-wider">
              {activeMetrics.systemStatus}
            </span>
          </div>
          <a href="/player" className="bg-[#ff3366] text-white hover:opacity-90 active:scale-95 px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(255,51,102,0.4)]">
            <span className="material-symbols-outlined text-sm">play_circle</span>
            IPTV Player
          </a>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar navigation */}
        <aside className="hidden md:flex flex-col gap-2 p-6 bg-[#060e20] fixed left-0 top-[72px] h-[calc(100vh-72px)] w-[280px] border-r border-white/10 z-40">
          <div className="mb-6 px-2">
            <h2 className="text-xs uppercase tracking-widest text-white/40 font-bold">Mission Control</h2>
          </div>
          <nav className="flex flex-col gap-1.5">
            <a className="flex items-center gap-3 p-3 rounded-lg text-[#ff3366] font-bold bg-[#ff3366]/10 border-r-2 border-[#ff3366]" href="#">
              <span className="material-symbols-outlined">dashboard</span>
              <span className="text-sm">Dashboard</span>
            </a>
            <a className="flex items-center gap-3 p-3 rounded-lg text-white/70 hover:bg-white/5 hover:text-white transition-colors" href="/monitor">
              <span className="material-symbols-outlined">sensors</span>
              <span className="text-sm">Stream Delivery</span>
            </a>
            <a className="flex items-center gap-3 p-3 rounded-lg text-white/70 hover:bg-white/5 hover:text-white transition-colors" href="/observability">
              <span className="material-symbols-outlined">analytics</span>
              <span className="text-sm">Cluster Metrics</span>
            </a>
            <a className="flex items-center gap-3 p-3 rounded-lg text-white/70 hover:bg-white/5 hover:text-white transition-colors" href="/player">
              <span className="material-symbols-outlined">play_circle</span>
              <span className="text-sm">IPTV Player</span>
            </a>
          </nav>
        </aside>

        {/* Workspace */}
        <main className="flex-1 md:ml-[280px] p-6 lg:p-8 pb-32">
          {/* Diagnostic overview telemetry */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="glass-card p-6 rounded-xl border border-white/10 bg-white/5 flex flex-col gap-2 shadow-lg">
              <div className="flex justify-between items-start">
                <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Total Channels</span>
                <span className="material-symbols-outlined text-[#ff3366]/60">list_alt</span>
              </div>
              <div className="text-4xl font-bold mt-2 text-white">{activeMetrics.totalChannels}</div>
              <div className="text-emerald-400 text-xs flex items-center gap-1 mt-1 font-semibold">
                <span className="material-symbols-outlined text-base">database</span>
                <span>Active Database</span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl border border-white/10 bg-white/5 flex flex-col gap-2 shadow-lg">
              <div className="flex justify-between items-start">
                <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Online Streams</span>
                <span className="material-symbols-outlined text-emerald-400">live_tv</span>
              </div>
              <div className="text-4xl font-bold mt-2 text-white">
                {activeMetrics.totalChannels - activeMetrics.offlineChannels}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-[10px] text-emerald-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse"></span>
                  READY
                </span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl border border-white/10 bg-white/5 flex flex-col gap-2 shadow-lg">
              <div className="flex justify-between items-start">
                <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Offline Streams</span>
                <span className="material-symbols-outlined text-[#ff3366]">error</span>
              </div>
              <div className="text-4xl font-bold mt-2 text-white">{activeMetrics.offlineChannels}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/25 text-[10px] text-[#ff3366] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  CRITICAL
                </span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl border border-white/10 bg-white/5 flex flex-col gap-2 shadow-lg">
              <div className="flex justify-between items-start">
                <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Active Viewers</span>
                <span className="material-symbols-outlined text-amber-400">group</span>
              </div>
              <div className="text-4xl font-bold mt-2 text-white">
                {activeMetrics.activeViewers.toLocaleString()}
              </div>
              <div className="text-white/40 text-xs mt-1">HLS active viewer loops</div>
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            {/* Playlist Importer card */}
            <section className="xl:col-span-1 glass-card p-6 rounded-xl border border-white/10 bg-white/5 shadow-lg">
              <div className="flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-[#ff3366]">upload_file</span>
                <h3 className="text-lg font-bold text-white">Playlist Ingestion</h3>
              </div>
              <form onSubmit={handleImport} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 border-b border-white/5 pb-3">
                  <label className="text-xs text-white/60 font-semibold">IPTV-org GitHub Presets</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setImportName("IPTV-org All Countries");
                        setImportUrl("https://iptv-org.github.io/iptv/index.country.m3u");
                      }}
                      className="bg-white/5 border border-white/10 text-white font-bold py-2 rounded-lg hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all text-[10px] flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[13px] text-rose-400">public</span>
                      All Countries
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImportName("IPTV-org All Channels");
                        setImportUrl("https://iptv-org.github.io/iptv/index.m3u");
                      }}
                      className="bg-white/5 border border-white/10 text-white font-bold py-2 rounded-lg hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all text-[10px] flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[13px] text-[#ff3366]">playlist_play</span>
                      All Channels
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-white/60 font-semibold">Playlist Name</label>
                  <input
                    className="bg-black/30 border border-white/10 rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#ff3366] text-white"
                    placeholder="e.g. iptv-org Sports Link"
                    type="text"
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                    disabled={isImporting}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-white/60 font-semibold">M3U Playlist URL</label>
                  <input
                    className="bg-black/30 border border-white/10 rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#ff3366] text-white"
                    placeholder="https://iptv-org.github.io/iptv/index.m3u"
                    type="text"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    disabled={isImporting}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePreviewPlaylist}
                    disabled={isImporting || !importUrl}
                    className="flex-1 bg-white/5 border border-white/10 text-white font-bold py-2.5 rounded-lg hover:bg-white/10 active:scale-95 transition-all text-xs flex items-center justify-center gap-1 disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-sm">visibility</span>
                    Preview
                  </button>
                  <button
                    type="submit"
                    disabled={isImporting}
                    className="flex-[2] bg-[#ff3366] text-white font-bold py-2.5 rounded-lg hover:opacity-90 active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:scale-100"
                  >
                    <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                    {isImporting ? "Processing..." : "Import Ingest"}
                  </button>
                </div>

                {/* Playlist Previews */}
                {m3uPreviewItems.length > 0 && (
                  <div className="mt-2 bg-black/40 border border-white/5 rounded-lg p-3">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-[#ff3366] mb-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">preview</span> M3U Parsed Preview (Max 10)
                    </div>
                    <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                      {m3uPreviewItems.map((item, i) => (
                        <div key={i} className="flex flex-col text-[9px] border-b border-white/5 pb-1">
                          <span className="text-white font-semibold truncate">{item.name || "Unnamed"}</span>
                          <span className="text-white/40 truncate font-mono">{item.url}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Console Logs */}
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-white/60 font-semibold">Live System Console</span>
                    <span className="text-[9px] text-[#ff3366] font-bold uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-[#ff3366] rounded-full status-pulse"></span> websocket
                    </span>
                  </div>
                  <div className="h-48 bg-black/40 border border-white/5 rounded-lg p-3 font-mono text-[10px] overflow-y-auto flex flex-col gap-2 custom-scrollbar text-white/50">
                    {/* Render local progress logs first */}
                    {importProgressLog.map((log, i) => {
                      let colorClass = "text-white/50";
                      if (log.includes("[SUCCESS]")) colorClass = "text-emerald-400";
                      else if (log.includes("[ERROR]")) colorClass = "text-[#ff3366] font-bold";
                      return <div key={`local-${i}`} className={colorClass}>{log}</div>;
                    })}
                    {/* Render backend websocket logs */}
                    {logs.map((log, i) => {
                      let colorClass = "text-white/50";
                      if (log.level === "SUCCESS") colorClass = "text-emerald-400";
                      else if (log.level === "WARNING") colorClass = "text-amber-400";
                      else if (log.level === "ERROR") colorClass = "text-[#ff3366] font-bold";

                      return (
                        <div key={`ws-${i}`} className={colorClass}>
                          [{log.timestamp}] [{log.level}] [{log.source}] {log.message}
                        </div>
                      );
                    })}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              </form>
            </section>

            {/* Channels Table Grid */}
            <section className="xl:col-span-2 glass-card rounded-xl border border-white/10 bg-white/5 overflow-hidden shadow-lg">
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#ff3366]">monitoring</span>
                  <div>
                    <h3 className="text-lg font-bold text-white leading-tight">Channel Control Manager</h3>
                    <p className="text-xs text-white/40 mt-0.5">Edit source priorities, channel metadata and status toggles</p>
                  </div>
                </div>
                {/* Horizontal Category Filtering */}
                <div className="flex gap-1 bg-black/40 p-1 border border-white/5 rounded-lg">
                  <button
                    onClick={() => { setCategoryFilter("all"); setPage(1); }}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                      categoryFilter === "all" ? "bg-[#ff3366] text-white" : "text-white/60 hover:text-white"
                    }`}
                  >
                    ALL
                  </button>
                  {categories.slice(0, 4).map((cat) => (
                    <button
                      key={cat.slug}
                      onClick={() => { setCategoryFilter(cat.name); setPage(1); }}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                        categoryFilter === cat.name ? "bg-[#ff3366] text-white" : "text-white/60 hover:text-white"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {isLoadingChannels ? (
                <div className="p-20 text-center text-white/40 flex flex-col items-center gap-3">
                  <span className="material-symbols-outlined text-4xl animate-spin text-[#ff3366]">sync</span>
                  <span className="text-sm font-semibold tracking-wider">LOADING METADATA PIPELINE...</span>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white/5">
                          <th className="p-4 text-[10px] font-bold text-white/40 uppercase tracking-wider">Channel Identity</th>
                          <th className="p-4 text-[10px] font-bold text-white/40 uppercase tracking-wider">Category</th>
                          <th className="p-4 text-[10px] font-bold text-white/40 uppercase tracking-wider">Sources</th>
                          <th className="p-4 text-[10px] font-bold text-white/40 uppercase tracking-wider">Live Status</th>
                          <th className="p-4 text-[10px] font-bold text-white/40 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {channels.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-12 text-center text-xs text-white/30">
                              No channels configured. Import an M3U playlist to begin.
                            </td>
                          </tr>
                        ) : (
                          channels.map((channel) => {
                            const status = getChannelStatus(channel);
                            const isOnline = status === "ONLINE";
                            const isDegraded = status === "DEGRADED";

                            let colorClass = "text-emerald-400 bg-emerald-500/10 border border-emerald-500/25";
                            if (isDegraded) colorClass = "text-amber-400 bg-amber-500/10 border border-amber-500/25";
                            if (status === "OFFLINE") colorClass = "text-[#ff3366] bg-rose-500/10 border border-rose-500/25";

                            return (
                              <tr key={channel.id} className="hover:bg-white/5 transition-colors group">
                                <td className="p-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-[#ff3366] overflow-hidden shrink-0">
                                      {channel.logo ? (
                                        <img src={channel.logo} alt={channel.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="material-symbols-outlined text-sm">tv</span>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold text-white truncate max-w-[180px]">{channel.name}</div>
                                      <div className="text-[9px] font-mono text-white/30 truncate max-w-[150px]">{channel.id}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[9px] font-bold text-white/70 uppercase">
                                    {channel.categoryName}
                                  </span>
                                </td>
                                <td className="p-4 text-xs font-mono text-white/50">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-white font-bold">{channel.streamSources?.length || 0} configured</span>
                                    <span className="text-[9px] truncate max-w-[180px] text-white/30">
                                      {channel.streamSources?.find(s => s.isActive)?.url || "No active source"}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold ${colorClass}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      isOnline ? "bg-emerald-400 status-pulse" : isDegraded ? "bg-amber-400 status-pulse" : "bg-[#ff3366]"
                                    }`}></span>
                                    {status}
                                  </span>
                                </td>
                                <td className="p-4 text-right">
                                  <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => {
                                        // Fetch full details of the channel and open the editor modal
                                        setEditingChannel(channel);
                                        refetchEditingChannel();
                                      }}
                                      className="material-symbols-outlined p-1.5 text-white/50 hover:text-sky-400 transition-colors text-base"
                                      title="Edit channel properties & sources"
                                    >
                                      edit
                                    </button>
                                    <button
                                      onClick={() => handleToggleStatus(channel)}
                                      className="material-symbols-outlined p-1.5 text-white/50 hover:text-amber-400 transition-colors text-base"
                                      title="Toggle server routing status"
                                    >
                                      {status === "ONLINE" ? "block" : "check_circle"}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteChannel(channel.id)}
                                      className="material-symbols-outlined p-1.5 text-white/50 hover:text-[#ff3366] transition-colors text-base"
                                      title="Delete channel completely"
                                    >
                                      delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination control footer */}
                  {totalPages > 1 && (
                    <div className="p-4 border-t border-white/10 bg-white/5 flex justify-between items-center text-xs">
                      <span className="text-white/40">Showing page {page} of {totalPages}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="bg-white/5 border border-white/10 text-white font-bold py-1.5 px-3 rounded-lg hover:bg-white/10 transition-all disabled:opacity-40"
                        >
                          Prev
                        </button>
                        <button
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                          className="bg-white/5 border border-white/10 text-white font-bold py-1.5 px-3 rounded-lg hover:bg-white/10 transition-all disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </main>
      </div>

      {/* High-Fidelity Channel Editor & Source priority management Modal */}
      {editingChannel && (
        <div className="fixed inset-0 z-50 bg-[#060e20]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-2xl bg-[#0b1326] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <header className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-base font-bold text-white leading-tight">Channel Identity Transcoder</h3>
                <p className="text-xs text-white/40 mt-0.5">Edit channel details and stream source failovers</p>
              </div>
              <button
                onClick={() => setEditingChannel(null)}
                className="text-white/60 hover:text-white p-1 rounded-full hover:bg-white/5 material-symbols-outlined text-base"
              >
                close
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* Part 1: Basic channel metadata */}
              <section className="space-y-4">
                <h4 className="text-xs uppercase font-bold tracking-wider text-[#ff3366]">Basic Metadata</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-white/50 uppercase font-semibold">Channel Name</label>
                    <input
                      type="text"
                      className="bg-black/30 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#ff3366]"
                      value={editingChannel.name}
                      onChange={(e) => updateChannelMetaMutation.mutate({ id: editingChannel.id, data: { name: e.target.value } })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-white/50 uppercase font-semibold">Category Name</label>
                    <select
                      className="bg-black/30 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#ff3366]"
                      value={editingChannel.categoryName}
                      onChange={(e) => updateChannelMetaMutation.mutate({ id: editingChannel.id, data: { categoryName: e.target.value } })}
                    >
                      {categories.map((c) => (
                        <option key={c.slug} value={c.name} className="bg-[#0b1326] text-white">{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-[10px] text-white/50 uppercase font-semibold">Logo URL</label>
                    <input
                      type="text"
                      className="bg-black/30 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#ff3366]"
                      value={editingChannel.logo || ""}
                      onChange={(e) => updateChannelMetaMutation.mutate({ id: editingChannel.id, data: { logo: e.target.value || null } })}
                      placeholder="https://logo-source.png"
                    />
                  </div>
                </div>
              </section>

              {/* Part 2: Transcode stream sources list */}
              <section className="space-y-4">
                <h4 className="text-xs uppercase font-bold tracking-wider text-[#ff3366]">Transcode Stream Pipeline (Failovers)</h4>
                
                <div className="space-y-3">
                  {editingChannel.streamSources?.length === 0 ? (
                    <div className="text-center text-xs text-white/40 py-4 bg-black/20 rounded-lg">
                      No stream sources assigned. Add a source url below to activate HLS transcoding.
                    </div>
                  ) : (
                    [...(editingChannel.streamSources || [])]
                      .sort((a, b) => a.priority - b.priority)
                      .map((src) => (
                        <div key={src.id} className="flex flex-col sm:flex-row gap-3 items-center bg-black/40 border border-white/5 p-3 rounded-xl">
                          {/* Priority Indicator */}
                          <div className="flex items-center gap-1.5 shrink-0 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg text-xs font-mono">
                            <span className="text-white/40">Pri</span>
                            <span className="text-white font-bold">{src.priority}</span>
                          </div>

                          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <input
                              type="text"
                              className="bg-transparent border-none p-0 text-xs font-mono text-white/80 focus:outline-none truncate w-full"
                              value={src.url}
                              onChange={(e) => updateSourceMutation.mutate({ id: src.id, data: { url: e.target.value } })}
                            />
                            <div className="flex gap-2 text-[9px] uppercase font-bold text-white/30">
                              <span>{src.isActive ? "Primary Active" : "Standby Backup"}</span>
                            </div>
                          </div>

                          {/* Control Actions */}
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={() => updateSourceMutation.mutate({ id: src.id, data: { isActive: true } })}
                              className={`px-2 py-1 rounded text-[10px] font-bold ${
                                src.isActive ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white/5 text-white/50 border border-white/10 hover:text-white"
                              }`}
                              disabled={src.isActive}
                            >
                              Activate
                            </button>
                            <button
                              onClick={() => {
                                const nextPri = src.priority === 1 ? 2 : 1;
                                updateSourceMutation.mutate({ id: src.id, data: { priority: nextPri } });
                              }}
                              className="bg-white/5 border border-white/10 text-white hover:text-amber-400 p-1.5 rounded-lg transition-colors material-symbols-outlined text-xs"
                              title="Reorder priority"
                            >
                              swap_vert
                            </button>
                            <button
                              onClick={() => deleteSourceMutation.mutate(src.id)}
                              className="bg-white/5 border border-white/10 text-white hover:text-rose-500 p-1.5 rounded-lg transition-colors material-symbols-outlined text-xs"
                              title="Delete source"
                            >
                              delete
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>

                {/* Add new stream source form */}
                <div className="bg-black/20 border border-white/5 p-4 rounded-xl space-y-3">
                  <h5 className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Add Transcoding Backup Source</h5>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      className="flex-1 bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#ff3366]"
                      placeholder="http://iptv-source-provider.m3u8"
                      value={newSourceUrl}
                      onChange={(e) => setNewSourceUrl(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        className="w-16 bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none text-center"
                        value={newSourcePriority}
                        onChange={(e) => setNewSourcePriority(parseInt(e.target.value))}
                      />
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          if (!newSourceUrl) return;
                          addSourceMutation.mutate({
                            channelId: editingChannel.id,
                            url: newSourceUrl,
                            priority: newSourcePriority,
                          });
                          setNewSourceUrl("");
                          setNewSourcePriority(1);
                        }}
                        className="bg-[#ff3366] text-white font-bold px-4 py-2 rounded-lg text-xs hover:opacity-90 active:scale-95 transition-all shrink-0"
                      >
                        Add Source
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
            
            <footer className="p-6 border-t border-white/10 bg-white/5 flex justify-end shrink-0">
              <button
                onClick={() => setEditingChannel(null)}
                className="bg-[#ff3366] text-white font-bold py-2 px-6 rounded-lg text-xs hover:opacity-90 active:scale-95 transition-all"
              >
                Done
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
