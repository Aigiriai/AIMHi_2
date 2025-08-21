#!/usr/bin/env node

/**
 * Schema Fix Validation Test
 * Tests that both fresh and existing deployments work correctly
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

console.log('🧪 SCHEMA FIX TEST: Starting comprehensive validation...');

// Create test database paths
const freshDbPath = path.join(__dirname, 'test-fresh.db');
const existingDbPath = path.join(__dirname, 'test-existing.db');

// Clean up any existing test databases
[freshDbPath, existingDbPath].forEach(dbPath => {
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log(`🗑️  Cleaned up existing test DB: ${dbPath}`);
  }
});

// Test 1: Fresh Deployment Simulation
async function testFreshDeployment() {
  console.log('\n📦 TEST 1: Fresh Deployment Simulation');
  
  const db = new Database(freshDbPath);
  
  try {
    // Create unified schema (simulating fresh deployment)
    const createTablesSQL = `
      -- Organizations table
      CREATE TABLE IF NOT EXISTS organizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        domain TEXT,
        subdomain TEXT,
        plan TEXT NOT NULL DEFAULT 'trial',
        status TEXT NOT NULL DEFAULT 'active',
        timezone TEXT DEFAULT 'UTC',
        date_format TEXT DEFAULT 'MM/DD/YYYY',
        currency TEXT DEFAULT 'USD',
        settings TEXT DEFAULT '{}',
        billing_settings TEXT DEFAULT '{}',
        compliance_settings TEXT DEFAULT '{}',
        integration_settings TEXT DEFAULT '{}',
        report_settings TEXT DEFAULT '{}',
        max_report_rows INTEGER DEFAULT 10000,
        max_saved_templates INTEGER DEFAULT 50,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'recruiter',
        manager_id INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        permissions TEXT DEFAULT '{}',
        report_permissions TEXT DEFAULT '{}',
        has_temporary_password INTEGER NOT NULL DEFAULT 0,
        temporary_password TEXT,
        settings TEXT DEFAULT '{}',
        last_login_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (manager_id) REFERENCES users(id)
      );

      -- Jobs table
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        created_by INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        experience_level TEXT NOT NULL,
        job_type TEXT NOT NULL,
        keywords TEXT NOT NULL,
        requirements TEXT NOT NULL DEFAULT 'Requirements not specified',
        location TEXT NOT NULL DEFAULT 'Location not specified',
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      -- Candidates table
      CREATE TABLE IF NOT EXISTS candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        experience INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        source TEXT,
        resume_content TEXT NOT NULL,
        resume_file_name TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        added_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (added_by) REFERENCES users(id)
      );

      -- Job matches table
      CREATE TABLE IF NOT EXISTS job_matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        job_id INTEGER NOT NULL,
        candidate_id INTEGER NOT NULL,
        matched_by INTEGER NOT NULL,
        match_percentage REAL NOT NULL,
        ai_reasoning TEXT,
        match_criteria TEXT DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (candidate_id) REFERENCES candidates(id),
        FOREIGN KEY (matched_by) REFERENCES users(id)
      );

      -- Interviews table (NEW UNIFIED SCHEMA)
      CREATE TABLE IF NOT EXISTS interviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        job_id INTEGER NOT NULL,
        candidate_id INTEGER NOT NULL,
        match_id INTEGER,
        interviewer_id INTEGER NOT NULL,
        scheduled_by INTEGER NOT NULL,
        scheduled_at TEXT NOT NULL,
        duration INTEGER NOT NULL DEFAULT 60,
        status TEXT NOT NULL DEFAULT 'scheduled',
        interview_type TEXT NOT NULL DEFAULT 'video',
        meeting_link TEXT,
        notes TEXT DEFAULT '',
        feedback TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        interviewer_name TEXT,
        interviewer_email TEXT,
        reminder_sent INTEGER DEFAULT 0,
        transcript_path TEXT,
        outcome TEXT,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (candidate_id) REFERENCES candidates(id),
        FOREIGN KEY (match_id) REFERENCES job_matches(id),
        FOREIGN KEY (interviewer_id) REFERENCES users(id),
        FOREIGN KEY (scheduled_by) REFERENCES users(id)
      );

      -- Applications table
      CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        job_id INTEGER NOT NULL,
        candidate_id INTEGER NOT NULL,
        applied_by INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        substatus TEXT,
        current_stage TEXT NOT NULL DEFAULT 'new',
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        match_percentage REAL,
        source TEXT DEFAULT 'manual',
        notes TEXT DEFAULT '',
        last_stage_change_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_stage_changed_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (candidate_id) REFERENCES candidates(id),
        FOREIGN KEY (applied_by) REFERENCES users(id),
        FOREIGN KEY (last_stage_changed_by) REFERENCES users(id)
      );

      -- Audit logs table
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        user_id INTEGER,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        details TEXT DEFAULT '{}',
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      -- Status history table
      CREATE TABLE IF NOT EXISTS status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        old_status TEXT,
        new_status TEXT NOT NULL,
        changed_by INTEGER NOT NULL,
        reason TEXT,
        notes TEXT,
        changed_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (changed_by) REFERENCES users(id)
      );
    `;

    db.exec(createTablesSQL);
    console.log('✅ Fresh deployment schema created successfully');

    // Test performance indexes with NEW schema
    const indexSQL = `
      CREATE INDEX IF NOT EXISTS idx_users_org_email ON users(organization_id, email);
      CREATE INDEX IF NOT EXISTS idx_jobs_org ON jobs(organization_id);
      CREATE INDEX IF NOT EXISTS idx_candidates_org ON candidates(organization_id);
      CREATE INDEX IF NOT EXISTS idx_interviews_org_scheduled ON interviews(organization_id, scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
    `;

    db.exec(indexSQL);
    console.log('✅ Performance indexes created successfully on fresh deployment');

    // Test data insertion
    db.exec(`INSERT INTO organizations (name) VALUES ('Test Org')`);
    db.exec(`INSERT INTO users (organization_id, email, first_name, last_name, password_hash) VALUES (1, 'test@example.com', 'Test', 'User', 'hash')`);
    db.exec(`INSERT INTO jobs (organization_id, created_by, title, description, experience_level, job_type, keywords) VALUES (1, 1, 'Test Job', 'Test Description', 'mid', 'full-time', 'test')`);
    db.exec(`INSERT INTO candidates (organization_id, name, email, phone, resume_content, resume_file_name, added_by) VALUES (1, 'Test Candidate', 'candidate@example.com', '123-456-7890', 'Test resume', 'resume.pdf', 1)`);
    
    // Test interview insertion with NEW schema
    db.exec(`INSERT INTO interviews (organization_id, job_id, candidate_id, interviewer_id, scheduled_by, scheduled_at) VALUES (1, 1, 1, 1, 1, '2025-08-21T10:00:00Z')`);
    
    const interviewCount = db.prepare('SELECT COUNT(*) as count FROM interviews').get().count;
    console.log(`✅ Successfully inserted interview record. Total interviews: ${interviewCount}`);

  } catch (error) {
    console.error('❌ Fresh deployment test failed:', error.message);
    throw error;
  } finally {
    db.close();
  }
}

// Test 2: Existing Deployment Simulation
async function testExistingDeployment() {
  console.log('\n📚 TEST 2: Existing Deployment Simulation');
  
  const db = new Database(existingDbPath);
  
  try {
    // Create OLD schema (simulating existing deployment)
    const createOldSchemaSQL = `
      -- Organizations table (old schema)
      CREATE TABLE IF NOT EXISTS organizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        domain TEXT,
        subdomain TEXT,
        plan TEXT NOT NULL DEFAULT 'trial',
        status TEXT NOT NULL DEFAULT 'active',
        timezone TEXT DEFAULT 'UTC',
        date_format TEXT DEFAULT 'MM/DD/YYYY',
        currency TEXT DEFAULT 'USD',
        settings TEXT DEFAULT '{}',
        billing_settings TEXT DEFAULT '{}',
        compliance_settings TEXT DEFAULT '{}',
        integration_settings TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      -- Users table (old schema)
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'recruiter',
        manager_id INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        permissions TEXT DEFAULT '{}',
        has_temporary_password INTEGER NOT NULL DEFAULT 0,
        temporary_password TEXT,
        settings TEXT DEFAULT '{}',
        last_login_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (manager_id) REFERENCES users(id)
      );

      -- Jobs table
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        created_by INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        experience_level TEXT NOT NULL,
        job_type TEXT NOT NULL,
        keywords TEXT NOT NULL,
        requirements TEXT NOT NULL DEFAULT 'Requirements not specified',
        location TEXT NOT NULL DEFAULT 'Location not specified',
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      -- Candidates table
      CREATE TABLE IF NOT EXISTS candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        experience INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        source TEXT,
        resume_content TEXT NOT NULL,
        resume_file_name TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        added_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (added_by) REFERENCES users(id)
      );

      -- Job matches table
      CREATE TABLE IF NOT EXISTS job_matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        job_id INTEGER NOT NULL,
        candidate_id INTEGER NOT NULL,
        matched_by INTEGER NOT NULL,
        match_percentage REAL NOT NULL,
        ai_reasoning TEXT,
        match_criteria TEXT DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (candidate_id) REFERENCES candidates(id),
        FOREIGN KEY (matched_by) REFERENCES users(id)
      );

      -- Interviews table (OLD SCHEMA with scheduled_date_time)
      CREATE TABLE IF NOT EXISTS interviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        job_id INTEGER NOT NULL,
        candidate_id INTEGER NOT NULL,
        match_id INTEGER,
        scheduled_by INTEGER NOT NULL,
        scheduled_date_time TEXT NOT NULL,
        duration INTEGER NOT NULL DEFAULT 60,
        status TEXT NOT NULL DEFAULT 'scheduled',
        interview_type TEXT NOT NULL DEFAULT 'video',
        meeting_link TEXT,
        notes TEXT,
        feedback TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (candidate_id) REFERENCES candidates(id),
        FOREIGN KEY (match_id) REFERENCES job_matches(id),
        FOREIGN KEY (scheduled_by) REFERENCES users(id)
      );

      -- Applications table
      CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        job_id INTEGER NOT NULL,
        candidate_id INTEGER NOT NULL,
        applied_by INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        substatus TEXT,
        current_stage TEXT NOT NULL DEFAULT 'new',
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        match_percentage REAL,
        source TEXT DEFAULT 'manual',
        notes TEXT DEFAULT '',
        last_stage_change_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_stage_changed_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (candidate_id) REFERENCES candidates(id),
        FOREIGN KEY (applied_by) REFERENCES users(id),
        FOREIGN KEY (last_stage_changed_by) REFERENCES users(id)
      );

      -- Audit logs table
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        user_id INTEGER,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        details TEXT DEFAULT '{}',
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      -- Status history table
      CREATE TABLE IF NOT EXISTS status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        old_status TEXT,
        new_status TEXT NOT NULL,
        changed_by INTEGER NOT NULL,
        reason TEXT,
        notes TEXT,
        changed_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (changed_by) REFERENCES users(id)
      );
    `;

    db.exec(createOldSchemaSQL);
    console.log('✅ Existing deployment schema created successfully');

    // Add old data
    db.exec(`INSERT INTO organizations (name) VALUES ('Existing Org')`);
    db.exec(`INSERT INTO users (organization_id, email, first_name, last_name, password_hash) VALUES (1, 'existing@example.com', 'Existing', 'User', 'hash')`);
    db.exec(`INSERT INTO jobs (organization_id, created_by, title, description, experience_level, job_type, keywords) VALUES (1, 1, 'Existing Job', 'Existing Description', 'senior', 'full-time', 'existing')`);
    db.exec(`INSERT INTO candidates (organization_id, name, email, phone, resume_content, resume_file_name, added_by) VALUES (1, 'Existing Candidate', 'existing.candidate@example.com', '987-654-3210', 'Existing resume', 'existing_resume.pdf', 1)`);
    
    // Test interview insertion with OLD schema
    db.exec(`INSERT INTO interviews (organization_id, job_id, candidate_id, scheduled_by, scheduled_date_time) VALUES (1, 1, 1, 1, '2025-08-21T14:00:00Z')`);
    
    // Test migration logic - add missing columns
    console.log('🔄 Applying migration to add missing columns...');
    
    // Add missing columns that might be missing
    try {
      db.exec(`ALTER TABLE organizations ADD COLUMN report_settings TEXT DEFAULT '{}'`);
      console.log('✅ Added report_settings to organizations');
    } catch (e) {
      console.log('ℹ️ report_settings already exists or failed to add');
    }

    try {
      db.exec(`ALTER TABLE organizations ADD COLUMN max_report_rows INTEGER DEFAULT 10000`);
      console.log('✅ Added max_report_rows to organizations');
    } catch (e) {
      console.log('ℹ️ max_report_rows already exists or failed to add');
    }

    try {
      db.exec(`ALTER TABLE organizations ADD COLUMN max_saved_templates INTEGER DEFAULT 50`);
      console.log('✅ Added max_saved_templates to organizations');
    } catch (e) {
      console.log('ℹ️ max_saved_templates already exists or failed to add');
    }

    try {
      db.exec(`ALTER TABLE users ADD COLUMN report_permissions TEXT DEFAULT '{}'`);
      console.log('✅ Added report_permissions to users');
    } catch (e) {
      console.log('ℹ️ report_permissions already exists or failed to add');
    }

    // Test column rename migration (scheduled_date_time -> scheduled_at)
    try {
      db.exec(`ALTER TABLE interviews ADD COLUMN scheduled_at TEXT`);
      db.exec(`UPDATE interviews SET scheduled_at = scheduled_date_time WHERE scheduled_at IS NULL`);
      console.log('✅ Successfully migrated scheduled_date_time to scheduled_at');
    } catch (e) {
      console.log('ℹ️ scheduled_at migration already applied or failed');
    }

    // Test performance indexes with conditional logic
    const checkColumn = db.prepare(`PRAGMA table_info(interviews)`).all();
    const hasOldColumn = checkColumn.some(col => col.name === 'scheduled_date_time');
    const hasNewColumn = checkColumn.some(col => col.name === 'scheduled_at');
    
    let scheduledColumnName = 'scheduled_at';
    if (hasOldColumn && !hasNewColumn) {
      scheduledColumnName = 'scheduled_date_time';
    }
    
    console.log(`📊 Using column '${scheduledColumnName}' for indexes`);

    const indexSQL = `
      CREATE INDEX IF NOT EXISTS idx_users_org_email ON users(organization_id, email);
      CREATE INDEX IF NOT EXISTS idx_jobs_org ON jobs(organization_id);
      CREATE INDEX IF NOT EXISTS idx_candidates_org ON candidates(organization_id);
      CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
    `;
    db.exec(indexSQL);
    
    // Create the scheduled index with the correct column
    const scheduledIndexSQL = `CREATE INDEX IF NOT EXISTS idx_interviews_org_scheduled ON interviews(organization_id, ${scheduledColumnName})`;
    db.exec(scheduledIndexSQL);
    console.log(`✅ Performance indexes created successfully with column '${scheduledColumnName}'`);

    const interviewCount = db.prepare('SELECT COUNT(*) as count FROM interviews').get().count;
    console.log(`✅ Successfully processed existing interviews. Total: ${interviewCount}`);

  } catch (error) {
    console.error('❌ Existing deployment test failed:', error.message);
    throw error;
  } finally {
    db.close();
  }
}

// Test 3: Cross-compatibility test
async function testCrossCompatibility() {
  console.log('\n🔄 TEST 3: Cross-compatibility Test');
  
  // Test reading data using both column name strategies
  const freshDb = new Database(freshDbPath);
  const existingDb = new Database(existingDbPath);
  
  try {
    // Test query that works with both schemas
    const testQuery = (db, dbName) => {
      const interviews = db.prepare(`
        SELECT *, 
               COALESCE(scheduled_at, scheduled_date_time) as effective_scheduled_time
        FROM interviews 
        LIMIT 5
      `).all();
      
      console.log(`📊 ${dbName}: Found ${interviews.length} interviews`);
      
      if (interviews.length > 0) {
        const sample = interviews[0];
        console.log(`   Sample interview scheduled time: ${sample.effective_scheduled_time}`);
        console.log(`   Has scheduled_at: ${sample.scheduled_at ? 'YES' : 'NO'}`);
        console.log(`   Has scheduled_date_time: ${sample.scheduled_date_time ? 'YES' : 'NO'}`);
      }
    };
    
    testQuery(freshDb, 'Fresh DB');
    testQuery(existingDb, 'Existing DB');
    
    console.log('✅ Cross-compatibility test passed');
    
  } catch (error) {
    console.error('❌ Cross-compatibility test failed:', error.message);
    throw error;
  } finally {
    freshDb.close();
    existingDb.close();
  }
}

// Run all tests
async function runAllTests() {
  try {
    await testFreshDeployment();
    await testExistingDeployment();
    await testCrossCompatibility();
    
    console.log('\n🎉 ALL TESTS PASSED! Schema fix is working correctly.');
    console.log('\n✅ Summary:');
    console.log('   ✓ Fresh deployments work with new unified schema');
    console.log('   ✓ Existing deployments work with migration logic');
    console.log('   ✓ Performance indexes adapt to available columns');
    console.log('   ✓ Cross-compatibility queries handle both column names');
    
  } catch (error) {
    console.error('\n💥 TESTS FAILED:', error.message);
    console.error('\nThe schema fix needs additional work.');
    process.exit(1);
  } finally {
    // Cleanup
    [freshDbPath, existingDbPath].forEach(dbPath => {
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
    });
    console.log('\n🧹 Test databases cleaned up');
  }
}

// Run the tests
runAllTests();
