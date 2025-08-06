// Quick test to verify the require() fix
import { existsSync, statSync } from "fs";
import { join } from "path";

console.log("✅ Testing import fixes...");

// Test the statSync import that was causing the error
const testPath = "./package.json";
if (existsSync(testPath)) {
  const stats = statSync(testPath);
  console.log(`✅ statSync import working: ${testPath} size: ${stats.size} bytes`);
} else {
  console.log("❌ Test file not found");
}

console.log("✅ Import test completed successfully!");
