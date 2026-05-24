export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  source: string;
  message: string;
}

export class LogService {
  private static logs: LogEntry[] = [];
  private static MAX_LOGS = 200;

  static log(level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR', source: string, message: string) {
    const timestamp = new Date().toTimeString().split(' ')[0];
    const entry: LogEntry = { timestamp, level, source, message };
    
    // Add to buffer
    this.logs.push(entry);
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }

    // Print to standard console
    const colorCode = 
      level === 'SUCCESS' ? '\x1b[32m' : // green
      level === 'WARNING' ? '\x1b[33m' : // yellow
      level === 'ERROR' ? '\x1b[31m' : // red
      '\x1b[36m'; // cyan (info)
    const resetCode = '\x1b[0m';
    console.log(`[${timestamp}] [${colorCode}${level}${resetCode}] [${source}] ${message}`);

    // Broadcast via WebSocket
    try {
      // Dynamic import to avoid circular dependency
      const { WebSocketService } = require('./websocket_service');
      WebSocketService.broadcast('system_log', entry);
    } catch (e) {
      // WebSocketService might not be loaded yet
    }
  }

  static getLogs(): LogEntry[] {
    return this.logs;
  }
}
