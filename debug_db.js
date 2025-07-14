import Database from 'better-sqlite3';
const db = new Database('./database.sqlite');

// Check what tables actually exist
console.log('=== Database Debug ===');

try {
  // List all tables in the database
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Existing tables:', tables.map(t => t.name));
  
  // Check if candidates table exists
  const candidatesTableExists = tables.some(t => t.name === 'candidates');
  console.log('Candidates table exists:', candidatesTableExists);
  
  if (candidatesTableExists) {
    const candidates = db.prepare('SELECT COUNT(*) as count FROM candidates').get();
    console.log('Total candidates in DB:', candidates.count);
    
    if (candidates.count > 0) {
      const allCandidates = db.prepare('SELECT id, name, email, phone, organization_id, added_by, created_at FROM candidates LIMIT 5').all();
      console.log('Sample candidates:', allCandidates);
    }
  } else {
    console.log('Creating candidates table manually...');
    db.exec(`
      CREATE TABLE candidates (
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
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Candidates table created successfully');
  }
  
  const jobs = db.prepare('SELECT COUNT(*) as count FROM jobs').get();
  console.log('Total jobs in DB:', jobs.count);
  
  // Check interviews table structure
  const interviewsTableExists = tables.some(t => t.name === 'interviews');
  console.log('Interviews table exists:', interviewsTableExists);
  
  if (interviewsTableExists) {
    const interviewsSchema = db.prepare("PRAGMA table_info(interviews)").all();
    console.log('Interviews table schema:', interviewsSchema);
  }
  
} catch (error) {
  console.error('Database error:', error);
}

db.close();