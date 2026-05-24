"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchOnWindowFocus: false,
    },
  },
});

export interface LogEntry {
  timestamp: string;
  level: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  source: string;
  message: string;
}

export interface SystemMetrics {
  totalChannels: number;
  onlineChannels: number;
  offlineChannels: number;
  activePlaylists: number;
  activeViewers: number;
  systemStatus: string;
  activeStreams: any[];
}

interface WebSocketContextType {
  socket: WebSocket | null;
  connected: boolean;
  logs: LogEntry[];
  metrics: SystemMetrics | null;
  channelStatus: Record<string, string>; // real-time channel status overrides
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  connected: false,
  logs: [],
  metrics: null,
  channelStatus: {},
});

export const useWebSocket = () => useContext(WebSocketContext);

export default function Providers({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [channelStatus, setChannelStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/api/ws";
    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      console.log("Connecting to WebSocket:", wsUrl);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket connected");
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const { event: wsEvent, data } = payload;

          if (wsEvent === "init_logs") {
            setLogs(data);
          } else if (wsEvent === "system_log") {
            setLogs((prev) => [...prev, data].slice(-200));
          } else if (wsEvent === "metrics_update") {
            setMetrics(data);
          } else if (wsEvent === "channel_status") {
            setChannelStatus((prev) => ({
              ...prev,
              [data.id]: data.status,
            }));
            // Add a dynamic log entry in logs for immediate client feedback
            const logEntry: LogEntry = {
              timestamp: new Date().toTimeString().split(" ")[0],
              level: data.status === "OFFLINE" ? "ERROR" : data.status === "DEGRADED" ? "WARNING" : "SUCCESS",
              source: "HealthCheck",
              message: `Channel state change: ${data.name || data.id} is now ${data.status}`,
            };
            setLogs((prev) => [...prev, logEntry].slice(-200));
          } else if (wsEvent === "stream_failure") {
            const logEntry: LogEntry = {
              timestamp: new Date().toTimeString().split(" ")[0],
              level: "ERROR",
              source: "Transcoder",
              message: `HLS transcode pipeline crash on channel ${data.channelId} (exited with code ${data.code})`,
            };
            setLogs((prev) => [...prev, logEntry].slice(-200));
          }
        } catch (err) {
          console.error("Error parsing WebSocket payload:", err);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket connection closed, retrying in 3s...");
        setConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        ws.close();
      };

      setSocket(ws);
    };

    connect();

    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimeout);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketContext.Provider value={{ socket, connected, logs, metrics, channelStatus }}>
        {children}
      </WebSocketContext.Provider>
    </QueryClientProvider>
  );
}
