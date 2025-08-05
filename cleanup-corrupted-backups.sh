#!/bin/bash

# Cleanup script for corrupted backup files
# This script removes all potentially corrupted backup files to prevent database corruption issues

echo "🧹 Starting cleanup of potentially corrupted backup files..."

# Function to check if a database file is corrupted
check_db_corruption() {
  local db_file="$1"
  if [ -f "$db_file" ]; then
    # Check if file can be opened and has proper SQLite header
    if sqlite3 "$db_file" "PRAGMA integrity_check;" 2>/dev/null | grep -q "ok"; then
      return 0  # Database is OK
    else
      return 1  # Database is corrupted
    fi
  fi
  return 1  # File doesn't exist
}

# Create data directory if it doesn't exist
mkdir -p data

echo "🔍 Scanning for corrupted backup files in data directory..."

# Count files before cleanup
backup_count=$(find data/ -name "*.backup*" -type f 2>/dev/null | wc -l)
wal_count=$(find data/ -name "*-wal" -type f 2>/dev/null | wc -l)
shm_count=$(find data/ -name "*-shm" -type f 2>/dev/null | wc -l)

echo "📊 Found $backup_count backup files, $wal_count WAL files, and $shm_count SHM files"

# Remove all backup files (they may be corrupted)
echo "🗑️ Removing all backup files..."
find data/ -name "*.backup*" -type f -delete 2>/dev/null || true

# Remove WAL and SHM files (can cause corruption if database is missing)
echo "🗑️ Removing WAL and SHM files..."
find data/ -name "*-wal" -type f -delete 2>/dev/null || true
find data/ -name "*-shm" -type f -delete 2>/dev/null || true

# Check if production database exists and is corrupted
if [ -f "data/production.db" ]; then
  echo "🔍 Checking production database integrity..."
  if check_db_corruption "data/production.db"; then
    echo "✅ Production database integrity verified"
  else
    echo "❌ Production database is corrupted - removing it"
    rm -f data/production.db
    echo "🗑️ Corrupted production database removed"
  fi
fi

# Check if development database exists and is corrupted
if [ -f "data/development.db" ]; then
  echo "🔍 Checking development database integrity..."
  if check_db_corruption "data/development.db"; then
    echo "✅ Development database integrity verified"
  else
    echo "❌ Development database is corrupted - removing it"
    rm -f data/development.db
    echo "🗑️ Corrupted development database removed"
  fi
fi

# Set environment variable to skip backup restoration if corruption was detected
if [ "$backup_count" -gt 0 ] || [ "$wal_count" -gt 0 ] || [ "$shm_count" -gt 0 ]; then
  echo "⚠️ Corruption indicators found - setting SKIP_BACKUP_RESTORATION=true"
  export SKIP_BACKUP_RESTORATION=true
  echo "SKIP_BACKUP_RESTORATION=true" >> .env 2>/dev/null || true
fi

echo "✅ Cleanup completed successfully"
echo "🔄 Database will be freshly initialized on next startup"