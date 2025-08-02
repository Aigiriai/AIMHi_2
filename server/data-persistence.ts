// Data persistence manager for production database protection
import fs from 'fs';
import path from 'path';

export class DataPersistenceManager {
  private backupDir = path.join(process.cwd(), 'backups');
  private dataDir = path.join(process.cwd(), 'data');
  
  constructor() {
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Create a backup of the production database
   */
  async createBackup(): Promise<string | null> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const prodDbPath = path.join(this.dataDir, 'production.db');
    
    if (!fs.existsSync(prodDbPath)) {
      console.log('⚠️  No production database found to backup');
      return null;
    }

    try {
      const backupPath = path.join(this.backupDir, `production_${timestamp}.db`);
      fs.copyFileSync(prodDbPath, backupPath);
      
      // Keep only last 10 backups
      await this.cleanOldBackups();
      
      console.log(`✅ Database backup created: ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.error('❌ Failed to create backup:', error);
      return null;
    }
  }

  /**
   * Restore database from the latest backup
   */
  async restoreFromLatestBackup(): Promise<boolean> {
    try {
      const backups = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('production_') && file.endsWith('.db'))
        .sort()
        .reverse();

      if (backups.length === 0) {
        console.log('❌ No backups found to restore from');
        return false;
      }

      const latestBackup = path.join(this.backupDir, backups[0]);
      const prodDbPath = path.join(this.dataDir, 'production.db');
      
      // Ensure data directory exists
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      fs.copyFileSync(latestBackup, prodDbPath);
      console.log(`✅ Database restored from backup: ${backups[0]}`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to restore from backup:', error);
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
      
      // Get record counts using sqlite3 command
      const sqlite3 = require('better-sqlite3');
      const db = sqlite3(prodDbPath, { readonly: true });
      
      const orgCount = db.prepare('SELECT COUNT(*) as count FROM organizations').get()?.count || 0;
      const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get()?.count || 0;
      const jobCount = db.prepare('SELECT COUNT(*) as count FROM jobs').get()?.count || 0;
      const candidateCount = db.prepare('SELECT COUNT(*) as count FROM candidates').get()?.count || 0;
      
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
   * Pre-deployment data protection workflow
   */
  async protectDataBeforeDeployment(): Promise<void> {
    console.log('🛡️  Starting pre-deployment data protection...');
    
    if (this.hasProductionDatabase()) {
      const stats = await this.getDatabaseStats();
      console.log('📊 Current database stats:', stats);
      
      await this.createBackup();
      console.log('✅ Pre-deployment backup completed');
    } else {
      console.log('⚠️  No production database found - attempting restoration...');
      const restored = await this.restoreFromLatestBackup();
      
      if (restored) {
        console.log('✅ Database restored from backup');
      } else {
        console.log('📦 No backup available - fresh database will be created');
      }
    }
  }
}

export const dataPersistence = new DataPersistenceManager();