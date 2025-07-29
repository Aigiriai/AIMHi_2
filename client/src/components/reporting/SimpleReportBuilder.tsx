import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, LineChart, PieChart, Table, Play, Save } from 'lucide-react';

export function SimpleReportBuilder() {
  console.log('📊 SIMPLE_REPORTS: Component initializing');

  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  const [showPreview, setShowPreview] = useState(false);

  const fields = [
    { id: 'job_status', name: 'Job Status', type: 'dimension' },
    { id: 'department', name: 'Department', type: 'dimension' },
    { id: 'candidate_source', name: 'Candidate Source', type: 'dimension' },
    { id: 'match_score', name: 'Match Score', type: 'measure' },
    { id: 'applications_count', name: 'Applications Count', type: 'measure' },
    { id: 'time_to_hire', name: 'Time to Hire', type: 'measure' }
  ];

  const chartTypes = [
    { id: 'bar', name: 'Bar Chart', icon: BarChart3 },
    { id: 'line', name: 'Line Chart', icon: LineChart },
    { id: 'pie', name: 'Pie Chart', icon: PieChart }
  ];

  const toggleField = (fieldId: string) => {
    console.log('📊 SIMPLE_REPORTS: Toggling field:', fieldId);
    setSelectedFields(prev => 
      prev.includes(fieldId) 
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const generateReport = () => {
    console.log('📊 SIMPLE_REPORTS: Generating report with:', { selectedFields, chartType });
    setShowPreview(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Custom Reports</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Build customizable reports to analyze your recruitment data
          </p>
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={generateReport}
            disabled={selectedFields.length === 0}
            className="flex items-center space-x-2"
          >
            <Play className="h-4 w-4" />
            <span>Generate Report</span>
          </Button>
          <Button variant="outline" className="flex items-center space-x-2">
            <Save className="h-4 w-4" />
            <span>Save Template</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="builder" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="builder">Report Builder</TabsTrigger>
          <TabsTrigger value="templates">Saved Templates</TabsTrigger>
          <TabsTrigger value="samples">Sample Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Configuration */}
            <div className="space-y-6">
              {/* Field Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Table className="h-5 w-5" />
                    <span>Select Fields</span>
                  </CardTitle>
                  <CardDescription>
                    Choose the data fields to include in your report
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3">
                    {fields.map(field => (
                      <div 
                        key={field.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedFields.includes(field.id)
                            ? 'bg-primary/10 border-primary'
                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => toggleField(field.id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{field.name}</span>
                          <Badge variant={field.type === 'dimension' ? 'secondary' : 'default'}>
                            {field.type}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Chart Type Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Chart Type</CardTitle>
                  <CardDescription>
                    Choose how to visualize your data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {chartTypes.map(type => {
                      const Icon = type.icon;
                      return (
                        <div
                          key={type.id}
                          className={`p-4 border rounded-lg cursor-pointer text-center transition-colors ${
                            chartType === type.id
                              ? 'bg-primary/10 border-primary'
                              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                          onClick={() => setChartType(type.id as 'bar' | 'line' | 'pie')}
                        >
                          <Icon className="h-8 w-8 mx-auto mb-2" />
                          <p className="text-sm font-medium">{type.name}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Preview */}
            <div>
              {showPreview ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Report Preview</CardTitle>
                    <CardDescription>
                      Preview of your custom report with selected fields
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <p><strong>Selected Fields:</strong> {selectedFields.join(', ')}</p>
                        <p><strong>Chart Type:</strong> {chartType}</p>
                      </div>
                      
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 text-center">
                        <BarChart3 className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-600 dark:text-gray-400">
                          Report visualization would appear here with real data
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                          This is a UI-first implementation ready for backend integration
                        </p>
                      </div>

                      <div className="text-xs text-gray-500 space-y-1">
                        <p>📊 Chart Type: {chartType.toUpperCase()}</p>
                        <p>📋 Fields: {selectedFields.length} selected</p>
                        <p>🔄 Status: Preview Mode (Mock Data)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-96 flex items-center justify-center border-dashed">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <Play className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Select fields and click "Generate Report" to see preview</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Saved Templates</CardTitle>
              <CardDescription>
                Your custom report templates (feature coming soon)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <Save className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No saved templates yet</p>
                <p className="text-sm mt-1">Create and save your first report template</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="samples">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: 'Hiring Funnel', description: 'Application vs hire trends over time' },
              { name: 'Source Effectiveness', description: 'Conversion rates by candidate source' },
              { name: 'Time to Hire', description: 'Department-wise hiring speed analysis' },
              { name: 'Match Score Distribution', description: 'AI score analysis by job level' },
              { name: 'Recruiter Performance', description: 'Individual recruiter productivity' },
              { name: 'Department Overview', description: 'Cross-department activity overview' }
            ].map((template, index) => (
              <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" className="w-full">
                    Load Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}