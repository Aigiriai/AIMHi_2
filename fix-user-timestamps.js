// Quick database fix script for user timestamps
// Run this in Replit's console: node fix-user-timestamps.js

import Database from 'better-sqlite3';
import path from 'path';

// Database path (adjust if needed)
const dbPath = process.env.NODE_ENV === 'production' 
  ? './database.sqlite' 
  : './database.sqlite';

console.log('🔧 Starting user timestamp fix...');
console.log('📁 Database path:', dbPath);

try {
  const db = new Database(dbPath);
  
  // Check current users with invalid timestamps
  console.log('\n📋 Checking users with invalid timestamps:');
  const usersWithInvalidTimestamps = db.prepare(`
    SELECT id, email, first_name, last_name, created_at, updated_at 
    FROM users 
    WHERE created_at IS NULL 
       OR created_at = '' 
       OR created_at = 'null'
       OR created_at = 'undefined'
       OR updated_at IS NULL 
       OR updated_at = '' 
       OR updated_at = 'null'
       OR updated_at = 'undefined'
  `).all();
  
  console.log(`Found ${usersWithInvalidTimestamps.length} users with invalid timestamps:`);
  usersWithInvalidTimestamps.forEach(user => {
    console.log(`  - ${user.email} (ID: ${user.id}) - createdAt: ${user.created_at}, updatedAt: ${user.updated_at}`);
  });
  
  if (usersWithInvalidTimestamps.length === 0) {
    console.log('✅ All users already have valid timestamps!');
    db.close();
    process.exit(0);
  }
  
  // Fix created_at timestamps
  console.log('\n🔧 Fixing created_at timestamps...');
  const fixCreatedAtResult = db.prepare(`
    UPDATE users 
    SET created_at = CURRENT_TIMESTAMP 
    WHERE created_at IS NULL 
       OR created_at = '' 
       OR created_at = 'null'
       OR created_at = 'undefined'
  `).run();
  
  console.log(`✅ Fixed created_at for ${fixCreatedAtResult.changes} users`);
  
  // Fix updated_at timestamps
  console.log('\n🔧 Fixing updated_at timestamps...');
  const fixUpdatedAtResult = db.prepare(`
    UPDATE users 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE updated_at IS NULL 
       OR updated_at = '' 
       OR updated_at = 'null'
       OR updated_at = 'undefined'
  `).run();
  
  console.log(`✅ Fixed updated_at for ${fixUpdatedAtResult.changes} users`);
  
  // Verify the fix
  console.log('\n✅ Verification - All users now:');
  const allUsers = db.prepare(`
    SELECT id, email, first_name, last_name, created_at, updated_at 
    FROM users 
    ORDER BY id
  `).all();
  
  allUsers.forEach(user => {
    console.log(`  - ${user.email} (ID: ${user.id}) - createdAt: ${user.created_at}, updatedAt: ${user.updated_at}`);
  });
  
  console.log('\n🎉 User timestamp fix completed successfully!');
  console.log('🔄 Please refresh your Settings page to see the fixed dates.');
  
  db.close();
  
} catch (error) {
  console.error('❌ Error fixing user timestamps:', error);
  process.exit(1);
}
