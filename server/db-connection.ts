import { drizzle } from 'drizzle-orm/postgres-js';
import { drizzle as sqliteDrizzle } from 'drizzle-orm/better-sqlite3';
import postgres from 'postgres';
import Database from 'better-sqlite3';
import * as postgresSchema from '@shared/schema';
import * as sqliteSchema from './sqlite-schema';
import { initializeSQLiteDatabase } from './init-database';

// Database connection manager
let dbConnection: any = null;
let dbSchema: any = null;

export async function getDB() {
  if (dbConnection) {
    return { db: dbConnection, schema: dbSchema };
  }

  // Always use SQLite database for both development and deployment
  console.log('🗄️ Using SQLite database');
  const { sqlite, db } = await initializeSQLiteDatabase();
  dbConnection = sqliteDrizzle(sqlite, { schema: sqliteSchema });
  dbSchema = sqliteSchema;

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