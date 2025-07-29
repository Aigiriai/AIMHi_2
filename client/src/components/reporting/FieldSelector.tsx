import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Search, Info, Trash2, Users, Calendar, BarChart3, Target } from 'lucide-react';
import { ReportField } from './ReportBuilder';

// Mock data for available fields
const AVAILABLE_FIELDS: ReportField[] = [
  // Job-related dimensions
  {
    id: 'job_status',
    name: 'Job Status',
    type: 'dimension',
    description: 'Current status of job posting (Active, Filled, Closed, Paused)',
    category: 'Job Information'
  },
  {
    id: 'department',
    name: 'Department',
    type: 'dimension',
    description: 'Department or team for the job position',
    category: 'Job Information'
  },
  {
    id: 'job_level',
    name: 'Job Level',
    type: 'dimension',
    description: 'Position level (Entry, Mid-level, Senior, Executive)',
    category: 'Job Information'
  },
  {
    id: 'location',
    name: 'Job Location',
    type: 'dimension',
    description: 'Geographic location of the job',
    category: 'Job Information'
  },
  
  // Candidate-related dimensions
  {
    id: 'candidate_source',
    name: 'Candidate Source',
    type: 'dimension',
    description: 'How candidate found the position (LinkedIn, Referral, Job Board, etc.)',
    category: 'Candidate Information'
  },
  {
    id: 'candidate_status',
    name: 'Candidate Status',
    type: 'dimension',
    description: 'Current stage in hiring process (New, Screening, Interview, Hired, Rejected)',
    category: 'Candidate Information'
  },
  {
    id: 'match_score_range',
    name: 'Match Score Range',
    type: 'dimension',
    description: 'AI match score grouped into ranges (<50%, 50-75%, 75-90%, >90%)',
    category: 'Candidate Information'
  },
  
  // Time-related dimensions
  {
    id: 'application_month',
    name: 'Application Month',
    type: 'dimension',
    description: 'Month when candidate applied',
    category: 'Time & Dates'
  },
  {
    id: 'hire_month',
    name: 'Hire Month',
    type: 'dimension',
    description: 'Month when candidate was hired',
    category: 'Time & Dates'
  },
  
  // People dimensions  
  {
    id: 'recruiter',
    name: 'Recruiter',
    type: 'dimension',
    description: 'Recruiter responsible for the position',
    category: 'Team & Assignments'
  },
  
  // Measures
  {
    id: 'application_count',
    name: 'Application Count',
    type: 'measure',
    description: 'Total number of applications received',
    category: 'Metrics'
  },
  {
    id: 'hire_count',
    name: 'Hire Count',
    type: 'measure',
    description: 'Total number of successful hires',
    category: 'Metrics'
  },
  {
    id: 'avg_time_to_hire',
    name: 'Average Time to Hire',
    type: 'measure',
    description: 'Average days from application to hire',
    category: 'Metrics'
  },
  {
    id: 'conversion_rate',
    name: 'Conversion Rate',
    type: 'measure',
    description: 'Percentage of applications that result in hires',
    category: 'Metrics'
  },
  {
    id: 'avg_match_score',
    name: 'Average Match Score',
    type: 'measure',
    description: 'Average AI match score for candidates',
    category: 'Metrics'
  }
];

const CATEGORY_ICONS = {
  'Job Information': Target,
  'Candidate Information': Users,
  'Time & Dates': Calendar,
  'Team & Assignments': Users,
  'Metrics': BarChart3
};

interface FieldSelectorProps {
  selectedRows: ReportField[];
  selectedColumns: ReportField[];
  selectedMeasures: ReportField[];
  onFieldChange: (type: 'rows' | 'columns' | 'measures', fields: ReportField[]) => void;
}

export function FieldSelector({
  selectedRows,
  selectedColumns,
  selectedMeasures,
  onFieldChange
}: FieldSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFieldType, setSelectedFieldType] = useState<'dimension' | 'measure'>('dimension');

  const filteredFields = AVAILABLE_FIELDS.filter(field => 
    field.type === selectedFieldType &&
    (field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     field.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const groupedFields = filteredFields.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, ReportField[]>);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    const field = AVAILABLE_FIELDS.find(f => f.id === draggableId);
    if (!field) return;

    // Remove from source if it was in a drop zone
    if (source.droppableId !== 'available') {
      const sourceList = source.droppableId === 'rows' ? selectedRows :
                        source.droppableId === 'columns' ? selectedColumns : selectedMeasures;
      const newSourceList = sourceList.filter(f => f.id !== field.id);
      onFieldChange(source.droppableId as 'rows' | 'columns' | 'measures', newSourceList);
    }

    // Add to destination if it's a drop zone
    if (destination.droppableId !== 'available') {
      const destList = destination.droppableId === 'rows' ? selectedRows :
                      destination.droppableId === 'columns' ? selectedColumns : selectedMeasures;
      
      // Check if field already exists in destination
      if (!destList.find(f => f.id === field.id)) {
        const newDestList = [...destList];
        newDestList.splice(destination.index, 0, field);
        onFieldChange(destination.droppableId as 'rows' | 'columns' | 'measures', newDestList);
      }
    }
  };

  const removeField = (fieldId: string, type: 'rows' | 'columns' | 'measures') => {
    const currentList = type === 'rows' ? selectedRows :
                       type === 'columns' ? selectedColumns : selectedMeasures;
    const newList = currentList.filter(f => f.id !== fieldId);
    onFieldChange(type, newList);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        {/* Drop Zones */}
        <div className="grid grid-cols-1 gap-4">
          <DropZone
            droppableId="rows"
            title="Rows"
            description="Drag dimensions here to group data by rows"
            fields={selectedRows}
            onRemoveField={(fieldId) => removeField(fieldId, 'rows')}
          />
          
          <DropZone
            droppableId="columns"
            title="Columns"
            description="Drag dimensions here to group data by columns"
            fields={selectedColumns}
            onRemoveField={(fieldId) => removeField(fieldId, 'columns')}
          />
          
          <DropZone
            droppableId="measures"
            title="Values"
            description="Drag measures here to calculate metrics"
            fields={selectedMeasures}
            onRemoveField={(fieldId) => removeField(fieldId, 'measures')}
          />
        </div>

        {/* Available Fields */}
        <Card>
          <CardHeader>
            <CardTitle>Available Fields</CardTitle>
            <CardDescription>
              Drag fields to the drop zones above to build your report
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search and Filter */}
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search fields..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Tabs value={selectedFieldType} onValueChange={(value) => setSelectedFieldType(value as 'dimension' | 'measure')}>
                <TabsList>
                  <TabsTrigger value="dimension">Dimensions</TabsTrigger>
                  <TabsTrigger value="measure">Measures</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Field Groups */}
            <Droppable droppableId="available" isDropDisabled={true}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-4"
                >
                  {Object.entries(groupedFields).map(([category, fields]) => {
                    const IconComponent = CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS];
                    return (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          <IconComponent className="h-4 w-4" />
                          <span>{category}</span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {fields.map((field, index) => (
                            <Draggable
                              key={field.id}
                              draggableId={field.id}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={`
                                          p-2 rounded-md border cursor-grab active:cursor-grabbing
                                          transition-colors duration-200
                                          ${snapshot.isDragging 
                                            ? 'bg-blue-50 border-blue-300 shadow-lg' 
                                            : 'bg-white hover:bg-gray-50 border-gray-200'
                                          }
                                          ${field.type === 'measure' ? 'border-l-4 border-l-green-400' : 'border-l-4 border-l-blue-400'}
                                        `}
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm font-medium">{field.name}</span>
                                          <Info className="h-3 w-3 text-gray-400" />
                                        </div>
                                        <Badge variant="secondary" className="text-xs mt-1">
                                          {field.type}
                                        </Badge>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="max-w-xs">{field.description}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </Draggable>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </CardContent>
        </Card>
      </div>
    </DragDropContext>
  );
}

interface DropZoneProps {
  droppableId: string;
  title: string;
  description: string;
  fields: ReportField[];
  onRemoveField: (fieldId: string) => void;
}

function DropZone({ droppableId, title, description, fields, onRemoveField }: DropZoneProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Droppable droppableId={droppableId}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`
                min-h-[60px] p-3 rounded-md border-2 border-dashed transition-colors
                ${snapshot.isDraggingOver 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 bg-gray-50'
                }
              `}
            >
              {fields.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-2">
                  Drop fields here
                </div>
              ) : (
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <Draggable
                      key={field.id}
                      draggableId={field.id}
                      index={index}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="flex items-center justify-between p-2 bg-white rounded border"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">{field.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {field.type}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveField(field.id)}
                            className="h-6 w-6 p-0 hover:bg-red-100"
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                </div>
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </CardContent>
    </Card>
  );
}