# 3D Direct Print Service Deployment Script (PowerShell)
# This script handles the deployment of the direct print functionality on Windows

param(
    [Parameter(Position=0)]
    [ValidateSet("production", "staging", "development", "validate", "migrate", "build", "health")]
    [string]$Command = "development"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting 3D Direct Print Service Deployment..." -ForegroundColor Green

# Configuration
$Environment = if ($Command -in @("production", "staging", "development")) { $Command } else { "development" }
$BackupDir = "./backups/$(Get-Date -Format 'yyyyMMdd_HHmmss')"

Write-Host "📋 Environment: $Environment" -ForegroundColor Cyan

# Create backup directory
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

# Function to check if command exists
function Test-CommandExists {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Function to backup database
function Backup-Database {
    Write-Host "💾 Creating database backup..." -ForegroundColor Yellow
    
    if (Test-CommandExists "supabase") {
        try {
            & supabase db dump --file "$BackupDir/database_backup.sql"
            Write-Host "✅ Database backup completed" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  Database backup failed (continuing anyway)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️  Supabase CLI not found, skipping database backup" -ForegroundColor Yellow
    }
}

# Function to validate environment variables
function Test-Environment {
    Write-Host "🔍 Validating environment configuration..." -ForegroundColor Yellow
    
    $requiredVars = @(
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY", 
        "SUPABASE_SERVICE_ROLE_KEY",
        "PRINT_SERVICE_URL"
    )
    
    $missingVars = @()
    
    foreach ($var in $requiredVars) {
        if (-not (Get-Variable -Name $var -ErrorAction SilentlyContinue) -and -not $env:$var) {
            $missingVars += $var
        }
    }
    
    if ($missingVars.Count -gt 0) {
        Write-Host "❌ Missing required environment variables:" -ForegroundColor Red
        $missingVars | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
        throw "Environment validation failed"
    }
    
    Write-Host "✅ Environment validation passed" -ForegroundColor Green
}

# Function to run database migrations
function Invoke-Migrations {
    Write-Host "🗄️  Running database migrations..." -ForegroundColor Yellow
    
    if (Test-Path "./apply-direct-print-migration.js") {
        try {
            & node ./apply-direct-print-migration.js
            Write-Host "✅ Database migrations completed" -ForegroundColor Green
        } catch {
            Write-Host "❌ Migration failed" -ForegroundColor Red
            throw "Migration failed"
        }
    } else {
        Write-Host "⚠️  Migration script not found, skipping" -ForegroundColor Yellow
    }
}

# Function to create storage buckets
function Initialize-Storage {
    Write-Host "🪣 Setting up storage buckets..." -ForegroundColor Yellow
    
    if (Test-Path "./create-storage-buckets.js") {
        try {
            & node ./create-storage-buckets.js
            Write-Host "✅ Storage setup completed" -ForegroundColor Green
        } catch {
            Write-Host "❌ Storage setup failed" -ForegroundColor Red
            throw "Storage setup failed"
        }
    } else {
        Write-Host "⚠️  Storage setup script not found, skipping" -ForegroundColor Yellow
    }
}

# Function to build the application
function Build-Application {
    Write-Host "🔨 Building application..." -ForegroundColor Yellow
    
    # Install dependencies
    if (Test-Path "package-lock.json") {
        & npm ci
    } elseif (Test-Path "pnpm-lock.yaml") {
        & pnpm install --frozen-lockfile
    } elseif (Test-Path "yarn.lock") {
        & yarn install --frozen-lockfile
    } else {
        & npm install
    }
    
    # Build the application
    try {
        & npm run build
        Write-Host "✅ Application built successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Build failed" -ForegroundColor Red
        throw "Build failed"
    }
}

# Function to run health checks
function Test-Health {
    Write-Host "🏥 Running health checks..." -ForegroundColor Yellow
    
    # Start the application in background
    $job = Start-Job -ScriptBlock { 
        Set-Location $using:PWD
        & npm start 
    }
    
    Start-Sleep -Seconds 10
    
    # Check if the job is still running
    if ($job.State -eq "Running") {
        Write-Host "✅ Application started successfully" -ForegroundColor Green
        Stop-Job $job
        Remove-Job $job
    } else {
        Write-Host "❌ Application failed to start" -ForegroundColor Red
        Remove-Job $job
        throw "Health check failed"
    }
}

# Function to setup monitoring
function Initialize-Monitoring {
    Write-Host "📊 Setting up monitoring..." -ForegroundColor Yellow
    
    if ($env:MONITORING_ENABLED -eq "true") {
        Write-Host "✅ Monitoring enabled in configuration" -ForegroundColor Green
        # Add any monitoring setup commands here
    } else {
        Write-Host "⚠️  Monitoring disabled in configuration" -ForegroundColor Yellow
    }
}

# Function to load environment variables
function Import-Environment {
    param([string]$EnvFile)
    
    if (Test-Path $EnvFile) {
        Write-Host "📁 Loading environment from $EnvFile" -ForegroundColor Cyan
        
        Get-Content $EnvFile | ForEach-Object {
            if ($_ -match '^([^#][^=]+)=(.*)$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim()
                [Environment]::SetEnvironmentVariable($name, $value, "Process")
            }
        }
    } else {
        Write-Host "⚠️  Environment file $EnvFile not found" -ForegroundColor Yellow
    }
}

# Main deployment function
function Invoke-Deployment {
    Write-Host "🎯 Starting deployment for environment: $Environment" -ForegroundColor Cyan
    
    # Load environment variables
    $envFile = ".env.$Environment"
    if (-not (Test-Path $envFile) -and $Environment -eq "development") {
        $envFile = ".env.local"
    }
    
    Import-Environment $envFile
    
    # Run deployment steps
    try {
        Backup-Database
        Test-Environment
        Invoke-Migrations
        Initialize-Storage
        Build-Application
        Initialize-Monitoring
        
        if ($Environment -ne "production") {
            Test-Health
        }
        
        Write-Host "🎉 Deployment completed successfully!" -ForegroundColor Green
        Write-Host "📋 Deployment summary:" -ForegroundColor Cyan
        Write-Host "   - Environment: $Environment" -ForegroundColor White
        Write-Host "   - Backup location: $BackupDir" -ForegroundColor White
        Write-Host "   - Print Service URL: $($env:PRINT_SERVICE_URL)" -ForegroundColor White
        Write-Host "   - Storage Bucket: $($env:DIRECT_PRINT_STORAGE_BUCKET)" -ForegroundColor White
        Write-Host "   - Monitoring: $(if ($env:MONITORING_ENABLED -eq 'true') { 'Enabled' } else { 'Disabled' })" -ForegroundColor White
        
    } catch {
        Write-Host "❌ Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# Handle script commands
switch ($Command) {
    { $_ -in @("production", "staging", "development") } {
        Invoke-Deployment
    }
    "validate" {
        Test-Environment
    }
    "migrate" {
        Invoke-Migrations
    }
    "build" {
        Build-Application
    }
    "health" {
        Test-Health
    }
    default {
        Write-Host "Usage: .\deploy-direct-print.ps1 {production|staging|development|validate|migrate|build|health}" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Commands:" -ForegroundColor Cyan
        Write-Host "  production   - Deploy to production environment" -ForegroundColor White
        Write-Host "  staging      - Deploy to staging environment" -ForegroundColor White
        Write-Host "  development  - Deploy to development environment" -ForegroundColor White
        Write-Host "  validate     - Validate environment configuration only" -ForegroundColor White
        Write-Host "  migrate      - Run database migrations only" -ForegroundColor White
        Write-Host "  build        - Build application only" -ForegroundColor White
        Write-Host "  health       - Run health checks only" -ForegroundColor White
        exit 1
    }
}