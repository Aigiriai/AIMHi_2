// SQL Validation and Security Service for AI-Generated Queries
// This service provides critical security validation for AI-generated SQL queries

interface SQLValidationResult {
  isValid: boolean;
  sanitizedSQL: string;
  errors: string[];
  warnings: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface DatabaseSchema {
  allowedTables: string[];
  allowedColumns: { [table: string]: string[] };
  requiredFilters: { [table: string]: string[] }; // Required WHERE conditions
}

// Define allowed database schema for security
const SECURE_SCHEMA: DatabaseSchema = {
  allowedTables: [
    // Core application tables
    'jobs', 'candidates', 'applications', 'interviews', 'job_matches',
    // User and organization tables
    'organizations', 'users', 'teams', 'team_members',
    // Additional system tables
    'api_keys', 'organization_settings', 'job_board_credentials',
    'report_templates', 'report_executions', 'table_metadata', 'field_metadata'
  ],
  allowedColumns: {
    'jobs': ['id', 'organizationId', 'title', 'status', 'department', 'location', 'source', 'created_at', 'teamId', 'createdBy'],
    'candidates': ['id', 'organizationId', 'name', 'status', 'source', 'experience', 'created_at'],
    'applications': ['id', 'organizationId', 'job_id', 'candidate_id', 'status', 'source', 'applied_month', 'match_percentage', 'created_at'],
    'interviews': ['id', 'organizationId', 'application_id', 'month', 'score', 'feedback', 'created_at'],
    'job_matches': ['id', 'organizationId', 'job_id', 'candidate_id', 'match_percentage', 'created_at'],
    'organizations': ['id', 'name', 'plan', 'created_at'],
    'users': ['id', 'organizationId', 'email', 'role', 'firstName', 'lastName', 'created_at'],
    'teams': ['id', 'organizationId', 'name', 'description', 'created_at'],
    'team_members': ['id', 'team_id', 'user_id', 'role', 'created_at'],
    'api_keys': ['id', 'organizationId', 'name', 'status', 'created_at'],
    'organization_settings': ['id', 'organizationId', 'ai_enabled', 'updated_at'],
    'job_board_credentials': ['id', 'organizationId', 'platform', 'status', 'created_at'],
    'report_templates': ['id', 'organizationId', 'template_name', 'created_at'],
    'report_executions': ['id', 'template_id', 'status', 'created_at'],
    'table_metadata': ['id', 'table_name', 'display_name', 'description'],
    'field_metadata': ['id', 'table_id', 'field_name', 'display_name', 'field_type']
  },
  requiredFilters: {
  // Use snake_case to match actual DB columns
  'jobs': ['organization_id'],
  'candidates': ['organization_id'],
  'applications': ['organization_id'],
  'interviews': ['organization_id'],
  'job_matches': ['organization_id'],
  'users': ['organization_id'],
  'teams': ['organization_id'],
  'api_keys': ['organization_id'],
  'organization_settings': ['organization_id'],
  'job_board_credentials': ['organization_id'],
  'report_templates': ['organization_id'],
    // These tables don't need organization filter
    'organizations': [],
    'team_members': [],
    'report_executions': [],
    'table_metadata': [],
    'field_metadata': []
  }
};

// Dangerous SQL patterns that should be blocked
const DANGEROUS_PATTERNS = [
  /\b(DROP|DELETE|UPDATE|INSERT|CREATE|ALTER|TRUNCATE)\b/i,
  /\b(EXEC|EXECUTE|xp_|sp_)\b/i,
  /(\||&|;|--|\*\/|\/\*)/,
  /\b(UNION|HAVING)\b.*\b(SELECT)\b/i,
  /\b(INTO OUTFILE|INTO DUMPFILE|LOAD_FILE)\b/i,
  /(@@|@)/,
  /\b(INFORMATION_SCHEMA|MYSQL|SQLITE_MASTER)\b/i
];

// Validate and sanitize AI-generated SQL
export async function validateAndSanitizeSQL(
  sql: string, 
  organizationId: number,
  maxRows: number = 100
): Promise<SQLValidationResult> {
  console.log('🔒 SQL_VALIDATOR: Starting validation for organization:', organizationId);
  
  const result: SQLValidationResult = {
    isValid: false,
    sanitizedSQL: '',
    errors: [],
    warnings: [],
    riskLevel: 'LOW'
  };

  try {
    // 1. Basic input validation
    if (!sql || sql.trim().length === 0) {
      result.errors.push('Empty SQL query');
      result.riskLevel = 'HIGH';
      return result;
    }

    // 2. Check for dangerous SQL patterns
    console.log('🔒 SQL_VALIDATOR: Checking for dangerous patterns...');
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(sql)) {
        result.errors.push(`Dangerous SQL pattern detected: ${pattern.source}`);
        result.riskLevel = 'CRITICAL';
        console.error('🔒 SQL_VALIDATOR: CRITICAL - Dangerous pattern found:', pattern.source);
        return result;
      }
    }

    // 3. Ensure it's a SELECT query only
    const trimmedSQL = sql.trim().toUpperCase();
    if (!trimmedSQL.startsWith('SELECT')) {
      result.errors.push('Only SELECT queries are allowed');
      result.riskLevel = 'CRITICAL';
      return result;
    }

    // 4. Parse and validate table access
    console.log('🔒 SQL_VALIDATOR: Validating table access...');
    const tableValidation = validateTableAccess(sql);
    if (!tableValidation.isValid) {
      result.errors.push(...tableValidation.errors);
      result.riskLevel = 'HIGH';
      return result;
    }

    // 5. Ensure organization_id filter is present
    console.log('🔒 SQL_VALIDATOR: Checking organization filter...');
    const orgFilterValidation = validateOrganizationFilter(sql, organizationId);
    if (!orgFilterValidation.isValid) {
      result.errors.push(...orgFilterValidation.errors);
      result.riskLevel = 'CRITICAL';
      return result;
    }

    // 6. Add security enhancements
    console.log('🔒 SQL_VALIDATOR: Adding security enhancements...');
    let sanitizedSQL = sql;

    // Ensure LIMIT clause
    if (!sql.toUpperCase().includes('LIMIT')) {
      sanitizedSQL += ` LIMIT ${maxRows}`;
      result.warnings.push(`Added LIMIT ${maxRows} for performance`);
    } else {
      // Validate existing LIMIT
      const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
      if (limitMatch && parseInt(limitMatch[1]) > maxRows) {
        sanitizedSQL = sql.replace(/LIMIT\s+\d+/i, `LIMIT ${maxRows}`);
        result.warnings.push(`Reduced LIMIT to ${maxRows} for security`);
      }
    }

    // 7. Final syntax validation (basic)
    console.log('🔒 SQL_VALIDATOR: Performing syntax validation...');
    const syntaxValidation = validateSQLSyntax(sanitizedSQL);
    if (!syntaxValidation.isValid) {
      result.errors.push(...syntaxValidation.errors);
      result.riskLevel = 'HIGH';
      return result;
    }

    // 8. Success - query is validated
    result.isValid = true;
    result.sanitizedSQL = sanitizedSQL;
    result.riskLevel = result.warnings.length > 0 ? 'MEDIUM' : 'LOW';
    
    console.log('🔒 SQL_VALIDATOR: Validation successful, risk level:', result.riskLevel);
    return result;

  } catch (error) {
    console.error('🔒 SQL_VALIDATOR: Validation error:', error);
    result.errors.push('SQL validation failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    result.riskLevel = 'CRITICAL';
    return result;
  }
}

// Validate that only allowed tables are accessed
function validateTableAccess(sql: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    // Extract table names from SQL (handle aliases, e.g., "FROM jobs j", "JOIN applications AS a")
    const usedTables: string[] = [];
    const tableRegex = /\b(?:FROM|JOIN)\s+([a-zA-Z_][\w]*)/gi;
    let m: RegExpExecArray | null;
    while ((m = tableRegex.exec(sql)) !== null) {
      usedTables.push(m[1].toLowerCase());
    }

    // Check if all tables are in allowed list
    for (const table of usedTables) {
      if (!SECURE_SCHEMA.allowedTables.includes(table)) {
        errors.push(`Unauthorized table access: ${table}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  } catch (error) {
    return {
      isValid: false,
      errors: ['Failed to validate table access']
    };
  }
}

// Validate that organization_id filter is properly applied where required
function validateOrganizationFilter(sql: string, organizationId: number): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    const upperSQL = sql.toUpperCase();

    // Extract used tables (handle aliases)
    const usedTables: string[] = [];
    const tableRegex = /\b(?:FROM|JOIN)\s+([a-zA-Z_][\w]*)/gi;
    let m: RegExpExecArray | null;
    while ((m = tableRegex.exec(sql)) !== null) {
      usedTables.push(m[1].toLowerCase());
    }

    // Check if any used tables require organization_id filter
    const tablesNeedingOrgFilter = usedTables.filter(table =>
      SECURE_SCHEMA.requiredFilters[table] &&
      SECURE_SCHEMA.requiredFilters[table].includes('organization_id')
    );

    if (tablesNeedingOrgFilter.length > 0) {
      // Must have WHERE clause
      if (!upperSQL.includes('WHERE')) {
        errors.push('Missing WHERE clause with organization_id filter for tables: ' + tablesNeedingOrgFilter.join(', '));
        return { isValid: false, errors };
      }

      // Allow qualified references like alias.organization_id
      const orgFilterPattern = new RegExp(`(?:\b|\.)ORGANIZATION_ID\s*=\s*${organizationId}`, 'i');
      if (!orgFilterPattern.test(sql)) {
        errors.push(`Missing or incorrect organization_id filter. Expected: organization_id = ${organizationId} for tables: ` + tablesNeedingOrgFilter.join(', '));
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  } catch (error) {
    return {
      isValid: false,
      errors: ['Failed to validate organization filter']
    };
  }
}

// Basic SQL syntax validation
function validateSQLSyntax(sql: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    // Basic parentheses matching
    let parenCount = 0;
    for (const char of sql) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (parenCount < 0) {
        errors.push('Unmatched closing parenthesis');
        break;
      }
    }
    if (parenCount > 0) {
      errors.push('Unmatched opening parenthesis');
    }

    // Check for basic SQL structure
    if (!sql.toUpperCase().includes('SELECT')) {
      errors.push('Invalid SQL: Missing SELECT clause');
    }

    // Check for obvious syntax errors
    if (sql.includes(';;') || sql.includes(',,')) {
      errors.push('Invalid SQL syntax: Double delimiters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  } catch (error) {
    return {
      isValid: false,
      errors: ['SQL syntax validation failed']
    };
  }
}

// Sanitize user prompts to remove potentially malicious content
export function sanitizePrompt(prompt: string): { sanitized: string; warnings: string[] } {
  console.log('🔒 PROMPT_SANITIZER: Sanitizing user prompt');
  
  const warnings: string[] = [];
  let sanitized = prompt;

  // Remove potentially dangerous content
  const dangerousPatterns = [
    /\b(DROP|DELETE|UPDATE|INSERT|CREATE|ALTER)\b/gi,
    /(\||&|;|--|\*\/|\/\*)/g,
    /(@@|@\w+)/g,
    /\b(EXEC|EXECUTE|xp_|sp_)\b/gi
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(sanitized)) {
      sanitized = sanitized.replace(pattern, '[FILTERED]');
      warnings.push('Potentially dangerous content filtered from prompt');
    }
  }

  // Limit prompt length
  if (sanitized.length > 2000) {
    sanitized = sanitized.substring(0, 2000);
    warnings.push('Prompt truncated to 2000 characters');
  }

  return { sanitized, warnings };
}

// Rate limiting helper
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) { // 10 requests per minute default
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  checkLimit(identifier: string): { allowed: boolean; resetTime?: number } {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];
    
    // Filter out old requests outside the window
    const recentRequests = userRequests.filter(time => now - time < this.windowMs);
    
    if (recentRequests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...recentRequests);
      const resetTime = oldestRequest + this.windowMs;
      return { allowed: false, resetTime };
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);

    return { allowed: true };
  }
}

export default {
  validateAndSanitizeSQL,
  sanitizePrompt,
  RateLimiter
};
