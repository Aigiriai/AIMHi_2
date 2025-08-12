// Minimal Node globals declaration safeguard (remove if @types/node present)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { validateAndSanitizeSQL, sanitizePrompt } from './sql-validator';

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

// Load the unified schema file securely
function loadUnifiedSchema(): string {
  try {
    // Use expanded curated schema for AI including users table
    console.log('🤖 AI_REPORT: Using expanded curated schema for AI (security-focused)');
    return `
-- Database Schema for AIMHi Recruitment System
-- Tables: jobs, candidates, applications, interviews, job_matches, users, organizations

CREATE TABLE organizations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL, -- 'super_admin', 'admin', 'manager', 'recruiter', 'interviewer'
  status TEXT NOT NULL, -- 'active', 'inactive', 'suspended'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE jobs (
  id INTEGER PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL, -- e.g., 'active', 'draft', 'withdrawn', 'paused', 'filled', 'closed'
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

-- Assignment tables used to link users to jobs/candidates
CREATE TABLE job_assignments (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL, -- owner, assigned, viewer
  assigned_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE candidate_assignments (
  id INTEGER PRIMARY KEY,
  candidate_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL, -- owner, assigned, viewer
  assigned_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;
  } catch (error) {
    console.error('🤖 AI_REPORT: Error loading schema:', error);
    return 'Schema file not available';
  }
}

// Generate AI prompt for SQL generation with enhanced security + reasoning rules
function generateAIPrompt(userPrompt: string, schema: string, organizationId: number, additionalContext?: string): string {
  const basePrompt = `You are an expert secure SQL generator for a recruitment analytics platform. Produce ONE safe SQLite SELECT query (or report inability) from the user's natural language.

CURATED SCHEMA (excerpt):
${schema}

TABLE ROLES & SYNONYMS:
- users (system user accounts; synonyms: user accounts, staff, recruiters)
- candidates (job applicants; synonyms: applicants, talent, prospects)
- jobs (job postings; synonyms: postings, positions, openings)
- applications (candidate job applications; synonyms: submissions)
- interviews (interview events)
- job_matches (AI match scores)
- organizations (org metadata)
- job_assignments (user ↔ job permissions; synonyms: job ownership, job assigned to user)
- candidate_assignments (user ↔ candidate permissions; synonyms: candidate ownership, candidate assigned to user)

ASSIGNMENT LOGIC TIPS:
- "jobs assigned to X" → count rows in job_assignments joined to users (by email/name) and jobs, filtered by organization.
- "applications assigned to X" → count DISTINCT applications where the user is assigned to the job (via job_assignments) OR to the candidate (via candidate_assignments). Enforce organization filters on applications + joined jobs/candidates + users.
 - IMPORTANT: job_assignments and candidate_assignments DO NOT have organization_id. Do NOT add org filters on these tables or their aliases; instead, apply organization scoping on users, jobs, candidates, and applications as appropriate.

STATUS/Pipeline GUIDANCE:
- Job status comes from jobs.status. To get per-user job status, JOIN job_assignments→users→jobs and GROUP BY jobs.status.
- Candidate pipeline states (Interviewing, Offered, etc.) are derived from applications.status. To get per-user candidate pipeline, include candidates assigned directly (candidate_assignments) OR via jobs they applied to that are assigned to the user (job_assignments→applications). When multiple applications exist per candidate, use the latest application by applications.created_at and group by that status.

SECURITY & OUTPUT RULES (MANDATORY):
1. Query MUST be a single SELECT. Never write mutating or DDL statements.
2. Enforce org scoping: Every table with organization_id must include <alias_or_table>.organization_id = ${organizationId} in WHERE (skip tables lacking that column like organizations if appropriate).
3. Limit rows: Add LIMIT 100 unless a smaller explicit LIMIT/TOP N implied (still cap at 100).
4. No SELECT *; choose only required columns.
5. Use COUNT(DISTINCT id) when user explicitly asks for distinct ids; otherwise COUNT(*).
6. JOIN only when selecting or filtering on the joined table's columns.
7. Avoid fabricated columns; only reference columns plausible from schema snippet.
8. If request is for restricted/sensitive data (credentials, passwords) output sql: null with low confidence (<=30) and explanatory interpretation.
9. Additional Context overrides other heuristics when present.
10. If intent cannot be fulfilled, return sql: null with confidence <=30.
11. Response MUST be raw JSON ONLY (no markdown) with keys: sql (string or null), chart_type, interpretation, confidence (integer 1-100).

INTERPRETATION HEURISTICS:
* login/account/role/admin => users table.
* applicant/pipeline/candidate/talent => candidates table.
* people/humans ambiguous unless clarified: lower confidence or use context.
* Time phrases: "last month" => STRFTIME('%Y-%m', created_at) = STRFTIME('%Y-%m', DATE('now','-1 month')); "this month" => STRFTIME('%Y-%m', created_at)=STRFTIME('%Y-%m','now'); "this year" similarly with %Y.
* Chart suggestion: time series → line; ranked categories/top-N → bar; part-to-whole <=8 slices → pie; else table.

EXAMPLES (patterns to follow, adapt aliases as needed):
- Job status by user: SELECT j.status, COUNT(*) FROM job_assignments ja JOIN users u ON u.id=ja.user_id AND u.email='user@org.com' AND u.organization_id=${organizationId} JOIN jobs j ON j.id=ja.job_id AND j.organization_id=${organizationId} GROUP BY j.status LIMIT 100;
- Candidate pipeline by user (latest application per candidate, considering both candidate- and job-based assignments): WITH assigned_candidates AS ( SELECT c.id AS candidate_id FROM candidate_assignments ca JOIN users u ON u.id=ca.user_id AND u.email='user@org.com' AND u.organization_id=${organizationId} JOIN candidates c ON c.id=ca.candidate_id AND c.organization_id=${organizationId} UNION SELECT c2.id FROM job_assignments ja JOIN users u2 ON u2.id=ja.user_id AND u2.email='user@org.com' AND u2.organization_id=${organizationId} JOIN jobs j ON j.id=ja.job_id AND j.organization_id=${organizationId} JOIN applications a ON a.job_id=j.id AND a.organization_id=${organizationId} JOIN candidates c2 ON c2.id=a.candidate_id AND c2.organization_id=${organizationId} ), last_app AS ( SELECT a1.candidate_id, a1.status FROM applications a1 JOIN ( SELECT candidate_id, MAX(created_at) AS max_created FROM applications WHERE organization_id=${organizationId} GROUP BY candidate_id ) lm ON lm.candidate_id=a1.candidate_id AND lm.max_created=a1.created_at WHERE a1.organization_id=${organizationId} ) SELECT COALESCE(la.status,'unknown') AS stage, COUNT(*) AS candidate_count FROM assigned_candidates ac LEFT JOIN last_app la ON la.candidate_id=ac.candidate_id GROUP BY COALESCE(la.status,'unknown') ORDER BY candidate_count DESC LIMIT 100;

USER PROMPT: "${userPrompt}"
${additionalContext ? `ADDITIONAL CONTEXT (highest priority): "${additionalContext}"` : ''}

Return ONLY JSON like:
{"sql":"SELECT ...","chart_type":"bar","interpretation":"...","confidence":85}`;
  return basePrompt;
}

// Call OpenAI to generate SQL with security validation
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
  console.log('🤖 AI_REPORT: Generating SQL for prompt (sanitized)');
  
  // Sanitize user input first
  const { sanitized: cleanPrompt, warnings } = sanitizePrompt(userPrompt);
  if (warnings.length > 0) {
    console.warn('🤖 AI_REPORT: Prompt sanitization warnings:', warnings);
  }
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn('🤖 AI_REPORT: OpenAI API key not configured, using fallback');
    return generateFallbackSQL(cleanPrompt, organizationId, preferredChartType);
  }

  try {
    const schema = loadUnifiedSchema();
    const aiPrompt = generateAIPrompt(cleanPrompt, schema, organizationId, additionalContext);
    
    console.log('🤖 AI_REPORT: Sending request to OpenAI...');
    
    // Add timeout to OpenAI request
    const completionPromise = openai.chat.completions.create({
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

    // Add 30-second timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('OpenAI request timeout')), 30000)
    );

    const completion = await Promise.race([completionPromise, timeoutPromise]) as any;

    const responseText = completion.choices[0]?.message?.content?.trim();
    if (!responseText) {
      throw new Error('Empty response from OpenAI');
    }

    console.log('🤖 AI_REPORT: OpenAI response received (length: ' + responseText.length + ')');
    
    // Parse JSON response with security validation
    let aiResponse;
    try {
      aiResponse = JSON.parse(responseText);
      
      // Validate response structure
      if (!aiResponse.sql || typeof aiResponse.sql !== 'string') {
        throw new Error('Invalid AI response: missing or invalid SQL');
      }
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
      interpretation: aiResponse.interpretation || 'AI-generated query',
      confidence: Math.min(Math.max(aiResponse.confidence || 75, 0), 100) // Clamp between 0-100
    };

  } catch (error) {
    console.error('🤖 AI_REPORT: OpenAI API error:', error);
    console.log('🤖 AI_REPORT: Falling back to rule-based SQL generation');
    return generateFallbackSQL(cleanPrompt, organizationId, preferredChartType);
  }
}

// Secure fallback SQL generation using simple rules
function generateFallbackSQL(userPrompt: string, organizationId: number, preferredChartType?: string): {
  sql: string;
  chartType: string;
  interpretation: string;
  confidence: number;
} {
  console.log('🤖 AI_REPORT: Using secure fallback SQL generation');
  
  const prompt = userPrompt.toLowerCase();
  let sql = '';
  let interpretation = '';
  let chartType = preferredChartType || 'table';

  // Helper: extract email-like token (between quotes or raw)
  const emailRegex = /"([^"]+@[^\s"]+)"|'([^'\s]+@[^\s']+)'|\b([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})\b/;
  const emailMatch = userPrompt.match(emailRegex);
  const rawEmail = (emailMatch && (emailMatch[1] || emailMatch[2] || emailMatch[3])) || '';
  const email = rawEmail.replace(/'/g, "''"); // basic SQL escape for single quote
  
  // Simple rule-based SQL generation with organization security
  // Assignment-driven queries
  if ((prompt.includes('assigned to') || prompt.includes('assignment') || prompt.includes('assigned')) && email) {
    sql = `SELECT 
  -- Jobs directly assigned to the user
  (
    SELECT COUNT(*)
    FROM job_assignments ja
    JOIN users u ON u.id = ja.user_id
    JOIN jobs j ON j.id = ja.job_id
    WHERE u.email = '${email}'
      AND u.organization_id = ${organizationId}
      AND j.organization_id = ${organizationId}
  ) AS jobs_assigned,
  -- Applications where the user is assigned to the job OR the candidate
  (
    SELECT COUNT(DISTINCT a.id)
    FROM applications a
    LEFT JOIN jobs j ON j.id = a.job_id AND j.organization_id = ${organizationId}
    LEFT JOIN job_assignments ja ON ja.job_id = j.id
    LEFT JOIN candidates c ON c.id = a.candidate_id AND c.organization_id = ${organizationId}
    LEFT JOIN candidate_assignments ca ON ca.candidate_id = c.id
    JOIN users u ON u.email = '${email}' AND u.organization_id = ${organizationId}
    WHERE a.organization_id = ${organizationId}
      AND (
        (ja.user_id = u.id AND j.id IS NOT NULL)
        OR (ca.user_id = u.id AND c.id IS NOT NULL)
      )
  ) AS applications_assigned
LIMIT 1`;
    interpretation = `Counts of jobs and applications assigned to ${email} (via job or candidate assignments)`;
    chartType = 'table';
  }
  // Status breakdown for jobs assigned to a user
  else if ((prompt.includes('job') && prompt.includes('status')) && email) {
    sql = `SELECT 
  j.status AS job_status,
  COUNT(*) AS count
FROM job_assignments ja
JOIN users u ON u.id = ja.user_id AND u.email = '${email}' AND u.organization_id = ${organizationId}
JOIN jobs j ON j.id = ja.job_id AND j.organization_id = ${organizationId}
GROUP BY j.status
ORDER BY count DESC
LIMIT 100`;
    interpretation = `Job status breakdown for items assigned to ${email}`;
    chartType = chartType === 'auto' ? 'bar' : chartType;
  }
  // Status/pipeline breakdown for candidates assigned to a user
  else if ((prompt.includes('candidate') && (prompt.includes('status') || prompt.includes('stage') || prompt.includes('pipeline'))) && email) {
    sql = `WITH assigned_candidates AS (
  -- Candidates directly assigned to the user
  SELECT c.id AS candidate_id
  FROM candidate_assignments ca
  JOIN users u ON u.id = ca.user_id AND u.email = '${email}' AND u.organization_id = ${organizationId}
  JOIN candidates c ON c.id = ca.candidate_id AND c.organization_id = ${organizationId}
  UNION
  -- Candidates linked via applications to jobs assigned to the user
  SELECT c2.id AS candidate_id
  FROM job_assignments ja
  JOIN users u2 ON u2.id = ja.user_id AND u2.email = '${email}' AND u2.organization_id = ${organizationId}
  JOIN jobs j ON j.id = ja.job_id AND j.organization_id = ${organizationId}
  JOIN applications a ON a.job_id = j.id AND a.organization_id = ${organizationId}
  JOIN candidates c2 ON c2.id = a.candidate_id AND c2.organization_id = ${organizationId}
), last_app AS (
  SELECT a1.candidate_id, a1.status
  FROM applications a1
  JOIN (
    SELECT candidate_id, MAX(created_at) AS max_created
    FROM applications
    WHERE organization_id = ${organizationId}
    GROUP BY candidate_id
  ) lm ON lm.candidate_id = a1.candidate_id AND lm.max_created = a1.created_at
  WHERE a1.organization_id = ${organizationId}
)
SELECT COALESCE(la.status, 'unknown') AS pipeline_stage,
       COUNT(*) AS candidate_count
FROM assigned_candidates ac
LEFT JOIN last_app la ON la.candidate_id = ac.candidate_id
GROUP BY COALESCE(la.status, 'unknown')
ORDER BY candidate_count DESC
LIMIT 100`;
    interpretation = `Candidate pipeline/status breakdown for people assigned to ${email}`;
    chartType = chartType === 'auto' ? 'bar' : chartType;
  }
  else 
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
    // Default secure fallback query
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
