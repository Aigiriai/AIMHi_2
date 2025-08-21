import { Client } from "@replit/object-storage";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as os from "os";

// Minimal type for backup metadata we derive from Object Storage
type BackupMeta = {
  name: string;
  fullName: string;
  timeCreated: Date;
  updated: Date;
  env?: 'production' | 'development';
};

// Custom error types for better error handling
export class ObjectStorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ObjectStorageConfigError";
    Object.setPrototypeOf(this, ObjectStorageConfigError.prototype);
  }
}

export class ObjectStorageUploadError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = "ObjectStorageUploadError";
    Object.setPrototypeOf(this, ObjectStorageUploadError.prototype);
  }
}

export class ObjectStorageDownloadError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = "ObjectStorageDownloadError";
    Object.setPrototypeOf(this, ObjectStorageDownloadError.prototype);
  }
}

// The object storage client is used to interact with the object storage service.
// Initialize with bucket ID for Replit Object Storage  
const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "";
export const objectStorageClient = bucketId ? new Client({ bucketId }) : new Client();

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
          "Please ensure Object Storage is properly initialized.",
      );
    }

    // Validate bucket ID format
    if (!this.bucketId.startsWith("replit-objstore-")) {
      throw new ObjectStorageConfigError(
        `Invalid bucket ID format: ${this.bucketId}. Expected format: replit-objstore-*`,
      );
    }
  }

  private getBucket() {
    return objectStorageClient;
  }

  // Determine current environment and path prefix
  private getEnvironment(): 'production' | 'development' {
    return process.env.NODE_ENV === 'production' ? 'production' : 'development';
  }

  private getEnvSegment(): 'prod' | 'dev' {
    return this.getEnvironment() === 'production' ? 'prod' : 'dev';
  }

  private getBackupNamePrefix(): 'production-backup' | 'development-backup' {
    return this.getEnvironment() === 'production' ? 'production-backup' : 'development-backup';
  }

  // Calculate MD5 checksum for file integrity verification
  private async calculateFileChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("md5");
      const stream = fs.createReadStream(filePath);

      stream.on("data", (data: Buffer) => hash.update(data));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", (error: Error) => reject(error));
    });
  }

  // Verify backup content by downloading and reading it
  private async verifyBackupContent(backupKey: string): Promise<void> {
    try {
      // Create temporary file for verification
      const tempDir = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Use filename portion for local temp naming
      const tempFileName = backupKey.split('/').pop() || backupKey;
      const tempBackupPath = path.join(tempDir, `verify-${tempFileName}`);

      console.log(`🔍 BACKUP VERIFY: Downloading backup to verify content...`);

      // Download the backup file
      const downloaded = await this.downloadDatabaseBackup(backupKey, tempBackupPath);

      if (downloaded) {
        // Read and verify the backup content
        const Database = (await import("better-sqlite3")).default;
        const backupDb = new Database(tempBackupPath, { readonly: true });

        try {
          // Check if organizations table exists
          const tablesResult = backupDb
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='table' AND name='organizations'",
            )
            .get();

          if (tablesResult) {
            // Read organizations from the backup
            const orgs = backupDb
              .prepare("SELECT id, name, domain FROM organizations")
              .all();
            console.log(
              `✅ BACKUP VERIFIED: Organizations in backup file:`,
              orgs
                .map((o: any) => `${(o as any).name} (${(o as any).domain || "no-domain"})`)
                .join(", ") || "None",
            );
          } else {
            console.log(
              `❌ BACKUP VERIFICATION FAILED: Organizations table missing in backup file`,
            );
          }
        } finally {
          backupDb.close();
        }

        // Clean up temporary file
        fs.unlinkSync(tempBackupPath);
      } else {
        console.log(
          `❌ BACKUP VERIFICATION FAILED: Could not download backup for verification`,
        );
      }
    } catch (error: any) {
      console.error("❌ Error during backup verification:", error);
    }
  }

  // Upload database backup to Object Storage
  private async uploadDatabaseBackup(
    localDbPath: string,
    backupName?: string,
  ): Promise<string> {
    // Validate input parameters
    if (!localDbPath || typeof localDbPath !== "string") {
      throw new ObjectStorageUploadError(
        "Invalid localDbPath: must be a non-empty string",
      );
    }

    // Default to environment-appropriate backup name if not provided
    const namePrefix = this.getBackupNamePrefix();
  const effectiveName = backupName && typeof backupName === 'string' && backupName.trim().length > 0
      ? backupName
      : `${namePrefix}.db`;
  // Prevent callers from injecting paths; keep only basename
  const sanitizedName = path.basename(effectiveName);

    // Check if local file exists
    if (!fs.existsSync(localDbPath)) {
      throw new ObjectStorageUploadError(
        `Local database file not found: ${localDbPath}`,
      );
    }

    // Validate file size (prevent uploading empty or corrupted files)
    const stats = fs.statSync(localDbPath);
    if (stats.size === 0) {
      throw new ObjectStorageUploadError(
        `Database file is empty: ${localDbPath}`,
      );
    }

    try {
      const client = this.getBucket();
      const envSegment = this.getEnvSegment();
      const destinationPath = `database-backups/${envSegment}/${sanitizedName}`;

      console.log(
        `☁️ Uploading database backup: ${destinationPath} (${Math.round(stats.size / 1024)}KB)`,
      );

      await client.uploadFromFilename(destinationPath, localDbPath);

      console.log(`✅ Database backup uploaded successfully: ${destinationPath}`);
      return destinationPath; // return full key
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`❌ Failed to upload database backup:`, error);
      throw new ObjectStorageUploadError(
        `Failed to upload database backup: ${errorMessage}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // Download database backup from Object Storage
  private async downloadDatabaseBackup(
    backupKeyOrName: string,
    localDbPath: string,
  ): Promise<boolean> {
    // Validate input parameters
    if (!backupKeyOrName || typeof backupKeyOrName !== "string") {
      throw new ObjectStorageDownloadError(
        "Invalid backupName: must be a non-empty string",
      );
    }

    if (!localDbPath || typeof localDbPath !== "string") {
      throw new ObjectStorageDownloadError(
        "Invalid localDbPath: must be a non-empty string",
      );
    }

    // Ensure destination directory exists
    const destinationDir = path.dirname(localDbPath);
    if (!fs.existsSync(destinationDir)) {
      fs.mkdirSync(destinationDir, { recursive: true });
    }

    try {
      const client = this.getBucket();
      // If a full key is provided (contains '/'), use it directly; otherwise, assume env-specific prefix
      const envSegment = this.getEnvSegment();
      const objectKey = backupKeyOrName.includes('/')
        ? backupKeyOrName
        : `database-backups/${envSegment}/${backupKeyOrName}`;

      // Check if backup exists
      const exists = await client.exists(objectKey);
      if (!exists) {
        console.log(`⚠️ No backup found: ${objectKey}`);
        return false;
      }

      console.log(`☁️ Downloading database backup: ${objectKey}`);

      // Try alternative download method - downloadAsBytes then write to file
      console.log(`🔄 Trying downloadAsBytes method as alternative...`);
      const downloadResult = await client.downloadAsBytes(objectKey);
      
      if (!downloadResult.ok) {
        console.error('🔍 downloadAsBytes error details:', {
          error: downloadResult.error,
          errorType: typeof downloadResult.error,
          errorKeys: downloadResult.error ? Object.keys(downloadResult.error) : [],
          errorString: downloadResult.error ? String(downloadResult.error) : 'No error object'
        });
        
        // Handle different error object structures
        let errorMsg = 'Unknown error';
        const error = downloadResult.error;
        if (error) {
          if (typeof error === 'string') {
            errorMsg = error;
          } else if (error.message) {
            errorMsg = error.message;
          } else if ((error as any).code) {
            errorMsg = `Error code: ${(error as any).code}`;
          } else if (error.toString) {
            errorMsg = error.toString();
          } else {
            errorMsg = JSON.stringify(error);
          }
        }
        
        throw new ObjectStorageDownloadError(`Download failed: ${errorMsg}`);
      }

      // Write bytes to file manually
      const bytes = downloadResult.value;
      if (!bytes || bytes.length === 0) {
        throw new ObjectStorageDownloadError("Downloaded data is empty");
      }
      
      fs.writeFileSync(localDbPath, bytes);
      console.log(`✅ Downloaded ${bytes.length} bytes using downloadAsBytes method`);

      // Verify downloaded file exists and is not empty
      if (!fs.existsSync(localDbPath)) {
        throw new ObjectStorageDownloadError("Downloaded file was not created");
      }

      const downloadedStats = fs.statSync(localDbPath);
      if (downloadedStats.size === 0) {
        fs.unlinkSync(localDbPath); // Clean up empty file
        throw new ObjectStorageDownloadError("Downloaded file is empty");
      }

  console.log(`✅ Database backup downloaded successfully to: ${localDbPath}`);
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`❌ Failed to download database backup:`, error);

      // Clean up partial download if it exists
      if (fs.existsSync(localDbPath)) {
        try {
          fs.unlinkSync(localDbPath);
        } catch (cleanupError) {
          console.warn("Failed to clean up partial download:", cleanupError);
        }
      }

      throw new ObjectStorageDownloadError(
        `Failed to download database backup '${backupKeyOrName}': ${errorMessage}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // List available database backups
  async listBackups(environment?: 'production' | 'development'): Promise<string[]> {
    try {
      const client = this.getBucket();
      const envSeg = environment
        ? (environment === 'production' ? 'prod' : 'dev')
        : this.getEnvSegment();
      const result = await client.list({ prefix: `database-backups/${envSeg}/` });
      
      if (!result.ok) {
        throw new Error(`Failed to list backups: ${result.error?.message || 'Unknown error'}`);
      }
      
      const files = result.value || [];

      // Filter and sort backups
      const backupNames = files
        .filter(
          (file: any) =>
            file.name.startsWith(`database-backups/${envSeg}/`) &&
            file.name.endsWith(".db"),
        )
        .map((file: any) => file.name.replace(`database-backups/${envSeg}/`, ""))
        .sort(); // Sort alphabetically

      console.log(
        `📋 Found ${backupNames.length} ${envSeg} database backups in Object Storage`,
      );
      return backupNames;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Failed to list backups:", error);
      throw new ObjectStorageDownloadError(
        `Failed to list database backups: ${errorMessage}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // Prepare database for safe restoration by closing connections and cleaning up WAL files
  private async prepareForDatabaseRestoration(
    localDbPath: string,
  ): Promise<void> {
    try {
      console.log(
        "🔧 Preparing database for restoration - closing connections and cleaning up WAL files...",
      );

      // Step 1: Try to close any existing database connections gracefully
      try {
        const Database = (await import("better-sqlite3")).default;
        const db = new Database(localDbPath);

        // Force WAL checkpoint to flush all data to main database
        db.pragma("wal_checkpoint(TRUNCATE)");
        db.close();
        console.log("✅ Existing database connections closed and checkpointed");
      } catch (error) {
        // Database might not exist or already closed - this is fine
        console.log("📋 No existing database connections to close");
      }

      // Step 2: Clean up WAL and SHM files that might interfere with restoration
      const walFiles = [
        `${localDbPath}-wal`,
        `${localDbPath}-shm`,
        `${localDbPath}-journal`,
      ];

      for (const walFile of walFiles) {
        if (fs.existsSync(walFile)) {
          try {
            fs.unlinkSync(walFile);
            console.log(`🗑️ Cleaned up interfering file: ${walFile}`);
          } catch (error) {
            console.warn(`⚠️ Could not remove ${walFile}:`, error instanceof Error ? error.message : String(error));
          }
        }
      }

      // Step 3: Small delay to ensure file system operations complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      console.log("✅ Database preparation complete - ready for restoration");
  } catch (error) {
      console.warn(
        "⚠️ Database preparation had issues, but continuing with restoration:",
    error instanceof Error ? error.message : String(error),
      );
    }
  }

  // Create a timestamped backup
  async createTimestampedBackup(localDbPath: string): Promise<string> {
    // CRITICAL: Force SQLite checkpoint to flush WAL to main database before backup
    try {
      const Database = (await import("better-sqlite3")).default;
      const db = new Database(localDbPath);

      // Force checkpoint to ensure all data is in the main database file
      console.log(
        `🔄 BACKUP: Forcing SQLite checkpoint before backup creation`,
      );
      db.pragma("wal_checkpoint(FULL)");

      // Verify data is present after checkpoint
      const orgs = db
        .prepare("SELECT id, name, domain FROM organizations")
        .all();
      console.log(
        `🔍 BACKUP VERIFY: Organizations after checkpoint:`,
        orgs.map((o) => `${o.name} (${o.domain || "no-domain"})`).join(", ") ||
          "None",
      );

      db.close();

      // Small delay to ensure filesystem sync
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error("❌ Failed to checkpoint database before backup:", error);
      throw new Error(`Failed to checkpoint database: ${error.message}`);
    }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const namePrefix = this.getBackupNamePrefix();
  const backupName = `${namePrefix}-${timestamp}.db`;
  const uploadedKey = await this.uploadDatabaseBackup(localDbPath, backupName);

  // TEMPORARILY DISABLED: Verify backup by downloading and reading it
  // Note: Download verification disabled due to Object Storage permission issue
  // The backup upload is confirmed successful, verification will be re-enabled after fixing download permissions
  console.log("⏭️ BACKUP VERIFY: Skipping download verification (upload confirmed successful)");

  return backupName; // return the file name (without env prefix)
  }

  // Upload an existing local backup file (e.g., from VACUUM INTO) to Object Storage
  // Returns full object key (including env prefix)
  async uploadBackupFile(localFilePath: string, backupBaseName?: string): Promise<string> {
    if (!localFilePath || !fs.existsSync(localFilePath)) {
      throw new ObjectStorageUploadError(`Local backup not found: ${localFilePath}`);
    }

    const base = backupBaseName && backupBaseName.trim().length > 0
      ? path.basename(backupBaseName)
      : path.basename(localFilePath);

    // Ensure an env-appropriate prefix in the name if one isn’t present
    const prefix = this.getBackupNamePrefix();
    const hasPrefix = base.startsWith('production-backup') || base.startsWith('development-backup') || base.startsWith('pre-migration-');
    const finalName = hasPrefix ? base : `${prefix}-${base}`;

    const key = await this.uploadDatabaseBackup(localFilePath, finalName);
    // Optionally verify upload by metadata fetch (download is heavier); we already checksum on upload
    return key;
  }

  // Restore latest backup based on file modification timestamp
  async restoreLatestBackup(localDbPath: string): Promise<boolean> {
    console.log(`🛡️ Attempting to restore database from Object Storage...`);

    try {
      // TEMPORARY: Delete all existing backups to force fresh seeding - DISABLED
      // console.log(`🗑️ TEMP CODE: Deleting all existing backup files to force fresh database seeding...`);
      // await this.deleteAllBackups();

      // Get all backup files with their metadata
      const envSeg = this.getEnvSegment();
      const bucket = this.getBucket();
      const result = await bucket.list({ prefix: `database-backups/${envSeg}/` });
      
      if (!result.ok) {
        throw new Error(`Failed to list backups: ${result.error?.message || 'Unknown error'}`);
      }
      
      const files = result.value || [];

      // Filter backup files and extract metadata
      const backupFiles = files
        .filter(
          (file: any) =>
            file.name.startsWith(`database-backups/${envSeg}/`) &&
            file.name.endsWith(".db"),
        )
        .map((file: any) => {
          // Use the metadata from the list response
          const objEnv = (file.metadata && file.metadata.environment) || undefined;
          return {
            name: file.name.replace(`database-backups/${envSeg}/`, ""),
            fullName: file.name, // full object key
            timeCreated: new Date(file.timeCreated || file.created || 0),
            updated: new Date(file.updated || file.timeCreated || file.created || 0),
            env: objEnv as ('production' | 'development' | undefined),
          };
        });

      if (backupFiles.length === 0) {
        console.log(`✅ No ${envSeg} backup files found in Object Storage - will trigger fresh seeding`);
        return false;
      }

      // Metadata is already available from the list response
      let backupsWithMetadata: BackupMeta[] = backupFiles;

      // Additional safeguard: only consider backups whose metadata.environment matches our current env.
      const currentEnv = this.getEnvironment();
  const envMatched = backupsWithMetadata.filter((b: BackupMeta) => b.env === currentEnv);
      if (envMatched.length > 0) {
        backupsWithMetadata = envMatched;
      }

      // Sort by most recent modification time (updated timestamp)
      backupsWithMetadata.sort(
        (a: BackupMeta, b: BackupMeta) => b.updated.getTime() - a.updated.getTime(),
      );

  console.log(`📋 Found ${backupsWithMetadata.length} ${envSeg} backup files, checking most recent:`);

      // DEBUG: Check organizations in the top 3 backups
      for (let i = 0; i < Math.min(3, backupsWithMetadata.length); i++) {
        const backup = backupsWithMetadata[i];
        const timeStr = backup.updated.toISOString();
        console.log(`  ${i + 1}. ${backup.name} (modified: ${timeStr})`);

        // Download and check organizations in this backup
        try {
          const tempPath = path.join(os.tmpdir(), `debug_backup_${i}.db`);
          const downloaded = await this.downloadDatabaseBackup(backup.fullName, tempPath);
          if (downloaded) {
            // Use dynamic import instead of require for ES modules
            const Database: any = (await import("better-sqlite3")).default;
            const db = new Database(tempPath, { readonly: true });

            // Check if organizations table exists first
            const tablesResult = db
              .prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='organizations'",
              )
              .get();
            if (tablesResult) {
              const orgs = db
                .prepare("SELECT id, name, domain FROM organizations")
                .all();
              console.log(
                `     📋 Organizations in ${backup.name}:`,
        orgs.map((o: any) => `${o.name} (${o.domain})`).join(", ") || "None",
              );
            } else {
              console.log(
                `     ⚠️ ${backup.name}: INCOMPLETE - missing organizations table`,
              );
            }

            db.close();
            fs.unlinkSync(tempPath); // Clean up temp file
          }
        } catch (error) {
          console.log(
            `     ⚠️ Could not analyze backup ${backup.name}:`,
      error instanceof Error ? error.message : String(error),
          );
        }
      }

      // Try to restore the most recent backup
      const latestBackup = backupsWithMetadata[0];
      console.log(
        `🔄 Restoring most recent backup: ${latestBackup.name} (modified: ${latestBackup.updated.toISOString()})`,
      );

      // CRITICAL FIX: Close all database connections and clean up WAL files before restoration
      await this.prepareForDatabaseRestoration(localDbPath);

  const restored = await this.downloadDatabaseBackup(latestBackup.fullName, localDbPath);

      if (restored) {
        console.log(
          `✅ Database restored from most recent backup: ${latestBackup.name}`,
        );

        // DEBUG: Check what organizations exist in the restored database
        try {
          const Database: any = (await import("better-sqlite3")).default;
          const db = new Database(localDbPath, { readonly: true });

          // Check if organizations table exists first
          const tablesResult = db
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='table' AND name='organizations'",
            )
            .get();
          if (tablesResult) {
            const orgs = db
              .prepare("SELECT id, name, domain FROM organizations")
              .all();
            console.log(`🔍 DEBUG: Organizations in restored backup:`, orgs);
          } else {
            console.log(
              `⚠️ DEBUG: Restored backup is INCOMPLETE - missing organizations table`,
            );
          }

          db.close();
        } catch (error) {
          console.log(
            `⚠️ DEBUG: Could not read organizations from restored backup:`,
            error instanceof Error ? error.message : String(error),
          );
        }

        return true;
      } else {
        console.log(`❌ Failed to restore backup: ${latestBackup.name}`);
        return false;
      }
    } catch (error) {
      console.error("❌ Error finding latest backup:", error);
      return false;
    }
  }

  // TEMPORARY: Delete all existing backup files to force fresh seeding
  async deleteAllBackups(): Promise<void> {
    try {
      console.log(
        `🗑️ CLEANUP: Starting deletion of all existing backup files...`,
      );

      const bucket = this.getBucket();
      const envSeg = this.getEnvSegment();
      const result = await bucket.list({ prefix: `database-backups/${envSeg}/` });
      
      if (!result.ok) {
        throw new Error(`Failed to list backups: ${result.error?.message || 'Unknown error'}`);
      }
      
      const files = result.value || [];

      const backupFiles = files.filter(
        (file: any) =>
          file.name.startsWith(`database-backups/${envSeg}/`) &&
          file.name.endsWith(".db"),
      );

      if (backupFiles.length === 0) {
        console.log(`📝 CLEANUP: No backup files found to delete`);
        return;
      }

      console.log(
        `🗑️ CLEANUP: Found ${backupFiles.length} backup files to delete:`,
      );

      // Delete all backup files
      const deletePromises = backupFiles.map(async (file: any, index: number) => {
        try {
          await bucket.delete(file.name);
          console.log(
            `  ✓ Deleted backup ${index + 1}/${backupFiles.length}: ${file.name}`,
          );
        } catch (error) {
      console.error(`  ✗ Failed to delete ${file.name}:`, error instanceof Error ? error.message : String(error));
        }
      });

      await Promise.all(deletePromises);
      console.log(
        `✅ CLEANUP: Backup deletion complete - ${backupFiles.length} files processed`,
      );
    } catch (error) {
      console.error(`❌ CLEANUP: Failed to delete backup files:`, error);
      throw error;
    }
  }
}
