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
{"sql":"SELECT u.name, u.role, COUNT(ja.job_id) as job_count FROM users u LEFT JOIN job_assignments ja ON u.id = ja.user_id WHERE u.organization_id = ${organizationId} GROUP BY u.id LIMIT 100","chart_type":"table","interpretation":"Brief explanation","confidence":95}`;

  return basePrompt;
}

// Load the unified schema file - use all available tables
function loadUnifiedSchema(): string {
  // Use compact schema optimized for AI prompts instead of the full Drizzle schema
  console.log('🤖 AI_REPORT: Using optimized compact schema for AI prompts');
  return `
-- Compact Database Schema for AIMHi Recruitment AI Reports
-- Optimized for token efficiency while maintaining completeness

users(id, organization_id, email, name, role, created_at)
-- role: 'super_admin', 'org_admin', 'hiring_manager', 'recruiter', 'interviewer'

organizations(id, name, created_at)

jobs(id, organization_id, title, department, location, status, source, created_at)
-- status: 'active', 'draft', 'closed', 'paused'

candidates(id, organization_id, name, email, phone, status, source, experience, created_at)
-- status: 'active', 'hired', 'rejected', 'withdrawn'

applications(id, organization_id, job_id, candidate_id, status, source, applied_month, match_percentage, created_at)
-- status: 'applied', 'screening', 'interview', 'offer', 'hired', 'rejected'

interviews(id, organization_id, application_id, job_id, candidate_id, interviewer_id, scheduled_at, completed_at, score, status, feedback, created_at)
-- status: 'scheduled', 'completed', 'cancelled'

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
- interviews.job_id → jobs.id
- interviews.candidate_id → candidates.id
- interviews.interviewer_id → users.id
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
  console.log('🤖 AI_REPORT: User prompt:', userPrompt);
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
      u.name as user_name,
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
    GROUP BY u.id, u.name, u.role
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
