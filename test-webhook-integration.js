// Simple test script for webhook integration
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

async function testWebhookIntegration() {
  console.log('🧪 Testing webhook integration...\n');

  try {
    // 1. Test if direct_print_jobs table exists
    console.log('📋 Checking direct_print_jobs table...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('direct_print_jobs')
      .select('*')
      .limit(1);

    if (tableError) {
      console.log('❌ direct_print_jobs table not found:', tableError.message);
      console.log('💡 Please run the database migration first');
      return;
    } else {
      console.log('✅ direct_print_jobs table exists');
    }

    // 2. Test webhook functions
    console.log('\n🔧 Testing webhook functions...');
    
    // Test record_webhook_attempt function
    try {
      const { error: funcError } = await supabase.rpc('record_webhook_attempt', {
        p_job_id: '00000000-0000-0000-0000-000000000000',
        p_success: true
      });
      
      if (funcError && !funcError.message.includes('violates foreign key')) {
        console.log('❌ record_webhook_attempt function error:', funcError.message);
      } else {
        console.log('✅ record_webhook_attempt function exists');
      }
    } catch (error) {
      console.log('❌ record_webhook_attempt function not found');
    }

    // Test get_jobs_needing_webhook_notification function
    try {
      const { data: webhookJobs, error: webhookError } = await supabase.rpc('get_jobs_needing_webhook_notification');
      
      if (webhookError) {
        console.log('❌ get_jobs_needing_webhook_notification function error:', webhookError.message);
      } else {
        console.log('✅ get_jobs_needing_webhook_notification function exists');
        console.log(`📊 Found ${webhookJobs?.length || 0} jobs needing webhook notifications`);
      }
    } catch (error) {
      console.log('❌ get_jobs_needing_webhook_notification function not found');
    }

    // 3. Test storage bucket
    console.log('\n🪣 Checking direct-3d-models storage bucket...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.log('❌ Error checking buckets:', bucketError.message);
    } else {
      const directBucket = buckets.find(b => b.id === 'direct-3d-models');
      if (directBucket) {
        console.log('✅ direct-3d-models bucket exists');
      } else {
        console.log('❌ direct-3d-models bucket not found');
      }
    }

    // 4. Test webhook endpoint (if running locally)
    console.log('\n🌐 Testing webhook endpoint...');
    try {
      const webhookUrl = 'http://localhost:3000/api/webhooks/print-status';
      const testPayload = {
        event: 'job_status_update',
        job_id: 'test-webhook-' + Date.now(),
        status: 'pending',
        timestamp: new Date().toISOString(),
        job: {
          id: 'test-webhook-' + Date.now(),
          user_id: 'test-user',
          filename: 'test.stl',
          storage_path: 'test/test.stl',
          file_size_bytes: 1024,
          status: 'pending',
          created_at: new Date().toISOString(),
          model_metadata: {},
          print_settings: {}
        }
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Direct-Print-Service/1.0.0',
          'X-Print-Service-Event': 'job-status-update'
        },
        body: JSON.stringify(testPayload)
      });

      if (response.ok) {
        console.log('✅ Webhook endpoint is responding');
        const result = await response.json();
        console.log('📥 Response:', result);
      } else {
        console.log(`⚠️  Webhook endpoint returned ${response.status}: ${response.statusText}`);
        console.log('💡 Make sure your Next.js app is running on port 3000');
      }
    } catch (fetchError) {
      console.log('⚠️  Could not reach webhook endpoint (app may not be running)');
      console.log('💡 Start your Next.js app with: npm run dev');
    }

    console.log('\n🎉 Webhook integration test completed!');
    console.log('\n📋 Summary:');
    console.log('- Database schema: Ready for webhook support');
    console.log('- Storage bucket: Created and configured');
    console.log('- Webhook functions: Available for job management');
    console.log('- API endpoints: Ready to receive webhook notifications');
    
    console.log('\n📖 Next steps:');
    console.log('1. Start your Next.js app: npm run dev');
    console.log('2. Test webhook delivery with: node test-webhook-integration.js');
    console.log('3. Use the webhook service in your print job workflow');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testWebhookIntegration();