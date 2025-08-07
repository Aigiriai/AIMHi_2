import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';
import { getSQLiteDB } from './unified-db-manager';
import { eq, and, sql } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';
const SALT_ROUNDS = 12;

// Database connection helper - using unified database manager
async function getDB() {
  const { db } = await getSQLiteDB();
  const schema = await import('../unified-schema');
  return { db, schema };
}

export interface AuthenticatedUser {
  id: number;
  organizationId: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: any;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
  organizationId?: number;
}

// Generate JWT token
export function generateToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Authentication middleware
export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authId = Math.random().toString(36).substr(2, 9);
  const authStart = Date.now();
  
  console.log(`🔐 AUTH[${authId}]: ============= AUTHENTICATION START =============`);
  console.log(`🔐 AUTH[${authId}]: Request details:`, {
    method: (req as any).method,
    path: (req as any).path,
    originalUrl: (req as any).originalUrl,
    ip: (req as any).ip,
    userAgent: (req as any).headers?.['user-agent']?.substring(0, 50) + '...'
  });
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log(`🔐 AUTH[${authId}]: Authorization header present:`, !!authHeader);
  console.log(`🔐 AUTH[${authId}]: Token extracted:`, !!token);

  if (!token) {
    console.log(`❌ AUTH[${authId}]: No token provided - returning 401`);
    console.log(`🔐 AUTH[${authId}]: ============= AUTHENTICATION FAILED =============`);
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    console.log(`🔐 AUTH[${authId}]: Verifying JWT token...`);
    const verifyStart = Date.now();
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const verifyTime = Date.now() - verifyStart;
    console.log(`🔐 AUTH[${authId}]: Token decoded for user ${decoded.userId} in ${verifyTime}ms`);
    console.log(`🔐 AUTH[${authId}]: Token payload:`, {
      userId: decoded.userId,
      iat: decoded.iat,
      exp: decoded.exp,
      expiresIn: new Date(decoded.exp * 1000).toISOString()
    });
    
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries) {
      try {
        console.log(`🔐 AUTH[${authId}]: Getting database connection (attempt ${retryCount + 1}/${maxRetries + 1})...`);
        const dbStart = Date.now();
        const { db, schema } = await getDB();
        const dbTime = Date.now() - dbStart;
        console.log(`🔐 AUTH[${authId}]: Database connection obtained in ${dbTime}ms (attempt ${retryCount + 1})`);
        
        // Fetch fresh user data
        console.log(`🔐 AUTH[${authId}]: Querying user data for user ${decoded.userId}...`);
        const userStart = Date.now();
        const user = await db
          .select()
          .from(schema.users)
          .where(and(
            eq(schema.users.id, decoded.userId),
            eq(schema.users.isActive, 1)
          ))
          .limit(1);
        const userTime = Date.now() - userStart;

        console.log(`🔐 AUTH[${authId}]: User query returned ${user.length} results for user ${decoded.userId} in ${userTime}ms`);
        
        if (!user.length) {
          console.log(`❌ AUTH[${authId}]: No active user found for ID ${decoded.userId} - returning 401`);
          console.log(`🔐 AUTH[${authId}]: ============= AUTHENTICATION FAILED =============`);
          return res.status(401).json({ message: 'Invalid token' });
        }
        
        // Success - break out of retry loop
        const userData = {
          id: user[0].id,
          organizationId: user[0].organizationId,
          email: user[0].email,
          firstName: user[0].firstName,
          lastName: user[0].lastName,
          role: user[0].role,
          permissions: user[0].permissions,
        };
        
        req.user = userData;
        req.organizationId = user[0].organizationId;
        
        const totalTime = Date.now() - authStart;
        console.log(`✅ AUTH[${authId}]: Authentication successful for user ${user[0].id} (${user[0].role}) in ${totalTime}ms`);
        console.log(`🔐 AUTH[${authId}]: User data:`, {
          id: userData.id,
          email: userData.email,
          role: userData.role,
          organizationId: userData.organizationId
        });
        console.log(`🔐 AUTH[${authId}]: ============= AUTHENTICATION SUCCESS =============`);
        return next();
        
      } catch (dbError: any) {
        retryCount++;
        console.error(`❌ AUTH[${authId}]: DB ERROR (attempt ${retryCount}/${maxRetries + 1}):`, {
          error: dbError?.message || 'Unknown error',
          type: dbError?.constructor?.name || 'Unknown',
          stack: dbError?.stack?.split('\n').slice(0, 3)
        });
        
        if (retryCount > maxRetries) {
          console.error(`❌ AUTH[${authId}]: All database retry attempts failed - throwing error`);
          throw dbError; // Final attempt failed
        }
        
        // Reset connection and try again
        const { resetDatabase } = await import('./unified-db-manager');
        resetDatabase();
        console.log(`🔄 AUTH[${authId}]: Resetting DB connection for retry ${retryCount}`);
        
        console.log(`🔄 AUTH[${authId}]: Waiting 100ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  } catch (error) {
    console.error(`🔐 AUTH ERROR:`, error);
    if (error.name === 'JsonWebTokenError') {
      console.error(`🔐 JWT ERROR: Token verification failed - ${error.message}`);
    } else if (error.name === 'TokenExpiredError') {
      console.error(`🔐 JWT ERROR: Token expired - ${error.message}`);
    } else {
      console.error(`🔐 DB ERROR: Database query failed - ${error.message}`);
    }
    return res.status(403).json({ message: 'Invalid token' });
  }
}

// Role-based authorization middleware
export function requireRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
}

// Organization isolation middleware
export function requireOrganization(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.organizationId) {
    return res.status(400).json({ message: 'Organization context required' });
  }
  next();
}

// Audit logging middleware
export async function logAuditEvent(
  req: AuthRequest,
  action: string,
  resourceType?: string,
  resourceId?: number,
  details?: any
) {
  if (!req.user) return;

  try {
    // Temporarily disable audit logging to avoid schema issues
    // TODO: Fix audit logging schema synchronization
    console.log('Audit event (disabled):', {
      organizationId: req.user.organizationId,
      userId: req.user.id,
      action,
      resourceType,
      resourceId,
      details
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

// Super admin check
export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ message: 'Super admin access required' });
  }
  next();
}

// Manager hierarchy check
export async function canAccessUser(currentUserId: number, targetUserId: number): Promise<boolean> {
  if (currentUserId === targetUserId) return true;

  try {
    const { db, schema } = await getDB();
    
    // Check if currentUser is a manager of targetUser (direct or indirect)
    const targetUser = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, targetUserId))
      .limit(1);

    if (!targetUser.length) return false;

    let managerId = targetUser[0].managerId;
    while (managerId) {
      if (managerId === currentUserId) return true;

      const manager = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, managerId))
        .limit(1);

      if (!manager.length) break;
      managerId = manager[0].managerId;
    }

    return false;
  } catch (error) {
    console.error('Error checking user access:', error);
    return false;
  }
}