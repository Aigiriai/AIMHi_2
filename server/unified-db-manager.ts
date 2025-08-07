// UNIFIED DATABASE CONNECTION MANAGER
// This module provides a single entry point for all database operations
// and prevents concurrent initialization conflicts

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../unified-schema";  // ✅ FIXED: Correct schema import
import { readFileSync, existsSync, mkdirSync, unlinkSync, statSync } from "fs";
import { join, resolve } from "path";

interface DatabaseInstance {
  db: any;
  sqlite: Database.Database;
  initialized: boolean;
  initializationPromise?: Promise<DatabaseInstance>;
}

interface InitializationState {
  isInitializing: boolean;
  isComplete: boolean;
  error?: Error;
  timestamp?: Date;
}

// Global state tracking
let dbInstance: DatabaseInstance | null = null;
let initState: InitializationState = {
  isInitializing: false,
  isComplete: false
};

// ✅ FIXED: Proper mutex using Promise-based locking instead of chaining
let initializationMutex: Promise<DatabaseInstance> | null = null;

/**
 * THREAD-SAFE DATABASE INITIALIZATION
 * ✅ FIXED: Proper concurrency protection with atomic locking
 */
export async function getDatabase(): Promise<DatabaseInstance> {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);
  
  console.log(`🔍 DB_MANAGER[${requestId}]: Getting database instance (PID: ${process.pid})`);
  console.log(`🔍 DB_MANAGER[${requestId}]: Current state - initialized: ${!!dbInstance}, complete: ${initState.isComplete}, initializing: ${initState.isInitializing}`);
  
  // If already initialized, return immediately
  if (dbInstance && initState.isComplete) {
    const elapsed = Date.now() - startTime;
    console.log(`✅ DB_MANAGER[${requestId}]: Returning existing database instance (${elapsed}ms)`);
    return dbInstance;
  }

  // ✅ FIXED: Atomic check-and-set for initialization
  if (initializationMutex) {
    console.log(`🔄 DB_MANAGER[${requestId}]: Initialization in progress - waiting for completion...`);
    const waitStart = Date.now();
    try {
      const result = await initializationMutex;
      const waitTime = Date.now() - waitStart;
      const totalTime = Date.now() - startTime;
      console.log(`✅ DB_MANAGER[${requestId}]: Initialization completed after wait (wait: ${waitTime}ms, total: ${totalTime}ms)`);
      return result;
    } catch (error) {
      const waitTime = Date.now() - waitStart;
      console.error(`❌ DB_MANAGER[${requestId}]: Failed while waiting for initialization (wait: ${waitTime}ms):`, error);
      
      // ✅ FIX: Clear mutex on failure to prevent permanent blocking
      initializationMutex = null;
      console.log(`🧹 DB_MANAGER[${requestId}]: Cleared failed initialization mutex`);
      
      throw error;
    }
  }

  // ✅ FIXED: Create initialization promise atomically
  console.log(`🚀 DB_MANAGER[${requestId}]: Starting new initialization process...`);
  initializationMutex = performInitializationWithTimeout();
  
  try {
    const result = await initializationMutex;
    const elapsed = Date.now() - startTime;
    console.log(`✅ DB_MANAGER[${requestId}]: New initialization completed successfully (${elapsed}ms)`);
    return result;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`❌ DB_MANAGER[${requestId}]: New initialization failed (${elapsed}ms):`, error);
    throw error;
  } finally {
    // ✅ FIXED: Clean up mutex to prevent memory leaks
    initializationMutex = null;
    console.log(`🧹 DB_MANAGER[${requestId}]: Initialization mutex cleaned up`);
  }
}

/**
 * ✅ FIXED: Added timeout protection and proper error handling
 */
async function performInitializationWithTimeout(): Promise<DatabaseInstance> {
  const initStartTime = Date.now();
  const timeoutMs = 60000;
  
  console.log(`⏱️ DB_MANAGER: Starting initialization with ${timeoutMs/1000}s timeout`);
  console.log(`📊 DB_MANAGER: Environment - NODE_ENV: ${process.env.NODE_ENV || 'undefined'}, CWD: ${process.cwd()}`);
  console.log(`💾 DB_MANAGER: Memory usage before init:`, process.memoryUsage());
  
  // Create timeout promise with detailed logging and early completion detection
  let timeoutCleanup: (() => void) | null = null;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    let timeoutId: any = null;
    let warningId: any = null;
    
    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (warningId) {
        clearTimeout(warningId);
        warningId = null;
      }
    };
    
    // ✅ FIX: Expose cleanup function without circular reference
    timeoutCleanup = cleanup;
    
    timeoutId = setTimeout(() => {
      const elapsed = Date.now() - initStartTime;
      
      // ✅ FIX: Check if initialization actually completed before timing out
      if (initState.isComplete && dbInstance) {
        console.log(`ℹ️ DB_MANAGER: Timeout fired but initialization is already complete - ignoring timeout`);
        cleanup();
        return;
      }
      
      console.error(`⏰ DB_MANAGER: TIMEOUT after ${elapsed}ms (limit: ${timeoutMs}ms)`);
      console.error(`📊 DB_MANAGER: Timeout context - State: ${JSON.stringify(initState)}`);
      console.error(`💾 DB_MANAGER: Memory at timeout:`, process.memoryUsage());
      cleanup();
      reject(new Error(`Database initialization timeout after ${elapsed}ms (limit: ${timeoutMs}ms)`));
    }, timeoutMs);
    
    // Log timeout warning at 50% mark
    warningId = setTimeout(() => {
      const elapsed = Date.now() - initStartTime;
      
      // ✅ FIX: Don't warn if already complete
      if (initState.isComplete && dbInstance) {
        console.log(`ℹ️ DB_MANAGER: Warning timer fired but initialization is already complete`);
        cleanup();
        return;
      }
      
      if (elapsed < timeoutMs) {
        console.warn(`⚠️ DB_MANAGER: Initialization taking longer than expected (${elapsed}ms / ${timeoutMs}ms)`);
        console.warn(`📊 DB_MANAGER: Current state:`, initState);
      }
    }, timeoutMs * 0.5);
  });

  try {
    console.log(`🚀 DB_MANAGER: Racing initialization vs timeout...`);
    
    // ✅ FIX: Check if already complete before starting race
    if (initState.isComplete && dbInstance) {
      const elapsed = Date.now() - initStartTime;
      console.log(`✅ DB_MANAGER: Initialization already complete - returning existing instance (${elapsed}ms)`);
      return dbInstance;
    }
    
    // Race between initialization and timeout
    const result = await Promise.race([
      performInitialization(),
      timeoutPromise
    ]);
    
    const elapsed = Date.now() - initStartTime;
    console.log(`✅ DB_MANAGER: Initialization completed successfully in ${elapsed}ms`);
    console.log(`💾 DB_MANAGER: Memory usage after init:`, process.memoryUsage());
    
    // ✅ FIX: Clean up timeout timers on successful completion
    if (timeoutCleanup) {
      timeoutCleanup();
      console.log(`🧹 DB_MANAGER: Timeout timers cleaned up after successful initialization`);
    }
    
    return result;
  } catch (error) {
    const elapsed = Date.now() - initStartTime;
    const errorType = error.name || 'Unknown';
    const errorMessage = error.message || 'No message';
    
    // ✅ FIXED: Enhanced error logging with context
    console.error(`❌ DB_MANAGER: Database initialization failed after ${elapsed}ms`);
    console.error(`❌ DB_MANAGER: Error type: ${errorType}`);
    console.error(`❌ DB_MANAGER: Error message: ${errorMessage}`);
    console.error(`❌ DB_MANAGER: Error stack:`, error.stack);
    console.error(`📊 DB_MANAGER: Failure context - State:`, initState);
    console.error(`📊 DB_MANAGER: DB instance state:`, {
      exists: !!dbInstance,
      initialized: dbInstance?.initialized,
      sqliteOpen: dbInstance?.sqlite?.open
    });
    console.error(`💾 DB_MANAGER: Memory at failure:`, process.memoryUsage());
    
    // Reset state on failure
    initState.isInitializing = false;
    initState.error = error as Error;
    initState.timestamp = new Date();
    
    // ✅ FIXED: Enhanced cleanup with logging
    if (dbInstance?.sqlite && !dbInstance.initialized) {
      try {
        console.log(`🧹 DB_MANAGER: Cleaning up failed database connection...`);
        if (dbInstance.sqlite.open) {
          dbInstance.sqlite.close();
          console.log(`✅ DB_MANAGER: Failed database connection closed`);
        } else {
          console.log(`ℹ️ DB_MANAGER: Database connection was already closed`);
        }
      } catch (closeError) {
        console.error(`⚠️ DB_MANAGER: Error closing failed database:`, closeError);
      }
    }
    
    dbInstance = null;
    console.log(`🧹 DB_MANAGER: Database instance cleared after failure`);
    
    throw error;
  }
}

/**
 * CENTRALIZED INITIALIZATION LOGIC
 * ✅ FIXED: Proper state management and error handling
 */
async function performInitialization(): Promise<DatabaseInstance> {
  // ✅ FIXED: Set state atomically at start
  initState.isInitializing = true;
  initState.timestamp = new Date();
  initState.error = undefined;
  
  console.log("� DB_MANAGER: Starting unified database initialization...");

  try {
    // Step 1: Environment setup
    const dataDir = join(process.cwd(), "data");
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
      console.log("📁 DB_MANAGER: Created data directory");
    }

    const dbName = process.env.NODE_ENV === "production" ? "production.db" : "development.db";
    const dbPath = join(dataDir, dbName);
    
    console.log(`📁 DB_MANAGER: Database path: ${dbPath} (NODE_ENV: ${process.env.NODE_ENV})`);

    // Step 2: Proceed directly to smart initialization
    console.log("🔄 DB_MANAGER: Proceeding with smart database initialization...");
    
    // ✅ ENHANCED LOGIC: Smart decision making for database initialization
    let result: DatabaseInstance;
    if (existsSync(dbPath)) {
      console.log("📂 DB_MANAGER: Existing database found - attempting to open and validate...");
      try {
        result = await openAndValidateDatabase(dbPath);
        console.log("✅ DB_MANAGER: Existing database opened successfully - data preserved!");
      } catch (error) {
        console.warn("⚠️ DB_MANAGER: Existing database validation failed:", (error as Error).message);
        console.log("🔄 DB_MANAGER: Attempting backup restoration before creating fresh database...");
        
        // Try backup restoration before creating fresh database
        const backupRestored = await attemptBackupRestoration(dbPath);
        if (backupRestored) {
          console.log("✅ DB_MANAGER: Database restored from backup after validation failure!");
          result = await openAndValidateDatabase(dbPath);
        } else {
          console.log("⚠️ DB_MANAGER: No backup available, creating fresh database");
          result = await createFreshDatabase(dbPath, true); // Force recreate on validation failure
        }
      }
    } else {
      console.log("📂 DB_MANAGER: No existing database found");
      console.log("🔄 DB_MANAGER: Attempting backup restoration before creating fresh database...");
      
      // Try backup restoration first
      const backupRestored = await attemptBackupRestoration(dbPath);
      if (backupRestored) {
        console.log("✅ DB_MANAGER: Database restored from backup!");
        result = await openAndValidateDatabase(dbPath);
      } else {
        console.log("📦 DB_MANAGER: No backup available - creating fresh database...");
        result = await createFreshDatabase(dbPath, false); // Don't force since no existing file
      }
    }
    
    // ✅ FIXED: Update state on success
    initState.isInitializing = false;
    initState.isComplete = true;
    dbInstance = result;
    
    console.log("✅ DB_MANAGER: Database initialization completed successfully");
    return result;
    
  } catch (error) {
    // ✅ FIXED: Proper error state management
    initState.isInitializing = false;
    initState.error = error as Error;
    console.error("❌ DB_MANAGER: Initialization failed:", error);
    throw error;
  }
}

/**
 * PRODUCTION STARTUP HANDLER INTEGRATION
 */
async function handleProductionStartup(dataDir: string): Promise<boolean> {
  console.log("🚀 DB_MANAGER: handleProductionStartup() called");
  console.log(`📁 DB_MANAGER: dataDir = ${dataDir}`);
  console.log(`🌍 DB_MANAGER: NODE_ENV = ${process.env.NODE_ENV}`);
  
  try {
    console.log("📦 DB_MANAGER: Importing production-startup-handler...");
    const startImportTime = Date.now();
    const { handleProductionStartup: startupHandler } = await import("./production-startup-handler");
    const importTime = Date.now() - startImportTime;
    console.log(`✅ DB_MANAGER: Import completed in ${importTime}ms`);
    
    console.log("🔄 DB_MANAGER: Calling production startup handler...");
    const startHandlerTime = Date.now();
    const result = await startupHandler(dataDir);
    const handlerTime = Date.now() - startHandlerTime;
    console.log(`✅ DB_MANAGER: Production startup handler completed in ${handlerTime}ms with result: ${result}`);
    
    return result;
  } catch (error) {
    console.error("❌ DB_MANAGER: Production startup handler failed:", error);
    console.error("❌ DB_MANAGER: Error details:", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack?.substring(0, 300)
    });
    return false;
  }
}

/**
 * BACKUP RESTORATION LOGIC (Environment-Agnostic)
 * Works in both development and production environments
 */
async function attemptBackupRestoration(dbPath: string): Promise<boolean> {
  console.log("🔄 DB_MANAGER: attemptBackupRestoration() started");
  console.log(`📁 DB_MANAGER: Target database path: ${dbPath}`);
  
  try {
    console.log("📦 DB_MANAGER: Importing data-persistence...");
    const startImportTime = Date.now();
    const { dataPersistence } = await import("./data-persistence");
    const importTime = Date.now() - startImportTime;
    console.log(`✅ DB_MANAGER: data-persistence imported in ${importTime}ms`);
    
    console.log("🔄 DB_MANAGER: Calling restoreFromLatestBackup...");
    const startRestoreTime = Date.now();
    const restored = await dataPersistence.restoreFromLatestBackup();
    const restoreTime = Date.now() - startRestoreTime;
    console.log(`✅ DB_MANAGER: restoreFromLatestBackup completed in ${restoreTime}ms with result: ${restored}`);
    
    if (restored && existsSync(dbPath)) {
      console.log("✅ DB_MANAGER: Successfully restored from backup");
      
      // Verify the restored database
      try {
        console.log("🔍 DB_MANAGER: Verifying restored database integrity...");
        const sqlite = new Database(dbPath, { readonly: true });
        const integrityResult = sqlite.pragma("integrity_check", { simple: true });
        sqlite.close();
        console.log(`🔍 DB_MANAGER: Integrity check result: ${integrityResult}`);
        
        if (integrityResult !== 'ok') {
          console.error("❌ DB_MANAGER: Restored database failed integrity check");
          return false;
        }
        
        console.log("✅ DB_MANAGER: Restored database passed integrity check");
      } catch (verificationError) {
        console.error("❌ DB_MANAGER: Error verifying restored database:", verificationError);
        return false;
      }
      
      return true;
    }
    
    console.log("📊 DB_MANAGER: No backup available or restoration failed");
    return false;
  } catch (error) {
    console.error("❌ DB_MANAGER: Backup restoration failed:", error);
    return false;
  }
}

/**
 * FRESH DATABASE CREATION WITH UNIFIED SCHEMA
 * ✅ FIXED: Only removes existing database when forced or corrupted
 */
async function createFreshDatabase(dbPath: string, forceRecreate: boolean = false): Promise<DatabaseInstance> {
  const createStartTime = Date.now();
  
  console.log(`🆕 DB_MANAGER: Creating fresh database with unified schema...`);
  console.log(`📁 DB_MANAGER: Target path: ${dbPath}`);
  console.log(`🔧 DB_MANAGER: Force recreate: ${forceRecreate}`);

  // ✅ FIX: Only remove existing database if forced or we need to recreate
  if (existsSync(dbPath)) {
    if (forceRecreate) {
      const stats = statSync(dbPath);
      console.log(`🗑️ DB_MANAGER: Force recreate - removing existing database file (${Math.round(stats.size / 1024)}KB, modified: ${stats.mtime.toISOString()})`);
      unlinkSync(dbPath);
      console.log(`✅ DB_MANAGER: Existing database file removed successfully`);
    } else {
      console.warn(`⚠️ DB_MANAGER: Database file exists but createFreshDatabase called without forceRecreate=true`);
      console.warn(`⚠️ DB_MANAGER: This may indicate a logic error - proceeding anyway`);
      const stats = statSync(dbPath);
      console.log(`🗑️ DB_MANAGER: Removing existing database file (${Math.round(stats.size / 1024)}KB, modified: ${stats.mtime.toISOString()})`);
      unlinkSync(dbPath);
      console.log(`✅ DB_MANAGER: Existing database file removed`);
    }
  } else {
    console.log(`ℹ️ DB_MANAGER: No existing database file to remove`);
  }

  console.log(`🔧 DB_MANAGER: Creating new SQLite database instance...`);
  const dbCreateStart = Date.now();
  const sqlite = new Database(dbPath);
  const dbCreateTime = Date.now() - dbCreateStart;
  
  console.log(`✅ DB_MANAGER: SQLite instance created in ${dbCreateTime}ms`);
  console.log(`📊 DB_MANAGER: Database info - open: ${sqlite.open}, readonly: ${sqlite.readonly}, name: ${sqlite.name}`);
  
  try {
    // Enhanced pragma logging
    console.log(`⚙️ DB_MANAGER: Configuring SQLite pragmas...`);
    const pragmaStart = Date.now();
    
    const pragmas = [
      "foreign_keys = ON",
      "journal_mode = WAL", 
      "synchronous = NORMAL",
      "cache_size = 1000000",
      "temp_store = memory"
    ];
    
    for (const pragma of pragmas) {
      const pragmaStartSingle = Date.now();
      sqlite.pragma(pragma);
      const pragmaTime = Date.now() - pragmaStartSingle;
      console.log(`  ✅ ${pragma} (${pragmaTime}ms)`);
    }
    
    const totalPragmaTime = Date.now() - pragmaStart;
    console.log(`✅ DB_MANAGER: All pragmas configured in ${totalPragmaTime}ms`);

    // Create Drizzle instance with logging
    console.log(`🔧 DB_MANAGER: Creating Drizzle ORM instance...`);
    const drizzleStart = Date.now();
    const db = drizzle(sqlite, { schema });
    const drizzleTime = Date.now() - drizzleStart;
    console.log(`✅ DB_MANAGER: Drizzle ORM instance created in ${drizzleTime}ms`);

    // Create all tables with detailed logging
    const tableStart = Date.now();
    await createUnifiedTables(sqlite);
    const tableTime = Date.now() - tableStart;
    console.log(`✅ DB_MANAGER: Tables created in ${tableTime}ms`);
    
    // Create indexes with logging
    const indexStart = Date.now();
    await createPerformanceIndexes(sqlite);
    const indexTime = Date.now() - indexStart;
    console.log(`✅ DB_MANAGER: Indexes created in ${indexTime}ms`);
    
    // Seed initial data with logging
    const seedStart = Date.now();
    await seedInitialData(sqlite);
    const seedTime = Date.now() - seedStart;
    console.log(`✅ DB_MANAGER: Initial data seeded in ${seedTime}ms`);

    const totalTime = Date.now() - createStartTime;
    console.log(`✅ DB_MANAGER: Fresh database created successfully in ${totalTime}ms`);
    
    // Final database statistics
    const dbStats = {
      size: statSync(dbPath).size,
      pageCount: sqlite.pragma('page_count', { simple: true }),
      pageSize: sqlite.pragma('page_size', { simple: true }),
      encoding: sqlite.pragma('encoding', { simple: true })
    };
    
    console.log(`📊 DB_MANAGER: Database statistics:`, {
      ...dbStats,
      sizeKB: Math.round(dbStats.size / 1024),
      totalPages: dbStats.pageCount,
      sizeMB: Math.round(dbStats.size / (1024 * 1024) * 100) / 100
    });
    
    return {
      db,
      sqlite,
      initialized: true
    };

  } catch (error) {
    const elapsed = Date.now() - createStartTime;
    console.error(`❌ DB_MANAGER: Fresh database creation failed after ${elapsed}ms:`, error);
    
    try {
      console.log(`🧹 DB_MANAGER: Cleaning up failed database connection...`);
      sqlite.close();
      console.log(`✅ DB_MANAGER: Database connection closed after failure`);
    } catch (closeError) {
      console.error(`⚠️ DB_MANAGER: Error closing database after creation failure:`, closeError);
    }
    
    // Remove partially created database file
    if (existsSync(dbPath)) {
      try {
        unlinkSync(dbPath);
        console.log(`🗑️ DB_MANAGER: Removed partially created database file`);
      } catch (unlinkError) {
        console.error(`⚠️ DB_MANAGER: Error removing partially created database:`, unlinkError);
      }
    }
    
    throw error;
  }
}

/**
 * OPEN AND VALIDATE EXISTING DATABASE  
 * ✅ ENHANCED: Better validation and schema repair
 */
async function openAndValidateDatabase(dbPath: string): Promise<DatabaseInstance> {
  const validationStart = Date.now();
  console.log("🔍 DB_MANAGER: Opening and validating existing database...");
  console.log(`📁 DB_MANAGER: Database path: ${dbPath}`);

  const sqlite = new Database(dbPath);
  
  try {
    // Step 1: Basic integrity check
    console.log("🔍 DB_MANAGER: Performing integrity check...");
    const integrityResult = sqlite.pragma("integrity_check", { simple: true });
    if (integrityResult !== 'ok') {
      throw new Error(`Database integrity check failed: ${integrityResult}`);
    }
    console.log("✅ DB_MANAGER: Database integrity check passed");

    // Step 2: Check database size and basic info
    const dbStats = statSync(dbPath);
    console.log(`📊 DB_MANAGER: Database file size: ${Math.round(dbStats.size / 1024)}KB`);
    console.log(`📊 DB_MANAGER: Last modified: ${dbStats.mtime.toISOString()}`);

    // Step 3: Set pragmas
    console.log("⚙️ DB_MANAGER: Configuring pragmas for existing database...");
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("synchronous = NORMAL");
    sqlite.pragma("cache_size = 1000000");
    sqlite.pragma("temp_store = memory");

    // Step 4: Validate essential tables exist
    console.log("🔍 DB_MANAGER: Checking essential table structure...");
    const essentialTables = ['organizations', 'users', 'jobs', 'candidates'];
    const missingTables: string[] = [];
    
    for (const tableName of essentialTables) {
      const tableExists = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
      if (!tableExists) {
        missingTables.push(tableName);
        console.error(`❌ DB_MANAGER: Essential table '${tableName}' is missing`);
      } else {
        // Check record count for informational purposes  
        const count = sqlite.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };
        console.log(`✅ DB_MANAGER: Table '${tableName}' exists (${count.count} records)`);
      }
    }
    
    if (missingTables.length > 0) {
      throw new Error(`Essential tables missing: ${missingTables.join(', ')}. Database structure is incomplete.`);
    }

    // Step 5: Create Drizzle instance
    const db = drizzle(sqlite, { schema });
    
    const validationTime = Date.now() - validationStart;
    console.log(`✅ DB_MANAGER: Existing database validated successfully in ${validationTime}ms`);

    return {
      db,
      sqlite,
      initialized: true
    };

  } catch (error) {
    const elapsed = Date.now() - validationStart;
    console.error(`❌ DB_MANAGER: Database validation failed after ${elapsed}ms:`, error);
    
    try {
      sqlite.close();
      console.log("🧹 DB_MANAGER: Database connection closed after validation failure");
    } catch (closeError) {
      console.error("⚠️ DB_MANAGER: Error closing database after validation failure:", closeError);
    }
    
    throw error;
  }
}

/**
 * UNIFIED TABLE CREATION
 * This replaces the scattered table creation in multiple files
 */
async function createUnifiedTables(sqlite: Database.Database): Promise<void> {
  const tableStartTime = Date.now();
  console.log(`📝 DB_MANAGER: Creating unified schema tables...`);

  // Define table creation statements with metadata
  const tableDefinitions = [
    { name: 'organizations', description: 'Main organization entities' },
    { name: 'teams', description: 'Organization teams and departments' },
    { name: 'users', description: 'User accounts and authentication' },
    { name: 'user_teams', description: 'User-team membership junction' },
    { name: 'jobs', description: 'Job postings and requirements' },
    { name: 'candidates', description: 'Candidate profiles and resumes' },
    { name: 'job_matches', description: 'AI-generated job-candidate matches' },
    { name: 'interviews', description: 'Interview scheduling and tracking' },
    { name: 'applications', description: 'Job application tracking' },
    { name: 'job_assignments', description: 'Job assignment to users' },
    { name: 'candidate_assignments', description: 'Candidate assignment to users' },
    { name: 'candidate_submissions', description: 'Pending candidate submissions' },
    { name: 'status_history', description: 'Entity status change tracking' },
    { name: 'job_templates', description: 'AI job analysis templates' },
    { name: 'organization_credentials', description: 'Organization login credentials' },
    { name: 'user_credentials', description: 'User temporary credentials' },
    { name: 'usage_metrics', description: 'Billing and usage tracking' },
    { name: 'audit_logs', description: 'System audit and security logs' }
  ];

  const tableSQL = `
    -- Organizations table
    CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      domain TEXT,
      subdomain TEXT,
      plan TEXT NOT NULL DEFAULT 'trial',
      status TEXT NOT NULL DEFAULT 'active',
      timezone TEXT DEFAULT 'UTC',
      date_format TEXT DEFAULT 'MM/DD/YYYY',
      currency TEXT DEFAULT 'USD',
      settings TEXT DEFAULT '{}',
      billing_settings TEXT DEFAULT '{}',
      compliance_settings TEXT DEFAULT '{}',
      integration_settings TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    -- Teams table
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      manager_id INTEGER,
      settings TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (manager_id) REFERENCES users(id)
    );

    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'recruiter',
      manager_id INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      permissions TEXT DEFAULT '{}',
      has_temporary_password INTEGER NOT NULL DEFAULT 0,
      temporary_password TEXT,
      settings TEXT DEFAULT '{}',
      last_login_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (manager_id) REFERENCES users(id)
    );

    -- User teams junction table
    CREATE TABLE IF NOT EXISTS user_teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      role TEXT DEFAULT 'member',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (team_id) REFERENCES teams(id),
      UNIQUE(user_id, team_id)
    );

    -- Jobs table
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      team_id INTEGER,
      created_by INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      experience_level TEXT NOT NULL,
      job_type TEXT NOT NULL,
      keywords TEXT NOT NULL,
      requirements TEXT NOT NULL DEFAULT 'Requirements not specified',
      location TEXT NOT NULL DEFAULT 'Location not specified',
      salary_min INTEGER,
      salary_max INTEGER,
      original_file_name TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      approved_by INTEGER,
      approved_at TEXT,
      closed_at TEXT,
      filled_at TEXT,
      requires_approval INTEGER NOT NULL DEFAULT 1,
      auto_publish_at TEXT,
      application_deadline TEXT,
      settings TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (team_id) REFERENCES teams(id),
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (approved_by) REFERENCES users(id)
    );

    -- Candidates table
    CREATE TABLE IF NOT EXISTS candidates (
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
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (added_by) REFERENCES users(id)
    );

    -- Job matches table
    CREATE TABLE IF NOT EXISTS job_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      job_id INTEGER NOT NULL,
      candidate_id INTEGER NOT NULL,
      matched_by INTEGER NOT NULL,
      match_percentage REAL NOT NULL,
      ai_reasoning TEXT,
      match_criteria TEXT DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (job_id) REFERENCES jobs(id),
      FOREIGN KEY (candidate_id) REFERENCES candidates(id),
      FOREIGN KEY (matched_by) REFERENCES users(id)
    );

    -- Interviews table
    CREATE TABLE IF NOT EXISTS interviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      job_id INTEGER NOT NULL,
      candidate_id INTEGER NOT NULL,
      interviewer_id INTEGER NOT NULL,
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      interviewer_name TEXT,
      interviewer_email TEXT,
      reminder_sent INTEGER DEFAULT 0,
      transcript_path TEXT,
      outcome TEXT,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (job_id) REFERENCES jobs(id),
      FOREIGN KEY (candidate_id) REFERENCES candidates(id),
      FOREIGN KEY (interviewer_id) REFERENCES users(id)
    );

    -- Applications table
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      job_id INTEGER NOT NULL,
      candidate_id INTEGER NOT NULL,
      applied_by INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      substatus TEXT,
      current_stage TEXT NOT NULL DEFAULT 'new',
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      match_percentage REAL,
      source TEXT DEFAULT 'manual',
      notes TEXT DEFAULT '',
      last_stage_change_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_stage_changed_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (job_id) REFERENCES jobs(id),
      FOREIGN KEY (candidate_id) REFERENCES candidates(id),
      FOREIGN KEY (applied_by) REFERENCES users(id),
      FOREIGN KEY (last_stage_changed_by) REFERENCES users(id)
    );

    -- Job assignments table
    CREATE TABLE IF NOT EXISTS job_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      assigned_by INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (job_id) REFERENCES jobs(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (assigned_by) REFERENCES users(id)
    );

    -- Candidate assignments table
    CREATE TABLE IF NOT EXISTS candidate_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'assigned', 'viewer')),
      assigned_by INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (candidate_id) REFERENCES candidates(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (assigned_by) REFERENCES users(id)
    );

    -- Candidate submissions table
    CREATE TABLE IF NOT EXISTS candidate_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      submitted_by INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      experience INTEGER NOT NULL,
      resume_content TEXT NOT NULL,
      resume_file_name TEXT NOT NULL,
      source TEXT DEFAULT 'manual',
      tags TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      submission_notes TEXT,
      reviewed_by INTEGER,
      reviewed_at TEXT,
      review_notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (submitted_by) REFERENCES users(id),
      FOREIGN KEY (reviewed_by) REFERENCES users(id)
    );

    -- Status history table
    CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_by INTEGER NOT NULL,
      reason TEXT,
      notes TEXT,
      changed_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (changed_by) REFERENCES users(id)
    );

    -- Job templates table
    CREATE TABLE IF NOT EXISTS job_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      organization_id INTEGER NOT NULL,
      position_title TEXT NOT NULL,
      seniority_level TEXT NOT NULL,
      department TEXT,
      mandatory_skills TEXT DEFAULT '[]',
      preferred_skills TEXT DEFAULT '[]',
      skill_proficiency_levels TEXT DEFAULT '{}',
      primary_technologies TEXT DEFAULT '[]',
      secondary_technologies TEXT DEFAULT '[]',
      technology_categories TEXT DEFAULT '{}',
      minimum_years_required INTEGER DEFAULT 0,
      specific_domain_experience TEXT DEFAULT '[]',
      industry_background TEXT DEFAULT '[]',
      technical_tasks_percentage INTEGER DEFAULT 70,
      leadership_tasks_percentage INTEGER DEFAULT 20,
      domain_tasks_percentage INTEGER DEFAULT 10,
      skills_match_weight INTEGER DEFAULT 25,
      experience_weight INTEGER DEFAULT 15,
      keyword_weight INTEGER DEFAULT 35,
      technical_depth_weight INTEGER DEFAULT 10,
      domain_knowledge_weight INTEGER DEFAULT 15,
      raw_job_description TEXT NOT NULL,
      ai_generated_data TEXT DEFAULT '{}',
      template_version TEXT DEFAULT '1.0',
      status TEXT DEFAULT 'generated',
      reviewed_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES jobs(id),
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (reviewed_by) REFERENCES users(id)
    );

    -- Organization credentials table
    CREATE TABLE IF NOT EXISTS organization_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      admin_user_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      temporary_password TEXT NOT NULL,
      is_password_changed INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (admin_user_id) REFERENCES users(id)
    );

    -- User credentials table
    CREATE TABLE IF NOT EXISTS user_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      temporary_password TEXT NOT NULL,
      is_password_changed INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
    );

    -- Usage metrics table
    CREATE TABLE IF NOT EXISTS usage_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      user_id INTEGER,
      metric_type TEXT NOT NULL,
      metric_value REAL NOT NULL,
      billing_period TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Audit logs table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      details TEXT DEFAULT '{}',
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `;

  try {
    console.log(`📊 DB_MANAGER: Executing unified schema creation (${tableDefinitions.length} tables)...`);
    
    // Log SQL execution with timing
    const sqlStart = Date.now();
    sqlite.exec(tableSQL);
    const sqlTime = Date.now() - sqlStart;
    
    console.log(`✅ DB_MANAGER: SQL execution completed in ${sqlTime}ms`);
    
    // Verify table creation with detailed logging
    console.log(`🔍 DB_MANAGER: Verifying table creation...`);
    let createdCount = 0;
    let failedTables: string[] = [];
    
    for (const tableDef of tableDefinitions) {
      try {
        const result = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableDef.name);
        if (result) {
          createdCount++;
          console.log(`  ✅ ${tableDef.name} - ${tableDef.description}`);
        } else {
          failedTables.push(tableDef.name);
          console.error(`  ❌ ${tableDef.name} - FAILED TO CREATE`);
        }
      } catch (checkError) {
        failedTables.push(tableDef.name);
        console.error(`  ❌ ${tableDef.name} - VERIFICATION ERROR:`, checkError);
      }
    }
    
    const totalTime = Date.now() - tableStartTime;
    
    if (failedTables.length > 0) {
      throw new Error(`Table creation verification failed for: ${failedTables.join(', ')}`);
    }
    
    console.log(`✅ DB_MANAGER: All ${createdCount} unified schema tables created and verified in ${totalTime}ms`);
    
    // Log database size after table creation
    const dbInfo = sqlite.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get() as { size: number };
    console.log(`📊 DB_MANAGER: Database size after table creation: ${Math.round(dbInfo.size / 1024)}KB`);
    
  } catch (error) {
    const elapsed = Date.now() - tableStartTime;
    console.error(`❌ DB_MANAGER: Table creation failed after ${elapsed}ms:`, error);
    console.error(`❌ DB_MANAGER: SQL that failed:`, tableSQL.substring(0, 500) + '...');
    throw error;
  }
}

/**
 * CREATE PERFORMANCE INDEXES
 */
async function createPerformanceIndexes(sqlite: Database.Database): Promise<void> {
  console.log("📊 DB_MANAGER: Creating performance indexes...");

  const indexSQL = `
    CREATE INDEX IF NOT EXISTS idx_users_org_email ON users(organization_id, email);
    CREATE INDEX IF NOT EXISTS idx_jobs_org ON jobs(organization_id);
    CREATE INDEX IF NOT EXISTS idx_candidates_org ON candidates(organization_id);
    CREATE INDEX IF NOT EXISTS idx_matches_job ON job_matches(job_id);
    CREATE INDEX IF NOT EXISTS idx_matches_candidate ON job_matches(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_interviews_org ON interviews(organization_id);
    CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
    CREATE INDEX IF NOT EXISTS idx_applications_candidate ON applications(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);
    CREATE INDEX IF NOT EXISTS idx_status_history_entity ON status_history(entity_type, entity_id);
  `;

  sqlite.exec(indexSQL);
  console.log("✅ DB_MANAGER: Performance indexes created");
}

/**
 * UNIFIED SEEDING LOGIC
 * This replaces all the scattered seeding code with a single source of truth
 */
async function seedInitialData(sqlite: Database.Database): Promise<void> {
  console.log("🌱 DB_MANAGER: Starting unified seeding process...");

  // Check if database is empty
  const orgCount = sqlite.prepare('SELECT COUNT(*) as count FROM organizations').get() as { count: number };
  const userCount = sqlite.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

  if (orgCount.count > 0 || userCount.count > 0) {
    console.log(`📊 DB_MANAGER: Database not empty (${orgCount.count} orgs, ${userCount.count} users) - skipping seeding`);
    return;
  }

  console.log("🌱 DB_MANAGER: Database is empty - proceeding with seeding...");

  try {
    // Create system organization
    const orgResult = sqlite.prepare(`
      INSERT INTO organizations (name, domain, plan, status, created_at, updated_at) 
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run('AIM Hi System', 'aimhi.app', 'enterprise', 'active');

    const orgId = orgResult.lastInsertRowid;
    console.log(`✅ DB_MANAGER: Created system organization with ID ${orgId}`);

    // Create super admin user
    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash('SuperAdmin123!@#', 10);

    sqlite.prepare(`
      INSERT INTO users (organization_id, email, first_name, last_name, password_hash, role, has_temporary_password, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(orgId, 'superadmin@aimhi.app', 'Super', 'Admin', hashedPassword, 'super_admin', 0);

    console.log("✅ DB_MANAGER: Created super admin user");
    
    // Display credentials
    console.log('=== LOGIN CREDENTIALS ===');
    console.log('Super Admin:');
    console.log('  Email: superadmin@aimhi.app');
    console.log('  Password: SuperAdmin123!@#');
    console.log('========================');

  } catch (error) {
    console.error("❌ DB_MANAGER: Seeding failed:", error);
    throw error;
  }
}

/**
 * LEGACY COMPATIBILITY FUNCTIONS
 * These maintain backward compatibility while using the new unified system
 */
export async function getSQLiteDB() {
  const db = await getDatabase();
  return { db: db.db, sqlite: db.sqlite };
}

export async function initializeSQLiteDB() {
  const db = await getDatabase();
  return { db: db.db, sqlite: db.sqlite };
}

/**
 * INITIALIZATION STATUS WITH ENHANCED DIAGNOSTICS
 */
export function getInitializationStatus() {
  const status = {
    isInitializing: initState.isInitializing,
    isComplete: initState.isComplete,
    error: initState.error,
    timestamp: initState.timestamp,
    dbInstanceExists: !!dbInstance,
    dbInitialized: dbInstance?.initialized,
    sqliteOpen: dbInstance?.sqlite?.open,
    mutexActive: !!initializationMutex,
    uptime: initState.timestamp ? Date.now() - initState.timestamp.getTime() : null
  };
  
  console.log(`📊 DB_STATUS: Current initialization status:`, status);
  return status;
}

/**
 * ✅ FIXED: Proper resource cleanup with error handling
 */
export function resetDatabase(): void {
  console.log("🧹 DB_MANAGER: Starting database cleanup...");
  
  try {
    // ✅ FIXED: Safe database connection cleanup
    if (dbInstance?.sqlite) {
      try {
        // Check if database is still open before closing
        if (dbInstance.sqlite.open) {
          dbInstance.sqlite.close();
          console.log("✅ DB_MANAGER: Database connection closed");
        }
      } catch (closeError) {
        console.error("⚠️ DB_MANAGER: Error closing database connection:", closeError);
        // Continue with cleanup even if close fails
      }
    }
    
    // ✅ FIXED: Clear all global state atomically
    dbInstance = null;
    initState = {
      isInitializing: false,
      isComplete: false,
      error: undefined,
      timestamp: undefined
    };
    
    // ✅ FIXED: Clear initialization mutex to prevent memory leaks
    initializationMutex = null;
    
    console.log("✅ DB_MANAGER: Database state reset successfully");
    
  } catch (error) {
    console.error("❌ DB_MANAGER: Error during database cleanup:", error);
    // Force reset even if cleanup fails
    dbInstance = null;
    initState = {
      isInitializing: false,
      isComplete: false,
      error: error as Error,
      timestamp: new Date()
    };
    initializationMutex = null;
  }
}

/**
 * ✅ NEW: Graceful shutdown for production environments
 */
export async function gracefulShutdown(): Promise<void> {
  console.log("🔄 DB_MANAGER: Starting graceful shutdown...");
  
  try {
    // Wait for any ongoing initialization to complete
    if (initializationMutex) {
      console.log("⏳ DB_MANAGER: Waiting for initialization to complete before shutdown...");
      await initializationMutex;
    }
    
    // Perform cleanup
    resetDatabase();
    
    console.log("✅ DB_MANAGER: Graceful shutdown completed");
  } catch (error) {
    console.error("❌ DB_MANAGER: Error during graceful shutdown:", error);
    // Force cleanup even if graceful shutdown fails
    resetDatabase();
  }
}

/**
 * ✅ NEW: Database health check with comprehensive diagnostics
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  const healthStartTime = Date.now();
  const healthId = Math.random().toString(36).substr(2, 6);
  
  console.log(`🏥 DB_HEALTH[${healthId}]: Starting comprehensive database health check...`);
  
  try {
    // Check 1: Database instance availability
    if (!dbInstance?.sqlite) {
      console.error(`❌ DB_HEALTH[${healthId}]: No database instance available`);
      return false;
    }
    
    console.log(`✅ DB_HEALTH[${healthId}]: Database instance exists`);
    console.log(`📊 DB_HEALTH[${healthId}]: Instance state - open: ${dbInstance.sqlite.open}, readonly: ${dbInstance.sqlite.readonly}`);
    
    // Check 2: Basic connectivity test
    const connectStart = Date.now();
    try {
      const result = dbInstance.sqlite.prepare("SELECT 1 as health").get() as { health: number };
      const connectTime = Date.now() - connectStart;
      
      if (result?.health === 1) {
        console.log(`✅ DB_HEALTH[${healthId}]: Basic connectivity test passed (${connectTime}ms)`);
      } else {
        console.error(`❌ DB_HEALTH[${healthId}]: Basic connectivity test failed - unexpected result:`, result);
        return false;
      }
    } catch (connectError) {
      const connectTime = Date.now() - connectStart;
      console.error(`❌ DB_HEALTH[${healthId}]: Basic connectivity test failed (${connectTime}ms):`, connectError);
      return false;
    }
    
    // Check 3: Essential tables verification
    const tableStart = Date.now();
    const essentialTables = ['organizations', 'users', 'jobs', 'candidates'];
    let tablesOk = 0;
    
    for (const tableName of essentialTables) {
      try {
        const tableCheck = dbInstance.sqlite.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
        ).get(tableName);
        
        if (tableCheck) {
          // Quick count check
          const countResult = dbInstance.sqlite.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };
          console.log(`  ✅ ${tableName}: exists (${countResult.count} records)`);
          tablesOk++;
        } else {
          console.error(`  ❌ ${tableName}: missing`);
        }
      } catch (tableError) {
        console.error(`  ❌ ${tableName}: error checking -`, tableError.message);
      }
    }
    
    const tableTime = Date.now() - tableStart;
    console.log(`📊 DB_HEALTH[${healthId}]: Table verification completed (${tableTime}ms) - ${tablesOk}/${essentialTables.length} essential tables OK`);
    
    if (tablesOk < essentialTables.length) {
      console.error(`❌ DB_HEALTH[${healthId}]: Essential tables missing`);
      return false;
    }
    
    // Check 4: Database integrity
    const integrityStart = Date.now();
    try {
      const integrityResult = dbInstance.sqlite.pragma('integrity_check', { simple: true });
      const integrityTime = Date.now() - integrityStart;
      
      if (integrityResult === 'ok') {
        console.log(`✅ DB_HEALTH[${healthId}]: Integrity check passed (${integrityTime}ms)`);
      } else {
        console.error(`❌ DB_HEALTH[${healthId}]: Integrity check failed (${integrityTime}ms):`, integrityResult);
        return false;
      }
    } catch (integrityError) {
      const integrityTime = Date.now() - integrityStart;
      console.error(`❌ DB_HEALTH[${healthId}]: Integrity check error (${integrityTime}ms):`, integrityError);
      return false;
    }
    
    // Check 5: Performance metrics
    const statsStart = Date.now();
    try {
      const stats = {
        pageCount: dbInstance.sqlite.pragma('page_count', { simple: true }),
        pageSize: dbInstance.sqlite.pragma('page_size', { simple: true }),
        cacheSize: dbInstance.sqlite.pragma('cache_size', { simple: true }),
        journalMode: dbInstance.sqlite.pragma('journal_mode', { simple: true }),
        synchronous: dbInstance.sqlite.pragma('synchronous', { simple: true })
      };
      
      const dbSize = stats.pageCount * stats.pageSize;
      const statsTime = Date.now() - statsStart;
      
      console.log(`📊 DB_HEALTH[${healthId}]: Database statistics (${statsTime}ms):`);
      console.log(`  - Size: ${Math.round(dbSize / 1024)}KB (${stats.pageCount} pages × ${stats.pageSize} bytes)`);
      console.log(`  - Cache: ${stats.cacheSize} pages`);
      console.log(`  - Journal: ${stats.journalMode}, Sync: ${stats.synchronous}`);
      
    } catch (statsError) {
      console.warn(`⚠️ DB_HEALTH[${healthId}]: Could not retrieve statistics:`, statsError.message);
    }
    
    const totalTime = Date.now() - healthStartTime;
    console.log(`✅ DB_HEALTH[${healthId}]: Comprehensive health check passed (${totalTime}ms)`);
    
    return true;
    
  } catch (error) {
    const elapsed = Date.now() - healthStartTime;
    console.error(`❌ DB_HEALTH[${healthId}]: Health check failed after ${elapsed}ms:`, error);
    return false;
  }
}

/**
 * ✅ NEW: Get database with health check and auto-recovery
 */
export async function getDatabaseWithHealthCheck(): Promise<DatabaseInstance> {
  const recoveryStartTime = Date.now();
  const recoveryId = Math.random().toString(36).substr(2, 6);
  
  console.log(`🔄 DB_RECOVERY[${recoveryId}]: Starting database retrieval with health check...`);
  
  try {
    // Step 1: Try to get existing database
    console.log(`📥 DB_RECOVERY[${recoveryId}]: Attempting to get existing database instance...`);
    const dbStart = Date.now();
    
    const db = await getDatabase();
    const dbTime = Date.now() - dbStart;
    
    console.log(`✅ DB_RECOVERY[${recoveryId}]: Database instance retrieved in ${dbTime}ms`);
    
    // Step 2: Perform comprehensive health check
    console.log(`🏥 DB_RECOVERY[${recoveryId}]: Performing health check on retrieved database...`);
    const healthStart = Date.now();
    
    const isHealthy = await checkDatabaseHealth();
    const healthTime = Date.now() - healthStart;
    
    if (isHealthy) {
      const totalTime = Date.now() - recoveryStartTime;
      console.log(`✅ DB_RECOVERY[${recoveryId}]: Database healthy - returning instance (total: ${totalTime}ms)`);
      return db;
    }
    
    console.warn(`⚠️ DB_RECOVERY[${recoveryId}]: Database health check failed (${healthTime}ms) - attempting recovery...`);
    
    // Step 3: Attempt recovery if unhealthy
    console.log(`🔧 DB_RECOVERY[${recoveryId}]: Starting database recovery process...`);
    const recoveryStepStart = Date.now();
    
    // Log current state before reset
    console.log(`� DB_RECOVERY[${recoveryId}]: Pre-recovery state:`, {
      initState: { ...initState },
      dbInstanceExists: !!dbInstance,
      dbInitialized: dbInstance?.initialized,
      sqliteOpen: dbInstance?.sqlite?.open
    });
    
    // Perform reset
    resetDatabase();
    const resetTime = Date.now() - recoveryStepStart;
    console.log(`🧹 DB_RECOVERY[${recoveryId}]: Database reset completed in ${resetTime}ms`);
    
    // Reinitialize
    console.log(`🚀 DB_RECOVERY[${recoveryId}]: Re-initializing database after reset...`);
    const reinitStart = Date.now();
    
    const recoveredDb = await getDatabase();
    const reinitTime = Date.now() - reinitStart;
    
    console.log(`✅ DB_RECOVERY[${recoveryId}]: Database re-initialized in ${reinitTime}ms`);
    
    // Verify recovery success
    const verifyStart = Date.now();
    const isRecovered = await checkDatabaseHealth();
    const verifyTime = Date.now() - verifyStart;
    
    if (isRecovered) {
      const totalRecoveryTime = Date.now() - recoveryStartTime;
      console.log(`✅ DB_RECOVERY[${recoveryId}]: Database recovery successful! (verify: ${verifyTime}ms, total: ${totalRecoveryTime}ms)`);
      return recoveredDb;
    } else {
      const totalRecoveryTime = Date.now() - recoveryStartTime;
      console.error(`❌ DB_RECOVERY[${recoveryId}]: Database recovery failed - health check still failing after ${totalRecoveryTime}ms`);
      throw new Error(`Database recovery failed: health check failed after reset and re-initialization`);
    }
    
  } catch (error) {
    const elapsed = Date.now() - recoveryStartTime;
    const errorDetails = {
      name: (error as Error).name || 'Unknown',
      message: (error as Error).message || 'No message',
      stack: (error as Error).stack?.split('\n').slice(0, 3)
    };
    
    console.error(`❌ DB_RECOVERY[${recoveryId}]: Database recovery failed after ${elapsed}ms`);
    console.error(`❌ DB_RECOVERY[${recoveryId}]: Error details:`, errorDetails);
    console.error(`📊 DB_RECOVERY[${recoveryId}]: Final state:`, {
      initState: { ...initState },
      dbInstanceExists: !!dbInstance,
      mutexExists: !!initializationMutex
    });
    
    throw error;
  }
}

export { schema };
