import type { Express, Response, Request } from 'express';
import fs from 'fs';
import path from 'path';
import { authenticateToken, requireSuperAdmin, type AuthRequest } from './auth';
import { getLogDir } from './logging/logger';

type ListedLog = { name: string; size: number; modifiedAt: number; compressed: boolean };

function safeListLogs(): { dir: string; files: ListedLog[] } {
  const dir = getLogDir();
  const entries: fs.Dirent[] = fs.readdirSync(dir, { withFileTypes: true });
  const files: ListedLog[] = entries
    .filter((e: fs.Dirent) => e.isFile() && /^(app(-\d{4}-\d{2}-\d{2})(\.\d+)?\.log(\.gz)?)|(^app\.log$)/.test(e.name))
    .map((e: fs.Dirent) => {
      const full = path.join(dir, e.name);
      const stat = fs.statSync(full);
      return {
        name: e.name,
        size: stat.size,
        modifiedAt: stat.mtimeMs,
        compressed: e.name.endsWith('.gz'),
      } as ListedLog;
    })
    .sort((a: ListedLog, b: ListedLog) => b.modifiedAt - a.modifiedAt);
  return { dir, files };
}

function isSafeFilename(name: string, allowList: string[]) {
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return false;
  return allowList.includes(name);
}

export function registerAdminLogRoutes(app: Express) {
  // List log files
  app.get('/api/admin/logs', authenticateToken, requireSuperAdmin, (req: AuthRequest, res: Response) => {
    try {
      const { dir, files } = safeListLogs();
      res.json({ directory: dir, files });
    } catch (err: any) {
      console.error('Failed to list logs:', err);
      res.status(500).json({ message: 'Failed to list logs' });
    }
  });

  // Download a specific log file
  app.get('/api/admin/logs/:name', authenticateToken, requireSuperAdmin, (req: AuthRequest & Request<{ name: string }>, res: Response) => {
    try {
      const { dir, files } = safeListLogs();
      const allow = files.map((f: ListedLog) => f.name);
      const name = req.params.name;

      if (!isSafeFilename(name, allow)) {
        return res.status(400).json({ message: 'Invalid filename' });
      }

      const fullPath = path.join(dir, name);
      const stream = fs.createReadStream(fullPath);
      const isGz = name.endsWith('.gz');
      res.setHeader('Content-Type', isGz ? 'application/gzip' : 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  stream.on('error', (e: NodeJS.ErrnoException) => {
        console.error('Log download stream error:', e);
        if (!res.headersSent) res.status(500).end('Error reading file');
      });
      stream.pipe(res);
    } catch (err: any) {
      console.error('Failed to download log:', err);
      res.status(500).json({ message: 'Failed to download log' });
    }
  });
}
