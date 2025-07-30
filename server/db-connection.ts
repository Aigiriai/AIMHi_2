import { drizzle } from 'drizzle-orm/postgres-js';
import { drizzle as sqliteDrizzle } from 'drizzle-orm/better-sqlite3';
import postgres from 'postgres';
import Database from 'better-sqlite3';
import * as postgresSchema from '@shared/schema';
import * as sqliteSchema from './sqlite-schema';
import { initializeSQLiteDatabase } from './init-database';

// Database connection manager - fixed environment-aware caching
let dbConnection: any = null;
let dbSchema: any = null;
let cachedEnvironment: string | undefined = null;
let cachedDbPath: string | undefined = null;

export async function getDB() {
  const currentEnv = process.env.NODE_ENV;
  const dbName = currentEnv === 'production' ? 'production.db' : 'development.db';
  const expectedDbPath = `./data/${dbName}`;
  
  // CRITICAL FIX: Check if we need to reinitialize due to environment OR database path change
  if (dbConnection && cachedEnvironment === currentEnv && cachedDbPath === expectedDbPath) {
    return { db: dbConnection, schema: dbSchema };
  }
  
  // Log database path change for debugging
  if (cachedDbPath && cachedDbPath !== expectedDbPath) {
    console.log(`🔄 DB CONNECTION: Database path changed from ${cachedDbPath} to ${expectedDbPath}`);
  }

  // Environment changed or first initialization - create new connection
  console.log(`🗄️ Using SQLite database (NODE_ENV: ${currentEnv || 'undefined'})`);
  console.log(`📁 DB CONNECTION: Expected database path: ${expectedDbPath}`);
  
  const sqlite = await initializeSQLiteDatabase();
  dbConnection = sqliteDrizzle(sqlite, { schema: sqliteSchema });
  dbSchema = sqliteSchema;
  cachedEnvironment = currentEnv;
  cachedDbPath = expectedDbPath;
  
  // Log the actual database file being used for debugging
  console.log(`📊 DB CONNECTION: Database initialized for environment: ${currentEnv || 'undefined'}`);
  console.log(`🎯 DB CONNECTION: Cached database path: ${cachedDbPath}`);

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