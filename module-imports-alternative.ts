// ALTERNATIVE IMPORT STRATEGY FOR PROBLEMATIC MODULES
// Use this if TypeScript continues to complain about module resolution

// Instead of:
// import Database from "better-sqlite3";

// Use dynamic import:
const Database = (await import("better-sqlite3")).default;

// For Node.js built-ins, use explicit node: prefix:
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

// This approach guarantees compatibility across all environments
export { Database };
