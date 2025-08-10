import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';

interface Table {
  id: number;
  table_name: string;
  display_name: string;
  fields: Field[];
}

interface Field {
  id: number;
  field_name: string;
  display_name: string;
  field_type: 'dimension' | 'measure';
}

export function BasicReportBuilder() {
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const { toast } = useToast();

  // Fetch available tables and their fields from API
  const { data: tables = [], isLoading } = useQuery<Table[]>({
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
      toast({
        title: 'Report Generated',
        description: `Report executed successfully with ${data.row_count || 0} rows`,
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

  const handleTableSelection = (tableName: string, checked: boolean) => {
    if (checked) {
      setSelectedTables([...selectedTables, tableName]);
    } else {
      setSelectedTables(selectedTables.filter((t: string) => t !== tableName));
      // Remove fields from unselected table
      const table = tables.find((t: Table) => t.table_name === tableName);
      if (table) {
        setSelectedFields(selectedFields.filter((f: string) => !table.fields.some(field => field.field_name === f)));
      }
    }
  };

  const handleFieldSelection = (fieldName: string, checked: boolean) => {
    if (checked) {
      setSelectedFields([...selectedFields, fieldName]);
    } else {
      setSelectedFields(selectedFields.filter((f: string) => f !== fieldName));
    }
  };

  const generateReport = () => {
    if (selectedFields.length === 0) {
      toast({
        title: 'No Fields Selected',
        description: 'Please select at least one field to generate a report',
        variant: 'destructive',
      });
      return;
    }

    const reportRequest = {
      selected_tables: selectedTables,
      selected_rows: selectedFields.filter(field => {
        const fieldObj = tables.flatMap(t => t.fields).find(f => f.field_name === field);
        return fieldObj?.field_type === 'dimension';
      }),
      selected_columns: [],
      selected_measures: selectedFields.filter(field => {
        const fieldObj = tables.flatMap(t => t.fields).find(f => f.field_name === field);
        return fieldObj?.field_type === 'measure';
      }),
      filters: [],
      chart_type: 'table',
    };

    executeReportMutation.mutate(reportRequest);
  };

  if (isLoading) {
    return <div className="p-6 text-center">Loading tables...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Table Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Tables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tables.map((table) => (
              <div key={table.table_name} className="flex items-center space-x-2">
                <Checkbox
                  id={`table-${table.table_name}`}
                  checked={selectedTables.includes(table.table_name)}
                  onCheckedChange={(checked) => 
                    handleTableSelection(table.table_name, checked as boolean)
                  }
                />
                <label 
                  htmlFor={`table-${table.table_name}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {table.display_name}
                </label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Field Selection */}
      {selectedTables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Fields</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {selectedTables.map((tableName) => {
                const table = tables.find((t: Table) => t.table_name === tableName);
                return table ? (
                  <div key={tableName}>
                    <h4 className="font-medium text-sm mb-2">{table.display_name}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {table.fields.map((field) => (
                        <div key={`${tableName}.${field.field_name}`} className="flex items-center space-x-2">
                          <Checkbox
                            id={`field-${tableName}-${field.field_name}`}
                            checked={selectedFields.includes(field.field_name)}
                            onCheckedChange={(checked) => 
                              handleFieldSelection(field.field_name, checked as boolean)
                            }
                          />
                          <label 
                            htmlFor={`field-${tableName}-${field.field_name}`}
                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {field.display_name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate Report Button */}
      {selectedFields.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <Button 
              onClick={generateReport} 
              className="w-full"
              disabled={executeReportMutation.isPending}
            >
              {executeReportMutation.isPending 
                ? 'Generating Report...' 
                : `Generate Report (${selectedFields.length} fields selected)`
              }
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
