import type { Express, Request, Response } from "express";
import { authenticateToken, requireOrganization, type AuthRequest } from "./auth";

// Extend AuthRequest to include all Express request properties
interface ExtendedAuthRequest extends AuthRequest {
  query?: any;
  body?: any;
  params?: any;
  organization?: any;
}

interface ReportRequest {
  selected_tables: string[];
  selected_rows: string[];
  selected_columns: string[];
  selected_measures: string[];
  filters: any[];
  chart_type?: string;
  chart_config?: any;
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
}

// SQL query generation utility
function generateReportSQL(request: ReportRequest): string {
  const { selected_tables, selected_rows, selected_columns, selected_measures, filters } = request;
  
  // Basic query structure
  let query = 'SELECT ';
  
  // Add selected fields
  const allFields = [...selected_rows, ...selected_columns, ...selected_measures];
  if (allFields.length === 0) {
    query += 'COUNT(*) as total_count';
  } else {
    query += allFields.join(', ');
  }
  
  // Add FROM clause with appropriate tables
  if (selected_tables.length > 0) {
    query += ` FROM ${selected_tables[0]}`;
    
    // Add JOINs for related tables
    for (let i = 1; i < selected_tables.length; i++) {
      const table = selected_tables[i];
      query += ` LEFT JOIN ${table}`;
    }
  } else {
    query += ' FROM jobs'; // Default table
  }
  
  // Add WHERE clause for filters
  if (filters && filters.length > 0) {
    const filterClauses = filters.map(filter => {
      const { field, operator, value } = filter;
      switch (operator) {
        case 'equals': return `${field} = '${value}'`;
        case 'not_equals': return `${field} != '${value}'`;
        case 'contains': return `${field} LIKE '%${value}%'`;
        case 'starts_with': return `${field} LIKE '${value}%'`;
        case 'ends_with': return `${field} LIKE '%${value}'`;
        case 'greater_than': return `${field} > ${value}`;
        case 'less_than': return `${field} < ${value}`;
        case 'is_null': return `${field} IS NULL`;
        case 'is_not_null': return `${field} IS NOT NULL`;
        default: return `${field} = '${value}'`;
      }
    });
    query += ' WHERE ' + filterClauses.join(' AND ');
  }
  
  // Add GROUP BY for measures
  if (selected_measures.length > 0 && (selected_rows.length > 0 || selected_columns.length > 0)) {
    const groupByFields = [...selected_rows, ...selected_columns];
    query += ' GROUP BY ' + groupByFields.join(', ');
  }
  
  // Add ORDER BY
  if (selected_rows.length > 0) {
    query += ' ORDER BY ' + selected_rows[0];
  }
  
  // Add LIMIT for safety
  query += ' LIMIT 1000';
  
  return query;
}

export default function reportRoutes(app: Express) {
  // Get all available table metadata - simplified mock version
  app.get("/api/report/tables", authenticateToken, requireOrganization, async (req: ExtendedAuthRequest, res: Response) => {
    try {
      // Return mock table metadata for the matrix-style report builder
      const mockTables = [
        {
          id: 1,
          table_name: 'jobs',
          display_name: 'Job Postings',
          description: 'All job postings in the system',
          category: 'Core Data',
          is_active: true,
          sort_order: 1,
          fields: [
            {
              id: 1,
              table_id: 1,
              field_name: 'title',
              display_name: 'Job Title',
              description: 'Title of the job posting',
              field_type: 'dimension' as const,
              data_type: 'string',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 1
            },
            {
              id: 2,
              table_id: 1,
              field_name: 'status',
              display_name: 'Job Status',
              description: 'Current status of the job',
              field_type: 'dimension' as const,
              data_type: 'string',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 2
            },
            {
              id: 3,
              table_id: 1,
              field_name: 'department',
              display_name: 'Department',
              description: 'Department the job belongs to',
              field_type: 'dimension' as const,
              data_type: 'string',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 3
            },
            {
              id: 4,
              table_id: 1,
              field_name: 'location',
              display_name: 'Job Location',
              description: 'Geographic location of the job',
              field_type: 'dimension' as const,
              data_type: 'string',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 4
            },
            {
              id: 5,
              table_id: 1,
              field_name: 'count',
              display_name: 'Job Count',
              description: 'Count of job postings',
              field_type: 'measure' as const,
              data_type: 'number',
              is_filterable: false,
              is_groupable: false,
              is_aggregatable: true,
              default_aggregation: 'COUNT',
              is_active: true,
              sort_order: 5
            }
          ]
        },
        {
          id: 2,
          table_name: 'candidates',
          display_name: 'Candidates',
          description: 'All candidates in the system',
          category: 'Core Data',
          is_active: true,
          sort_order: 2,
          fields: [
            {
              id: 6,
              table_id: 2,
              field_name: 'name',
              display_name: 'Candidate Name',
              description: 'Full name of the candidate',
              field_type: 'dimension' as const,
              data_type: 'string',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 1
            },
            {
              id: 7,
              table_id: 2,
              field_name: 'status',
              display_name: 'Candidate Status',
              description: 'Current status in the hiring process',
              field_type: 'dimension' as const,
              data_type: 'string',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 2
            },
            {
              id: 8,
              table_id: 2,
              field_name: 'source',
              display_name: 'Candidate Source',
              description: 'How the candidate was sourced',
              field_type: 'dimension' as const,
              data_type: 'string',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 3
            },
            {
              id: 9,
              table_id: 2,
              field_name: 'experience_years',
              display_name: 'Years of Experience',
              description: 'Years of relevant experience',
              field_type: 'dimension' as const,
              data_type: 'number',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 4
            },
            {
              id: 10,
              table_id: 2,
              field_name: 'count',
              display_name: 'Candidate Count',
              description: 'Count of candidates',
              field_type: 'measure' as const,
              data_type: 'number',
              is_filterable: false,
              is_groupable: false,
              is_aggregatable: true,
              default_aggregation: 'COUNT',
              is_active: true,
              sort_order: 5
            }
          ]
        },
        {
          id: 3,
          table_name: 'interviews',
          display_name: 'Interviews',
          description: 'All interviews conducted',
          category: 'Process Data',
          is_active: true,
          sort_order: 3,
          fields: [
            {
              id: 11,
              table_id: 3,
              field_name: 'type',
              display_name: 'Interview Type',
              description: 'Type of interview (phone, video, in-person)',
              field_type: 'dimension' as const,
              data_type: 'string',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 1
            },
            {
              id: 12,
              table_id: 3,
              field_name: 'status',
              display_name: 'Interview Status',
              description: 'Status of the interview',
              field_type: 'dimension' as const,
              data_type: 'string',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 2
            },
            {
              id: 13,
              table_id: 3,
              field_name: 'month',
              display_name: 'Interview Month',
              description: 'Month when interview was conducted',
              field_type: 'dimension' as const,
              data_type: 'date',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 3
            },
            {
              id: 14,
              table_id: 3,
              field_name: 'count',
              display_name: 'Interview Count',
              description: 'Count of interviews',
              field_type: 'measure' as const,
              data_type: 'number',
              is_filterable: false,
              is_groupable: false,
              is_aggregatable: true,
              default_aggregation: 'COUNT',
              is_active: true,
              sort_order: 4
            }
          ]
        }
      ];
      
      res.json(mockTables);
    } catch (error) {
      console.error('Error fetching table metadata:', error);
      res.status(500).json({ 
        error: 'Failed to fetch table metadata',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Execute a report query - returns mock data for the matrix interface
  app.post("/api/report/execute", authenticateToken, requireOrganization, async (req: ExtendedAuthRequest, res: Response) => {
    try {
      const reportRequest: ReportRequest = req.body;
      
      // Generate SQL query
      const generatedSQL = generateReportSQL(reportRequest);
      
      // Return realistic mock data based on selected fields
      const mockResults = [
        { category: 'Active Jobs', department: 'Engineering', count: 15, percentage: 75 },
        { category: 'Active Jobs', department: 'Marketing', count: 8, percentage: 40 },
        { category: 'Active Jobs', department: 'Sales', count: 12, percentage: 60 },
        { category: 'Filled Jobs', department: 'Engineering', count: 5, percentage: 25 },
        { category: 'Filled Jobs', department: 'Marketing', count: 3, percentage: 15 },
        { category: 'Filled Jobs', department: 'Sales', count: 4, percentage: 20 },
        { category: 'New Candidates', source: 'LinkedIn', count: 25, percentage: 50 },
        { category: 'New Candidates', source: 'Indeed', count: 15, percentage: 30 },
        { category: 'New Candidates', source: 'Referral', count: 10, percentage: 20 },
        { category: 'Interviews Scheduled', type: 'Phone', count: 18, percentage: 45 },
        { category: 'Interviews Scheduled', type: 'Video', count: 12, percentage: 30 },
        { category: 'Interviews Scheduled', type: 'In-Person', count: 10, percentage: 25 }
      ];
      
      // Filter results based on selected fields
      let filteredResults = mockResults;
      if (reportRequest.selected_rows.length > 0 || reportRequest.selected_columns.length > 0) {
        // Apply basic filtering logic based on selected fields
        filteredResults = mockResults.slice(0, 8); // Show subset for demo
      }
      
      const executionTime = 150 + Math.random() * 200; // Mock execution time
      
      res.json({
        execution_id: Date.now(),
        generated_sql: generatedSQL,
        results: filteredResults,
        row_count: filteredResults.length,
        execution_time: Math.round(executionTime),
        status: 'success',
        metadata: {
          selected_tables: reportRequest.selected_tables,
          selected_rows: reportRequest.selected_rows,
          selected_columns: reportRequest.selected_columns,
          selected_measures: reportRequest.selected_measures
        }
      });
      
    } catch (error) {
      console.error('Error executing report:', error);
      res.status(500).json({ 
        error: 'Failed to execute report',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Save a report template
  app.post("/api/report/templates", authenticateToken, requireOrganization, async (req: ExtendedAuthRequest, res: Response) => {
    try {
      const template: ReportTemplate = req.body;
      
      // Mock saving template
      const savedTemplate = {
        id: Date.now(),
        ...template,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: req.user?.id,
        organization_id: req.organizationId,
        execution_count: 0,
        last_executed_at: null
      };
      
      res.json(savedTemplate);
    } catch (error) {
      console.error('Error saving report template:', error);
      res.status(500).json({ 
        error: 'Failed to save report template',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get user's report templates
  app.get("/api/report/templates", authenticateToken, requireOrganization, async (req: ExtendedAuthRequest, res: Response) => {
    try {
      // Mock templates with matrix-style configurations
      const mockTemplates = [
        {
          id: 1,
          template_name: 'Job Status by Department',
          description: 'Overview of job posting statuses across departments',
          category: 'Operations',
          selected_tables: ['jobs'],
          selected_rows: ['status'],
          selected_columns: ['department'],
          selected_measures: ['count'],
          chart_type: 'bar',
          created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          created_by_name: 'Admin User',
          execution_count: 5,
          last_executed_at: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: 2,
          template_name: 'Candidate Sources Analysis',
          description: 'Breakdown of candidates by source and status',
          category: 'Recruitment',
          selected_tables: ['candidates'],
          selected_rows: ['source'],
          selected_columns: ['status'],
          selected_measures: ['count'],
          chart_type: 'pie',
          created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          created_by_name: 'HR Manager',
          execution_count: 12,
          last_executed_at: new Date(Date.now() - 7200000).toISOString()
        },
        {
          id: 3,
          template_name: 'Interview Pipeline',
          description: 'Interview scheduling and completion trends',
          category: 'Process Analytics',
          selected_tables: ['interviews'],
          selected_rows: ['type'],
          selected_columns: ['month'],
          selected_measures: ['count'],
          chart_type: 'line',
          created_at: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
          created_by_name: 'Recruiter',
          execution_count: 8,
          last_executed_at: new Date(Date.now() - 14400000).toISOString()
        }
      ];
      
      res.json(mockTemplates);
    } catch (error) {
      console.error('Error fetching report templates:', error);
      res.status(500).json({ 
        error: 'Failed to fetch report templates',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Delete a report template
  app.delete("/api/report/templates/:id", authenticateToken, requireOrganization, async (req: ExtendedAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      // Mock deletion
      res.json({ success: true, deleted_id: parseInt(id) });
    } catch (error) {
      console.error('Error deleting report template:', error);
      res.status(500).json({ 
        error: 'Failed to delete report template',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get execution history
  app.get("/api/report/executions", authenticateToken, requireOrganization, async (req: ExtendedAuthRequest, res: Response) => {
    try {
      // Mock execution history
      const mockExecutions = [
        {
          id: 1,
          report_type: 'template',
          result_count: 25,
          execution_time: 150,
          status: 'completed',
          created_at: new Date().toISOString(),
          user_name: 'John Doe',
          template_name: 'Job Status by Department'
        },
        {
          id: 2,
          report_type: 'custom',
          result_count: 12,
          execution_time: 89,
          status: 'completed',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          user_name: 'Jane Smith',
          template_name: null
        },
        {
          id: 3,
          report_type: 'template',
          result_count: 18,
          execution_time: 203,
          status: 'completed',
          created_at: new Date(Date.now() - 7200000).toISOString(),
          user_name: 'Mike Johnson',
          template_name: 'Candidate Sources Analysis'
        }
      ];
      
      res.json(mockExecutions);
    } catch (error) {
      console.error('Error fetching execution history:', error);
      res.status(500).json({ 
        error: 'Failed to fetch execution history',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
