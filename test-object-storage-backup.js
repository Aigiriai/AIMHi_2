// Test script to verify Object Storage backup functionality
import { DatabaseBackupService } from './server/objectStorage.js';
import fs from 'fs';
import path from 'path';

async function testObjectStorageBackup() {
  console.log('🧪 Testing Object Storage backup functionality...');
  
  try {
    // Check if we have the environment variables
    if (!process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID) {
      console.log('❌ Object Storage not configured - DEFAULT_OBJECT_STORAGE_BUCKET_ID missing');
      return;
    }
    
    console.log('✅ Object Storage environment variables found');
    console.log('🪣 Bucket ID:', process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID);
    
    // Initialize the backup service
    const backupService = new DatabaseBackupService();
    console.log('✅ DatabaseBackupService initialized');
    
    // List current backups
    const backups = await backupService.listBackups();
    console.log(`📋 Found ${backups.length} existing backups:`, backups);
    
    // Check if production database exists
    const prodDbPath = path.join(process.cwd(), 'data', 'production.db');
    if (fs.existsSync(prodDbPath)) {
      console.log('📊 Production database exists, testing backup...');
      
      // Create a test backup
      const backupName = await backupService.createTimestampedBackup(prodDbPath);
      console.log(`✅ Test backup created: ${backupName}`);
      
      // List backups again to verify
      const newBackups = await backupService.listBackups();
      console.log(`📋 Backups after test: ${newBackups.length} total`);
      
    } else {
      console.log('⚠️ Production database not found - testing with development database');
      
      const devDbPath = path.join(process.cwd(), 'data', 'development.db');
      if (fs.existsSync(devDbPath)) {
        const backupName = await backupService.createTimestampedBackup(devDbPath);
        console.log(`✅ Test backup created with dev database: ${backupName}`);
      } else {
        console.log('❌ No database found to test backup');
      }
    }
    
    console.log('🎉 Object Storage backup test completed successfully!');
    
  } catch (error) {
    console.error('❌ Object Storage backup test failed:', error);
  }
}

// Run the test
testObjectStorageBackup().catch(console.error);