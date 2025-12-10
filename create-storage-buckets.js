// Script to create Supabase storage buckets for 3D conversion
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

async function createStorageBuckets() {
  console.log('🪣 Creating Supabase storage buckets...\n');

  const buckets = [
    {
      id: 'conversion-images',
      name: 'conversion-images',
      public: false,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png']
    },
    {
      id: '3d-models-raw',
      name: '3d-models-raw', 
      public: false,
      fileSizeLimit: 50 * 1024 * 1024, // 50MB
      allowedMimeTypes: ['application/octet-stream', 'model/ply', 'model/obj']
    },
    {
      id: '3d-models-print-ready',
      name: '3d-models-print-ready',
      public: false,
      fileSizeLimit: 50 * 1024 * 1024, // 50MB
      allowedMimeTypes: ['application/octet-stream', 'model/stl', 'model/obj']
    }
  ];

  for (const bucket of buckets) {
    try {
      console.log(`⏳ Creating bucket: ${bucket.id}...`);
      
      const { data, error } = await supabase.storage.createBucket(bucket.id, {
        public: bucket.public,
        fileSizeLimit: bucket.fileSizeLimit,
        allowedMimeTypes: bucket.allowedMimeTypes
      });

      if (error) {
        if (error.message.includes('already exists')) {
          console.log(`   ✅ Bucket ${bucket.id} already exists`);
        } else {
          console.log(`   ❌ Error creating ${bucket.id}: ${error.message}`);
        }
      } else {
        console.log(`   ✅ Created bucket: ${bucket.id}`);
      }
    } catch (bucketError) {
      console.log(`   ❌ Exception creating ${bucket.id}: ${bucketError.message}`);
    }
  }

  // List existing buckets to verify
  console.log('\n📋 Listing existing buckets...');
  try {
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.log('❌ Error listing buckets:', listError.message);
    } else {
      console.log('✅ Existing buckets:');
      existingBuckets.forEach(bucket => {
        console.log(`   - ${bucket.id} (${bucket.public ? 'public' : 'private'})`);
      });
    }
  } catch (listException) {
    console.log('❌ Exception listing buckets:', listException.message);
  }

  console.log('\n🎉 Storage bucket setup completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Try uploading an image again');
  console.log('2. The file should now be stored successfully');
  console.log('3. Check the Supabase dashboard storage section to verify');
}

// Run the script
createStorageBuckets();