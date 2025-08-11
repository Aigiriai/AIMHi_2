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
  console.log('🔧 REPORT_SQL: Generating query with request:', {
    tables: request.selected_tables,
    rows: request.selected_rows?.length || 0,
    columns: request.selected_columns?.length || 0,
    measures: request.selected_measures?.length || 0,
    filters: request.filters?.length || 0
  });

  const { selected_tables, selected_rows, selected_columns, selected_measures, filters } = request;
  
  // Basic query structure
  let query = 'SELECT ';
  
  // Add selected fields
  const allFields = [...selected_rows, ...selected_columns, ...selected_measures];
  if (allFields.length === 0) {
    query += 'COUNT(*) as total_count';
    console.log('🔧 REPORT_SQL: Using default COUNT query - no fields selected');
  } else {
    query += allFields.join(', ');
    console.log('🔧 REPORT_SQL: Selected fields:', allFields);
  }
  
  // Add FROM clause with appropriate tables
  if (selected_tables.length > 0) {
    query += ` FROM ${selected_tables[0]}`;
    
    // Add JOINs for related tables
    for (let i = 1; i < selected_tables.length; i++) {
      const table = selected_tables[i];
      query += ` LEFT JOIN ${table}`;
      console.log('🔧 REPORT_SQL: Added JOIN for table:', table);
    }
  } else {
    query += ' FROM jobs'; // Default table
    console.log('🔧 REPORT_SQL: Using default table: jobs');
  }
  
  // Add WHERE clause for filters
  if (filters && filters.length > 0) {
    const filterClauses = filters.map(filter => {
      const { field, operator, value } = filter;
      console.log('🔧 REPORT_SQL: Processing filter:', { field, operator, value });
      
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
        default: 
          console.warn('🔧 REPORT_SQL: Unknown operator, defaulting to equals:', operator);
          return `${field} = '${value}'`;
      }
    });
    query += ' WHERE ' + filterClauses.join(' AND ');
    console.log('🔧 REPORT_SQL: Applied filters:', filterClauses);
  }
  
  // Add GROUP BY for measures
  if (selected_measures.length > 0 && (selected_rows.length > 0 || selected_columns.length > 0)) {
    const groupByFields = [...selected_rows, ...selected_columns];
    query += ' GROUP BY ' + groupByFields.join(', ');
    console.log('🔧 REPORT_SQL: Added GROUP BY:', groupByFields);
  }
  
  // Add ORDER BY
  if (selected_rows.length > 0) {
    query += ' ORDER BY ' + selected_rows[0];
    console.log('🔧 REPORT_SQL: Added ORDER BY:', selected_rows[0]);
  }
  
  // Add LIMIT for safety
  query += ' LIMIT 1000';
  
  console.log('🔧 REPORT_SQL: Generated query:', query);
  return query;
}

export default function reportRoutes(app: Express) {
  // Get all available table metadata - simplified mock version
  app.get("/api/report/tables", authenticateToken, requireOrganization, async (req: ExtendedAuthRequest, res: Response) => {
    const requestId = Date.now();
    console.log(`📊 REPORT_API[${requestId}]: GET /api/report/tables requested by user:${req.user?.id} org:${req.organizationId}`);
    
    try {
      console.log(`📊 REPORT_API[${requestId}]: Returning mock table metadata for development`);
      
      // Return mock table metadata for the matrix-style report builder
      // Adding comprehensive tables based on the actual database schema
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
        },
        {
          id: 4,
          table_name: 'applications',
          display_name: 'Job Applications',
          description: 'All job applications and candidate pipeline status',
          category: 'Core Data',
          is_active: true,
          sort_order: 4,
          fields: [
            {
              id: 15,
              table_id: 4,
              field_name: 'status',
              display_name: 'Application Status',
              description: 'Current status in the pipeline',
              field_type: 'dimension' as const,
              data_type: 'string',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 1
            },
            {
              id: 16,
              table_id: 4,
              field_name: 'source',
              display_name: 'Application Source',
              description: 'How the application was received',
              field_type: 'dimension' as const,
              data_type: 'string',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 2
            },
            {
              id: 17,
              table_id: 4,
              field_name: 'applied_month',
              display_name: 'Application Month',
              description: 'Month when application was submitted',
              field_type: 'dimension' as const,
              data_type: 'date',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 3
            },
            {
              id: 18,
              table_id: 4,
              field_name: 'match_percentage',
              display_name: 'Match Score',
              description: 'AI matching score percentage',
              field_type: 'measure' as const,
              data_type: 'number',
              is_filterable: true,
              is_groupable: false,
              is_aggregatable: true,
              default_aggregation: 'AVG',
              is_active: true,
              sort_order: 4
            },
            {
              id: 19,
              table_id: 4,
              field_name: 'count',
              display_name: 'Application Count',
              description: 'Count of applications',
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
          id: 5,
          table_name: 'job_matches',
          display_name: 'AI Matching Results',
          description: 'AI-generated job-candidate matches',
          category: 'Analytics',
          is_active: true,
          sort_order: 5,
          fields: [
            {
              id: 20,
              table_id: 5,
              field_name: 'match_score',
              display_name: 'Match Score',
              description: 'AI matching confidence score',
              field_type: 'measure' as const,
              data_type: 'number',
              is_filterable: true,
              is_groupable: false,
              is_aggregatable: true,
              default_aggregation: 'AVG',
              is_active: true,
              sort_order: 1
            },
            {
              id: 21,
              table_id: 5,
              field_name: 'match_date',
              display_name: 'Match Date',
              description: 'When the match was generated',
              field_type: 'dimension' as const,
              data_type: 'date',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 2
            },
            {
              id: 22,
              table_id: 5,
              field_name: 'count',
              display_name: 'Match Count',
              description: 'Count of matches',
              field_type: 'measure' as const,
              data_type: 'number',
              is_filterable: false,
              is_groupable: false,
              is_aggregatable: true,
              default_aggregation: 'COUNT',
              is_active: true,
              sort_order: 3
            }
          ]
        },
        {
          id: 6,
          table_name: 'users',
          display_name: 'System Users',
          description: 'Recruiters, managers, and other system users',
          category: 'Core Data',
          is_active: true,
          sort_order: 6,
          fields: [
            {
              id: 23,
              table_id: 6,
              field_name: 'role',
              display_name: 'User Role',
              description: 'Role in the organization',
              field_type: 'dimension' as const,
              data_type: 'string',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 1
            },
            {
              id: 24,
              table_id: 6,
              field_name: 'is_active',
              display_name: 'User Status',
              description: 'Whether user is active',
              field_type: 'dimension' as const,
              data_type: 'boolean',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 2
            },
            {
              id: 25,
              table_id: 6,
              field_name: 'created_month',
              display_name: 'User Creation Month',
              description: 'Month when user was created',
              field_type: 'dimension' as const,
              data_type: 'date',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 3
            },
            {
              id: 26,
              table_id: 6,
              field_name: 'count',
              display_name: 'User Count',
              description: 'Count of users',
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
        },
        {
          id: 7,
          table_name: 'teams',
          display_name: 'Teams',
          description: 'Organizational teams and departments',
          category: 'Core Data',
          is_active: true,
          sort_order: 7,
          fields: [
            {
              id: 27,
              table_id: 7,
              field_name: 'name',
              display_name: 'Team Name',
              description: 'Name of the team',
              field_type: 'dimension' as const,
              data_type: 'string',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 1
            },
            {
              id: 28,
              table_id: 7,
              field_name: 'department',
              display_name: 'Department',
              description: 'Department the team belongs to',
              field_type: 'dimension' as const,
              data_type: 'string',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 2
            },
            {
              id: 29,
              table_id: 7,
              field_name: 'count',
              display_name: 'Team Count',
              description: 'Count of teams',
              field_type: 'measure' as const,
              data_type: 'number',
              is_filterable: false,
              is_groupable: false,
              is_aggregatable: true,
              default_aggregation: 'COUNT',
              is_active: true,
              sort_order: 3
            }
          ]
        },
        {
          id: 8,
          table_name: 'job_assignments',
          display_name: 'Job Assignments',
          description: 'User permissions and assignments to jobs',
          category: 'Assignment Data',
          is_active: true,
          sort_order: 8,
          fields: [
            {
              id: 30,
              table_id: 8,
              field_name: 'role',
              display_name: 'Assignment Role',
              description: 'Role in the job (owner, assigned, viewer)',
              field_type: 'dimension' as const,
              data_type: 'string',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 1
            },
            {
              id: 31,
              table_id: 8,
              field_name: 'assigned_month',
              display_name: 'Assignment Month',
              description: 'Month when assignment was made',
              field_type: 'dimension' as const,
              data_type: 'date',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 2
            },
            {
              id: 32,
              table_id: 8,
              field_name: 'count',
              display_name: 'Assignment Count',
              description: 'Count of job assignments',
              field_type: 'measure' as const,
              data_type: 'number',
              is_filterable: false,
              is_groupable: false,
              is_aggregatable: true,
              default_aggregation: 'COUNT',
              is_active: true,
              sort_order: 3
            }
          ]
        },
        {
          id: 9,
          table_name: 'candidate_assignments',
          display_name: 'Candidate Assignments',
          description: 'User permissions and assignments to candidates',
          category: 'Assignment Data',
          is_active: true,
          sort_order: 9,
          fields: [
            {
              id: 33,
              table_id: 9,
              field_name: 'role',
              display_name: 'Assignment Role',
              description: 'Role for the candidate (owner, assigned, viewer)',
              field_type: 'dimension' as const,
              data_type: 'string',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 1
            },
            {
              id: 34,
              table_id: 9,
              field_name: 'assigned_month',
              display_name: 'Assignment Month',
              description: 'Month when assignment was made',
              field_type: 'dimension' as const,
              data_type: 'date',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 2
            },
            {
              id: 35,
              table_id: 9,
              field_name: 'count',
              display_name: 'Assignment Count',
              description: 'Count of candidate assignments',
              field_type: 'measure' as const,
              data_type: 'number',
              is_filterable: false,
              is_groupable: false,
              is_aggregatable: true,
              default_aggregation: 'COUNT',
              is_active: true,
              sort_order: 3
            }
          ]
        },
        {
          id: 10,
          table_name: 'status_history',
          display_name: 'Status Change History',
          description: 'Audit trail of all status changes',
          category: 'Analytics',
          is_active: true,
          sort_order: 10,
          fields: [
            {
              id: 36,
              table_id: 10,
              field_name: 'entity_type',
              display_name: 'Entity Type',
              description: 'Type of entity that changed (job, candidate, etc.)',
              field_type: 'dimension' as const,
              data_type: 'string',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 1
            },
            {
              id: 37,
              table_id: 10,
              field_name: 'old_status',
              display_name: 'Previous Status',
              description: 'Status before the change',
              field_type: 'dimension' as const,
              data_type: 'string',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 2
            },
            {
              id: 38,
              table_id: 10,
              field_name: 'new_status',
              display_name: 'New Status',
              description: 'Status after the change',
              field_type: 'dimension' as const,
              data_type: 'string',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 3
            },
            {
              id: 39,
              table_id: 10,
              field_name: 'change_month',
              display_name: 'Change Month',
              description: 'Month when status change occurred',
              field_type: 'dimension' as const,
              data_type: 'date',
              is_filterable: true,
              is_groupable: true,
              is_aggregatable: false,
              is_active: true,
              sort_order: 4
            },
            {
              id: 40,
              table_id: 10,
              field_name: 'count',
              display_name: 'Change Count',
              description: 'Count of status changes',
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
        }
      ];
      
      console.log(`📊 REPORT_API[${requestId}]: Successfully returning ${mockTables.length} tables with ${mockTables.reduce((sum, t) => sum + t.fields.length, 0)} total fields`);
      res.json(mockTables);
    } catch (error) {
      console.error(`📊 REPORT_API[${requestId}]: Error fetching table metadata:`, error);
      res.status(500).json({ 
        error: 'Failed to fetch table metadata',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Execute a report query - returns mock data for the matrix interface
  app.post("/api/report/execute", authenticateToken, requireOrganization, async (req: ExtendedAuthRequest, res: Response) => {
    const requestId = Date.now();
    const startTime = performance.now();
    
    console.log(`📊 REPORT_API[${requestId}]: POST /api/report/execute requested by user:${req.user?.id} org:${req.organizationId}`);
    console.log(`📊 REPORT_API[${requestId}]: Request body:`, {
      selected_tables: req.body?.selected_tables?.length || 0,
      selected_rows: req.body?.selected_rows?.length || 0,
      selected_columns: req.body?.selected_columns?.length || 0,
      selected_measures: req.body?.selected_measures?.length || 0,
      filters: req.body?.filters?.length || 0,
      chart_type: req.body?.chart_type
    });
    
    try {
      const reportRequest: ReportRequest = req.body;
      
      // Validate request
      if (!reportRequest.selected_tables || reportRequest.selected_tables.length === 0) {
        console.warn(`📊 REPORT_API[${requestId}]: Warning - No tables selected, using default`);
      }
      
      // Generate SQL query
      console.log(`📊 REPORT_API[${requestId}]: Generating SQL query...`);
      const generatedSQL = generateReportSQL(reportRequest);
      
      console.log(`📊 REPORT_API[${requestId}]: Using mock data for development - SQL would be:`, generatedSQL);
      
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
      const endTime = performance.now();
      const actualProcessingTime = endTime - startTime;
      
      console.log(`📊 REPORT_API[${requestId}]: Query executed successfully`);
      console.log(`📊 REPORT_API[${requestId}]: Results: ${filteredResults.length} rows, Mock time: ${Math.round(executionTime)}ms, Actual processing: ${Math.round(actualProcessingTime)}ms`);
      
      const response = {
        execution_id: requestId,
        generated_sql: generatedSQL,
        results: filteredResults,
        row_count: filteredResults.length,
        execution_time: Math.round(executionTime),
        status: 'success',
        chart_type: reportRequest.chart_type || 'table', // Include chart type in response
        metadata: {
          selected_tables: reportRequest.selected_tables,
          selected_rows: reportRequest.selected_rows,
          selected_columns: reportRequest.selected_columns,
          selected_measures: reportRequest.selected_measures,
          actual_processing_time: Math.round(actualProcessingTime)
        }
      };
      
      console.log(`📊 REPORT_API[${requestId}]: Sending response with ${response.row_count} rows`);
      res.json(response);
      
    } catch (error) {
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      console.error(`📊 REPORT_API[${requestId}]: Error executing report after ${Math.round(processingTime)}ms:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        requestBody: req.body
      });
      res.status(500).json({ 
        error: 'Failed to execute report',
        details: error instanceof Error ? error.message : 'Unknown error',
        execution_id: requestId
      });
    }
  });

  // Save a report template
  app.post("/api/report/templates", authenticateToken, requireOrganization, async (req: ExtendedAuthRequest, res: Response) => {
    const requestId = Date.now();
    console.log(`📊 REPORT_API[${requestId}]: POST /api/report/templates - Save template requested by user:${req.user?.id} org:${req.organizationId}`);
    console.log(`📊 REPORT_API[${requestId}]: Template data:`, {
      name: req.body?.template_name,
      description: req.body?.description,
      is_public: req.body?.is_public,
      category: req.body?.category,
      tables: req.body?.selected_tables?.length || 0,
      total_fields: (req.body?.selected_rows?.length || 0) + (req.body?.selected_columns?.length || 0) + (req.body?.selected_measures?.length || 0)
    });
    
    try {
      const template: ReportTemplate = req.body;
      
      // Validate template data
      if (!template.template_name || template.template_name.trim().length === 0) {
        console.warn(`📊 REPORT_API[${requestId}]: Template validation failed - missing name`);
        return res.status(400).json({
          error: 'Template name is required',
          details: 'template_name field cannot be empty'
        });
      }
      
      // Mock saving template
      const savedTemplate = {
        id: requestId,
        ...template,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: req.user?.id,
        organization_id: req.organizationId,
        execution_count: 0,
        last_executed_at: null
      };
      
      console.log(`📊 REPORT_API[${requestId}]: Template saved successfully with ID: ${savedTemplate.id}`);
      res.json(savedTemplate);
    } catch (error) {
      console.error(`📊 REPORT_API[${requestId}]: Error saving report template:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        templateName: req.body?.template_name
      });
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
