#!/usr/bin/env node

/**
 * QUICK FIX SCRIPT FOR report_permissions COLUMN ISSUE
 * 
 * This script specifically fixes the login issue caused by missing
 * report_permissions column in the users table.
 * 
 * Usage: node fix-login-issue.js [development|production]
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

function fixLoginIssue(environment = 'development') {
  const dataDir = path.join(process.cwd(), "data");
  const dbName = environment === "production" ? "production.db" : "development.db";
  const dbPath = path.join(dataDir, dbName);

  console.log(`🔧 QUICK_FIX: Fixing login issue for ${environment} environment`);
  console.log(`📁 QUICK_FIX: Database: ${dbPath}`);

  if (!fs.existsSync(dbPath)) {
    console.log(`❌ QUICK_FIX: Database not found at ${dbPath}`);
    console.log(`ℹ️  QUICK_FIX: Please start the application first to create the database`);
    process.exit(1);
  }

  const sqlite = new Database(dbPath);

  try {
    // Check if the column already exists
    const columns = sqlite.prepare(`PRAGMA table_info(users)`).all();
    const columnNames = columns.map(col => col.name);

    if (columnNames.includes('report_permissions')) {
      console.log(`✅ QUICK_FIX: report_permissions column already exists - login should work`);
      
      // Double check there are no null values
      const nullCount = sqlite.prepare(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE report_permissions IS NULL
      `).get();
      
      if (nullCount.count > 0) {
        console.log(`🔄 QUICK_FIX: Updating ${nullCount.count} users with NULL report_permissions`);
        const updateResult = sqlite.prepare(`
          UPDATE users 
          SET report_permissions = '{}' 
          WHERE report_permissions IS NULL
        `).run();
        console.log(`✅ QUICK_FIX: Updated ${updateResult.changes} users`);
      }
      
      sqlite.close();
      return;
    }

    console.log(`🔄 QUICK_FIX: Adding missing report_permissions column...`);

    // Create backup first
    const timestamp = Date.now();
    const backupPath = `${dbPath}.backup-${timestamp}`;
    
    console.log(`💾 QUICK_FIX: Creating backup...`);
    sqlite.backup(backupPath);
    console.log(`💾 QUICK_FIX: Backup created at ${backupPath}`);

    // Add the missing column
    sqlite.exec(`ALTER TABLE users ADD COLUMN report_permissions TEXT DEFAULT '{}'`);

    // Update any existing NULL values
    const updateResult = sqlite.prepare(`
      UPDATE users 
      SET report_permissions = '{}' 
      WHERE report_permissions IS NULL
    `).run();

    // Verify the fix
    const newColumns = sqlite.prepare(`PRAGMA table_info(users)`).all();
    const newColumnNames = newColumns.map(col => col.name);

    if (newColumnNames.includes('report_permissions')) {
      console.log(`✅ QUICK_FIX: Successfully added report_permissions column`);
      console.log(`✅ QUICK_FIX: Updated ${updateResult.changes} existing users`);
      
      // Test a simple query to make sure it works
      try {
        const testResult = sqlite.prepare(`
          SELECT id, email, report_permissions 
          FROM users 
          LIMIT 1
        `).get();
        
        if (testResult) {
          console.log(`✅ QUICK_FIX: Test query successful - login should now work!`);
          console.log(`ℹ️  QUICK_FIX: Sample user: ${testResult.email} (permissions: ${testResult.report_permissions})`);
        }
      } catch (testError) {
        console.log(`⚠️ QUICK_FIX: Test query failed, but column was added:`, testError.message);
      }

      console.log(`🎉 QUICK_FIX: Fix completed! You can now try logging in again.`);
    } else {
      throw new Error('Column was not added successfully');
    }

  } catch (error) {
    console.error(`❌ QUICK_FIX: Failed to fix login issue:`, error.message);
    console.log(`📋 QUICK_FIX: Steps to try manually:`);
    console.log(`   1. Stop the application`);
    console.log(`   2. Run: npm run migrate:dev`);
    console.log(`   3. Restart the application`);
    process.exit(1);
  } finally {
    sqlite.close();
  }
}

// Get environment from command line or default to development
const environment = process.argv[2] || 'development';

if (!['development', 'production'].includes(environment)) {
  console.log('Usage: node fix-login-issue.js [development|production]');
  process.exit(1);
}

console.log(`🚀 QUICK_FIX: Starting fix for ${environment} environment...`);
fixLoginIssue(environment);
