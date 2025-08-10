#!/usr/bin/env bash

# COMPREHENSIVE DEPLOYMENT WITH SCHEMA MIGRATION
# This script handles both development and production deployment with automatic schema migration

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
BACKUP_DIR="$SCRIPT_DIR/backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running in Replit
check_environment() {
    if [ -n "$REPL_SLUG" ]; then
        log_info "Running in Replit environment: $REPL_SLUG"
        export DEPLOYMENT_ENV="replit"
    elif [ "$NODE_ENV" = "production" ]; then
        log_info "Running in production environment"
        export DEPLOYMENT_ENV="production"
    else
        log_info "Running in development environment"
        export DEPLOYMENT_ENV="development"
    fi
}

# Create necessary directories
setup_directories() {
    log_info "Setting up directories..."
    
    mkdir -p "$DATA_DIR"
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$SCRIPT_DIR/server/migrations"
    
    log_success "Directories created"
}

# Backup database before any operations
backup_database() {
    local env=$1
    local db_name="${env}.db"
    local db_path="$DATA_DIR/$db_name"
    
    if [ -f "$db_path" ]; then
        local timestamp=$(date +"%Y%m%d_%H%M%S")
        local backup_name="backup_${env}_${timestamp}.db"
        local backup_path="$BACKUP_DIR/$backup_name"
        
        log_info "Creating backup of $db_name..."
        cp "$db_path" "$backup_path"
        
        if [ -f "$backup_path" ]; then
            local backup_size=$(du -h "$backup_path" | cut -f1)
            log_success "Backup created: $backup_name ($backup_size)"
            echo "$backup_path"  # Return backup path
        else
            log_error "Failed to create backup"
            exit 1
        fi
    else
        log_warning "No existing database found at $db_path - skipping backup"
        echo ""  # Return empty string
    fi
}

# Check database health
check_database_health() {
    local env=$1
    local db_name="${env}.db"
    local db_path="$DATA_DIR/$db_name"
    
    if [ ! -f "$db_path" ]; then
        log_info "No existing database found - will create new one"
        return 0
    fi
    
    log_info "Checking database health for $env environment..."
    
    # Use Node.js to check database integrity
    node -e "
        const Database = require('better-sqlite3');
        try {
            const db = new Database('$db_path', { readonly: true });
            const result = db.pragma('integrity_check', { simple: true });
            db.close();
            if (result === 'ok') {
                console.log('✅ Database integrity: OK');
                process.exit(0);
            } else {
                console.log('❌ Database integrity: FAILED -', result);
                process.exit(1);
            }
        } catch (error) {
            console.log('❌ Database check failed:', error.message);
            process.exit(1);
        }
    "
    
    if [ $? -eq 0 ]; then
        log_success "Database health check passed"
        return 0
    else
        log_warning "Database health check failed"
        return 1
    fi
}

# Run schema migration
run_schema_migration() {
    local env=$1
    
    log_info "Running schema migration for $env environment..."
    
    # Use our migration utility
    if [ -f "$SCRIPT_DIR/migrate-database.js" ]; then
        log_info "Using migration utility..."
        node "$SCRIPT_DIR/migrate-database.js" "$env" fix
        
        if [ $? -eq 0 ]; then
            log_success "Schema migration completed successfully"
        else
            log_error "Schema migration failed"
            return 1
        fi
    else
        log_warning "Migration utility not found - skipping explicit migration"
        log_info "Database will be auto-migrated on application startup"
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    if [ -f "package.json" ]; then
        npm install --production=false
        log_success "Dependencies installed"
    else
        log_error "package.json not found"
        exit 1
    fi
}

# Build application
build_application() {
    log_info "Building application..."
    
    # Check if we have a build script
    if grep -q '"build"' package.json; then
        npm run build
        log_success "Application built successfully"
    else
        log_info "No build script found - skipping build step"
    fi
}

# Start application with proper environment
start_application() {
    local env=$1
    
    log_info "Starting application in $env mode..."
    
    # Set environment variables
    export NODE_ENV="$env"
    export DATABASE_PATH="$DATA_DIR"
    
    # Check if we have a start script
    if grep -q '"start"' package.json; then
        log_info "Using npm start..."
        npm start
    else
        log_info "Using direct node execution..."
        node server/index.js
    fi
}

# Verify deployment
verify_deployment() {
    local env=$1
    
    log_info "Verifying deployment..."
    
    # Check if database was created/updated
    local db_name="${env}.db"
    local db_path="$DATA_DIR/$db_name"
    
    if [ -f "$db_path" ]; then
        local db_size=$(du -h "$db_path" | cut -f1)
        log_success "Database exists: $db_name ($db_size)"
        
        # Run final migration check
        if [ -f "$SCRIPT_DIR/migrate-database.js" ]; then
            log_info "Running final verification..."
            node "$SCRIPT_DIR/migrate-database.js" "$env" check
            
            if [ $? -eq 0 ]; then
                log_success "Database schema verification passed"
            else
                log_warning "Database schema verification had issues"
            fi
        fi
    else
        log_warning "Database file not found after deployment"
    fi
}

# Rollback function
rollback_database() {
    local backup_path=$1
    local env=$2
    
    if [ -n "$backup_path" ] && [ -f "$backup_path" ]; then
        local db_name="${env}.db"
        local db_path="$DATA_DIR/$db_name"
        
        log_warning "Rolling back database from backup..."
        cp "$backup_path" "$db_path"
        
        if [ $? -eq 0 ]; then
            log_success "Database rolled back successfully"
        else
            log_error "Failed to rollback database"
        fi
    else
        log_warning "No backup available for rollback"
    fi
}

# Main deployment function
deploy() {
    local environment=${1:-development}
    
    log_info "Starting deployment for $environment environment"
    log_info "Script directory: $SCRIPT_DIR"
    log_info "Data directory: $DATA_DIR"
    log_info "Backup directory: $BACKUP_DIR"
    
    # Setup
    setup_directories
    
    # Create backup
    local backup_path=$(backup_database "$environment")
    
    # Check current database health
    if ! check_database_health "$environment"; then
        log_warning "Database health check failed - proceeding with caution"
    fi
    
    # Install dependencies
    install_dependencies
    
    # Run schema migration
    if ! run_schema_migration "$environment"; then
        log_error "Schema migration failed"
        
        if [ "$environment" = "production" ]; then
            log_error "Aborting production deployment due to migration failure"
            rollback_database "$backup_path" "$environment"
            exit 1
        else
            log_warning "Continuing development deployment despite migration issues"
        fi
    fi
    
    # Build application
    build_application
    
    # Verify everything is ready
    verify_deployment "$environment"
    
    log_success "Deployment completed successfully!"
    
    # Show instructions
    log_info "To start the application:"
    log_info "  NODE_ENV=$environment npm start"
    log_info ""
    log_info "To check database status:"
    log_info "  node migrate-database.js $environment stats"
}

# CLI Interface
case "${1:-deploy}" in
    "deploy")
        check_environment
        deploy "${2:-$DEPLOYMENT_ENV}"
        ;;
    "migrate")
        check_environment
        setup_directories
        run_schema_migration "${2:-development}"
        ;;
    "backup")
        check_environment
        setup_directories
        backup_database "${2:-development}"
        ;;
    "health")
        check_environment
        check_database_health "${2:-development}"
        ;;
    "verify")
        check_environment
        verify_deployment "${2:-development}"
        ;;
    "start")
        check_environment
        start_application "${2:-$DEPLOYMENT_ENV}"
        ;;
    *)
        echo "Usage: $0 {deploy|migrate|backup|health|verify|start} [environment]"
        echo ""
        echo "Commands:"
        echo "  deploy     - Full deployment with migration (default)"
        echo "  migrate    - Run schema migration only"
        echo "  backup     - Create database backup"
        echo "  health     - Check database health"
        echo "  verify     - Verify deployment"
        echo "  start      - Start application"
        echo ""
        echo "Environments: development, production"
        echo "Default environment: development (or detected from NODE_ENV/REPL_SLUG)"
        exit 1
        ;;
esac
