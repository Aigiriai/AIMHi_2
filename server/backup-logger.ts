// Structured logging and metrics service for backup operations
import * as fs from 'fs';
import * as path from 'path';

// Log levels for structured logging
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

// Structured log entry interface
export interface BackupLogEntry {
  timestamp: string;
  level: LogLevel;
  operation: string;
  status: 'started' | 'completed' | 'failed' | 'skipped';
  duration?: number; // milliseconds
  data: {
    reason?: string;
    priority?: 'normal' | 'high';
    backupName?: string;
    fileSize?: number;
    fileSizeKB?: number;
    checksumMD5?: string;
    errorMessage?: string;
    errorType?: string;
    environment?: string;
    bucketId?: string;
    userId?: string;
    organizationId?: string;
  };
}

// Backup metrics interface
export interface BackupMetrics {
  totalBackups: number;
  successfulBackups: number;
  failedBackups: number;
  skippedBackups: number;
  successRate: number;
  averageDuration: number;
  averageFileSize: number;
  totalDataBackedUp: number; // bytes
  lastBackupTime: string;
  lastSuccessfulBackup: string;
  lastFailedBackup?: string;
  backupsByReason: Record<string, number>;
  backupsByPriority: Record<string, number>;
  errorsByType: Record<string, number>;
}

export class BackupLogger {
  private static instance: BackupLogger;
  private logsDir = path.join(process.cwd(), 'logs');
  private metricsFile = path.join(this.logsDir, 'backup-metrics.json');
  private logFile = path.join(this.logsDir, 'backup-operations.jsonl');
  private metrics: BackupMetrics;

  private constructor() {
    this.ensureLogsDirectory();
    this.metrics = this.loadMetrics();
  }

  static getInstance(): BackupLogger {
    if (!BackupLogger.instance) {
      BackupLogger.instance = new BackupLogger();
    }
    return BackupLogger.instance;
  }

  private ensureLogsDirectory(): void {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  private loadMetrics(): BackupMetrics {
    try {
      if (fs.existsSync(this.metricsFile)) {
        const data = fs.readFileSync(this.metricsFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('Failed to load backup metrics, initializing new metrics:', error);
    }

    return {
      totalBackups: 0,
      successfulBackups: 0,
      failedBackups: 0,
      skippedBackups: 0,
      successRate: 0,
      averageDuration: 0,
      averageFileSize: 0,
      totalDataBackedUp: 0,
      lastBackupTime: '',
      lastSuccessfulBackup: '',
      backupsByReason: {},
      backupsByPriority: {},
      errorsByType: {}
    };
  }

  private saveMetrics(): void {
    try {
      fs.writeFileSync(this.metricsFile, JSON.stringify(this.metrics, null, 2));
    } catch (error) {
      console.error('Failed to save backup metrics:', error);
    }
  }

  private writeLogEntry(entry: BackupLogEntry): void {
    try {
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error('Failed to write log entry:', error);
    }
  }

  // Log backup operation start
  logBackupStart(operation: string, data: Partial<BackupLogEntry['data']> = {}): string {
    const operationId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const entry: BackupLogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      operation: operationId,
      status: 'started',
      data: {
        environment: process.env.NODE_ENV || 'development',
        ...data
      }
    };

    this.writeLogEntry(entry);
    
    // Console output with structured format
    console.log(JSON.stringify({
      level: 'INFO',
      message: `🔄 Backup operation started: ${operation}`,
      operationId,
      ...data
    }));

    return operationId;
  }

  // Log backup operation completion
  logBackupSuccess(operationId: string, duration: number, data: Partial<BackupLogEntry['data']> = {}): void {
    const entry: BackupLogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      operation: operationId,
      status: 'completed',
      duration,
      data: {
        environment: process.env.NODE_ENV || 'development',
        ...data
      }
    };

    this.writeLogEntry(entry);
    this.updateMetrics('success', duration, data);

    // Console output with structured format
    console.log(JSON.stringify({
      level: 'INFO',
      message: `✅ Backup operation completed successfully`,
      operationId,
      duration: `${duration}ms`,
      ...data
    }));
  }

  // Log backup operation failure
  logBackupFailure(operationId: string, duration: number, error: Error, data: Partial<BackupLogEntry['data']> = {}): void {
    const entry: BackupLogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      operation: operationId,
      status: 'failed',
      duration,
      data: {
        environment: process.env.NODE_ENV || 'development',
        errorMessage: error.message,
        errorType: error.constructor.name,
        ...data
      }
    };

    this.writeLogEntry(entry);
    this.updateMetrics('failure', duration, data, error);

    // Console output with structured format
    console.error(JSON.stringify({
      level: 'ERROR',
      message: `❌ Backup operation failed`,
      operationId,
      duration: `${duration}ms`,
      error: error.message,
      errorType: error.constructor.name,
      ...data
    }));
  }

  // Log backup operation skip
  logBackupSkipped(operation: string, reason: string, data: Partial<BackupLogEntry['data']> = {}): void {
    const operationId = `${operation}_skipped_${Date.now()}`;
    
    const entry: BackupLogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      operation: operationId,
      status: 'skipped',
      data: {
        environment: process.env.NODE_ENV || 'development',
        reason,
        ...data
      }
    };

    this.writeLogEntry(entry);
    this.updateMetrics('skipped', 0, data);

    // Console output with structured format
    console.log(JSON.stringify({
      level: 'WARN',
      message: `⏰ Backup operation skipped: ${reason}`,
      operationId,
      reason,
      ...data
    }));
  }

  private updateMetrics(
    result: 'success' | 'failure' | 'skipped',
    duration: number,
    data: Partial<BackupLogEntry['data']>,
    error?: Error
  ): void {
    const now = new Date().toISOString();
    
    this.metrics.totalBackups++;
    this.metrics.lastBackupTime = now;

    if (result === 'success') {
      this.metrics.successfulBackups++;
      this.metrics.lastSuccessfulBackup = now;
      
      // Update average duration
      const totalDuration = this.metrics.averageDuration * (this.metrics.successfulBackups - 1) + duration;
      this.metrics.averageDuration = Math.round(totalDuration / this.metrics.successfulBackups);
      
      // Update file size metrics
      if (data.fileSize) {
        this.metrics.totalDataBackedUp += data.fileSize;
        const totalSize = this.metrics.averageFileSize * (this.metrics.successfulBackups - 1) + data.fileSize;
        this.metrics.averageFileSize = Math.round(totalSize / this.metrics.successfulBackups);
      }
    } else if (result === 'failure') {
      this.metrics.failedBackups++;
      this.metrics.lastFailedBackup = now;
      
      // Track error types
      if (error) {
        const errorType = error.constructor.name;
        this.metrics.errorsByType[errorType] = (this.metrics.errorsByType[errorType] || 0) + 1;
      }
    } else if (result === 'skipped') {
      this.metrics.skippedBackups++;
    }

    // Update success rate
    this.metrics.successRate = Math.round(
      (this.metrics.successfulBackups / this.metrics.totalBackups) * 100
    );

    // Track by reason and priority
    if (data.reason) {
      this.metrics.backupsByReason[data.reason] = (this.metrics.backupsByReason[data.reason] || 0) + 1;
    }
    
    if (data.priority) {
      this.metrics.backupsByPriority[data.priority] = (this.metrics.backupsByPriority[data.priority] || 0) + 1;
    }

    this.saveMetrics();
  }

  // Get current metrics
  getMetrics(): BackupMetrics {
    return { ...this.metrics };
  }

  // Get metrics summary for monitoring
  getMetricsSummary(): string {
    return JSON.stringify({
      level: 'INFO',
      message: 'Backup metrics summary',
      metrics: {
        totalBackups: this.metrics.totalBackups,
        successRate: `${this.metrics.successRate}%`,
        averageDuration: `${this.metrics.averageDuration}ms`,
        averageFileSize: `${Math.round(this.metrics.averageFileSize / 1024)}KB`,
        totalDataBackedUp: `${Math.round(this.metrics.totalDataBackedUp / (1024 * 1024))}MB`,
        lastSuccessfulBackup: this.metrics.lastSuccessfulBackup
      }
    });
  }

  // Clean old log files (keep last 30 days)
  cleanOldLogs(): void {
    try {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const logFiles = fs.readdirSync(this.logsDir);
      
      for (const file of logFiles) {
        const filePath = path.join(this.logsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < thirtyDaysAgo) {
          fs.unlinkSync(filePath);
          console.log(JSON.stringify({
            level: 'INFO',
            message: `Cleaned old log file: ${file}`,
            action: 'log_cleanup'
          }));
        }
      }
    } catch (error) {
      console.error('Failed to clean old logs:', error);
    }
  }
}

// Export singleton instance
export const backupLogger = BackupLogger.getInstance();