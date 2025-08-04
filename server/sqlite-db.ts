import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from "./sqlite-schema";
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { promises as fs } from 'fs';
import path from 'path';

// SQLite database for cost-optimized production deployment
const dbPath = process.env.NODE_ENV === 'production' 
  ? './data/production.db'
  : './data/development.db';

// Ensure database directory exists
async function ensureDbDirectory() {
  const dbDir = path.dirname(dbPath);
  try {
    await fs.mkdir(dbDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create database directory:', error);
  }
}

// Initialize SQLite database
export async function initializeSQLiteDB() {
  await ensureDbDirectory();
  
  const sqlite = new Database(dbPath);
  
  // Enable foreign keys and optimize for performance
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('cache_size = 1000000');
  sqlite.pragma('temp_store = memory');
  
  const db = drizzle(sqlite, { schema });
  
  // Initialize tables if they don't exist
  try {
    // Create tables manually for initial setup - Execute in smaller chunks to avoid issues
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        domain TEXT,
        subdomain TEXT,
        plan TEXT NOT NULL DEFAULT 'trial',
        status TEXT NOT NULL DEFAULT 'active',
        timezone TEXT DEFAULT 'UTC',
        date_format TEXT DEFAULT 'MM/DD/YYYY',
        currency TEXT DEFAULT 'USD',
        settings TEXT DEFAULT '{}',
        billing_settings TEXT DEFAULT '{}',
        compliance_settings TEXT DEFAULT '{}',
        integration_settings TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'recruiter',
        manager_id INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        permissions TEXT DEFAULT '{}',
        has_temporary_password INTEGER NOT NULL DEFAULT 0,
        temporary_password TEXT,
        settings TEXT DEFAULT '{}',
        last_login_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (manager_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        team_id INTEGER,
        created_by INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        experience_level TEXT NOT NULL,
        job_type TEXT NOT NULL,
        keywords TEXT NOT NULL,
        requirements TEXT NOT NULL DEFAULT 'Requirements not specified',
        location TEXT NOT NULL DEFAULT 'Location not specified',
        salary_min INTEGER,
        salary_max INTEGER,
        original_file_name TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        approved_by INTEGER,
        approved_at TEXT,
        closed_at TEXT,
        filled_at TEXT,
        requires_approval INTEGER NOT NULL DEFAULT 1,
        auto_publish_at TEXT,
        application_deadline TEXT,
        settings TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (team_id) REFERENCES teams(id),
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (approved_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        experience INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        source TEXT,
        resume_content TEXT NOT NULL,
        resume_file_name TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        added_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (added_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS job_matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        job_id INTEGER NOT NULL,
        candidate_id INTEGER NOT NULL,
        matched_by INTEGER NOT NULL,
        match_percentage REAL NOT NULL,
        ai_reasoning TEXT,
        match_criteria TEXT DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (candidate_id) REFERENCES candidates(id),
        FOREIGN KEY (matched_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS interviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        job_id INTEGER NOT NULL,
        candidate_id INTEGER NOT NULL,
        match_id INTEGER,
        scheduled_by INTEGER NOT NULL,
        scheduled_date_time TEXT NOT NULL,
        duration INTEGER NOT NULL DEFAULT 60,
        status TEXT NOT NULL DEFAULT 'scheduled',
        interview_type TEXT NOT NULL DEFAULT 'video',
        meeting_link TEXT,
        notes TEXT,
        feedback TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (candidate_id) REFERENCES candidates(id),
        FOREIGN KEY (match_id) REFERENCES job_matches(id),
        FOREIGN KEY (scheduled_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        manager_id INTEGER,
        settings TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (manager_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS user_teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        team_id INTEGER NOT NULL,
        role TEXT DEFAULT 'member',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (team_id) REFERENCES teams(id),
        UNIQUE(user_id, team_id)
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        user_id INTEGER,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        details TEXT DEFAULT '{}',
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS organization_credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        admin_user_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        temporary_password TEXT NOT NULL,
        is_password_changed INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (admin_user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS user_credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        temporary_password TEXT NOT NULL,
        is_password_changed INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
      );

      CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        job_id INTEGER NOT NULL,
        candidate_id INTEGER NOT NULL,
        applied_by INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        substatus TEXT,
        current_stage TEXT NOT NULL DEFAULT 'new',
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        match_percentage REAL,
        source TEXT DEFAULT 'manual',
        notes TEXT DEFAULT '',
        last_stage_change_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_stage_changed_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (candidate_id) REFERENCES candidates(id),
        FOREIGN KEY (applied_by) REFERENCES users(id),
        FOREIGN KEY (last_stage_changed_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS job_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        assigned_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (assigned_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS candidate_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        candidate_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        assigned_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (candidate_id) REFERENCES candidates(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (assigned_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS candidate_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        submitted_by INTEGER NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        experience INTEGER NOT NULL,
        resume_content TEXT NOT NULL,
        resume_file_name TEXT NOT NULL,
        source TEXT DEFAULT 'manual',
        tags TEXT DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'pending',
        submission_notes TEXT,
        reviewed_by INTEGER,
        reviewed_at TEXT,
        review_notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (submitted_by) REFERENCES users(id),
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        old_status TEXT,
        new_status TEXT NOT NULL,
        changed_by INTEGER NOT NULL,
        reason TEXT,
        notes TEXT,
        changed_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (changed_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS job_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL,
        organization_id INTEGER NOT NULL,
        position_title TEXT NOT NULL,
        seniority_level TEXT NOT NULL,
        department TEXT,
        mandatory_skills TEXT DEFAULT '[]',
        preferred_skills TEXT DEFAULT '[]',
        skill_proficiency_levels TEXT DEFAULT '{}',
        primary_technologies TEXT DEFAULT '[]',
        secondary_technologies TEXT DEFAULT '[]',
        technology_categories TEXT DEFAULT '{}',
        minimum_years_required INTEGER DEFAULT 0,
        specific_domain_experience TEXT DEFAULT '[]',
        industry_background TEXT DEFAULT '[]',
        technical_tasks_percentage INTEGER DEFAULT 70,
        leadership_tasks_percentage INTEGER DEFAULT 20,
        domain_tasks_percentage INTEGER DEFAULT 10,
        skills_match_weight INTEGER DEFAULT 25,
        experience_weight INTEGER DEFAULT 15,
        keyword_weight INTEGER DEFAULT 35,
        technical_depth_weight INTEGER DEFAULT 10,
        domain_knowledge_weight INTEGER DEFAULT 15,
        raw_job_description TEXT NOT NULL,
        ai_generated_data TEXT DEFAULT '{}',
        template_version TEXT DEFAULT '1.0',
        status TEXT DEFAULT 'generated',
        reviewed_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS usage_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        user_id INTEGER,
        metric_type TEXT NOT NULL,
        metric_value REAL NOT NULL,
        billing_period TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_users_org_email ON users(organization_id, email);
      CREATE INDEX IF NOT EXISTS idx_jobs_org ON jobs(organization_id);
      CREATE INDEX IF NOT EXISTS idx_candidates_org ON candidates(organization_id);
      CREATE INDEX IF NOT EXISTS idx_matches_job ON job_matches(job_id);
      CREATE INDEX IF NOT EXISTS idx_matches_candidate ON job_matches(candidate_id);
      CREATE INDEX IF NOT EXISTS idx_interviews_org ON interviews(organization_id);
    `);

    // All tables now created in main block above

    console.log('✅ SQLite database initialized successfully');
    
    // Add missing columns to existing tables (migrations)
    try {
      // Check if original_file_name column exists in jobs table
      const jobsTableInfo = sqlite.prepare("PRAGMA table_info(jobs)").all();
      const hasOriginalFileName = jobsTableInfo.some((col: any) => col.name === 'original_file_name');
      
      if (!hasOriginalFileName) {
        sqlite.exec('ALTER TABLE jobs ADD COLUMN original_file_name TEXT');
        console.log('✅ Added original_file_name column to jobs table');
      }
    } catch (error) {
      console.log('Column migration handled:', error);
    }
    
    // CRITICAL FIX: Only seed if this is a truly fresh database
    // Check if restoration happened elsewhere first
    const existingOrgs = sqlite.prepare('SELECT COUNT(*) as count FROM organizations').get();
    const existingUsers = sqlite.prepare('SELECT COUNT(*) as count FROM users').get();
    
    console.log(`🔍 BEFORE SEEDING CHECK: Found ${existingOrgs.count} organizations, ${existingUsers.count} users`);
    
    // HYPOTHESIS TEST: Comment out all seeding to test if seeding is overwriting restored data
    // if (existingOrgs.count === 0 && existingUsers.count === 0) {
    //   console.log('📦 No existing data found - proceeding with initial seeding');
    //   await seedInitialData(db, sqlite);
    // } else {
      console.log('🧪 SEEDING DISABLED FOR HYPOTHESIS TEST - checking existing data only');
      
      // DEBUG: Show what organizations exist
      const orgs = sqlite.prepare('SELECT id, name, domain FROM organizations').all();
      console.log(`🔍 ORGANIZATIONS AFTER RESTORATION:`, orgs.map(o => `${o.name} (${o.domain || 'no-domain'})`).join(', ') || 'None');
      console.log(`🔍 DATA COUNT: ${existingOrgs.count} organizations, ${existingUsers.count} users`);
    // }
    
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
  
  return { db, sqlite };
}

async function seedInitialData(db: any, sqlite: any) {
  try {
    // PRODUCTION DATA PROTECTION: Check if we have existing data
    if (process.env.NODE_ENV === 'production') {
      const orgCount = sqlite.prepare('SELECT COUNT(*) as count FROM organizations').get();
      const userCount = sqlite.prepare('SELECT COUNT(*) as count FROM users').get();
      
      if (orgCount.count > 0 || userCount.count > 0) {
        console.log('📊 Existing production data found:');
        console.log(`Organizations: ${orgCount.count}`);
        console.log(`Users: ${userCount.count}`);
        console.log('🛡️ Seeding skipped - existing data preserved');
        return;
      }
    }
    
    // Check if super admin user exists (more comprehensive check)
    const existingSuperAdmin = sqlite.prepare('SELECT id FROM users WHERE email = ? AND role = ?').get('superadmin@aimhi.app', 'super_admin');
    
    if (!existingSuperAdmin) {
      console.log('🌱 Seeding super admin...');
      
      // Check if AIM Hi System organization exists
      let systemOrg = sqlite.prepare('SELECT id FROM organizations WHERE name = ?').get('AIM Hi System');
      
      if (!systemOrg) {
        // Create system organization
        const orgResult = sqlite.prepare(`
          INSERT INTO organizations (name, domain, plan, status) 
          VALUES (?, ?, ?, ?)
        `).run('AIM Hi System', 'aimhi.app', 'enterprise', 'active');
        
        systemOrg = { id: orgResult.lastInsertRowid };
      }
      
      // Create super admin user
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash('SuperAdmin123!@#', 10);
      
      sqlite.prepare(`
        INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, has_temporary_password)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(systemOrg.id, 'superadmin@aimhi.app', hashedPassword, 'Super', 'Admin', 'super_admin', 0);
      
      console.log('✓ Super admin seeded successfully');
      console.log('✅ Multi-tenant system initialized successfully');
    } else {
      console.log('✓ Super admin already exists');
    }
    
    console.log('=== Login Credentials ===');
    console.log('Super Admin:');
    console.log('  Email: superadmin@aimhi.app');
    console.log('  Password: SuperAdmin123!@#');
    console.log('========================');
    
  } catch (error) {
    console.error('Seeding error:', error);
  }
}

let dbInstance: { db: any; sqlite: any } | null = null;

export async function getSQLiteDB() {
  if (!dbInstance) {
    dbInstance = await initializeSQLiteDB();
  }
  return dbInstance;
}

export { schema };