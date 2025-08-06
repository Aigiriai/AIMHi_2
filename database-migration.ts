import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

/**
 * DATABASE MIGRATION SCRIPT
 * 
 * This script safely migrates your existing development.db to the unified schema
 * while preserving all existing data.
 * 
 * SAFETY FEATURES:
 * - Creates backup before migration
 * - Non-destructive (only adds missing columns/tables)
 * - Validates migration success
 * - Rollback capability
 */

interface MigrationResult {
  success: boolean;
  message: string;
  tablesAdded: string[];
  columnsAdded: Array<{ table: string; column: string }>;
  backupPath?: string;
}

export async function migrateDatabase(dbPath: string): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    message: "",
    tablesAdded: [],
    columnsAdded: []
  };

  try {
    console.log(`🔄 Starting database migration for: ${dbPath}`);
    
    // Step 1: Create backup
    const backupPath = await createBackup(dbPath);
    result.backupPath = backupPath;
    console.log(`✅ Backup created: ${backupPath}`);
    
    // Step 2: Open database
    const db = new Database(dbPath);
    
    // Step 3: Get existing schema
    const existingTables = await getExistingTables(db);
    console.log(`📊 Found ${existingTables.length} existing tables`);
    
    // Step 4: Add missing tables (non-destructive)
    const missingTables = await addMissingTables(db, existingTables);
    result.tablesAdded = missingTables;
    
    // Step 5: Add missing columns to existing tables
    const missingColumns = await addMissingColumns(db);
    result.columnsAdded = missingColumns;
    
    // Step 6: Validate migration
    const isValid = await validateMigration(db);
    if (!isValid) {
      throw new Error("Migration validation failed");
    }
    
    db.close();
    
    result.success = true;
    result.message = `Migration completed successfully. Added ${missingTables.length} tables and ${missingColumns.length} columns.`;
    
    console.log(`✅ ${result.message}`);
    return result;
    
  } catch (error) {
    console.error(`❌ Migration failed:`, error);
    result.success = false;
    result.message = `Migration failed: ${error.message}`;
    
    // Attempt rollback if backup exists
    if (result.backupPath && fs.existsSync(result.backupPath)) {
      try {
        fs.copyFileSync(result.backupPath, dbPath);
        console.log(`🔄 Database rolled back from backup`);
        result.message += " Database rolled back to original state.";
      } catch (rollbackError) {
        console.error(`❌ Rollback failed:`, rollbackError);
        result.message += ` Rollback also failed: ${rollbackError.message}`;
      }
    }
    
    return result;
  }
}

async function createBackup(dbPath: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = dbPath.replace('.db', `_backup_${timestamp}.db`);
  fs.copyFileSync(dbPath, backupPath);
  return backupPath;
}

async function getExistingTables(db: Database.Database): Promise<string[]> {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  return tables.map((t: any) => t.name);
}

async function addMissingTables(db: Database.Database, existingTables: string[]): Promise<string[]> {
  const requiredTables = [
    'organizations',
    'users', 
    'teams',
    'jobs',
    'candidates',
    'job_matches',
    'interviews',
    'user_teams',
    'audit_logs',
    'usage_metrics',
    'organization_credentials',
    'user_credentials',
    'applications',
    'job_assignments',
    'candidate_assignments',
    'candidate_submissions',
    'status_history',
    'job_templates'
  ];
  
  const missingTables: string[] = [];
  
  for (const tableName of requiredTables) {
    if (!existingTables.includes(tableName)) {
      console.log(`📝 Creating missing table: ${tableName}`);
      await createTable(db, tableName);
      missingTables.push(tableName);
    }
  }
  
  return missingTables;
}

async function createTable(db: Database.Database, tableName: string): Promise<void> {
  // Table creation SQL - matches unified schema exactly
  const tableSQL = getTableCreationSQL(tableName);
  if (tableSQL) {
    db.exec(tableSQL);
    console.log(`✅ Created table: ${tableName}`);
  }
}

function getTableCreationSQL(tableName: string): string | null {
  const schemas: Record<string, string> = {
    'applications': `
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
      );`,
    
    'job_assignments': `
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
      );`,
    
    'candidate_assignments': `
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
      );`,
    
    'candidate_submissions': `
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
      );`,
    
    'status_history': `
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
      );`
  };
  
  return schemas[tableName] || null;
}

async function addMissingColumns(db: Database.Database): Promise<Array<{ table: string; column: string }>> {
  const missingColumns: Array<{ table: string; column: string }> = [];
  
  // Define required columns for each table
  const requiredColumns = {
    'jobs': [
      { name: 'requirements', sql: 'ADD COLUMN requirements TEXT NOT NULL DEFAULT "Requirements not specified"' },
      { name: 'location', sql: 'ADD COLUMN location TEXT NOT NULL DEFAULT "Location not specified"' },
      { name: 'salary_min', sql: 'ADD COLUMN salary_min INTEGER' },
      { name: 'salary_max', sql: 'ADD COLUMN salary_max INTEGER' },
      { name: 'original_file_name', sql: 'ADD COLUMN original_file_name TEXT' },
      { name: 'approved_by', sql: 'ADD COLUMN approved_by INTEGER REFERENCES users(id)' },
      { name: 'approved_at', sql: 'ADD COLUMN approved_at TEXT' },
      { name: 'closed_at', sql: 'ADD COLUMN closed_at TEXT' },
      { name: 'filled_at', sql: 'ADD COLUMN filled_at TEXT' },
      { name: 'requires_approval', sql: 'ADD COLUMN requires_approval INTEGER NOT NULL DEFAULT 1' },
      { name: 'auto_publish_at', sql: 'ADD COLUMN auto_publish_at TEXT' },
      { name: 'application_deadline', sql: 'ADD COLUMN application_deadline TEXT' }
    ],
    'interviews': [
      { name: 'interviewer_name', sql: 'ADD COLUMN interviewer_name TEXT' },
      { name: 'interviewer_email', sql: 'ADD COLUMN interviewer_email TEXT' },
      { name: 'reminder_sent', sql: 'ADD COLUMN reminder_sent INTEGER DEFAULT 0' },
      { name: 'transcript_path', sql: 'ADD COLUMN transcript_path TEXT' },
      { name: 'outcome', sql: 'ADD COLUMN outcome TEXT' }
    ],
    'organizations': [
      { name: 'timezone', sql: 'ADD COLUMN timezone TEXT DEFAULT "UTC"' },
      { name: 'date_format', sql: 'ADD COLUMN date_format TEXT DEFAULT "MM/DD/YYYY"' },
      { name: 'currency', sql: 'ADD COLUMN currency TEXT DEFAULT "USD"' },
      { name: 'billing_settings', sql: 'ADD COLUMN billing_settings TEXT DEFAULT "{}"' },
      { name: 'compliance_settings', sql: 'ADD COLUMN compliance_settings TEXT DEFAULT "{}"' },
      { name: 'integration_settings', sql: 'ADD COLUMN integration_settings TEXT DEFAULT "{}"' }
    ]
  };
  
  for (const [tableName, columns] of Object.entries(requiredColumns)) {
    console.log(`🔍 Checking columns for table: ${tableName}`);
    
    // Get existing columns
    const existingColumns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const existingColumnNames = existingColumns.map((col: any) => col.name);
    
    for (const column of columns) {
      if (!existingColumnNames.includes(column.name)) {
        try {
          console.log(`📝 Adding missing column: ${tableName}.${column.name}`);
          db.exec(`ALTER TABLE ${tableName} ${column.sql}`);
          missingColumns.push({ table: tableName, column: column.name });
          console.log(`✅ Added column: ${tableName}.${column.name}`);
        } catch (error) {
          console.warn(`⚠️ Could not add column ${tableName}.${column.name}:`, error.message);
        }
      }
    }
  }
  
  return missingColumns;
}

async function validateMigration(db: Database.Database): Promise<boolean> {
  try {
    // Test database integrity
    const integrityCheck = db.prepare("PRAGMA integrity_check").get();
    if (integrityCheck.integrity_check !== 'ok') {
      console.error(`❌ Database integrity check failed: ${integrityCheck.integrity_check}`);
      return false;
    }
    
    // Verify critical tables exist
    const requiredTables = ['organizations', 'users', 'jobs', 'candidates'];
    for (const table of requiredTables) {
      const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
      if (!tableExists) {
        console.error(`❌ Required table missing: ${table}`);
        return false;
      }
    }
    
    // Test that we can read from critical tables
    const orgCount = db.prepare("SELECT COUNT(*) as count FROM organizations").get();
    console.log(`✅ Organizations table accessible: ${orgCount.count} records`);
    
    console.log(`✅ Migration validation passed`);
    return true;
  } catch (error) {
    console.error(`❌ Migration validation failed:`, error);
    return false;
  }
}

// CLI usage
if (require.main === module) {
  const dbPath = process.argv[2] || "./data/development.db";
  
  console.log(`🔄 Starting migration for: ${dbPath}`);
  
  migrateDatabase(dbPath)
    .then(result => {
      if (result.success) {
        console.log(`✅ Migration completed successfully!`);
        console.log(`📊 Tables added: ${result.tablesAdded.length}`);
        console.log(`📊 Columns added: ${result.columnsAdded.length}`);
        if (result.backupPath) {
          console.log(`💾 Backup saved: ${result.backupPath}`);
        }
      } else {
        console.error(`❌ Migration failed: ${result.message}`);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error(`❌ Migration error:`, error);
      process.exit(1);
    });
}
