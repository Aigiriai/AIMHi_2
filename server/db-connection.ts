import { drizzle } from 'drizzle-orm/postgres-js';
import { drizzle as sqliteDrizzle } from 'drizzle-orm/better-sqlite3';
import postgres from 'postgres';
import Database from 'better-sqlite3';
import * as postgresSchema from '@shared/schema';
import * as sqliteSchema from './sqlite-schema';

// Database connection manager
let dbConnection: any = null;
let dbSchema: any = null;

export async function getDB() {
  if (dbConnection) {
    return { db: dbConnection, schema: dbSchema };
  }

  // Always use SQLite database for both development and deployment
  console.log('🗄️ Using SQLite database');
  const sqlite = new Database('data/development.db');
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