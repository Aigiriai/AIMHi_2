// Backup integration service for automatic backups during key operations
import { dataPersistence } from './data-persistence';

// Type definitions for better type safety
interface CandidateData {
  name: string;
  id?: number;
}

interface JobData {
  title: string;
  id?: number;
}

interface UserData {
  email: string;
  id?: number;
}

interface OrganizationData {
  name: string;
  id?: number;
}

interface BackupRequest {
  reason: string;
  timestamp: number;
  priority: 'normal' | 'high';
}

export class BackupIntegrationService {
  private static instance: BackupIntegrationService;
  private backupQueue: Array<BackupRequest> = [];
  private lastBackupTime = 0;
  private minBackupInterval = 5 * 60 * 1000; // 5 minutes minimum between backups
  private isBackupInProgress = false;
  
  static getInstance(): BackupIntegrationService {
    if (!BackupIntegrationService.instance) {
      BackupIntegrationService.instance = new BackupIntegrationService();
    }
    return BackupIntegrationService.instance;
  }

  // Schedule an auto-backup with throttling
  async scheduleAutoBackup(reason: string, priority: 'normal' | 'high' = 'normal'): Promise<boolean> {
    const now = Date.now();
    
    // Skip if backup is already in progress
    if (this.isBackupInProgress) {
      console.log(`⏰ Auto-backup skipped (backup in progress): ${reason}`);
      return false;
    }
    
    // Skip if too recent (unless high priority)
    if (priority === 'normal' && now - this.lastBackupTime < this.minBackupInterval) {
      console.log(`⏰ Auto-backup skipped (too recent): ${reason}`);
      return false;
    }

    // Only backup in production environment
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔧 Auto-backup skipped (development): ${reason}`);
      return false;
    }

    // CRITICAL: Don't backup immediately after startup if database was just restored
    // This prevents overwriting good backups with empty/incomplete data
    if (reason.includes('initialization') || reason.includes('startup')) {
      console.log(`🛡️ Auto-backup skipped (system initialization): ${reason}`);
      return false;
    }

    // Validate reason parameter
    if (!reason || typeof reason !== 'string') {
      console.error('❌ Auto-backup failed: invalid reason parameter');
      return false;
    }

    this.isBackupInProgress = true;
    
    try {
      console.log(`🔄 Auto-backup triggered (${priority}): ${reason}`);
      await dataPersistence.autoBackupIfNeeded(reason);
      
      this.lastBackupTime = now;
      console.log(`✅ Auto-backup completed: ${reason}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Auto-backup failed for ${reason}: ${errorMessage}`, error);
      return false;
    } finally {
      this.isBackupInProgress = false;
    }
  }

  // Backup triggers for specific operations
  async onCandidateCreated(candidateData: CandidateData): Promise<boolean> {
    if (!candidateData || !candidateData.name) {
      console.error('❌ Invalid candidate data for backup');
      return false;
    }
    return await this.scheduleAutoBackup(`candidate_created_${candidateData.name}`);
  }

  async onJobCreated(jobData: JobData): Promise<boolean> {
    if (!jobData || !jobData.title) {
      console.error('❌ Invalid job data for backup');
      return false;
    }
    return await this.scheduleAutoBackup(`job_created_${jobData.title}`);
  }

  async onUserCreated(userData: UserData): Promise<boolean> {
    if (!userData || !userData.email) {
      console.error('❌ Invalid user data for backup');
      return false;
    }
    return await this.scheduleAutoBackup(`user_created_${userData.email}`);
  }

  async onOrganizationCreated(orgData: OrganizationData): Promise<boolean> {
    if (!orgData || !orgData.name) {
      console.error('❌ Invalid organization data for backup');
      return false;
    }
    return await this.scheduleAutoBackup(`organization_created_${orgData.name}`, 'high');
  }

  async onCandidateBulkImport(count: number): Promise<boolean> {
    if (!count || count <= 0) {
      console.error('❌ Invalid count for bulk import backup');
      return false;
    }
    return await this.scheduleAutoBackup(`bulk_import_${count}_candidates`, 'high');
  }

  async onJobDeleted(jobId: number): Promise<boolean> {
    if (!jobId || jobId <= 0) {
      console.error('❌ Invalid job ID for backup');
      return false;
    }
    return await this.scheduleAutoBackup(`job_deleted_${jobId}`);
  }

  async onDataImport(importType: string, count: number): Promise<boolean> {
    if (!importType || !count || count <= 0) {
      console.error('❌ Invalid data import parameters for backup');
      return false;
    }
    return await this.scheduleAutoBackup(`data_import_${importType}_${count}`, 'high');
  }

  // Force immediate backup (for critical operations)
  async forceBackup(reason: string): Promise<boolean> {
    // Validate reason parameter
    if (!reason || typeof reason !== 'string') {
      console.error('❌ Force backup failed: invalid reason parameter');
      return false;
    }

    const prevBackupInProgress = this.isBackupInProgress;
    this.isBackupInProgress = true;

    try {
      console.log(`🚨 Force backup triggered: ${reason}`);
      await dataPersistence.autoBackupIfNeeded(reason);
      this.lastBackupTime = Date.now();
      console.log(`✅ Force backup completed: ${reason}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Force backup failed for ${reason}: ${errorMessage}`, error);
      return false;
    } finally {
      this.isBackupInProgress = prevBackupInProgress;
    }
  }
}

// Export singleton instance
export const backupService = BackupIntegrationService.getInstance();