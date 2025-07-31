import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';
// Get the SQLite database instance
async function getSQLite() {
  const { initializeSQLiteDatabase } = await import('./init-database');
  return await initializeSQLiteDatabase();
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';
const SALT_ROUNDS = 12;

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
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const sqlite = await getSQLite();
    
    // Fetch fresh user data using raw SQL
    const user = sqlite.prepare(`
      SELECT id, organization_id, email, first_name, last_name, role, permissions
      FROM users 
      WHERE id = ?
      LIMIT 1
    `).get(decoded.userId) as any;

    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = {
      id: user.id,
      organizationId: user.organization_id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      permissions: user.permissions,
    };
    req.organizationId = user.organization_id;

    // Update last login (skip for SQLite compatibility)
    // await db
    //   .update(users)
    //   .set({ lastLoginAt: new Date() })
    //   .where(eq(users.id, user[0].id));

    next();
  } catch (error) {
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

// Manager hierarchy check (simplified implementation)
export async function canAccessUser(currentUserId: number, targetUserId: number): Promise<boolean> {
  if (currentUserId === targetUserId) return true;

  try {
    const sqlite = await getSQLite();
    
    // Check if currentUser is a manager of targetUser (simplified)
    const targetUser = sqlite.prepare(`
      SELECT manager_id FROM users WHERE id = ?
    `).get(targetUserId) as any;

    if (!targetUser) return false;

    // Simple hierarchy check (can be enhanced with recursive logic)
    if (targetUser.manager_id === currentUserId) return true;

    return false;
  } catch (error) {
    console.error('Error checking user access:', error);
    return false;
  }
}