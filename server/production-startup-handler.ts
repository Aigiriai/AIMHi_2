// REPLIT PRODUCTION INTEGRATION FOR SCHEMA UNIFICATION MARKER
// This module is now integrated with unified-db-manager.ts

import { readFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";

/**
 * REPLIT PRODUCTION STARTUP INTEGRATION
 * 
 * This module checks for the .fresh-production-required marker during
 * Replit production startup and handles fresh database creation when needed.
 * 
 * INTEGRATION POINTS:
 * 1. Called by unified-db-manager.ts during production startup
 * 2. Creates fresh database with unified schema when marker detected
 * 3. Cleans up marker after successful initialization
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
    this.markerPath = join(dataDir, ".fresh-production-required");
  }

  /**
   * Check if fresh production database is required
   * This is called by unified-db-manager.ts during initialization
   */
  async checkForFreshProductionMarker(): Promise<boolean> {
    console.log("🔍 PRODUCTION_STARTUP: Starting marker detection process...");
    console.log(`📁 PRODUCTION_STARTUP: Looking for marker at: ${this.markerPath}`);
    
    try {
      if (!existsSync(this.markerPath)) {
        console.log("📊 PRODUCTION_STARTUP: No fresh database marker found - normal startup");
        return false;
      }

      console.log("🔍 PRODUCTION_STARTUP: Found fresh database marker file");
      
      let markerContent = readFileSync(this.markerPath, 'utf-8');
      console.log("📄 PRODUCTION_STARTUP: Raw marker content length:", markerContent.length);
      console.log("📄 PRODUCTION_STARTUP: Raw marker content FULL:", markerContent);
      
      // Validate and parse marker
      const marker = await this.validateAndParseMarker(markerContent);
      if (!marker) {
        return false;
      }
      
      console.log("🚨 PRODUCTION_STARTUP: Fresh database marker detected!");
      console.log(`📅 PRODUCTION_STARTUP: Marker timestamp: ${marker.timestamp}`);
      console.log(`📝 PRODUCTION_STARTUP: Reason: ${marker.reason}`);
      console.log("🔄 PRODUCTION_STARTUP: Will create fresh database with unified schema");
      
      return true;
    } catch (error) {
      console.error("❌ PRODUCTION_STARTUP: Error reading fresh database marker:", error);
      console.log("🔄 PRODUCTION_STARTUP: Treating as invalid marker - proceeding with normal startup");
      return false;
    }
  }

  /**
   * Validate and parse marker content
   */
  private async validateAndParseMarker(markerContent: string): Promise<FreshProductionMarker | null> {
    try {
      // Check if file is empty
      if (!markerContent.trim()) {
        console.log("❌ PRODUCTION_STARTUP: Marker file is empty - treating as invalid");
        return null;
      }
      
      // Check for truncation issues
      if (markerContent.length < 50) {
        console.log("❌ PRODUCTION_STARTUP: Marker file appears truncated - too short");
        return null;
      }
      
      // Clean up formatting issues
      const originalContent = markerContent;
      markerContent = markerContent
        .replace(/\s+/g, ' ')
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .trim();
      
      console.log("📄 PRODUCTION_STARTUP: Content changed during cleanup:", originalContent !== markerContent);
      
      // Validate JSON structure
      if (!markerContent.startsWith('{') || !markerContent.endsWith('}')) {
        console.log("❌ PRODUCTION_STARTUP: Content doesn't look like JSON object");
        return null;
      }
      
      const marker: FreshProductionMarker = JSON.parse(markerContent);
      return marker;
      
    } catch (error) {
      console.error("❌ PRODUCTION_STARTUP: Failed to parse marker:", error);
      return null;
    }
  }

  /**
   * Clean up the fresh production marker after successful initialization
   */
  cleanupMarker(): void {
    try {
      if (existsSync(this.markerPath)) {
        unlinkSync(this.markerPath);
        console.log("🧹 PRODUCTION_STARTUP: Fresh database marker cleaned up");
      }
    } catch (error) {
      console.error("⚠️ PRODUCTION_STARTUP: Failed to cleanup marker:", error);
    }
  }

  /**
   * Get the marker content for logging purposes
   */
  async getMarkerInfo(): Promise<FreshProductionMarker | null> {
    try {
      if (!existsSync(this.markerPath)) {
        return null;
      }
      
      const content = readFileSync(this.markerPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error("❌ PRODUCTION_STARTUP: Failed to read marker info:", error);
      return null;
    }
  }
}

/**
 * EXPORTED CONVENIENCE FUNCTION
 * This is called by unified-db-manager.ts during production startup
 */
export async function handleProductionStartup(dataDir: string = "./data"): Promise<boolean> {
  console.log("🚀 PRODUCTION_STARTUP: Production startup handler called");
  console.log(`📁 PRODUCTION_STARTUP: Data directory: ${dataDir}`);
  
  const handler = new ProductionStartupHandler(dataDir);
  
  try {
    // Check if fresh production is required
    const needsFreshDb = await handler.checkForFreshProductionMarker();
    
    if (needsFreshDb) {
      console.log("🚨 PRODUCTION_STARTUP: Fresh database required");
      // Clean up marker immediately to prevent re-processing
      handler.cleanupMarker();
      console.log("✅ PRODUCTION_STARTUP: Fresh database creation will be handled by unified-db-manager");
      return true;
    }
    
    console.log("📊 PRODUCTION_STARTUP: No fresh database required - normal startup");
    return false;
    
  } catch (error) {
    console.error("❌ PRODUCTION_STARTUP: Error in startup handler:", error);
    return false;
  }
}
