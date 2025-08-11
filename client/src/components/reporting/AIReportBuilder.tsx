import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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
  Brain
} from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

const chartTypes = [
  { id: 'auto', name: 'Let AI Decide', icon: Brain },
  { id: 'table', name: 'Table', icon: Table2 },
  { id: 'bar', name: 'Bar Chart', icon: BarChart3 },
  { id: 'line', name: 'Line Chart', icon: LineChartIcon },
  { id: 'pie', name: 'Pie Chart', icon: PieChartIcon }
];

// Chart rendering function
function renderChart(data: any[], chartType: string) {
  if (!data || data.length === 0) return null;
  
  try {
    switch (chartType) {
      case 'bar':
        const barDataKeys = Object.keys(data[0]).filter(key => 
          typeof data[0][key] === 'number' || !isNaN(Number(data[0][key]))
        );
        
        return (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={Object.keys(data[0])[0]} />
                <YAxis />
                <Tooltip />
                <Legend />
                {barDataKeys.slice(1, 4).map((key, index) => (
                  <Bar key={key} dataKey={key} fill={CHART_COLORS[index]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'line':
        const lineDataKeys = Object.keys(data[0]).filter(key => 
          typeof data[0][key] === 'number' || !isNaN(Number(data[0][key]))
        );
        
        return (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={Object.keys(data[0])[0]} />
                <YAxis />
                <Tooltip />
                <Legend />
                {lineDataKeys.slice(1, 4).map((key, index) => (
                  <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[index]} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        );

      case 'pie':
        const pieData = data.slice(0, 6).map((item, index) => ({
          name: item[Object.keys(item)[0]],
          value: Number(item[Object.keys(item)[1]] || 0)
        }));
        
        return (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
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

      case 'table':
      default:
        return null; // Table will be rendered separately
    }
  } catch (error) {
    console.error('Chart rendering error:', error);
    return (
      <div className="h-96 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-center">
          <p className="text-sm text-red-600 dark:text-red-400">
            Chart rendering failed - showing data as table
          </p>
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

  const { toast } = useToast();

  // Execute AI report generation
  const generateAIReport = useMutation({
    mutationFn: async (request: AIReportRequest) => {
      console.log('🤖 AI_REPORT: Generating AI report with prompt:', request.prompt);
      const response = await fetch('/api/report/ai-generate', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        console.error('🤖 AI_REPORT: Generation failed:', response.status, response.statusText);
        throw new Error('Failed to generate AI report');
      }
      
      const data = await response.json();
      console.log('🤖 AI_REPORT: AI report generated:', data);
      return data;
    },
    onSuccess: (data) => {
      console.log('🤖 AI_REPORT: Results received:', data);
      setReportResults(data);
      setShowResults(true);
      toast({
        title: 'AI Report Generated',
        description: `Generated report with ${data.row_count} rows using AI analysis`,
      });
    },
    onError: (error: Error) => {
      console.error('🤖 AI_REPORT: Generation error:', error);
      toast({
        title: 'Generation Failed',
        description: error.message,
        variant: 'destructive',
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
                className="w-full"
              >
                {generateAIReport.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {generateAIReport.isPending ? 'Generating...' : 'Generate AI Report'}
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
            {reportResults.chart_type !== 'table' && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">
                  {reportResults.chart_type?.charAt(0).toUpperCase() + reportResults.chart_type?.slice(1)} Chart
                </h3>
                {renderChart(reportResults.results, reportResults.chart_type || 'table')}
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
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
