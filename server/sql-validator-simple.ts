// SIMPLIFIED SQL Validator - Focus on organization scoping only
// No complex security restrictions - just ensure data isolation

export interface SQLValidationResult {
  isValid: boolean;
  sanitizedSQL: string;
  errors: string[];
  warnings: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// Validate and sanitize AI-generated SQL - SIMPLIFIED VERSION
export async function validateAndSanitizeSQL(
  sql: string, 
  organizationId: number,
  maxRows: number = 100
): Promise<SQLValidationResult> {
  console.log('🔒 SIMPLE_SQL_VALIDATOR: Starting validation for organization:', organizationId);
  console.log('🔒 SIMPLE_SQL_VALIDATOR: Input SQL:', sql);
  
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
      console.error('🔒 SIMPLE_SQL_VALIDATOR: Empty SQL provided');
      return result;
    }

    // 2. Ensure it's a SELECT query only (basic safety)
    const trimmedSQL = sql.trim();
    if (!trimmedSQL.toUpperCase().startsWith('SELECT') && !trimmedSQL.toUpperCase().startsWith('WITH')) {
      result.errors.push('Only SELECT queries and CTEs are allowed');
      result.riskLevel = 'HIGH';
      console.error('🔒 SIMPLE_SQL_VALIDATOR: Non-SELECT query detected');
      return result;
    }

    // 3. Basic dangerous pattern check (minimal)
    const dangerousPatterns = [
      /\bDROP\b/i,
      /\bDELETE\b/i,
      /\bINSERT\b/i,
      /\bUPDATE\b/i,
      /\bCREATE\b/i,
      /\bALTER\b/i,
      /\bTRUNCATE\b/i,
      /\bEXEC\b/i,
      /\bEXECUTE\b/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(sql)) {
        result.errors.push(`Dangerous SQL operation detected: ${pattern.source}`);
        result.riskLevel = 'CRITICAL';
        console.error('🔒 SIMPLE_SQL_VALIDATOR: Dangerous pattern found:', pattern.source);
        return result;
      }
    }

    // 4. Auto-add organization scoping if not present
    let sanitizedSQL = trimmedSQL;
    console.log('🔒 SIMPLE_SQL_VALIDATOR: Checking for organization scoping...');
    
    // Simple organization scoping - add WHERE clause if missing
    if (!sanitizedSQL.toLowerCase().includes('organization_id')) {
      console.log('🔒 SIMPLE_SQL_VALIDATOR: Adding organization scoping automatically');
      
      // Find WHERE clause or add one
      if (sanitizedSQL.toLowerCase().includes(' where ')) {
        // Add to existing WHERE
        sanitizedSQL = sanitizedSQL.replace(/\bWHERE\b/i, `WHERE organization_id = ${organizationId} AND`);
        result.warnings.push(`Added organization filter: organization_id = ${organizationId}`);
      } else {
        // Add new WHERE clause before ORDER BY, GROUP BY, HAVING, or LIMIT
        const insertPosition = sanitizedSQL.search(/\b(ORDER\s+BY|GROUP\s+BY|HAVING|LIMIT)\b/i);
        if (insertPosition !== -1) {
          sanitizedSQL = sanitizedSQL.slice(0, insertPosition) + 
                        `WHERE organization_id = ${organizationId} ` + 
                        sanitizedSQL.slice(insertPosition);
        } else {
          sanitizedSQL += ` WHERE organization_id = ${organizationId}`;
        }
        result.warnings.push(`Added organization filter: organization_id = ${organizationId}`);
      }
    } else {
      console.log('🔒 SIMPLE_SQL_VALIDATOR: Organization scoping already present');
    }

    // 5. Ensure LIMIT clause for performance
    if (!sanitizedSQL.toLowerCase().includes('limit')) {
      sanitizedSQL += ` LIMIT ${maxRows}`;
      result.warnings.push(`Added LIMIT ${maxRows} for performance`);
    } else {
      // Validate existing LIMIT doesn't exceed maxRows
      const limitMatch = sanitizedSQL.match(/LIMIT\s+(\d+)/i);
      if (limitMatch && parseInt(limitMatch[1]) > maxRows) {
        sanitizedSQL = sanitizedSQL.replace(/LIMIT\s+\d+/i, `LIMIT ${maxRows}`);
        result.warnings.push(`Reduced LIMIT to ${maxRows} for performance`);
      }
    }

    // 6. Success
    result.isValid = true;
    result.sanitizedSQL = sanitizedSQL;
    result.riskLevel = 'LOW';
    
    console.log('🔒 SIMPLE_SQL_VALIDATOR: Validation successful');
    console.log('🔒 SIMPLE_SQL_VALIDATOR: Final SQL:', sanitizedSQL);
    console.log('🔒 SIMPLE_SQL_VALIDATOR: Warnings:', result.warnings);
    
    return result;

  } catch (error) {
    console.error('🔒 SIMPLE_SQL_VALIDATOR: Validation error:', error);
    result.errors.push('SQL validation failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    result.riskLevel = 'HIGH';
    return result;
  }
}

// Rate limiter (simplified - no actual limits)
export class RateLimiter {
  constructor(private maxRequests: number, private windowMs: number) {}
  
  checkLimit(userId: string): { allowed: boolean; resetTime?: number } {
    console.log('🔒 SIMPLE_RATE_LIMITER: Rate limiting disabled - allowing all requests');
    return { allowed: true };
  }
}

// Prompt sanitizer (simplified)
export function sanitizePrompt(prompt: string): string {
  console.log('🔒 SIMPLE_PROMPT_SANITIZER: Basic prompt sanitization');
  // Basic cleanup only
  return prompt.trim().slice(0, 2000); // Max 2000 chars
}
