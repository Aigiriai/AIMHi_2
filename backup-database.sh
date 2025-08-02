#!/bin/bash

# Database Backup Script for Production
# This script creates backups before deployment to prevent data loss

echo "🔄 Creating production database backup..."

# Create backup directory
mkdir -p backups

# Get current timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Check if production database exists
if [ -f "data/production.db" ]; then
    echo "📦 Backing up existing production database..."
    cp data/production.db "backups/production_${TIMESTAMP}.db"
    echo "✅ Backup created: backups/production_${TIMESTAMP}.db"
    
    # Keep only last 10 backups to save space
    echo "🧹 Cleaning old backups (keeping last 10)..."
    ls -t backups/production_*.db | tail -n +11 | xargs -r rm
    
    echo "📊 Current backups:"
    ls -la backups/production_*.db 2>/dev/null || echo "No backups found"
else
    echo "⚠️  No production database found to backup"
fi

echo "✅ Backup process complete"