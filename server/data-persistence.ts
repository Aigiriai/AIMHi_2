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
   * Create a backup of the production database using Object Storage
   */
  async createBackup(): Promise<string | null> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const prodDbPath = path.join(this.dataDir, 'production.db');
    
    if (!fs.existsSync(prodDbPath)) {
      console.log('⚠️  No production database found to backup');
      return null;
    }

    // CRITICAL: Validate database has proper schema before backup
    try {
      const Database = (await import('better-sqlite3')).default;
      const db = new Database(prodDbPath, { readonly: true });
      
      // Check if organizations table exists
      const tablesResult = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='organizations'").get();
      if (!tablesResult) {
        console.log(`🚫 BACKUP BLOCKED: Database missing organizations table - will not backup incomplete database`);
        db.close();
        return null;
      }
      
      // Check if there are organizations (debug info) - but don't block backup if empty
      const orgs = db.prepare('SELECT id, name, domain FROM organizations').all();
      console.log(`🔍 DEBUG: Organizations BEFORE backup creation:`, orgs.map(o => `${o.name} (${o.domain || 'no-domain'})`).join(', ') || 'None');
      
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
      console.log(`⚠️ DEBUG: Could not validate database before backup:`, error.message);
      console.log(`🚫 BACKUP BLOCKED: Database validation failed - will not backup potentially corrupt database`);
      return null;
    }

    try {
      // Try cloud backup first (persistent)
      if (this.cloudBackupService) {
        const cloudBackupName = await this.cloudBackupService.createTimestampedBackup(prodDbPath);
        console.log(`✅ Database backup created in Object Storage: ${cloudBackupName}`);
        return cloudBackupName;
      }
      
      // Fallback to local backup (will be lost on deployment)
      const backupPath = path.join(this.backupDir, `production_${timestamp}.db`);
      fs.copyFileSync(prodDbPath, backupPath);
      
      await this.cleanOldBackups();
      
      console.log(`✅ Database backup created locally: ${backupPath}`);
      console.warn('⚠️ Local backup will not persist between deployments');
      return backupPath;
    } catch (error) {
      console.error('❌ Failed to create backup:', error);
      return null;
    }
  }

  /**
   * Restore database from the latest backup (Object Storage first, then local fallback)
   */
  async restoreFromLatestBackup(): Promise<boolean> {
    const prodDbPath = path.join(this.dataDir, 'production.db');
    
    console.log(`🔄 RESTORE: Starting database restoration process...`);
    console.log(`📁 RESTORE: Target database path: ${prodDbPath}`);
    console.log(`🌍 RESTORE: Environment: ${process.env.NODE_ENV}`);
    
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      console.log(`📁 RESTORE: Creating data directory: ${this.dataDir}`);
      fs.mkdirSync(this.dataDir, { recursive: true });
    } else {
      console.log(`📁 RESTORE: Data directory already exists: ${this.dataDir}`);
    }

    // Check if production database already exists
    if (fs.existsSync(prodDbPath)) {
      const stats = fs.statSync(prodDbPath);
      console.log(`📊 RESTORE: Existing database found (${Math.round(stats.size / 1024)}KB), will be replaced if restoration succeeds`);
    } else {
      console.log(`📊 RESTORE: No existing database found at target path`);
    }

    try {
      // Try cloud backup first (persistent)
      if (this.cloudBackupService) {
        console.log(`☁️ RESTORE: Attempting restoration from Object Storage...`);
        const restored = await this.cloudBackupService.restoreLatestBackup(prodDbPath);
        if (restored) {
          console.log(`✅ RESTORE: Database successfully restored from Object Storage backup`);
          
          // Verify restored database
          if (fs.existsSync(prodDbPath)) {
            const restoredStats = fs.statSync(prodDbPath);
            console.log(`📊 RESTORE: Restored database size: ${Math.round(restoredStats.size / 1024)}KB`);
          }
          
          // Clear connection cache to prevent stale connections after restoration
          console.log(`🔄 RESTORE: Database connection will be cached after restoration`);
          
          // Import and clear connection cache to force fresh connections
          try {
            const { clearConnectionCache } = await import('./db-connection');
            await clearConnectionCache();
            console.log('🧹 RESTORE: Connection cache cleared after Object Storage restoration');
          } catch (error) {
            console.warn('⚠️ RESTORE: Failed to clear connection cache:', error);
          }
          
          return true;
        }
        console.log(`⚠️ RESTORE: No backups found in Object Storage (likely deleted), will trigger fresh seeding...`);
      } else {
        console.log(`⚠️ RESTORE: Object Storage service not available, trying local fallback...`);
      }
      
      // Fallback to local backup (won't work in production deployments)
      console.log(`📁 RESTORE: Checking for local backups in: ${this.backupDir}`);
      
      if (!fs.existsSync(this.backupDir)) {
        console.log(`📁 RESTORE: Local backup directory does not exist`);
        return false;
      }
      
      const backups = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('production_') && file.endsWith('.db'))
        .sort()
        .reverse();

      console.log(`📋 RESTORE: Found ${backups.length} local backup files`);

      if (backups.length === 0) {
        console.log(`❌ RESTORE: No local backups found to restore from`);
        return false;
      }

      const latestBackup = path.join(this.backupDir, backups[0]);
      console.log(`🔄 RESTORE: Restoring from local backup: ${backups[0]}`);
      
      const backupStats = fs.statSync(latestBackup);
      console.log(`📊 RESTORE: Local backup size: ${Math.round(backupStats.size / 1024)}KB`);
      
      fs.copyFileSync(latestBackup, prodDbPath);
      console.log(`✅ RESTORE: Database restored from local backup: ${backups[0]}`);
      console.warn(`⚠️ RESTORE: Local backup restore will not work in production deployments`);
      
      // Clear connection cache to prevent stale connections after restoration
      try {
        const { clearConnectionCache } = await import('./db-connection');
        await clearConnectionCache();
        console.log('🧹 RESTORE: Connection cache cleared after local backup restoration');
      } catch (error) {
        console.warn('⚠️ RESTORE: Failed to clear connection cache:', error);
      }
      
      return true;
    } catch (error) {
      console.error(`❌ RESTORE: Failed to restore from backup:`, error);
      console.error(`❌ RESTORE: Error details:`, error.message);
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
   * Check if production database exists
   */
  hasProductionDatabase(): boolean {
    const prodDbPath = path.join(this.dataDir, 'production.db');
    return fs.existsSync(prodDbPath);
  }

  /**
   * Get database size and record counts for verification
   */
  async getDatabaseStats(): Promise<any> {
    const prodDbPath = path.join(this.dataDir, 'production.db');
    
    if (!fs.existsSync(prodDbPath)) {
      return { exists: false };
    }

    try {
      const stats = fs.statSync(prodDbPath);
      
      // Get record counts using better-sqlite3
      const db = new Database(prodDbPath, { readonly: true });
      
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
   * Pre-deployment data protection workflow using Object Storage
   */
  async protectDataBeforeDeployment(): Promise<void> {
    console.log('🛡️  Starting pre-deployment data protection...');
    
    if (this.hasProductionDatabase()) {
      const stats = await this.getDatabaseStats();
      console.log('📊 Current database stats:', stats);
      
      const backupName = await this.createBackup();
      if (backupName) {
        console.log('✅ Pre-deployment backup completed in Object Storage');
      } else {
        console.log('⚠️ Backup failed - continuing with deployment');
      }
    } else {
      console.log('⚠️  No production database found');
      
      // Automatically attempt restoration from latest backup
      console.log('🔄 Attempting automatic restoration from latest backup...');
      const restored = await this.restoreFromLatestBackup();
      
      if (restored) {
        console.log('✅ Database restored from Object Storage backup');
      } else {
        console.log('📦 No backup available - fresh database will be created');
      }
    }
  }

  /**
   * Auto-backup after important operations
   */
  async autoBackupIfNeeded(reason: string = 'auto'): Promise<void> {
    if (!this.hasProductionDatabase()) {
      console.log(`⚠️ Auto-backup skipped: No production database found for reason: ${reason}`);
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