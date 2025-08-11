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

// Generate AI prompt for SQL generation (enhanced version)
function generateAIPrompt(
  userPrompt: string,
  schema: string,
  organizationId: number,
  additionalContext?: string
): string {
  // IMPORTANT: Keep this prompt concise but explicit; model output must be raw JSON only.
  const basePrompt = `You are an expert SQL generator for a recruitment analytics platform. Produce ONE safe SQLite SELECT query (or report inability) from the user's natural language.

CONTEXT SCHEMA (excerpt):
${schema}

TABLE ROLES & SYNONYMS:
- users (system user accounts; synonyms: user accounts, staff, recruiters)
- candidates (job applicants; synonyms: applicants, talent, prospects)
- jobs (job postings; synonyms: postings, positions, openings)
- applications (candidate job applications; synonyms: submissions)
- interviews (interview events)
- job_matches (AI match scores)
- organizations (organization metadata)

INTERPRETATION RULES:
1. Disambiguate terms:
   * If prompt mentions login / account / role / admin → users table.
   * If prompt mentions applicant / pipeline / candidate / talent → candidates table.
   * "People" is ambiguous → lower confidence unless clarified by context.
2. For "how many <thing> ids" or "distinct <thing>" use COUNT(DISTINCT <id_column>). Otherwise use COUNT(*).
3. Only JOIN when fields from the joined table are selected or filtered.
4. Never SELECT *; return only minimal necessary columns.
5. Use meaningful snake_case aliases (no spaces). Avoid quoting unless required.
6. Push filters into WHERE; only use HAVING for aggregated predicates.
7. Always add organization scoping: <table>.organization_id = ${organizationId} for every table that has organization_id (skip tables without the column).
8. Enforce LIMIT <= 100 (cap any larger user request to 100). If user asks TOP N, apply LIMIT N (still capped at 100).
9. Time phrases heuristics:
   * "last month" → data where STRFTIME('%Y-%m', created_at) = STRFTIME('%Y-%m', DATE('now','-1 month'))
   * "this month" → STRFTIME('%Y-%m', created_at) = STRFTIME('%Y-%m','now')
   * "this year" → STRFTIME('%Y', created_at) = STRFTIME('%Y','now')
10. Chart selection logic:
    * Time series (date/month sequence) → line
    * Ranked comparison / top-N categories → bar
    * Part-to-whole with <= 8 categories → pie
    * Otherwise → table
11. If the user requests sensitive or unavailable data (e.g. password hashes) return sql: null, low confidence (<=30) and explain in interpretation.
12. Additional Context OVERRIDES heuristic inference.
13. If intent cannot be satisfied with available tables, return sql: null, confidence <= 30.
14. Output MUST be raw JSON ONLY (no Markdown, no prose) with keys: sql (string or null), chart_type, interpretation, confidence (integer 1-100).
15. Do NOT fabricate columns; only use those plausibly present given the schema excerpt.

USER PROMPT: "${userPrompt}"
${additionalContext ? `ADDITIONAL CONTEXT (highest priority): "${additionalContext}"` : ''}

Return ONLY JSON like:
{"sql":"SELECT ...","chart_type":"bar","interpretation":"...","confidence":85}`;

  return basePrompt;
}

// Load the unified schema file
function loadUnifiedSchema(): string {
  try {
    const schemaPath = path.join(process.cwd(), 'unified-schema.ts');
    if (fs.existsSync(schemaPath)) {
      return fs.readFileSync(schemaPath, 'utf8');
    }
    
    // Fallback to a basic schema if file doesn't exist
    console.warn('🤖 AI_REPORT: unified-schema.ts not found, using fallback schema');
    return `
-- Database Schema for AIMHi Recruitment System
-- Tables: jobs, candidates, applications, interviews, job_matches

CREATE TABLE jobs (
  id INTEGER PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL, -- 'active', 'draft', 'closed'
  department TEXT,
  location TEXT,
  source TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE candidates (
  id INTEGER PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL, -- 'active', 'hired', 'rejected'
  source TEXT, -- 'referral', 'linkedin', 'website'
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
  applied_month TEXT, -- YYYY-MM format
  match_percentage REAL, -- AI matching score 0-100
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE interviews (
  id INTEGER PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  application_id INTEGER REFERENCES applications(id),
  month TEXT, -- YYYY-MM format
  score REAL, -- interview score 0-10
  feedback TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE job_matches (
  id INTEGER PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  job_id INTEGER REFERENCES jobs(id),
  candidate_id INTEGER REFERENCES candidates(id),
  match_percentage REAL, -- AI matching score 0-100
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;
  } catch (error) {
    console.error('🤖 AI_REPORT: Error loading schema:', error);
    return 'Schema file not available';
  }
}

// Call OpenAI to generate SQL
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
  console.log('🤖 AI_REPORT: Generating SQL for prompt:', userPrompt);
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn('🤖 AI_REPORT: OpenAI API key not configured, using fallback');
    // Fallback logic for when OpenAI is not available
    return generateFallbackSQL(userPrompt, organizationId, preferredChartType);
  }

  try {
    const schema = loadUnifiedSchema();
    const aiPrompt = generateAIPrompt(userPrompt, schema, organizationId, additionalContext);
    
    console.log('🤖 AI_REPORT: Sending request to OpenAI...');
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
      max_tokens: 500,
      temperature: 0.1, // Low temperature for consistent results
    });

    const responseText = completion.choices[0]?.message?.content?.trim();
    if (!responseText) {
      throw new Error('Empty response from OpenAI');
    }

    console.log('🤖 AI_REPORT: OpenAI response received (length: ' + responseText.length + ')');
    
    // Parse JSON response
    let aiResponse;
    try {
      aiResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error('🤖 AI_REPORT: Failed to parse JSON response:', parseError);
      // Try to extract JSON from response if it's wrapped in other text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from AI');
      }
    }

    return {
      sql: aiResponse.sql,
      chartType: preferredChartType && preferredChartType !== 'auto' ? preferredChartType : aiResponse.chart_type,
      interpretation: aiResponse.interpretation,
      confidence: aiResponse.confidence || 75
    };

  } catch (error) {
    console.error('🤖 AI_REPORT: OpenAI API error:', error);
    console.log('🤖 AI_REPORT: Falling back to rule-based SQL generation');
    return generateFallbackSQL(userPrompt, organizationId, preferredChartType);
  }
}

// Fallback SQL generation using simple rules
function generateFallbackSQL(userPrompt: string, organizationId: number, preferredChartType?: string): {
  sql: string;
  chartType: string;
  interpretation: string;
  confidence: number;
} {
  console.log('🤖 AI_REPORT: Using fallback SQL generation');
  
  const prompt = userPrompt.toLowerCase();
  let sql = '';
  let interpretation = '';
  let chartType = preferredChartType || 'table';
  
  // Simple rule-based SQL generation with better table detection
  if (prompt.includes('user') && (prompt.includes('count') || prompt.includes('how many'))) {
    sql = `SELECT 
      COUNT(*) as total_users
    FROM users 
    WHERE organization_id = ${organizationId} 
    LIMIT 100`;
    interpretation = 'Total count of system users in the organization';
    chartType = 'table';
  }
  else if (prompt.includes('job') && prompt.includes('application')) {
    sql = `SELECT 
      j.title,
      j.status,
      COUNT(a.id) as application_count
    FROM jobs j 
    LEFT JOIN applications a ON j.id = a.job_id 
    WHERE j.organization_id = ${organizationId} 
    GROUP BY j.id, j.title, j.status 
    ORDER BY application_count DESC 
    LIMIT 100`;
    interpretation = 'Job titles with their application counts';
    chartType = chartType === 'auto' ? 'bar' : chartType;
  }
  else if (prompt.includes('candidate') && prompt.includes('status')) {
    sql = `SELECT 
      status,
      COUNT(*) as candidate_count
    FROM candidates 
    WHERE organization_id = ${organizationId} 
    GROUP BY status 
    ORDER BY candidate_count DESC 
    LIMIT 100`;
    interpretation = 'Candidate distribution by status';
    chartType = chartType === 'auto' ? 'pie' : chartType;
  }
  else if (prompt.includes('application') && prompt.includes('month')) {
    sql = `SELECT 
      applied_month,
      COUNT(*) as application_count
    FROM applications 
    WHERE organization_id = ${organizationId} AND applied_month IS NOT NULL
    GROUP BY applied_month 
    ORDER BY applied_month 
    LIMIT 100`;
    interpretation = 'Applications over time by month';
    chartType = chartType === 'auto' ? 'line' : chartType;
  }
  else {
    // Default fallback query
    sql = `SELECT 
      'Active Jobs' as category,
      COUNT(*) as count
    FROM jobs 
    WHERE organization_id = ${organizationId} AND status = 'active'
    LIMIT 100`;
    interpretation = 'General job statistics';
    chartType = 'table';
  }
  
  return {
    sql,
    chartType,
    interpretation,
    confidence: 60 // Lower confidence for fallback
  };
}
