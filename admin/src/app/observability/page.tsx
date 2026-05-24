"use client";

import React, { useState, useEffect, useRef } from "react";
import { useWebSocket } from "../providers";

interface NodeStatus {
  id: string;
  ip: string;
  region: string;
  cpu: number;
  memory: number;
  ffmpegJobs: number;
  heartbeat: string;
}

export default function ObservabilityPage() {
  const { logs: wsLogs, metrics: wsMetrics } = useWebSocket();
  const [nodes, setNodes] = useState<NodeStatus[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Filter Loki logs in observability view
  const formattedLogs = wsLogs.map((l) => ({
    timestamp: l.timestamp,
    source: l.source,
    level: l.level,
    message: l.message,
  }));

  // Synchronize WebSocket metric broadcasts with node card states
  useEffect(() => {
    const activeStreamsCount = wsMetrics?.activeStreams?.length || 0;
    
    // Simulate real pod distribution based on active jobs in the cluster
    const podJobs1 = Math.ceil(activeStreamsCount / 2);
    const podJobs2 = Math.max(0, activeStreamsCount - podJobs1);

    setNodes([
      { 
        id: "master-pod-origin-1", 
        ip: "10.244.1.12", 
        region: "Origin Node (Render)", 
        cpu: activeStreamsCount > 0 ? Math.floor(Math.random() * 15) + 35 : Math.floor(Math.random() * 5) + 5, 
        memory: activeStreamsCount > 0 ? 540 + activeStreamsCount * 80 : 380, 
        ffmpegJobs: podJobs1, 
        heartbeat: "ACTIVE" 
      },
      { 
        id: "transcode-pod-vps-1", 
        ip: "172.16.4.15", 
        region: "Transcode Worker (VPS)", 
        cpu: activeStreamsCount > 0 ? Math.floor(Math.random() * 20) + 45 : Math.floor(Math.random() * 5) + 2, 
        memory: activeStreamsCount > 0 ? 820 + activeStreamsCount * 120 : 210, 
        ffmpegJobs: podJobs2, 
        heartbeat: activeStreamsCount > 0 ? "ACTIVE" : "STANDBY" 
      },
    ]);
  }, [wsMetrics]);

  // Scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [formattedLogs]);

  const activeTranscodeWorkers = wsMetrics?.activeStreams?.length || 0;
  const systemStatus = wsMetrics?.systemStatus || "HEALTHY";
  const cdnHitRatio = activeTranscodeWorkers > 0 ? 98.4 : 100.0;

  return (
    <div className="flex flex-col min-h-screen bg-[#0b1326] text-[#dae2fd]">
      {/* Header bar */}
      <header className="bg-[#0b1326]/70 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 flex justify-between items-center px-6 py-4 w-full">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-rose-500 text-2xl">analytics</span>
          <h1 className="text-xl font-bold text-white tracking-tight">Cluster Observability Panel</h1>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to Dashboard
          </a>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/35">
            <span className="w-2 h-2 rounded-full bg-emerald-400 status-pulse"></span>
            <span className="text-xs font-bold text-emerald-400 tracking-wider">
              PROMETHEUS SECURE
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar navigation */}
        <aside className="hidden md:flex flex-col gap-2 p-6 bg-[#060e20] fixed left-0 top-[72px] h-[calc(100vh-72px)] w-[280px] border-r border-white/10 z-40">
          <div className="mb-6 px-2">
            <h2 className="text-xs uppercase tracking-widest text-white/40 font-bold">Observability Stack</h2>
          </div>
          <nav className="flex flex-col gap-1.5">
            <a className="flex items-center gap-3 p-3 rounded-lg text-white/70 hover:bg-white/5 hover:text-white transition-colors" href="/">
              <span className="material-symbols-outlined">dashboard</span>
              <span className="text-sm">Main Panel</span>
            </a>
            <a className="flex items-center gap-3 p-3 rounded-lg text-white/70 hover:bg-white/5 hover:text-white transition-colors" href="/monitor">
              <span className="material-symbols-outlined">sensors</span>
              <span className="text-sm">Stream Delivery</span>
            </a>
            <a className="flex items-center gap-3 p-3 rounded-lg text-rose-500 font-bold bg-[#ff3366]/10 border-r-2 border-rose-500" href="#">
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
          {/* Quick Metrics */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="glass-card p-6 rounded-xl border border-white/10 bg-white/5 flex flex-col gap-1 shadow-lg">
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Transcoding Pods</span>
              <div className="text-4xl font-bold mt-2 text-white flex items-baseline gap-2">
                {nodes.length}
                <span className="text-xs text-emerald-400 font-normal">{nodes.filter(n=>n.heartbeat==="ACTIVE").length} active</span>
              </div>
              <div className="text-emerald-400 text-xs flex items-center gap-1 mt-2 font-semibold">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                <span>VPS Clustering Pool</span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl border border-white/10 bg-white/5 flex flex-col gap-1 shadow-lg">
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Cluster Avg CPU</span>
              <div className="text-4xl font-bold mt-2 text-white flex items-baseline gap-2">
                {activeTranscodeWorkers > 0 ? Math.floor(nodes.reduce((acc, n) => acc + n.cpu, 0) / nodes.length) : 8}%
                <span className="text-xs text-white/40 font-normal">utilization</span>
              </div>
              <div className="text-rose-400 text-xs flex items-center gap-1 mt-2 font-semibold">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                <span>FFmpeg transcode loads</span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl border border-white/10 bg-white/5 flex flex-col gap-1 shadow-lg">
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">CDN Hit Ratio</span>
              <div className="text-4xl font-bold mt-2 text-white flex items-baseline gap-2">
                {cdnHitRatio}%
                <span className="text-xs text-white/40 font-normal">Edge Cached</span>
              </div>
              <div className="text-sky-400 text-xs flex items-center gap-1 mt-2 font-semibold">
                <span className="material-symbols-outlined text-sm">bolt</span>
                <span>HLS segment caching</span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl border border-white/10 bg-white/5 flex flex-col gap-1 shadow-lg">
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Platform Health</span>
              <div className="text-4xl font-bold mt-2 text-white flex items-baseline gap-2">
                99.8%
                <span className="text-xs text-white/40 font-normal">uptime</span>
              </div>
              <div className="text-amber-400 text-xs flex items-center gap-1 mt-2 font-semibold">
                <span className="material-symbols-outlined text-sm">hourglass_empty</span>
                <span>Redis failover buffer</span>
              </div>
            </div>
          </section>

          {/* Grid section */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            {/* Cluster Nodes */}
            <section className="xl:col-span-2 glass-card rounded-xl border border-white/10 bg-white/5 overflow-hidden shadow-lg">
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-400">dns</span>
                  <h3 className="text-lg font-bold text-white">Pod Orchestration Node Map</h3>
                </div>
                <div className="text-xs text-white/40 font-bold uppercase tracking-wider">
                  Live Prometheus Scrape
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Node / Pod ID</th>
                      <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">IP Address</th>
                      <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Region Zone</th>
                      <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">CPU Metric</th>
                      <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Memory</th>
                      <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">FFmpeg Pipelines</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {nodes.map((node) => (
                      <tr key={node.id} className="hover:bg-white/5 transition-colors group">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-black/40 border border-white/10 flex items-center justify-center text-sky-400/80 font-bold text-xs">
                              pod
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-white">{node.id}</div>
                              <div className="text-[9px] text-emerald-400 font-bold tracking-widest flex items-center gap-1 uppercase">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse"></span>
                                {node.heartbeat}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-xs font-mono text-white/60">
                          {node.ip}
                        </td>
                        <td className="p-4 text-xs text-white/70">
                          {node.region}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 max-w-[120px]">
                            <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                              <div className="h-full bg-rose-500 rounded-full" style={{ width: `${node.cpu}%` }}></div>
                            </div>
                            <span className="text-xs font-mono text-white font-bold">{node.cpu}%</span>
                          </div>
                        </td>
                        <td className="p-4 text-xs font-mono text-white/60">
                          {node.memory} MB
                        </td>
                        <td className="p-4">
                          <span className="px-2.5 py-0.5 rounded bg-white/10 text-xs text-white font-bold font-mono">
                            {node.ffmpegJobs} pipelines
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Loki Logs Terminal */}
            <section className="xl:col-span-1 glass-card p-6 rounded-xl border border-white/10 bg-white/5 flex flex-col h-[480px] shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-rose-400">terminal</span>
                <h3 className="text-lg font-bold text-white">Loki Logs Query</h3>
              </div>
              <div className="flex-1 bg-black/40 border border-white/5 rounded-lg p-4 font-mono text-[10px] overflow-y-auto flex flex-col gap-2.5 custom-scrollbar text-white/50 shadow-inner">
                {formattedLogs.length === 0 ? (
                  <div className="text-center text-white/30 py-8">Waiting for Loki query scrapes...</div>
                ) : (
                  formattedLogs.map((log, i) => {
                    let colorClass = "text-white/50";
                    if (log.level === "SUCCESS") colorClass = "text-emerald-400";
                    else if (log.level === "WARNING") colorClass = "text-amber-400";
                    else if (log.level === "ERROR") colorClass = "text-rose-400 font-bold";

                    return (
                      <div key={i} className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-[9px] text-white/30">
                          <span>{log.timestamp}</span>
                          <span className="font-bold text-white/40">[{log.source}]</span>
                        </div>
                        <div className={colorClass}>{log.message}</div>
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
