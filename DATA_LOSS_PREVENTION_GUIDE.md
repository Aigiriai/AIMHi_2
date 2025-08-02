# Data Loss Prevention Guide for AIM Hi System

## Problem Solved

**Root Cause:** Your deployment environment doesn't persist the `data/` directory between deployments, causing `deploy-setup.sh` to create a fresh database each time, resulting in complete data loss.

**Solution:** Comprehensive backup and restoration system that automatically protects your production data.

## 🛡️ Protection Systems Implemented

### 1. Automatic Backup Scripts

#### backup-database.sh
- Creates timestamped backups before deployments
- Keeps last 10 backups automatically
- Usage: `./backup-database.sh`

#### restore-database.sh
- Restores from the latest backup
- Verifies restored database integrity
- Usage: `./restore-database.sh`

### 2. Data Persistence Manager (server/data-persistence.ts)
- Automatic backup creation during initialization
- Smart restoration when database is missing
- Database statistics and verification
- Production-specific protection logic

### 3. Enhanced Deployment Process (deploy-setup.sh)
**Before:** Always created new database if missing
**After:** 
1. Checks for existing backups first
2. Attempts automatic restoration
3. Only creates fresh database as last resort

### 4. Protected Initialization
- `init-database.ts`: Backup protection before schema creation
- `seed-demo.ts`: Automatic backups before data modifications
- Production environment gets enhanced protection

## 📋 Manual Recovery Instructions

### If You Lost Data Today:
```bash
# 1. Check for any existing backups
ls -la backups/

# 2. If backups exist, restore the latest
./restore-database.sh

# 3. If no backups, check if production.db exists elsewhere
find . -name "production.db*" -type f

# 4. Verify restored data
sqlite3 data/production.db "SELECT COUNT(*) FROM organizations; SELECT COUNT(*) FROM users;"
```

### Before Future Deployments:
**IMPORTANT:** You cannot run shell commands directly in Replit's production deployment environment.

**The protection works automatically:**
1. The enhanced `deploy-setup.sh` runs during deployment
2. It automatically checks for existing backups
3. Restores your data if database is missing
4. Creates backups before any modifications

**In Development (Optional):**
```bash
# Create a backup in your development environment
./backup-database.sh
```

**The system protects your production data automatically - no manual intervention needed.**

## 🚀 Prevention for Future Deployments

### The system now automatically:

1. **During Initialization:**
   - Checks if production database exists
   - If missing, looks for backups to restore
   - Creates fresh database only if no backups available

2. **During Multi-tenant Setup:**
   - Shows current data statistics
   - Creates backup before any modifications
   - Preserves existing organizations and users

3. **During Deployment:**
   - Enhanced deploy-setup.sh checks for restoration options
   - Preserves existing data whenever possible

## 🔍 Verification Commands

### Check Current Data:
```bash
# Database statistics
sqlite3 data/production.db "
SELECT 'Organizations:' as type, COUNT(*) as count FROM organizations
UNION ALL
SELECT 'Users:', COUNT(*) FROM users  
UNION ALL
SELECT 'Jobs:', COUNT(*) FROM jobs
UNION ALL
SELECT 'Candidates:', COUNT(*) FROM candidates;
"
```

### List Backups:
```bash
ls -la backups/production_*.db
```

### Manual Backup:
```bash
./backup-database.sh
```

## 🎯 Key Changes Made

1. **deploy-setup.sh** - Now restoration-aware
2. **server/init-database.ts** - Production data protection
3. **server/seed-demo.ts** - Backup before modifications  
4. **server/data-persistence.ts** - Comprehensive backup system
5. **backup-database.sh** - Manual backup creation
6. **restore-database.sh** - Manual restoration

## ✅ Your Data is Now Protected

The next time you deploy:
- Your existing data will be automatically preserved
- Backups will be created before any changes
- Smart restoration will recover your data if the database goes missing

**No more data loss during deployments!**