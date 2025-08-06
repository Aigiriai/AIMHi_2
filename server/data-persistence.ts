// Data persistence manager for production database protection using Object Storage
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { DatabaseBackupService } from './objectStorage';

export class DataPersistenceManager {
  private backupDir = path.join(process.cwd(), 'backups');
  private dataDir = path.join(process.cwd(), 'data');
  private cloudBackupService: DatabaseBackupService | null = null;
  
  constructor() {
    // Ensure backup directory exists for local fallback
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    
    // Initialize cloud backup service if available
    try {
      this.cloudBackupService = new DatabaseBackupService();
      console.log('☁️ Object Storage backup service initialized');
    } catch (error) {
      console.warn('⚠️ Object Storage not available - using local backup only');
      this.cloudBackupService = null;
    }
  }

  /**
   * Create a backup of the current database (single backup file approach)
   * This replaces any existing backup with the current database state
   */
  async createBackup(): Promise<string | null> {
    // Use environment-appropriate database file
    const dbName = process.env.NODE_ENV === "production" ? "production.db" : "development.db";
    const currentDbPath = path.join(this.dataDir, dbName);
    
    if (!fs.existsSync(currentDbPath)) {
      console.log(`⚠️ BACKUP: No database found to backup at: ${currentDbPath}`);
      return null;
    }

    // CRITICAL: Validate database has proper schema before backup
    try {
      const Database = (await import('better-sqlite3')).default;
      const db = new Database(currentDbPath, { readonly: true });
      
      // Check if organizations table exists
      const tablesResult = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='organizations'").get();
      if (!tablesResult) {
        console.log(`🚫 BACKUP BLOCKED: Database missing organizations table - will not backup incomplete database`);
        db.close();
        return null;
      }
      
      // Check if there are organizations (debug info) - but don't block backup if empty
      const orgs = db.prepare('SELECT id, name, domain FROM organizations').all();
      console.log(`🔍 BACKUP: Organizations in database:`, orgs.map((o: any) => `${o.name} (${o.domain || 'no-domain'})`).join(', ') || 'None');
      
      // Additional validation: check if we have essential tables
      const essentialTables = ['users', 'organizations'];
      for (const tableName of essentialTables) {
        const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
        if (!tableExists) {
          console.log(`🚫 BACKUP BLOCKED: Database missing essential table: ${tableName}`);
          db.close();
          return null;
        }
      }
      
      db.close();
      console.log(`✅ BACKUP VALIDATION: Database schema is complete, proceeding with backup`);
    } catch (error) {
      console.log(`⚠️ BACKUP: Could not validate database before backup:`, (error as Error).message);
      console.log(`🚫 BACKUP BLOCKED: Database validation failed - will not backup potentially corrupt database`);
      return null;
    }

    // Define backup file path (single backup file)
    const backupFileName = `backup.db`; // Single backup file name
    const localBackupPath = path.join(this.backupDir, backupFileName);

    try {
      console.log(`🔄 BACKUP: Creating backup from ${dbName} database...`);
      console.log(`📁 BACKUP: Source: ${currentDbPath}`);
      console.log(`📁 BACKUP: Target: ${localBackupPath}`);

      // Try cloud backup first (persistent)
      if (this.cloudBackupService) {
        const cloudBackupName = await this.cloudBackupService.createTimestampedBackup(currentDbPath);
        console.log(`✅ Database backup created in Object Storage: ${cloudBackupName}`);
        
        // Also create local backup for faster restore
        fs.copyFileSync(currentDbPath, localBackupPath);
        console.log(`✅ Local backup copy created: ${localBackupPath}`);
        
        return cloudBackupName;
      }
      
      // Fallback to local backup only
      // Remove existing backup if it exists
      if (fs.existsSync(localBackupPath)) {
        const existingStats = fs.statSync(localBackupPath);
        console.log(`🗑️ BACKUP: Removing existing backup (${Math.round(existingStats.size / 1024)}KB)`);
        fs.unlinkSync(localBackupPath);
      }
      
      fs.copyFileSync(currentDbPath, localBackupPath);
      const newStats = fs.statSync(localBackupPath);
      
      console.log(`✅ Database backup created locally: ${localBackupPath} (${Math.round(newStats.size / 1024)}KB)`);
      console.warn('⚠️ Local backup will not persist between deployments');
      return localBackupPath;
    } catch (error) {
      console.error('❌ Failed to create backup:', error);
      return null;
    }
  }

  /**
   * Restore database from the latest backup (single backup file approach)
   * Works in both development and production environments
   */
  async restoreFromLatestBackup(): Promise<boolean> {
    // Use environment-appropriate database file
    const dbName = process.env.NODE_ENV === "production" ? "production.db" : "development.db";
    const targetDbPath = path.join(this.dataDir, dbName);
    
    console.log(`🔄 RESTORE: Starting database restoration process...`);
    console.log(`📁 RESTORE: Target database path: ${targetDbPath}`);
    console.log(`🌍 RESTORE: Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      console.log(`📁 RESTORE: Creating data directory: ${this.dataDir}`);
      fs.mkdirSync(this.dataDir, { recursive: true });
    } else {
      console.log(`📁 RESTORE: Data directory already exists: ${this.dataDir}`);
    }

    // Check if target database already exists
    if (fs.existsSync(targetDbPath)) {
      const stats = fs.statSync(targetDbPath);
      console.log(`📊 RESTORE: Existing database found (${Math.round(stats.size / 1024)}KB), will be replaced if restoration succeeds`);
    } else {
      console.log(`📊 RESTORE: No existing database found at target path`);
    }

    try {
      // Try cloud backup first (persistent)
      if (this.cloudBackupService) {
        console.log(`☁️ RESTORE: Attempting restoration from Object Storage...`);
        const restored = await this.cloudBackupService.restoreLatestBackup(targetDbPath);
        if (restored) {
          console.log(`✅ RESTORE: Database successfully restored from Object Storage backup`);
          
          // Verify restored database
          if (fs.existsSync(targetDbPath)) {
            const restoredStats = fs.statSync(targetDbPath);
            console.log(`📊 RESTORE: Restored database size: ${Math.round(restoredStats.size / 1024)}KB`);
          }
          
          return true;
        }
        console.log(`⚠️ RESTORE: No backups found in Object Storage, trying local backup...`);
      } else {
        console.log(`⚠️ RESTORE: Object Storage service not available, trying local backup...`);
      }
      
      // Try local backup (single backup.db file)
      const localBackupPath = path.join(this.backupDir, 'backup.db');
      console.log(`📁 RESTORE: Checking for local backup: ${localBackupPath}`);
      
      if (!fs.existsSync(localBackupPath)) {
        console.log(`📁 RESTORE: No local backup file found`);
        return false;
      }

      const backupStats = fs.statSync(localBackupPath);
      console.log(`📊 RESTORE: Local backup found (${Math.round(backupStats.size / 1024)}KB, modified: ${backupStats.mtime.toISOString()})`);
      
      // Validate backup before restoration
      try {
        console.log(`� RESTORE: Validating backup file before restoration...`);
        const Database = (await import('better-sqlite3')).default;
        const backupDb = new Database(localBackupPath, { readonly: true });
        
        // Check integrity
        const integrityResult = backupDb.pragma('integrity_check', { simple: true });
        if (integrityResult !== 'ok') {
          backupDb.close();
          console.error(`❌ RESTORE: Backup file is corrupted (integrity check failed: ${integrityResult})`);
          return false;
        }
        
        // Check essential tables
        const essentialTables = ['organizations', 'users'];
        for (const tableName of essentialTables) {
          const tableExists = backupDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
          if (!tableExists) {
            backupDb.close();
            console.error(`❌ RESTORE: Backup file missing essential table: ${tableName}`);
            return false;
          }
        }
        
        backupDb.close();
        console.log(`✅ RESTORE: Backup file validation passed`);
      } catch (validationError) {
        console.error(`❌ RESTORE: Backup validation failed:`, (validationError as Error).message);
        return false;
      }
      
      // Perform restoration
      console.log(`🔄 RESTORE: Restoring from local backup: backup.db`);
      fs.copyFileSync(localBackupPath, targetDbPath);
      console.log(`✅ RESTORE: Database restored from local backup`);
      
      return true;
    } catch (error) {
      console.error(`❌ RESTORE: Failed to restore from backup:`, error);
      console.error(`❌ RESTORE: Error details:`, (error as Error).message);
      return false;
    }
  }

  /**
   * Clean old backups, keeping only the last 10
   */
  private async cleanOldBackups(): Promise<void> {
    try {
      const backups = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('production_') && file.endsWith('.db'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          mtime: fs.statSync(path.join(this.backupDir, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Remove backups beyond the 10 most recent
      const toDelete = backups.slice(10);
      for (const backup of toDelete) {
        fs.unlinkSync(backup.path);
        console.log(`🧹 Removed old backup: ${backup.name}`);
      }
    } catch (error) {
      console.error('⚠️  Error cleaning old backups:', error);
    }
  }

  /**
   * Check if current environment database exists
   */
  hasCurrentDatabase(): boolean {
    const dbName = process.env.NODE_ENV === "production" ? "production.db" : "development.db";
    const dbPath = path.join(this.dataDir, dbName);
    return fs.existsSync(dbPath);
  }

  /**
   * Legacy method for backwards compatibility
   */
  hasProductionDatabase(): boolean {
    return this.hasCurrentDatabase();
  }

  /**
   * Get database size and record counts for verification (environment-aware)
   */
  async getDatabaseStats(): Promise<any> {
    const dbName = process.env.NODE_ENV === "production" ? "production.db" : "development.db";
    const dbPath = path.join(this.dataDir, dbName);
    
    if (!fs.existsSync(dbPath)) {
      return { exists: false, environment: process.env.NODE_ENV || 'development' };
    }

    try {
      const stats = fs.statSync(dbPath);
      
      // Get record counts using better-sqlite3
      const db = new Database(dbPath, { readonly: true });
      
      const orgCount = (db.prepare('SELECT COUNT(*) as count FROM organizations').get() as any)?.count || 0;
      const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any)?.count || 0;
      const jobCount = (db.prepare('SELECT COUNT(*) as count FROM jobs').get() as any)?.count || 0;
      const candidateCount = (db.prepare('SELECT COUNT(*) as count FROM candidates').get() as any)?.count || 0;
      
      db.close();

      return {
        exists: true,
        size: stats.size,
        modified: stats.mtime,
        records: {
          organizations: orgCount,
          users: userCount,
          jobs: jobCount,
          candidates: candidateCount
        }
      };
    } catch (error) {
      console.error('❌ Error getting database stats:', error);
      return { exists: true, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Pre-deployment data protection workflow (environment-aware)
   */
  async protectDataBeforeDeployment(): Promise<void> {
    console.log('🛡️ Starting pre-deployment data protection...');
    
    if (this.hasCurrentDatabase()) {
      const stats = await this.getDatabaseStats();
      console.log('📊 Current database stats:', stats);
      
      const backupName = await this.createBackup();
      if (backupName) {
        console.log('✅ Pre-deployment backup completed');
      } else {
        console.log('⚠️ Backup failed - continuing with deployment');
      }
    } else {
      console.log('⚠️ No current database found');
      
      // Automatically attempt restoration from latest backup
      console.log('🔄 Attempting automatic restoration from latest backup...');
      const restored = await this.restoreFromLatestBackup();
      
      if (restored) {
        console.log('✅ Database restored from backup');
      } else {
        console.log('📦 No backup available - fresh database will be created');
      }
    }
  }

  /**
   * Auto-backup after important operations (environment-aware)
   */
  async autoBackupIfNeeded(reason: string = 'auto'): Promise<void> {
    if (!this.hasCurrentDatabase()) {
      console.log(`⚠️ Auto-backup skipped: No database found for reason: ${reason}`);
      return;
    }

    console.log(`🔄 Auto-backup triggered: ${reason}`);
    const backupName = await this.createBackup();
    if (backupName) {
      console.log(`✅ Auto-backup completed: ${backupName}`);
    } else {
      console.log(`❌ Auto-backup failed for reason: ${reason}`);
    }
  }
}

export const dataPersistence = new DataPersistenceManager();