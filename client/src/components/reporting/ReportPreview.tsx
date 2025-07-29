import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Save, Download, RefreshCw } from 'lucide-react';
import { ReportField } from './ReportBuilder';

interface ReportPreviewProps {
  rows: ReportField[];
  columns: ReportField[];
  measures: ReportField[];
  chartType: 'bar' | 'line' | 'pie';
  graphVariant: 'standard' | 'stacked' | 'grouped';
  onSaveTemplate: (name: string) => void;
}

// Mock data generator
function generateMockData(
  rows: ReportField[],
  columns: ReportField[],
  measures: ReportField[]
) {
  const mockValues = {
    // Dimensions
    job_status: ['Active', 'Filled', 'Closed', 'Paused'],
    department: ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'],
    job_level: ['Entry', 'Mid-level', 'Senior', 'Executive'],
    location: ['New York', 'San Francisco', 'Remote', 'Chicago'],
    candidate_source: ['LinkedIn', 'Referral', 'Job Board', 'Career Page', 'Recruiter'],
    candidate_status: ['New', 'Screening', 'Interview', 'Hired', 'Rejected'],
    match_score_range: ['<50%', '50-75%', '75-90%', '>90%'],
    application_month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    hire_month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    recruiter: ['Sarah Johnson', 'Mike Chen', 'Lisa Rodriguez', 'David Kim'],
  };

  // Generate combinations
  const rowValues = rows.length > 0 ? mockValues[rows[0].id as keyof typeof mockValues] || ['Category A', 'Category B', 'Category C'] : ['Total'];
  const columnValues = columns.length > 0 ? mockValues[columns[0].id as keyof typeof mockValues] || ['Series 1', 'Series 2'] : ['Value'];

  const data = [];
  
  for (const rowValue of rowValues) {
    const dataPoint: any = { name: rowValue };
    
    for (const columnValue of columnValues) {
      // Generate realistic values based on measure type
      for (const measure of measures) {
        const key = columns.length > 0 ? `${columnValue}_${measure.name}` : measure.name;
        
        switch (measure.id) {
          case 'application_count':
            dataPoint[key] = Math.floor(Math.random() * 100) + 10;
            break;
          case 'hire_count':
            dataPoint[key] = Math.floor(Math.random() * 20) + 1;
            break;
          case 'avg_time_to_hire':
            dataPoint[key] = Math.floor(Math.random() * 30) + 15;
            break;
          case 'conversion_rate':
            dataPoint[key] = Math.floor(Math.random() * 20) + 5;
            break;
          case 'avg_match_score':
            dataPoint[key] = Math.floor(Math.random() * 40) + 60;
            break;
          default:
            dataPoint[key] = Math.floor(Math.random() * 100) + 10;
        }
      }
    }
    
    data.push(dataPoint);
  }
  
  return data;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

export function ReportPreview({
  rows,
  columns,
  measures,
  chartType,
  graphVariant,
  onSaveTemplate
}: ReportPreviewProps) {
  const [templateName, setTemplateName] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const mockData = useMemo(() => {
    return generateMockData(rows, columns, measures);
  }, [rows, columns, measures, refreshKey]);

  const refreshData = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setRefreshKey(prev => prev + 1);
      setIsRefreshing(false);
    }, 500);
  };

  const handleSaveTemplate = () => {
    if (templateName.trim()) {
      onSaveTemplate(templateName.trim());
      setTemplateName('');
    }
  };

  const getDataKeys = () => {
    if (mockData.length === 0) return [];
    const firstItem = mockData[0];
    return Object.keys(firstItem).filter(key => key !== 'name');
  };

  const renderChart = () => {
    if (mockData.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-gray-500">
          No data to display
        </div>
      );
    }

    const dataKeys = getDataKeys();

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mockData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              {dataKeys.map((key, index) => (
                <Bar 
                  key={key} 
                  dataKey={key} 
                  fill={COLORS[index % COLORS.length]}
                  stackId={graphVariant === 'stacked' ? 'stack' : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        if (graphVariant === 'stacked') {
          return (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={mockData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                {dataKeys.map((key, index) => (
                  <Area 
                    key={key} 
                    type="monotone" 
                    dataKey={key} 
                    stackId="1"
                    stroke={COLORS[index % COLORS.length]}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          );
        }
        
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              {dataKeys.map((key, index) => (
                <Line 
                  key={key} 
                  type="monotone" 
                  dataKey={key} 
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'pie':
        const pieData = mockData.map(item => ({
          name: item.name,
          value: dataKeys.reduce((sum, key) => sum + (item[key] || 0), 0)
        }));

        if (graphVariant === 'grouped') {
          return (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          );
        }

        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">Report Preview</CardTitle>
            <CardDescription className="text-xs">
              Live preview of your custom report
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              disabled={isRefreshing}
              className="flex items-center space-x-1"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="flex items-center space-x-1">
                  <Save className="h-3 w-3" />
                  <span>Save</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save Report Template</DialogTitle>
                  <DialogDescription>
                    Give your report template a name to save it for later use.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="template-name">Template Name</Label>
                    <Input
                      id="template-name"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g., Hiring Funnel by Department"
                      className="mt-1"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleSaveTemplate} disabled={!templateName.trim()}>
                    Save Template
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Chart Configuration Summary */}
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            {rows.length > 0 && (
              <div>
                <span className="font-medium">Rows:</span> {rows.map(f => f.name).join(', ')}
              </div>
            )}
            {columns.length > 0 && (
              <div>
                <span className="font-medium">Columns:</span> {columns.map(f => f.name).join(', ')}
              </div>
            )}
            {measures.length > 0 && (
              <div>
                <span className="font-medium">Measures:</span> {measures.map(f => f.name).join(', ')}
              </div>
            )}
            <div>
              <span className="font-medium">Chart:</span> {chartType} ({graphVariant})
            </div>
          </div>

          {/* Chart */}
          <div className="border rounded-lg p-4 bg-white dark:bg-gray-900">
            {renderChart()}
          </div>

          {/* Data Table Preview */}
          <div className="text-xs">
            <div className="font-medium mb-2">Data Preview (first 5 rows):</div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800">
                    <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left">
                      {rows.length > 0 ? rows[0].name : 'Category'}
                    </th>
                    {getDataKeys().map(key => (
                      <th key={key} className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mockData.slice(0, 5).map((row, index) => (
                    <tr key={index}>
                      <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                        {row.name}
                      </td>
                      {getDataKeys().map(key => (
                        <td key={key} className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                          {row[key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {mockData.length > 5 && (
              <div className="text-gray-500 dark:text-gray-400 mt-1">
                ... and {mockData.length - 5} more rows
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}