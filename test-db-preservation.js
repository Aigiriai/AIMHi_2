// Test script to verify database preservation
console.log("🧪 Testing database preservation logic...");

import { existsSync } from "fs";
import { join } from "path";

const dataDir = join(process.cwd(), "data");
const dbPath = join(dataDir, "development.db");

console.log(`📁 Data directory: ${dataDir}`);
console.log(`📁 Database path: ${dbPath}`);
console.log(`📊 Database exists: ${existsSync(dbPath)}`);

if (existsSync(dbPath)) {
  const stats = require("fs").statSync(dbPath);
  console.log(`📊 Database size: ${Math.round(stats.size / 1024)}KB`);
  console.log(`📊 Last modified: ${stats.mtime.toISOString()}`);
} else {
  console.log("❌ Database file not found");
}

console.log("✅ Test completed");
