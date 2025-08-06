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
      
      // Read file with explicit encoding and error handling
      let markerContent: string;
      try {
        markerContent = readFileSync(this.markerPath, 'utf-8');
        console.log("📄 PRODUCTION_STARTUP: File read successfully");
        console.log("📊 PRODUCTION_STARTUP: Raw content length:", markerContent.length);
        console.log("📄 PRODUCTION_STARTUP: Raw content (first 200 chars):", markerContent.substring(0, 200));
      } catch (readError) {
        console.error("❌ PRODUCTION_STARTUP: Failed to read marker file:", readError);
        return false;
      }
      
      // Validate and parse marker
      const marker = await this.validateAndParseMarker(markerContent);
      if (!marker) {
        console.log("❌ PRODUCTION_STARTUP: Marker validation failed - treating as invalid");
        
        // ✅ SAFETY: Remove corrupted marker file to prevent repeated failures
        try {
          console.log("🧹 PRODUCTION_STARTUP: Removing corrupted marker file to prevent future issues");
          unlinkSync(this.markerPath);
          console.log("✅ PRODUCTION_STARTUP: Corrupted marker file removed successfully");
        } catch (removeError) {
          console.error("⚠️ PRODUCTION_STARTUP: Failed to remove corrupted marker file:", removeError);
        }
        
        return false;
      }
      
      console.log("🚨 PRODUCTION_STARTUP: Fresh database marker detected!");
      console.log(`📅 PRODUCTION_STARTUP: Marker timestamp: ${marker.timestamp}`);
      console.log(`📝 PRODUCTION_STARTUP: Reason: ${marker.reason}`);
      console.log("🔄 PRODUCTION_STARTUP: Will create fresh database with unified schema");
      
      return true;
    } catch (error) {
      console.error("❌ PRODUCTION_STARTUP: Error in marker detection process:", error);
      console.log("🔄 PRODUCTION_STARTUP: Treating as invalid marker - proceeding with normal startup");
      return false;
    }
  }

  /**
   * Validate and parse marker content
   */
  private async validateAndParseMarker(markerContent: string): Promise<FreshProductionMarker | null> {
    try {
      console.log("🔍 PRODUCTION_STARTUP: Validating marker content...");
      console.log(`📊 PRODUCTION_STARTUP: Content length: ${markerContent.length}`);
      console.log(`📄 PRODUCTION_STARTUP: First 100 chars: "${markerContent.substring(0, 100)}"`);
      console.log(`📄 PRODUCTION_STARTUP: Last 50 chars: "${markerContent.substring(Math.max(0, markerContent.length - 50))}"`);
      
      // Check if file is empty
      if (!markerContent.trim()) {
        console.log("❌ PRODUCTION_STARTUP: Marker file is empty - treating as invalid");
        return null;
      }
      
      // Clean up any whitespace/newlines and handle Windows line endings
      const cleanedContent = markerContent.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      console.log(`📊 PRODUCTION_STARTUP: Cleaned content length: ${cleanedContent.length}`);
      
      // Check for truncation issues
      if (cleanedContent.length < 50) {
        console.log("❌ PRODUCTION_STARTUP: Marker file appears truncated - too short");
        console.log(`📄 PRODUCTION_STARTUP: Full cleaned content: "${cleanedContent}"`);
        return null;
      }
      
      // Validate JSON structure
      if (!cleanedContent.startsWith('{') || !cleanedContent.endsWith('}')) {
        console.log("❌ PRODUCTION_STARTUP: Content doesn't look like JSON object");
        console.log(`📄 PRODUCTION_STARTUP: Starts with: "${cleanedContent.charAt(0)}" (should be '{')`);
        console.log(`📄 PRODUCTION_STARTUP: Ends with: "${cleanedContent.charAt(cleanedContent.length - 1)}" (should be '}')`);
        console.log(`📄 PRODUCTION_STARTUP: Full content for debug: "${cleanedContent}"`);
        return null;
      }
      
      console.log("✅ PRODUCTION_STARTUP: Content looks like valid JSON, attempting to parse...");
      const marker: FreshProductionMarker = JSON.parse(cleanedContent);
      
      // Validate required fields
      if (!marker.timestamp || !marker.reason) {
        console.log("❌ PRODUCTION_STARTUP: Missing required fields in marker");
        console.log(`📊 PRODUCTION_STARTUP: Has timestamp: ${!!marker.timestamp}`);
        console.log(`📊 PRODUCTION_STARTUP: Has reason: ${!!marker.reason}`);
        return null;
      }
      
      console.log("✅ PRODUCTION_STARTUP: Marker parsed and validated successfully");
      return marker;
      
    } catch (error) {
      console.error("❌ PRODUCTION_STARTUP: Failed to parse marker:", error);
      console.log(`📄 PRODUCTION_STARTUP: Raw content that failed: "${markerContent}"`);
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
