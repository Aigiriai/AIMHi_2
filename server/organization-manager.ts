import { hashPassword } from './auth';

// Get the SQLite database instance
async function getSQLite() {
  const { initializeSQLiteDatabase } = await import('./init-database');
  return await initializeSQLiteDatabase();
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
    const sqlite = await getSQLite();
    const existingUser = sqlite.prepare(`
      SELECT id FROM users WHERE email = ? LIMIT 1
    `).get(adminEmail);

    if (existingUser) {
      throw new Error(`User with email ${adminEmail} already exists in the system`);
    }

    // Generate subdomain from organization name and ensure uniqueness
    let subdomain = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
    
    // Check for existing subdomain and make it unique if needed
    const existingSubdomain = sqlite.prepare(`
      SELECT id FROM organizations WHERE subdomain = ? LIMIT 1
    `).get(subdomain);

    if (existingSubdomain) {
      // Append timestamp to make it unique
      subdomain = `${subdomain}${Date.now().toString().slice(-6)}`;
    }

    // Handle domain - make it null if empty to avoid unique constraint issues
    const finalDomain = domain && domain.trim() ? domain.trim() : null;
    
    // Validate domain uniqueness if provided
    if (finalDomain) {
      const existingDomain = sqlite.prepare(`
        SELECT id FROM organizations WHERE domain = ? LIMIT 1
      `).get(finalDomain);
      
      if (existingDomain) {
        throw new Error(`Organization with domain ${finalDomain} already exists`);
      }
    }

    // CRITICAL: Validate organization name uniqueness (globally required for login)
    const existingOrgName = sqlite.prepare(`
      SELECT id FROM organizations WHERE name = ? LIMIT 1
    `).get(name);

    if (existingOrgName) {
      throw new Error(`Organization with name "${name}" already exists. Organization names must be globally unique.`);
    }

    // Create organization using raw SQL
    const organizationResult = sqlite.prepare(`
      INSERT INTO organizations (
        name, domain, subdomain, plan, status, timezone, date_format, currency,
        settings, billing_settings, compliance_settings, integration_settings,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      finalDomain,
      subdomain,
      plan,
      'active',
      'UTC',
      'MM/DD/YYYY',
      'USD',
      JSON.stringify({
        theme: 'default',
        timezone: 'UTC',
        dateFormat: 'MM/DD/YYYY',
        currency: 'USD'
      }),
      JSON.stringify({
        pricingModel: 'per_user',
        pricePerUser: 50,
        pricePerResume: 2,
        pricePerInterview: 5,
        billingCycle: 'monthly'
      }),
      JSON.stringify({
        dataRetentionDays: 2555, // 7 years
        gdprCompliant: true,
        ccpaCompliant: true,
        auditLogRetentionDays: 2555
      }),
      JSON.stringify({
        allowedIntegrations: ['linkedin', 'indeed', 'greenhouse', 'workday'],
        apiRateLimit: 1000,
        webhookEnabled: true
      }),
      new Date().toISOString(),
      new Date().toISOString()
    );

    const organizationId = organizationResult.lastInsertRowid;

    console.log(`👤 ORG MANAGER: About to create admin user in organization manager`);
    console.log(`📊 ORG MANAGER: NODE_ENV = ${process.env.NODE_ENV || 'undefined'}`);
    console.log(`📧 ORG MANAGER: Admin email = ${adminEmail}`);
    console.log(`🏢 ORG MANAGER: Organization ID = ${organizationId}`);
    
    // Create admin user using raw SQL
    const passwordHash = await hashPassword(adminPassword);
    const adminUserResult = sqlite.prepare(`
      INSERT INTO users (
        organization_id, email, password_hash, first_name, last_name, role,
        is_active, permissions, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      organizationId,
      adminEmail,
      passwordHash,
      adminFirstName,
      adminLastName,
      'org_admin',
      1, // is_active
      JSON.stringify({
        users: ['create', 'read', 'update', 'delete'],
        teams: ['create', 'read', 'update', 'delete'],
        jobs: ['create', 'read', 'update', 'delete'],
        candidates: ['create', 'read', 'update', 'delete'],
        interviews: ['create', 'read', 'update', 'delete'],
        settings: ['read', 'update'],
        billing: ['read', 'update'],
        analytics: ['read']
      }),
      new Date().toISOString(),
      new Date().toISOString()
    );

    const adminUserId = adminUserResult.lastInsertRowid;
    
    console.log(`✅ ORG MANAGER: Admin user created successfully with ID = ${adminUserId}`);
    console.log(`📁 ORG MANAGER: Data written to database file based on NODE_ENV = ${process.env.NODE_ENV || 'undefined'}`);

    return {
      organization: {
        id: organizationId,
        name,
        domain: finalDomain,
        subdomain,
        plan,
        status: 'active',
        createdAt: new Date().toISOString()
      },
      adminUser: {
        id: adminUserId,
        email: adminEmail,
        firstName: adminFirstName,
        lastName: adminLastName,
        role: 'org_admin'
      },
      teams: []
    };
  }

  // Get organization with statistics
  async getOrganizationWithStats(orgId: number) {
    const { initializeSQLiteDatabase } = await import('./init-database');
    const sqlite = await initializeSQLiteDatabase();
    
    // Get organization data
    const org = sqlite.prepare('SELECT * FROM organizations WHERE id = ? LIMIT 1').get(orgId);
    
    if (!org) return null;

    // Get admin user (organization admin or super admin for platform org)
    const adminUser = sqlite.prepare(`
      SELECT * FROM users 
      WHERE organization_id = ? 
        AND (role = 'org_admin' OR role = 'super_admin')
        AND is_active = 1
      LIMIT 1
    `).get(orgId);

    // Get counts
    const userCount = sqlite.prepare(`
      SELECT COUNT(*) as count FROM users 
      WHERE organization_id = ? AND is_active = 1
    `).get(orgId);

    const teamCount = sqlite.prepare(`
      SELECT COUNT(*) as count FROM teams 
      WHERE organization_id = ?
    `).get(orgId);

    // Get current month usage
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    const monthlyUsage = sqlite.prepare(`
      SELECT * FROM usage_metrics 
      WHERE organization_id = ? AND billing_period = ?
    `).all(orgId, currentMonth);

    return {
      ...org,
      adminUser: adminUser ? {
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.first_name,
        lastName: adminUser.last_name,
        lastLoginAt: adminUser.last_login_at
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
    const db = await getDB();

    await db.insert(usageMetrics).values({
      organizationId,
      userId,
      metricType,
      metricValue,
      metadata: JSON.stringify(metadata),
      billingPeriod
    });
  }

  // Get hierarchical user structure
  async getOrganizationHierarchy(orgId: number) {
    const sqlite = await getSQLite();
    const allUsers = sqlite.prepare(`
      SELECT * FROM users 
      WHERE organization_id = ? AND is_active = 1
    `).all(orgId);

    // Build hierarchy tree
    const userMap = new Map(allUsers.map((user: any) => [user.id, { ...user, subordinates: [] as any[] }]));
    const hierarchy: any[] = [];

    allUsers.forEach((user: any) => {
      const userWithSubs = userMap.get(user.id)!;
      if (user.manager_id) {
        const manager = userMap.get(user.manager_id);
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
    const db = await getDB();
    
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