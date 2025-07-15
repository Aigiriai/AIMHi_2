import { getSQLiteDB } from './sqlite-db';
import { organizations, users, teams, userTeams, usageMetrics } from '@shared/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { hashPassword } from './auth';
import type { InsertOrganization, InsertUser, InsertTeam, Organization, User, Team } from '@shared/schema';

// Get the database instance
let dbInstance: any = null;

async function getDB() {
  if (!dbInstance) {
    const dbConnection = await getSQLiteDB();
    dbInstance = dbConnection.db;
  }
  return dbInstance;
}

export class OrganizationManager {
  
  // Create a new organization with admin user
  async createOrganization(orgData: {
    name: string;
    domain?: string;
    plan?: string;
    adminEmail: string;
    adminFirstName: string;
    adminLastName: string;
    adminPassword: string;
  }) {
    const { name, domain, plan = 'trial', adminEmail, adminFirstName, adminLastName, adminPassword } = orgData;

    // CRITICAL VALIDATION: Check for existing users with this email in ANY organization
    // Email must be globally unique for user identification across organizations
    const db = await getDB();
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error(`User with email ${adminEmail} already exists in the system`);
    }

    // Generate subdomain from organization name and ensure uniqueness
    let subdomain = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
    
    // Check for existing subdomain and make it unique if needed
    const existingSubdomain = await db.select()
      .from(organizations)
      .where(eq(organizations.subdomain, subdomain))
      .limit(1);

    if (existingSubdomain.length > 0) {
      // Append timestamp to make it unique
      subdomain = `${subdomain}${Date.now().toString().slice(-6)}`;
    }

    // Handle domain - make it null if empty to avoid unique constraint issues
    const finalDomain = domain && domain.trim() ? domain.trim() : null;
    
    // Validate domain uniqueness if provided
    if (finalDomain) {
      const existingDomain = await db.select()
        .from(organizations)
        .where(eq(organizations.domain, finalDomain))
        .limit(1);

      if (existingDomain.length > 0) {
        throw new Error(`Organization with domain ${finalDomain} already exists`);
      }
    }

    // CRITICAL: Validate organization name uniqueness (globally required for login)
    const existingOrgName = await db.select()
      .from(organizations)
      .where(eq(organizations.name, name))
      .limit(1);

    if (existingOrgName.length > 0) {
      throw new Error(`Organization with name "${name}" already exists. Organization names must be globally unique.`);
    }

    // Create organization
    const [organization] = await db.insert(organizations).values({
      name,
      domain: finalDomain,
      subdomain,
      plan,
      settings: {
        theme: 'default',
        timezone: 'UTC',
        dateFormat: 'MM/DD/YYYY',
        currency: 'USD'
      },
      billingSettings: {
        pricingModel: 'per_user',
        pricePerUser: 50,
        pricePerResume: 2,
        pricePerInterview: 5,
        billingCycle: 'monthly'
      },
      complianceSettings: {
        dataRetentionDays: 2555, // 7 years
        gdprCompliant: true,
        ccpaCompliant: true,
        auditLogRetentionDays: 2555
      },
      integrationSettings: {
        allowedIntegrations: ['linkedin', 'indeed', 'greenhouse', 'workday'],
        apiRateLimit: 1000,
        webhookEnabled: true
      }
    }).returning();

    // Create admin user
    const passwordHash = await hashPassword(adminPassword);
    const [adminUser] = await db.insert(users).values({
      organizationId: organization.id,
      email: adminEmail,
      passwordHash,
      firstName: adminFirstName,
      lastName: adminLastName,
      role: 'org_admin',
      isActive: true,
      settings: {
        theme: 'default',
        notifications: {
          email: true,
          browser: true,
          newCandidates: true,
          interviewReminders: true,
          systemUpdates: true
        },
        dashboard: {
          defaultView: 'overview',
          refreshInterval: 30
        }
      },
      permissions: {
        users: ['create', 'read', 'update', 'delete'],
        teams: ['create', 'read', 'update', 'delete'],
        jobs: ['create', 'read', 'update', 'delete'],
        candidates: ['create', 'read', 'update', 'delete'],
        interviews: ['create', 'read', 'update', 'delete'],
        settings: ['read', 'update'],
        billing: ['read', 'update'],
        analytics: ['read']
      }
    }).returning();

    return {
      organization,
      adminUser,
      teams: []
    };
  }

  // Get organization with statistics
  async getOrganizationWithStats(orgId: number) {
    const db = await getDB();
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org) return null;

    // Get admin user (organization admin or super admin for platform org)
    const [adminUser] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.organizationId, orgId),
        or(
          eq(users.role, 'organization_admin'),
          eq(users.role, 'super_admin')
        ),
        eq(users.isActive, true)
      ))
      .limit(1);

    // Get counts
    const [userCount] = await db
      .select({ count: sql`count(*)` })
      .from(users)
      .where(and(eq(users.organizationId, orgId), eq(users.isActive, true)));

    const [teamCount] = await db
      .select({ count: sql`count(*)` })
      .from(teams)
      .where(eq(teams.organizationId, orgId));

    // Get current month usage
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    const monthlyUsage = await db
      .select()
      .from(usageMetrics)
      .where(and(
        eq(usageMetrics.organizationId, orgId),
        eq(usageMetrics.billingPeriod, currentMonth)
      ));

    return {
      ...org,
      adminUser: adminUser ? {
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        lastLoginAt: adminUser.lastLoginAt?.toISOString()
      } : null,
      userCount: Number(userCount.count),
      teamCount: Number(teamCount.count),
      monthlyUsage
    };
  }

  // Track usage for billing
  async trackUsage(
    organizationId: number,
    userId: number | null,
    metricType: string,
    metricValue: number = 1,
    metadata: any = {}
  ) {
    const billingPeriod = new Date().toISOString().substring(0, 7); // YYYY-MM

    await db.insert(usageMetrics).values({
      organizationId,
      userId,
      metricType,
      metricValue,
      metadata,
      billingPeriod
    });
  }

  // Get hierarchical user structure
  async getOrganizationHierarchy(orgId: number) {
    const allUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.organizationId, orgId), eq(users.isActive, true)))
      .orderBy(users.firstName, users.lastName);

    // Build hierarchy tree
    const userMap = new Map(allUsers.map(user => [user.id, { ...user, subordinates: [] as any[] }]));
    const hierarchy: any[] = [];

    allUsers.forEach(user => {
      const userWithSubs = userMap.get(user.id)!;
      if (user.managerId) {
        const manager = userMap.get(user.managerId);
        if (manager) {
          manager.subordinates.push(userWithSubs);
        } else {
          hierarchy.push(userWithSubs);
        }
      } else {
        hierarchy.push(userWithSubs);
      }
    });

    return hierarchy;
  }

  // Get monthly billing summary
  async getMonthlyBilling(orgId: number, billingPeriod?: string) {
    const period = billingPeriod || new Date().toISOString().substring(0, 7);
    
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org) return null;

    const usage = await db
      .select({
        metricType: usageMetrics.metricType,
        totalValue: sql`sum(${usageMetrics.metricValue})`,
        count: sql`count(*)`
      })
      .from(usageMetrics)
      .where(and(
        eq(usageMetrics.organizationId, orgId),
        eq(usageMetrics.billingPeriod, period)
      ))
      .groupBy(usageMetrics.metricType);

    const billingSettings = org.billingSettings as any;
    let totalCost = 0;
    const breakdown: any[] = [];

    // Calculate costs based on pricing model
    usage.forEach(metric => {
      let cost = 0;
      const quantity = Number(metric.totalValue);

      switch (metric.metricType) {
        case 'resume_processed':
          cost = quantity * (billingSettings.pricePerResume || 2);
          break;
        case 'interview_scheduled':
          cost = quantity * (billingSettings.pricePerInterview || 5);
          break;
        case 'ai_match_run':
          cost = quantity * (billingSettings.pricePerMatch || 1);
          break;
      }

      totalCost += cost;
      breakdown.push({
        metric: metric.metricType,
        quantity,
        rate: cost / quantity || 0,
        total: cost
      });
    });

    // Add user-based pricing if applicable
    if (billingSettings.pricingModel === 'per_user' || billingSettings.pricingModel === 'hybrid') {
      const [userCount] = await db
        .select({ count: sql`count(*)` })
        .from(users)
        .where(and(eq(users.organizationId, orgId), eq(users.isActive, true)));

      const userCost = Number(userCount.count) * (billingSettings.pricePerUser || 50);
      totalCost += userCost;
      breakdown.push({
        metric: 'active_users',
        quantity: Number(userCount.count),
        rate: billingSettings.pricePerUser || 50,
        total: userCost
      });
    }

    return {
      organization: org.name,
      billingPeriod: period,
      totalCost,
      breakdown,
      billingSettings
    };
  }
}

export const organizationManager = new OrganizationManager();