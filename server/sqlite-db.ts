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
        name TEXT NOT NULL UNIQUE,
        domain TEXT,
        subdomain TEXT,
        settings TEXT DEFAULT '{}',
        plan TEXT DEFAULT 'free',
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        role TEXT DEFAULT 'user',
        manager_id INTEGER,
        is_active INTEGER DEFAULT 1,
        permissions TEXT DEFAULT '{}',
        settings TEXT DEFAULT '{}',
        has_temporary_password INTEGER DEFAULT 1,
        temporary_password TEXT,
        last_login_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (manager_id) REFERENCES users(id),
        UNIQUE(organization_id, email)
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
        status TEXT DEFAULT 'active',
        settings TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
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
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
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
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
        FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
        FOREIGN KEY (matched_by) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS interviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        job_id INTEGER NOT NULL,
        candidate_id INTEGER NOT NULL,
        interviewer_id INTEGER NOT NULL,
        scheduled_at TEXT NOT NULL,
        duration INTEGER DEFAULT 60,
        status TEXT DEFAULT 'scheduled',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
        FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
        FOREIGN KEY (interviewer_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        manager_id INTEGER,
        settings TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (manager_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS user_teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        team_id INTEGER NOT NULL,
        role TEXT DEFAULT 'member',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        user_id INTEGER,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id INTEGER,
        details TEXT DEFAULT '{}',
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS organization_credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        admin_user_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        temporary_password TEXT NOT NULL,
        is_password_changed INTEGER DEFAULT 0,
        expires_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
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
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS usage_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        metric_type TEXT NOT NULL,
        metric_value REAL NOT NULL,
        metadata TEXT DEFAULT '{}',
        recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_users_org_email ON users(organization_id, email);
      CREATE INDEX IF NOT EXISTS idx_jobs_org ON jobs(organization_id);
      CREATE INDEX IF NOT EXISTS idx_candidates_org ON candidates(organization_id);
      CREATE INDEX IF NOT EXISTS idx_matches_job ON job_matches(job_id);
      CREATE INDEX IF NOT EXISTS idx_matches_candidate ON job_matches(candidate_id);
      CREATE INDEX IF NOT EXISTS idx_interviews_org ON interviews(organization_id);
    `);

    // Explicitly create candidates table if it doesn't exist
    sqlite.exec(`
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
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ SQLite database initialized successfully');
    
    // Seed initial data
    await seedInitialData(db, sqlite);
    
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
  
  return { db, sqlite };
}

async function seedInitialData(db: any, sqlite: Database) {
  try {
    // Check if super admin exists
    const existingSuperAdmin = sqlite.prepare('SELECT id FROM organizations WHERE name = ?').get('AIM Hi System');
    
    if (!existingSuperAdmin) {
      console.log('🌱 Seeding initial data...');
      
      // Create system organization
      const orgResult = sqlite.prepare(`
        INSERT INTO organizations (name, domain, plan, status) 
        VALUES (?, ?, ?, ?)
      `).run('AIM Hi System', 'aimhi.app', 'enterprise', 'active');
      
      const orgId = orgResult.lastInsertRowid;
      
      // Create super admin user
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash('SuperAdmin123!@#', 10);
      
      sqlite.prepare(`
        INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, has_temporary_password)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(orgId, 'superadmin@aimhi.app', hashedPassword, 'Super', 'Admin', 'super_admin', 0);
      
      // Create demo organization
      const demoOrgResult = sqlite.prepare(`
        INSERT INTO organizations (name, domain, plan, status) 
        VALUES (?, ?, ?, ?)
      `).run('AIM Hi Demo', 'aimhidemo.com', 'professional', 'active');
      
      const demoOrgId = demoOrgResult.lastInsertRowid;
      
      // Create demo admin
      const demoHashedPassword = await bcrypt.hash('Demo123!@#', 10);
      
      sqlite.prepare(`
        INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, has_temporary_password)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(demoOrgId, 'admin@aimhidemo.com', demoHashedPassword, 'Demo', 'Admin', 'org_admin', 0);
      
      console.log('✓ Initial data seeded successfully');
    } else {
      console.log('✓ Initial data already exists');
    }
    
    console.log('=== Login Credentials ===');
    console.log('Super Admin:');
    console.log('  Email: superadmin@aimhi.app');
    console.log('  Password: SuperAdmin123!@#');
    console.log('Demo Organization Admin:');
    console.log('  Email: admin@aimhidemo.com');
    console.log('  Password: Demo123!@#');
    console.log('========================');
    
  } catch (error) {
    console.error('Seeding error:', error);
  }
}

let dbInstance: { db: any; sqlite: Database } | null = null;

export async function getSQLiteDB() {
  if (!dbInstance) {
    dbInstance = await initializeSQLiteDB();
  }
  return dbInstance;
}

export { schema };