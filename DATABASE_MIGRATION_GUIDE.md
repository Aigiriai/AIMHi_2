# Database Schema Migration Guide

This guide explains how to handle database schema changes gracefully in both development and production environments, specifically designed for Replit deployment.

## Overview

The migration system provides:

1. **Automatic Schema Detection** - Detects missing columns, tables, and other schema drift
2. **Safe Migration Process** - Creates backups and validates changes
3. **Environment-Aware** - Handles development and production differently
4. **Rollback Capability** - Can restore from backups if needed
5. **Manual Override** - Provides tools for manual intervention

## Problem Solved

When you add new features (like the report builder), the schema changes but existing databases on Replit don't automatically get updated. This causes login failures like:

```
SqliteError: no such column: users.report_permissions
```

## Migration System Components

### 1. Migration System Core (`server/migrations/migration-system.ts`)
- **MigrationManager class**: Handles migration logic
- **Schema drift detection**: Compares expected vs actual schema
- **Auto-migration**: Generates and applies fixes automatically
- **Backup creation**: Creates safety backups before changes

### 2. Manual Migration Tool (`migrate-database.js`)
- **Immediate fixes**: Run migrations without restarting the app
- **Database health checks**: Verify integrity and completeness
- **Statistics**: Show database status and record counts
- **CLI interface**: Easy command-line usage

### 3. Deployment Script (`deploy-with-migration.sh`)
- **Full deployment pipeline**: Handles migration + deployment
- **Environment detection**: Auto-detects Replit, production, or development
- **Backup management**: Automatic backups before any changes
- **Verification**: Confirms successful deployment

## Usage Instructions

### Immediate Fix for Current Issue

If you're experiencing the `report_permissions` column error right now:

```bash
# In Replit Shell
node migrate-database.js development fix
```

This will:
- Create a backup of your current database
- Add the missing `report_permissions` column
- Update existing users with default permissions
- Verify the fix worked

### Regular Development Workflow

When you add new schema changes:

```bash
# 1. Check what needs migration
npm run db:check

# 2. Apply migrations (with backup)
npm run migrate:dev

# 3. Check statistics
npm run db:stats
```

### Production Deployment

For production deployments on Replit:

```bash
# Full deployment with migration
npm run deploy:prod

# Or step by step:
npm run db:check:prod
npm run migrate:prod
npm start
```

### Manual Intervention

If automatic migration fails:

```bash
# Check database health
node migrate-database.js production health

# Show detailed statistics
node migrate-database.js production stats

# Try manual fix
node migrate-database.js production fix
```

## Environment Detection

The system automatically detects your environment:

- **Replit**: Detected via `REPL_SLUG` environment variable
- **Production**: When `NODE_ENV=production`
- **Development**: Default fallback

## Migration Process Flow

### For New Databases
1. Create database with full schema
2. Run migration system to validate
3. Seed with initial data
4. Start application

### For Existing Databases
1. Create backup
2. Check database integrity
3. Detect schema drift
4. Apply missing columns/tables
5. Validate changes
6. Start application

### In Case of Errors
1. Stop application
2. Restore from backup
3. Check logs for specific error
4. Apply manual fixes
5. Retry migration

## Backup Management

Backups are automatically created:
- **Location**: `backups/` directory
- **Naming**: `backup_[env]_[timestamp].db`
- **When**: Before any schema changes
- **Retention**: Manual cleanup required

```bash
# Create manual backup
bash deploy-with-migration.sh backup development
```

## Common Migration Scenarios

### Adding New Columns
The system detects missing columns and adds them with:
```sql
ALTER TABLE tablename ADD COLUMN columnname DEFAULT value;
```

### Adding New Tables
New tables are created using the schema definition from `unified-schema.ts`.

### Fixing Data Inconsistencies
The migration system can update existing records to match new requirements.

## Monitoring and Debugging

### Check Application Logs
Look for these migration log patterns:
```
🔄 MIGRATION_SYSTEM: Starting auto-migration...
✅ MIGRATION_SYSTEM: Migration completed successfully
❌ MIGRATION_SYSTEM: Migration failed:
```

### Database Statistics
```bash
npm run db:stats       # Development
npm run db:stats:prod  # Production
```

### Health Checks
```bash
# Check if database is accessible and valid
bash deploy-with-migration.sh health development
```

## Integration with Application

The migration system is integrated at two levels:

### 1. Application Startup (`unified-db-manager.ts`)
- Automatic migration on every app start
- Both new and existing databases
- Non-blocking in development, blocking in production

### 2. Manual Tools
- Independent scripts that can run anytime
- Don't require app restart
- Safe to run multiple times

## Best Practices

### During Development
1. Always run `npm run db:check` before committing schema changes
2. Test migrations on development database first
3. Keep migration logs for troubleshooting

### Before Production Deployment
1. Create manual backup: `npm run migrate:prod` 
2. Test on development environment
3. Monitor logs during deployment

### When Adding New Features
1. Update `unified-schema.ts` with new tables/columns
2. Run local migration to test
3. Commit both schema and migration changes
4. Deploy with migration enabled

### Troubleshooting
1. Check backup directory for recent backups
2. Review migration logs for specific errors
3. Use manual migration tool for targeted fixes
4. Contact team if rollback is needed

## Emergency Procedures

### Database Corruption
```bash
# Check integrity
bash deploy-with-migration.sh health production

# Restore from backup if needed
cp backups/backup_production_[timestamp].db data/production.db
```

### Migration Stuck
```bash
# Kill application
# Run manual migration
node migrate-database.js production fix
# Restart application
```

### Column Already Exists Error
This is usually safe - the migration system handles this gracefully and continues.

## Files to Monitor

- `data/development.db` - Development database
- `data/production.db` - Production database  
- `backups/` - All backup files
- `server/migrations/` - Migration system files
- Application logs in Replit console

---

## Quick Reference

| Task | Command |
|------|---------|
| Fix current login issue | `node migrate-database.js development fix` |
| Check what needs migration | `npm run db:check` |
| Apply development migrations | `npm run migrate:dev` |
| Deploy with migration | `npm run deploy` |
| Show database stats | `npm run db:stats` |
| Create backup | `bash deploy-with-migration.sh backup development` |
| Check database health | `bash deploy-with-migration.sh health development` |

This migration system ensures that your application can handle schema changes gracefully without data loss or service interruption.
