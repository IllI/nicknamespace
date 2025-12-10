# Supabase Setup Instructions

## Quick Setup Commands

Run these commands in order to set up your Supabase project for the 3D conversion service:

### 1. Copy Environment File
```bash
cp .env.local.example .env.local
```

### 2. Link to Supabase Project
```bash
npm run supabase:link
```
When prompted, use:
- Project ID: `syrhaykzsknfitgithmn`
- Database password: `969W19st`

### 3. Push Migration to Production
```bash
npm run supabase:push
```
This will create the tables and storage buckets in your production database.

### 4. Generate TypeScript Types
```bash
npm run supabase:generate-types
```
This will update the `types_db.ts` file with the new table definitions.

### 5. Verify Setup
Check that the following were created in your Supabase dashboard:
- **Storage Buckets**: `conversion-images`, `3d-models-raw`, `3d-models-print-ready`
- **Tables**: `conversion_records`, `user_usage`
- **Functions**: `increment_user_conversion`, `reset_daily_conversions`

## Environment Variables Still Needed

Add these to your `.env.local` file:
```bash
# Get from Hugging Face (https://huggingface.co/settings/tokens)
HUGGINGFACE_API_TOKEN=your_hf_token_here

# Get from Stripe dashboard (if using Stripe)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Troubleshooting

### If linking fails:
1. Make sure you have the Supabase CLI installed: `npm install -g supabase`
2. Login to Supabase: `supabase login`
3. Try linking again with the full command: `supabase link --project-ref syrhaykzsknfitgithmn`

### If migration fails:
1. Check your database connection in the Supabase dashboard
2. Verify the project ID is correct
3. Make sure you have the right permissions

### If types generation fails:
1. Ensure the migration was applied successfully
2. Check that you're connected to the right project
3. Try running: `supabase gen types typescript --linked > types_db.ts`