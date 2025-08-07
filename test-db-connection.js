const { getSQLiteDB } = require('./server/unified-db-manager.ts');

async function testConnection() {
  console.log("🔍 TEST: Starting database connection test...");
  
  try {
    const startTime = Date.now();
    console.log("🔍 TEST: Calling getSQLiteDB()...");
    
    // Add timeout
    const dbPromise = getSQLiteDB();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Database connection test timeout after 15 seconds'));
      }, 15000);
    });
    
    const result = await Promise.race([dbPromise, timeoutPromise]);
    const elapsed = Date.now() - startTime;
    
    console.log(`✅ TEST: Database connection successful in ${elapsed}ms`);
    console.log(`✅ TEST: DB object exists:`, !!result.db);
    console.log(`✅ TEST: SQLite object exists:`, !!result.sqlite);
    
  } catch (error) {
    console.error("❌ TEST: Database connection failed:", error);
    console.error("❌ TEST: Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack?.substring(0, 500)
    });
  }
  
  process.exit(0);
}

testConnection();
