# 3D Conversion Service Setup

This document outlines the setup completed for the 3D conversion service that allows users to convert 2D images to 3D models using TripoSR AI.

## Dependencies Installed

### Three.js and React Three Fiber
- `three@^0.168.0` - Core 3D library
- `@react-three/fiber@^8.18.0` - React renderer for Three.js (compatible with React 18)
- `@react-three/drei@^9.122.0` - Useful helpers and components
- `@types/three@^0.181.0` - TypeScript definitions

## Environment Configuration

### Added to `.env.local.example`:
```bash
# Hugging Face API Configuration for TripoSR
HUGGINGFACE_API_TOKEN=
TRIPOSR_API_ENDPOINT="https://api-inference.huggingface.co/models/stabilityai/TripoSR"

# 3D Conversion Service Configuration
CONVERSION_MAX_FILE_SIZE_MB=10
CONVERSION_TIMEOUT_MINUTES=5
CONVERSION_DAILY_LIMIT_FREE=5
CONVERSION_DAILY_LIMIT_PREMIUM=50
```

## Database Schema

### Migration Created: `20241103061500_3d_conversion_setup.sql`

**Storage Buckets:**
- `conversion-images` - Original uploaded images (10MB limit)
- `3d-models-raw` - Raw 3D models from TripoSR (50MB limit)
- `3d-models-print-ready` - Print-ready STL files (50MB limit)

**Tables:**
- `conversion_records` - Tracks conversion jobs and metadata
- `user_usage` - Tracks user limits and API costs

**Functions:**
- `increment_user_conversion()` - Updates user conversion counts
- `reset_daily_conversions()` - Resets daily limits (for cron jobs)

## Code Structure

### Configuration
- `lib/config/3d-conversion.ts` - Centralized configuration and validation
- `lib/types/3d-conversion.ts` - TypeScript type definitions

### Services
- `lib/services/conversion-database.ts` - Database operations for conversion records
- `lib/utils/supabase-storage.ts` - File storage operations

## Key Features Configured

### File Upload Limits
- Maximum file size: 10MB
- Supported formats: PNG, JPG, JPEG
- Automatic validation and error handling

### User Limits
- Free tier: 5 conversions per day
- Premium tier: 50 conversions per day
- Enterprise tier: 1000 conversions per day

### 3D Printing Support
- Bambu Labs P1P specifications built-in
- Build volume: 256×256×256mm
- STL format conversion for print-ready files
- Mesh validation and repair capabilities

### Storage Security
- Row-level security policies
- User-specific file access
- Automatic cleanup policies

## Supabase Configuration

### Project Details
- **Project ID**: `syrhaykzsknfitgithmn`
- **Project URL**: `https://syrhaykzsknfitgithmn.supabase.co`
- **Database Password**: `969W19st`

### Environment Setup
The environment files have been configured with your Supabase credentials:
- Production config in `.env.local.example` (and `.env.production.example`)
- Local development config commented out for easy switching

## Next Steps

1. **Link Project**: Run `npm run supabase:link` to connect to your Supabase project
2. **Run Migration**: Execute `npm run supabase:push` to apply the migration to production
3. **Regenerate Types**: Run `npm run supabase:generate-types` after migration
4. **Environment Setup**: Copy `.env.local.example` to `.env.local` and add remaining API keys
5. **Test Storage**: Verify storage buckets are created and accessible

## API Integration Ready

The service is configured to integrate with:
- **Hugging Face TripoSR API** for 2D to 3D conversion
- **Supabase Storage** for file hosting
- **Supabase Database** for metadata and user tracking

## Cost Tracking

- API costs tracked per conversion (~$0.02 per TripoSR request)
- Storage costs monitored ($0.021/GB/month for Supabase)
- User usage analytics for billing and limits

## Security Features

- File type validation
- Size limit enforcement
- User authentication required
- Rate limiting built-in
- Secure file serving with signed URLs