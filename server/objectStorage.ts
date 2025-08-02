import { Storage, File } from "@google-cloud/storage";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// The object storage client is used to interact with the object storage service.
export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// Database backup service using Object Storage
export class DatabaseBackupService {
  private bucketId: string;
  
  constructor() {
    this.bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "";
    if (!this.bucketId) {
      throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set. Object Storage not configured.");
    }
  }

  private getBucket() {
    return objectStorageClient.bucket(this.bucketId);
  }

  // Upload database backup to Object Storage
  async uploadDatabaseBackup(localDbPath: string, backupName: string = 'production-backup.db'): Promise<string> {
    try {
      const bucket = this.getBucket();
      const file = bucket.file(`database-backups/${backupName}`);
      
      console.log(`☁️ Uploading database backup: ${backupName}`);
      
      await bucket.upload(localDbPath, {
        destination: `database-backups/${backupName}`,
        metadata: {
          metadata: {
            uploadedAt: new Date().toISOString(),
            originalPath: localDbPath,
            backupType: 'production'
          }
        }
      });
      
      console.log(`✅ Database backup uploaded successfully: ${backupName}`);
      return `database-backups/${backupName}`;
    } catch (error) {
      console.error(`❌ Failed to upload database backup:`, error);
      throw error;
    }
  }

  // Download database backup from Object Storage
  async downloadDatabaseBackup(backupName: string = 'production-backup.db', localDbPath: string): Promise<boolean> {
    try {
      const bucket = this.getBucket();
      const file = bucket.file(`database-backups/${backupName}`);
      
      // Check if backup exists
      const [exists] = await file.exists();
      if (!exists) {
        console.log(`⚠️ No backup found: ${backupName}`);
        return false;
      }
      
      console.log(`☁️ Downloading database backup: ${backupName}`);
      
      await file.download({ destination: localDbPath });
      
      console.log(`✅ Database backup downloaded successfully to: ${localDbPath}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to download database backup:`, error);
      return false;
    }
  }

  // List available database backups
  async listBackups(): Promise<string[]> {
    try {
      const bucket = this.getBucket();
      const [files] = await bucket.getFiles({ prefix: 'database-backups/' });
      
      return files.map(file => file.name.replace('database-backups/', ''));
    } catch (error) {
      console.error(`❌ Failed to list backups:`, error);
      return [];
    }
  }

  // Create a timestamped backup
  async createTimestampedBackup(localDbPath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `production-backup-${timestamp}.db`;
    
    await this.uploadDatabaseBackup(localDbPath, backupName);
    
    // Also update the main backup
    await this.uploadDatabaseBackup(localDbPath, 'production-backup.db');
    
    return backupName;
  }

  // Restore latest backup
  async restoreLatestBackup(localDbPath: string): Promise<boolean> {
    console.log(`🛡️ Attempting to restore database from Object Storage...`);
    
    // Try to download the main backup first
    const restored = await this.downloadDatabaseBackup('production-backup.db', localDbPath);
    
    if (restored) {
      console.log(`✅ Database restored from Object Storage backup`);
      return true;
    }
    
    // If main backup doesn't exist, try to find the latest timestamped backup
    const backups = await this.listBackups();
    const timestampedBackups = backups
      .filter(name => name.startsWith('production-backup-') && name.endsWith('.db'))
      .sort()
      .reverse(); // Most recent first
    
    if (timestampedBackups.length > 0) {
      const latestBackup = timestampedBackups[0];
      console.log(`🔄 Trying latest timestamped backup: ${latestBackup}`);
      return await this.downloadDatabaseBackup(latestBackup, localDbPath);
    }
    
    console.log(`❌ No backups found in Object Storage`);
    return false;
  }
}