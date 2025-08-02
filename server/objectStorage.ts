import { Storage, File } from "@google-cloud/storage";
import * as fs from 'fs';
import * as path from 'path';

const REPLIT_SIDECAR_ENDPOINT = process.env.REPLIT_SIDECAR_ENDPOINT || "http://127.0.0.1:1106";

// Custom error types for better error handling
export class ObjectStorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ObjectStorageConfigError";
    Object.setPrototypeOf(this, ObjectStorageConfigError.prototype);
  }
}

export class ObjectStorageUploadError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = "ObjectStorageUploadError";
    Object.setPrototypeOf(this, ObjectStorageUploadError.prototype);
  }
}

export class ObjectStorageDownloadError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = "ObjectStorageDownloadError";
    Object.setPrototypeOf(this, ObjectStorageDownloadError.prototype);
  }
}

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
      throw new ObjectStorageConfigError(
        "DEFAULT_OBJECT_STORAGE_BUCKET_ID not set. Object Storage not configured. " +
        "Please ensure Object Storage is properly initialized."
      );
    }
    
    // Validate bucket ID format
    if (!this.bucketId.startsWith('replit-objstore-')) {
      throw new ObjectStorageConfigError(
        `Invalid bucket ID format: ${this.bucketId}. Expected format: replit-objstore-*`
      );
    }
  }

  private getBucket() {
    return objectStorageClient.bucket(this.bucketId);
  }

  // Calculate MD5 checksum for file integrity verification
  private async calculateFileChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const crypto = require('crypto');
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data: Buffer) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (error: Error) => reject(error));
    });
  }

  // Upload database backup to Object Storage
  async uploadDatabaseBackup(localDbPath: string, backupName: string = 'production-backup.db'): Promise<string> {
    // Validate input parameters
    if (!localDbPath || typeof localDbPath !== 'string') {
      throw new ObjectStorageUploadError('Invalid localDbPath: must be a non-empty string');
    }
    
    if (!backupName || typeof backupName !== 'string') {
      throw new ObjectStorageUploadError('Invalid backupName: must be a non-empty string');
    }
    
    // Check if local file exists
    if (!fs.existsSync(localDbPath)) {
      throw new ObjectStorageUploadError(`Local database file not found: ${localDbPath}`);
    }
    
    // Validate file size (prevent uploading empty or corrupted files)
    const stats = fs.statSync(localDbPath);
    if (stats.size === 0) {
      throw new ObjectStorageUploadError(`Database file is empty: ${localDbPath}`);
    }
    
    try {
      const bucket = this.getBucket();
      const destinationPath = `database-backups/${backupName}`;
      
      console.log(`☁️ Uploading database backup: ${backupName} (${Math.round(stats.size / 1024)}KB)`);
      
      await bucket.upload(localDbPath, {
        destination: destinationPath,
        metadata: {
          metadata: {
            uploadedAt: new Date().toISOString(),
            originalPath: localDbPath,
            backupType: 'production',
            fileSize: stats.size.toString(),
            checksumMD5: await this.calculateFileChecksum(localDbPath)
          }
        },
        resumable: false, // Use simple upload for smaller database files
        timeout: 60000 // 60 second timeout
      });
      
      console.log(`✅ Database backup uploaded successfully: ${backupName}`);
      return destinationPath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to upload database backup:`, error);
      throw new ObjectStorageUploadError(
        `Failed to upload database backup '${backupName}': ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  // Download database backup from Object Storage
  async downloadDatabaseBackup(backupName: string = 'production-backup.db', localDbPath: string): Promise<boolean> {
    // Validate input parameters
    if (!backupName || typeof backupName !== 'string') {
      throw new ObjectStorageDownloadError('Invalid backupName: must be a non-empty string');
    }
    
    if (!localDbPath || typeof localDbPath !== 'string') {
      throw new ObjectStorageDownloadError('Invalid localDbPath: must be a non-empty string');
    }
    
    // Ensure destination directory exists
    const destinationDir = path.dirname(localDbPath);
    if (!fs.existsSync(destinationDir)) {
      fs.mkdirSync(destinationDir, { recursive: true });
    }
    
    try {
      const bucket = this.getBucket();
      const file = bucket.file(`database-backups/${backupName}`);
      
      // Check if backup exists
      const [exists] = await file.exists();
      if (!exists) {
        console.log(`⚠️ No backup found: ${backupName}`);
        return false;
      }
      
      // Get file metadata for logging
      const [metadata] = await file.getMetadata();
      const fileSize = metadata.size ? Math.round(parseInt(metadata.size) / 1024) : 'unknown';
      
      console.log(`☁️ Downloading database backup: ${backupName} (${fileSize}KB)`);
      
      // Download with timeout and validation
      await file.download({ 
        destination: localDbPath,
        validation: 'md5' // Verify integrity during download
      });
      
      // Verify downloaded file exists and is not empty
      if (!fs.existsSync(localDbPath)) {
        throw new ObjectStorageDownloadError('Downloaded file was not created');
      }
      
      const downloadedStats = fs.statSync(localDbPath);
      if (downloadedStats.size === 0) {
        fs.unlinkSync(localDbPath); // Clean up empty file
        throw new ObjectStorageDownloadError('Downloaded file is empty');
      }
      
      console.log(`✅ Database backup downloaded successfully to: ${localDbPath}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to download database backup:`, error);
      
      // Clean up partial download if it exists
      if (fs.existsSync(localDbPath)) {
        try {
          fs.unlinkSync(localDbPath);
        } catch (cleanupError) {
          console.warn('Failed to clean up partial download:', cleanupError);
        }
      }
      
      throw new ObjectStorageDownloadError(
        `Failed to download database backup '${backupName}': ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  // List available database backups
  async listBackups(): Promise<string[]> {
    try {
      const bucket = this.getBucket();
      const [files] = await bucket.getFiles({ 
        prefix: 'database-backups/',
        maxResults: 1000 // Limit to prevent memory issues
      });
      
      // Filter and sort backups
      const backupNames = files
        .filter(file => file.name.startsWith('database-backups/') && file.name.endsWith('.db'))
        .map(file => file.name.replace('database-backups/', ''))
        .sort(); // Sort alphabetically
      
      console.log(`📋 Found ${backupNames.length} database backups in Object Storage`);
      return backupNames;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to list backups:', error);
      throw new ObjectStorageDownloadError(
        `Failed to list database backups: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
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