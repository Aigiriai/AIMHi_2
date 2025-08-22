// Node environment typings safeguard (if @types/node not present, we declare minimal process env)
// Remove this block once @types/node is added to devDependencies.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Cache for auto-generated schema to avoid re-parsing on every request
let cachedSchema: string | null = null;
let schemaLastModified: number = 0;

interface AIReportRequest {
  prompt: string;
  preferred_chart_type?: string;
  additional_context?: string;
}

interface AIReportResponse {
  execution_id: number;
  generated_sql: string;
  results: any[];
  row_count: number;
  execution_time: number;
  status: string;
  chart_type: string;
  ai_analysis: {
    interpreted_request: string;
    recommended_chart: string;
    confidence_score: number;
  };
}

// Generate AI prompt for SQL generation (optimized version)
function generateAIPrompt(
  userPrompt: string,
  schema: string,
  organizationId: number,
  additionalContext?: string
): string {
  const basePrompt = `You are an expert SQL analyst for a recruitment platform. Generate a precise SQLite SELECT query from the user's request.

DATABASE SCHEMA:
${schema}

CRITICAL RULES:
1. ALWAYS include: WHERE organization_id = ${organizationId} (for data isolation)
2. ALWAYS include: LIMIT 100 (for performance)
3. Use aliases: u=users, j=jobs, c=candidates, a=applications, i=interviews, ja=job_assignments, ca=candidate_assignments
4. For multi-table requests: Use appropriate JOINs to combine data
5. Chart types: 'table' for complex data, 'bar' for comparisons, 'pie' for distributions, 'line' for time series

EXAMPLES:
- "users with job counts" → JOIN users with job_assignments
- "candidates assigned to users" → JOIN users with candidate_assignments  
- "user pipeline status" → JOIN users with jobs/candidates and their statuses

USER REQUEST: "${userPrompt}"
${additionalContext ? `ADDITIONAL CONTEXT: "${additionalContext}"` : ''}

Respond with valid JSON only:
{"sql":"SELECT CONCAT(u.first_name, ' ', u.last_name) as full_name, u.role, COUNT(ja.job_id) as job_count FROM users u LEFT JOIN job_assignments ja ON u.id = ja.user_id WHERE u.organization_id = ${organizationId} GROUP BY u.id LIMIT 100","chart_type":"table","interpretation":"Brief explanation","confidence":95}`;

  return basePrompt;
}

// Load the unified schema file - auto-generate compact schema from actual unified-schema.ts
function loadUnifiedSchema(): string {
  try {
    console.log('🤖 AI_REPORT: Auto-generating compact schema from unified-schema.ts');
    
    // Check if we need to refresh the cached schema
    const currentSchema = generateCompactSchemaFromUnified();
    
    return currentSchema;
  } catch (error) {
    console.warn('🤖 AI_REPORT: Failed to auto-generate schema, using fallback:', error);
    return getFallbackCompactSchema();
  }
}

// Auto-generate compact AI schema by parsing the actual unified-schema.ts file
function generateCompactSchemaFromUnified(): string {
  // Try multiple possible paths for unified-schema.ts
  const possiblePaths = [
    path.join(process.cwd(), 'unified-schema.ts'),
    path.join(process.cwd(), 'server', 'unified-schema.ts'),
    path.join(process.cwd(), '..', 'unified-schema.ts'),
    './unified-schema.ts',
    '../unified-schema.ts',
    '../../unified-schema.ts'
  ];
  
  let schemaPath = '';
  let schemaStats: any = null;
  
  for (const testPath of possiblePaths) {
    try {
      if (fs.existsSync(testPath)) {
        // Test if we can actually read the file
        const testContent = fs.readFileSync(testPath, 'utf-8');
        if (testContent.includes('sqliteTable') && testContent.includes('export const')) {
          schemaPath = testPath;
          schemaStats = fs.statSync(testPath);
          break;
        }
      }
    } catch (error) {
      console.warn(`🤖 AI_REPORT: Cannot access ${testPath}:`, error);
    }
  }
  
  if (!schemaPath || !schemaStats) {
    throw new Error(`Valid unified-schema.ts not found. Searched: ${possiblePaths.join(', ')}`);
  }
  
  // Check if schema file has been modified since last cache
  const fileModified = schemaStats.mtime.getTime();
  
  if (cachedSchema && fileModified <= schemaLastModified) {
    console.log('🤖 AI_REPORT: Using cached auto-generated schema');
    return cachedSchema;
  }
  
  console.log(`🤖 AI_REPORT: Schema file modified, regenerating from: ${schemaPath}`);
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  console.log(`🤖 AI_REPORT: Parsing unified-schema.ts file (${schemaContent.length} chars)...`);
  
  // Extract table definitions using regex patterns
  const tables = extractTableDefinitions(schemaContent);
  
  if (tables.length === 0) {
    throw new Error('No table definitions found in unified-schema.ts');
  }
  
  console.log(`🤖 AI_REPORT: Extracted ${tables.length} table definitions`);
  
  // Generate compact schema string
  const compactSchema = buildCompactSchemaString(tables);
  console.log(`🤖 AI_REPORT: Generated compact schema (${compactSchema.length} chars)`);
  
  // Cache the generated schema
  cachedSchema = compactSchema;
  schemaLastModified = fileModified;
  
  return compactSchema;
}

// Extract table definitions from unified-schema.ts content
function extractTableDefinitions(content: string): Array<{
  name: string;
  columns: Array<{ name: string; type: string; dbColumn: string }>;
  comments: string[];
}> {
  const tables: Array<{
    name: string;
    columns: Array<{ name: string; type: string; dbColumn: string }>;
    comments: string[];
  }> = [];
  
  // More robust regex patterns to match different table definition formats
  const tablePatterns = [
    // Standard format: export const tableName = sqliteTable("table_name", { ... });
    /export\s+const\s+(\w+)\s*=\s*sqliteTable\s*\(\s*["'](\w+)["']\s*,\s*\{([\s\S]*?)\}\s*\);/g,
    // With comments: export const tableName = sqliteTable("table_name", { ... }); // comment
    /export\s+const\s+(\w+)\s*=\s*sqliteTable\s*\(\s*["'](\w+)["']\s*,\s*\{([\s\S]*?)\}\s*\);\s*(?:\/\/.*)?/g
  ];
  
  // Try each pattern to maximize table detection
  for (const tableRegex of tablePatterns) {
    let match;
    // Reset regex lastIndex for each new pattern
    tableRegex.lastIndex = 0;
    
    while ((match = tableRegex.exec(content)) !== null) {
      const tableName = match[2]; // Use the database table name, not the TypeScript variable name
      const tableContent = match[3];
      
      // Skip if we already processed this table
      if (tables.some(t => t.name === tableName)) {
        continue;
      }
      
      // Only include tables relevant for reporting
      if (!isReportingRelevantTable(tableName)) {
        console.log(`🤖 AI_REPORT: Skipping non-reporting table: ${tableName}`);
        continue;
      }
      
      // Extract columns from the table definition
      const columns = extractColumns(tableContent);
      
      // Only include if we found some columns
      if (columns.length === 0) {
        console.warn(`🤖 AI_REPORT: No columns found for table ${tableName}, skipping`);
        continue;
      }
      
      // Extract comments for status values and other important info
      const comments = extractTableComments(tableContent);
      
      const filteredColumns = columns.filter(col => isReportingRelevantColumn(col.dbColumn));
      
      tables.push({
        name: tableName,
        columns: filteredColumns,
        comments
      });
      
      console.log(`🤖 AI_REPORT: Processed table '${tableName}' with ${filteredColumns.length} relevant columns`);
    }
  }
  
  // If no tables found with patterns, log detailed error
  if (tables.length === 0) {
    console.error('🤖 AI_REPORT: No tables extracted. Schema content preview:', content.substring(0, 500));
  }
  
  return tables;
}

// Extract column definitions from table content
function extractColumns(tableContent: string): Array<{ name: string; type: string; dbColumn: string }> {
  const columns: Array<{ name: string; type: string; dbColumn: string }> = [];
  
  // More robust regex patterns to handle various column definition formats
  const columnPatterns = [
    // Standard pattern: columnName: type("db_column_name")
    /(\w+):\s*(text|integer|real)\s*\(\s*["']([^"']+)["']\s*\)/g,
    // Pattern with chaining: columnName: type("db_column_name").notNull()
    /(\w+):\s*(text|integer|real)\s*\(\s*["']([^"']+)["']\s*\)[^,}]*/g,
    // Pattern with complex chaining: columnName: type("db_column_name").primaryKey(...)
    /(\w+):\s*(text|integer|real)\s*\(\s*["']([^"']+)["']\s*\)[\s\S]*?(?=,|\}|$)/g
  ];
  
  // Try each pattern to maximize column detection
  for (const pattern of columnPatterns) {
    let match;
    // Reset regex lastIndex for each new pattern
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(tableContent)) !== null) {
      const propertyName = match[1];
      const dataType = match[2];
      const dbColumnName = match[3];
      
      // Avoid duplicates
      if (!columns.some(col => col.dbColumn === dbColumnName)) {
        columns.push({
          name: propertyName,
          type: dataType,
          dbColumn: dbColumnName
        });
      }
    }
  }
  
  console.log(`🤖 AI_REPORT: Extracted ${columns.length} columns`);
  
  // If no columns found, try a more lenient approach
  if (columns.length === 0) {
    console.warn('🤖 AI_REPORT: No columns found with standard patterns, trying fallback extraction');
    return extractColumnsFallback(tableContent);
  }
  
  return columns;
}

// Fallback column extraction for edge cases
function extractColumnsFallback(tableContent: string): Array<{ name: string; type: string; dbColumn: string }> {
  const columns: Array<{ name: string; type: string; dbColumn: string }> = [];
  
  // Very lenient pattern to catch any type with quoted strings
  const fallbackRegex = /(\w+):\s*(?:text|integer|real)[\s\S]*?["']([^"']+)["']/g;
  
  let match;
  while ((match = fallbackRegex.exec(tableContent)) !== null) {
    const propertyName = match[1];
    const dbColumnName = match[2];
    
    // Guess the type based on common patterns
    let dataType = 'text'; // default
    if (propertyName.includes('id') || propertyName.includes('Id') || propertyName.includes('count') || propertyName.includes('Count')) {
      dataType = 'integer';
    } else if (propertyName.includes('percentage') || propertyName.includes('score')) {
      dataType = 'real';
    }
    
    columns.push({
      name: propertyName,
      type: dataType,
      dbColumn: dbColumnName
    });
  }
  
  console.log(`🤖 AI_REPORT: Fallback extraction found ${columns.length} columns`);
  return columns;
}

// Extract status values and other important comments
function extractTableComments(tableContent: string): string[] {
  const comments: string[] = [];
  
  // Extract status enum values - try multiple patterns
  const statusPatterns = [
    /\/\/\s*status:\s*['"]([^'"]+)['"]/i,
    /\/\/\s*([^,\n]*status[^,\n]*)/i,
    /status.*?['"]([^'"]+)['"]/i,
    /\/\/\s*(draft|active|closed|paused|new|screening|interview|decided|scheduled|completed|cancelled)/i
  ];
  
  for (const pattern of statusPatterns) {
    const statusMatch = tableContent.match(pattern);
    if (statusMatch && statusMatch[1] && !comments.some(c => c.includes(statusMatch[1]))) {
      comments.push(`status: ${statusMatch[1]}`);
      break; // Only add first match to avoid duplicates
    }
  }
  
  // Extract role enum values - try multiple patterns
  const rolePatterns = [
    /\/\/\s*role:\s*['"]([^'"]+)['"]/i,
    /\/\/\s*([^,\n]*role[^,\n]*)/i,
    /role.*?['"]([^'"]+)['"]/i,
    /\/\/\s*(super_admin|org_admin|hiring_manager|recruiter|interviewer|owner|assigned|viewer)/i
  ];
  
  for (const pattern of rolePatterns) {
    const roleMatch = tableContent.match(pattern);
    if (roleMatch && roleMatch[1] && !comments.some(c => c.includes(roleMatch[1]))) {
      comments.push(`role: ${roleMatch[1]}`);
      break; // Only add first match to avoid duplicates
    }
  }
  
  console.log(`🤖 AI_REPORT: Extracted ${comments.length} comments`);
  return comments;
}

// Check if table is relevant for reporting
function isReportingRelevantTable(tableName: string): boolean {
  const reportingTables = [
    'users', 'organizations', 'jobs', 'candidates', 'applications', 
    'interviews', 'job_matches', 'job_assignments', 'candidate_assignments',
    'teams', 'user_teams' // Additional tables that might be useful for reporting
  ];
  const isRelevant = reportingTables.includes(tableName);
  if (!isRelevant) {
    console.log(`🤖 AI_REPORT: Excluding table '${tableName}' from AI schema`);
  }
  return isRelevant;
}

// Check if column is relevant for reporting (exclude internal/system columns)
function isReportingRelevantColumn(columnName: string): boolean {
  const excludeColumns = ['password_hash', 'settings', 'permissions', 'temporary_password'];
  return !excludeColumns.includes(columnName);
}

// Build the compact schema string for AI prompts
function buildCompactSchemaString(tables: Array<{
  name: string;
  columns: Array<{ name: string; type: string; dbColumn: string }>;
  comments: string[];
}>): string {
  let schema = `-- Auto-Generated Compact Database Schema for AIMHi Recruitment AI Reports
-- Generated from unified-schema.ts on ${new Date().toISOString()}
-- Optimized for token efficiency while maintaining 100% accuracy

`;

  // Add table definitions
  for (const table of tables) {
    const columnNames = table.columns.map(col => col.dbColumn).join(', ');
    schema += `${table.name}(${columnNames})\n`;
    
    // Add comments for status/role values
    for (const comment of table.comments) {
      schema += `-- ${comment}\n`;
    }
    
    // Add special notes for commonly problematic fields
    if (table.name === 'users') {
      schema += '-- NOTE: Use first_name and last_name (with underscores), not firstName/lastName\n';
    }
    if (table.name === 'interviews') {
      schema += '-- NOTE: Use scheduled_by (not interviewer_id), scheduled_date_time (not scheduled_at)\n';
    }
    if (table.name === 'applications') {
      schema += '-- NOTE: Use applied_by (user who applied), applied_at (timestamp), current_stage\n';
    }
    
    schema += '\n';
  }
  
  // Add relationships section
  schema += 'RELATIONSHIPS:\n';
  schema += '- users.organization_id → organizations.id\n';
  schema += '- jobs.organization_id → organizations.id\n';
  schema += '- candidates.organization_id → organizations.id\n';
  schema += '- applications.job_id → jobs.id\n';
  schema += '- applications.candidate_id → candidates.id\n';
  schema += '- applications.applied_by → users.id\n';
  schema += '- interviews.job_id → jobs.id\n';
  schema += '- interviews.candidate_id → candidates.id\n';
  schema += '- interviews.scheduled_by → users.id\n';
  schema += '- job_assignments.job_id → jobs.id\n';
  schema += '- job_assignments.user_id → users.id\n';
  schema += '- candidate_assignments.candidate_id → candidates.id\n';
  schema += '- candidate_assignments.user_id → users.id\n';
  
  return schema;
}

// Fallback compact schema (used if auto-generation fails)
function getFallbackCompactSchema(): string {
  console.log('🤖 AI_REPORT: Using fallback compact schema');
  return `
-- Fallback Compact Database Schema for AIMHi Recruitment AI Reports
-- Used when auto-generation from unified-schema.ts fails

users(id, organization_id, email, first_name, last_name, role, created_at)
-- role: 'super_admin', 'org_admin', 'hiring_manager', 'recruiter', 'interviewer'
-- NOTE: Use first_name and last_name (with underscores), not firstName/lastName

organizations(id, name, created_at)

jobs(id, organization_id, title, department, location, status, source, created_at)
-- status: 'active', 'draft', 'closed', 'paused'

candidates(id, organization_id, name, email, phone, status, source, experience, created_at)
-- status: 'active', 'hired', 'rejected', 'withdrawn'

applications(id, organization_id, job_id, candidate_id, applied_by, status, substatus, current_stage, applied_at, match_percentage, source, notes, created_at)
-- status: 'new', 'screening', 'interview', 'decided'
-- NOTE: Use applied_by (user who applied), applied_at (timestamp), current_stage

interviews(id, organization_id, match_id, job_id, candidate_id, scheduled_by, scheduled_date_time, duration, interview_type, status, meeting_link, notes, created_at)
-- status: 'scheduled', 'completed', 'cancelled'
-- NOTE: Use scheduled_by (not interviewer_id), scheduled_date_time (not scheduled_at)

job_matches(id, organization_id, job_id, candidate_id, match_percentage, match_criteria, created_at)

job_assignments(id, job_id, user_id, role, created_at)
-- role: 'owner', 'assigned', 'viewer'

candidate_assignments(id, candidate_id, user_id, role, created_at)
-- role: 'owner', 'assigned', 'viewer'

RELATIONSHIPS:
- users.organization_id → organizations.id
- jobs.organization_id → organizations.id  
- candidates.organization_id → organizations.id
- applications.job_id → jobs.id
- applications.candidate_id → candidates.id
- applications.applied_by → users.id
- interviews.job_id → jobs.id
- interviews.candidate_id → candidates.id
- interviews.scheduled_by → users.id
- job_assignments.job_id → jobs.id
- job_assignments.user_id → users.id
- candidate_assignments.candidate_id → candidates.id
- candidate_assignments.user_id → users.id
`;
}

export async function generateSQLFromPrompt(
  userPrompt: string, 
  organizationId: number,
  preferredChartType?: string,
  additionalContext?: string
): Promise<{
  sql: string;
  chartType: string;
  interpretation: string;
  confidence: number;
}> {
  console.log('🤖 AI_REPORT: Starting SQL generation for organization:', organizationId);
  console.log('🤖 AI_REPORT: User prompt (length=' + userPrompt.length + '):', userPrompt);
  console.log('🤖 AI_REPORT: User prompt FULL TEXT:', userPrompt); // Explicit full logging
  console.log('🤖 AI_REPORT: Preferred chart type:', preferredChartType);
  console.log('🤖 AI_REPORT: Additional context:', additionalContext);
  console.log('🤖 AI_REPORT: OpenAI API key configured:', !!process.env.OPENAI_API_KEY);
  console.log('🤖 AI_REPORT: OpenAI API key length:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0);
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn('🤖 AI_REPORT: OpenAI API key not configured, using enhanced fallback');
    return generateFallbackSQL(userPrompt, organizationId, preferredChartType);
  }

  try {
    const schema = loadUnifiedSchema();
    console.log('🤖 AI_REPORT: Schema loaded, length:', schema.length);
    
    const aiPrompt = generateAIPrompt(userPrompt, schema, organizationId, additionalContext);
    console.log('🤖 AI_REPORT: Generated AI prompt, length:', aiPrompt.length);
    console.log('🤖 AI_REPORT: Estimated tokens (approx):', Math.ceil(aiPrompt.length / 4)); // Rough token estimate
    console.log('🤖 AI_REPORT: COMPLETE AI PROMPT BEING SENT TO OPENAI:');
    console.log('='.repeat(80));
    console.log(aiPrompt);
    console.log('='.repeat(80));
    
    console.log('🤖 AI_REPORT: Sending request to OpenAI GPT-4o with max_tokens: 5000...');
    const startTime = Date.now();
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // Higher token limit model (128k context)
      messages: [
        {
          role: "system",
          content: "You are an expert SQL analyst. Generate SQL queries from natural language requests. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: aiPrompt
        }
      ],
      max_tokens: 5000, // Restored to original higher limit
      temperature: 0.1,
    });

    const apiResponseTime = Date.now() - startTime;
    console.log('🤖 AI_REPORT: OpenAI API responded in', apiResponseTime, 'ms');

    const responseText = completion.choices[0]?.message?.content?.trim();
    if (!responseText) {
      console.error('🤖 AI_REPORT: Empty response from OpenAI, falling back to rule-based generation');
      return generateFallbackSQL(userPrompt, organizationId, preferredChartType);
    }

    console.log('🤖 AI_REPORT: OpenAI response received, length:', responseText.length);
    console.log('🤖 AI_REPORT: Raw response (first 500 chars):', responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''));
    
    // Parse JSON response with better error handling
    let aiResponse;
    try {
      // First, try to clean the response in case there's extra text
      let cleanedResponse = responseText.trim();
      
      // Remove common prefixes that might be added
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      console.log('🤖 AI_REPORT: Attempting to parse cleaned response:', cleanedResponse.substring(0, 200) + '...');
      aiResponse = JSON.parse(cleanedResponse);
      console.log('🤖 AI_REPORT: Successfully parsed JSON response');
    } catch (parseError) {
      console.error('🤖 AI_REPORT: Failed to parse JSON response:', parseError);
      console.log('🤖 AI_REPORT: Attempting to extract JSON from response...');
      
      // Try to extract JSON from response if it's wrapped in other text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          aiResponse = JSON.parse(jsonMatch[0]);
          console.log('🤖 AI_REPORT: Successfully extracted and parsed JSON');
        } catch (extractError) {
          console.error('🤖 AI_REPORT: Failed to parse extracted JSON:', extractError);
          console.log('🤖 AI_REPORT: Falling back to rule-based generation due to JSON parse error');
          return generateFallbackSQL(userPrompt, organizationId, preferredChartType);
        }
      } else {
        console.error('🤖 AI_REPORT: No JSON found in response, falling back to rule-based generation');
        return generateFallbackSQL(userPrompt, organizationId, preferredChartType);
      }
    }

    // Validate the AI response structure
    if (!aiResponse.sql) {
      console.warn('🤖 AI_REPORT: AI returned null SQL, falling back to rule-based generation');
      return generateFallbackSQL(userPrompt, organizationId, preferredChartType);
    }

    console.log('🤖 AI_REPORT: AI generated SQL:', aiResponse.sql);
    console.log('🤖 AI_REPORT: AI confidence:', aiResponse.confidence);

    return {
      sql: aiResponse.sql,
      chartType: preferredChartType && preferredChartType !== 'auto' ? preferredChartType : aiResponse.chart_type,
      interpretation: aiResponse.interpretation,
      confidence: aiResponse.confidence || 75
    };

  } catch (error) {
    console.error('🤖 AI_REPORT: OpenAI API error:', error);
    if (error instanceof Error) {
      console.error('🤖 AI_REPORT: Error details:', error.message);
      console.error('🤖 AI_REPORT: Error stack:', error.stack);
      
      // Check for specific error types
      if (error.message.includes('context_length_exceeded')) {
        console.error('🤖 AI_REPORT: Token limit exceeded even with GPT-4o - this should not happen with compact schema');
      } else if (error.message.includes('API key')) {
        console.error('🤖 AI_REPORT: API key issue detected');
      } else if (error.message.includes('rate limit')) {
        console.error('🤖 AI_REPORT: Rate limit exceeded');
      }
    }
    console.log('🤖 AI_REPORT: Falling back to enhanced rule-based SQL generation');
    return generateFallbackSQL(userPrompt, organizationId, preferredChartType);
  }
}

// Fallback SQL generation using simple rules - always generates something useful
function generateFallbackSQL(userPrompt: string, organizationId: number, preferredChartType?: string): {
  sql: string;
  chartType: string;
  interpretation: string;
  confidence: number;
} {
  console.log('🤖 AI_REPORT: Using improved fallback SQL generation for prompt:', userPrompt);
  
  const prompt = userPrompt.toLowerCase();
  let sql = '';
  let interpretation = '';
  let chartType = preferredChartType || 'table';
  
  // Check for complex multi-table requests first (before simple patterns)
  const isComplexUserReport = prompt.includes('user') && 
    (prompt.includes('job') || prompt.includes('candidate') || prompt.includes('resume')) &&
    (prompt.includes('assign') || prompt.includes('count') || prompt.includes('pipeline') || prompt.includes('status'));
  
  const isUserJobCandidateReport = prompt.includes('user') && prompt.includes('job') && 
    (prompt.includes('candidate') || prompt.includes('resume'));

  const isSingleTableFormat = prompt.includes('single table') || prompt.includes('table format');
  
  // Enhanced rule-based SQL generation with complex pattern matching first
  if ((isComplexUserReport || isUserJobCandidateReport) && isSingleTableFormat) {
    // Complex user report with job assignments and candidate assignments in single table
    sql = `SELECT 
      CONCAT(u.first_name, ' ', u.last_name) as user_name,
      u.role as user_role,
      COUNT(DISTINCT ja.job_id) as assigned_jobs_count,
      COUNT(DISTINCT ca.candidate_id) as assigned_candidates_count,
      CASE 
        WHEN COUNT(DISTINCT j.id) > 0 THEN GROUP_CONCAT(DISTINCT j.status)
        ELSE 'No jobs assigned'
      END as job_statuses,
      CASE 
        WHEN COUNT(DISTINCT c.id) > 0 THEN GROUP_CONCAT(DISTINCT c.status) 
        ELSE 'No candidates assigned'
      END as candidate_statuses
    FROM users u
    LEFT JOIN job_assignments ja ON u.id = ja.user_id
    LEFT JOIN candidate_assignments ca ON u.id = ca.user_id  
    LEFT JOIN jobs j ON ja.job_id = j.id AND j.organization_id = ${organizationId}
    LEFT JOIN candidates c ON ca.candidate_id = c.id AND c.organization_id = ${organizationId}
    WHERE u.organization_id = ${organizationId}
    GROUP BY u.id, u.first_name, u.last_name, u.role
    ORDER BY assigned_jobs_count DESC, assigned_candidates_count DESC
    LIMIT 100`;
    interpretation = 'Comprehensive single-table user report with job assignments, candidate assignments, roles, and pipeline statuses';
    chartType = 'table';
  }
  else if (prompt.includes('user') || prompt.includes('staff') || prompt.includes('recruiter')) {
    sql = `SELECT 
      role,
      COUNT(*) as user_count
    FROM users 
    WHERE organization_id = ${organizationId} 
    GROUP BY role 
    ORDER BY user_count DESC 
    LIMIT 100`;
    interpretation = 'User distribution by role in the organization';
    chartType = chartType === 'auto' ? 'pie' : chartType;
  }
  else if ((prompt.includes('job') || prompt.includes('position')) && (prompt.includes('application') || prompt.includes('apply'))) {
    sql = `SELECT 
      j.title,
      j.status,
      COUNT(a.id) as application_count
    FROM jobs j 
    LEFT JOIN applications a ON j.id = a.job_id AND a.organization_id = ${organizationId}
    WHERE j.organization_id = ${organizationId} 
    GROUP BY j.id, j.title, j.status 
    ORDER BY application_count DESC 
    LIMIT 100`;
    interpretation = 'Jobs ranked by number of applications received';
    chartType = chartType === 'auto' ? 'bar' : chartType;
  }
  else if (prompt.includes('candidate') || prompt.includes('applicant')) {
    if (prompt.includes('status') || prompt.includes('pipeline')) {
      sql = `SELECT 
        status,
        COUNT(*) as candidate_count
      FROM candidates 
      WHERE organization_id = ${organizationId} 
      GROUP BY status 
      ORDER BY candidate_count DESC 
      LIMIT 100`;
      interpretation = 'Candidate distribution by current status';
      chartType = chartType === 'auto' ? 'pie' : chartType;
    } else {
      sql = `SELECT 
        source,
        COUNT(*) as candidate_count
      FROM candidates 
      WHERE organization_id = ${organizationId} 
      GROUP BY source 
      ORDER BY candidate_count DESC 
      LIMIT 100`;
      interpretation = 'Candidates by recruitment source';
      chartType = chartType === 'auto' ? 'bar' : chartType;
    }
  }
  else if (prompt.includes('application') || prompt.includes('apply')) {
    if (prompt.includes('month') || prompt.includes('time') || prompt.includes('trend')) {
      sql = `SELECT 
        STRFTIME('%Y-%m', created_at) as month,
        COUNT(*) as application_count
      FROM applications 
      WHERE organization_id = ${organizationId} 
      GROUP BY STRFTIME('%Y-%m', created_at)
      ORDER BY month DESC 
      LIMIT 100`;
      interpretation = 'Application trends by month';
      chartType = chartType === 'auto' ? 'line' : chartType;
    } else {
      sql = `SELECT 
        status,
        COUNT(*) as application_count
      FROM applications 
      WHERE organization_id = ${organizationId} 
      GROUP BY status 
      ORDER BY application_count DESC 
      LIMIT 100`;
      interpretation = 'Applications by current status';
      chartType = chartType === 'auto' ? 'pie' : chartType;
    }
  }
  else if (prompt.includes('interview')) {
    sql = `SELECT 
      STRFTIME('%Y-%m', created_at) as month,
      COUNT(*) as interview_count,
      AVG(score) as avg_score
    FROM interviews 
    WHERE organization_id = ${organizationId} 
    GROUP BY STRFTIME('%Y-%m', created_at)
    ORDER BY month DESC 
    LIMIT 100`;
    interpretation = 'Interview activity and average scores by month';
    chartType = chartType === 'auto' ? 'line' : chartType;
  }
  else if (prompt.includes('match') || prompt.includes('ai')) {
    sql = `SELECT 
      CASE 
        WHEN match_percentage >= 80 THEN '80-100%'
        WHEN match_percentage >= 60 THEN '60-79%'
        WHEN match_percentage >= 40 THEN '40-59%'
        ELSE '0-39%'
      END as match_range,
      COUNT(*) as match_count
    FROM job_matches 
    WHERE organization_id = ${organizationId} 
    GROUP BY CASE 
        WHEN match_percentage >= 80 THEN '80-100%'
        WHEN match_percentage >= 60 THEN '60-79%'
        WHEN match_percentage >= 40 THEN '40-59%'
        ELSE '0-39%'
      END
    ORDER BY match_count DESC 
    LIMIT 100`;
    interpretation = 'AI matching score distribution';
    chartType = chartType === 'auto' ? 'pie' : chartType;
  }
  else {
    // Smart default: show overview of recruitment activity
    sql = `SELECT 
      'Active Jobs' as metric,
      COUNT(*) as count
    FROM jobs 
    WHERE organization_id = ${organizationId} AND status = 'active'
    UNION ALL
    SELECT 
      'Total Candidates' as metric,
      COUNT(*) as count
    FROM candidates 
    WHERE organization_id = ${organizationId}
    UNION ALL
    SELECT 
      'Applications This Month' as metric,
      COUNT(*) as count
    FROM applications 
    WHERE organization_id = ${organizationId} 
    AND STRFTIME('%Y-%m', created_at) = STRFTIME('%Y-%m', 'now')
    LIMIT 100`;
    interpretation = 'General recruitment metrics overview for your request: ' + userPrompt;
    chartType = 'table';
  }
  
  console.log('🤖 AI_REPORT: Generated fallback SQL:', sql);
  
  return {
    sql,
    chartType,
    interpretation,
    confidence: 75 // Higher confidence for improved fallback
  };
}
