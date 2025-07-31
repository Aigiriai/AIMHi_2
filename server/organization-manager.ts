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

    // CRITICAL: Validate organization name uniqueness (globally required for login)
    const existingOrgByName = sqlite.prepare(`
      SELECT id FROM organizations WHERE name = ? LIMIT 1
    `).get(name);

    if (existingOrgByName) {
      throw new Error(`Organization with name "${name}" already exists. Please choose a different name.`);
    }

    console.log(`👤 ORG MANAGER: About to create admin user in organization manager`);
    console.log(`📊 ORG MANAGER: NODE_ENV = ${process.env.NODE_ENV || 'undefined'}`);
    console.log(`📧 ORG MANAGER: Admin email = ${adminEmail}`);

    try {
      // Create organization
      const orgResult = sqlite.prepare(`
        INSERT INTO organizations (
          name, subdomain, domain, plan, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        name,
        subdomain,
        domain || '',
        plan,
        'active',
        new Date().toISOString(),
        new Date().toISOString()
      );

      const organizationId = orgResult.lastInsertRowid as number;
      console.log(`🏢 ORG MANAGER: Organization ID = ${organizationId}`);

      // Hash the admin password
      const hashedPassword = await hashPassword(adminPassword);

      // Create admin user
      const userResult = sqlite.prepare(`
        INSERT INTO users (
          organization_id, email, first_name, last_name, password_hash, 
          role, is_active, permissions, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        organizationId,
        adminEmail,
        adminFirstName,
        adminLastName,
        hashedPassword,
        // Set role to 'super_admin' if this is the super admin organization, otherwise 'org_admin'
        domain === 'platform.aimhi.app' ? 'super_admin' : 'org_admin',
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

      const adminUserId = userResult.lastInsertRowid as number;
      console.log(`✅ ORG MANAGER: Admin user created successfully with ID = ${adminUserId}`);

      // Get the created organization and user data
      const organization = sqlite.prepare(`
        SELECT * FROM organizations WHERE id = ?
      `).get(organizationId);

      const adminUser = sqlite.prepare(`
        SELECT * FROM users WHERE id = ?
      `).get(adminUserId);

      console.log(`📁 ORG MANAGER: Data written to database file based on NODE_ENV = ${process.env.NODE_ENV || 'undefined'}`);

      return {
        organization: {
          id: organizationId,
          name: (organization as any).name,
          subdomain: (organization as any).subdomain,
          domain: (organization as any).domain,
          plan: (organization as any).plan,
          status: (organization as any).status
        },
        adminUser: {
          id: adminUserId,
          email: (adminUser as any).email,
          firstName: (adminUser as any).first_name,
          lastName: (adminUser as any).last_name,
          role: (adminUser as any).role
        }
      };
    } catch (error) {
      console.error('Failed to create organization:', error);
      throw error;
    }
  }

  // Get organization by ID
  async getOrganization(orgId: number) {
    try {
      const sqlite = await getSQLite();
      
      const organization = sqlite.prepare(`
        SELECT * FROM organizations WHERE id = ? LIMIT 1
      `).get(orgId);

      return organization;
    } catch (error) {
      console.error('Failed to get organization:', error);
      throw error;
    }
  }

  // Get organization metrics for billing cycle analysis (simplified)
  async getOrganizationMetrics(orgId: number, period: string) {
    try {
      const sqlite = await getSQLite();
      
      // Get organization details
      const organization = sqlite.prepare(`
        SELECT * FROM organizations WHERE id = ? LIMIT 1
      `).get(orgId);

      if (!organization) {
        throw new Error('Organization not found');
      }

      // Get current usage metrics for the period (simplified)
      const usageMetrics = sqlite.prepare(`
        SELECT * FROM usage_metrics 
        WHERE organization_id = ? AND billing_period = ? 
        LIMIT 1
      `).get(orgId, period);

      // Calculate total active users
      const totalUsersResult = sqlite.prepare(`
        SELECT COUNT(*) as count FROM users 
        WHERE organization_id = ? AND is_active = 1
      `).get(orgId) as any;

      return {
        organization,
        usageMetrics: usageMetrics || {
          organization_id: orgId,
          billing_period: period,
          ai_calls_count: 0,
          tokens_used: 0,
          storage_used: 0,
          cost_usd: 0,
          last_calculated: new Date().toISOString()
        },
        totalUsers: totalUsersResult.count
      };
    } catch (error) {
      console.error('Failed to get organization metrics:', error);
      throw error;
    }
  }

  // Update organization settings
  async updateOrganization(orgId: number, updates: any) {
    try {
      const sqlite = await getSQLite();
      
      const updateFields = [];
      const updateValues = [];
      
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${key} = ?`);
          updateValues.push(value);
        }
      });
      
      if (updateFields.length > 0) {
        updateFields.push('updated_at = ?');
        updateValues.push(new Date().toISOString());
        updateValues.push(orgId);
        
        sqlite.prepare(`
          UPDATE organizations 
          SET ${updateFields.join(', ')} 
          WHERE id = ?
        `).run(...updateValues);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to update organization:', error);
      throw error;
    }
  }

  // Delete organization (simplified)
  async deleteOrganization(orgId: number) {
    try {
      const sqlite = await getSQLite();
      
      // Safety checks
      const organization = sqlite.prepare(`
        SELECT * FROM organizations WHERE id = ? LIMIT 1
      `).get(orgId);

      if (!organization) {
        throw new Error('Organization not found');
      }

      // Delete organization and related data
      sqlite.prepare('DELETE FROM users WHERE organization_id = ?').run(orgId);
      sqlite.prepare('DELETE FROM organizations WHERE id = ?').run(orgId);
      
      return true;
    } catch (error) {
      console.error('Failed to delete organization:', error);
      throw error;
    }
  }
}

export const organizationManager = new OrganizationManager();