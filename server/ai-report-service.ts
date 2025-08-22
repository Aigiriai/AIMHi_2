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

// Generate AI prompt for SQL generation (simplified version)
function generateAIPrompt(
  userPrompt: string,
  schema: string,
  organizationId: number,
  additionalContext?: string
): string {
  const basePrompt = `You are an SQL generator for a recruitment platform. Generate a safe SQLite SELECT query from the user's request.

DATABASE TABLES:
${schema}

SIMPLE RULES:
1. Always add: WHERE organization_id = ${organizationId} 
2. Always add: LIMIT 100
3. Use simple table aliases (j, c, a, i for jobs, candidates, applications, interviews)
4. For time requests: use created_at column with date functions
5. Choose appropriate chart type: 'bar' for comparisons, 'pie' for distributions, 'line' for time series, 'table' for everything else

USER REQUEST: "${userPrompt}"
${additionalContext ? `CONTEXT: "${additionalContext}"` : ''}

Return JSON only:
{"sql":"SELECT ...","chart_type":"bar","interpretation":"Brief explanation","confidence":85}`;

  return basePrompt;
}

// Load the unified schema file - use all available tables
function loadUnifiedSchema(): string {
  try {
    const schemaPath = path.join(process.cwd(), 'unified-schema.ts');
    if (fs.existsSync(schemaPath)) {
      console.log('🤖 AI_REPORT: Loading unified schema from file');
      return fs.readFileSync(schemaPath, 'utf8');
    }
    
    // Enhanced fallback schema with all main tables
    console.warn('🤖 AI_REPORT: unified-schema.ts not found, using comprehensive fallback schema');
    return `
-- Comprehensive Database Schema for AIMHi Recruitment System
-- All available tables for reporting

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- 'super_admin', 'org_admin', 'hiring_manager', 'recruiter', 'interviewer'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE organizations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE jobs (
  id INTEGER PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  department TEXT,
  location TEXT,
  status TEXT NOT NULL, -- 'active', 'draft', 'closed', 'paused'
  source TEXT, -- 'internal', 'website', 'linkedin'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE candidates (
  id INTEGER PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL, -- 'active', 'hired', 'rejected', 'withdrawn'
  source TEXT, -- 'referral', 'linkedin', 'website', 'agency'
  experience INTEGER, -- years of experience
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE applications (
  id INTEGER PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  job_id INTEGER REFERENCES jobs(id),
  candidate_id INTEGER REFERENCES candidates(id),
  status TEXT NOT NULL, -- 'applied', 'screening', 'interview', 'offer', 'hired', 'rejected'
  source TEXT, -- how application was received
  applied_month TEXT, -- YYYY-MM format for easier grouping
  match_percentage REAL, -- AI matching score 0-100
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE interviews (
  id INTEGER PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  application_id INTEGER REFERENCES applications(id),
  job_id INTEGER REFERENCES jobs(id),
  candidate_id INTEGER REFERENCES candidates(id),
  interviewer_id INTEGER REFERENCES users(id),
  scheduled_at DATETIME,
  completed_at DATETIME,
  score REAL, -- interview score 0-10
  status TEXT, -- 'scheduled', 'completed', 'cancelled'
  feedback TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE job_matches (
  id INTEGER PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  job_id INTEGER REFERENCES jobs(id),
  candidate_id INTEGER REFERENCES candidates(id),
  match_percentage REAL, -- AI matching score 0-100
  match_criteria TEXT, -- JSON string with detailed match analysis
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE job_assignments (
  id INTEGER PRIMARY KEY,
  job_id INTEGER REFERENCES jobs(id),
  user_id INTEGER REFERENCES users(id),
  role TEXT, -- 'owner', 'assigned', 'viewer'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE candidate_assignments (
  id INTEGER PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  user_id INTEGER REFERENCES users(id),
  role TEXT, -- 'owner', 'assigned', 'viewer'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;
  } catch (error) {
    console.error('🤖 AI_REPORT: Error loading schema:', error);
    return 'Schema loading failed - using minimal fallback';
  }
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
  console.log('🤖 AI_REPORT: User prompt:', userPrompt);
  console.log('🤖 AI_REPORT: Preferred chart type:', preferredChartType);
  console.log('🤖 AI_REPORT: Additional context:', additionalContext);
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn('🤖 AI_REPORT: OpenAI API key not configured, using enhanced fallback');
    return generateFallbackSQL(userPrompt, organizationId, preferredChartType);
  }

  try {
    const schema = loadUnifiedSchema();
    console.log('🤖 AI_REPORT: Schema loaded, length:', schema.length);
    
    const aiPrompt = generateAIPrompt(userPrompt, schema, organizationId, additionalContext);
    console.log('🤖 AI_REPORT: Generated AI prompt, length:', aiPrompt.length);
    
    console.log('🤖 AI_REPORT: Sending request to OpenAI with max_tokens: 5000...');
    const startTime = Date.now();
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
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
      max_tokens: 5000,
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
    console.log('🤖 AI_REPORT: Raw response:', responseText.substring(0, 200) + '...');
    
    // Parse JSON response with better error handling
    let aiResponse;
    try {
      aiResponse = JSON.parse(responseText);
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
  
  // Enhanced rule-based SQL generation with better pattern matching
  if (prompt.includes('user') || prompt.includes('staff') || prompt.includes('recruiter')) {
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
