import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, LineChart, PieChart } from 'lucide-react';

interface ChartTypeSelectorProps {
  selectedType: 'bar' | 'line' | 'pie';
  onTypeChange: (type: 'bar' | 'line' | 'pie') => void;
}

export function ChartTypeSelector({ selectedType, onTypeChange }: ChartTypeSelectorProps) {
  const chartTypes = [
    {
      id: 'bar' as const,
      name: 'Bar Chart',
      description: 'Compare values across categories',
      icon: BarChart3,
      preview: (
        <svg viewBox="0 0 100 60" className="w-full h-8">
          <rect x="10" y="45" width="15" height="10" fill="currentColor" className="text-blue-500" />
          <rect x="30" y="30" width="15" height="25" fill="currentColor" className="text-blue-500" />
          <rect x="50" y="20" width="15" height="35" fill="currentColor" className="text-blue-500" />
          <rect x="70" y="35" width="15" height="20" fill="currentColor" className="text-blue-500" />
        </svg>
      )
    },
    {
      id: 'line' as const,
      name: 'Line Chart',
      description: 'Show trends over time',
      icon: LineChart,
      preview: (
        <svg viewBox="0 0 100 60" className="w-full h-8">
          <polyline
            points="10,45 30,30 50,20 70,35 90,25"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-green-500"
          />
          <circle cx="10" cy="45" r="2" fill="currentColor" className="text-green-500" />
          <circle cx="30" cy="30" r="2" fill="currentColor" className="text-green-500" />
          <circle cx="50" cy="20" r="2" fill="currentColor" className="text-green-500" />
          <circle cx="70" cy="35" r="2" fill="currentColor" className="text-green-500" />
          <circle cx="90" cy="25" r="2" fill="currentColor" className="text-green-500" />
        </svg>
      )
    },
    {
      id: 'pie' as const,
      name: 'Pie Chart',
      description: 'Show proportions of a whole',
      icon: PieChart,
      preview: (
        <svg viewBox="0 0 100 60" className="w-full h-8">
          <circle cx="50" cy="30" r="20" fill="currentColor" className="text-purple-200" />
          <path
            d="M 50 30 L 50 10 A 20 20 0 0 1 65 45 Z"
            fill="currentColor"
            className="text-purple-500"
          />
          <path
            d="M 50 30 L 65 45 A 20 20 0 0 1 35 45 Z"
            fill="currentColor"
            className="text-purple-400"
          />
        </svg>
      )
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Chart Type</CardTitle>
        <CardDescription className="text-xs">
          Choose how to visualize your data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {chartTypes.map((type) => {
          const IconComponent = type.icon;
          const isSelected = selectedType === type.id;
          
          return (
            <Button
              key={type.id}
              variant={isSelected ? 'default' : 'outline'}
              className={`
                w-full justify-start h-auto p-3 space-x-3
                ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
              `}
              onClick={() => onTypeChange(type.id)}
            >
              <div className="flex items-center space-x-3 w-full">
                <div className="flex items-center space-x-2">
                  <IconComponent className="h-4 w-4" />
                  <div className="text-left">
                    <div className="font-medium text-sm">{type.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {type.description}
                    </div>
                  </div>
                </div>
                
                <div className="ml-auto">
                  {type.preview}
                </div>
              </div>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}