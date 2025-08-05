import { Router } from 'express';
import { eq, and, ne, inArray, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getSQLiteDB } from './sqlite-db';
import { users, organizations, auditLogs, organizationCredentials, userTeams, teams, jobs, candidates, jobMatches, interviews, usageMetrics } from './sqlite-schema';

// Database connection helper
async function getDB() {
  const { db } = await getSQLiteDB();
  return db;
}

// SQLite database helper for raw queries
async function getSQLite() {
  const { sqlite } = await getSQLiteDB();
  return sqlite;
}
import { generateToken, verifyPassword, hashPassword, authenticateToken, requireSuperAdmin, logAuditEvent, type AuthRequest } from './auth';
import { organizationManager } from './organization-manager';
import { backupService } from './backup-integration';

const router = Router();

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
  role: z.enum(['recruiter', 'team_lead', 'manager', 'org_admin']).optional(),
});

// Password change schema
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      "Password must contain uppercase, lowercase, number, and special character"),
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, organizationName } = loginSchema.parse(req.body);

    // Find user by email AND organization name (both required)
    const whereConditions = and(
      eq(users.email, email),
      eq(users.isActive, 1), // SQLite uses 1 for true, 0 for false
      eq(organizations.status, 'active'),
      eq(organizations.name, organizationName)
    );

    const db = await getDB();
    const result = await db.select({
      user: users,
      organization: organizations,
    }).from(users)
      .innerJoin(organizations, eq(users.organizationId, organizations.id))
      .where(whereConditions)
      .limit(1);

    if (!result.length) {
      return res.status(401).json({ message: 'Invalid credentials or organization' });
    }

    const { user, organization } = result[0];

    // Verify password - check temporary password first if it exists
    let isValidPassword = false;
    if (user.hasTemporaryPassword && user.temporaryPassword) {
      // For temporary passwords, compare directly (plain text)
      isValidPassword = password === user.temporaryPassword;
    } else {
      // For regular passwords, use bcrypt verification
      isValidPassword = await verifyPassword(password, user.passwordHash);
    }
    
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      permissions: user.permissions,
    });

    // Update last login (skip for SQLite compatibility)
    // await db.update(users)
    //   .set({ lastLoginAt: new Date().toISOString() })
    //   .where(eq(users.id, user.id));

    // Log audit event (skip for SQLite compatibility)
    // await db.insert(auditLogs).values({
    //   organizationId: user.organizationId,
    //   userId: user.id,
    //   action: 'user_login',
    //   details: JSON.stringify({ email, organizationName }),
    //   ipAddress: req.ip || 'unknown',
    //   userAgent: req.get('User-Agent') || 'unknown',
    //   createdAt: new Date().toISOString(),
    // });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: organization.name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(400).json({ message: 'Invalid request' });
  }
});

// GET /auth/me - Get current user info
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const db = await getDB();
    const user = await db.select({
      user: users,
      organization: organizations,
    }).from(users)
      .innerJoin(organizations, eq(users.organizationId, organizations.id))
      .where(eq(users.id, req.user!.id))
      .limit(1);

    if (!user.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { user: userData, organization } = user[0];

    // Set cache control headers to prevent caching issues
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      id: userData.id,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      phone: userData.phone,
      role: userData.role,
      permissions: userData.permissions,
      settings: userData.settings,
      organizationId: userData.organizationId,
      organizationName: organization.name,
      organizationPlan: organization.plan,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /auth/profile - Update user profile
router.put('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const db = await getDB();
    const userId = req.user!.id;
    const updateData = updateProfileSchema.parse(req.body);

    // Check if email is being changed and if it already exists
    if (updateData.email) {
      const existingUser = await db.select()
        .from(users)
        .where(and(
          eq(users.email, updateData.email),
          ne(users.id, userId)
        ))
        .limit(1);

      if (existingUser.length > 0) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    // Update user profile
    const [updatedUser] = await db.update(users)
      .set({
        firstName: updateData.firstName,
        lastName: updateData.lastName,
        email: updateData.email,
        phone: updateData.phone,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, userId))
      .returning();

    await logAuditEvent(req, 'profile_updated', 'user', userId, {
      updatedFields: Object.keys(updateData),
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        phone: updatedUser.phone,
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Invalid profile data', errors: error.errors });
    } else {
      res.status(500).json({ message: 'Failed to update profile' });
    }
  }
});

// PUT /auth/change-password - Change user password
router.put('/change-password', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const db = await getDB();
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const userId = req.user!.id;

    // Get current user data
    const [currentUser] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    let isCurrentPasswordValid = false;
    if (currentUser.hasTemporaryPassword && currentUser.temporaryPassword) {
      // For temporary passwords, compare directly
      isCurrentPasswordValid = currentPassword === currentUser.temporaryPassword;
    } else {
      // For regular passwords, use bcrypt verification
      isCurrentPasswordValid = await verifyPassword(currentPassword, currentUser.passwordHash);
    }

    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // Update password and clear temporary password flags
    await db.update(users)
      .set({
        passwordHash: hashedNewPassword,
        hasTemporaryPassword: false,
        temporaryPassword: null,
        updatedAt: new Date().toISOString()
      })
      .where(eq(users.id, userId));

    await logAuditEvent(req, 'password_changed', 'user', userId, {
      userId: userId
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Password change error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Invalid password data', errors: error.errors });
    } else {
      res.status(500).json({ message: 'Failed to change password' });
    }
  }
});

// POST /auth/organizations - Create new organization (Super Admin only)
router.post('/organizations', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const db = await getDB();
    const orgData = createOrgSchema.parse(req.body);

    const result = await organizationManager.createOrganization(orgData);

    await logAuditEvent(req, 'organization_created', 'organization', result.organization.id, {
      organizationName: result.organization.name,
      adminEmail: orgData.adminEmail,
    });

    res.status(201).json({
      message: 'Organization created successfully',
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        subdomain: result.organization.subdomain,
        plan: result.organization.plan,
      },
      adminUser: {
        id: result.adminUser.id,
        email: result.adminUser.email,
        firstName: result.adminUser.firstName,
        lastName: result.adminUser.lastName,
      },
      teams: result.teams.map(team => ({
        id: team.id,
        name: team.name,
        description: team.description,
      })),
    });
  } catch (error) {
    console.error('Create organization error:', error);
    res.status(400).json({ message: 'Invalid request' });
  }
});

// GET /auth/organizations - List all organizations (Super Admin only)
router.get('/organizations', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const db = await getDB();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Get total count first
    const [totalResult] = await db.select({ count: sql<number>`count(*)` })
      .from(organizations);
    const totalOrgs = totalResult.count;

    const orgs = await db.select()
      .from(organizations)
      .orderBy(desc(organizations.id))
      .limit(limit)
      .offset(offset);

    const orgStats = await Promise.all(
      orgs.map(async (org) => {
        const stats = await organizationManager.getOrganizationWithStats(org.id);
        
        // Get stored credentials for this organization
        const [credentials] = await db.select()
          .from(organizationCredentials)
          .where(eq(organizationCredentials.organizationId, org.id))
          .limit(1);

        return {
          ...stats,
          temporaryCredentials: credentials ? {
            email: credentials.email,
            password: credentials.temporaryPassword,
            loginUrl: `${req.protocol}://${req.get('host')}/login`,
            isPasswordChanged: credentials.isPasswordChanged
          } : null
        };
      })
    );

    res.json({
      organizations: orgStats,
      pagination: {
        page,
        limit,
        total: totalOrgs,
        totalPages: Math.ceil(totalOrgs / limit),
        hasNext: page < Math.ceil(totalOrgs / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('List organizations error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /auth/organizations/:id - Update organization details (Super Admin only)
router.put('/organizations/:id', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const db = await getDB();
    const organizationId = parseInt(req.params.id);
    const updateData = z.object({
      name: z.string().optional(),
      domain: z.string().optional(),
      timezone: z.string().optional(),
      dateFormat: z.string().optional(),
      currency: z.string().optional(),
    }).parse(req.body);

    // Update organization directly in the organizations table
    const [updatedOrg] = await db
      .update(organizations)
      .set({
        name: updateData.name,
        domain: updateData.domain,
        timezone: updateData.timezone,
        dateFormat: updateData.dateFormat,
        currency: updateData.currency,
        updatedAt: new Date().toISOString()
      })
      .where(eq(organizations.id, organizationId))
      .returning();

    if (!updatedOrg) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    await logAuditEvent(req, 'organization_updated', 'organization', organizationId, {
      updatedFields: Object.keys(updateData),
    });

    res.json({
      success: true,
      message: 'Organization updated successfully',
      organization: updatedOrg
    });
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ message: 'Failed to update organization' });
  }
});

// DELETE /auth/organizations/:id - Delete organization (Super Admin only)
router.delete('/organizations/:id', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const db = await getDB();
    const orgId = parseInt(req.params.id);
    const { transferUsersToOrg, deleteUserData = false } = req.body;
    
    if (isNaN(orgId)) {
      return res.status(400).json({ message: 'Invalid organization ID' });
    }

    // CRITICAL SAFETY CHECK: Never allow deletion of super admin organization
    const [targetOrg] = await db.select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!targetOrg) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    if (targetOrg.domain === 'platform.aimhi.app') {
      return res.status(403).json({ message: 'Cannot delete super admin organization' });
    }

    // Check if the requesting user belongs to this organization
    const isUserDeletingOwnOrg = req.user!.organizationId === orgId;

    // CRITICAL SAFETY CHECK: Never allow deletion of super admin user
    const superAdminsInOrg = await db.select()
      .from(users)
      .where(and(
        eq(users.organizationId, orgId),
        eq(users.role, 'super_admin')
      ));

    if (superAdminsInOrg.length > 0) {
      return res.status(403).json({ message: 'Cannot delete organization containing super admin users' });
    }

    // Check if organization has active users
    const activeUsers = await db.select()
      .from(users)
      .where(and(
        eq(users.organizationId, orgId),
        eq(users.isActive, true)
      ));

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

    if (isUserDeletingOwnOrg) {
      // Log the user out first by invalidating their session
      res.clearCookie('auth-token');
      // Note: In a full implementation, you'd also invalidate the JWT in a blacklist
    }

    // Delete in proper order to avoid foreign key constraint violations
    console.log(`🗑️ ORGANIZATION DELETE: Starting deletion of organization ${orgId}`);
    
    // Get users in the organization first (needed for foreign key cleanup)
    const orgUsers = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.organizationId, orgId));
    
    const userIds = orgUsers.map(user => user.id);
    console.log(`🗑️ ORGANIZATION DELETE: Found ${userIds.length} users to handle`);

    // Get jobs in the organization (needed for foreign key cleanup)
    const orgJobs = await db.select({ id: jobs.id })
      .from(jobs)
      .where(eq(jobs.organizationId, orgId));
    
    const jobIds = orgJobs.map(job => job.id);
    console.log(`🗑️ ORGANIZATION DELETE: Found ${jobIds.length} jobs to delete`);

    // Get candidates in the organization (needed for foreign key cleanup)
    const orgCandidates = await db.select({ id: candidates.id })
      .from(candidates)
      .where(eq(candidates.organizationId, orgId));
    
    const candidateIds = orgCandidates.map(candidate => candidate.id);
    console.log(`🗑️ ORGANIZATION DELETE: Found ${candidateIds.length} candidates to delete`);

    // Get direct SQLite access for raw queries
    const sqlite = await getSQLite();
    
    // 1. Delete applications first (references org, jobs, candidates, users - NO CASCADE)
    sqlite.prepare('DELETE FROM applications WHERE organization_id = ?').run(orgId);
    console.log(`🗑️ ORGANIZATION DELETE: Deleted applications`);

    // 2. Delete job assignments (references jobs, users - NO CASCADE)  
    if (jobIds.length > 0) {
      const placeholders = jobIds.map(() => '?').join(',');
      sqlite.prepare(`DELETE FROM job_assignments WHERE job_id IN (${placeholders})`).run(...jobIds);
      console.log(`🗑️ ORGANIZATION DELETE: Deleted job assignments`);
    }

    // 3. Delete candidate assignments (references candidates, users - NO CASCADE)
    if (candidateIds.length > 0) {
      const placeholders = candidateIds.map(() => '?').join(',');
      sqlite.prepare(`DELETE FROM candidate_assignments WHERE candidate_id IN (${placeholders})`).run(...candidateIds);
      console.log(`🗑️ ORGANIZATION DELETE: Deleted candidate assignments`);
    }

    // 4. Delete status history (may reference candidates/jobs/users)
    sqlite.prepare('DELETE FROM status_history WHERE organization_id = ?').run(orgId);
    console.log(`🗑️ ORGANIZATION DELETE: Deleted status history`);

    // 5. Delete candidate submissions (may reference candidates/users)
    if (candidateIds.length > 0) {
      try {
        // Check what columns exist in candidate_submissions table
        const tableInfo = sqlite.prepare("PRAGMA table_info(candidate_submissions)").all();
        const hasOrgId = tableInfo.some((col: any) => col.name === 'organization_id');
        const hasCandidateId = tableInfo.some((col: any) => col.name === 'candidate_id');
        
        if (hasOrgId) {
          sqlite.prepare('DELETE FROM candidate_submissions WHERE organization_id = ?').run(orgId);
          console.log(`🗑️ ORGANIZATION DELETE: Deleted candidate submissions (by org_id)`);
        } else if (hasCandidateId) {
          const placeholders = candidateIds.map(() => '?').join(',');
          sqlite.prepare(`DELETE FROM candidate_submissions WHERE candidate_id IN (${placeholders})`).run(...candidateIds);
          console.log(`🗑️ ORGANIZATION DELETE: Deleted candidate submissions (by candidate_id)`);
        } else {
          console.log(`🗑️ ORGANIZATION DELETE: Candidate submissions table has unexpected schema, skipping`);
        }
      } catch (error) {
        console.log(`🗑️ ORGANIZATION DELETE: Candidate submissions table may not exist, skipping`);
      }
    }

    // 6. Delete report templates (reference users)
    if (userIds.length > 0) {
      try {
        const placeholders = userIds.map(() => '?').join(',');
        sqlite.prepare(`DELETE FROM report_templates WHERE user_id IN (${placeholders})`).run(...userIds);
        console.log(`🗑️ ORGANIZATION DELETE: Deleted report templates`);
      } catch (error) {
        console.log(`🗑️ ORGANIZATION DELETE: Report templates table may not exist, skipping`);
      }
    }

    // 7. Delete interviews (references jobs, candidates, users)
    await db.delete(interviews)
      .where(eq(interviews.organizationId, orgId));
    console.log(`🗑️ ORGANIZATION DELETE: Deleted interviews`);

    // 8. Delete job matches (references jobs and candidates)
    await db.delete(jobMatches)
      .where(eq(jobMatches.organizationId, orgId));
    console.log(`🗑️ ORGANIZATION DELETE: Deleted job matches`);

    // 9. Delete job templates (reference jobs)
    if (jobIds.length > 0) {
      const placeholders = jobIds.map(() => '?').join(',');
      sqlite.prepare(`DELETE FROM job_templates WHERE job_id IN (${placeholders})`).run(...jobIds);
      console.log(`🗑️ ORGANIZATION DELETE: Deleted job templates`);
    }

    // 10. Delete candidates (now safe after removing all references)
    await db.delete(candidates)
      .where(eq(candidates.organizationId, orgId));
    console.log(`🗑️ ORGANIZATION DELETE: Deleted candidates`);

    // 11. Delete jobs (now safe after removing all references)
    await db.delete(jobs)
      .where(eq(jobs.organizationId, orgId));
    console.log(`🗑️ ORGANIZATION DELETE: Deleted jobs`);

    // 12. Delete user teams for users in this organization
    if (userIds.length > 0) {
      await db.delete(userTeams)
        .where(inArray(userTeams.userId, userIds));
      console.log(`🗑️ ORGANIZATION DELETE: Deleted user teams`);
    }

    // 13. Delete user credentials
    sqlite.prepare('DELETE FROM user_credentials WHERE organization_id = ?').run(orgId);
    console.log(`🗑️ ORGANIZATION DELETE: Deleted user credentials`);

    // 14. Delete organization credentials
    await db.delete(organizationCredentials)
      .where(eq(organizationCredentials.organizationId, orgId));
    console.log(`🗑️ ORGANIZATION DELETE: Deleted organization credentials`);

    // 15. Delete usage metrics
    await db.delete(usageMetrics)
      .where(eq(usageMetrics.organizationId, orgId));
    console.log(`🗑️ ORGANIZATION DELETE: Deleted usage metrics`);

    // 16. Delete audit logs for users in this organization (references users)
    if (userIds.length > 0) {
      await db.delete(auditLogs)
        .where(inArray(auditLogs.userId, userIds));
      console.log(`🗑️ ORGANIZATION DELETE: Deleted user audit logs`);
    }

    // 17. Delete audit logs for the organization
    await db.delete(auditLogs)
      .where(eq(auditLogs.organizationId, orgId));
    console.log(`🗑️ ORGANIZATION DELETE: Deleted organization audit logs`);

    // 18. Delete teams (may reference users as managers) - do this before deleting users
    await db.delete(teams)
      .where(eq(teams.organizationId, orgId));
    console.log(`🗑️ ORGANIZATION DELETE: Deleted teams`);

    // Handle users based on specified action
    if (transferUsersToOrg) {
      // Transfer users to another organization
      const targetOrgId = parseInt(transferUsersToOrg);
      const [targetOrgExists] = await db.select()
        .from(organizations)
        .where(eq(organizations.id, targetOrgId))
        .limit(1);

      if (!targetOrgExists) {
        return res.status(400).json({ message: 'Target organization for user transfer not found' });
      }

      // Transfer users (deactivate and reassign)
      await db.update(users)
        .set({ 
          organizationId: targetOrgId,
          isActive: false, // Deactivate for admin review
          role: 'user' // Reset role for security
        })
        .where(eq(users.organizationId, orgId));

      // Log audit event before deleting organization
      await logAuditEvent(req, 'organization_deleted', 'organization', orgId, {
        organizationId: orgId,
        action: 'users_transferred',
        targetOrganizationId: targetOrgId,
        userCount: activeUsers.length
      });
    } else if (deleteUserData) {
      // Log audit event before deleting users (while user still exists)
      await logAuditEvent(req, 'organization_deleted', 'organization', orgId, {
        organizationId: orgId,
        action: 'users_deleted',
        userCount: activeUsers.length
      });

      // 19. Delete all users in the organization (only if explicitly requested)
      await db.delete(users)
        .where(eq(users.organizationId, orgId));
      console.log(`🗑️ ORGANIZATION DELETE: Deleted ${userIds.length} users`);
    }

    // 20. Finally delete the organization
    await db.delete(organizations)
      .where(eq(organizations.id, orgId));
    console.log(`🗑️ ORGANIZATION DELETE: Deleted organization ${orgId}`);

    res.json({ message: 'Organization deleted successfully' });
  } catch (error) {
    console.error('Delete organization error:', error);
    res.status(500).json({ message: 'Failed to delete organization' });
  }
});

// GET /auth/usage/:orgId - Get organization usage (Super Admin only)
router.get('/usage/:orgId', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const db = await getDB();
    const orgId = parseInt(req.params.orgId);
    const billingPeriod = req.query.period as string;

    const billing = await organizationManager.getMonthlyBilling(orgId, billingPeriod);

    if (!billing) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    res.json(billing);
  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /auth/invite-organization-admin - Create organization and invite admin (Super Admin only)
router.post('/invite-organization-admin', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const db = await getDB();
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

    // Store credentials in database for persistent access
    await db.insert(organizationCredentials).values({
      organizationId: result.organization.id,
      adminUserId: result.adminUser.id,
      email: email,
      temporaryPassword: tempPassword,
      isPasswordChanged: false,
    });

    await logAuditEvent(req, 'organization_created', 'organization', result.organization.id, {
      organizationName: result.organization.name,
      adminEmail: email,
    });

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
      // Include temporary credentials for manual sharing
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

// POST /auth/invite-user - Invite a user to organization (Hierarchical permissions)
router.post('/invite-user', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const db = await getDB();
    const { email, firstName, lastName, role, phone } = req.body;
    const invitingUser = req.user!;

    console.log('📧 Invite user request received:', { email, firstName, lastName, role, phone, invitingUserRole: invitingUser.role });
    console.log(`👤 USER INVITATION: About to create user via invite-user endpoint`);
    console.log(`📊 USER INVITATION: NODE_ENV = ${process.env.NODE_ENV || 'undefined'}`);
    console.log(`📧 USER INVITATION: User email = ${email}`);
    console.log(`🏢 USER INVITATION: Organization ID = ${invitingUser.organizationId}`);

    // Validate required fields
    if (!email || !firstName || !lastName || !role) {
      console.error('❌ Missing required fields:', { email: !!email, firstName: !!firstName, lastName: !!lastName, role: !!role });
      return res.status(400).json({ 
        message: 'Missing required fields',
        details: {
          email: !email ? 'Email is required' : null,
          firstName: !firstName ? 'First name is required' : null,
          lastName: !lastName ? 'Last name is required' : null,
          role: !role ? 'Role is required' : null
        }
      });
    }

    // Check if user with this email already exists in this organization
    const existingUser = await db.select()
      .from(users)
      .where(and(
        eq(users.email, email),
        eq(users.organizationId, invitingUser.organizationId!)
      ))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({ message: `User with email ${email} already exists in this organization` });
    }

    // Validate hierarchical permissions
    const allowedRoles: Record<string, string[]> = {
      'super_admin': ['org_admin', 'manager', 'team_lead', 'recruiter'],
      'org_admin': ['manager', 'team_lead', 'recruiter'],
      'manager': ['team_lead', 'recruiter'], 
      'team_lead': ['recruiter']
    };

    const userAllowedRoles = allowedRoles[invitingUser.role] || [];
    if (!userAllowedRoles.includes(role)) {
      return res.status(403).json({ message: `You cannot invite users with role: ${role}` });
    }

    // Generate secure temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + '123!';
    const passwordHash = await hashPassword(tempPassword);

    console.log(`👤 USER INVITATION: About to insert user into database via direct SQL insert`);
    console.log(`📁 USER INVITATION: Database file determined by NODE_ENV = ${process.env.NODE_ENV || 'undefined'}`);
    
    // Create the user with proper JSON serialization for SQLite
    const [newUser] = await db.insert(users).values({
      organizationId: invitingUser.organizationId!,
      email: email,
      passwordHash: passwordHash,
      firstName: firstName,
      lastName: lastName,
      role: role,
      managerId: invitingUser.id,
      isActive: 1,
      hasTemporaryPassword: 1,
      temporaryPassword: tempPassword,
      settings: JSON.stringify({
        theme: 'system',
        notifications: {
          email: true,
          browser: true,
          newCandidates: true,
          interviewReminders: true
        }
      }),
      permissions: JSON.stringify({
        users: role === 'manager' ? ['read', 'create'] : ['read'],
        teams: role === 'manager' ? ['read', 'create'] : ['read'],
        jobs: ['create', 'read', 'update'],
        candidates: ['create', 'read', 'update'],
        interviews: ['create', 'read', 'update'],
        settings: ['read']
      }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).returning();

    console.log(`✅ USER INVITATION: User created successfully via invite-user with ID = ${newUser.id}`);
    console.log(`📁 USER INVITATION: Data written to database file based on NODE_ENV = ${process.env.NODE_ENV || 'undefined'}`);

    // Trigger auto-backup for production (user creation)
    await backupService.onUserCreated(newUser);

    await logAuditEvent(req, 'user_invited', 'user', newUser.id, {
      invitedEmail: email,
      role: role
    });

    res.json({
      message: 'User invited successfully',
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      role: newUser.role,
      temporaryPassword: tempPassword,
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role
      },
      temporaryCredentials: {
        email: email,
        password: tempPassword,
        loginUrl: `${req.protocol}://${req.get('host')}/login`
      }
    });
  } catch (error) {
    console.error('Invite user error:', error);
    res.status(500).json({ message: 'Failed to invite user' });
  }
});

// PUT /auth/users/:id - Update user information (for admins)
router.put('/users/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const db = await getDB();
    const userId = parseInt(req.params.id);
    const updateData = updateUserSchema.parse(req.body);
    
    if (!req.user?.organizationId) {
      return res.status(400).json({ message: 'Organization context required' });
    }

    // Verify user exists in the same organization
    const [existingUser] = await db.select()
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.organizationId, req.user.organizationId)
      ))
      .limit(1);

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user
    const [updatedUser] = await db.update(users)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    await logAuditEvent(req, 'user_updated', 'user', userId, {
      changes: updateData,
    });

    res.json({
      message: 'User updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        phone: updatedUser.phone,
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Invalid user data', errors: error.errors });
    } else {
      res.status(500).json({ message: 'Failed to update user' });
    }
  }
});

// DELETE /auth/users/:id - Delete user (for admins)
router.delete('/users/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const db = await getDB();
    const userId = parseInt(req.params.id);
    
    if (!req.user?.organizationId) {
      return res.status(400).json({ message: 'Organization context required' });
    }

    // Verify user exists in the same organization
    const [existingUser] = await db.select()
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.organizationId, req.user.organizationId)
      ))
      .limit(1);

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deleting yourself
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Delete user
    await db.delete(users)
      .where(eq(users.id, userId));

    await logAuditEvent(req, 'user_deleted', 'user', userId, {
      deletedUser: {
        email: existingUser.email,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        role: existingUser.role
      }
    });

    res.json({
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

// POST /auth/backup-database - Manual database backup (Authenticated users)
router.post('/backup-database', authenticateToken, async (req: AuthRequest, res) => {
  try {
    console.log(`🔄 MANUAL BACKUP: User ${req.user?.email} (${req.user?.role}) requested manual database backup`);
    console.log(`📊 MANUAL BACKUP: NODE_ENV = ${process.env.NODE_ENV || 'undefined'}`);
    console.log(`🏢 MANUAL BACKUP: Organization ID = ${req.user?.organizationId}`);
    
    // Trigger manual backup (works in any environment)
    const success = await backupService.forceBackupAnyEnvironment(
      'manual_trigger_from_api'
    );
    
    if (success) {
      await logAuditEvent(req, 'manual_backup_requested', 'system', undefined, {
        requestedBy: req.user?.email,
        organizationId: req.user?.organizationId
      });
      
      res.json({
        success: true,
        message: 'Database backup completed successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Backup was skipped (backup in progress, too recent, or development environment)',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Manual backup error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create database backup',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;