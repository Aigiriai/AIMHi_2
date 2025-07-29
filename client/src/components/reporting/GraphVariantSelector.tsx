import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface GraphVariantSelectorProps {
  selectedVariant: 'standard' | 'stacked' | 'grouped';
  chartType: 'bar' | 'line' | 'pie';
  onVariantChange: (variant: 'standard' | 'stacked' | 'grouped') => void;
}

export function GraphVariantSelector({ 
  selectedVariant, 
  chartType, 
  onVariantChange 
}: GraphVariantSelectorProps) {
  const getVariantsForChartType = (type: 'bar' | 'line' | 'pie') => {
    switch (type) {
      case 'bar':
        return [
          {
            id: 'standard' as const,
            name: 'Standard',
            description: 'Simple bars side by side',
            preview: (
              <svg viewBox="0 0 80 40" className="w-full h-6">
                <rect x="5" y="25" width="8" height="12" fill="currentColor" className="text-blue-500" />
                <rect x="18" y="20" width="8" height="17" fill="currentColor" className="text-green-500" />
                <rect x="31" y="15" width="8" height="22" fill="currentColor" className="text-purple-500" />
                <rect x="44" y="22" width="8" height="15" fill="currentColor" className="text-orange-500" />
              </svg>
            )
          },
          {
            id: 'grouped' as const,
            name: 'Grouped',
            description: 'Multiple series grouped together',
            preview: (
              <svg viewBox="0 0 80 40" className="w-full h-6">
                <rect x="5" y="25" width="6" height="12" fill="currentColor" className="text-blue-500" />
                <rect x="12" y="28" width="6" height="9" fill="currentColor" className="text-green-500" />
                <rect x="23" y="20" width="6" height="17" fill="currentColor" className="text-blue-500" />
                <rect x="30" y="24" width="6" height="13" fill="currentColor" className="text-green-500" />
                <rect x="41" y="15" width="6" height="22" fill="currentColor" className="text-blue-500" />
                <rect x="48" y="19" width="6" height="18" fill="currentColor" className="text-green-500" />
              </svg>
            )
          },
          {
            id: 'stacked' as const,
            name: 'Stacked',
            description: 'Stack values on top of each other',
            preview: (
              <svg viewBox="0 0 80 40" className="w-full h-6">
                <rect x="5" y="25" width="10" height="12" fill="currentColor" className="text-blue-500" />
                <rect x="5" y="15" width="10" height="10" fill="currentColor" className="text-green-500" />
                <rect x="20" y="22" width="10" height="15" fill="currentColor" className="text-blue-500" />
                <rect x="20" y="12" width="10" height="10" fill="currentColor" className="text-green-500" />
                <rect x="35" y="18" width="10" height="19" fill="currentColor" className="text-blue-500" />
                <rect x="35" y="8" width="10" height="10" fill="currentColor" className="text-green-500" />
              </svg>
            )
          }
        ];
      
      case 'line':
        return [
          {
            id: 'standard' as const,
            name: 'Standard',
            description: 'Single line connecting points',
            preview: (
              <svg viewBox="0 0 80 40" className="w-full h-6">
                <polyline
                  points="5,30 20,20 35,15 50,25 65,18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-blue-500"
                />
                <circle cx="5" cy="30" r="2" fill="currentColor" className="text-blue-500" />
                <circle cx="20" cy="20" r="2" fill="currentColor" className="text-blue-500" />
                <circle cx="35" cy="15" r="2" fill="currentColor" className="text-blue-500" />
                <circle cx="50" cy="25" r="2" fill="currentColor" className="text-blue-500" />
                <circle cx="65" cy="18" r="2" fill="currentColor" className="text-blue-500" />
              </svg>
            )
          },
          {
            id: 'grouped' as const,
            name: 'Multi-line',
            description: 'Multiple lines on same chart',
            preview: (
              <svg viewBox="0 0 80 40" className="w-full h-6">
                <polyline
                  points="5,25 20,18 35,12 50,20 65,15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-blue-500"
                />
                <polyline
                  points="5,32 20,28 35,22 50,30 65,25"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-green-500"
                />
              </svg>
            )
          },
          {
            id: 'stacked' as const,
            name: 'Area',
            description: 'Filled area under the line',
            preview: (
              <svg viewBox="0 0 80 40" className="w-full h-6">
                <polygon
                  points="5,30 20,20 35,15 50,25 65,18 65,35 5,35"
                  fill="currentColor"
                  className="text-blue-300 opacity-60"
                />
                <polyline
                  points="5,30 20,20 35,15 50,25 65,18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-blue-500"
                />
              </svg>
            )
          }
        ];
      
      case 'pie':
        return [
          {
            id: 'standard' as const,
            name: 'Standard',
            description: 'Traditional circular pie chart',
            preview: (
              <svg viewBox="0 0 80 40" className="w-full h-6">
                <circle cx="40" cy="20" r="15" fill="currentColor" className="text-gray-200" />
                <path
                  d="M 40 20 L 40 5 A 15 15 0 0 1 50 32 Z"
                  fill="currentColor"
                  className="text-blue-500"
                />
                <path
                  d="M 40 20 L 50 32 A 15 15 0 0 1 30 32 Z"
                  fill="currentColor"
                  className="text-green-500"
                />
              </svg>
            )
          },
          {
            id: 'grouped' as const,
            name: 'Donut',
            description: 'Pie chart with hollow center',
            preview: (
              <svg viewBox="0 0 80 40" className="w-full h-6">
                <circle cx="40" cy="20" r="15" fill="currentColor" className="text-gray-200" />
                <circle cx="40" cy="20" r="8" fill="white" />
                <path
                  d="M 40 20 L 40 5 A 15 15 0 0 1 50 32 Z"
                  fill="currentColor"
                  className="text-blue-500"
                />
                <path
                  d="M 40 20 L 50 32 A 15 15 0 0 1 30 32 Z"
                  fill="currentColor"
                  className="text-green-500"
                />
                <circle cx="40" cy="20" r="8" fill="transparent" stroke="white" strokeWidth="16" />
              </svg>
            )
          },
          {
            id: 'stacked' as const,
            name: 'Semi-circle',
            description: 'Half-circle gauge style',
            preview: (
              <svg viewBox="0 0 80 40" className="w-full h-6">
                <path
                  d="M 25 30 A 15 15 0 0 1 55 30"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-gray-200"
                />
                <path
                  d="M 25 30 A 15 15 0 0 1 40 15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-blue-500"
                />
                <path
                  d="M 40 15 A 15 15 0 0 1 55 30"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-green-500"
                />
              </svg>
            )
          }
        ];
      
      default:
        return [];
    }
  };

  const variants = getVariantsForChartType(chartType);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Chart Style</CardTitle>
        <CardDescription className="text-xs">
          Choose the visualization style
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {variants.map((variant) => {
          const isSelected = selectedVariant === variant.id;
          
          return (
            <Button
              key={variant.id}
              variant={isSelected ? 'default' : 'outline'}
              className={`
                w-full justify-start h-auto p-3
                ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
              `}
              onClick={() => onVariantChange(variant.id)}
            >
              <div className="flex items-center justify-between w-full">
                <div className="text-left">
                  <div className="font-medium text-sm">{variant.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {variant.description}
                  </div>
                </div>
                
                <div className="ml-4">
                  {variant.preview}
                </div>
              </div>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}