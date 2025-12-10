#!/bin/bash

# 3D Direct Print Service Deployment Script
# This script handles the deployment of the direct print functionality

set -e

echo "🚀 Starting 3D Direct Print Service Deployment..."

# Configuration
ENVIRONMENT=${1:-development}
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"

echo "📋 Environment: $ENVIRONMENT"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to backup database
backup_database() {
    echo "💾 Creating database backup..."
    if command_exists supabase; then
        supabase db dump --file "$BACKUP_DIR/database_backup.sql" || echo "⚠️  Database backup failed (continuing anyway)"
    else
        echo "⚠️  Supabase CLI not found, skipping database backup"
    fi
}

# Function to validate environment variables
validate_environment() {
    echo "🔍 Validating environment configuration..."
    
    required_vars=(
        "NEXT_PUBLIC_SUPABASE_URL"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        "SUPABASE_SERVICE_ROLE_KEY"
        "PRINT_SERVICE_URL"
    )
    
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        echo "❌ Missing required environment variables:"
        printf '%s\n' "${missing_vars[@]}"
        exit 1
    fi
    
    echo "✅ Environment validation passed"
}

# Function to run database migrations
run_migrations() {
    echo "🗄️  Running database migrations..."
    
    if [ -f "./apply-direct-print-migration.js" ]; then
        node ./apply-direct-print-migration.js || {
            echo "❌ Migration failed"
            exit 1
        }
    else
        echo "⚠️  Migration script not found, skipping"
    fi
    
    echo "✅ Database migrations completed"
}

# Function to create storage buckets
setup_storage() {
    echo "🪣 Setting up storage buckets..."
    
    if [ -f "./create-storage-buckets.js" ]; then
        node ./create-storage-buckets.js || {
            echo "❌ Storage setup failed"
            exit 1
        }
    else
        echo "⚠️  Storage setup script not found, skipping"
    fi
    
    echo "✅ Storage setup completed"
}

# Function to build the application
build_application() {
    echo "🔨 Building application..."
    
    # Install dependencies
    if [ -f "package-lock.json" ]; then
        npm ci
    elif [ -f "pnpm-lock.yaml" ]; then
        pnpm install --frozen-lockfile
    elif [ -f "yarn.lock" ]; then
        yarn install --frozen-lockfile
    else
        npm install
    fi
    
    # Build the application
    npm run build || {
        echo "❌ Build failed"
        exit 1
    }
    
    echo "✅ Application built successfully"
}

# Function to run health checks
run_health_checks() {
    echo "🏥 Running health checks..."
    
    # Check if the application starts
    timeout 30s npm start &
    APP_PID=$!
    
    sleep 10
    
    # Check if the process is still running
    if kill -0 $APP_PID 2>/dev/null; then
        echo "✅ Application started successfully"
        kill $APP_PID
        wait $APP_PID 2>/dev/null || true
    else
        echo "❌ Application failed to start"
        exit 1
    fi
}

# Function to setup monitoring
setup_monitoring() {
    echo "📊 Setting up monitoring..."
    
    if [ "$MONITORING_ENABLED" = "true" ]; then
        echo "✅ Monitoring enabled in configuration"
        # Add any monitoring setup commands here
    else
        echo "⚠️  Monitoring disabled in configuration"
    fi
}

# Main deployment flow
main() {
    echo "🎯 Starting deployment for environment: $ENVIRONMENT"
    
    # Load environment variables
    if [ -f ".env.$ENVIRONMENT" ]; then
        echo "📁 Loading environment from .env.$ENVIRONMENT"
        export $(cat .env.$ENVIRONMENT | grep -v '^#' | xargs)
    elif [ -f ".env.local" ] && [ "$ENVIRONMENT" = "development" ]; then
        echo "📁 Loading environment from .env.local"
        export $(cat .env.local | grep -v '^#' | xargs)
    else
        echo "⚠️  No environment file found for $ENVIRONMENT"
    fi
    
    # Run deployment steps
    backup_database
    validate_environment
    run_migrations
    setup_storage
    build_application
    setup_monitoring
    
    if [ "$ENVIRONMENT" != "production" ]; then
        run_health_checks
    fi
    
    echo "🎉 Deployment completed successfully!"
    echo "📋 Deployment summary:"
    echo "   - Environment: $ENVIRONMENT"
    echo "   - Backup location: $BACKUP_DIR"
    echo "   - Print Service URL: $PRINT_SERVICE_URL"
    echo "   - Storage Bucket: $DIRECT_PRINT_STORAGE_BUCKET"
    echo "   - Monitoring: $([ "$MONITORING_ENABLED" = "true" ] && echo "Enabled" || echo "Disabled")"
}

# Handle script arguments
case "$1" in
    "production"|"staging"|"development")
        main
        ;;
    "validate")
        validate_environment
        ;;
    "migrate")
        run_migrations
        ;;
    "build")
        build_application
        ;;
    "health")
        run_health_checks
        ;;
    *)
        echo "Usage: $0 {production|staging|development|validate|migrate|build|health}"
        echo ""
        echo "Commands:"
        echo "  production   - Deploy to production environment"
        echo "  staging      - Deploy to staging environment"
        echo "  development  - Deploy to development environment"
        echo "  validate     - Validate environment configuration only"
        echo "  migrate      - Run database migrations only"
        echo "  build        - Build application only"
        echo "  health       - Run health checks only"
        exit 1
        ;;
esac