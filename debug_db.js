import Database from 'better-sqlite3';
const db = new Database('./database.sqlite');

// Check what tables actually exist
console.log('=== Database Table Count Analysis ===');

try {
  // List all tables in the database (excluding sqlite internal)
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  console.log(`📋 Current Database Tables (${tables.length}):`);
  console.log(`📋 Current Database Tables (${tables.length}):`);
  tables.forEach((table, index) => {
    console.log(`${(index + 1).toString().padStart(2)}. ${table.name}`);
  });

  // Expected tables from migration system
  const expectedTables = [
    'organizations', 'teams', 'users', 'user_teams', 'jobs', 'candidates',
    'job_matches', 'interviews', 'applications', 'job_assignments',
    'candidate_assignments', 'candidate_submissions', 'status_history',
    'job_templates', 'organization_credentials', 'user_credentials',
    'usage_metrics', 'audit_logs', 'report_table_metadata', 
    'report_field_metadata', 'report_templates', 'report_executions'
  ];

  console.log(`\n🎯 Expected Tables (${expectedTables.length}):`);
  expectedTables.forEach((table, index) => {
    const exists = tables.some(t => t.name === table);
    console.log(`${(index + 1).toString().padStart(2)}. ${table} ${exists ? '✅' : '❌'}`);
  });

  // Find extra tables
  const actualTableNames = new Set(tables.map(t => t.name));
  const expectedTableNames = new Set(expectedTables);
  const extraTables = [...actualTableNames].filter(name => !expectedTableNames.has(name));
  
  console.log(`\n⚠️  Extra Tables (${extraTables.length}):`);
  if (extraTables.length > 0) {
    extraTables.forEach((table, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${table} (not in expected schema)`);
    });
  } else {
    console.log('None found');
  }

} catch (error) {
  console.error('❌ Database analysis failed:', error);
} finally {
  db.close();
}

db.close();