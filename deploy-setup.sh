#!/bin/bash

# Deployment setup script for AIM Hi System
# This script ensures the SQLite database is properly initialized in deployment

echo "🚀 Starting deployment setup..."

# Create data directory if it doesn't exist
mkdir -p data

# Initialize SQLite database with proper schema
echo "📦 Initializing SQLite database..."
sqlite3 data/development.db <<EOF
-- Create organizations table with all required columns
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

-- Add timezone column if it doesn't exist (for existing databases)
ALTER TABLE organizations ADD COLUMN timezone TEXT DEFAULT 'UTC';

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'recruiter',
  manager_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  permissions TEXT DEFAULT '{}',
  last_login_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (manager_id) REFERENCES users(id)
);

-- Create other essential tables
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  created_by INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT NOT NULL,
  location TEXT NOT NULL,
  salary_min INTEGER,
  salary_max INTEGER,
  job_type TEXT NOT NULL,
  keywords TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  settings TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  added_by INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  experience INTEGER NOT NULL,
  resume_content TEXT NOT NULL,
  resume_file_name TEXT NOT NULL,
  source TEXT DEFAULT 'manual',
  tags TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (added_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  manager_id INTEGER,
  settings TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (manager_id) REFERENCES users(id)
);

-- Enable WAL mode for better performance
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 1000;
PRAGMA temp_store = memory;

-- Verify timezone column exists
.schema organizations
EOF

echo "✅ SQLite database initialized successfully"
echo "✅ Deployment setup complete"

# Check if timezone column exists
if sqlite3 data/development.db "PRAGMA table_info(organizations);" | grep -q timezone; then
    echo "✅ Timezone column verified in organizations table"
else
    echo "❌ Timezone column missing - manual intervention required"
    exit 1
fi

echo "🎉 Ready for deployment!"