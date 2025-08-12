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
    extraTables: string[];
    recommendations: string[];
  }> {
    console.log('🔍 MIGRATION_SYSTEM: Checking for schema drift...');
    
    const analysis = {
      needsMigration: false,
      missingColumns: [] as string[],
      extraColumns: [] as string[],
      missingTables: [] as string[],
      extraTables: [] as string[],
      recommendations: [] as string[]
    };

    try {
      // Get current database tables
      const currentTables = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all() as { name: string }[];

      const currentTableNames = new Set(currentTables.map(t => t.name));
      
      // Expected tables from our schema (SINGLE SOURCE OF TRUTH)
      const expectedTables = [
        'organizations', 'teams', 'users', 'user_teams', 'jobs', 'candidates',
        'job_matches', 'interviews', 'applications', 'job_assignments',
        'candidate_assignments', 'candidate_submissions', 'status_history',
        'job_templates', 'organization_credentials', 'user_credentials',
        'usage_metrics', 'audit_logs', 'report_table_metadata', 
        'report_field_metadata', 'report_templates', 'report_executions',
        'schema_migrations'  // Essential system table for tracking migrations
      ];

      const expectedTableNames = new Set(expectedTables);

      // Check for missing tables
      for (const table of expectedTables) {
        if (!currentTableNames.has(table)) {
          analysis.missingTables.push(table);
          analysis.needsMigration = true;
        }
      }

      // Check for EXTRA tables that should be removed
      for (const table of currentTables) {
        if (!expectedTableNames.has(table.name)) {
          analysis.extraTables.push(table.name);
          analysis.needsMigration = true;
          analysis.recommendations.push(`🗑️ Remove extra table: ${table.name}`);
        }
      }

      // Check for missing columns in all existing tables
      const columnChecks = [
        { table: 'users', column: 'report_permissions' },
        { table: 'organizations', column: 'report_settings' },
        { table: 'organizations', column: 'max_report_rows' },
        { table: 'organizations', column: 'max_saved_templates' },
        { table: 'candidates', column: 'settings' }
      ];

      for (const check of columnChecks) {
        if (currentTableNames.has(check.table)) {
          const columns = this.db.prepare(`PRAGMA table_info(${check.table})`).all() as any[];
          const columnNames = columns.map(col => col.name);
          
          if (!columnNames.includes(check.column)) {
            analysis.missingColumns.push(`${check.table}.${check.column}`);
            analysis.needsMigration = true;
          }
        }
      }

      // Log analysis results
      console.log('📊 MIGRATION_SYSTEM: Schema analysis complete');
      console.log(`   - Current tables: ${currentTableNames.size}`);
      console.log(`   - Expected tables: ${expectedTables.length}`);
      console.log(`   - Missing tables: ${analysis.missingTables.length}`);
      console.log(`   - Extra tables: ${analysis.extraTables.length}`);
      console.log(`   - Missing columns: ${analysis.missingColumns.length}`);
      console.log(`   - Needs migration: ${analysis.needsMigration}`);

      if (analysis.extraTables.length > 0) {
        console.log('🗑️  Extra tables to be removed:', analysis.extraTables);
      }

      return analysis;
    } catch (error) {
      console.error('❌ MIGRATION_SYSTEM: Error during schema analysis:', error);
      throw error;
    }
  }

  /**
   * Generate automatic migration for schema alignment (additions AND cleanup)
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

    // Handle ALL missing columns with schema-aware defaults
    for (const columnRef of drift.missingColumns) {
      const [tableName, columnName] = columnRef.split('.');
      let alterStatement = '';
      
      // Schema-aware column definitions with proper datatypes
      if (tableName === 'users' && columnName === 'report_permissions') {
        alterStatement = `ALTER TABLE users ADD COLUMN report_permissions TEXT DEFAULT '{}';`;
      } else if (tableName === 'organizations') {
        if (columnName === 'report_settings') {
          alterStatement = `ALTER TABLE organizations ADD COLUMN report_settings TEXT DEFAULT '{}';`;
        } else if (columnName === 'max_report_rows') {
          alterStatement = `ALTER TABLE organizations ADD COLUMN max_report_rows INTEGER NOT NULL DEFAULT 10000;`;
        } else if (columnName === 'max_saved_templates') {
          alterStatement = `ALTER TABLE organizations ADD COLUMN max_saved_templates INTEGER NOT NULL DEFAULT 50;`;
        }
      } else if (tableName === 'candidates' && columnName === 'settings') {
        alterStatement = `ALTER TABLE candidates ADD COLUMN settings TEXT DEFAULT '{}';`;
      }
      
      if (alterStatement) {
        upStatements.push(alterStatement);
        downStatements.push(`-- Note: SQLite doesn't support DROP COLUMN for ${columnRef}`);
      }
    }

    // SCHEMA CLEANUP: Handle extra tables that need to be removed
    console.log('🗑️ MIGRATION_SYSTEM: Processing schema cleanup...');
    for (const extraTable of drift.extraTables) {
      console.log(`   - Scheduling removal of extra table: ${extraTable}`);
      upStatements.push(`DROP TABLE IF EXISTS ${extraTable};`);
      // Note: Down migration would need to recreate the table, but since it's not in our schema,
      // we can't recreate it properly. Log this as a warning.
      downStatements.push(`-- WARNING: Cannot recreate removed table '${extraTable}' - not in current schema`);
    }

    // Handle ALL missing tables with complete CREATE TABLE statements
    for (const missingTable of drift.missingTables) {
      const createStatement = this.getTableCreationSQL(missingTable);
      if (createStatement) {
        upStatements.push(createStatement);
        downStatements.push(`DROP TABLE IF EXISTS ${missingTable};`);
      } else {
        upStatements.push(`-- WARNING: No schema definition found for table: ${missingTable}`);
      }
    }

    const migration: Migration = {
      id: migrationId,
      version,
      description: `Auto-generated schema alignment - ${drift.missingColumns.length} columns, ${drift.missingTables.length} tables added, ${drift.extraTables.length} tables removed`,
      up: upStatements,
      down: downStatements,
      timestamp
    };

    console.log('🔄 MIGRATION_SYSTEM: Generated comprehensive schema alignment migration:');
    console.log(`   - Description: ${migration.description}`);
    console.log(`   - Up statements: ${upStatements.length}`);
    console.log(`   - Schema cleanup: ${drift.extraTables.length > 0 ? 'YES' : 'NO'}`);
    return migration;
  }

  /**
   * Get CREATE TABLE SQL for missing tables
   */
  private getTableCreationSQL(tableName: string): string | null {
    const schemas: Record<string, string> = {
      'report_table_metadata': `
        CREATE TABLE IF NOT EXISTS report_table_metadata (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_name TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          description TEXT,
          category TEXT NOT NULL,
          is_active INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
        );`,
      
      'report_field_metadata': `
        CREATE TABLE IF NOT EXISTS report_field_metadata (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_id INTEGER NOT NULL,
          field_name TEXT NOT NULL,
          display_name TEXT NOT NULL,
          description TEXT,
          field_type TEXT NOT NULL,
          data_type TEXT NOT NULL,
          is_filterable INTEGER DEFAULT 1,
          is_groupable INTEGER DEFAULT 1,
          is_aggregatable INTEGER DEFAULT 0,
          default_aggregation TEXT,
          format_hint TEXT,
          is_active INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          validation_rules TEXT DEFAULT '{}',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
          FOREIGN KEY (table_id) REFERENCES report_table_metadata(id) ON DELETE CASCADE
        );`,
      
      'report_templates': `
        CREATE TABLE IF NOT EXISTS report_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          organization_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          template_name TEXT NOT NULL,
          description TEXT,
          is_public INTEGER DEFAULT 0,
          category TEXT DEFAULT 'custom',
          selected_tables TEXT DEFAULT '[]',
          selected_rows TEXT DEFAULT '[]',
          selected_columns TEXT DEFAULT '[]',
          selected_measures TEXT DEFAULT '[]',
          filters TEXT DEFAULT '[]',
          chart_type TEXT DEFAULT 'table',
          chart_config TEXT DEFAULT '{}',
          generated_sql TEXT,
          last_executed_at TEXT,
          execution_count INTEGER DEFAULT 0,
          avg_execution_time INTEGER DEFAULT 0,
          created_by INTEGER NOT NULL,
          shared_with TEXT DEFAULT '[]',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id)
        );`,
      
      'report_executions': `
        CREATE TABLE IF NOT EXISTS report_executions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          organization_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          template_id INTEGER,
          report_type TEXT NOT NULL,
          generated_sql TEXT NOT NULL,
          parameters TEXT DEFAULT '{}',
          result_count INTEGER,
          execution_time INTEGER,
          status TEXT NOT NULL DEFAULT 'running',
          error_message TEXT,
          memory_usage INTEGER,
          rows_processed INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
          completed_at TEXT,
          FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (template_id) REFERENCES report_templates(id) ON DELETE SET NULL
        );`
    };

    return schemas[tableName] || null;
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
        // Execute up statements with enhanced error handling
        for (const statement of migration.up) {
          if (statement.trim() && !statement.startsWith('--')) {
            console.log(`   - Executing: ${statement.substring(0, 50)}...`);
            try {
              this.db.exec(statement);
            } catch (statementError: any) {
              // Handle specific cases where operations might fail safely
              if (statement.includes('DROP TABLE IF EXISTS')) {
                console.log(`   ⚠️  Table drop operation handled: ${statementError?.message || 'Unknown error'}`);
                // Continue execution - IF EXISTS should handle this
              } else {
                throw statementError;
              }
            }
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

      // Also upload this pre-migration backup to Object Storage if configured
      try {
        // Lazy import to avoid coupling when cloud is not configured
        const { DatabaseBackupService } = await import('../objectStorage');
        const svc = new DatabaseBackupService();
        const baseName = `pre-migration-${this.environment}-${timestamp}.db`;
        const objectKey = await svc.uploadBackupFile(backupPath, baseName);
        console.log(`☁️ MIGRATION_SYSTEM: Uploaded pre-migration backup to Object Storage as ${objectKey}`);
      } catch (cloudError) {
        console.warn('⚠️ MIGRATION_SYSTEM: Could not upload pre-migration backup to Object Storage:', cloudError instanceof Error ? cloudError.message : String(cloudError));
      }
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
