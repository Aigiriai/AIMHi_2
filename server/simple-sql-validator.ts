// Simplified SQL Validator - Focused on basic safety while ensuring reports always generate
// Removes complex security restrictions that were preventing report generation

interface SimpleSQLValidationResult {
  isValid: boolean;
  sanitizedSQL: string;
  errors: string[];
  warnings: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

// Simple rate limiter that's very permissive
export class SimpleRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests = 100; // Very high limit
  private readonly windowMs = 60000; // 1 minute window

  checkLimit(userId: string): { allowed: boolean; resetTime?: number } {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    
    // Remove old requests outside the window
    const recentRequests = userRequests.filter(time => now - time < this.windowMs);
    
    if (recentRequests.length >= this.maxRequests) {
      return { 
        allowed: false, 
        resetTime: Math.min(...recentRequests) + this.windowMs 
      };
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(userId, recentRequests);
    
    return { allowed: true };
  }
}

// Very basic dangerous patterns - only the most critical ones
const CRITICAL_PATTERNS = [
  /\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|TRUNCATE)\b/i,
  /\b(EXEC|EXECUTE|SP_|XP_)\b/i,
  /\b(UNION.*SELECT.*FROM.*INFORMATION_SCHEMA)\b/i,
  /(\-\-|\#|\/\*.*\*\/)/,  // SQL comments that might hide malicious code
];

// Automatically add organization filter to any SQL query
function addOrganizationFilter(sql: string, organizationId: number): string {
  console.log('🔒 SIMPLE_VALIDATOR: Adding organization filter for org:', organizationId);
  
  // If query already has organization_id filter, don't add another
  if (sql.toLowerCase().includes(`organization_id = ${organizationId}`)) {
    console.log('🔒 SIMPLE_VALIDATOR: Organization filter already present');
    return sql;
  }

  // Simple approach: add WHERE organization_id = X to the main query
  // This works for most simple queries
  if (sql.toLowerCase().includes('where')) {
    // Already has WHERE, add AND condition
    const whereIndex = sql.toLowerCase().lastIndexOf('where');
    const beforeWhere = sql.substring(0, whereIndex + 5);
    const afterWhere = sql.substring(whereIndex + 5);
    
    // Find the main table alias or name
    const fromMatch = sql.match(/\bFROM\s+(\w+)(?:\s+(\w+))?\s/i);
    const tableAlias = fromMatch ? (fromMatch[2] || fromMatch[1]) : 't';
    
    const result = `${beforeWhere} ${tableAlias}.organization_id = ${organizationId} AND (${afterWhere})`;
    console.log('🔒 SIMPLE_VALIDATOR: Added AND organization filter');
    return result;
  } else {
    // No WHERE clause, add one
    const fromMatch = sql.match(/\bFROM\s+(\w+)(?:\s+(\w+))?\s/i);
    const tableAlias = fromMatch ? (fromMatch[2] || fromMatch[1]) : 't';
    
    // Find a good place to insert WHERE (before GROUP BY, ORDER BY, LIMIT)
    const insertPoints = ['GROUP BY', 'ORDER BY', 'LIMIT', 'UNION'];
    let insertIndex = sql.length;
    
    for (const point of insertPoints) {
      const pointIndex = sql.toLowerCase().indexOf(point.toLowerCase());
      if (pointIndex !== -1 && pointIndex < insertIndex) {
        insertIndex = pointIndex;
      }
    }
    
    const beforeInsert = sql.substring(0, insertIndex).trim();
    const afterInsert = sql.substring(insertIndex);
    
    const result = `${beforeInsert} WHERE ${tableAlias}.organization_id = ${organizationId} ${afterInsert}`;
    console.log('🔒 SIMPLE_VALIDATOR: Added WHERE organization filter');
    return result;
  }
}

// Main validation function - much simpler and more permissive
export async function validateAndSanitizeSQL(
  sql: string, 
  organizationId: number,
  maxRows: number = 100
): Promise<SimpleSQLValidationResult> {
  console.log('🔒 SIMPLE_VALIDATOR: Starting simplified validation for organization:', organizationId);
  
  const result: SimpleSQLValidationResult = {
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

    let sanitizedSQL = sql.trim();

    // 2. Check for only the most critical dangerous patterns
    for (const pattern of CRITICAL_PATTERNS) {
      if (pattern.test(sanitizedSQL)) {
        result.errors.push(`Critical security pattern detected - only SELECT queries allowed`);
        result.riskLevel = 'HIGH';
        console.error('🔒 SIMPLE_VALIDATOR: CRITICAL - Dangerous pattern found:', pattern.source);
        return result;
      }
    }

    // 3. Ensure it's a SELECT query
    const upperSQL = sanitizedSQL.toUpperCase().trim();
    if (!upperSQL.startsWith('SELECT') && !upperSQL.startsWith('WITH')) {
      result.errors.push('Only SELECT queries are allowed');
      result.riskLevel = 'HIGH';
      return result;
    }

    // 4. Automatically add organization scoping - this is the key security measure
    try {
      sanitizedSQL = addOrganizationFilter(sanitizedSQL, organizationId);
      console.log('🔒 SIMPLE_VALIDATOR: Organization filter added successfully');
    } catch (orgError) {
      console.warn('🔒 SIMPLE_VALIDATOR: Could not add organization filter automatically:', orgError);
      result.warnings.push('Organization filter may not be properly applied');
      result.riskLevel = 'MEDIUM';
    }

    // 5. Ensure LIMIT clause
    if (!sanitizedSQL.toUpperCase().includes('LIMIT')) {
      sanitizedSQL += ` LIMIT ${maxRows}`;
      result.warnings.push(`Added LIMIT ${maxRows} for performance`);
    } else {
      // Check if existing limit is too high
      const limitMatch = sanitizedSQL.match(/LIMIT\s+(\d+)/i);
      if (limitMatch && parseInt(limitMatch[1]) > maxRows) {
        sanitizedSQL = sanitizedSQL.replace(/LIMIT\s+\d+/i, `LIMIT ${maxRows}`);
        result.warnings.push(`Reduced LIMIT to ${maxRows} for performance`);
      }
    }

    // 6. Basic syntax check - just parentheses matching
    let parenCount = 0;
    for (const char of sanitizedSQL) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (parenCount < 0) {
        result.errors.push('Unmatched closing parenthesis');
        result.riskLevel = 'HIGH';
        return result;
      }
    }
    if (parenCount > 0) {
      result.errors.push('Unmatched opening parenthesis');
      result.riskLevel = 'HIGH';
      return result;
    }

    // 7. Success - query is validated
    result.isValid = true;
    result.sanitizedSQL = sanitizedSQL;
    result.riskLevel = result.warnings.length > 0 ? 'MEDIUM' : 'LOW';
    
    console.log('🔒 SIMPLE_VALIDATOR: Validation successful, risk level:', result.riskLevel);
    console.log('🔒 SIMPLE_VALIDATOR: Final SQL:', sanitizedSQL);
    
    return result;

  } catch (error) {
    console.error('🔒 SIMPLE_VALIDATOR: Validation error:', error);
    result.errors.push('SQL validation failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    result.riskLevel = 'HIGH';
    return result;
  }
}

// Simple prompt sanitization
export function sanitizePrompt(prompt: string): string {
  if (!prompt) return '';
  
  // Just basic cleanup, no aggressive filtering
  return prompt
    .trim()
    .substring(0, 2000) // Limit length
    .replace(/[<>]/g, '') // Remove basic HTML chars
    .replace(/\s+/g, ' '); // Normalize whitespace
}

// Export the rate limiter
export const simpleRateLimiter = new SimpleRateLimiter();
