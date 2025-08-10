// DATABASE MIGRATION SYSTEM
// Handles schema changes gracefully for both development and production environments

import Database from "better-sqlite3";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export interface Migration {
  id: string;
  version: number;
  description: string;
  up: string[];      // SQL statements to apply migration
  down: string[];    // SQL statements to rollback migration
  timestamp: string;
}

export interface MigrationStatus {
  applied: boolean;
  appliedAt?: string;
  error?: string;
}

export class MigrationManager {
  private db: Database.Database;
  private migrationsDir: string;
  private environment: 'development' | 'production';

  constructor(db: Database.Database, environment: 'development' | 'production' = 'development') {
    this.db = db;
    this.environment = environment;
    this.migrationsDir = join(process.cwd(), 'server', 'migrations');
    
    // Ensure migrations directory exists
    if (!existsSync(this.migrationsDir)) {
      mkdirSync(this.migrationsDir, { recursive: true });
    }
    
    this.initializeMigrationsTable();
  }

  /**
   * Initialize the migrations tracking table
   */
  private initializeMigrationsTable(): void {
    const createMigrationsTableSQL = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        environment TEXT NOT NULL,
        checksum TEXT,
        execution_time_ms INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_environment ON schema_migrations(environment);
    `;

    console.log('🔧 MIGRATION_SYSTEM: Initializing migrations table...');
    this.db.exec(createMigrationsTableSQL);
    console.log('✅ MIGRATION_SYSTEM: Migrations table ready');
  }

  /**
   * Get current schema version
   */
  getCurrentVersion(): number {
    const result = this.db.prepare(`
      SELECT MAX(version) as version 
      FROM schema_migrations 
      WHERE environment = ?
    `).get(this.environment) as { version: number | null };
    
    return result.version || 0;
  }

  /**
   * Get all applied migrations for current environment
   */
  getAppliedMigrations(): Migration[] {
    const results = this.db.prepare(`
      SELECT * FROM schema_migrations 
      WHERE environment = ? 
      ORDER BY version ASC
    `).all(this.environment) as any[];

    return results.map(row => ({
      id: row.id,
      version: row.version,
      description: row.description,
      timestamp: row.applied_at,
      up: [], // Not stored in DB
      down: [] // Not stored in DB
    }));
  }

  /**
   * Check if database needs migration by comparing current schema
   */
  async checkSchemaDrift(): Promise<{
    needsMigration: boolean;
    missingColumns: string[];
    extraColumns: string[];
    missingTables: string[];
    recommendations: string[];
  }> {
    console.log('🔍 MIGRATION_SYSTEM: Checking for schema drift...');
    
    const analysis = {
      needsMigration: false,
      missingColumns: [] as string[],
      extraColumns: [] as string[],
      missingTables: [] as string[],
      recommendations: [] as string[]
    };

    try {
      // Get current database tables
      const currentTables = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all() as { name: string }[];

      const currentTableNames = new Set(currentTables.map(t => t.name));
      
      // Expected tables from our schema
      const expectedTables = [
        'organizations', 'teams', 'users', 'user_teams', 'jobs', 'candidates',
        'job_matches', 'interviews', 'applications', 'job_assignments',
        'candidate_assignments', 'candidate_submissions', 'status_history',
        'job_templates', 'organization_credentials', 'user_credentials',
        'usage_metrics', 'audit_logs', 'report_table_metadata', 
        'report_field_metadata', 'report_templates', 'report_executions'
      ];

      // Check for missing tables
      for (const table of expectedTables) {
        if (!currentTableNames.has(table)) {
          analysis.missingTables.push(table);
          analysis.needsMigration = true;
        }
      }

      // Check users table specifically for report_permissions column
      if (currentTableNames.has('users')) {
        const userColumns = this.db.prepare(`PRAGMA table_info(users)`).all() as any[];
        const columnNames = userColumns.map(col => col.name);
        
        if (!columnNames.includes('report_permissions')) {
          analysis.missingColumns.push('users.report_permissions');
          analysis.needsMigration = true;
          analysis.recommendations.push('Add report_permissions column to users table');
        }
      }

      // Log analysis results
      console.log('📊 MIGRATION_SYSTEM: Schema analysis complete');
      console.log(`   - Current tables: ${currentTableNames.size}`);
      console.log(`   - Expected tables: ${expectedTables.length}`);
      console.log(`   - Missing tables: ${analysis.missingTables.length}`);
      console.log(`   - Missing columns: ${analysis.missingColumns.length}`);
      console.log(`   - Needs migration: ${analysis.needsMigration}`);

      return analysis;
    } catch (error) {
      console.error('❌ MIGRATION_SYSTEM: Error during schema analysis:', error);
      throw error;
    }
  }

  /**
   * Generate automatic migration for missing columns/tables
   */
  async generateAutoMigration(): Promise<Migration | null> {
    const drift = await this.checkSchemaDrift();
    
    if (!drift.needsMigration) {
      console.log('✅ MIGRATION_SYSTEM: No migration needed - schema is up to date');
      return null;
    }

    const migrationId = `auto_migration_${Date.now()}`;
    const version = this.getCurrentVersion() + 1;
    const timestamp = new Date().toISOString();

    const upStatements: string[] = [];
    const downStatements: string[] = [];

    // Handle missing report_permissions column
    if (drift.missingColumns.includes('users.report_permissions')) {
      upStatements.push(`ALTER TABLE users ADD COLUMN report_permissions TEXT DEFAULT '{}';`);
      downStatements.push(`-- Note: SQLite doesn't support DROP COLUMN, manual intervention required`);
    }

    // Handle missing tables (this would be a more complex operation)
    for (const missingTable of drift.missingTables) {
      upStatements.push(`-- Missing table: ${missingTable} - requires full schema creation`);
    }

    const migration: Migration = {
      id: migrationId,
      version,
      description: `Auto-generated migration for schema drift: ${drift.missingColumns.join(', ')}`,
      up: upStatements,
      down: downStatements,
      timestamp
    };

    console.log('🔄 MIGRATION_SYSTEM: Generated auto-migration:', migration.description);
    return migration;
  }

  /**
   * Apply a migration
   */
  async applyMigration(migration: Migration): Promise<boolean> {
    const startTime = Date.now();
    console.log(`🚀 MIGRATION_SYSTEM: Applying migration ${migration.id}...`);
    console.log(`   - Version: ${migration.version}`);
    console.log(`   - Description: ${migration.description}`);
    console.log(`   - Environment: ${this.environment}`);

    // Start transaction
    const transaction = this.db.transaction(() => {
      try {
        // Execute up statements
        for (const statement of migration.up) {
          if (statement.trim() && !statement.startsWith('--')) {
            console.log(`   - Executing: ${statement.substring(0, 50)}...`);
            this.db.exec(statement);
          }
        }

        // Record migration as applied
        this.db.prepare(`
          INSERT INTO schema_migrations (
            id, version, description, applied_at, environment, 
            execution_time_ms, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          migration.id,
          migration.version,
          migration.description,
          new Date().toISOString(),
          this.environment,
          Date.now() - startTime,
          migration.timestamp
        );

        console.log(`✅ MIGRATION_SYSTEM: Migration ${migration.id} applied successfully`);
        return true;
      } catch (error) {
        console.error(`❌ MIGRATION_SYSTEM: Migration ${migration.id} failed:`, error);
        throw error;
      }
    });

    try {
      transaction();
      const elapsed = Date.now() - startTime;
      console.log(`✅ MIGRATION_SYSTEM: Migration completed in ${elapsed}ms`);
      return true;
    } catch (error) {
      console.error('❌ MIGRATION_SYSTEM: Migration transaction failed:', error);
      return false;
    }
  }

  /**
   * Auto-detect and apply necessary migrations
   */
  async autoMigrate(): Promise<boolean> {
    console.log(`🔄 MIGRATION_SYSTEM: Starting auto-migration for ${this.environment} environment`);
    
    try {
      // Check if migration is needed
      const drift = await this.checkSchemaDrift();
      
      if (!drift.needsMigration) {
        console.log('✅ MIGRATION_SYSTEM: Database schema is up to date');
        return true;
      }

      console.log('⚠️ MIGRATION_SYSTEM: Schema drift detected - applying fixes...');
      console.log('   - Missing columns:', drift.missingColumns.join(', '));
      console.log('   - Missing tables:', drift.missingTables.join(', '));

      // Generate and apply auto-migration
      const migration = await this.generateAutoMigration();
      if (migration) {
        const success = await this.applyMigration(migration);
        
        if (success) {
          console.log('✅ MIGRATION_SYSTEM: Auto-migration completed successfully');
          
          // Verify migration worked
          const postDrift = await this.checkSchemaDrift();
          if (postDrift.needsMigration) {
            console.warn('⚠️ MIGRATION_SYSTEM: Some schema issues remain after migration');
            console.warn('   - Remaining issues:', postDrift.recommendations.join(', '));
          }
        }
        
        return success;
      } else {
        console.warn('⚠️ MIGRATION_SYSTEM: Could not generate auto-migration - manual intervention required');
        return false;
      }
    } catch (error) {
      console.error('❌ MIGRATION_SYSTEM: Auto-migration failed:', error);
      return false;
    }
  }

  /**
   * Create a backup before applying migrations
   */
  async createBackup(): Promise<string | null> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = join(process.cwd(), `database-backup-${this.environment}-${timestamp}.db`);
      
      console.log(`💾 MIGRATION_SYSTEM: Creating backup at ${backupPath}...`);
      
      // Use SQLite VACUUM INTO for atomic backup
      this.db.exec(`VACUUM INTO '${backupPath}'`);
      
      console.log('✅ MIGRATION_SYSTEM: Backup created successfully');
      return backupPath;
    } catch (error) {
      console.error('❌ MIGRATION_SYSTEM: Backup creation failed:', error);
      return null;
    }
  }

  /**
   * Get migration history
   */
  getMigrationHistory(): any[] {
    return this.db.prepare(`
      SELECT * FROM schema_migrations 
      WHERE environment = ? 
      ORDER BY version DESC
    `).all(this.environment);
  }
}

// Utility function to check and apply migrations during app startup
export async function ensureDatabaseSchema(db: Database.Database, environment: 'development' | 'production' = 'development'): Promise<boolean> {
  console.log(`🔧 SCHEMA_MANAGER: Ensuring database schema for ${environment} environment`);
  
  const migrationManager = new MigrationManager(db, environment);
  
  // Create backup before any operations
  const backupPath = await migrationManager.createBackup();
  if (!backupPath && environment === 'production') {
    console.error('❌ SCHEMA_MANAGER: Cannot proceed without backup in production');
    return false;
  }

  // Auto-migrate if needed
  const success = await migrationManager.autoMigrate();
  
  if (success) {
    console.log('✅ SCHEMA_MANAGER: Database schema is ready');
  } else {
    console.error('❌ SCHEMA_MANAGER: Schema migration failed');
    if (environment === 'production') {
      console.log(`💾 SCHEMA_MANAGER: Backup available at: ${backupPath}`);
    }
  }
  
  return success;
}
