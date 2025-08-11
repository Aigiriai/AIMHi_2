import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { getAuthHeaders } from '@/lib/auth';
import { AIReportBuilder } from './AIReportBuilder';
import { 
  Table2, 
  Database, 
  Play, 
  Save, 
  Download, 
  BarChart3, 
  PieChart as PieChartIcon, 
  LineChart as LineChartIcon, 
  Settings,
  Trash2,
  Eye,
  Plus,
  Grid,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TableMetadata {
  id: number;
  table_name: string;
  display_name: string;
  description?: string;
  category: string;
  is_active: boolean;
  sort_order: number;
  fields: FieldMetadata[];
}

interface FieldMetadata {
  id: number;
  table_id: number;
  field_name: string;
  display_name: string;
  description?: string;
  field_type: 'dimension' | 'measure';
  data_type: string;
  is_filterable: boolean;
  is_groupable: boolean;
  is_aggregatable: boolean;
  default_aggregation?: string;
  format_hint?: string;
  is_active: boolean;
  sort_order: number;
}

interface ReportTemplate {
  id?: number;
  template_name: string;
  description?: string;
  is_public?: boolean;
  category?: string;
  selected_tables: string[];
  selected_rows: string[];
  selected_columns: string[];
  selected_measures: string[];
  filters: any[];
  chart_type?: string;
  chart_config?: any;
  created_at?: string;
  created_by_name?: string;
  execution_count?: number;
  last_executed_at?: string;
}

interface ReportResult {
  execution_id: number;
  generated_sql: string;
  results: any[];
  row_count: number;
  execution_time: number;
  status: string;
  chart_type?: string;
  metadata?: any;
}

// Chart rendering constants and utilities
const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

// Helper function to convert report results to chart data
function convertResultsToChartData(results: any[], rows: string[], columns: string[], measures: string[]) {
  if (!results || results.length === 0) return [];
  
  // For simple case, use results as-is but ensure proper format
  return results.map((item, index) => {
    const chartItem: any = { name: item.name || item[Object.keys(item)[0]] || `Item ${index + 1}` };
    
    // Add all numeric fields as values
    Object.entries(item).forEach(([key, value]) => {
      if (key !== 'name' && typeof value === 'number') {
        chartItem[key] = value;
      }
    });
    
    return chartItem;
  });
}

// Chart rendering function
function renderChart(data: any[], chartType: string, selectedMeasures: string[]) {
  if (!data || data.length === 0) {
    const IconComponent = chartType === 'bar' ? BarChart3 : 
                         chartType === 'line' ? LineChartIcon : 
                         chartType === 'pie' ? PieChartIcon : BarChart3;
    return (
      <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <IconComponent className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No data to display</p>
        </div>
      </div>
    );
  }

  // Get data keys (excluding 'name')
  const dataKeys = Object.keys(data[0]).filter(key => key !== 'name' && key !== 'category');
  const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

  try {
    switch (chartType) {
      case 'bar':
        return (
          <div className="h-96">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="title" />
                <YAxis />
                <Tooltip />
                <Legend />
                {dataKeys.map((key, index) => (
                  <Bar 
                    key={key} 
                    dataKey={key} 
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'line':
        return (
          <div className="h-96">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="title" />
                <YAxis />
                <Tooltip />
                <Legend />
                {dataKeys.map((key, index) => (
                  <Line 
                    key={key} 
                    type="monotone" 
                    dataKey={key} 
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        );

      case 'pie':
        const pieData = data.map((item, index) => ({
          name: item.title || item.name || item.category || 'Item',
          value: dataKeys.reduce((sum, key) => sum + (typeof item[key] === 'number' ? item[key] : 0), 0)
        }));

        return (
          <div className="h-96">
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
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
    // Fallback to a simple table-like visualization
    return (
      <div className="h-96 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-center mb-4">
          {chartType === 'bar' && <BarChart3 className="w-16 h-16 mx-auto mb-4 text-blue-500" />}
          {chartType === 'line' && <LineChartIcon className="w-16 h-16 mx-auto mb-4 text-green-500" />}
          {chartType === 'pie' && <PieChartIcon className="w-16 h-16 mx-auto mb-4 text-orange-500" />}
          
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {chartType === 'table' ? 'Table View' : `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`}
          </h3>
          
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">
            Chart library not available - showing data summary
          </p>
        </div>
        
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {Object.keys(data[0]).map(key => (
                  <th key={key} className="text-left p-2 font-medium">{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 10).map((row, idx) => (
                <tr key={idx} className="border-b border-gray-200 dark:border-gray-700">
                  {Object.values(row).map((value, vidx) => (
                    <td key={vidx} className="p-2">{String(value)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.length > 10 && (
            <p className="text-xs text-gray-500 mt-2">Showing 10 of {data.length} rows</p>
          )}
        </div>
      </div>
    );
  }
}

export function MatrixReportBuilder() {
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [selectedMeasures, setSelectedMeasures] = useState<string[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'table'>('table');
  const [showResults, setShowResults] = useState(false);
  const [reportResults, setReportResults] = useState<ReportResult | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  const { toast } = useToast();

  // Add debug logging for component initialization
  useEffect(() => {
    console.log('🎯 MATRIX_REPORT: Component initialized');
    console.log('🎯 MATRIX_REPORT: Initial state:', {
      selectedTables: selectedTables.length,
      selectedRows: selectedRows.length,
      selectedColumns: selectedColumns.length,
      selectedMeasures: selectedMeasures.length,
      chartType
    });
  }, []);

  // Add debug logging for state changes
  useEffect(() => {
    console.log('🎯 MATRIX_REPORT: Selection state changed:', {
      tables: selectedTables,
      rows: selectedRows,
      columns: selectedColumns,
      measures: selectedMeasures,
      totalFields: selectedRows.length + selectedColumns.length + selectedMeasures.length
    });
  }, [selectedTables, selectedRows, selectedColumns, selectedMeasures]);

  // Fetch available tables and their fields
  const { data: tables = [], isLoading: tablesLoading, error: tablesError } = useQuery<TableMetadata[]>({
    queryKey: ['/api/report/tables'],
    queryFn: async () => {
      console.log('🎯 MATRIX_REPORT: Fetching table metadata...');
      const response = await fetch('/api/report/tables', {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        console.error('🎯 MATRIX_REPORT: Failed to fetch tables:', response.status, response.statusText);
        throw new Error('Failed to fetch tables');
      }
      const data = await response.json();
      console.log('🎯 MATRIX_REPORT: Successfully fetched tables:', data.length, 'tables');
      return data;
    },
  });

  // Fetch user's templates
  const { data: templates = [], refetch: refetchTemplates } = useQuery<ReportTemplate[]>({
    queryKey: ['/api/report/templates'],
    queryFn: async () => {
      const response = await fetch('/api/report/templates', {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
  });

  // Execute report mutation
  const executeReportMutation = useMutation({
    mutationFn: async (reportRequest: any) => {
      console.log('🎯 MATRIX_REPORT: Executing report with request:', reportRequest);
      const response = await fetch('/api/report/execute', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportRequest),
      });
      if (!response.ok) {
        console.error('🎯 MATRIX_REPORT: Report execution failed:', response.status, response.statusText);
        throw new Error('Failed to execute report');
      }
      const data = await response.json();
      console.log('🎯 MATRIX_REPORT: Report executed successfully:', {
        executionId: data.execution_id,
        rowCount: data.row_count,
        executionTime: data.execution_time
      });
      return data;
    },
    onSuccess: (data) => {
      console.log('🎯 MATRIX_REPORT: Report results received:', data);
      setReportResults(data);
      setShowResults(true);
      toast({
        title: 'Report Generated',
        description: `Report executed successfully with ${data.row_count} rows in ${data.execution_time}ms`,
      });
    },
    onError: (error: Error) => {
      console.error('🎯 MATRIX_REPORT: Report execution error:', error);
      toast({
        title: 'Execution Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (template: ReportTemplate) => {
      const response = await fetch('/api/report/templates', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(template),
      });
      if (!response.ok) throw new Error('Failed to save template');
      return response.json();
    },
    onSuccess: () => {
      setShowSaveDialog(false);
      setTemplateName('');
      setTemplateDescription('');
      refetchTemplates();
      toast({
        title: 'Template Saved',
        description: 'Your report template has been saved successfully',
      });
    },
  });

  // Handle field selection based on type
  const handleFieldSelection = (field: FieldMetadata, checked: boolean) => {
    const fieldId = field.field_name;
    
    console.log('🎯 MATRIX_REPORT: Field selection changed:', {
      field: fieldId,
      fieldType: field.field_type,
      checked,
      displayName: field.display_name
    });
    
    if (field.field_type === 'dimension') {
      // For dimensions, only remove from rows/columns when unchecked
      // This allows users to manage where dimensions are placed independently
      if (!checked) {
        console.log('🎯 MATRIX_REPORT: Removing dimension from all sections:', fieldId);
        setSelectedRows(prev => prev.filter(id => id !== fieldId));
        setSelectedColumns(prev => prev.filter(id => id !== fieldId));
      }
      // When checked, dimension is now available for assignment but not auto-placed
      // User must explicitly use "→ Rows" or "→ Columns" buttons
    } else {
      // Measures - handle normally
      if (checked) {
        console.log('🎯 MATRIX_REPORT: Adding measure:', fieldId);
        setSelectedMeasures(prev => prev.includes(fieldId) ? prev : [...prev, fieldId]);
      } else {
        console.log('🎯 MATRIX_REPORT: Removing measure:', fieldId);
        setSelectedMeasures(prev => prev.filter(id => id !== fieldId));
      }
    }
  };

  // Add field to rows
  const addFieldToRows = (fieldId: string) => {
    console.log('🎯 MATRIX_REPORT: Adding field to rows:', fieldId);
    console.log('🎯 MATRIX_REPORT: Before row addition - Current state:', {
      selectedRows: selectedRows,
      selectedColumns: selectedColumns,
      selectedMeasures: selectedMeasures
    });
    
    // Remove from columns if present
    setSelectedColumns(prev => {
      const newColumns = prev.filter(id => id !== fieldId);
      console.log('🎯 MATRIX_REPORT: Removed from columns:', { 
        oldColumns: prev, 
        newColumns: newColumns, 
        removed: fieldId 
      });
      return newColumns;
    });
    
    // Add to rows if not already present
    setSelectedRows(prev => {
      if (prev.includes(fieldId)) {
        console.log('🎯 MATRIX_REPORT: Field already in rows, no change:', fieldId);
        return prev;
      } else {
        const newRows = [...prev, fieldId];
        console.log('🎯 MATRIX_REPORT: Added to rows:', { 
          oldRows: prev, 
          newRows: newRows, 
          added: fieldId 
        });
        return newRows;
      }
    });
  };

  // Add field to columns
  const addFieldToColumns = (fieldId: string) => {
    console.log('🎯 MATRIX_REPORT: Adding field to columns:', fieldId);
    console.log('🎯 MATRIX_REPORT: Before column addition - Current state:', {
      selectedRows: selectedRows,
      selectedColumns: selectedColumns,
      selectedMeasures: selectedMeasures
    });
    
    // Remove from rows if present
    setSelectedRows(prev => {
      const newRows = prev.filter(id => id !== fieldId);
      console.log('🎯 MATRIX_REPORT: Removed from rows:', { 
        oldRows: prev, 
        newRows: newRows, 
        removed: fieldId 
      });
      return newRows;
    });
    
    // Add to columns if not already present
    setSelectedColumns(prev => {
      if (prev.includes(fieldId)) {
        console.log('🎯 MATRIX_REPORT: Field already in columns, no change:', fieldId);
        return prev;
      } else {
        const newColumns = [...prev, fieldId];
        console.log('🎯 MATRIX_REPORT: Added to columns:', { 
          oldColumns: prev, 
          newColumns: newColumns, 
          added: fieldId 
        });
        return newColumns;
      }
    });
  };

  // Move field between rows and columns
  const moveFieldToColumns = (fieldId: string) => {
    console.log('🎯 MATRIX_REPORT: Moving field to columns:', fieldId);
    setSelectedRows(prev => prev.filter(id => id !== fieldId));
    setSelectedColumns(prev => [...prev, fieldId]);
  };

  const moveFieldToRows = (fieldId: string) => {
    console.log('🎯 MATRIX_REPORT: Moving field to rows:', fieldId);
    setSelectedColumns(prev => prev.filter(id => id !== fieldId));
    setSelectedRows(prev => [...prev, fieldId]);
  };

  // Execute the report
  const executeReport = () => {
    console.log('🎯 MATRIX_REPORT: Execute report triggered');
    console.log('🎯 MATRIX_REPORT: Current selections before execution:', {
      selectedTables: selectedTables,
      selectedRows: selectedRows,
      selectedColumns: selectedColumns,
      selectedMeasures: selectedMeasures,
      chartType: chartType
    });
    
    if (selectedTables.length === 0 || (selectedRows.length === 0 && selectedColumns.length === 0 && selectedMeasures.length === 0)) {
      console.log('🎯 MATRIX_REPORT: Validation failed - missing selections');
      toast({
        title: 'Selection Required',
        description: 'Please select at least one table and one field',
        variant: 'destructive',
      });
      return;
    }

    const reportRequest = {
      selected_tables: selectedTables,
      selected_rows: selectedRows,
      selected_columns: selectedColumns,
      selected_measures: selectedMeasures,
      filters: [], // TODO: Add filter support
      chart_type: chartType,
      chart_config: {}
    };

    console.log('🎯 MATRIX_REPORT: Sending report request:', JSON.stringify(reportRequest, null, 2));
    executeReportMutation.mutate(reportRequest);
  };

  // Save template
  const saveTemplate = () => {
    if (!templateName.trim()) {
      toast({
        title: 'Template Name Required',
        description: 'Please enter a name for your template',
        variant: 'destructive',
      });
      return;
    }

    const template: ReportTemplate = {
      template_name: templateName,
      description: templateDescription,
      selected_tables: selectedTables,
      selected_rows: selectedRows,
      selected_columns: selectedColumns,
      selected_measures: selectedMeasures,
      filters: [],
      chart_type: chartType,
      category: 'custom'
    };

    saveTemplateMutation.mutate(template);
  };

  // Load template
  const loadTemplate = (template: ReportTemplate) => {
    setSelectedTables(template.selected_tables);
    setSelectedRows(template.selected_rows);
    setSelectedColumns(template.selected_columns);
    setSelectedMeasures(template.selected_measures);
    setChartType((template.chart_type as any) || 'table');
    
    toast({
      title: 'Template Loaded',
      description: `Loaded template: ${template.template_name}`,
    });
  };

  // Get available fields from selected tables
  const availableFields = tables
    .filter(table => selectedTables.length === 0 || selectedTables.includes(table.table_name))
    .flatMap(table => table.fields);

  const dimensions = availableFields.filter(field => field.field_type === 'dimension');
  const measures = availableFields.filter(field => field.field_type === 'measure');

  const chartTypes = [
    { id: 'table', name: 'Table', icon: Table2 },
    { id: 'bar', name: 'Bar Chart', icon: BarChart3 },
    { id: 'line', name: 'Line Chart', icon: LineChartIcon },
    { id: 'pie', name: 'Pie Chart', icon: PieChartIcon }
  ];

  if (tablesLoading) {
    return <div className="p-6">Loading tables...</div>;
  }

  if (tablesError) {
    return <div className="p-6 text-red-500">Error loading tables: {tablesError.message}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Grid className="h-6 w-6" />
            Advanced Report Builder
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Create custom reports by selecting tables and arranging fields in a matrix layout
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save Template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Report Template</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="templateName">Template Name</Label>
                  <Input
                    id="templateName"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Enter template name"
                  />
                </div>
                <div>
                  <Label htmlFor="templateDescription">Description (Optional)</Label>
                  <Input
                    id="templateDescription"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Describe this report template"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveTemplate} disabled={saveTemplateMutation.isPending}>
                    {saveTemplateMutation.isPending ? 'Saving...' : 'Save Template'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button 
            onClick={executeReport} 
            disabled={executeReportMutation.isPending}
            className="flex items-center space-x-2"
          >
            <Play className="h-4 w-4" />
            <span>{executeReportMutation.isPending ? 'Executing...' : 'Execute Report'}</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="builder" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="builder">Report Builder</TabsTrigger>
          <TabsTrigger value="ai-builder" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Reports
          </TabsTrigger>
          <TabsTrigger value="templates">My Templates ({templates.length})</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Panel - Table and Field Selection */}
            <div className="lg:col-span-4 space-y-4">
              {/* Table Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Select Tables
                  </CardTitle>
                  <CardDescription>
                    Choose the data tables to include in your report
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {tables.map((table) => (
                      <div key={table.id} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                        <Checkbox
                          id={table.table_name}
                          checked={selectedTables.includes(table.table_name)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedTables(prev => [...prev, table.table_name]);
                            } else {
                              setSelectedTables(prev => prev.filter(t => t !== table.table_name));
                              // Clear field selections from this table
                              const tableFields = table.fields.map(f => f.field_name);
                              setSelectedRows(prev => prev.filter(f => !tableFields.includes(f)));
                              setSelectedColumns(prev => prev.filter(f => !tableFields.includes(f)));
                              setSelectedMeasures(prev => prev.filter(f => !tableFields.includes(f)));
                            }
                          }}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{table.display_name}</div>
                          <div className="text-sm text-gray-500">{table.description}</div>
                          <Badge variant="secondary" className="mt-1 text-xs">
                            {table.category}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Field Selection */}
              {selectedTables.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Available Fields</CardTitle>
                    <CardDescription>
                      Select fields to include in your report
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Dimensions */}
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Grid className="h-4 w-4" />
                          Dimensions (Categories/Groups)
                        </h4>
                        <div className="space-y-1">
                          {dimensions.map((field) => (
                            <div key={field.id} className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                              <div className="flex-1">
                                <span className="text-sm font-medium">{field.display_name}</span>
                                {field.description && (
                                  <p className="text-xs text-gray-500">{field.description}</p>
                                )}
                              </div>
                              <div className="flex items-center space-x-1">
                                <Button
                                  size="sm"
                                  variant={selectedRows.includes(field.field_name) ? 'default' : 'outline'}
                                  onClick={() => {
                                    console.log('🎯 MATRIX_REPORT: Row button clicked for field:', field.field_name);
                                    addFieldToRows(field.field_name);
                                  }}
                                  className="text-xs px-2 py-1 h-6"
                                >
                                  → Rows
                                </Button>
                                <Button
                                  size="sm"
                                  variant={selectedColumns.includes(field.field_name) ? 'default' : 'outline'}
                                  onClick={() => {
                                    console.log('🎯 MATRIX_REPORT: Column button clicked for field:', field.field_name);
                                    addFieldToColumns(field.field_name);
                                  }}
                                  className="text-xs px-2 py-1 h-6"
                                >
                                  → Columns
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Measures */}
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          Measures (Numbers/Metrics)
                        </h4>
                        <div className="space-y-1">
                          {measures.map((field) => (
                            <div key={field.id} className="flex items-center space-x-2 p-1">
                              <Checkbox
                                id={field.field_name}
                                checked={selectedMeasures.includes(field.field_name)}
                                onCheckedChange={(checked) => handleFieldSelection(field, checked as boolean)}
                              />
                              <div className="flex-1">
                                <span className="text-sm font-medium">{field.display_name}</span>
                                {field.description && (
                                  <p className="text-xs text-gray-500">{field.description}</p>
                                )}
                                {field.default_aggregation && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {field.default_aggregation}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Center Panel - Matrix Layout */}
            <div className="lg:col-span-5 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Grid className="h-5 w-5" />
                    Report Matrix Layout
                  </CardTitle>
                  <CardDescription>
                    Organize your selected fields into rows and columns
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Rows Section */}
                    <div className="border border-dashed border-blue-300 rounded-lg p-4 min-h-[100px]">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-blue-700 dark:text-blue-400">Rows</h4>
                        <Badge variant="outline" className="text-xs">
                          {selectedRows.length} fields
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {selectedRows.map((fieldName) => {
                          const field = availableFields.find(f => f.field_name === fieldName);
                          return (
                            <div key={fieldName} className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                              <span className="text-sm font-medium">{field?.display_name || fieldName}</span>
                              <div className="flex items-center space-x-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => moveFieldToColumns(fieldName)}
                                  title="Move to columns"
                                >
                                  <ArrowRight className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setSelectedRows(prev => prev.filter(f => f !== fieldName))}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        {selectedRows.length === 0 && (
                          <p className="text-sm text-gray-500 text-center py-4">
                            Drop dimension fields here for row grouping
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Columns Section */}
                    <div className="border border-dashed border-green-300 rounded-lg p-4 min-h-[100px]">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-green-700 dark:text-green-400">Columns</h4>
                        <Badge variant="outline" className="text-xs">
                          {selectedColumns.length} fields
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {selectedColumns.map((fieldName) => {
                          const field = availableFields.find(f => f.field_name === fieldName);
                          return (
                            <div key={fieldName} className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 p-2 rounded">
                              <span className="text-sm font-medium">{field?.display_name || fieldName}</span>
                              <div className="flex items-center space-x-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => moveFieldToRows(fieldName)}
                                  title="Move to rows"
                                >
                                  <ArrowRight className="h-3 w-3 rotate-180" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setSelectedColumns(prev => prev.filter(f => f !== fieldName))}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        {selectedColumns.length === 0 && (
                          <p className="text-sm text-gray-500 text-center py-4">
                            Drop dimension fields here for column grouping
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Measures Section */}
                    <div className="border border-dashed border-purple-300 rounded-lg p-4 min-h-[100px]">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-purple-700 dark:text-purple-400">Measures</h4>
                        <Badge variant="outline" className="text-xs">
                          {selectedMeasures.length} measures
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {selectedMeasures.map((fieldName) => {
                          const field = availableFields.find(f => f.field_name === fieldName);
                          return (
                            <div key={fieldName} className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                              <div>
                                <span className="text-sm font-medium">{field?.display_name || fieldName}</span>
                                {field?.default_aggregation && (
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    {field.default_aggregation}
                                  </Badge>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedMeasures(prev => prev.filter(f => f !== fieldName))}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })}
                        {selectedMeasures.length === 0 && (
                          <p className="text-sm text-gray-500 text-center py-4">
                            Selected measure fields will appear here
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Panel - Chart Configuration */}
            <div className="lg:col-span-3 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Chart Type
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {chartTypes.map((type) => {
                      const Icon = type.icon;
                      return (
                        <Button
                          key={type.id}
                          variant={chartType === type.id ? 'default' : 'outline'}
                          className="h-16 flex-col"
                          onClick={() => setChartType(type.id as any)}
                        >
                          <Icon className="h-6 w-6 mb-1" />
                          <span className="text-xs">{type.name}</span>
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Report Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Tables:</span> {selectedTables.length}
                    </div>
                    <div>
                      <span className="font-medium">Rows:</span> {selectedRows.length}
                    </div>
                    <div>
                      <span className="font-medium">Columns:</span> {selectedColumns.length}
                    </div>
                    <div>
                      <span className="font-medium">Measures:</span> {selectedMeasures.length}
                    </div>
                    <div>
                      <span className="font-medium">Chart:</span> {chartTypes.find(t => t.id === chartType)?.name}
                    </div>
                  </div>
                  
                  {(selectedTables.length === 0 || (selectedRows.length === 0 && selectedColumns.length === 0 && selectedMeasures.length === 0)) && (
                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        Select at least one table and one field to execute the report.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ai-builder">
          <AIReportBuilder />
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Saved Templates</CardTitle>
              <CardDescription>
                Load previously saved report configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <div className="text-center py-8">
                  <Save className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">No saved templates yet</p>
                  <p className="text-sm text-gray-400">Create and save report templates to reuse them later</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map((template) => (
                    <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{template.template_name}</CardTitle>
                          <Badge variant="secondary">{template.category}</Badge>
                        </div>
                        {template.description && (
                          <CardDescription>{template.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                          <div>Tables: {template.selected_tables.join(', ')}</div>
                          <div>Rows: {template.selected_rows.length}</div>
                          <div>Columns: {template.selected_columns.length}</div>
                          <div>Measures: {template.selected_measures.length}</div>
                          {template.execution_count !== undefined && (
                            <div>Executed: {template.execution_count} times</div>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <span className="text-xs text-gray-500">
                            by {template.created_by_name}
                          </span>
                          <Button
                            size="sm"
                            onClick={() => loadTemplate(template)}
                          >
                            Load Template
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
          {showResults && reportResults ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Report Results
                  </CardTitle>
                  <CardDescription>
                    Execution ID: {reportResults.execution_id} • 
                    {reportResults.row_count} rows • 
                    {reportResults.execution_time}ms
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Chart Visualization - Only show if chart type is not table */}
                  {(reportResults.chart_type && reportResults.chart_type !== 'table') && (
                    <div className="mb-6">
                      <h4 className="font-medium mb-4">Chart Visualization</h4>
                      <div className="border rounded-lg p-4 bg-white dark:bg-gray-900">
                        {renderChart(
                          convertResultsToChartData(reportResults.results, selectedRows, selectedColumns, selectedMeasures),
                          reportResults.chart_type,
                          selectedMeasures
                        )}
                      </div>
                    </div>
                  )}

                  {/* Results Table */}
                  <div className="mb-6">
                    <h4 className="font-medium mb-2">Data Table</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800">
                            {reportResults.results.length > 0 && Object.keys(reportResults.results[0]).map(key => (
                              <th key={key} className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reportResults.results.map((row, index) => (
                            <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}>
                              {Object.values(row).map((value, valueIndex) => (
                                <td key={valueIndex} className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                                  {typeof value === 'number' ? value.toLocaleString() : String(value)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* SQL Query */}
                  <div className="mt-6">
                    <h4 className="font-medium mb-2">Generated SQL Query:</h4>
                    <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-sm overflow-x-auto">
                      <code>{reportResults.generated_sql}</code>
                    </pre>
                  </div>

                  <div className="flex items-center space-x-2 mt-4">
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export Excel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Play className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">No report results yet</p>
                <p className="text-sm text-gray-400">Execute a report to see results here</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
