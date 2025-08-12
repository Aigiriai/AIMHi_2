// SQL Validation and Security Service for AI-Generated Queries
// This service provides critical security validation for AI-generated SQL queries
// Minimal Node globals declaration safeguard (remove if @types/node present)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

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
  /\b(INTO OUTFILE|INTO DUMPFILE|LOAD_FILE)\b/i,
  /@@/, // Block SQL Server variable pattern, allow '@' in emails/strings
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
    // 0. Bypass mode for debugging: disable advanced checks behind env flag
    const bypass = String(process?.env?.AI_SQL_VALIDATION_BYPASS || '').toLowerCase() === 'true';
    if (bypass) {
      console.warn('⚠️ SQL_VALIDATOR: BYPASS MODE ENABLED - advanced security checks are disabled');
      const trimmedSQL = sql.trim();
      if (!trimmedSQL.toUpperCase().startsWith('SELECT')) {
        result.errors.push('Bypass mode allows only SELECT queries');
        result.riskLevel = 'CRITICAL';
        return result;
      }
      let sanitizedSQL = trimmedSQL;
      if (!/\bLIMIT\b/i.test(sanitizedSQL)) {
        sanitizedSQL += ` LIMIT ${maxRows}`;
        result.warnings.push(`Added LIMIT ${maxRows} (bypass mode)`);
      }
      result.isValid = true;
      result.sanitizedSQL = sanitizedSQL;
      result.riskLevel = 'MEDIUM';
      return result;
    }

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

    if (hasUnion(sql)) {
      const unionCheck = validateAndSanitizeUnion(sql, organizationId, maxRows);
      if (!unionCheck.isValid) {
        result.errors.push(...unionCheck.errors);
        result.riskLevel = 'HIGH';
        return result;
      }
      sanitizedSQL = unionCheck.sanitizedSQL;
      if (unionCheck.warnings.length) {
        result.warnings.push(...unionCheck.warnings);
      }
    } else {
      // Ensure LIMIT clause for non-UNION queries
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
    }

    // 7. HAVING validation (safe usage)
    console.log('🔒 SQL_VALIDATOR: Validating HAVING clause...');
    const havingValidation = validateHavingClause(sanitizedSQL);
    if (!havingValidation.isValid) {
      result.errors.push(...havingValidation.errors);
      result.riskLevel = 'HIGH';
      return result;
    }

    // 8. Final syntax validation (basic)
    console.log('🔒 SQL_VALIDATOR: Performing syntax validation...');
    const syntaxValidation = validateSQLSyntax(sanitizedSQL);
    if (!syntaxValidation.isValid) {
      result.errors.push(...syntaxValidation.errors);
      result.riskLevel = 'HIGH';
      return result;
    }

    // 9. Success - query is validated
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
    // Collect table->alias mappings and used tables
    const aliasMap: Record<string, string[]> = {}; // table -> [aliases]
    const usedTables: string[] = [];
    const tableWithAliasRegex = /\b(?:FROM|JOIN)\s+([a-zA-Z_][\w]*)(?:\s+(?:AS\s+)?([a-zA-Z_][\w]*))?/gi;
    let m: RegExpExecArray | null;
    while ((m = tableWithAliasRegex.exec(sql)) !== null) {
      const table = m[1].toLowerCase();
      const alias = (m[2] || m[1]).toLowerCase();
      usedTables.push(table);
      aliasMap[table] = aliasMap[table] || [];
      if (!aliasMap[table].includes(alias)) aliasMap[table].push(alias);
    }

    // Which tables require org filter
    const needing = usedTables.filter(t => SECURE_SCHEMA.requiredFilters[t]?.includes('organization_id'));
    if (needing.length === 0) return { isValid: true, errors };

    const upper = sql.toUpperCase();

    // Gather all aliases that have a direct organization_id = <id> predicate
    const aliasHasDirectFilter = new Set<string>();
    const directFilterRegex = /\b([a-zA-Z_][\w]*)\s*\.\s*ORGANIZATION_ID\s*=\s*(\d+)/gi;
    let dm: RegExpExecArray | null;
    while ((dm = directFilterRegex.exec(sql)) !== null) {
      const alias = dm[1].toLowerCase();
      const val = parseInt(dm[2]);
      if (val === organizationId) aliasHasDirectFilter.add(alias);
    }

    // Collect alias equality relations like a.organization_id = b.organization_id
    const aliasEqualPairs: Array<[string, string]> = [];
    const eqRegex = /\b([a-zA-Z_][\w]*)\s*\.\s*ORGANIZATION_ID\s*=\s*([a-zA-Z_][\w]*)\s*\.\s*ORGANIZATION_ID/gi;
    let em: RegExpExecArray | null;
    while ((em = eqRegex.exec(sql)) !== null) {
      aliasEqualPairs.push([em[1].toLowerCase(), em[2].toLowerCase()]);
    }

    // Propagate filter through equality relations (union-find style)
    const findRoot = (a: string, parent: Record<string, string>): string => {
      if (parent[a] !== a) parent[a] = findRoot(parent[a], parent);
      return parent[a];
    };
    const union = (a: string, b: string, parent: Record<string, string>) => {
      const ra = findRoot(a, parent);
      const rb = findRoot(b, parent);
      if (ra !== rb) parent[rb] = ra;
    };

    // Initialize union-find with all aliases
    const allAliases = new Set<string>();
    Object.values(aliasMap).forEach(list => list.forEach(a => allAliases.add(a)));
    const parent: Record<string, string> = {};
    allAliases.forEach(a => (parent[a] = a));
    aliasEqualPairs.forEach(([a, b]) => union(a, b, parent));

    // Any group that contains a directly-filtered alias marks all its members as filtered
    const groupHasDirect: Record<string, boolean> = {};
    allAliases.forEach(a => {
      const r = findRoot(a, parent);
      groupHasDirect[r] = groupHasDirect[r] || aliasHasDirectFilter.has(a);
    });
    const aliasIsEffectivelyFiltered = (alias: string) => groupHasDirect[findRoot(alias, parent)] === true;

    // For each required table, at least one of its aliases must be effectively filtered
    const missing: string[] = [];
    needing.forEach(table => {
      const aliases = aliasMap[table] || [];
      const ok = aliases.some(a => aliasIsEffectivelyFiltered(a));
      if (!ok) missing.push(table);
    });

    if (missing.length) {
      errors.push(`Missing or incorrect organization_id filter. Expected a condition like [alias.]organization_id = ${organizationId} for tables: ${missing.join(', ')}`);
    }

    return { isValid: errors.length === 0, errors };
  } catch (e) {
    return { isValid: false, errors: ['Failed to validate organization filter'] };
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

// ——————————— Guarded UNION support ———————————
function hasUnion(sql: string): boolean {
  return /\bUNION(?:\s+ALL)?\b/i.test(sql);
}

function splitUnionBranches(sql: string): { branches: string[]; connectors: string[] } {
  const connectors: string[] = [];
  const branches: string[] = [];
  let start = 0;
  let depth = 0;
  const upper = sql.toUpperCase();
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      // Check for UNION or UNION ALL at top-level
      if (upper.startsWith('UNION ALL', i)) {
        branches.push(sql.slice(start, i).trim());
        connectors.push('UNION ALL');
        i += 'UNION ALL'.length - 1;
        start = i + 1;
      } else if (upper.startsWith('UNION', i)) {
        branches.push(sql.slice(start, i).trim());
        connectors.push('UNION');
        i += 'UNION'.length - 1;
        start = i + 1;
      }
    }
  }
  branches.push(sql.slice(start).trim());
  return { branches, connectors };
}

function topLevelIndexOf(haystack: string, needle: string): number {
  const upper = haystack.toUpperCase();
  const target = needle.toUpperCase();
  let depth = 0;
  for (let i = 0; i <= upper.length - target.length; i++) {
    const ch = upper[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && upper.startsWith(target, i)) return i;
  }
  return -1;
}

function hasTopLevelOrderBy(segment: string): boolean {
  return topLevelIndexOf(segment, 'ORDER BY') !== -1;
}

function countTopLevelSelectColumns(selectSql: string): number | null {
  const upper = selectSql.toUpperCase();
  const selIdx = topLevelIndexOf(selectSql, 'SELECT');
  if (selIdx === -1) return null;
  let fromIdx = topLevelIndexOf(selectSql, ' FROM ');
  if (fromIdx === -1) {
    // Try 'FROM' without spaces
    fromIdx = topLevelIndexOf(selectSql, 'FROM');
    if (fromIdx === -1) return null;
  }
  const list = selectSql.slice(selIdx + 6, fromIdx);
  if (/\*/.test(list)) return null; // reject star for counting
  // Split by commas at top level
  let depth = 0;
  let count = 1;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (c === ',' && depth === 0) count++;
  }
  return count;
}

function ensureBranchLimit(sql: string, maxRows: number): { sql: string; changed: boolean } {
  const upper = sql.toUpperCase();
  const limitIdx = topLevelIndexOf(sql, 'LIMIT');
  if (limitIdx === -1) {
    return { sql: `${sql} LIMIT ${maxRows}`.trim(), changed: true };
  }
  const match = sql.slice(limitIdx).match(/LIMIT\s+(\d+)/i);
  if (match) {
    const current = parseInt(match[1]);
    if (current > maxRows) {
      return { sql: sql.replace(/LIMIT\s+\d+/i, `LIMIT ${maxRows}`), changed: true };
    }
  }
  return { sql, changed: false };
}

function validateAndSanitizeUnion(sql: string, organizationId: number, maxRows: number): { isValid: boolean; errors: string[]; warnings: string[]; sanitizedSQL: string } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { branches, connectors } = splitUnionBranches(sql);

  if (branches.length < 2) {
    return { isValid: true, errors, warnings, sanitizedSQL: sql };
  }

  // Validate each branch
  let expectedColCount: number | null = null;
  const sanitizedBranches: string[] = [];

  for (let idx = 0; idx < branches.length; idx++) {
    const b = branches[idx];
    const upperB = b.trim().toUpperCase();
    if (!upperB.startsWith('SELECT')) {
      errors.push(`UNION branch ${idx + 1} is not a SELECT`);
      continue;
    }

    // No ORDER BY inside branches
    if (hasTopLevelOrderBy(b)) {
      errors.push(`ORDER BY is not allowed inside UNION branches (move it to the end of the full query)`);
      continue;
    }

    // Table access and org filter per branch
    const tables = validateTableAccess(b);
    if (!tables.isValid) {
      errors.push(...tables.errors.map(e => `Branch ${idx + 1}: ${e}`));
      continue;
    }
    const org = validateOrganizationFilter(b, organizationId);
    if (!org.isValid) {
      errors.push(...org.errors.map(e => `Branch ${idx + 1}: ${e}`));
      continue;
    }

    // Column count parity (reject SELECT *)
    if (/\bSELECT\s+\*/i.test(b)) {
      errors.push(`Branch ${idx + 1}: SELECT * is not allowed in UNION queries`);
      continue;
    }
    const colCount = countTopLevelSelectColumns(b);
    if (colCount == null) {
      errors.push(`Branch ${idx + 1}: Unable to determine column list (avoid SELECT *)`);
      continue;
    }
    if (expectedColCount == null) expectedColCount = colCount;
    else if (colCount !== expectedColCount) {
      errors.push(`Branch ${idx + 1}: Column count ${colCount} does not match expected ${expectedColCount}`);
      continue;
    }

    // Ensure per-branch LIMIT
    const limited = ensureBranchLimit(b, maxRows);
    if (limited.changed) warnings.push(`Branch ${idx + 1}: Applied LIMIT ${maxRows}`);
    sanitizedBranches.push(limited.sql);
  }

  if (errors.length) {
    return { isValid: false, errors, warnings, sanitizedSQL: '' };
  }

  // Reassemble query
  let combined = '';
  for (let i = 0; i < sanitizedBranches.length; i++) {
    combined += `(${sanitizedBranches[i]})`;
    if (i < connectors.length) combined += ` ${connectors[i]} `;
  }

  // Ensure final LIMIT cap
  const upperCombined = combined.toUpperCase();
  if (topLevelIndexOf(combined, 'LIMIT') === -1) {
    combined += ` LIMIT ${maxRows}`;
    warnings.push(`Applied final LIMIT ${maxRows} to UNION result`);
  } else {
    // Cap final limit if larger
    const match = upperCombined.match(/LIMIT\s+(\d+)/i);
    if (match && parseInt(match[1]) > maxRows) {
      combined = combined.replace(/LIMIT\s+\d+/i, `LIMIT ${maxRows}`);
      warnings.push(`Reduced final LIMIT to ${maxRows}`);
    }
  }

  return { isValid: true, errors, warnings, sanitizedSQL: combined };
}

// Validate safe usage of HAVING: require GROUP BY and block subqueries/functions that indicate complex logic
function validateHavingClause(sql: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  try {
    const upper = sql.toUpperCase();
    if (!upper.includes('HAVING')) {
      return { isValid: true, errors };
    }

    // Must have GROUP BY if HAVING present
    if (!upper.includes('GROUP BY')) {
      errors.push('HAVING clause requires GROUP BY');
      return { isValid: false, errors };
    }

    // Extract HAVING section (rough heuristic up to ORDER/LIMIT end)
    const havingIdx = upper.indexOf('HAVING');
    let tail = sql.slice(havingIdx);
    const endIdx = [' ORDER BY', ' LIMIT', ' OFFSET', ' FETCH', ' )'].map(k => upper.indexOf(k, havingIdx)).filter(i => i !== -1);
    if (endIdx.length > 0) {
      const minEnd = Math.min(...endIdx);
      tail = sql.slice(havingIdx, minEnd);
    }

    // Disallow obvious subqueries in HAVING for safety
    if (/HAVING[\s\S]*\(\s*SELECT\b/i.test(tail)) {
      errors.push('Subqueries in HAVING are not allowed');
    }

    return { isValid: errors.length === 0, errors };
  } catch (e) {
    return { isValid: false, errors: ['Failed to validate HAVING clause'] };
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
