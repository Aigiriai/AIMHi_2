import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { authService, getAuthHeaders } from '@/lib/auth';

type ListedLog = { name: string; size: number; modifiedAt: number; compressed: boolean };

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function SystemManagement() {
  const [logs, setLogs] = useState<ListedLog[]>([]);
  const [dir, setDir] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSuperAdmin = authService.isSuperAdmin();

  const activeLogName = useMemo(() => 'app.log', []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await fetch('/api/admin/logs', { headers: { ...getAuthHeaders() } });
      if (!resp.ok) throw new Error(`Failed to load logs: ${resp.status}`);
      const data = await resp.json();
      setDir(data.directory || '');
      setLogs(Array.isArray(data.files) ? data.files : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) fetchLogs();
  }, [isSuperAdmin]);

  const handleBackup = async () => {
    try {
      setAction('backup');
      setError(null);
      const resp = await fetch('/api/auth/backup-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.message || 'Backup failed');
      }
      alert('Backup completed successfully');
    } catch (e: any) {
      alert(`Backup failed: ${e.message || 'Unknown error'}`);
    } finally {
      setAction(null);
    }
  };

  const handleRotate = async () => {
    try {
      setAction('rotate');
      setError(null);
      const resp = await fetch('/api/admin/logs/rotate', { method: 'POST', headers: { ...getAuthHeaders() } });
      if (!resp.ok) throw new Error(`Rotate failed: ${resp.status}`);
      await fetchLogs();
    } catch (e: any) {
      setError(e.message || 'Rotate failed');
    } finally {
      setAction(null);
    }
  };

  const handleClear = async () => {
    if (!confirm('This will delete all non-active logs. Continue?')) return;
    try {
      setAction('clear');
      setError(null);
      const resp = await fetch('/api/admin/logs', { method: 'DELETE', headers: { ...getAuthHeaders() } });
      if (!resp.ok) throw new Error(`Clear failed: ${resp.status}`);
      await fetchLogs();
    } catch (e: any) {
      setError(e.message || 'Clear failed');
    } finally {
      setAction(null);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete log "${name}"?`)) return;
    try {
      setAction(`delete:${name}`);
      setError(null);
      const resp = await fetch(`/api/admin/logs/${encodeURIComponent(name)}`, { method: 'DELETE', headers: { ...getAuthHeaders() } });
      if (!resp.ok) throw new Error(`Delete failed: ${resp.status}`);
      await fetchLogs();
    } catch (e: any) {
      setError(e.message || 'Delete failed');
    } finally {
      setAction(null);
    }
  };

  const handleDownload = async (name: string) => {
    try {
      setAction(`download:${name}`);
      setError(null);
      const resp = await fetch(`/api/admin/logs/${encodeURIComponent(name)}`, { headers: { ...getAuthHeaders() } });
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || 'Download failed');
    } finally {
      setAction(null);
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>System Management</CardTitle>
          <CardDescription>Backup database and manage server logs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Database Backup</div>
              <div className="text-sm text-muted-foreground">Create a secure backup of your data</div>
            </div>
            <Button onClick={handleBackup} disabled={action !== null} variant="outline">
              {action === 'backup' ? 'Backing up…' : 'Backup Database'}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Server Logs</div>
              <div className="text-sm text-muted-foreground">Rotate to start a fresh file, clear old logs, or download for analysis</div>
              {dir && <div className="text-xs text-muted-foreground mt-1">Directory: {dir}</div>}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleRotate} disabled={action !== null} variant="outline">{action === 'rotate' ? 'Rotating…' : 'Rotate'}</Button>
              <Button onClick={handleClear} disabled={action !== null} variant="destructive">{action === 'clear' ? 'Clearing…' : 'Clear Non-Active'}</Button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}

          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Modified</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4}>Loading…</TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={4}>No logs found</TableCell></TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.name}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={log.name === activeLogName ? 'font-semibold' : ''}>{log.name}</span>
                          {log.compressed && <span className="text-xs text-muted-foreground">(gz)</span>}
                          {log.name === activeLogName && <span className="text-xs text-blue-600">active</span>}
                        </div>
                      </TableCell>
                      <TableCell>{formatBytes(log.size)}</TableCell>
                      <TableCell>{new Date(log.modifiedAt).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" disabled={action !== null} onClick={() => handleDownload(log.name)}>
                            {action === `download:${log.name}` ? 'Downloading…' : 'Download'}
                          </Button>
                          <Button size="sm" variant="destructive" disabled={action !== null} onClick={() => handleDelete(log.name)}>
                            {action === `delete:${log.name}` ? 'Deleting…' : 'Delete'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
