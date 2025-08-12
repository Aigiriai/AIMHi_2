import { useEffect, useState } from 'react';
import { getAuthHeaders, authService } from '@/lib/auth';
import { Link } from 'wouter';

type LogFile = {
  name: string;
  size: number;
  modifiedAt: number;
  compressed: boolean;
};

export default function AdminLogsPage() {
  const [files, setFiles] = useState<LogFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authService.isSuperAdmin()) {
      setError("Unauthorized");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/admin/logs', { headers: { ...getAuthHeaders() } });
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const data = await res.json();
        setFiles(data.files || []);
      } catch (e: any) {
        setError(e.message || 'Failed to load logs');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const downloadWithAuth = async (name: string) => {
    try {
      const res = await fetch(`/api/admin/logs/${encodeURIComponent(name)}`, { headers: { ...getAuthHeaders() } });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert((e as any).message || 'Download failed');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Server Logs</h1>
        <Link href="/management" className="text-blue-600 hover:underline">Back to Admin</Link>
      </div>

      {loading && <div>Loading...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="overflow-x-auto border rounded-md">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Filename</th>
                <th className="text-left p-3">Size</th>
                <th className="text-left p-3">Modified</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.name} className="border-t">
                  <td className="p-3 font-mono">{f.name}</td>
                  <td className="p-3">{formatBytes(f.size)}</td>
                  <td className="p-3">{new Date(f.modifiedAt).toLocaleString()}</td>
                  <td className="p-3">
                    <button
                      className="text-blue-600 hover:underline"
                      onClick={() => downloadWithAuth(f.name)}
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
              {files.length === 0 && (
                <tr>
                  <td className="p-3" colSpan={4}>No log files found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
