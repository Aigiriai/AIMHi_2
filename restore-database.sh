#!/bin/bash

# Database Restore Script for Production
# This script restores the database from the latest backup

echo "🔄 Starting database restore process..."

# Check if backups directory exists
if [ ! -d "backups" ]; then
    echo "❌ No backups directory found"
    exit 1
fi

# Find the latest backup
LATEST_BACKUP=$(ls -t backups/production_*.db 2>/dev/null | head -n 1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ No backup files found in backups/ directory"
    echo "Available files:"
    ls -la backups/ 2>/dev/null || echo "Backups directory is empty"
    exit 1
fi

echo "📦 Found latest backup: $LATEST_BACKUP"

# Create data directory if it doesn't exist
mkdir -p data

# Restore the backup
echo "🔄 Restoring database from backup..."
cp "$LATEST_BACKUP" "data/production.db"

if [ $? -eq 0 ]; then
    echo "✅ Database restored successfully from $LATEST_BACKUP"
    echo "📊 Verifying restored database..."
    
    # Quick verification
    if sqlite3 data/production.db "SELECT COUNT(*) FROM organizations;" > /dev/null 2>&1; then
        ORG_COUNT=$(sqlite3 data/production.db "SELECT COUNT(*) FROM organizations;")
        USER_COUNT=$(sqlite3 data/production.db "SELECT COUNT(*) FROM users;")
        echo "✅ Database verification passed:"
        echo "   - Organizations: $ORG_COUNT"
        echo "   - Users: $USER_COUNT"
    else
        echo "⚠️  Database verification failed - file may be corrupted"
    fi
else
    echo "❌ Failed to restore database"
    exit 1
fi

echo "🎉 Database restore complete"