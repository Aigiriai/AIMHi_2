import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MoreHorizontal, Play, Trash2, Calendar, BarChart3, LineChart, PieChart } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ReportTemplate } from './ReportBuilder';

interface TemplateManagerProps {
  templates: ReportTemplate[];
  onLoadTemplate: (template: ReportTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
}

export function TemplateManager({
  templates,
  onLoadTemplate,
  onDeleteTemplate
}: TemplateManagerProps) {
  const [templateToDelete, setTemplateToDelete] = useState<ReportTemplate | null>(null);

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

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(date));
  };

  const handleDeleteConfirm = () => {
    if (templateToDelete) {
      onDeleteTemplate(templateToDelete.id);
      setTemplateToDelete(null);
    }
  };

  if (templates.length === 0) {
    return (
      <Card className="h-96 flex items-center justify-center border-dashed">
        <div className="text-center text-gray-500 dark:text-gray-400 space-y-4">
          <BarChart3 className="h-16 w-16 mx-auto opacity-50" />
          <div>
            <h3 className="text-lg font-medium mb-2">No Templates Saved</h3>
            <p className="text-sm">
              Create your first report and save it as a template for future use.
            </p>
            <p className="text-xs mt-2 text-gray-400">
              You can save up to 10 templates per account.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">My Report Templates</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {templates.length} of 10 templates saved
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => {
          const ChartIcon = getChartIcon(template.chartType);
          const fieldCount = template.rows.length + template.columns.length + template.measures.length;
          
          return (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <ChartIcon className="h-5 w-5 text-blue-600" />
                    <div>
                      <CardTitle className="text-sm font-medium line-clamp-1">
                        {template.name}
                      </CardTitle>
                      <CardDescription className="text-xs flex items-center space-x-1 mt-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(template.createdAt)}</span>
                      </CardDescription>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => onLoadTemplate(template)}
                        className="flex items-center space-x-2"
                      >
                        <Play className="h-3 w-3" />
                        <span>Load Template</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setTemplateToDelete(template)}
                        className="flex items-center space-x-2 text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="text-xs">
                    {template.chartType}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {template.graphVariant}
                  </Badge>
                </div>
                
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex items-center justify-between">
                    <span>Fields used:</span>
                    <span className="font-medium">{fieldCount}</span>
                  </div>
                  
                  {template.rows.length > 0 && (
                    <div className="flex items-center justify-between mt-1">
                      <span>Rows:</span>
                      <span className="font-medium">{template.rows.length}</span>
                    </div>
                  )}
                  
                  {template.columns.length > 0 && (
                    <div className="flex items-center justify-between mt-1">
                      <span>Columns:</span>
                      <span className="font-medium">{template.columns.length}</span>
                    </div>
                  )}
                  
                  {template.measures.length > 0 && (
                    <div className="flex items-center justify-between mt-1">
                      <span>Measures:</span>
                      <span className="font-medium">{template.measures.length}</span>
                    </div>
                  )}
                </div>
                
                <Button 
                  className="w-full" 
                  size="sm"
                  onClick={() => onLoadTemplate(template)}
                >
                  <Play className="h-3 w-3 mr-1" />
                  Load Template
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!templateToDelete} onOpenChange={() => setTemplateToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}