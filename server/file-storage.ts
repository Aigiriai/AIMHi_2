import { promises as fs } from 'fs';
import path from 'path';

// File system storage service to replace database storage for cost optimization
export class FileStorageService {
  private readonly storageDir: string;

  constructor(baseDir = './uploads') {
    this.storageDir = baseDir;
    this.ensureStorageDir();
  }

  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      await fs.mkdir(path.join(this.storageDir, 'resumes'), { recursive: true });
      await fs.mkdir(path.join(this.storageDir, 'jobs'), { recursive: true });
    } catch (error) {
      console.error('Failed to create storage directories:', error);
    }
  }

  async storeResumeFile(candidateId: number, filename: string, buffer: Buffer): Promise<string> {
    const sanitizedFilename = this.sanitizeFilename(filename);
    const filePath = path.join(this.storageDir, 'resumes', `${candidateId}_${sanitizedFilename}`);
    
    try {
      await fs.writeFile(filePath, buffer);
      return filePath;
    } catch (error) {
      console.error('Failed to store resume file:', error);
      throw new Error('File storage failed');
    }
  }

  async getResumeFile(candidateId: number, filename: string): Promise<Buffer | null> {
    const sanitizedFilename = this.sanitizeFilename(filename);
    const filePath = path.join(this.storageDir, 'resumes', `${candidateId}_${sanitizedFilename}`);
    
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      console.error('Failed to retrieve resume file:', error);
      return null;
    }
  }

  async deleteResumeFile(candidateId: number, filename: string): Promise<boolean> {
    const sanitizedFilename = this.sanitizeFilename(filename);
    const filePath = path.join(this.storageDir, 'resumes', `${candidateId}_${sanitizedFilename}`);
    
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error('Failed to delete resume file:', error);
      return false;
    }
  }

  getResumeFilePath(candidateId: number, filename: string): string {
    const sanitizedFilename = this.sanitizeFilename(filename);
    return path.join(this.storageDir, 'resumes', `${candidateId}_${sanitizedFilename}`);
  }

  // Job file storage methods
  async storeJobFile(jobId: number, filename: string, buffer: Buffer): Promise<string> {
    const sanitizedFilename = this.sanitizeFilename(filename);
    const filePath = path.join(this.storageDir, 'jobs', `${jobId}_${sanitizedFilename}`);
    
    try {
      await fs.writeFile(filePath, buffer);
      return filePath;
    } catch (error) {
      console.error('Failed to store job file:', error);
      throw new Error('Job file storage failed');
    }
  }

  async getJobFile(jobId: number, filename: string): Promise<Buffer | null> {
    const sanitizedFilename = this.sanitizeFilename(filename);
    const filePath = path.join(this.storageDir, 'jobs', `${jobId}_${sanitizedFilename}`);
    
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      console.error('Failed to retrieve job file:', error);
      return null;
    }
  }

  async deleteJobFile(jobId: number, filename?: string): Promise<boolean> {
    try {
      if (filename) {
        // Delete specific file
        const sanitizedFilename = this.sanitizeFilename(filename);
        const filePath = path.join(this.storageDir, 'jobs', `${jobId}_${sanitizedFilename}`);
        await fs.unlink(filePath);
        return true;
      } else {
        // Delete all files for this job (pattern matching)
        const jobsDir = path.join(this.storageDir, 'jobs');
        const files = await fs.readdir(jobsDir);
        const jobFiles = files.filter(file => file.startsWith(`${jobId}_`));
        
        for (const file of jobFiles) {
          const filePath = path.join(jobsDir, file);
          await fs.unlink(filePath);
          console.log(`🗑️ FORCE DELETE: Deleted job file ${file}`);
        }
        return true;
      }
    } catch (error) {
      console.error('Failed to delete job file:', error);
      return false;
    }
  }

  getJobFilePath(jobId: number, filename: string): string {
    const sanitizedFilename = this.sanitizeFilename(filename);
    return path.join(this.storageDir, 'jobs', `${jobId}_${sanitizedFilename}`);
  }

  private sanitizeFilename(filename: string): string {
    // Remove or replace dangerous characters
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  async cleanupOldFiles(maxAgeInDays = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);

    try {
      const resumeDir = path.join(this.storageDir, 'resumes');
      const files = await fs.readdir(resumeDir);

      for (const file of files) {
        const filePath = path.join(resumeDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          console.log(`Cleaned up old file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old files:', error);
    }
  }
}

export const fileStorage = new FileStorageService();