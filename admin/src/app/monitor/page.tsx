"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWebSocket, LogEntry } from "../providers";

interface StreamStatus {
  channelId: string;
  channelName: string;
  status: string;
  processState: 'RUNNING' | 'STOPPED';
  activeSource: {
    id: string;
    url: string;
    priority: number;
    isActive: boolean;
  } | null;
  viewers: number;
  uptimeSeconds: number;
  bitrateEstimationKbps: number;
}

interface Channel {
  id: string;
  name: string;
  logo: string | null;
  categoryName: string;
  status: string;
}

function StreamMonitorPage() {
  const queryClient = useQueryClient();
  const { logs: wsLogs, metrics: wsMetrics } = useWebSocket();
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  // Filter out non-stream-engine logs from Loki logging stream
  useEffect(() => {
    const relevant = wsLogs
      .filter((l) => ["Transcoder", "HealthCheck", "Failover", "AdminAction"].includes(l.source))
      .map((l) => `[${l.timestamp}] [${l.source.toUpperCase()}] ${l.message}`);
    setConsoleLogs(relevant);
  }, [wsLogs]);

  // Scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleLogs]);

  // Fetch channels list to display the transcoding pipeline table
  const { data: channelsData, isLoading: isLoadingChannels } = useQuery({
    queryKey: ["channels_list"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/channels?limit=100`);
      if (!res.ok) throw new Error("Failed to load channels");
      return res.json();
    },
  });

  const channels: Channel[] = channelsData?.data || [];

  // Manual transcoder restart actuator
  const restartStreamMutation = useMutation({
    mutationFn: async ({ channelId, name }: { channelId: string; name: string }) => {
      // Log immediate user feedback in console logs
      setConsoleLogs((prev) => [
        ...prev,
        `[${new Date().toTimeString().split(" ")[0]}] [USER-ACTION] Initiating transcode reload on channel ${name}...`,
      ]);

      const res = await fetch(`${apiUrl}/api/channel/restart/${channelId}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to restart stream pipeline");
      return res.json();
    },
    onSuccess: (data, variables) => {
      setConsoleLogs((prev) => [
        ...prev,
        `[${new Date().toTimeString().split(" ")[0]}] [SUCCESS] Transcode container spawned for ${variables.name}.`,
      ]);
      queryClient.invalidateQueries({ queryKey: ["channels_list"] });
    },
    onError: (err: any, variables) => {
      setConsoleLogs((prev) => [
        ...prev,
        `[${new Date().toTimeString().split(" ")[0]}] [ERROR] Transcode restart failed for ${variables.name}: ${err.message || err}`,
      ]);
    },
  });

  const handleRestart = (channelId: string, name: string) => {
    restartStreamMutation.mutate({ channelId, name });
  };

  // Process live states from WebSocket metrics
  const activeStreams = wsMetrics?.activeStreams || [];
  const activeTranscodeWorkers = activeStreams.length;
  const totalViewers = wsMetrics?.activeViewers || 0;
  
  // Calculate aggregate metrics
  const activeJobsMap = React.useMemo(() => {
    const map: Record<string, typeof activeStreams[0]> = {};
    for (const s of activeStreams) {
      map[s.channelId] = s;
    }
    return map;
  }, [activeStreams]);

  return (
    <div className="flex flex-col min-h-screen bg-[#0b1326] text-[#dae2fd]">
      {/* Header bar */}
      <header className="bg-[#0b1326]/70 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 flex justify-between items-center px-6 py-4 w-full">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-rose-500 text-2xl animate-pulse">monitoring</span>
          <h1 className="text-xl font-bold text-white tracking-tight">Stream Delivery Console</h1>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to Dashboard
          </a>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/35">
            <span className="w-2 h-2 rounded-full bg-emerald-400 status-pulse"></span>
            <span className="text-xs font-bold text-emerald-400 tracking-wider">
              DELIVERY ACTIVE
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar navigation */}
        <aside className="hidden md:flex flex-col gap-2 p-6 bg-[#060e20] fixed left-0 top-[72px] h-[calc(100vh-72px)] w-[280px] border-r border-white/10 z-40">
          <div className="mb-6 px-2">
            <h2 className="text-xs uppercase tracking-widest text-white/40 font-bold">Diagnostics</h2>
          </div>
          <nav className="flex flex-col gap-1.5">
            <a className="flex items-center gap-3 p-3 rounded-lg text-white/70 hover:bg-white/5 hover:text-white transition-colors" href="/">
              <span className="material-symbols-outlined">dashboard</span>
              <span className="text-sm">Main Panel</span>
            </a>
            <a className="flex items-center gap-3 p-3 rounded-lg text-rose-500 font-bold bg-[#ff3366]/10 border-r-2 border-rose-500" href="#">
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
          {/* Telemetry charts */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="glass-card p-6 rounded-xl border border-white/10 bg-white/5 flex flex-col gap-1 shadow-lg">
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">FFmpeg Transcoders</span>
              <div className="text-4xl font-bold mt-2 text-white flex items-baseline gap-2">
                {activeTranscodeWorkers}
                <span className="text-xs text-white/40 font-normal">active processes</span>
              </div>
              <div className="text-rose-400 text-xs flex items-center gap-1 mt-2 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 status-pulse"></span>
                <span>On-Demand HLS transcode</span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl border border-white/10 bg-white/5 flex flex-col gap-1 shadow-lg">
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">HLS Viewers</span>
              <div className="text-4xl font-bold mt-2 text-white flex items-baseline gap-2">
                {totalViewers.toLocaleString()}
                <span className="text-xs text-white/40 font-normal">connections</span>
              </div>
              <div className="text-emerald-400 text-xs flex items-center gap-1 mt-2 font-semibold">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                <span>Secure Proxy Delivery</span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl border border-white/10 bg-white/5 flex flex-col gap-1 shadow-lg">
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Estimated Bandwidth</span>
              <div className="text-4xl font-bold mt-2 text-white flex items-baseline gap-2">
                {activeTranscodeWorkers * 2300}
                <span className="text-xs text-white/40 font-normal">kbps</span>
              </div>
              <div className="text-sky-400 text-xs flex items-center gap-1 mt-2 font-semibold">
                <span className="material-symbols-outlined text-sm">speed</span>
                <span>1080p / 720p copy load</span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl border border-white/10 bg-white/5 flex flex-col gap-1 shadow-lg">
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">CDN Cache Ratio</span>
              <div className="text-4xl font-bold mt-2 text-white flex items-baseline gap-2">
                98.4%
                <span className="text-xs text-white/40 font-normal">hit ratio</span>
              </div>
              <div className="text-amber-400 text-xs flex items-center gap-1 mt-2 font-semibold">
                <span className="material-symbols-outlined text-sm">storage</span>
                <span>Memory Segment Cache</span>
              </div>
            </div>
          </section>

          {/* Grid logs & pipeline */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            {/* Stream Pipeline list */}
            <section className="xl:col-span-2 glass-card rounded-xl border border-white/10 bg-white/5 overflow-hidden shadow-lg">
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-400">sensors</span>
                  <h3 className="text-lg font-bold text-white">Stream Pipeline Grid</h3>
                </div>
                <div className="text-xs text-white/40 font-bold uppercase tracking-wider">
                  Real-time Pipeline Status
                </div>
              </div>

              {isLoadingChannels ? (
                <div className="p-12 text-center text-white/40">Loading diagnostic telemetry pipeline...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/5">
                        <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Stream Target</th>
                        <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Transcoder Status</th>
                        <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Uptime</th>
                        <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Active Traffic</th>
                        <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider text-right">Transcode Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {channels.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-xs text-white/30">
                            No channels initialized in pipeline. Import a playlist to begin.
                          </td>
                        </tr>
                      ) : (
                        channels.map((channel) => {
                          const activeJob = activeJobsMap[channel.id];
                          const isRunning = !!activeJob;
                          
                          let statusColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/25";
                          if (channel.status === 'DEGRADED') statusColor = "text-amber-400 bg-amber-500/10 border-amber-500/25";
                          if (channel.status === 'OFFLINE') statusColor = "text-rose-400 bg-rose-500/10 border-rose-500/25";

                          return (
                            <tr key={channel.id} className="hover:bg-white/5 transition-colors group">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-rose-400/80">
                                    <span className="material-symbols-outlined text-sm">settings_input_antenna</span>
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold text-white">{channel.name}</div>
                                    <span className={`px-2 py-0.2 rounded border text-[9px] font-bold uppercase ${statusColor}`}>
                                      {channel.status}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 font-mono">
                                {isRunning ? (
                                  <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded w-max">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse"></span>
                                    PID {activeJob.pid} ACTIVE
                                  </span>
                                ) : (
                                  <span className="text-xs text-white/30">IDLE STANDBY</span>
                                )}
                              </td>
                              <td className="p-4 text-xs font-mono text-white/60">
                                {isRunning && activeJob.uptimeSeconds 
                                  ? `${Math.floor(activeJob.uptimeSeconds / 60)}m ${activeJob.uptimeSeconds % 60}s`
                                  : "—"
                                }
                              </td>
                              <td className="p-4">
                                {isRunning ? (
                                  <div className="flex flex-col">
                                    <span className="text-xs text-white font-bold">{activeJob.viewers} HLS loops</span>
                                    <span className="text-[9px] text-white/30 font-mono truncate max-w-[150px]">{activeJob.sourceUrl}</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-white/30">0</span>
                                )}
                              </td>
                              <td className="p-4 text-right">
                                <button
                                  onClick={() => handleRestart(channel.id, channel.name)}
                                  className="bg-white/5 hover:bg-rose-500/20 text-white hover:text-rose-400 border border-white/10 hover:border-rose-500/30 font-bold py-1.5 px-3 rounded-lg text-xs transition-all flex items-center gap-1.5 ml-auto shadow-inner"
                                >
                                  <span className="material-symbols-outlined text-sm">restart_alt</span>
                                  Restart Transcode
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Loki Live Orchestrator console */}
            <section className="xl:col-span-1 glass-card p-6 rounded-xl border border-white/10 bg-white/5 flex flex-col h-[520px] shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-rose-400">terminal</span>
                <h3 className="text-lg font-bold text-white">Engine Output Logs</h3>
              </div>
              <div className="flex-1 bg-black/40 border border-white/5 rounded-lg p-4 font-mono text-[10px] overflow-y-auto flex flex-col gap-2 custom-scrollbar text-white/50 shadow-inner">
                {consoleLogs.length === 0 ? (
                  <div className="text-center text-white/30 py-8">Waiting for engine transcoder output...</div>
                ) : (
                  consoleLogs.map((log, i) => {
                    let colorClass = "text-white/50";
                    if (log.includes("[SUCCESS]")) colorClass = "text-emerald-400";
                    else if (log.includes("[ERROR]")) colorClass = "text-rose-400 font-bold";
                    else if (log.includes("[WARNING]")) colorClass = "text-amber-400";
                    else if (log.includes("[USER-ACTION]")) colorClass = "text-sky-400";

                    return (
                      <div key={i} className={colorClass}>
                        {log}
                      </div>
                    );
                  })
                )}
                <div ref={logsEndRef} />
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

import dynamic from "next/dynamic";
export default dynamic(() => Promise.resolve(StreamMonitorPage), { ssr: false });
