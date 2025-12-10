// Script to update storage bucket permissions to be more permissive for testing
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function updateBucketPermissions() {
  console.log('🔧 Updating storage bucket permissions for testing...\n');

  const buckets = ['conversion-images', '3d-models-raw', '3d-models-print-ready'];

  for (const bucketId of buckets) {
    try {
      console.log(`⏳ Updating bucket: ${bucketId}...`);
      
      // Update bucket to allow more MIME types for testing
      const { data, error } = await supabase.storage.updateBucket(bucketId, {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024, // 50MB
        allowedMimeTypes: [
          'image/jpeg',
          'image/jpg', 
          'image/png',
          'application/octet-stream',
          'model/ply',
          'model/obj',
          'model/stl',
          'text/plain' // Allow for testing
        ]
      });

      if (error) {
        console.log(`   ⚠️  Error updating ${bucketId}: ${error.message}`);
      } else {
        console.log(`   ✅ Updated bucket: ${bucketId}`);
      }
    } catch (bucketError) {
      console.log(`   ❌ Exception updating ${bucketId}: ${bucketError.message}`);
    }
  }

  console.log('\n🎉 Bucket permissions updated!');
  console.log('📋 Buckets now allow more MIME types for testing');
}

// Run the script
updateBucketPermissions();