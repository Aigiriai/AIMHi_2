import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, LineChart, PieChart, TrendingUp, Users, Target, Clock, Award } from 'lucide-react';
import { ReportTemplate } from './ReportBuilder';

interface SampleTemplatesProps {
  onLoadTemplate: (template: ReportTemplate) => void;
}

const SAMPLE_TEMPLATES: ReportTemplate[] = [
  {
    id: 'sample-1',
    name: 'Hiring Funnel by Month',
    userId: 0,
    rows: ['application_month'],
    columns: [],
    measures: ['application_count', 'hire_count'],
    chartType: 'bar',
    graphVariant: 'grouped',
    filters: [],
    createdAt: new Date(),
  },
  {
    id: 'sample-2',
    name: 'Source Effectiveness',
    userId: 0,
    rows: ['candidate_source'],
    columns: [],
    measures: ['conversion_rate'],
    chartType: 'pie',
    graphVariant: 'standard',
    filters: [],
    createdAt: new Date(),
  },
  {
    id: 'sample-3',
    name: 'Time to Hire Trends',
    userId: 0,
    rows: ['hire_month'],
    columns: ['department'],
    measures: ['avg_time_to_hire'],
    chartType: 'line',
    graphVariant: 'grouped',
    filters: [],
    createdAt: new Date(),
  },
  {
    id: 'sample-4',
    name: 'Match Score Distribution',
    userId: 0,
    rows: ['match_score_range'],
    columns: ['job_level'],
    measures: ['application_count'],
    chartType: 'bar',
    graphVariant: 'stacked',
    filters: [],
    createdAt: new Date(),
  },
  {
    id: 'sample-5',
    name: 'Recruiter Performance',
    userId: 0,
    rows: ['recruiter'],
    columns: [],
    measures: ['application_count', 'hire_count'],
    chartType: 'bar',
    graphVariant: 'grouped',
    filters: [],
    createdAt: new Date(),
  },
  {
    id: 'sample-6',
    name: 'Department Hiring Overview',
    userId: 0,
    rows: ['department'],
    columns: ['job_status'],
    measures: ['application_count'],
    chartType: 'bar',
    graphVariant: 'stacked',
    filters: [],
    createdAt: new Date(),
  },
];

const TEMPLATE_ICONS = {
  'Hiring Funnel by Month': TrendingUp,
  'Source Effectiveness': Target,
  'Time to Hire Trends': Clock,
  'Match Score Distribution': Award,
  'Recruiter Performance': Users,
  'Department Hiring Overview': BarChart3,
};

const TEMPLATE_DESCRIPTIONS = {
  'Hiring Funnel by Month': 'Track applications and hires over time to identify hiring patterns and seasonal trends.',
  'Source Effectiveness': 'Compare conversion rates across different candidate sources to optimize recruiting channels.',
  'Time to Hire Trends': 'Monitor how long it takes to hire by department to identify bottlenecks in your process.',
  'Match Score Distribution': 'Analyze AI match scores by job level to understand candidate quality across positions.',
  'Recruiter Performance': 'Compare recruiter productivity by tracking applications and successful hires.',
  'Department Hiring Overview': 'Get a comprehensive view of hiring activity across all departments and job statuses.',
};

export function SampleTemplates({ onLoadTemplate }: SampleTemplatesProps) {
  const getChartIcon = (chartType: 'bar' | 'line' | 'pie') => {
    switch (chartType) {
      case 'bar':
        return BarChart3;
      case 'line':
        return LineChart;
      case 'pie':
        return PieChart;
      default:
        return BarChart3;
    }
  };

  const getTemplateIcon = (name: string) => {
    return TEMPLATE_ICONS[name as keyof typeof TEMPLATE_ICONS] || BarChart3;
  };

  const getTemplateDescription = (name: string) => {
    return TEMPLATE_DESCRIPTIONS[name as keyof typeof TEMPLATE_DESCRIPTIONS] || 'Sample report template';
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Sample Report Templates</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Get started quickly with these pre-built report templates for common recruiting scenarios.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SAMPLE_TEMPLATES.map((template) => {
          const ChartIcon = getChartIcon(template.chartType);
          const TemplateIcon = getTemplateIcon(template.name);
          const description = getTemplateDescription(template.name);
          const fieldCount = template.rows.length + template.columns.length + template.measures.length;
          
          return (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900">
                    <TemplateIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-sm font-medium line-clamp-1">
                      {template.name}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1 line-clamp-2">
                      {description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ChartIcon className="h-4 w-4 text-gray-600" />
                    <Badge variant="secondary" className="text-xs">
                      {template.chartType}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {template.graphVariant}
                    </Badge>
                  </div>
                  <span className="text-xs text-gray-500">
                    {fieldCount} fields
                  </span>
                </div>
                
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  {template.rows.length > 0 && (
                    <div>
                      <span className="font-medium">Rows:</span> {template.rows.join(', ')}
                    </div>
                  )}
                  
                  {template.columns.length > 0 && (
                    <div>
                      <span className="font-medium">Columns:</span> {template.columns.join(', ')}
                    </div>
                  )}
                  
                  {template.measures.length > 0 && (
                    <div>
                      <span className="font-medium">Measures:</span> {template.measures.join(', ')}
                    </div>
                  )}
                </div>
                
                <Button 
                  className="w-full" 
                  size="sm"
                  onClick={() => onLoadTemplate(template)}
                >
                  Use This Template
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-center py-8">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p>More sample templates coming soon!</p>
          <p className="mt-1">
            Create your own templates and they'll appear in the "My Templates" tab.
          </p>
        </div>
      </div>
    </div>
  );
}