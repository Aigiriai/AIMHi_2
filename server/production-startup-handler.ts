// REPLIT PRODUCTION INTEGRATION FOR SCHEMA UNIFICATION MARKER

import * as fs from "fs";
import * as path from "path";
import Database from "better-sqlite3";

/**
 * REPLIT PRODUCTION STARTUP INTEGRATION
 * 
 * This module checks for the .fresh-production-required marker during
 * Replit production startup and handles fresh database creation when needed.
 * 
 * INTEGRATION POINTS:
 * 1. Called before any backup restoration attempts
 * 2. Overrides normal backup restoration if marker detected
 * 3. Creates fresh database with unified schema
 * 4. Cleans up marker after successful initialization
 */

interface FreshProductionMarker {
  timestamp: string;
  reason: string;
  originalSchemas: string[];
}

export class ProductionStartupHandler {
  private dataDir: string;
  private markerPath: string;

  constructor(dataDir: string = "./data") {
    this.dataDir = dataDir;
    this.markerPath = path.join(dataDir, ".fresh-production-required");
  }

  /**
   * Check if fresh production database is required
   * This should be called BEFORE any backup restoration attempts
   */
  async checkForFreshProductionMarker(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.markerPath)) {
        console.log("📊 PRODUCTION: No fresh database marker found - normal startup");
        return false;
      }

      const markerContent = fs.readFileSync(this.markerPath, 'utf-8');
      const marker: FreshProductionMarker = JSON.parse(markerContent);
      
      console.log("🚨 PRODUCTION: Fresh database marker detected!");
      console.log(`📅 PRODUCTION: Marker timestamp: ${marker.timestamp}`);
      console.log(`📝 PRODUCTION: Reason: ${marker.reason}`);
      console.log("🔄 PRODUCTION: Will create fresh database with unified schema");
      
      return true;
    } catch (error) {
      console.error("❌ PRODUCTION: Error reading fresh database marker:", error);
      return false;
    }
  }

  /**
   * Handle fresh production database creation
   * This creates a new database with unified schema instead of restoring from backup
   */
  async handleFreshProduction(): Promise<boolean> {
    try {
      console.log("🆕 PRODUCTION: Creating fresh database with unified schema...");
      
      // Ensure data directory exists
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
        console.log(`📁 PRODUCTION: Created data directory: ${this.dataDir}`);
      }

      const prodDbPath = path.join(this.dataDir, "production.db");
      
      // Remove existing database if it exists
      if (fs.existsSync(prodDbPath)) {
        fs.unlinkSync(prodDbPath);
        console.log("🗑️ PRODUCTION: Removed existing production database");
      }

      // Create fresh database with unified schema
      await this.createFreshDatabase(prodDbPath);
      
      // Clean up the marker after successful creation
      this.cleanupMarker();
      
      console.log("✅ PRODUCTION: Fresh database created successfully with unified schema");
      return true;
      
    } catch (error) {
      console.error("❌ PRODUCTION: Failed to create fresh database:", error);
      return false;
    }
  }

  /**
   * Create fresh database with unified schema
   */
  private async createFreshDatabase(dbPath: string): Promise<void> {
    const db = new Database(dbPath);
    
    console.log("📝 PRODUCTION: Creating tables with unified schema...");
    
    // Use the unified schema to create all tables
    // This matches the schema from unified-schema.ts
    const createTablesSQL = [
      `CREATE TABLE organizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        timezone TEXT DEFAULT "UTC",
        date_format TEXT DEFAULT "MM/DD/YYYY", 
        currency TEXT DEFAULT "USD",
        billing_settings TEXT DEFAULT "{}",
        compliance_settings TEXT DEFAULT "{}",
        integration_settings TEXT DEFAULT "{}"
      )`,
      
      `CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
      )`,
      
      `CREATE TABLE jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        requirements TEXT NOT NULL DEFAULT "Requirements not specified",
        location TEXT NOT NULL DEFAULT "Location not specified",
        salary_min INTEGER,
        salary_max INTEGER,
        status TEXT NOT NULL DEFAULT 'draft',
        created_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        original_file_name TEXT,
        approved_by INTEGER REFERENCES users(id),
        approved_at TEXT,
        closed_at TEXT,
        filled_at TEXT,
        requires_approval INTEGER NOT NULL DEFAULT 1,
        auto_publish_at TEXT,
        application_deadline TEXT,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,
      
      `CREATE TABLE candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        experience INTEGER NOT NULL,
        resume_content TEXT NOT NULL,
        resume_file_name TEXT NOT NULL,
        created_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,
      
      `CREATE TABLE interviews (
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
      )`,
      
      `CREATE TABLE applications (
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
      )`,
      
      `CREATE TABLE job_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        assigned_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (assigned_by) REFERENCES users(id)
      )`,
      
      `CREATE TABLE candidate_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        candidate_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('owner', 'assigned', 'viewer')),
        assigned_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (candidate_id) REFERENCES candidates(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (assigned_by) REFERENCES users(id)
      )`,
      
      `CREATE TABLE candidate_submissions (
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
      )`,
      
      `CREATE TABLE status_history (
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
      )`
    ];
    
    // Execute all table creation statements
    for (const sql of createTablesSQL) {
      try {
        db.exec(sql);
        console.log("✅ PRODUCTION: Created table successfully");
      } catch (error) {
        console.error("❌ PRODUCTION: Failed to create table:", error);
        throw error;
      }
    }
    
    // Create seed data for production
    await this.createSeedData(db);
    
    db.close();
    console.log("📊 PRODUCTION: Database created with unified schema");
  }

  /**
   * Create minimal seed data for production
   */
  private async createSeedData(db: any): Promise<void> {
    console.log("🌱 PRODUCTION: Creating seed data...");
    
    // Create default organization
    db.exec(`
      INSERT INTO organizations (name, created_at, updated_at) 
      VALUES ('Default Organization', datetime('now'), datetime('now'))
    `);
    
    // Create admin user
    db.exec(`
      INSERT INTO users (organization_id, username, password_hash, role, created_at, updated_at) 
      VALUES (1, 'admin', 'admin', 'admin', datetime('now'), datetime('now'))
    `);
    
    console.log("✅ PRODUCTION: Seed data created");
  }

  /**
   * Clean up the fresh production marker after successful initialization
   */
  private cleanupMarker(): void {
    try {
      if (fs.existsSync(this.markerPath)) {
        fs.unlinkSync(this.markerPath);
        console.log("🧹 PRODUCTION: Fresh database marker cleaned up");
      }
    } catch (error) {
      console.error("⚠️ PRODUCTION: Failed to cleanup marker:", error);
      // Non-critical error, don't fail the process
    }
  }

  /**
   * Get the marker content for logging purposes
   */
  async getMarkerInfo(): Promise<FreshProductionMarker | null> {
    try {
      if (!fs.existsSync(this.markerPath)) {
        return null;
      }
      
      const content = fs.readFileSync(this.markerPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error("❌ Failed to read marker info:", error);
      return null;
    }
  }
}

// Export convenience function for easy integration
export async function handleProductionStartup(dataDir: string = "./data"): Promise<boolean> {
  const handler = new ProductionStartupHandler(dataDir);
  
  // Check if fresh production is required
  const needsFreshDb = await handler.checkForFreshProductionMarker();
  
  if (needsFreshDb) {
    // Handle fresh production database creation
    return await handler.handleFreshProduction();
  }
  
  // Normal startup - no marker detected
  return false;
}
