#!/bin/bash

# Deployment setup script for AIM Hi System
# This script ensures the SQLite database is properly initialized in deployment

echo "🚀 Starting deployment setup..."

# Create data directory if it doesn't exist
mkdir -p data

# Backup existing production database if it exists
if [ -f "data/production.db" ]; then
  echo "📋 Backing up existing production database..."
  cp data/production.db data/production.db.backup.$(date +%Y%m%d_%H%M%S)
  echo "✅ Production database backed up"
else
  echo "📦 No existing production database found - will create new one"
fi

# Only remove development database files (not production)
echo "🧹 Cleaning up development database files..."
rm -f data/development.db
rm -f data/development.db-shm
rm -f data/development.db-wal

# CRITICAL DATA PROTECTION: Check for backup restoration first
if [ ! -f "data/production.db" ]; then
  echo "⚠️  Production database missing - checking for backup restoration..."
  
  # Try to restore from backup first
  if [ -d "backups" ] && [ -n "$(ls backups/production_*.db 2>/dev/null)" ]; then
    echo "🔄 Backup found - attempting restoration..."
    ./restore-database.sh
    
    # Check if restoration was successful
    if [ -f "data/production.db" ]; then
      echo "✅ Database restored from backup - skipping new database creation"
    else
      echo "❌ Backup restoration failed - creating new database"
    fi
  else
    echo "📦 No backups found - creating new SQLite database for production..."
  fi
fi

# Only create new database if no existing database and no successful restoration
if [ ! -f "data/production.db" ]; then
  echo "📦 Creating new SQLite database for production..."
  sqlite3 data/production.db <<EOF
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

-- Create users table with all required columns
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'recruiter',
  manager_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  has_temporary_password INTEGER NOT NULL DEFAULT 0,
  temporary_password TEXT,
  permissions TEXT DEFAULT '{}',
  settings TEXT DEFAULT '{}',
  last_login_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (manager_id) REFERENCES users(id)
);

-- Create jobs table with all required columns (matching development schema)
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
  status TEXT NOT NULL DEFAULT 'active',
  settings TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  requirements TEXT NOT NULL DEFAULT 'Requirements not specified',
  location TEXT NOT NULL DEFAULT 'Location not specified',
  salary_min INTEGER,
  salary_max INTEGER,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
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

-- Create organization_credentials table
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

-- Create user_credentials table
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

-- Create user_teams table
CREATE TABLE IF NOT EXISTS user_teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (team_id) REFERENCES teams(id)
);

-- Create audit_logs table
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

-- Create usage_metrics table
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

-- Enable WAL mode for better performance
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 1000;
PRAGMA temp_store = memory;

-- Verify timezone column exists
.schema organizations
EOF
  echo "✅ New SQLite database created successfully"
else
  echo "✅ Existing production database preserved"
  echo "🔧 Running schema updates on existing database..."
  
  # Run schema updates on existing database without destroying data
  sqlite3 data/production.db <<EOF
-- Add any missing columns (will fail silently if already exist)
ALTER TABLE organizations ADD COLUMN timezone TEXT DEFAULT 'UTC';
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN has_temporary_password INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN temporary_password TEXT;
ALTER TABLE jobs ADD COLUMN requirements TEXT NOT NULL DEFAULT 'Requirements not specified';
ALTER TABLE jobs ADD COLUMN location TEXT NOT NULL DEFAULT 'Location not specified';
ALTER TABLE jobs ADD COLUMN original_file_name TEXT;

-- Enable WAL mode for better performance
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 1000;
PRAGMA temp_store = memory;
EOF
  echo "✅ Schema updates applied to existing database"
fi

echo "✅ Deployment setup complete"

# Check if timezone column exists in production database
if sqlite3 data/production.db "PRAGMA table_info(organizations);" | grep -q timezone; then
    echo "✅ Timezone column verified in organizations table"
else
    echo "❌ Timezone column missing - manual intervention required"
    exit 1
fi

echo "🎉 Ready for deployment!"