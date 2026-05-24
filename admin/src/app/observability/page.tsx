"use client";

import React, { useState, useEffect, useRef } from "react";

interface NodeStatus {
  id: string;
  ip: string;
  region: string;
  cpu: number;
  memory: number;
  ffmpegJobs: number;
  heartbeat: string;
}

interface LogEntry {
  timestamp: string;
  level: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  source: string;
  message: string;
}

export default function ObservabilityPage() {
  const [nodes, setNodes] = useState<NodeStatus[]>([]);
  const [cdnHitRatio, setCdnHitRatio] = useState(98.2);
  const [activeQueueJobs, setActiveQueueJobs] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchClusterMetrics = () => {
    // Generate cluster statistics (mock telemetry mapping cluster node state)
    setNodes([
      { id: "backend-pod-7df9", ip: "10.244.1.12", region: "Asia (Origin)", cpu: Math.floor(Math.random() * 25) + 40, memory: 580, ffmpegJobs: 4, heartbeat: "ACTIVE" },
      { id: "backend-pod-a82f", ip: "10.244.2.8", region: "Asia (Origin)", cpu: Math.floor(Math.random() * 20) + 30, memory: 512, ffmpegJobs: 3, heartbeat: "ACTIVE" },
      { id: "edge-node-us-east", ip: "172.16.4.15", region: "US East (Edge)", cpu: Math.floor(Math.random() * 15) + 10, memory: 280, ffmpegJobs: 0, heartbeat: "ACTIVE" },
      { id: "edge-node-eu-west", ip: "172.16.8.22", region: "Europe West (Edge)", cpu: Math.floor(Math.random() * 15) + 15, memory: 310, ffmpegJobs: 0, heartbeat: "ACTIVE" }
    ]);

    setCdnHitRatio(prev => {
      const delta = (Math.random() - 0.5) * 0.4;
      return parseFloat(Math.min(100, Math.max(90, prev + delta)).toFixed(2));
    });

    setActiveQueueJobs(Math.floor(Math.random() * 3));
  };

  useEffect(() => {
    fetchClusterMetrics();
    const interval = setInterval(fetchClusterMetrics, 8000);
    return () => clearInterval(interval);
  }, []);

  // Scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Initial and simulated logs
  useEffect(() => {
    const initialLogs: LogEntry[] = [
      { timestamp: "23:00:02", level: "INFO", source: "Kube-Ingress", message: "LoadBalancer routing stream client traffic." },
      { timestamp: "23:01:10", level: "SUCCESS", source: "Redis-Cluster", message: "Owner lock acquired for stream: Sky Sports PL." },
      { timestamp: "23:02:15", level: "INFO", source: "Prometheus", message: "Metrics scraped from exporter backend instances." },
      { timestamp: "23:03:00", level: "WARNING", source: "Edge-Proxy", message: "Low bandwidth warning on downstream CDN cache miss." }
    ];
    setLogs(initialLogs);

    const logPool: LogEntry[] = [
      { timestamp: "", level: "INFO", source: "FFmpeg-Node", message: "Refreshing Redis lock for active streams..." },
      { timestamp: "", level: "SUCCESS", source: "CDN-Cloudflare", message: "Static segment .ts cache HIT registered." },
      { timestamp: "", level: "SUCCESS", source: "CDN-Cloudflare", message: "Manifest index .m3u8 served with max-age=5 headers." },
      { timestamp: "", level: "INFO", source: "Ingress-Throttler", message: "API limit check: Rate limits healthy." },
      { timestamp: "", level: "WARNING", source: "Failover-Manager", message: "FFmpeg stream retry initiated for fallback link." }
    ];

    const logsTimer = setInterval(() => {
      const time = new Date().toTimeString().split(' ')[0];
      const randomLog = logPool[Math.floor(Math.random() * logPool.length)];
      const newEntry: LogEntry = {
        ...randomLog,
        timestamp: time
      };
      setLogs(prev => [...prev, newEntry].slice(-50));
    }, 5000);

    return () => clearInterval(logsTimer);
  }, []);

  const totalFFmpegWorkers = nodes.reduce((acc, n) => acc + n.ffmpegJobs, 0);
  const avgCpu = Math.floor(nodes.reduce((acc, n) => acc + n.cpu, 0) / nodes.length);

  return (
    <div className="flex flex-col min-h-screen bg-[#0b1326] text-[#dae2fd]">
      {/* Header bar */}
      <header className="bg-background/70 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 flex justify-between items-center px-6 py-4 w-full">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-rose-500 text-2xl">analytics</span>
          <h1 className="text-xl font-bold text-white tracking-tight">Observability Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to Dashboard
          </a>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/35">
            <span className="w-2 h-2 rounded-full bg-emerald-400 status-pulse"></span>
            <span className="text-xs font-bold text-emerald-400 tracking-wider">
              PROMETHEUS SCRA-HEALTHY
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar navigation */}
        <aside className="hidden md:flex flex-col gap-2 p-6 bg-surface-light/40 backdrop-blur-xl fixed left-0 top-[72px] h-[calc(100vh-72px)] w-[280px] border-r border-white/10 z-40">
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
            <a className="flex items-center gap-3 p-3 rounded-lg text-rose-500 font-bold bg-rose-500/10 border-r-2 border-rose-500" href="#">
              <span className="material-symbols-outlined">analytics</span>
              <span className="text-sm">Cluster Metrics</span>
            </a>
          </nav>
        </aside>

        {/* Workspace */}
        <main className="flex-1 md:ml-[280px] p-6 lg:p-8 pb-32">
          {/* Quick Metrics */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="glass-card p-6 rounded-xl flex flex-col gap-1">
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Kubernetes Pods</span>
              <div className="text-4xl font-bold mt-2 text-white flex items-baseline gap-2">
                {nodes.length}
                <span className="text-xs text-emerald-400 font-normal">4 running</span>
              </div>
              <div className="text-emerald-400 text-xs flex items-center gap-1 mt-2 font-semibold">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                <span>HPA Scaling limits 2-10</span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl flex flex-col gap-1">
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Cluster Avg CPU</span>
              <div className="text-4xl font-bold mt-2 text-white flex items-baseline gap-2">
                {avgCpu}%
                <span className="text-xs text-white/40 font-normal">utilization</span>
              </div>
              <div className="text-rose-400 text-xs flex items-center gap-1 mt-2 font-semibold">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                <span>FFmpeg transcoding load</span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl flex flex-col gap-1">
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">CDN Cache Hit Ratio</span>
              <div className="text-4xl font-bold mt-2 text-white flex items-baseline gap-2">
                {cdnHitRatio}%
                <span className="text-xs text-white/40 font-normal">Cloudflare Edge</span>
              </div>
              <div className="text-sky-400 text-xs flex items-center gap-1 mt-2 font-semibold">
                <span className="material-symbols-outlined text-sm">bolt</span>
                <span>max-age=60s for segment caching</span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl flex flex-col gap-1">
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Active Queue Jobs</span>
              <div className="text-4xl font-bold mt-2 text-white flex items-baseline gap-2">
                {activeQueueJobs}
                <span className="text-xs text-white/40 font-normal">jobs pending</span>
              </div>
              <div className="text-amber-400 text-xs flex items-center gap-1 mt-2 font-semibold">
                <span className="material-symbols-outlined text-sm">hourglass_empty</span>
                <span>BullMQ Redis cluster queue</span>
              </div>
            </div>
          </section>

          {/* Grid section */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            {/* Cluster Nodes Datatable */}
            <section className="xl:col-span-2 glass-card rounded-xl overflow-hidden">
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-400">dns</span>
                  <h3 className="text-lg font-bold text-white">Pod Orchestration Node Map</h3>
                </div>
                <div className="text-xs text-white/40 font-bold uppercase tracking-wider">
                  Real-time Scrape
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
                      <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Active Streams</th>
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
                          <span className="px-2 py-0.5 rounded bg-white/10 text-xs text-white font-bold">
                            {node.ffmpegJobs} channels
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Loki Logs Terminal */}
            <section className="xl:col-span-1 glass-card p-6 rounded-xl flex flex-col h-[480px]">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-rose-400">terminal</span>
                <h3 className="text-lg font-bold text-white">Loki Logs Query</h3>
              </div>
              <div className="flex-1 bg-black/40 border border-white/5 rounded-lg p-4 font-mono text-[11px] overflow-y-auto flex flex-col gap-2.5 custom-scrollbar text-white/60">
                {logs.map((log, i) => {
                  let colorClass = "text-white/60";
                  if (log.level === "SUCCESS") colorClass = "text-emerald-400";
                  else if (log.level === "WARNING") colorClass = "text-amber-400";
                  else if (log.level === "ERROR") colorClass = "text-rose-400";

                  return (
                    <div key={i} className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 text-[9px] text-white/30">
                        <span>{log.timestamp}</span>
                        <span className="font-bold text-white/40">[{log.source}]</span>
                      </div>
                      <div className={colorClass}>{log.message}</div>
                    </div>
                  );
                })}
                <div ref={logsEndRef} />
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
