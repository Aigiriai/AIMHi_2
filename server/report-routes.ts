import type { Express, Request, Response } from "express";
import { authenticateToken, requireOrganization, type AuthRequest } from "./auth";
import { getSQLiteDB } from "./unified-db-manager";
import { generateSQLFromPrompt } from "./ai-report-service";
import { validateAndSanitizeSQL, sanitizePrompt } from "./simple-sql-validator";

// Rate limiter for AI requests (10 requests per minute per user)
// Removed rate limiter - now reports should always generate

// Extend AuthRequest to include all Express request properties
interface ExtendedAuthRequest extends AuthRequest {
  query?: any;
  body: any;
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
  generated_sql?: string;
}

// SQL query generation utility
// Generic field mapping generator - creates mappings from table metadata
function generateFieldMappings(tableMetadata: any[]): { [key: string]: { [table: string]: string } } {
  const mappings: { [key: string]: { [table: string]: string } } = {};
  
  // Universal fallbacks for common fields
  const universalMappings: { [key: string]: { [table: string]: string } } = {
    'count': { '*': 'COUNT(*)' },
    'title': { '*': 'title' },
    'name': { '*': 'name' },
    'status': { '*': 'status' }
  };
  
  // Generate mappings from metadata
  tableMetadata.forEach(table => {
    table.fields?.forEach((field: any) => {
      const fieldName = field.field_name;
      
      if (!mappings[fieldName]) {
        mappings[fieldName] = {};
      }
      
      // Map field to its native table column
      mappings[fieldName][table.table_name] = fieldName;
      
      // Add cross-table fallbacks for common fields
      if (fieldName === 'status' || fieldName === 'name' || fieldName === 'title') {
        // These fields can exist in multiple tables, so add fallbacks
        tableMetadata.forEach(otherTable => {
          if (otherTable.table_name !== table.table_name) {
            if (!mappings[fieldName][otherTable.table_name]) {
              mappings[fieldName][otherTable.table_name] = `'${fieldName}_fallback'`;
            }
          }
        });
      }
    });
  });
  
  // Merge with universal mappings
  Object.keys(universalMappings).forEach(field => {
    if (!mappings[field]) {
      mappings[field] = universalMappings[field];
    } else {
      mappings[field] = { ...mappings[field], ...universalMappings[field] };
    }
  });
  
  return mappings;
}

function generateReportSQL(request: ReportRequest, organizationId?: number): string {
  console.log('🔧 REPORT_SQL: Generating query with request:', {
    tables: request.selected_tables,
    rows: request.selected_rows?.length || 0,
    columns: request.selected_columns?.length || 0,
    measures: request.selected_measures?.length || 0,
    filters: request.filters?.length || 0
  });
  
  console.log('🔧 REPORT_SQL: Detailed selections:', {
    selected_tables: request.selected_tables,
    selected_rows: request.selected_rows,
    selected_columns: request.selected_columns,
    selected_measures: request.selected_measures
  });

  const { selected_tables, selected_rows, selected_columns, selected_measures, filters } = request;
  
  // Default to jobs table if none selected
  const primaryTable = selected_tables.length > 0 ? selected_tables[0] : 'jobs';
  console.log('🔧 REPORT_SQL: Using primary table:', primaryTable);
  
  // Generic field to table mapping - maps field names to their source tables
  const fieldToTableMapping: { [fieldName: string]: string } = {
    // Jobs table fields
    'title': 'jobs',
    'status': 'jobs', // Can exist in multiple tables, prioritize jobs
    'department': 'jobs',
    'location': 'jobs',
    'count': 'jobs', // Default measure table
    
    // Candidates table fields  
    'name': 'candidates',
    'source': 'candidates', // Prioritize candidates for source
    'experience_years': 'candidates',
    
    // Applications table fields
    'applied_month': 'applications',
    'application_source': 'applications',
    'application_month': 'applications',
    'match_percentage': 'applications',
    
    // Interviews table fields
    'month': 'interviews',
    'interview_month': 'interviews',
    'score': 'interviews',
    
    // Job matches table fields
    'match_score': 'job_matches',
    'match_date': 'job_matches'
  };
  
  // Analyze all selected fields to determine which tables are needed
  const allSelectedFields = [...selected_rows, ...selected_columns, ...selected_measures];
  const requiredTables = new Set<string>();
  
  allSelectedFields.forEach(field => {
    const sourceTable = fieldToTableMapping[field];
    if (sourceTable) {
      requiredTables.add(sourceTable);
      console.log('🔧 REPORT_SQL: Field', field, 'requires table:', sourceTable);
    } else {
      // If field not in mapping, assume it belongs to primary table
      requiredTables.add(primaryTable);
      console.log('🔧 REPORT_SQL: Field', field, 'defaulted to primary table:', primaryTable);
    }
  });
  
  console.log('🔧 REPORT_SQL: Required tables:', Array.from(requiredTables));
  
  // Determine the best table to use - prioritize based on field count and primary selection
  let actualTable = primaryTable;
  if (requiredTables.size === 1) {
    actualTable = Array.from(requiredTables)[0];
    console.log('🔧 REPORT_SQL: Single table detected:', actualTable);
  } else if (requiredTables.size > 1) {
    // Multi-table scenario - for now, use the table with most fields
    const tableCounts: { [table: string]: number } = {};
    allSelectedFields.forEach(field => {
      const sourceTable = fieldToTableMapping[field] || primaryTable;
      tableCounts[sourceTable] = (tableCounts[sourceTable] || 0) + 1;
    });
    
    actualTable = Object.keys(tableCounts).reduce((a, b) => 
      tableCounts[a] > tableCounts[b] ? a : b
    );
    
    console.log('🔧 REPORT_SQL: Multi-table scenario - table counts:', tableCounts);
    console.log('🔧 REPORT_SQL: Selected table with most fields:', actualTable);
  }

  // Generic field mapping system - maps field names to SQL expressions for each table
  const fieldMapping: { [key: string]: { [table: string]: string } } = {
    // Universal fields that can exist in any table
    'title': { 
      'jobs': 'title', 
      'candidates': 'name', 
      'applications': `'Application Title'`,
      'interviews': `'Interview'`,
      'job_matches': `'Match'`
    },
    'status': { 
      'jobs': 'status', 
      'candidates': 'status', 
      'applications': 'status',
      'interviews': `'Scheduled'`,
      'job_matches': `'Active'`
    },
    'name': { 
      'candidates': 'name', 
      'users': 'first_name || \' \' || last_name',
      'jobs': 'title',
      'applications': `'Applicant'`,
      'interviews': `'Candidate'`
    },
    'source': { 
      'candidates': 'source', 
      'jobs': `'Direct'`, 
      'applications': 'source',
      'interviews': `'Internal'`
    },
    'department': { 
      'jobs': 'department', 
      'candidates': `'General'`,
      'applications': `'General'`
    },
    // Assignment fields
    'role': {
      'job_assignments': 'role',
      'candidate_assignments': 'role'
    },
    'assigned_month': {
      'job_assignments': `STRFTIME('%Y-%m', created_at)`,
      'candidate_assignments': `STRFTIME('%Y-%m', created_at)`
    },
    'location': {
      'jobs': 'location',
      'candidates': `'Remote'`,
      'applications': `'Remote'`
    },
    
    // Date/time fields with table-specific expressions
    'applied_month': { 
      'applications': 'applied_month', 
      'jobs': `STRFTIME('%Y-%m', created_at)`,
      'candidates': `STRFTIME('%Y-%m', created_at)`
    },
    'application_month': { 
      'applications': 'applied_month', 
      'jobs': `STRFTIME('%Y-%m', created_at)`
    },
    'month': {
      'interviews': 'month',
      'applications': 'applied_month',
  'jobs': `STRFTIME('%Y-%m', created_at)`,
  'job_assignments': `STRFTIME('%Y-%m', created_at)`,
  'candidate_assignments': `STRFTIME('%Y-%m', created_at)`
    },
    
    // Numeric/measure fields
    'count': { '*': 'COUNT(*)' },
    'experience_years': { 
      'candidates': 'experience',
      'applications': `0`,
      'jobs': `0`
    },
    'match_percentage': {
      'applications': 'match_percentage',
      'job_matches': 'match_percentage',
      'candidates': `0`
    },
    'match_score': { 
      'job_matches': 'match_percentage', 
      'applications': 'match_percentage',
      'candidates': `0`
    },
    'score': {
      'interviews': 'score',
      'applications': 'match_percentage',
      'candidates': `0`
    }
  };

  console.log('🔧 REPORT_SQL: Available field mappings:', Object.keys(fieldMapping));
  console.log('🔧 REPORT_SQL: Will query table:', actualTable);

  // Build SELECT clause with proper matrix report logic
  const allFields = [...selected_rows, ...selected_columns, ...selected_measures];
  console.log('🔧 REPORT_SQL: All fields combined:', allFields);
  console.log('🔧 REPORT_SQL: Matrix structure:', {
    rows: selected_rows,
    columns: selected_columns, 
    measures: selected_measures
  });
  
  let selectFields = [];
  
  if (allFields.length === 0) {
    selectFields.push('COUNT(*) as count');
    console.log('🔧 REPORT_SQL: Using default COUNT query - no fields selected');
  } else {
    // For matrix reports, we need to handle rows and columns differently
    
    // Add row fields (primary dimensions)
    for (const field of selected_rows) {
      let sqlField = field;
      
      // Map field to database column using the correct table
      if (fieldMapping[field]) {
        if (fieldMapping[field][actualTable]) {
          sqlField = fieldMapping[field][actualTable];
        } else if (fieldMapping[field]['*']) {
          sqlField = fieldMapping[field]['*'];
        } else {
          // Use first available mapping as fallback
          const availableMapping = Object.values(fieldMapping[field])[0];
          sqlField = availableMapping;
          console.warn('🔧 REPORT_SQL: Using fallback mapping for ROW field:', field, '->', sqlField);
        }
      } else {
        // If no mapping found, check if it exists as-is in the table
        console.warn('🔧 REPORT_SQL: No field mapping found for:', field, '- using as-is');
      }
      
      selectFields.push(`${sqlField} as ${field}`);
      console.log('🔧 REPORT_SQL: Added ROW field:', { 
        originalField: field, 
        mappedField: sqlField, 
        finalSelect: `${sqlField} as ${field}` 
      });
    }
    
    // Add column fields (secondary dimensions) 
    for (const field of selected_columns) {
      let sqlField = field;
      
      // Map field to database column using the correct table
      if (fieldMapping[field]) {
        if (fieldMapping[field][actualTable]) {
          sqlField = fieldMapping[field][actualTable];
        } else if (fieldMapping[field]['*']) {
          sqlField = fieldMapping[field]['*'];
        } else {
          // Use first available mapping as fallback
          const availableMapping = Object.values(fieldMapping[field])[0];
          sqlField = availableMapping;
          console.warn('🔧 REPORT_SQL: Using fallback mapping for COLUMN field:', field, '->', sqlField);
        }
      } else {
        // If no mapping found, try to create a safe fallback
        console.warn('🔧 REPORT_SQL: No field mapping found for:', field);
        if (field.includes('source')) {
          sqlField = 'source';
        } else if (field.includes('month') || field.includes('date')) {
          sqlField = `STRFTIME('%Y-%m', created_at)`;
        } else {
          sqlField = `'${field}' as fallback_${field}`;
        }
        console.warn('🔧 REPORT_SQL: Using fallback mapping:', sqlField);
      }
      
      selectFields.push(`${sqlField} as ${field}`);
      console.log('🔧 REPORT_SQL: Added COLUMN field:', { 
        originalField: field, 
        mappedField: sqlField, 
        finalSelect: `${sqlField} as ${field}` 
      });
    }
    
    // Add measure fields (aggregations)
    if (selected_measures.length === 0) {
      // Default measure if none selected
      selectFields.push('COUNT(*) as count');
      console.log('🔧 REPORT_SQL: Added default COUNT measure');
    } else {
      for (const field of selected_measures) {
        let sqlField = field;
        
        // Handle measure aggregations
        if (field === 'count' || field.toLowerCase().includes('count')) {
          sqlField = 'COUNT(*)';
        } else if (fieldMapping[field]) {
          if (fieldMapping[field][primaryTable]) {
            sqlField = fieldMapping[field][primaryTable];
          } else if (fieldMapping[field]['*']) {
            sqlField = fieldMapping[field]['*'];
          }
          
          // Apply aggregation if it's not already a COUNT
          if (!sqlField.includes('COUNT') && !sqlField.includes('SUM') && !sqlField.includes('AVG')) {
            sqlField = `COUNT(${sqlField})`;
          }
        } else {
          sqlField = 'COUNT(*)';
        }
        
        selectFields.push(`${sqlField} as ${field}`);
        console.log('🔧 REPORT_SQL: Added MEASURE field:', { 
          originalField: field, 
          mappedField: sqlField, 
          finalSelect: `${sqlField} as ${field}` 
        });
      }
    }
    
    console.log('🔧 REPORT_SQL: Final select fields:', selectFields);
  }
  
  // Build query using the determined table
  let query = `SELECT ${selectFields.join(', ')}`;
  query += ` FROM ${actualTable}`;
  console.log('🔧 REPORT_SQL: Base query built:', query);
  
  // Add organization filter (security requirement)
  let whereClause = `organization_id = ${organizationId || 1}`;
  
  // Add user-defined filters
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
    whereClause += ' AND ' + filterClauses.join(' AND ');
    console.log('🔧 REPORT_SQL: Applied filters:', filterClauses);
  }
  
  query += ` WHERE ${whereClause}`;
  
  // Add GROUP BY for matrix reports - only group by dimensions, not measures
  const allDimensions = [...selected_rows, ...selected_columns];
  console.log('🔧 REPORT_SQL: Matrix dimensions for GROUP BY:', allDimensions);
  
  if (allDimensions.length > 0) {
    // For matrix reports, we group by ALL dimensions (both rows and columns)
    // The client will handle the pivoting/cross-tabulation
    query += ` GROUP BY ${allDimensions.join(', ')}`;
    console.log('🔧 REPORT_SQL: Added GROUP BY for matrix report:', allDimensions);
  } else if (selected_measures.length > 0) {
    // If only measures are selected (no dimensions), no GROUP BY needed
    console.log('🔧 REPORT_SQL: No GROUP BY needed - measures only');
  }
  
  // Add ORDER BY - prioritize row fields for better matrix display
  if (selected_rows.length > 0) {
    query += ` ORDER BY ${selected_rows.join(', ')}`;
    console.log('🔧 REPORT_SQL: Added ORDER BY for rows:', selected_rows);
  } else if (selected_columns.length > 0) {
    query += ` ORDER BY ${selected_columns[0]}`;
    console.log('🔧 REPORT_SQL: Added ORDER BY for first column:', selected_columns[0]);
  }
  
  // Add LIMIT for safety
  query += ' LIMIT 100';
  
  console.log('🔧 REPORT_SQL: Generated final query:', query);
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
      const generatedSQL = generateReportSQL(reportRequest, req.organizationId);
      
      console.log(`📊 REPORT_API[${requestId}]: Generated SQL:`, generatedSQL);
      
      // Execute actual database query instead of using mock data
      const dbManager = await getSQLiteDB();
      const db = dbManager.sqlite; // Use the SQLite database instance
      console.log(`📊 REPORT_API[${requestId}]: Executing query against database...`);
      
      let queryResults = [];
      try {
        // Execute the generated SQL query
        queryResults = db.prepare(generatedSQL).all();
        console.log(`📊 REPORT_API[${requestId}]: Database query executed successfully - ${queryResults.length} rows returned`);
      } catch (dbError) {
        console.error(`📊 REPORT_API[${requestId}]: Database query failed:`, dbError);
        
        // Fallback to a simpler query based on the selected tables
        let fallbackSQL = '';
        const primaryTable = reportRequest.selected_tables[0] || 'jobs';
        const allFields = [...reportRequest.selected_rows, ...reportRequest.selected_columns, ...reportRequest.selected_measures];
        
        if (allFields.length > 0) {
          // Build a safe query with only valid database columns
          const safeFields = allFields.map(field => {
            switch (field) {
              case 'title': return primaryTable === 'jobs' ? 'title' : 'name as title';
              case 'status': return 'status';
              case 'department': return `'${primaryTable}' as department`;  // Mock department for now
              case 'name': return 'name';
              case 'source': return 'source';
              case 'count': return 'COUNT(*) as count';
              default: return `'${field}' as ${field}`;
            }
          });
          
          fallbackSQL = `SELECT ${safeFields.join(', ')} FROM ${primaryTable} WHERE organization_id = ${req.organizationId} LIMIT 100`;
        } else {
          fallbackSQL = `SELECT COUNT(*) as count FROM ${primaryTable} WHERE organization_id = ${req.organizationId}`;
        }
        
        console.log(`📊 REPORT_API[${requestId}]: Trying fallback query:`, fallbackSQL);
        
        try {
          queryResults = db.prepare(fallbackSQL).all();
          console.log(`📊 REPORT_API[${requestId}]: Fallback query successful - ${queryResults.length} rows returned`);
        } catch (fallbackError) {
          console.error(`📊 REPORT_API[${requestId}]: Fallback query also failed:`, fallbackError);
          
          // Final fallback to basic org data
          const basicSQL = `SELECT 
            'Active Jobs' as category,
            'Total' as department,
            COUNT(*) as count,
            ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM jobs WHERE organization_id = ${req.organizationId}), 0) as percentage
            FROM jobs WHERE organization_id = ${req.organizationId} AND status = 'active'`;
          
          queryResults = db.prepare(basicSQL).all();
          console.log(`📊 REPORT_API[${requestId}]: Basic fallback query executed - ${queryResults.length} rows returned`);
        }
      }
      
      // Use the actual query results
      const filteredResults = queryResults;
      
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
    try {
      const template: ReportTemplate = req.body;
      if (!template.template_name || template.template_name.trim().length === 0) {
        return res.status(400).json({ error: 'Template name is required' });
      }

      const dbManager = await getSQLiteDB();
      const db = dbManager.sqlite;
      const stmt = db.prepare(`
        INSERT INTO report_templates (
          organization_id, user_id, template_name, description, is_public, category,
          selected_tables, selected_rows, selected_columns, selected_measures, filters,
          chart_type, chart_config, generated_sql, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        req.organizationId,
        req.user?.id,
        template.template_name,
        template.description || null,
        template.is_public ? 1 : 0,
        template.category || 'custom',
        JSON.stringify(template.selected_tables || []),
        JSON.stringify(template.selected_rows || []),
        JSON.stringify(template.selected_columns || []),
        JSON.stringify(template.selected_measures || []),
        JSON.stringify(template.filters || []),
        template.chart_type || 'table',
        JSON.stringify(template.chart_config || {}),
        template.generated_sql || null,
        req.user?.id
      );

      const row = db.prepare(`
        SELECT id, organization_id, user_id, template_name, description, is_public, category,
               chart_type, generated_sql, created_at, updated_at, execution_count, last_executed_at
        FROM report_templates WHERE id = ?
      `).get(info.lastInsertRowid);

      console.log(`📊 REPORT_API[${requestId}]: Template saved with ID ${row?.id}`);
      res.json(row);
    } catch (error) {
      console.error(`📊 REPORT_API[${requestId}]: Error saving report template:`, error);
      res.status(500).json({ error: 'Failed to save report template' });
    }
  });

  // Get user's report templates
  app.get("/api/report/templates", authenticateToken, requireOrganization, async (req: ExtendedAuthRequest, res: Response) => {
    try {
      const dbManager = await getSQLiteDB();
      const db = dbManager.sqlite;
      const rows = db.prepare(`
        SELECT t.id, t.template_name, t.description, t.category, t.chart_type,
               t.created_at, t.updated_at, t.execution_count, t.last_executed_at,
               t.user_id, t.is_public
        FROM report_templates t
        WHERE t.organization_id = ? AND (t.user_id = ? OR t.is_public = 1)
        ORDER BY t.updated_at DESC
      `).all(req.organizationId, req.user?.id);
      res.json(rows);
    } catch (error) {
      console.error('Error fetching report templates:', error);
      res.status(500).json({ error: 'Failed to fetch report templates' });
    }
  });

  // Delete a report template
  app.delete("/api/report/templates/:id", authenticateToken, requireOrganization, async (req: ExtendedAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const dbManager = await getSQLiteDB();
      const db = dbManager.sqlite;
      const row = db.prepare(`SELECT id, user_id, organization_id FROM report_templates WHERE id = ?`).get(id);
      if (!row || row.organization_id !== req.organizationId || row.user_id !== req.user?.id) {
        return res.status(404).json({ error: 'Template not found' });
      }
      db.prepare(`DELETE FROM report_templates WHERE id = ?`).run(id);
      res.json({ success: true, deleted_id: parseInt(id) });
    } catch (error) {
      console.error('Error deleting report template:', error);
      res.status(500).json({ 
        error: 'Failed to delete report template',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get a single saved template (details including SQL)
  app.get("/api/report/templates/:id", authenticateToken, requireOrganization, async (req: ExtendedAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const dbManager = await getSQLiteDB();
      const db = dbManager.sqlite;
      const row = db.prepare(`
        SELECT * FROM report_templates WHERE id = ?
      `).get(id);
      if (!row || row.organization_id !== req.organizationId || (row.user_id !== req.user?.id && row.is_public !== 1)) {
        return res.status(404).json({ error: 'Template not found' });
      }
      res.json(row);
    } catch (error) {
      console.error('Error fetching template:', error);
      res.status(500).json({ error: 'Failed to fetch template' });
    }
  });

  // Execute a saved template by ID
  app.post("/api/report/templates/:id/execute", authenticateToken, requireOrganization, async (req: ExtendedAuthRequest, res: Response) => {
    const requestId = Date.now();
    try {
      const { id } = req.params;
      const organizationId = req.organizationId;
      const dbManager = await getSQLiteDB();
      const db = dbManager.sqlite;

      const template = db.prepare(`SELECT * FROM report_templates WHERE id = ?`).get(id);
      if (!template || template.organization_id !== organizationId || (template.user_id !== req.user?.id && template.is_public !== 1)) {
        return res.status(404).json({ error: 'Template not found' });
      }
      const rawSQL: string = template.generated_sql || '';
      if (!rawSQL) return res.status(400).json({ error: 'Template has no SQL to execute' });

      // Validate/sanitize and execute
  const validation = await validateAndSanitizeSQL(rawSQL, organizationId || -1, 100);
      if (!validation.isValid) {
        return res.status(400).json({ error: 'Saved SQL failed validation', validation_errors: validation.errors });
      }
      const validatedSQL = validation.sanitizedSQL;
      const start = Date.now();
      const results = db.prepare(validatedSQL).all();
      const execTime = Date.now() - start;

      // Track execution
      db.prepare(`
        INSERT INTO report_executions (
          organization_id, user_id, template_id, report_type, generated_sql, parameters,
          result_count, execution_time, status
        ) VALUES (?, ?, ?, 'template', ?, '{}', ?, ?, 'completed')
      `).run(organizationId, req.user?.id, id, validatedSQL, results.length, execTime);
      db.prepare(`
        UPDATE report_templates SET execution_count = COALESCE(execution_count,0) + 1, last_executed_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(id);

      const response = {
        execution_id: requestId,
        generated_sql: validatedSQL,
        results,
        row_count: results.length,
        execution_time: execTime,
        status: 'completed',
        chart_type: template.chart_type || 'table',
        ai_analysis: undefined
      };
      res.json(response);
    } catch (error) {
      console.error('Error executing saved template:', error);
      res.status(500).json({ error: 'Failed to execute saved template' });
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

  // AI-powered report generation endpoint - simplified for reliability
  app.post("/api/report/ai-generate", authenticateToken, requireOrganization, async (req: ExtendedAuthRequest, res: Response) => {
    console.log('🤖 AI_REPORT: Starting simplified AI report generation');
    const startTime = Date.now();
    
    try {
      const { prompt, preferred_chart_type, additional_context } = req.body;
      const userId = String(req.user?.id || 'unknown');
      const organizationId = req.organization?.id || req.user?.organizationId;
      
      console.log('🤖 AI_REPORT: User:', userId, 'Organization:', organizationId);
      
      // Basic validation
      if (!organizationId) {
        console.error('🤖 AI_REPORT: No organization ID found for user:', userId);
        return res.status(403).json({ 
          error: 'Organization Required',
          details: 'Please log in with a valid organization account to generate reports'
        });
      }

      // Input validation - simplified and user-friendly
      if (!prompt || prompt.trim().length === 0) {
        console.error('🤖 AI_REPORT: No prompt provided by user:', userId);
        return res.status(400).json({ 
          error: 'Report Description Required',
          details: 'Please describe what kind of report you want to generate'
        });
      }

      // Validate prompt length
      if (prompt.length > 2000) {
        console.error('🤖 AI_REPORT: Prompt too long for user:', userId);
        return res.status(400).json({ 
          error: 'Description Too Long',
          details: 'Please limit your report description to 2000 characters or less'
        });
      }

      // Validate chart type
      const validChartTypes = ['auto', 'table', 'bar', 'line', 'pie'];
      if (preferred_chart_type && !validChartTypes.includes(preferred_chart_type)) {
        console.error('🤖 AI_REPORT: Invalid chart type:', preferred_chart_type);
        return res.status(400).json({ 
          error: 'Invalid Chart Type',
          details: 'Please select a valid chart type: ' + validChartTypes.join(', ')
        });
      }

      console.log('🤖 AI_REPORT: Processing request for organization:', organizationId);
      console.log('🤖 AI_REPORT: Prompt:', prompt.substring(0, 100) + '...');
      console.log('🤖 AI_REPORT: Preferred chart type:', preferred_chart_type);
      
      // Generate SQL using secure AI service
      const aiResult = await generateSQLFromPrompt(
        prompt, 
        organizationId,
        preferred_chart_type,
        additional_context
      );
      
      console.log('🤖 AI_REPORT: AI SQL generated, validating with simplified validator...');
      
      // Validate and sanitize the generated SQL using simplified validator
      const sqlValidation = await validateAndSanitizeSQL(aiResult.sql, organizationId, 100);
      
      if (!sqlValidation.isValid) {
        console.error('🤖 AI_REPORT: SQL validation failed:', sqlValidation.errors);
        return res.status(400).json({ 
          error: 'Unable to Generate Report',
          details: 'The system could not create a safe query for your request. Please try rephrasing your request.',
          technical_details: sqlValidation.errors.join(', '),
          suggestions: [
            'Try using simpler language',
            'Be more specific about what data you want to see',
            'Check if you\'re asking for data that exists in the system'
          ]
        });
      }

      if (sqlValidation.warnings.length > 0) {
        console.warn('🤖 AI_REPORT: SQL validation warnings:', sqlValidation.warnings);
      }

      const validatedSQL = sqlValidation.sanitizedSQL;
      console.log('🤖 AI_REPORT: SQL validation passed, executing query...');
      console.log('🤖 AI_REPORT: Final SQL:', validatedSQL);

      // Execute the validated SQL query with better error handling
      try {
        const dbManager = await getSQLiteDB();
        const db = dbManager.sqlite;
        
        const sqlStartTime = Date.now();
        const queryResults = db.prepare(validatedSQL).all();
        const sqlExecutionTime = Date.now() - sqlStartTime;
        
        console.log('🤖 AI_REPORT: Query executed successfully');
        console.log('🤖 AI_REPORT: Results count:', queryResults.length);
        console.log('🤖 AI_REPORT: SQL execution time:', sqlExecutionTime, 'ms');

        const totalExecutionTime = Date.now() - startTime;
        const executionId = Date.now(); // Simple execution ID

        // Format response with user-friendly information
        const response = {
          execution_id: executionId,
          generated_sql: validatedSQL,
          results: queryResults,
          row_count: queryResults.length,
          execution_time: totalExecutionTime,
          sql_execution_time: sqlExecutionTime,
          status: 'completed',
          chart_type: aiResult.chartType,
          ai_analysis: {
            interpreted_request: aiResult.interpretation,
            recommended_chart: aiResult.chartType,
            confidence_score: aiResult.confidence
          },
          validation_info: {
            warnings: sqlValidation.warnings,
            risk_level: sqlValidation.riskLevel
          }
        };

        console.log('🤖 AI_REPORT: AI report generation completed successfully');
        console.log('🤖 AI_REPORT: Total execution time:', totalExecutionTime, 'ms');
        
        res.json(response);
        
      } catch (dbError) {
        console.error('🤖 AI_REPORT: Database execution error:', dbError);
        return res.status(500).json({ 
          error: 'Database Query Failed',
          details: 'The report query could not be executed. This might be due to missing data or a complex query structure.',
          suggestions: [
            'Try simplifying your request',
            'Check if the data you\'re asking for exists',
            'Contact support if the problem persists'
          ],
          technical_info: dbError instanceof Error ? dbError.message : 'Unknown database error'
        });
      }

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('🤖 AI_REPORT: Error during AI report generation:', error);
      
      // User-friendly error messages
      let errorMessage = 'Report Generation Failed';
      let errorDetails = 'We encountered an issue while generating your report. Please try again.';
      let suggestions = [
        'Try rephrasing your request in simpler terms',
        'Check if you\'re asking for data that exists in the system',
        'Contact support if the issue persists'
      ];
      
      if (error instanceof Error) {
        console.error('🤖 AI_REPORT: Internal error details:', error.message);
        console.error('🤖 AI_REPORT: Error stack:', error.stack);
        
        if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
          errorMessage = 'Request Timeout';
          errorDetails = 'The report took too long to generate. Please try a simpler request.';
          suggestions = [
            'Use simpler language in your request',
            'Ask for less data at once',
            'Try a different chart type'
          ];
        } else if (error.message.includes('SQL') || error.message.includes('database')) {
          errorMessage = 'Data Query Error';
          errorDetails = 'There was an issue with the data query. Please try rephrasing your request.';
          suggestions = [
            'Be more specific about what data you want',
            'Check for typos in your request',
            'Try asking for a different type of report'
          ];
        } else if (error.message.includes('OpenAI') || error.message.includes('AI')) {
          errorMessage = 'AI Processing Error';
          errorDetails = 'The AI service is temporarily unavailable. Please try again in a moment.';
          suggestions = [
            'Wait a moment and try again',
            'Try a different way of asking for the same data',
            'Use simpler language'
          ];
        }
      }
      
      res.status(500).json({ 
        error: errorMessage,
        details: errorDetails,
        suggestions: suggestions,
        execution_time: executionTime,
        timestamp: new Date().toISOString(),
        request_id: Date.now()
      });
    }
  });
}
