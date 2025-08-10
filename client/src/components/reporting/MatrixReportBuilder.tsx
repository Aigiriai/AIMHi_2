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
import { 
  Table2, 
  Database, 
  Play, 
  Save, 
  Download, 
  BarChart3, 
  PieChart, 
  LineChart, 
  Settings,
  Trash2,
  Eye,
  Plus,
  Grid,
  ArrowRight
} from 'lucide-react';

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
  metadata?: any;
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

  // Fetch available tables and their fields
  const { data: tables = [], isLoading: tablesLoading, error: tablesError } = useQuery<TableMetadata[]>({
    queryKey: ['/api/report/tables'],
    queryFn: async () => {
      const response = await fetch('/api/report/tables', {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch tables');
      return response.json();
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
      const response = await fetch('/api/report/execute', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportRequest),
      });
      if (!response.ok) throw new Error('Failed to execute report');
      return response.json();
    },
    onSuccess: (data) => {
      setReportResults(data);
      setShowResults(true);
      toast({
        title: 'Report Generated',
        description: `Report executed successfully with ${data.row_count} rows in ${data.execution_time}ms`,
      });
    },
    onError: (error: Error) => {
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
    
    if (field.field_type === 'dimension') {
      // For dimensions, user chooses whether it goes to rows or columns
      // For now, default to rows - can be enhanced with drag & drop
      if (checked) {
        setSelectedRows(prev => [...prev, fieldId]);
      } else {
        setSelectedRows(prev => prev.filter(id => id !== fieldId));
        setSelectedColumns(prev => prev.filter(id => id !== fieldId));
      }
    } else {
      // Measures
      if (checked) {
        setSelectedMeasures(prev => [...prev, fieldId]);
      } else {
        setSelectedMeasures(prev => prev.filter(id => id !== fieldId));
      }
    }
  };

  // Move field between rows and columns
  const moveFieldToColumns = (fieldId: string) => {
    setSelectedRows(prev => prev.filter(id => id !== fieldId));
    setSelectedColumns(prev => [...prev, fieldId]);
  };

  const moveFieldToRows = (fieldId: string) => {
    setSelectedColumns(prev => prev.filter(id => id !== fieldId));
    setSelectedRows(prev => [...prev, fieldId]);
  };

  // Execute the report
  const executeReport = () => {
    if (selectedTables.length === 0 || (selectedRows.length === 0 && selectedColumns.length === 0 && selectedMeasures.length === 0)) {
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
    { id: 'line', name: 'Line Chart', icon: LineChart },
    { id: 'pie', name: 'Pie Chart', icon: PieChart }
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="builder">Report Builder</TabsTrigger>
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
                            <div key={field.id} className="flex items-center space-x-2 p-1">
                              <Checkbox
                                id={field.field_name}
                                checked={selectedRows.includes(field.field_name) || selectedColumns.includes(field.field_name)}
                                onCheckedChange={(checked) => handleFieldSelection(field, checked as boolean)}
                              />
                              <div className="flex-1">
                                <span className="text-sm font-medium">{field.display_name}</span>
                                {field.description && (
                                  <p className="text-xs text-gray-500">{field.description}</p>
                                )}
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
                  {/* Results Table */}
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
