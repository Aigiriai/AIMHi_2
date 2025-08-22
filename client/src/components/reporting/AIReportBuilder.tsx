import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { getAuthHeaders } from '@/lib/auth';
import { 
  Sparkles,
  Database, 
  Play, 
  Loader2,
  BarChart3, 
  PieChart as PieChartIcon, 
  LineChart as LineChartIcon,
  Table2,
  Brain,
  Download as DownloadIcon,
  Save as SaveIcon,
  Copy as CopyIcon
} from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AIReportRequest {
  prompt: string;
  preferred_chart_type?: string;
  additional_context?: string;
}

interface AIReportResult {
  execution_id: number;
  generated_sql: string;
  results: any[];
  row_count: number;
  execution_time: number;
  status: string;
  chart_type?: string;
  ai_analysis?: {
    interpreted_request: string;
    recommended_chart: string;
    confidence_score: number;
  };
}

interface SavedTemplate {
  id: number;
  template_name: string;
  description?: string;
  category?: string;
  chart_type?: string;
  created_at?: string;
  updated_at?: string;
  execution_count?: number;
  last_executed_at?: string;
  user_id?: number;
  is_public?: number;
}

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

const chartTypes = [
  { id: 'auto', name: 'Let AI Decide', icon: Brain },
  { id: 'table', name: 'Table', icon: Table2 },
  { id: 'bar', name: 'Bar Chart', icon: BarChart3 },
  { id: 'line', name: 'Line Chart', icon: LineChartIcon },
  { id: 'pie', name: 'Pie Chart', icon: PieChartIcon }
];

// Helpers to normalize data and derive chart model
function detectChartModel(data: any[]) {
  if (!data || data.length === 0) return { xKey: undefined as string | undefined, valueKeys: [] as string[], data: [] as any[] };
  const first = data[0];
  const keys = Object.keys(first);
  // Try to pick first non-numeric key as xKey
  let xKey = keys.find(k => isNaN(Number(first[k])));
  if (!xKey) {
    // If all numeric, synthesize an index key
    const normalized = data.map((row, idx) => ({ idx, ...row }));
    return { xKey: 'idx', valueKeys: Object.keys(first), data: normalized };
  }
  // Collect numeric-like keys as valueKeys
  const valueKeys = keys.filter(k => k !== xKey && (typeof first[k] === 'number' || !isNaN(Number(first[k]))));
  // Normalize rows: coerce numeric-like strings to numbers for valueKeys
  const normalized = data.map(row => {
    const copy: any = { ...row };
    valueKeys.forEach(k => {
      const v = row[k];
      copy[k] = typeof v === 'number' ? v : (v == null || v === '' ? 0 : Number(v));
    });
    return copy;
  });
  return { xKey, valueKeys, data: normalized };
}

// Chart rendering function
function renderChart(data: any[], chartType: string, containerRef?: React.RefObject<HTMLDivElement>) {
  if (!data || data.length === 0) return null;
  const model = detectChartModel(data);
  if (!model.xKey && model.valueKeys.length === 0) return null;
  
  try {
    switch (chartType) {
      case 'bar': {
        const bars = (model.valueKeys.length > 0 ? model.valueKeys : Object.keys(model.data[0]).filter(k => k !== model.xKey)).slice(0, 4);
        return (
          <div className="h-96" ref={containerRef}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.data}>
                <CartesianGrid strokeDasharray="3 3" />
                {model.xKey && <XAxis dataKey={model.xKey} />}
                <YAxis />
                <Tooltip />
                <Legend />
                {bars.map((key, index) => (
                  <Bar key={key} dataKey={key} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }
      case 'line': {
        const lines = (model.valueKeys.length > 0 ? model.valueKeys : Object.keys(model.data[0]).filter(k => k !== model.xKey)).slice(0, 4);
        return (
          <div className="h-96" ref={containerRef}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={model.data}>
                <CartesianGrid strokeDasharray="3 3" />
                {model.xKey && <XAxis dataKey={model.xKey} />}
                <YAxis />
                <Tooltip />
                <Legend />
                {lines.map((key, index) => (
                  <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      }
      case 'pie': {
        const keys = Object.keys(model.data[0]);
        const nameKey = model.xKey || keys[0];
        const valKey = (model.valueKeys[0] || keys.find(k => k !== nameKey)) as string;
        const pieData = model.data.slice(0, 8).map(item => ({ name: item[nameKey], value: Number(item[valKey] || 0) }));
        return (
          <div className="h-96" ref={containerRef}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }: { name: string; value: number }) => `${name}: ${value}`}>
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
      }
      case 'table':
      default:
        return null; // Table will be rendered separately
    }
  } catch (error) {
    console.error('Chart rendering error:', error);
    return (
      <div className="h-96 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-center">
          <p className="text-sm text-red-600 dark:text-red-400">Chart rendering failed - showing data as table</p>
        </div>
      </div>
    );
  }
}

export function AIReportBuilder() {
  const [prompt, setPrompt] = useState('');
  const [chartType, setChartType] = useState('auto');
  const [additionalContext, setAdditionalContext] = useState('');
  const [reportResults, setReportResults] = useState<AIReportResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();
  
  // Saved templates
  const savedTemplatesQuery = useQuery<SavedTemplate[]>({
    queryKey: ['/api/report/templates'],
    queryFn: async () => {
      const res = await fetch('/api/report/templates', { headers: { ...getAuthHeaders() }});
      if (!res.ok) throw new Error('Failed to fetch saved queries');
      return res.json();
    },
    staleTime: 30_000,
  });

  const runTemplate = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/report/templates/${id}/execute`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to execute saved query');
      return res.json();
    },
    onSuccess: (data: AIReportResult) => {
      setReportResults(data);
      setShowResults(true);
      try {
        sessionStorage.setItem('aiReport:last', JSON.stringify({
          prompt,
          chartType,
          additionalContext,
          reportResults: data,
        }));
      } catch {}
      toast({ title: 'Executed', description: `Loaded saved query • ${data.row_count} rows` });
    },
    onError: (e: any) => toast({ title: 'Run failed', description: e?.message || 'Could not execute saved query', variant: 'destructive' })
  });

  // Load persisted state with better error handling and version checking
  useEffect(() => {
    console.log('🤖 AI_REPORT_FRONTEND: Loading persisted state...');
    try {
      const raw = sessionStorage.getItem('aiReport:last');
      if (raw) {
        const parsed = JSON.parse(raw);
        console.log('🤖 AI_REPORT_FRONTEND: Found persisted state:', {
          hasPrompt: !!parsed.prompt,
          hasResults: !!parsed.reportResults,
          timestamp: parsed.timestamp,
          version: parsed.version
        });
        
        // Check if state is not too old (24 hours)
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        const age = Date.now() - (parsed.timestamp || 0);
        
        if (age > maxAge) {
          console.log('🤖 AI_REPORT_FRONTEND: State is too old, clearing...');
          sessionStorage.removeItem('aiReport:last');
          return;
        }
        
        // Restore state
        if (parsed.prompt) setPrompt(parsed.prompt);
        if (parsed.chartType) setChartType(parsed.chartType);
        if (parsed.additionalContext) setAdditionalContext(parsed.additionalContext);
        if (parsed.reportResults) {
          setReportResults(parsed.reportResults);
          setShowResults(true);
          console.log('🤖 AI_REPORT_FRONTEND: Restored previous report results');
        }
      } else {
        console.log('🤖 AI_REPORT_FRONTEND: No persisted state found');
      }
    } catch (e) {
      console.warn('🤖 AI_REPORT_FRONTEND: Failed to load persisted state:', e);
      // Clear corrupted state
      try {
        sessionStorage.removeItem('aiReport:last');
      } catch (clearError) {
        console.error('🤖 AI_REPORT_FRONTEND: Failed to clear corrupted state:', clearError);
      }
    }
  }, []);

  // Execute AI report generation with improved error handling
  const generateAIReport = useMutation({
    mutationFn: async (request: AIReportRequest) => {
      console.log('🤖 AI_REPORT_FRONTEND: Starting report generation with prompt:', request.prompt);
      console.log('🤖 AI_REPORT_FRONTEND: Request details:', request);
      
      const response = await fetch('/api/report/ai-generate', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      console.log('🤖 AI_REPORT_FRONTEND: Response status:', response.status);
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
          console.error('🤖 AI_REPORT_FRONTEND: Server error response:', errorData);
        } catch (parseError) {
          console.error('🤖 AI_REPORT_FRONTEND: Failed to parse error response:', parseError);
          errorData = { 
            error: 'Server Error', 
            details: `Server returned ${response.status}: ${response.statusText}` 
          };
        }
        
        // Create detailed error for user
        const error = new Error(errorData.details || errorData.error || 'Failed to generate report');
        (error as any).serverResponse = errorData;
        (error as any).status = response.status;
        throw error;
      }
      
      const data = await response.json();
      console.log('🤖 AI_REPORT_FRONTEND: Report generated successfully:', {
        execution_id: data.execution_id,
        row_count: data.row_count,
        chart_type: data.chart_type,
        confidence: data.ai_analysis?.confidence_score
      });
      return data;
    },
    onSuccess: (data) => {
      console.log('🤖 AI_REPORT_FRONTEND: Processing successful response');
      setReportResults(data);
      setShowResults(true);
      
      // Enhanced state persistence
      try {
        const stateToSave = {
          prompt,
          chartType,
          additionalContext,
          reportResults: data,
          timestamp: Date.now(),
          version: '1.0'
        };
        sessionStorage.setItem('aiReport:last', JSON.stringify(stateToSave));
        console.log('🤖 AI_REPORT_FRONTEND: State saved to session storage');
      } catch (storageError) {
        console.warn('🤖 AI_REPORT_FRONTEND: Failed to save state:', storageError);
      }
      
      toast({
        title: '✅ Report Generated Successfully',
        description: `Generated ${data.row_count} rows with ${data.ai_analysis?.confidence_score || 'N/A'}% confidence`,
      });
    },
    onError: (error: any) => {
      console.error('🤖 AI_REPORT_FRONTEND: Generation error:', error);
      console.error('🤖 AI_REPORT_FRONTEND: Error details:', {
        message: error.message,
        status: error.status,
        serverResponse: error.serverResponse
      });
      
      // User-friendly error messages
      let title = '❌ Report Generation Failed';
      let description = 'Unable to generate your report. Please try again.';
      
      if (error.serverResponse) {
        const serverError = error.serverResponse;
        title = serverError.error || title;
        description = serverError.details || description;
        
        // Show suggestions if available
        if (serverError.suggestions && Array.isArray(serverError.suggestions)) {
          description += '\n\nSuggestions:\n• ' + serverError.suggestions.join('\n• ');
        }
      } else if (error.status === 401) {
        title = '🔒 Authentication Required';
        description = 'Please log in again to generate reports.';
      } else if (error.status === 403) {
        title = '⛔ Access Denied';
        description = 'You don\'t have permission to generate reports for this organization.';
      } else if (error.status >= 500) {
        title = '🔧 Server Error';
        description = 'Our servers are experiencing issues. Please try again in a moment.';
      }
      
      toast({
        title,
        description,
        variant: 'destructive',
        duration: 8000, // Longer duration for error messages
      });
    },
  });

  const handleGenerateReport = () => {
    if (!prompt.trim()) {
      toast({
        title: 'Prompt Required',
        description: 'Please enter your report requirements',
        variant: 'destructive',
      });
      return;
    }

    const request: AIReportRequest = {
      prompt: prompt.trim(),
      preferred_chart_type: chartType === 'auto' ? undefined : chartType,
      additional_context: additionalContext.trim() || undefined
    };

    generateAIReport.mutate(request);
  };

  // Determine effective chart type (auto -> choose based on data)
  const effectiveChartType = useMemo(() => {
    if (!reportResults || !reportResults.results?.length) return 'table';
    const preferred = (reportResults.chart_type || chartType || 'table');
    if (preferred && preferred !== 'auto') return preferred;
    // Auto-detect
    const model = detectChartModel(reportResults.results);
    if (model.valueKeys.length >= 1) {
      // If time-like xKey, prefer line
      const x = model.xKey || '';
      if (/(date|month|time)/i.test(x)) return 'line';
      return 'bar';
    }
    return 'table';
  }, [reportResults, chartType]);

  const copySQLToClipboard = async () => {
    if (!reportResults?.generated_sql) return;
    try {
      await navigator.clipboard.writeText(reportResults.generated_sql);
      toast({ title: 'Copied', description: 'SQL copied to clipboard' });
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy SQL', variant: 'destructive' });
    }
  };

  const exportDataToXLSX = async () => {
    if (!reportResults || !reportResults.results?.length) {
      toast({ title: 'No data', description: 'Generate a report first', variant: 'destructive' });
      return;
    }
    try {
      const wb = XLSX.utils.book_new();
      // Data sheet
      const ws = XLSX.utils.json_to_sheet(reportResults.results);
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      // SQL sheet
      const sqlSheet = XLSX.utils.aoa_to_sheet([["Generated SQL"], [reportResults.generated_sql || '']]);
      sqlSheet['!cols'] = [{ wch: 120 }];
      XLSX.utils.book_append_sheet(wb, sqlSheet, 'SQL');
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AI_Report_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Exported', description: 'Downloaded Excel with data and SQL' });
    } catch (e) {
      toast({ title: 'Export failed', description: 'Could not generate Excel', variant: 'destructive' });
    }
  };

  // Convert SVG to PNG and download
  const downloadChartPNG = async () => {
    try {
      const el = chartContainerRef.current;
      if (!el) throw new Error('Chart not found');
      const svg = el.querySelector('svg');
      if (!svg) throw new Error('No SVG to export');
      const xml = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      const DOMURL = window.URL || window.webkitURL;
      const url = DOMURL.createObjectURL(svgBlob);
      const img = new Image();
      const { width, height } = svg.getBoundingClientRect();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(e);
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(800, Math.floor(width));
      canvas.height = Math.max(450, Math.floor(height));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas context');
      ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--background') || '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const png = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = png;
      a.download = `AI_Report_Chart_${new Date().toISOString().slice(0,10)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      DOMURL.revokeObjectURL(url);
      toast({ title: 'Chart downloaded', description: 'PNG saved locally' });
    } catch (e) {
      console.error('Chart export failed', e);
      toast({ title: 'Export failed', description: 'Could not export chart', variant: 'destructive' });
    }
  };

  const saveTemplate = async () => {
    if (!reportResults?.generated_sql || !templateName.trim()) {
      toast({ title: 'Missing info', description: 'Enter a template name', variant: 'destructive' });
      return;
    }
    try {
      const body: any = {
        template_name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        is_public: false,
        category: 'AI Generated',
        selected_tables: [],
        selected_rows: [],
        selected_columns: [],
        selected_measures: [],
        filters: [],
        chart_type: effectiveChartType,
        generated_sql: reportResults.generated_sql
      };
      const res = await fetch('/api/report/templates', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Failed to save template');
  setSaveOpen(false);
  setTemplateName('');
  setTemplateDescription('');
  try { await savedTemplatesQuery.refetch(); } catch {}
      toast({ title: 'Saved', description: 'Query saved as template' });
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : 'Error saving', variant: 'destructive' });
    }
  };

  const openSaveDialog = () => {
    // Auto-fill description from AI interpretation when available
    const aiDesc = reportResults?.ai_analysis?.interpreted_request?.trim();
    setTemplateDescription(aiDesc || '');
    setSaveOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-600" />
            AI Report Builder
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Describe what you want to analyze, and AI will generate the perfect report for you
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - AI Prompt Input */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Describe Your Report
              </CardTitle>
              <CardDescription>
                Tell AI what you want to analyze in natural language
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="prompt">Report Requirements</Label>
                <Textarea
                  id="prompt"
                  placeholder="Examples:
• Show me job applications by month and source
• I want to see candidate pipeline status breakdown  
• Create a bar chart of interview scores by department
• Show me the top 5 jobs with most applications"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>

              <div>
                <Label htmlFor="context">Additional Context (Optional)</Label>
                <Textarea
                  id="context"
                  placeholder="Any specific filters, date ranges, or additional requirements..."
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <div>
                <Label>Preferred Chart Type</Label>
                <Select value={chartType} onValueChange={setChartType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {chartTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleGenerateReport}
                disabled={generateAIReport.isPending || !prompt.trim()}
                className="w-full relative"
              >
                {generateAIReport.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    <span>Generating Report...</span>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 animate-pulse rounded-full"></div>
                    </div>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate AI Report
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - AI Analysis & Preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              {reportResults?.ai_analysis ? (
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-sm">Interpreted Request:</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {reportResults.ai_analysis.interpreted_request}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm">Recommended Chart:</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {reportResults.ai_analysis.recommended_chart}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm">Confidence:</h4>
                    <div className="flex items-center gap-2">
                      <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 flex-1">
                        <div 
                          className="bg-green-500 h-2 rounded-full" 
                          style={{ width: `${reportResults.ai_analysis.confidence_score}%` }}
                        />
                      </div>
                      <span className="text-sm">{reportResults.ai_analysis.confidence_score}%</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  AI analysis will appear here after generating a report
                </p>
              )}
            </CardContent>
          </Card>

          {reportResults && (
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Rows:</span>
                    <span className="text-sm font-medium">{reportResults.row_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Chart:</span>
                    <span className="text-sm font-medium">{reportResults.chart_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Time:</span>
                    <span className="text-sm font-medium">{reportResults.execution_time}ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Saved Queries */}
          <Card>
            <CardHeader>
              <CardTitle>Saved Queries</CardTitle>
              <CardDescription>Pick one to run it again</CardDescription>
            </CardHeader>
            <CardContent>
              {savedTemplatesQuery.isLoading && (
                <p className="text-sm text-gray-500">Loading...</p>
              )}
              {savedTemplatesQuery.error && (
                <p className="text-sm text-red-500">Failed to load saved queries</p>
              )}
              {savedTemplatesQuery.data && savedTemplatesQuery.data.length === 0 && (
                <p className="text-sm text-gray-500">No saved queries yet</p>
              )}
              {savedTemplatesQuery.data && savedTemplatesQuery.data.length > 0 && (
                <div className="max-h-72 overflow-y-auto space-y-2">
                  {savedTemplatesQuery.data.map((t) => (
                    <div key={t.id} className="border rounded p-2 flex items-center justify-between">
                      <div className="min-w-0 mr-2">
                        <div className="text-sm font-medium truncate">{t.template_name}</div>
                        <div className="text-xs text-gray-500 truncate">{t.description || t.category || ''}</div>
                      </div>
                      <Button size="sm" onClick={() => runTemplate.mutate(t.id)} disabled={runTemplate.isPending}>
                        {runTemplate.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                        Run
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Results Section */}
      {showResults && reportResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              AI Generated Report Results
            </CardTitle>
            <CardDescription>
              Execution ID: {reportResults.execution_id} • {reportResults.row_count} rows • {reportResults.execution_time}ms
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Chart Section */}
            {effectiveChartType !== 'table' && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">
                  {effectiveChartType?.charAt(0).toUpperCase() + effectiveChartType?.slice(1)} Chart
                </h3>
                {renderChart(reportResults.results, effectiveChartType || 'table', chartContainerRef)}
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" onClick={downloadChartPNG}>
                    <DownloadIcon className="h-4 w-4 mr-2" /> Download chart (PNG)
                  </Button>
                </div>
              </div>
            )}

            {/* Data Table */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Data Table</h3>
              
              {reportResults.results.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          {Object.keys(reportResults.results[0]).map((key) => (
                            <th key={key} className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {reportResults.results.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            {Object.values(row).map((value, vidx) => (
                              <td key={vidx} className="px-4 py-2 whitespace-nowrap text-sm">
                                {String(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No data returned</p>
              )}

              {/* Generated SQL */}
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                <h4 className="font-medium mb-2">Generated SQL Query:</h4>
                <code className="text-sm text-gray-700 dark:text-gray-300 break-all">
                  {reportResults.generated_sql}
                </code>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={copySQLToClipboard}>
                    <CopyIcon className="h-4 w-4 mr-2" /> Copy SQL
                  </Button>
                  <Button variant="outline" onClick={openSaveDialog}>
                    <SaveIcon className="h-4 w-4 mr-2" /> Save Query
                  </Button>
                  <Button onClick={exportDataToXLSX}>
                    <DownloadIcon className="h-4 w-4 mr-2" /> Export data (.xlsx)
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Template Dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>Store this generated SQL for quick access later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="templateName">Name</Label>
              <Input id="templateName" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g., Applications by Month" />
            </div>
            <div>
              <Label htmlFor="templateDesc">Description (optional)</Label>
              <Textarea id="templateDesc" value={templateDescription} onChange={(e) => setTemplateDescription(e.target.value)} placeholder="Brief description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button onClick={saveTemplate}><SaveIcon className="h-4 w-4 mr-2" /> Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
