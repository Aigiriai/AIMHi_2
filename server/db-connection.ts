import { drizzle } from 'drizzle-orm/postgres-js';
import { drizzle as sqliteDrizzle } from 'drizzle-orm/better-sqlite3';
import postgres from 'postgres';
import Database from 'better-sqlite3';
import * as postgresSchema from '@shared/schema';
import * as sqliteSchema from './sqlite-schema';
import { initializeSQLiteDatabase } from './init-database';

// Database connection manager - with environment-aware caching
let dbConnection: any = null;
let dbSchema: any = null;
let cachedEnvironment: string | undefined = null;

// Force database reconnection (useful after restoration)
export function resetDBConnection() {
  console.log('🔄 DB: Forcing database connection reset');
  dbConnection = null;
  dbSchema = null;
  cachedEnvironment = null;
}

export async function getDB() {
  const currentEnv = process.env.NODE_ENV;
  
  // Check if we need to reinitialize due to environment change
  if (dbConnection && cachedEnvironment === currentEnv) {
    // Test connection health before returning cached connection
    try {
      await dbConnection.select({ test: 1 }).limit(1);
      return { db: dbConnection, schema: dbSchema };
    } catch (error: any) {
      console.warn(`🔧 DB: Cached connection unhealthy, reinitializing:`, error.message);
      dbConnection = null;
      dbSchema = null;
      cachedEnvironment = null;
    }
  }

  // Environment changed or first initialization - create new connection
  console.log(`🗄️ Using SQLite database (NODE_ENV: ${currentEnv || 'undefined'})`);
  const sqlite = await initializeSQLiteDatabase();
  
  // Test database integrity with I/O error recovery
  try {
    sqlite.pragma('integrity_check');
    console.log(`✅ Database integrity check passed`);
  } catch (error: any) {
    console.error(`❌ Database integrity check failed:`, error.message);
    sqlite.close();
    
    // Handle disk I/O errors specifically
    if (error.code === 'SQLITE_IOERR' || error.code === 'SQLITE_IOERR_SHORT_READ' || error.message?.includes('disk I/O error')) {
      console.log('🔄 Disk I/O error detected - triggering database recovery...');
      
      // Reset connection cache to prevent type pollution
      resetDBConnection();
      
      // Re-trigger initialization which will handle restoration
      const recoveredSqlite = await initializeSQLiteDatabase();
      
      // Create fresh Drizzle connection
      dbConnection = sqliteDrizzle(recoveredSqlite, { schema: sqliteSchema });
      dbSchema = sqliteSchema;
      cachedEnvironment = currentEnv;
      
      console.log('✅ Database recovered from I/O error');
      return { db: dbConnection, schema: dbSchema };
    }
    
    throw new Error(`Database corruption detected: ${error.message}`);
  }
  
  dbConnection = sqliteDrizzle(sqlite, { schema: sqliteSchema });
  dbSchema = sqliteSchema;
  cachedEnvironment = currentEnv;
  
  // Log the actual database file being used for debugging
  console.log(`📊 DB CONNECTION: Database initialized for environment: ${currentEnv || 'undefined'}`);

  return { db: dbConnection, schema: dbSchema };
}

// Get database type for conditional logic
export function isDatabasePostgres(): boolean {
  return false; // Always use SQLite
}

// Get database type for conditional logic
export function isDatabaseSQLite(): boolean {
  return true; // Always use SQLite
}