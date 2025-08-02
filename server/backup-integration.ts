// Backup integration service for automatic backups during key operations
import { dataPersistence } from './data-persistence';

export class BackupIntegrationService {
  private static instance: BackupIntegrationService;
  private backupQueue: Array<{ reason: string; timestamp: number }> = [];
  private lastBackupTime = 0;
  private minBackupInterval = 5 * 60 * 1000; // 5 minutes minimum between backups
  
  static getInstance(): BackupIntegrationService {
    if (!BackupIntegrationService.instance) {
      BackupIntegrationService.instance = new BackupIntegrationService();
    }
    return BackupIntegrationService.instance;
  }

  // Schedule an auto-backup with throttling
  async scheduleAutoBackup(reason: string): Promise<void> {
    const now = Date.now();
    
    // Skip if too recent
    if (now - this.lastBackupTime < this.minBackupInterval) {
      console.log(`⏰ Auto-backup skipped (too recent): ${reason}`);
      return;
    }

    // Only backup in production environment
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔧 Auto-backup skipped (development): ${reason}`);
      return;
    }

    try {
      console.log(`🔄 Auto-backup triggered: ${reason}`);
      await dataPersistence.autoBackupIfNeeded(reason);
      this.lastBackupTime = now;
    } catch (error) {
      console.error(`❌ Auto-backup failed for ${reason}:`, error);
    }
  }

  // Backup triggers for specific operations
  async onCandidateCreated(candidateData: any): Promise<void> {
    await this.scheduleAutoBackup(`candidate_created_${candidateData.name}`);
  }

  async onJobCreated(jobData: any): Promise<void> {
    await this.scheduleAutoBackup(`job_created_${jobData.title}`);
  }

  async onUserCreated(userData: any): Promise<void> {
    await this.scheduleAutoBackup(`user_created_${userData.email}`);
  }

  async onOrganizationCreated(orgData: any): Promise<void> {
    await this.scheduleAutoBackup(`organization_created_${orgData.name}`);
  }

  async onCandidateBulkImport(count: number): Promise<void> {
    await this.scheduleAutoBackup(`bulk_import_${count}_candidates`);
  }

  async onJobDeleted(jobId: number): Promise<void> {
    await this.scheduleAutoBackup(`job_deleted_${jobId}`);
  }

  async onDataImport(importType: string, count: number): Promise<void> {
    await this.scheduleAutoBackup(`data_import_${importType}_${count}`);
  }

  // Force immediate backup (for critical operations)
  async forceBackup(reason: string): Promise<void> {
    try {
      console.log(`🚨 Force backup triggered: ${reason}`);
      await dataPersistence.autoBackupIfNeeded(reason);
      this.lastBackupTime = Date.now();
    } catch (error) {
      console.error(`❌ Force backup failed for ${reason}:`, error);
    }
  }
}

// Export singleton instance
export const backupService = BackupIntegrationService.getInstance();