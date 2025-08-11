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
    // Always use our curated schema for AI to prevent unauthorized table access
    console.log('🤖 AI_REPORT: Using curated schema for AI (security-focused)');
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

// Generate AI prompt for SQL generation with security controls
function generateAIPrompt(userPrompt: string, schema: string, organizationId: number, additionalContext?: string): string {
  const basePrompt = `
You are an expert SQL analyst for a recruitment management system. Generate a SQL query based on the user's natural language request.

DATABASE SCHEMA:
${schema}

CRITICAL SECURITY RULES:
1. ALWAYS include "organization_id = ${organizationId}" in WHERE clause for data security
2. ONLY generate SELECT queries - no INSERT, UPDATE, DELETE, DROP, CREATE, ALTER
3. ONLY use these 5 tables: jobs, candidates, applications, interviews, job_matches
4. DO NOT access organizations, users, teams or any system tables
5. Use appropriate aggregations (COUNT, SUM, AVG) for measures
6. Use proper GROUP BY for dimensions
7. Limit results to 100 rows max using "LIMIT 100"
8. Use meaningful column aliases with "AS"
9. Handle date formatting with STRFTIME when needed
10. Return only valid SQLite syntax

USER REQUEST: "${userPrompt}"
${additionalContext ? `\nADDITIONAL CONTEXT: "${additionalContext}"` : ''}

Please respond with a JSON object containing:
{
  "sql": "your generated SQL query here",
  "chart_type": "table|bar|line|pie (recommend the best visualization)",
  "interpretation": "brief explanation of what the query does",
  "confidence": number (1-100, your confidence in this solution)
}

Only return valid JSON, no other text.`;

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
  
  // Simple rule-based SQL generation with organization security
  if (prompt.includes('job') && prompt.includes('application')) {
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
