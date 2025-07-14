import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { jobs, candidates, jobMatches } from "@shared/schema";

// Create the database connection
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client);

// Initialize database tables
export async function initializeDatabase() {
  try {
    console.log("🔄 Initializing database...");
    
    // Create tables if they don't exist
    await client`
      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        experience_level TEXT NOT NULL,
        job_type TEXT NOT NULL,
        keywords TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await client`
      CREATE TABLE IF NOT EXISTS candidates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT NOT NULL,
        experience INTEGER NOT NULL,
        resume_content TEXT NOT NULL,
        resume_file_name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await client`
      CREATE TABLE IF NOT EXISTS job_matches (
        id SERIAL PRIMARY KEY,
        job_id INTEGER REFERENCES jobs(id),
        candidate_id INTEGER REFERENCES candidates(id),
        match_percentage REAL NOT NULL,
        ai_reasoning TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    console.log("✅ Database initialized successfully!");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
}