import type { Express, Response, Request } from 'express';
import fs from 'fs';
import path from 'path';
import { authenticateToken, requireSuperAdmin, type AuthRequest } from './auth';
import { getLogDir, rotateLogsNow, getCurrentLogBasename, getLogPathFor } from './logging/logger';

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

  // Rotate and clear current log safely (avoids deleting in-use file)
  app.post('/api/admin/logs/rotate', authenticateToken, requireSuperAdmin, async (_req: AuthRequest, res: Response) => {
    try {
      const before = safeListLogs();
      const result = await rotateLogsNow();
      const after = safeListLogs();
      res.json({
        message: 'Rotation requested. New logs will write to a fresh file.',
        rotatedFile: result.rotatedFile,
        before,
        after,
      });
    } catch (err: any) {
      console.error('Failed to rotate logs:', err);
      res.status(500).json({ message: 'Failed to rotate logs' });
    }
  });

  // Delete a specific log file. If it is the active file, rotate first and delete the rotated file (never unlink an open file).
  app.delete('/api/admin/logs/:name', authenticateToken, requireSuperAdmin, async (req: AuthRequest & Request<{ name: string }>, res: Response) => {
    try {
      const beforeList = safeListLogs();
      const allow = beforeList.files.map((f: ListedLog) => f.name);
      const name = req.params.name;

      if (!isSafeFilename(name, allow)) {
        return res.status(400).json({ message: 'Invalid filename' });
      }

      const activeBase = getCurrentLogBasename();
      const isActive = name === activeBase;

      if (isActive) {
        const beforeNames = new Set(beforeList.files.map(f => f.name));
        const { rotatedFile } = await rotateLogsNow();
        const afterList = safeListLogs();
        let target = rotatedFile ? path.basename(rotatedFile) : undefined;
        if (!target) {
          // Fallback: find the newly created rotated file by diff
          const afterNames = new Set(afterList.files.map(f => f.name));
          const newNames = Array.from(afterNames).filter(n => !beforeNames.has(n));
          // Pick the newest non-active file
          const candidates = afterList.files.filter(f => newNames.includes(f.name) && f.name !== activeBase);
          candidates.sort((a, b) => b.modifiedAt - a.modifiedAt);
          target = candidates[0]?.name;
        }

        if (!target) {
          return res.status(202).json({ message: 'Rotated active log; no rotated file identified to delete. Please list logs and delete the desired file.', rotated: true });
        }

        const fullPath = getLogPathFor(target);
        await fs.promises.unlink(fullPath);
        const after = safeListLogs();
        return res.json({ message: 'Active log rotated and previous file deleted', deleted: target, rotated: true, after });
      }

      // Non-active file: safe to unlink directly
      const fullPath = getLogPathFor(name);
      await fs.promises.unlink(fullPath);
      const after = safeListLogs();
      res.json({ message: 'Log deleted', deleted: name, isActive: false, after });
    } catch (err: any) {
      if (err && err.code === 'ENOENT') {
        return res.status(404).json({ message: 'File not found' });
      }
      console.error('Failed to delete log:', err);
      res.status(500).json({ message: 'Failed to delete log' });
    }
  });

  // Clear logs: rotate and delete all non-active logs.
  app.delete('/api/admin/logs', authenticateToken, requireSuperAdmin, async (_req: AuthRequest, res: Response) => {
    try {
      const before = safeListLogs();
      await rotateLogsNow();
      const nowList = safeListLogs();
      const activeBase = getCurrentLogBasename();
      const toDelete = nowList.files.filter(f => f.name !== activeBase).map(f => f.name);
      let deleted: string[] = [];
      for (const name of toDelete) {
        try {
          await fs.promises.unlink(getLogPathFor(name));
          deleted.push(name);
        } catch (e) {
          console.error('Failed to delete log during clear:', name, e);
        }
      }
      const after = safeListLogs();
      res.json({ message: 'Logs cleared except active', deleted, after });
    } catch (err: any) {
      console.error('Failed to clear logs:', err);
      res.status(500).json({ message: 'Failed to clear logs' });
    }
  });
}
