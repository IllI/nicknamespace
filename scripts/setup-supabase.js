const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function verifyAndSetup() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || url.includes('syrhaykzsknfitgithmn')) {
        console.error('❌ ERROR: You are still using the placeholder URL in .env.local');
        console.error('URL found:', url);
        process.exit(1);
    }

    console.log('🔗 Connecting to:', url);
    const supabase = createClient(url, key);

    // 1. Check Connection
    const { data: tableData, error: tableError } = await supabase
        .from('innovative_products')
        .select('count', { count: 'exact', head: true });

    if (tableError) {
        console.error('❌ Table Error:', tableError.message);
        console.log('Suggestion: Make sure you ran the SQL migration in the Supabase SQL Editor.');
    } else {
        console.log('✅ Table "innovative_products" is ready.');
    }

    // 2. Create Bucket
    console.log('📦 Setting up "product-media" bucket...');
    const { data: bucket, error: bucketError } = await supabase.storage.createBucket('product-media', {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'video/mp4', 'model/gltf-binary'],
        fileSizeLimit: 52428800 // 50MB
    });

    if (bucketError) {
        if (bucketError.message.includes('already exists')) {
            console.log('✅ Bucket "product-media" already exists.');
        } else {
            console.error('❌ Bucket Error:', bucketError.message);
        }
    } else {
        console.log('✅ Bucket "product-media" created successfully.');
    }

    process.exit(0);
}

verifyAndSetup();
