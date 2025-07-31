import { Router } from 'express';
import { z } from 'zod';
import { initializeSQLiteDatabase } from './init-database';
import { generateToken, verifyPassword, hashPassword, authenticateToken, requireSuperAdmin, type AuthRequest } from './auth';
import { organizationManager } from './organization-manager';

const router = Router();

// SQLite database helper for raw queries
async function getSQLite() {
  return await initializeSQLiteDatabase();
}

// Login schema - Organization identification is now mandatory
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  organizationName: z.string().min(1, "Organization name is required"),
});

// Organization creation schema
const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
  domain: z.string().optional(),
  plan: z.enum(['trial', 'basic', 'professional', 'enterprise']).default('trial'),
  adminEmail: z.string().email(),
  adminFirstName: z.string().min(1).max(50),
  adminLastName: z.string().min(1).max(50),
  adminPassword: z.string().min(8),
});

// User profile update schema
const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

// User update schema (for admin updating other users)
const updateUserSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.enum(['super_admin', 'org_admin', 'manager', 'team_lead', 'recruiter']).optional(),
  isActive: z.boolean().optional(),
});

// POST /auth/login - Authenticate user
router.post('/login', async (req, res) => {
  try {
    const { email, password, organizationName } = loginSchema.parse(req.body);

    const sqlite = await getSQLite();
    
    // Find user by email AND organization name using raw SQL join
    const result = sqlite.prepare(`
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.role, u.permissions, 
        u.organization_id, u.password_hash,
        o.id as org_id, o.name as organization_name, o.domain, o.plan, o.status
      FROM users u
      INNER JOIN organizations o ON u.organization_id = o.id
      WHERE u.email = ? 
        AND u.is_active = 1
        AND o.status = 'active'
        AND o.name = ?
      LIMIT 1
    `).get(email, organizationName) as any;

    if (!result) {
      return res.status(401).json({ message: 'Invalid credentials or organization' });
    }

    // Verify password using bcrypt verification
    const isValidPassword = await verifyPassword(password, result.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken({
      id: result.id,
      organizationId: result.organization_id,
      email: result.email,
      firstName: result.first_name,
      lastName: result.last_name,
      role: result.role,
      permissions: result.permissions,
    });

    res.json({
      token,
      user: {
        id: result.id,
        email: result.email,
        firstName: result.first_name,
        lastName: result.last_name,
        role: result.role,
        organizationId: result.organization_id,
        organizationName: result.organization_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Invalid login data', errors: error.errors });
    } else {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
});

// GET /auth/me - Get current user info
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const sqlite = await getSQLite();
    
    // Get user with organization info using raw SQL join
    const result = sqlite.prepare(`
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.role, u.permissions, 
        u.organization_id,
        o.name as organization_name, o.domain, o.plan, o.status, 
        o.timezone, o.date_format, o.currency
      FROM users u
      INNER JOIN organizations o ON u.organization_id = o.id
      WHERE u.id = ? AND u.is_active = 1
      LIMIT 1
    `).get(req.user!.id) as any;

    if (!result) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: result.id,
      email: result.email,
      firstName: result.first_name,
      lastName: result.last_name,
      role: result.role,
      permissions: JSON.parse(result.permissions || '{}'),
      organizationId: result.organization_id,
      organizationName: result.organization_name,
      organizationPlan: result.plan,
      organization: {
        id: result.organization_id,
        name: result.organization_name,
        domain: result.domain,
        plan: result.plan,
        status: result.status,
        timezone: result.timezone,
        dateFormat: result.date_format,
        currency: result.currency
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /auth/profile - Update user profile
router.put('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const sqlite = await getSQLite();
    const userId = req.user!.id;
    const updateData = updateProfileSchema.parse(req.body);

    // Check if email is being changed and if it already exists
    if (updateData.email) {
      const existingUser = sqlite.prepare(`
        SELECT id FROM users 
        WHERE email = ? AND id != ? AND organization_id = ?
        LIMIT 1
      `).get(updateData.email, userId, req.user!.organizationId);

      if (existingUser) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    
    if (updateData.firstName) {
      updateFields.push('first_name = ?');
      updateValues.push(updateData.firstName);
    }
    if (updateData.lastName) {
      updateFields.push('last_name = ?');
      updateValues.push(updateData.lastName);
    }
    if (updateData.email) {
      updateFields.push('email = ?');
      updateValues.push(updateData.email);
    }
    if (updateData.phone) {
      updateFields.push('phone = ?');
      updateValues.push(updateData.phone);
    }
    
    updateFields.push('updated_at = ?');
    updateValues.push(new Date().toISOString());
    updateValues.push(userId);

    // Update user profile
    sqlite.prepare(`
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `).run(...updateValues);

    // Get updated user data
    const updatedUser = sqlite.prepare(`
      SELECT id, email, first_name, last_name, phone 
      FROM users 
      WHERE id = ?
    `).get(userId) as any;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        email: updatedUser.email,
        phone: updatedUser.phone,
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Invalid profile data', errors: error.errors });
    } else {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
});

// GET /auth/organizations - Get all organizations (Super Admin only)
router.get('/organizations', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const sqlite = await getSQLite();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Get paginated organizations
    const organizations = sqlite.prepare(`
      SELECT * FROM organizations 
      ORDER BY id DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    // Get total count
    const totalResult = sqlite.prepare('SELECT COUNT(*) as count FROM organizations').get() as any;
    const totalOrganizations = totalResult.count;

    // Get additional stats
    const statsResult = sqlite.prepare(`
      SELECT 
        o.id,
        o.name,
        o.description,
        COUNT(u.id) as user_count
      FROM organizations o
      LEFT JOIN users u ON o.id = u.organization_id
      WHERE o.id IN (${organizations.map(() => '?').join(',')})
      GROUP BY o.id, o.name, o.description
    `).all(organizations.map(org => (org as any).id));

    const organizationsWithStats = organizations.map(org => {
      const stats = statsResult.find(s => (s as any).id === (org as any).id);
      return {
        ...(org as any),
        userCount: stats ? (stats as any).user_count : 0
      };
    });

    res.json({
      organizations: organizationsWithStats,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalOrganizations / limit),
        totalOrganizations,
        hasNext: page * limit < totalOrganizations,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /auth/organizations/:id/credentials - Get organization admin credentials (Super Admin only)
router.get('/organizations/:id/credentials', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const sqlite = await getSQLite();
    const orgId = parseInt(req.params.id);

    const credentials = sqlite.prepare(`
      SELECT email, temporary_password, is_password_changed
      FROM organization_credentials 
      WHERE organization_id = ?
      LIMIT 1
    `).get(orgId) as any;

    if (!credentials) {
      return res.status(404).json({ message: 'Organization credentials not found' });
    }

    res.json({
      email: credentials.email,
      temporaryPassword: credentials.temporary_password,
      isPasswordChanged: Boolean(credentials.is_password_changed)
    });
  } catch (error) {
    console.error('Get credentials error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /auth/organizations - Create new organization (Super Admin only)
router.post('/organizations', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const orgData = createOrgSchema.parse(req.body);
    const result = await organizationManager.createOrganization(orgData);
    
    res.status(201).json({
      message: 'Organization created successfully',
      organization: result.organization,
      adminUser: result.adminUser
    });
  } catch (error) {
    console.error('Create organization error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Invalid organization data', errors: error.errors });
    } else {
      res.status(500).json({ message: 'Failed to create organization' });
    }
  }
});

// DELETE /auth/organizations/:id - Delete organization (Super Admin only)
router.delete('/organizations/:id', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const sqlite = await getSQLite();
    const orgId = parseInt(req.params.id);
    const { transferUsersToOrg, deleteUserData } = req.body;

    // CRITICAL SAFETY CHECK: Never allow deletion of super admin organization
    const targetOrg = sqlite.prepare('SELECT * FROM organizations WHERE id = ? LIMIT 1').get(orgId);

    if (!targetOrg) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    if ((targetOrg as any).domain === 'platform.aimhi.app' || (targetOrg as any).domain === 'aimhi.app') {
      return res.status(403).json({ message: 'Cannot delete super admin organization' });
    }

    // CRITICAL SAFETY CHECK: Never allow deletion of super admin user
    const superAdminsInOrg = sqlite.prepare(`
      SELECT * FROM users 
      WHERE organization_id = ? AND role = 'super_admin'
    `).all(orgId);

    if (superAdminsInOrg.length > 0) {
      return res.status(403).json({ message: 'Cannot delete organization containing super admin users' });
    }

    // Check if organization has active users
    const activeUsers = sqlite.prepare(`
      SELECT id FROM users 
      WHERE organization_id = ? AND is_active = 1
    `).all(orgId);

    if (activeUsers.length > 0 && !transferUsersToOrg && !deleteUserData) {
      return res.status(400).json({ 
        message: 'Organization has active users. Please specify how to handle them.',
        userCount: activeUsers.length,
        options: {
          transferUsersToOrg: 'Transfer users to another organization',
          deleteUserData: 'Permanently delete all user data (dangerous)'
        }
      });
    }

    // Delete organization and related data
    sqlite.prepare('DELETE FROM organization_credentials WHERE organization_id = ?').run(orgId);
    sqlite.prepare('DELETE FROM usage_metrics WHERE organization_id = ?').run(orgId);
    sqlite.prepare('DELETE FROM users WHERE organization_id = ?').run(orgId);
    sqlite.prepare('DELETE FROM organizations WHERE id = ?').run(orgId);

    res.json({ message: 'Organization deleted successfully' });
  } catch (error) {
    console.error('Delete organization error:', error);
    res.status(500).json({ message: 'Failed to delete organization' });
  }
});

// POST /auth/invite-organization-admin - Create organization and invite admin (Super Admin only)
router.post('/invite-organization-admin', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { organizationName, website, industry, size, firstName, lastName, email, phone } = req.body;

    // Validate required fields
    if (!organizationName || !firstName || !lastName || !email) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Generate a secure temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + '123!';

    // Create organization data
    const orgData = {
      name: organizationName,
      domain: website || '',
      plan: 'starter' as const,
      adminEmail: email,
      adminFirstName: firstName,
      adminLastName: lastName,
      adminPassword: tempPassword,
    };

    console.log(`👤 ORG ADMIN CREATION: About to create organization admin via invite-organization-admin endpoint`);
    console.log(`📊 ORG ADMIN CREATION: NODE_ENV = ${process.env.NODE_ENV || 'undefined'}`);
    console.log(`📧 ORG ADMIN CREATION: Admin email = ${email}`);
    console.log(`🏢 ORG ADMIN CREATION: Organization name = ${organizationName}`);
    
    const result = await organizationManager.createOrganization(orgData);
    
    console.log(`✅ ORG ADMIN CREATION: Organization admin created successfully with ID = ${result.adminUser.id}`);

    // Store credentials in database for persistent access (converted to raw SQL)
    const { initializeSQLiteDatabase } = await import('./init-database');
    const sqlite = await initializeSQLiteDatabase();
    sqlite.prepare(`
      INSERT INTO organization_credentials (
        organization_id, admin_user_id, email, temporary_password, is_password_changed, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      result.organization.id,
      result.adminUser.id,
      email,
      tempPassword,
      0, // is_password_changed
      new Date().toISOString(),
      new Date().toISOString()
    );

    res.status(200).json({
      message: 'Organization created and admin invited successfully',
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        subdomain: result.organization.subdomain,
      },
      adminUser: {
        id: result.adminUser.id,
        email: result.adminUser.email,
        firstName: result.adminUser.firstName,
        lastName: result.adminUser.lastName,
      },
      temporaryCredentials: {
        email: email,
        password: tempPassword,
        loginUrl: `${req.protocol}://${req.get('host')}/login`,
        note: 'Please share these credentials with the organization administrator. They should change their password after first login.'
      }
    });
  } catch (error) {
    console.error('Invite organization admin error:', error);
    res.status(500).json({ message: 'Failed to create organization and invite admin' });
  }
});

export default router;