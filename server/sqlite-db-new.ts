import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from "./sqlite-schema";

// DEPRECATED: This file is now replaced by unified-db-manager.ts
// Kept for backward compatibility only

console.warn("⚠️ DEPRECATED: sqlite-db.ts is deprecated. Use unified-db-manager.ts instead");

// Re-export the new unified functions for backward compatibility
export { getSQLiteDB, initializeSQLiteDB, schema } from './unified-db-manager';
