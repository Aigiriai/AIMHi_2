const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'development.db');
console.log(`📊 Inspecting database: ${dbPath}`);

try {
  const db = new Database(dbPath, { readonly: true });
  
  // Get all tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log('\n📋 Tables in database:');
  tables.forEach(table => console.log(`  - ${table.name}`));
  
  // Get schema for each table
  console.log('\n📊 Table schemas:');
  tables.forEach(table => {
    console.log(`\n🔍 ${table.name}:`);
    const schema = db.prepare(`PRAGMA table_info(${table.name})`).all();
    schema.forEach(col => {
      console.log(`  ${col.cid}|${col.name}|${col.type}|${col.notnull}|${col.dflt_value}|${col.pk}`);
    });
  });
  
  // Get row counts
  console.log('\n📊 Row counts:');
  tables.forEach(table => {
    try {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
      console.log(`  ${table.name}: ${count.count} rows`);
    } catch (e) {
      console.log(`  ${table.name}: Error getting count - ${e.message}`);
    }
  });
  
  db.close();
} catch (error) {
  console.error('❌ Error inspecting database:', error);
}
