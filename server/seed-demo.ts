// Fixed import for organizationManager
import { initializeSQLiteDatabase } from './init-database';
import { hashPassword } from './auth';

export async function seedDemoOrganization() {
  try {
    // Demo organization seeding is disabled - use clean system with only super admin
    console.log('✓ Demo organization seeding skipped - clean system ready');
    return null;
  } catch (error) {
    console.error('Failed to seed demo organization:', error);
    throw error;
  }
}

export async function createSuperAdmin() {
  try {
    const sqlite = await initializeSQLiteDatabase();
    
    // Check if super admin already exists
    const existingSuperAdmin = sqlite.prepare(`
      SELECT * FROM users WHERE role = 'super_admin' LIMIT 1
    `).get();

    if (existingSuperAdmin) {
      console.log('✓ Super admin already exists');
      return existingSuperAdmin;
    }

    // Check if super admin organization already exists
    const existingSuperAdminOrg = sqlite.prepare(`
      SELECT * FROM organizations WHERE domain = 'platform.aimhi.app' LIMIT 1
    `).get();

    let superAdminOrg;
    if (existingSuperAdminOrg) {
      console.log('✓ Super admin organization already exists');
      
      // Create the super admin user in the existing organization
      const result = sqlite.prepare(`
        INSERT INTO users (
          organization_id, email, first_name, last_name, password_hash, 
          role, is_active, permissions, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        existingSuperAdminOrg.id,
        'superadmin@aimhi.app',
        'Super',
        'Admin',
        await hashPassword('SuperAdmin123!@#'),
        'super_admin',
        1,
        JSON.stringify({
          users: ['create', 'read', 'update', 'delete'],
          teams: ['create', 'read', 'update', 'delete'],
          jobs: ['create', 'read', 'update', 'delete'],
          candidates: ['create', 'read', 'update', 'delete'],
          interviews: ['create', 'read', 'update', 'delete'],
          settings: ['read', 'update'],
          billing: ['read', 'update'],
          analytics: ['read'],
          organizations: ['create', 'read', 'update', 'delete']
        }),
        new Date().toISOString(),
        new Date().toISOString()
      );
      
      const newUser = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
      return newUser;
    } else {
      console.log('🏢 Creating super admin organization...');
      // Import organizationManager dynamically to avoid circular dependencies
      const { organizationManager } = await import('./organization-manager');
      superAdminOrg = await organizationManager.createOrganization({
        name: 'AIM Hi System',
        domain: 'platform.aimhi.app',
        plan: 'enterprise',
        adminEmail: 'superadmin@aimhi.app',
        adminFirstName: 'Super',
        adminLastName: 'Admin',
        adminPassword: 'SuperAdmin123!@#'
      });
      
      console.log('✓ Super admin organization and user created');
      return superAdminOrg.adminUser;
    }
  } catch (error) {
    console.error('Failed to create super admin:', error);
    throw error;
  }
}

export async function initializeMultiTenantSystem() {
  try {
    console.log('🏗️ Initializing multi-tenant system...');
    
    // Create super admin
    await createSuperAdmin();
    
    // Seed demo organization (optional)
    await seedDemoOrganization();
    
    console.log('✅ Multi-tenant system initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize multi-tenant system:', error);
    throw error;
  }
}