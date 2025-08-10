#!/usr/bin/env node

/**
 * DATABASE MIGRATION UTILITY
 * 
 * This script provides manual database migration capabilities for both
 * development and production environments. It can be run independently
 * to fix schema drift issues.
 * 
 * Usage:
 *   node migrate-database.js [development|production]
 *   npm run migrate [development|production]
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

class ManualMigrationTool {
  constructor(environment = 'development') {
    this.environment = environment;
    this.dataDir = path.join(process.cwd(), "data");
    this.dbName = environment === "production" ? "production.db" : "development.db";
    this.dbPath = path.join(this.dataDir, this.dbName);
    
    console.log(`🔧 MIGRATION_TOOL: Starting migration for ${environment} environment`);
    console.log(`📁 MIGRATION_TOOL: Database path: ${this.dbPath}`);
  }

  /**
   * Check if database exists
   */
  checkDatabaseExists() {
    if (!fs.existsSync(this.dbPath)) {
      console.log(`❌ MIGRATION_TOOL: Database file not found at ${this.dbPath}`);
      console.log(`ℹ️  MIGRATION_TOOL: Run the application first to create the database`);
      return false;
    }
    
    const stats = fs.statSync(this.dbPath);
    console.log(`✅ MIGRATION_TOOL: Database found (${Math.round(stats.size / 1024)}KB)`);
    return true;
  }

  /**
   * Add missing report_permissions column to users table
   */
  async fixUserTableMigration() {
    console.log(`🔄 MIGRATION_TOOL: Checking users table for report_permissions column...`);
    
    const sqlite = new Database(this.dbPath);
    
    try {
      // Check if column exists
      const columns = sqlite.prepare(`PRAGMA table_info(users)`).all();
      const columnNames = columns.map(col => col.name);
      
      if (columnNames.includes('report_permissions')) {
        console.log(`✅ MIGRATION_TOOL: report_permissions column already exists`);
        return true;
      }
      
      console.log(`🔄 MIGRATION_TOOL: Adding report_permissions column to users table...`);
      
      // Create backup first
      const backupPath = `${this.dbPath}.backup-${Date.now()}`;
      sqlite.backup(backupPath);
      console.log(`💾 MIGRATION_TOOL: Backup created at ${backupPath}`);
      
      // Add the column
      sqlite.exec(`ALTER TABLE users ADD COLUMN report_permissions TEXT DEFAULT '{}'`);
      
      // Verify the change
      const newColumns = sqlite.prepare(`PRAGMA table_info(users)`).all();
      const newColumnNames = newColumns.map(col => col.name);
      
      if (newColumnNames.includes('report_permissions')) {
        console.log(`✅ MIGRATION_TOOL: Successfully added report_permissions column`);
        
        // Update existing users with default permissions
        const updateResult = sqlite.prepare(`
          UPDATE users 
          SET report_permissions = '{}' 
          WHERE report_permissions IS NULL
        `).run();
        
        console.log(`✅ MIGRATION_TOOL: Updated ${updateResult.changes} existing users with default permissions`);
        return true;
      } else {
        throw new Error('Column was not added successfully');
      }
      
    } catch (error) {
      console.error(`❌ MIGRATION_TOOL: Failed to add report_permissions column:`, error);
      return false;
    } finally {
      sqlite.close();
    }
  }

  /**
   * Check and fix all schema issues
   */
  async checkAndFixAllIssues() {
    console.log(`🔍 MIGRATION_TOOL: Comprehensive schema check for ${this.environment} environment...`);
    
    if (!this.checkDatabaseExists()) {
      return false;
    }
    
    const sqlite = new Database(this.dbPath);
    let hasIssues = false;
    
    try {
      // Check all expected tables
      const expectedTables = [
        'organizations', 'teams', 'users', 'user_teams', 'jobs', 'candidates',
        'job_matches', 'interviews', 'applications', 'job_assignments',
        'candidate_assignments', 'candidate_submissions', 'status_history',
        'job_templates', 'organization_credentials', 'user_credentials',
        'usage_metrics', 'audit_logs', 'report_table_metadata', 
        'report_field_metadata', 'report_templates', 'report_executions'
      ];
      
      const existingTables = sqlite.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all().map(row => row.name);
      
      console.log(`📊 MIGRATION_TOOL: Found ${existingTables.length} existing tables`);
      console.log(`📊 MIGRATION_TOOL: Expected ${expectedTables.length} tables`);
      
      const missingTables = expectedTables.filter(table => !existingTables.includes(table));
      
      if (missingTables.length > 0) {
        console.log(`⚠️  MIGRATION_TOOL: Missing tables: ${missingTables.join(', ')}`);
        hasIssues = true;
      }
      
      // Check users table for missing columns
      if (existingTables.includes('users')) {
        const userColumns = sqlite.prepare(`PRAGMA table_info(users)`).all();
        const columnNames = userColumns.map(col => col.name);
        
        if (!columnNames.includes('report_permissions')) {
          console.log(`⚠️  MIGRATION_TOOL: Missing report_permissions column in users table`);
          hasIssues = true;
          
          // Fix this specific issue
          await this.fixUserTableMigration();
        }
      }
      
      // Check database integrity
      const integrityResult = sqlite.pragma("integrity_check", { simple: true });
      if (integrityResult !== 'ok') {
        console.log(`⚠️  MIGRATION_TOOL: Database integrity issues: ${integrityResult}`);
        hasIssues = true;
      }
      
      if (!hasIssues) {
        console.log(`✅ MIGRATION_TOOL: Database schema is healthy - no issues found`);
      }
      
      return !hasIssues;
      
    } catch (error) {
      console.error(`❌ MIGRATION_TOOL: Error during schema check:`, error);
      return false;
    } finally {
      sqlite.close();
    }
  }

  /**
   * Show database statistics
   */
  showStats() {
    if (!this.checkDatabaseExists()) {
      return;
    }
    
    const sqlite = new Database(this.dbPath);
    
    try {
      console.log(`📊 MIGRATION_TOOL: Database Statistics for ${this.environment}:`);
      
      const stats = fs.statSync(this.dbPath);
      console.log(`   File size: ${Math.round(stats.size / 1024)}KB`);
      console.log(`   Last modified: ${stats.mtime.toISOString()}`);
      
      const pageCount = sqlite.pragma('page_count', { simple: true });
      const pageSize = sqlite.pragma('page_size', { simple: true });
      console.log(`   Pages: ${pageCount} (${pageSize} bytes each)`);
      
      // Table counts
      const tables = sqlite.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all();
      
      console.log(`   Tables: ${tables.length}`);
      
      for (const table of tables) {
        try {
          const count = sqlite.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
          console.log(`     - ${table.name}: ${count.count} records`);
        } catch (error) {
          console.log(`     - ${table.name}: error counting records`);
        }
      }
      
    } catch (error) {
      console.error(`❌ MIGRATION_TOOL: Error getting stats:`, error);
    } finally {
      sqlite.close();
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const environment = args[0] || 'development';
  const command = args[1] || 'check';
  
  if (!['development', 'production'].includes(environment)) {
    console.log('Usage: node migrate-database.js [development|production] [check|fix|stats]');
    process.exit(1);
  }
  
  const migrator = new ManualMigrationTool(environment);
  
  switch (command) {
    case 'check':
    case 'fix':
      const success = await migrator.checkAndFixAllIssues();
      process.exit(success ? 0 : 1);
      break;
      
    case 'stats':
      migrator.showStats();
      break;
      
    default:
      console.log('Available commands: check, fix, stats');
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ MIGRATION_TOOL: Fatal error:', error);
    process.exit(1);
  });
}

module.exports = ManualMigrationTool;
