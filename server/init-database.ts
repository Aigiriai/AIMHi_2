import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";

// DEPRECATED: This initialization logic has been moved to unified-db-manager.ts
// This file is kept for backward compatibility only

console.warn("⚠️ DEPRECATED: init-database.ts is deprecated. Database initialization is now handled by unified-db-manager.ts");

// Initialize SQLite database with proper schema
export async function initializeSQLiteDatabase() {
  console.log("🔄 INIT_DATABASE: Redirecting to unified database manager...");
  
  try {
    // Use the new unified database manager
    const { getDatabase } = await import("./unified-db-manager");
    const dbInstance = await getDatabase();
    
    console.log("✅ INIT_DATABASE: Database initialized via unified manager");
    return dbInstance.sqlite; // Return SQLite instance for backward compatibility
    
  } catch (error) {
    console.error("❌ INIT_DATABASE: Failed to initialize database:", error);
    throw error;
  }
}
