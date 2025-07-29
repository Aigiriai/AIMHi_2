import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FieldSelector } from './FieldSelector';
import { ChartTypeSelector } from './ChartTypeSelector';
import { GraphVariantSelector } from './GraphVariantSelector';
import { ReportPreview } from './ReportPreview';
import { TemplateManager } from './TemplateManager';
import { SampleTemplates } from './SampleTemplates';
import { UndoRedoProvider, useUndoRedo } from './UndoRedoProvider';
import { Save, Undo, Redo, Play } from 'lucide-react';

export interface ReportField {
  id: string;
  name: string;
  type: 'dimension' | 'measure';
  description: string;
  category: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  userId: number;
  rows: string[];
  columns: string[];
  measures: string[];
  chartType: 'bar' | 'line' | 'pie';
  graphVariant: 'standard' | 'stacked' | 'grouped';
  filters: any[];
  createdAt: Date;
}

interface ReportBuilderState {
  selectedRows: ReportField[];
  selectedColumns: ReportField[];
  selectedMeasures: ReportField[];
  chartType: 'bar' | 'line' | 'pie';
  graphVariant: 'standard' | 'stacked' | 'grouped';
  currentTemplate: ReportTemplate | null;
}

const initialState: ReportBuilderState = {
  selectedRows: [],
  selectedColumns: [],
  selectedMeasures: [],
  chartType: 'bar',
  graphVariant: 'standard',
  currentTemplate: null,
};

function ReportBuilderContent() {
  console.log('🎯 REPORTS: ReportBuilderContent rendering');
  
  const undoRedoContext = useUndoRedo<ReportBuilderState>();
  console.log('🎯 REPORTS: UndoRedo context:', undoRedoContext ? 'available' : 'null');
  
  if (!undoRedoContext) {
    console.error('🚨 REPORTS: UndoRedo context is null - component not wrapped properly');
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold text-red-600 mb-2">Report Builder Error</h2>
        <p className="text-gray-600">The report builder failed to initialize properly. Please refresh the page.</p>
      </div>
    );
  }

  const {
    state,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    saveState
  } = undoRedoContext;

  console.log('🎯 REPORTS: Current state:', state);
  console.log('🎯 REPORTS: State selectedRows:', state?.selectedRows);

  const [showPreview, setShowPreview] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<ReportTemplate[]>([]);

  const updateState = useCallback((updates: Partial<ReportBuilderState>) => {
    const newState = { ...state, ...updates };
    setState(newState);
    saveState();
  }, [state, setState, saveState]);

  const handleFieldChange = useCallback((
    type: 'rows' | 'columns' | 'measures',
    fields: ReportField[]
  ) => {
    const key = type === 'rows' ? 'selectedRows' : 
                type === 'columns' ? 'selectedColumns' : 'selectedMeasures';
    updateState({ [key]: fields });
  }, [updateState]);

  const handleChartTypeChange = useCallback((chartType: 'bar' | 'line' | 'pie') => {
    updateState({ chartType });
  }, [updateState]);

  const handleGraphVariantChange = useCallback((graphVariant: 'standard' | 'stacked' | 'grouped') => {
    updateState({ graphVariant });
  }, [updateState]);

  const handleSaveTemplate = useCallback((name: string) => {
    if (savedTemplates.length >= 10) {
      alert('Maximum 10 templates allowed per user');
      return;
    }

    const template: ReportTemplate = {
      id: Date.now().toString(),
      name,
      userId: 1, // Will be replaced with actual user ID
      rows: state.selectedRows.map(f => f.id),
      columns: state.selectedColumns.map(f => f.id),
      measures: state.selectedMeasures.map(f => f.id),
      chartType: state.chartType,
      graphVariant: state.graphVariant,
      filters: [],
      createdAt: new Date(),
    };

    setSavedTemplates(prev => [...prev, template]);
    updateState({ currentTemplate: template });
  }, [state, savedTemplates, updateState]);

  const handleLoadTemplate = useCallback((template: ReportTemplate) => {
    // This would normally fetch fields by ID, for now we'll simulate
    updateState({
      selectedRows: [],
      selectedColumns: [],
      selectedMeasures: [],
      chartType: template.chartType,
      graphVariant: template.graphVariant,
      currentTemplate: template,
    });
  }, [updateState]);

  const canGenerateReport = state.selectedRows.length > 0 || 
                           state.selectedColumns.length > 0 || 
                           state.selectedMeasures.length > 0;

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Report Builder</h2>
          <p className="text-gray-600 dark:text-gray-400">Create custom reports and visualizations</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={!canUndo}
            className="flex items-center space-x-1"
          >
            <Undo className="h-4 w-4" />
            <span>Undo</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={redo}
            disabled={!canRedo}
            className="flex items-center space-x-1"
          >
            <Redo className="h-4 w-4" />
            <span>Redo</span>
          </Button>
          
          <Button
            onClick={() => setShowPreview(!showPreview)}
            disabled={!canGenerateReport}
            className="flex items-center space-x-1"
          >
            <Play className="h-4 w-4" />
            <span>{showPreview ? 'Hide Preview' : 'Generate Report'}</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="builder" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="builder">Report Builder</TabsTrigger>
          <TabsTrigger value="templates">My Templates</TabsTrigger>
          <TabsTrigger value="samples">Sample Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Configuration */}
            <div className="space-y-6">
              <FieldSelector
                selectedRows={state.selectedRows}
                selectedColumns={state.selectedColumns}
                selectedMeasures={state.selectedMeasures}
                onFieldChange={handleFieldChange}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ChartTypeSelector
                  selectedType={state.chartType}
                  onTypeChange={handleChartTypeChange}
                />
                
                <GraphVariantSelector
                  selectedVariant={state.graphVariant}
                  chartType={state.chartType}
                  onVariantChange={handleGraphVariantChange}
                />
              </div>
            </div>

            {/* Right Column - Preview */}
            <div>
              {showPreview && canGenerateReport && (
                <ReportPreview
                  rows={state.selectedRows}
                  columns={state.selectedColumns}
                  measures={state.selectedMeasures}
                  chartType={state.chartType}
                  graphVariant={state.graphVariant}
                  onSaveTemplate={handleSaveTemplate}
                />
              )}
              
              {!showPreview && (
                <Card className="h-96 flex items-center justify-center border-dashed">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <Play className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Configure your report and click "Generate Report" to see preview</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <TemplateManager
            templates={savedTemplates}
            onLoadTemplate={handleLoadTemplate}
            onDeleteTemplate={(id) => {
              setSavedTemplates(prev => prev.filter(t => t.id !== id));
            }}
          />
        </TabsContent>

        <TabsContent value="samples">
          <SampleTemplates onLoadTemplate={handleLoadTemplate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ReportBuilder() {
  console.log('🎯 REPORTS: ReportBuilder main component initializing');
  console.log('🎯 REPORTS: Initial state:', initialState);
  
  return (
    <UndoRedoProvider initialState={initialState}>
      <ReportBuilderContent />
    </UndoRedoProvider>
  );
}