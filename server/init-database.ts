import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'fs';
import path from 'path';

// Initialize SQLite database with proper schema
export async function initializeSQLiteDatabase() {
  try {
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Use environment-specific database name
    const dbName = process.env.NODE_ENV === 'production' ? 'production.db' : 'development.db';
    const dbPath = path.join(dataDir, dbName);
    console.log(`📁 Database path: ${dbPath} (NODE_ENV: ${process.env.NODE_ENV || 'undefined'})`);



    const sqlite = new Database(dbPath);
    
    // Enable WAL mode for better performance
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('synchronous = NORMAL');
    sqlite.pragma('cache_size = 1000');
    sqlite.pragma('temp_store = memory');
    

    
    // Create organizations table with all required columns
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
    `);

    // Add timezone column if it doesn't exist (for existing databases)
    try {
      sqlite.exec(`ALTER TABLE organizations ADD COLUMN timezone TEXT DEFAULT 'UTC';`);
    } catch (error) {
      // Column already exists, which is fine
    }

    // Add other missing columns if they don't exist
    const missingColumns = [
      'date_format TEXT DEFAULT \'MM/DD/YYYY\'',
      'currency TEXT DEFAULT \'USD\'',
      'billing_settings TEXT DEFAULT \'{}\'',
      'compliance_settings TEXT DEFAULT \'{}\'',
      'integration_settings TEXT DEFAULT \'{}\''
    ];

    for (const column of missingColumns) {
      try {
        sqlite.exec(`ALTER TABLE organizations ADD COLUMN ${column};`);
      } catch (error) {
        // Column already exists, which is fine
      }
    }

    // Create other required tables
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'recruiter',
        manager_id INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        permissions TEXT DEFAULT '{}',
        last_login_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (manager_id) REFERENCES users(id)
      );
    `);

    sqlite.exec(`
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
        original_file_name TEXT DEFAULT '',
        
        -- ATS Pipeline fields
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
    `);

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        added_by INTEGER NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        experience INTEGER NOT NULL,
        resume_content TEXT NOT NULL,
        resume_file_name TEXT NOT NULL,
        source TEXT DEFAULT 'manual',
        tags TEXT DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        assigned_to INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (added_by) REFERENCES users(id),
        FOREIGN KEY (assigned_to) REFERENCES users(id)
      );
    `);

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        manager_id INTEGER,
        settings TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (manager_id) REFERENCES users(id)
      );
    `);

    // Create organization_credentials table
    sqlite.exec(`
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
    `);

    // Create user_credentials table
    sqlite.exec(`
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
    `);

    // Create user_teams junction table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS user_teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        team_id INTEGER NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (team_id) REFERENCES teams(id)
      );
    `);

    // Create audit_logs table
    sqlite.exec(`
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
    `);

    // Create usage_metrics table
    sqlite.exec(`
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
    `);

    // Create ATS applications table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        job_id INTEGER NOT NULL,
        candidate_id INTEGER NOT NULL,
        applied_by INTEGER NOT NULL,
        
        -- Pipeline status
        status TEXT NOT NULL DEFAULT 'new',
        substatus TEXT,
        current_stage TEXT NOT NULL DEFAULT 'new',
        
        -- Application details
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        match_percentage REAL,
        source TEXT DEFAULT 'manual',
        notes TEXT DEFAULT '',
        
        -- Tracking
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
    `);

    // Create job assignments table
    sqlite.exec(`
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
    `);

    // Create candidate assignments table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS candidate_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        candidate_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('owner', 'assigned', 'viewer')),
        assigned_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (candidate_id) REFERENCES candidates(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (assigned_by) REFERENCES users(id)
      );
    `);

    // Create candidate submissions table for Team Lead and Recruiter submissions
    sqlite.exec(`
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
    `);

    // Create status history table
    sqlite.exec(`
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
    `);

    // Add missing columns to existing tables if they don't exist
    const jobsColumns = [
      'approved_by INTEGER',
      'approved_at TEXT',
      'closed_at TEXT',
      'filled_at TEXT',
      'requires_approval INTEGER NOT NULL DEFAULT 1',
      'auto_publish_at TEXT',
      'application_deadline TEXT',
      'original_file_name TEXT DEFAULT \'\''
    ];

    for (const column of jobsColumns) {
      try {
        sqlite.exec(`ALTER TABLE jobs ADD COLUMN ${column};`);
      } catch (error) {
        // Column already exists, which is fine
      }
    }

    // Add missing columns to candidates table
    const candidatesColumns = [
      'assigned_to INTEGER'
    ];

    for (const column of candidatesColumns) {
      try {
        sqlite.exec(`ALTER TABLE candidates ADD COLUMN ${column};`);
      } catch (error) {
        // Column already exists, which is fine
      }
    }

    // Check if timezone column exists and is working
    const result = sqlite.prepare("PRAGMA table_info(organizations)").all();
    const hasTimezone = result.some((col: any) => col.name === 'timezone');
    
    if (!hasTimezone) {
      console.error('❌ Timezone column still missing after schema update');
      throw new Error('Failed to create timezone column');
    }

    console.log('✅ SQLite database initialized successfully');
    console.log('✅ Organizations table has timezone column');
    
    return sqlite;
  } catch (error) {
    console.error('❌ Failed to initialize SQLite database:', error);
    throw error;
  }
}