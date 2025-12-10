# Direct 3D Model Printing Service Setup

This document provides step-by-step instructions to set up the database schema and storage infrastructure for the Direct 3D Model Printing Service.

## Overview

The setup includes:
- ✅ **Storage Bucket**: `direct-3d-models` (already created)
- ⚠️ **Database Table**: `direct_print_jobs` with webhook support (needs manual setup)
- ⚠️ **Database Functions**: Job management and webhook functions (needs manual setup)
- ⚠️ **RLS Policies**: Row Level Security policies (needs manual setup)
- ✅ **Webhook Endpoints**: Real-time status notification system (ready to use)

## Automatic Setup (Completed)

The storage bucket has been automatically created:

```bash
# Storage bucket created successfully
✅ direct-3d-models bucket (50MB limit, STL/OBJ/PLY files)
```

## Manual Setup Required

### Step 1: Database Schema Setup

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/[your-project-id]/sql
   - Open the SQL Editor

2. **Execute the Migration SQL**
   - Copy the entire contents of `supabase/migrations/20241103120000_direct_print_jobs_setup.sql`
   - Paste into the SQL Editor
   - Click "Run" to execute

### Step 2: Verify Setup

After running the migration, verify the setup:

```sql
-- Check if table was created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'direct_print_jobs';

-- Check if functions were created
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%direct_print%';

-- Check storage bucket
SELECT * FROM storage.buckets WHERE id = 'direct-3d-models';
```

### Step 3: Test the Setup

Run the verification script:

```bash
node apply-direct-print-migration.js
```

Expected output:
```
✅ direct_print_jobs table created successfully
✅ direct-3d-models bucket exists
```

## Database Schema Details

### Tables Created

#### `direct_print_jobs`
- **Purpose**: Track direct 3D model uploads and print jobs
- **Key Fields**:
  - `id`: Unique job identifier
  - `user_id`: User who owns the job
  - `filename`: Original file name
  - `storage_path`: Path in Supabase storage
  - `status`: Job status (pending → printing → complete/failed)
  - `model_metadata`: 3D model information (dimensions, format, etc.)
  - `print_settings`: Print configuration (material, quality, etc.)
  - `webhook_url`: URL for real-time status notifications
  - `webhook_attempts`: Number of webhook delivery attempts
  - `last_webhook_attempt`: Timestamp of last webhook attempt

### Functions Created

#### `update_direct_print_job_status()`
- **Purpose**: Update job status with automatic timestamp tracking
- **Parameters**: job_id, status, error_message, print_service_response

#### `cleanup_failed_direct_print_jobs()`
- **Purpose**: Mark old failed jobs for cleanup (7+ days old)
- **Usage**: Called by cron job for maintenance

#### `get_user_direct_print_storage_usage()`
- **Purpose**: Get user's storage usage statistics
- **Returns**: File count, total size, job counts by status

#### `check_direct_print_upload_quota()`
- **Purpose**: Enforce storage quotas based on user tier
- **Returns**: Upload permission, current usage, quota limits

#### `record_webhook_attempt()`
- **Purpose**: Track webhook delivery attempts for retry logic
- **Parameters**: job_id, success status

#### `get_jobs_needing_webhook_notification()`
- **Purpose**: Get jobs that need webhook notifications (failed or pending)
- **Returns**: Jobs with webhook URLs that haven't been successfully notified

### Storage Policies

#### `direct-3d-models` Bucket Policies
- **Upload**: Users can only upload to their own folder (`{user_id}/`)
- **Read**: Users can only access their own files
- **Delete**: Users can only delete their own files

### Indexes Created

Performance indexes on:
- `user_id` - Fast user job queries
- `status` - Fast status filtering
- `created_at` - Chronological ordering
- `submitted_at` - Submission time queries

## File Organization

### Storage Structure
```
direct-3d-models/
├── {user_id}/
│   ├── {job_id}/
│   │   ├── original.stl     # User uploaded file
│   │   ├── processed.stl    # Print-ready file (if needed)
│   │   └── thumbnail.png    # Model preview (future)
```

### File Naming Convention
- **Original files**: Keep original filename for user reference
- **Job folders**: Use UUID job ID for organization
- **User isolation**: All files under user ID folder

## Storage Quotas

| Tier | Storage Limit | Description |
|------|---------------|-------------|
| Free | 1 GB | Basic usage |
| Premium | 5 GB | Enhanced storage |
| Enterprise | 20 GB | Professional use |

## Security Features

### Row Level Security (RLS)
- **Enabled**: All tables have RLS enabled
- **User Isolation**: Users can only access their own data
- **Admin Access**: Service role can access all data

### File Security
- **Private Buckets**: All files are private by default
- **Signed URLs**: Temporary access via signed URLs
- **User Folders**: Automatic user-specific folder structure

## Troubleshooting

### Common Issues

#### 1. Migration Fails
```sql
-- Check if tables exist
\dt direct_print_jobs
```

**Solution**: Run the SQL manually in Supabase dashboard

#### 2. Storage Bucket Missing
```bash
# Recreate bucket
node create-storage-buckets.js
```

#### 3. Permission Errors
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'direct_print_jobs';
```

**Solution**: Ensure RLS policies are created correctly

### Verification Commands

```bash
# Test storage bucket creation
node create-storage-buckets.js

# Test database migration
node apply-direct-print-migration.js

# Check existing setup
node apply-migration.js
```

## Next Steps

After completing the setup:

1. **Test File Upload**: Try uploading a 3D model file
2. **Verify Database**: Check job records are created
3. **Test Permissions**: Ensure users can only access their files
4. **Monitor Usage**: Check storage quota enforcement

## Webhook Integration

### Real-time Status Updates
The system includes comprehensive webhook support for real-time job status notifications:

#### Webhook Endpoints
- **Receive**: `/api/webhooks/print-status` - Receives status updates from print service
- **Test**: `/api/webhooks/test` - Tests webhook delivery

#### Webhook Features
- **Automatic Retry**: 3 attempts with exponential backoff
- **Signature Verification**: HMAC-SHA256 signature validation (optional)
- **Status Tracking**: Records delivery attempts and success/failure
- **Real-time Updates**: Integrates with Supabase Realtime for live UI updates

#### Webhook Payload Example
```json
{
  "event": "job_status_update",
  "job_id": "uuid-here",
  "status": "printing",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "job": { /* complete job object */ }
}
```

### Environment Variables
Add to your `.env.local`:
```bash
# Optional: Webhook signature verification
WEBHOOK_SECRET=your-webhook-secret-key

# Optional: Webhook configuration
WEBHOOK_TIMEOUT=10000
WEBHOOK_MAX_RETRIES=3
```

## Files Created

### Database Files
- `supabase/migrations/20241103120000_direct_print_jobs_setup.sql` - Main migration with webhook support
- `lib/types/direct-print-jobs.ts` - TypeScript types including webhook types
- `lib/services/direct-print-database.ts` - Database service with webhook methods

### Webhook Services
- `lib/services/webhook-service.ts` - Webhook delivery and retry logic
- `lib/utils/webhook-utils.ts` - Webhook utility functions
- `app/api/webhooks/print-status/route.ts` - Webhook receiver endpoint
- `app/api/webhooks/test/route.ts` - Webhook testing endpoint

### Examples & Documentation
- `lib/examples/webhook-integration-example.ts` - Complete usage examples
- `WEBHOOKS.md` - Detailed webhook integration guide

### Setup Scripts
- `apply-direct-print-migration.js` - Migration application
- `direct-print-setup.md` - This documentation
- Updated `create-storage-buckets.js` - Includes new bucket
- Updated `manual-db-setup.sql` - Includes new tables and webhook functions

## Support

If you encounter issues:
1. Check the Supabase dashboard for error messages
2. Verify environment variables in `.env.local`
3. Ensure service role key has proper permissions
4. Review the migration SQL for syntax errors