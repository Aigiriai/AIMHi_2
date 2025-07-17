import { organizationManager } from './organization-manager';
import { getSQLiteDB } from './sqlite-db';
import { organizations, users } from './sqlite-schema';
import { eq } from 'drizzle-orm';
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
    const { db } = await getSQLiteDB();
    
    // Check if super admin already exists
    const existingSuperAdmin = await db
      .select()
      .from(users)
      .where(eq(users.role, 'super_admin'))
      .limit(1);

    if (existingSuperAdmin.length > 0) {
      console.log('✓ Super admin already exists');
      return existingSuperAdmin[0];
    }

    // Check if super admin organization already exists
    const existingSuperAdminOrg = await db
      .select()
      .from(organizations)
      .where(eq(organizations.domain, 'platform.aimhi.app'))
      .limit(1);

    let superAdminOrg;
    if (existingSuperAdminOrg.length > 0) {
      console.log('✓ Super admin organization already exists');
      
      // Create the super admin user in the existing organization
      const [superAdmin] = await db.insert(users).values({
        organizationId: existingSuperAdminOrg[0].id,
        email: 'superadmin@aimhi.app',
        firstName: 'Super',
        lastName: 'Admin',
        passwordHash: await hashPassword('SuperAdmin123!@#'),
        role: 'super_admin',
        isActive: true,
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

      console.log('✓ Super admin created successfully');
      console.log(`  Super Admin ID: ${superAdmin.id}`);
      console.log(`  Email: ${superAdmin.email}`);
      return superAdmin;
    } else {
      // Create super admin organization first
      superAdminOrg = await organizationManager.createOrganization({
        name: 'AIM Hi Platform Administration',
        domain: 'platform.aimhi.app',
        plan: 'enterprise',
        adminEmail: 'superadmin@aimhi.app',
        adminFirstName: 'Super',
        adminLastName: 'Admin',
        adminPassword: 'SuperAdmin123!@#',
      });

      // Update the admin user to super_admin role
      const [superAdmin] = await db
        .update(users)
        .set({ role: 'super_admin' })
        .where(eq(users.id, superAdminOrg.adminUser.id))
        .returning();

      console.log('✓ Super admin created successfully');
      console.log(`  Super Admin ID: ${superAdmin.id}`);
      console.log(`  Email: ${superAdmin.email}`);

      return superAdmin;
    }
  } catch (error) {
    console.error('Failed to create super admin:', error);
    throw error;
  }
}

export async function initializeMultiTenantSystem() {
  console.log('🚀 Initializing multi-tenant system...');
  
  try {
    // Create super admin
    await createSuperAdmin();
    
    // Create demo organization
    await seedDemoOrganization();
    
    console.log('✅ Multi-tenant system initialized successfully');
    console.log('\n=== Login Credentials ===');
    console.log('Super Admin:');
    console.log('  Email: superadmin@aimhi.app');
    console.log('  Password: SuperAdmin123!@#');
    console.log('\nDemo Organization Admin:');
    console.log('  Email: admin@aimhidemo.com');
    console.log('  Password: Demo123!@#');
    console.log('========================\n');
    
  } catch (error) {
    console.error('❌ Failed to initialize multi-tenant system:', error);
    throw error;
  }
}