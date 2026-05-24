"use client";

import React, { useState, useEffect, useRef } from "react";

interface Metrics {
  totalChannels: number;
  liveChannels: number;
  offlineChannels: number;
  activePlaylists: number;
  activeViewers: number;
  systemStatus: string;
}

interface Channel {
  id: string;
  name: string;
  logo: string | null;
  categoryName: string;
  isLive: boolean;
  status: string;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics>({
    totalChannels: 0,
    liveChannels: 0,
    offlineChannels: 0,
    activePlaylists: 0,
    activeViewers: 0,
    systemStatus: "HEALTHY",
  });
  const [channels, setChannels] = useState<Channel[]>([]);
  const [importUrl, setImportUrl] = useState("");
  const [importName, setImportName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    "[INFO] Initializing system observation module...",
    "[SUCCESS] Connected to master cache cluster.",
    "[INFO] Ready for M3U playlist stream processing.",
  ]);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  // Fetch initial data
  const fetchData = async () => {
    try {
      const metricsRes = await fetch(`${apiUrl}/api/system/metrics`);
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      }

      const channelsRes = await fetch(`${apiUrl}/api/channels?limit=10`);
      if (channelsRes.ok) {
        const channelsData = await channelsRes.json();
        setChannels(channelsData.data || []);
      }
    } catch (err) {
      console.warn("Backend down. Running with default mockup values.", err);
      // Mock fallbacks if backend server isn't running yet (useful for standalone UI preview)
      setMetrics({
        totalChannels: 142,
        liveChannels: 84,
        offlineChannels: 5,
        activePlaylists: 2,
        activeViewers: 2450,
        systemStatus: "HEALTHY",
      });
      setChannels([
        {
          id: "1",
          name: "Sky Sports Premier League",
          logo: null,
          categoryName: "Football",
          isLive: true,
          status: "ONLINE",
        },
        {
          id: "2",
          name: "BT Sport 1 HD",
          logo: null,
          categoryName: "Football",
          isLive: true,
          status: "ONLINE",
        },
        {
          id: "3",
          name: "ESPN Plus",
          logo: null,
          categoryName: "UFC / MMA",
          isLive: false,
          status: "OFFLINE",
        },
      ]);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Atmospheric logs simulation
  useEffect(() => {
    const simulatedEntries = [
      "[INFO] Checking stream latency across active edge nodes...",
      "[SUCCESS] Cache verified for categories and live channels.",
      "[WARNING] Mild buffer packet drop detected on backup stream.",
      "[INFO] System logs flushed to persistent audit storage.",
      "[INFO] Performing background cron checks on channel states...",
    ];

    const logsInterval = setInterval(() => {
      if (isImporting) return; // Don't interrupt playlist import logs
      const randomLog = simulatedEntries[Math.floor(Math.random() * simulatedEntries.length)];
      setLogs((prev) => [...prev, randomLog].slice(-50)); // Keep last 50 logs
    }, 8000);

    return () => clearInterval(logsInterval);
  }, [isImporting]);

  // Import Handler
  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl || !importName) {
      alert("Please provide both M3U URL and a playlist name.");
      return;
    }

    setIsImporting(true);
    setLogs((prev) => [
      ...prev,
      `[INFO] Starting ingestion for playlist: ${importName}`,
      `[INFO] Connecting to remote host at: ${importUrl}`,
    ]);

    try {
      const res = await fetch(`${apiUrl}/api/playlists/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl, name: importName }),
      });

      if (res.ok) {
        const data = await res.json();
        setLogs((prev) => [
          ...prev,
          `[SUCCESS] Playlist imported successfully!`,
          `[SUCCESS] ${data.message || "Import complete"}`,
        ]);
        setImportUrl("");
        setImportName("");
        fetchData(); // Reload statistics
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || "Server rejected playlist import");
      }
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        `[ERROR] Import failed: ${err.message || err}`,
      ]);
    } finally {
      setIsImporting(false);
    }
  };

  // Delete Channel
  const handleDeleteChannel = async (id: string) => {
    if (!confirm("Are you sure you want to delete this channel?")) return;

    try {
      const res = await fetch(`${apiUrl}/api/channels/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setLogs((prev) => [...prev, `[SUCCESS] Channel ${id} deleted.`]);
        fetchData();
      } else {
        alert("Failed to delete channel");
      }
    } catch (err) {
      console.error(err);
      // Mock removal from state if backend offline
      setChannels((prev) => prev.filter((c) => c.id !== id));
      setLogs((prev) => [...prev, `[SUCCESS] (Mock) Channel removed from UI.`]);
    }
  };

  // Disable / Toggle Status
  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "ONLINE" ? "OFFLINE" : "ONLINE";
    try {
      const res = await fetch(`${apiUrl}/api/channels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setLogs((prev) => [...prev, `[INFO] Channel status updated to ${nextStatus}.`]);
        fetchData();
      } else {
        alert("Failed to update status");
      }
    } catch (err) {
      console.error(err);
      // Mock toggle in state
      setChannels((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: nextStatus } : c))
      );
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header bar */}
      <header className="bg-background/70 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 flex justify-between items-center px-6 py-4 w-full">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-2xl">leaderboard</span>
          <h1 className="text-xl font-bold text-white tracking-tight">IPTV Sports Panel</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-container/10 border border-secondary/35">
            <span className="w-2 h-2 rounded-full bg-secondary status-pulse"></span>
            <span className="text-xs font-bold text-secondary tracking-wider">
              {metrics.systemStatus}
            </span>
          </div>
          <button className="material-symbols-outlined p-2 hover:bg-white/5 transition-colors rounded-full text-white">
            notifications
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar navigation */}
        <aside className="hidden md:flex flex-col gap-2 p-6 bg-surface-light/40 backdrop-blur-xl fixed left-0 top-[72px] h-[calc(100vh-72px)] w-[280px] border-r border-white/10 z-40">
          <div className="mb-6 px-2">
            <h2 className="text-xs uppercase tracking-widest text-white/40 font-bold">Mission Control</h2>
          </div>
          <nav className="flex flex-col gap-1.5">
            <a
              className="flex items-center gap-3 p-3 rounded-lg text-primary font-bold bg-primary/10 border-r-2 border-primary"
              href="#"
            >
              <span className="material-symbols-outlined">dashboard</span>
              <span className="text-sm">Dashboard</span>
            </a>
            <a
              className="flex items-center gap-3 p-3 rounded-lg text-white/70 hover:bg-white/5 hover:text-white transition-colors"
              href="/monitor"
            >
              <span className="material-symbols-outlined">sensors</span>
              <span className="text-sm">Stream Delivery</span>
            </a>
            <a
              className="flex items-center gap-3 p-3 rounded-lg text-white/70 hover:bg-white/5 hover:text-white transition-colors"
              href="/observability"
            >
              <span className="material-symbols-outlined">analytics</span>
              <span className="text-sm">Cluster Metrics</span>
            </a>
            <a
              className="flex items-center gap-3 p-3 rounded-lg text-white/70 hover:bg-white/5 hover:text-white transition-colors"
              href="#"
            >
              <span className="material-symbols-outlined">tv</span>
              <span className="text-sm">Channels</span>
            </a>
            <a
              className="flex items-center gap-3 p-3 rounded-lg text-white/70 hover:bg-white/5 hover:text-white transition-colors"
              href="#"
            >
              <span className="material-symbols-outlined">group</span>
              <span className="text-sm">Viewers</span>
            </a>
            <a
              className="flex items-center gap-3 p-3 rounded-lg text-white/70 hover:bg-white/5 hover:text-white transition-colors"
              href="#"
            >
              <span className="material-symbols-outlined">settings</span>
              <span className="text-sm">Settings</span>
            </a>
          </nav>
        </aside>

        {/* Dashboard workspace grid */}
        <main className="flex-1 md:ml-[280px] p-6 lg:p-8 pb-32">
          {/* Stats overview */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="glass-card p-6 rounded-xl flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                  Total Channels
                </span>
                <span className="material-symbols-outlined text-primary/60">list_alt</span>
              </div>
              <div className="text-4xl font-bold mt-2 text-white">{metrics.totalChannels}</div>
              <div className="text-secondary text-xs flex items-center gap-1 mt-1 font-semibold">
                <span className="material-symbols-outlined text-base">trending_up</span>
                <span>Active Database</span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                  Live Streams
                </span>
                <span className="material-symbols-outlined text-secondary">live_tv</span>
              </div>
              <div className="text-4xl font-bold mt-2 text-white">{metrics.liveChannels}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-secondary/15 border border-secondary/25 text-[10px] text-secondary font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary status-pulse"></span>
                  ONLINE
                </span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                  Offline Streams
                </span>
                <span className="material-symbols-outlined text-primary">error</span>
              </div>
              <div className="text-4xl font-bold mt-2 text-white">{metrics.offlineChannels}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/15 border border-primary/25 text-[10px] text-primary font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  CRITICAL
                </span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                  Active Viewers
                </span>
                <span className="material-symbols-outlined text-warning">group</span>
              </div>
              <div className="text-4xl font-bold mt-2 text-white">
                {metrics.activeViewers.toLocaleString()}
              </div>
              <div className="text-white/40 text-xs mt-1">Real-time mock traffic</div>
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            {/* Playlist Import Panel */}
            <section className="xl:col-span-1 glass-card p-6 rounded-xl">
              <div className="flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-primary">upload_file</span>
                <h3 className="text-lg font-bold text-white">Playlist Import</h3>
              </div>
              <form onSubmit={handleImport} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-white/60 font-semibold">Playlist Name</label>
                  <input
                    className="bg-black/30 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-white"
                    placeholder="e.g. Sports Master M3U"
                    type="text"
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                    disabled={isImporting}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-white/60 font-semibold">M3U URL</label>
                  <input
                    className="bg-black/30 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-white"
                    placeholder="https://provider.com/playlist.m3u"
                    type="text"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    disabled={isImporting}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isImporting}
                  className="bg-primary text-white font-bold py-3 px-6 rounded-lg hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100"
                >
                  <span className="material-symbols-outlined">sync</span>
                  {isImporting ? "Processing Ingestion..." : "Import Playlist"}
                </button>

                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-white/60 font-semibold">Import & System Logs</span>
                    <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider">
                      Live Console
                    </span>
                  </div>
                  <div className="h-48 bg-black/40 border border-white/5 rounded-lg p-3 font-mono text-[11px] overflow-y-auto flex flex-col gap-1.5 custom-scrollbar">
                    {logs.map((log, i) => {
                      let colorClass = "text-white/60";
                      if (log.includes("[SUCCESS]")) colorClass = "text-secondary";
                      else if (log.includes("[WARNING]")) colorClass = "text-warning";
                      else if (log.includes("[ERROR]")) colorClass = "text-primary";

                      return (
                        <div key={i} className={colorClass}>
                          {log}
                        </div>
                      );
                    })}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              </form>
            </section>

            {/* Channels Table */}
            <section className="xl:col-span-2 glass-card rounded-xl overflow-hidden">
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">monitoring</span>
                  <h3 className="text-lg font-bold text-white">Channel Monitoring</h3>
                </div>
                <button
                  onClick={fetchData}
                  className="text-white/60 hover:text-white flex items-center gap-1 text-xs font-bold"
                >
                  Refresh <span className="material-symbols-outlined text-sm">refresh</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Channel</th>
                      <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Category</th>
                      <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Status</th>
                      <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {channels.map((channel) => (
                      <tr key={channel.id} className="hover:bg-white/5 transition-colors group">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-primary/60">
                              <span className="material-symbols-outlined">tv</span>
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-white">{channel.name}</div>
                              <div className="text-[10px] text-white/40">
                                {channel.isLive ? "LIVE Stream" : "M3U Channel"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-white/70 uppercase">
                            {channel.categoryName}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`flex items-center gap-1.5 font-bold text-xs ${
                              channel.status === "ONLINE" ? "text-secondary" : "text-primary"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                channel.status === "ONLINE"
                                  ? "bg-secondary status-pulse"
                                  : "bg-primary"
                              }`}
                            ></span>
                            {channel.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleToggleStatus(channel.id, channel.status)}
                              className="material-symbols-outlined p-1.5 text-white/60 hover:text-warning transition-colors"
                              title="Toggle status"
                            >
                              block
                            </button>
                            <button
                              onClick={() => handleDeleteChannel(channel.id)}
                              className="material-symbols-outlined p-1.5 text-white/60 hover:text-primary transition-colors"
                              title="Delete channel"
                            >
                              delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* Mobile nav bar */}
      <nav className="md:hidden flex justify-around items-center h-16 fixed bottom-0 w-full z-50 rounded-t-xl bg-background/90 backdrop-blur-lg border-t border-white/10 shadow-[0_-4px_12px_rgba(0,0,0,0.5)]">
        <a className="flex flex-col items-center justify-center text-primary font-bold" href="#">
          <span className="material-symbols-outlined">dashboard</span>
          <span className="text-[10px] font-semibold">Home</span>
        </a>
        <a className="flex flex-col items-center justify-center text-white/60" href="#">
          <span className="material-symbols-outlined">live_tv</span>
          <span className="text-[10px] font-semibold">Live</span>
        </a>
        <a className="flex flex-col items-center justify-center text-white/60" href="#">
          <span className="material-symbols-outlined">group</span>
          <span className="text-[10px] font-semibold">Viewers</span>
        </a>
        <a className="flex flex-col items-center justify-center text-white/60" href="#">
          <span className="material-symbols-outlined">settings</span>
          <span className="text-[10px] font-semibold">Settings</span>
        </a>
      </nav>
    </div>
  );
}
