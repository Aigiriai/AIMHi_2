import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'fs';
import path from 'path';

// Initialize SQLite database with proper schema
export async function initializeSQLiteDatabase() {
  try {
    // Import data persistence manager for production safety
    const { dataPersistence } = await import('./data-persistence');
    
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Use environment-specific database name
    const dbName = process.env.NODE_ENV === 'production' ? 'production.db' : 'development.db';
    const dbPath = path.join(dataDir, dbName);
    console.log(`📁 Database path: ${dbPath} (NODE_ENV: ${process.env.NODE_ENV || 'undefined'})`);

    // PRODUCTION DATA PROTECTION: Restore automatically if database missing
    if (process.env.NODE_ENV === 'production' && !fs.existsSync(dbPath)) {
      // Check if backup restoration should be skipped (environment variable override)
      if (process.env.SKIP_BACKUP_RESTORATION === 'true') {
        console.log(`⚠️ PRODUCTION INIT: SKIP_BACKUP_RESTORATION is set - skipping backup restoration and creating fresh database`);
        console.log(`🌱 PRODUCTION INIT: This will trigger fresh seeding for production environment`);
      } else {
        console.log(`🔄 PRODUCTION INIT: Database missing at ${dbPath} - attempting restoration from latest backup...`);
        console.log(`🔄 PRODUCTION INIT: This will trigger backup deletion and fresh seeding if no backups exist`);
        
        // Enhanced corruption detection before restoration attempt
        try {
          const restored = await dataPersistence.restoreFromLatestBackup();
          if (restored) {
            console.log(`✅ PRODUCTION INIT: Database restored successfully from backup`);
            
            // CRITICAL FIX: Reset any cached database connections
            try {
              const { resetDBConnection, markRestorationComplete } = await import('./db-connection');
              resetDBConnection();
              console.log(`🔄 Database connection cache reset after restoration`);
            } catch (error) {
              console.warn(`⚠️ Could not reset DB connection cache:`, error.message);
            }
            
            // CRITICAL FIX: Small delay to ensure file system operations complete before opening connection
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Enhanced database integrity check after restoration
            let sqlite: Database;
            try {
              sqlite = new Database(dbPath);
              
              // Comprehensive integrity check
              const integrityResult = sqlite.pragma('integrity_check');
              if (Array.isArray(integrityResult) && integrityResult.length > 0 && integrityResult[0] !== 'ok') {
                throw new Error(`Database integrity check failed: ${integrityResult.join(', ')}`);
              }
              console.log(`✅ Restored database integrity verified`);
              
              // Additional corruption checks
              try {
                // Check if essential tables exist and are accessible
                sqlite.prepare("SELECT COUNT(*) FROM organizations").get();
                sqlite.prepare("SELECT COUNT(*) FROM users").get();
                console.log(`✅ Essential tables verified and accessible`);
              } catch (tableError: any) {
                throw new Error(`Database tables corrupted or inaccessible: ${tableError.message}`);
              }
              
            } catch (error: any) {
              console.error(`❌ Restored database corruption detected:`, error.message);
              if (sqlite!) sqlite.close();
              
              // Clean up corrupted restored database and related files
              try {
                if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
                if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
                if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
                console.log('🗑️ Corrupted database files cleaned up');
              } catch (cleanupError) {
                console.warn('⚠️ Could not clean up corrupted files:', cleanupError.message);
              }
              
              // Handle specific error types
              if (error.code === 'SQLITE_IOERR' || error.code === 'SQLITE_IOERR_SHORT_READ' || 
                  error.message?.includes('disk I/O error') || error.message?.includes('database disk image is malformed')) {
                console.log('🔄 Database corruption or I/O error detected - proceeding with fresh database creation...');
                // Will fall through to normal initialization path
              } else {
                // Set environment variable to skip future restoration attempts
                process.env.SKIP_BACKUP_RESTORATION = 'true';
                console.log('⚠️ Setting SKIP_BACKUP_RESTORATION=true to prevent repeated corruption issues');
                // Will fall through to normal initialization path
              }
            }
            
            if (sqlite!) {
              sqlite.pragma('journal_mode = WAL');
              sqlite.pragma('synchronous = NORMAL');
              sqlite.pragma('cache_size = 1000');
              sqlite.pragma('temp_store = memory');
              
              console.log('✅ SQLite database initialized successfully');
              
              // Skip seeding - data already exists from backup
              console.log(`🔄 PRODUCTION INIT: Database restored from backup - skipping initialization seeding`);
              
              // Mark restoration as complete to allow other database access
              try {
                const { markRestorationComplete } = await import('./db-connection');
                markRestorationComplete();
              } catch (error) {
                console.warn(`⚠️ Could not mark restoration complete:`, error.message);
              }
              
              // Return raw SQLite instance (consistent with normal path)
              return sqlite;
            }
          } else {
            console.log(`🔄 PRODUCTION INIT: No backups available (deleted or never existed) - proceeding with fresh database initialization...`);
            console.log(`🌱 PRODUCTION INIT: This will trigger fresh seeding for production environment`);
          }
        } catch (restorationError: any) {
          console.error(`❌ PRODUCTION INIT: Restoration failed with error:`, restorationError.message);
          
          // Clean up any partially restored files
          try {
            if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
            if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
            if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
            console.log('🗑️ Partial restoration files cleaned up');
          } catch (cleanupError) {
            console.warn('⚠️ Could not clean up partial restoration files:', cleanupError.message);
          }
          
          // Set environment variable to skip future restoration attempts
          process.env.SKIP_BACKUP_RESTORATION = 'true';
          console.log('⚠️ Setting SKIP_BACKUP_RESTORATION=true due to restoration failure');
          console.log('🌱 PRODUCTION INIT: Proceeding with fresh database creation...');
        }
      }
    } else if (process.env.NODE_ENV === 'production') {
      console.log(`📊 PRODUCTION INIT: Database already exists at ${dbPath}`);
      const stats = fs.statSync(dbPath);
      console.log(`📊 PRODUCTION INIT: Existing database size: ${Math.round(stats.size / 1024)}KB`);
    }

    const sqlite = new Database(dbPath);
    
    // Enable WAL mode for better performance with I/O error handling
    try {
      sqlite.pragma('journal_mode = WAL');
      sqlite.pragma('synchronous = NORMAL');
      sqlite.pragma('cache_size = 1000');
      sqlite.pragma('temp_store = memory');
    } catch (error: any) {
      console.error(`❌ Failed to set SQLite pragmas:`, error.message);
      
      // Handle I/O errors during pragma setup
      if (error.code === 'SQLITE_IOERR' || error.code === 'SQLITE_IOERR_SHORT_READ' || error.message?.includes('disk I/O error')) {
        sqlite.close();
        fs.unlinkSync(dbPath);
        throw new Error(`Database I/O error during initialization: ${error.message}`);
      }
      
      throw error;
    }
    

    
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

    // All fields now included in CREATE TABLE statement above - no ALTER needed

    // Create other required tables
    sqlite.exec(`
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
        original_file_name TEXT,
        
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (added_by) REFERENCES users(id)
      );
    `);

    // Create job_matches table
    sqlite.exec(`
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
    `);

    // Create interviews table
    sqlite.exec(`
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
    `);

    sqlite.exec(`
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
        organization_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        team_id INTEGER NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (team_id) REFERENCES teams(id),
        UNIQUE(user_id, team_id)
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

    // Create job templates table for AI matching
    sqlite.exec(`
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
      );
    `);

    // All fields now included in CREATE TABLE statements above

    // Check if timezone column exists and is working
    const result = sqlite.prepare("PRAGMA table_info(organizations)").all();
    const hasTimezone = result.some((col: any) => col.name === 'timezone');
    
    if (!hasTimezone) {
      console.error('❌ Timezone column still missing after schema update');
      throw new Error('Failed to create timezone column');
    }

    console.log('✅ SQLite database initialized successfully');
    console.log('✅ Organizations table has timezone column');
    
    // Mark restoration as complete to allow other database access
    try {
      const { markRestorationComplete } = await import('./db-connection');
      markRestorationComplete();
    } catch (error) {
      console.warn(`⚠️ Could not mark restoration complete:`, error.message);
    }
    
    return sqlite;
  } catch (error) {
    console.error('❌ Failed to initialize SQLite database:', error);
    throw error;
  }
}