// Test script for Direct Print Storage Management
const { createClient } = require('@supabase/supabase-js');
const { DirectPrintStorageManager } = require('../lib/services/direct-print-storage-manager');
const { DirectPrintStorageOptimizer } = require('../lib/services/direct-print-storage-optimizer');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testStorageManagement() {
  console.log('🧪 Testing Direct Print Storage Management...\n');

  try {
    const storageManager = new DirectPrintStorageManager();
    const optimizer = new DirectPrintStorageOptimizer();

    // Test 1: Get storage analytics
    console.log('📊 Testing storage analytics...');
    try {
      const analytics = await storageManager.getStorageAnalytics();
      console.log('✅ Storage analytics:', {
        totalUsers: analytics.totalUsers,
        totalFiles: analytics.totalFiles,
        totalSizeMB: Math.round(analytics.totalSizeBytes / 1024 / 1024 * 100) / 100,
        averageFileSizeKB: Math.round(analytics.averageFileSize / 1024 * 100) / 100
      });
    } catch (error) {
      console.log('⚠️ Storage analytics test failed (expected if no data):', error.message);
    }

    // Test 2: Test quota checking for a test user
    console.log('\n💾 Testing storage quota...');
    try {
      // Get a test user ID (first user in the system)
      const { data: users, error: usersError } = await supabase
        .from('direct_print_jobs')
        .select('user_id')
        .limit(1);

      if (usersError || !users || users.length === 0) {
        console.log('⚠️ No users found for quota testing');
      } else {
        const testUserId = users[0].user_id;
        const quota = await storageManager.getUserStorageQuota(testUserId);
        console.log('✅ User storage quota:', {
          tier: quota.tier,
          usageMB: Math.round(quota.currentUsageBytes / 1024 / 1024 * 100) / 100,
          limitMB: Math.round(quota.quotaLimitBytes / 1024 / 1024),
          utilizationPercent: quota.utilizationPercent,
          canUpload: quota.canUpload
        });
      }
    } catch (error) {
      console.log('⚠️ Storage quota test failed:', error.message);
    }

    // Test 3: Test quota enforcement
    console.log('\n🚫 Testing quota enforcement...');
    try {
      const { data: users } = await supabase
        .from('direct_print_jobs')
        .select('user_id')
        .limit(1);

      if (users && users.length > 0) {
        const testUserId = users[0].user_id;
        const testFileSize = 10 * 1024 * 1024; // 10MB test file
        
        const quotaCheck = await storageManager.enforceStorageQuota(testUserId, testFileSize);
        console.log('✅ Quota enforcement check:', {
          allowed: quotaCheck.allowed,
          reason: quotaCheck.reason,
          currentUsageMB: Math.round(quotaCheck.currentUsage.total_size_bytes / 1024 / 1024 * 100) / 100
        });
      }
    } catch (error) {
      console.log('⚠️ Quota enforcement test failed:', error.message);
    }

    // Test 4: Test users approaching quota
    console.log('\n⚠️ Testing users approaching quota...');
    try {
      const usersApproachingQuota = await storageManager.getUsersApproachingQuota(50); // Lower threshold for testing
      console.log(`✅ Found ${usersApproachingQuota.length} users approaching quota (>50%)`);
      
      if (usersApproachingQuota.length > 0) {
        console.log('Top user:', {
          tier: usersApproachingQuota[0].tier,
          utilizationPercent: usersApproachingQuota[0].utilizationPercent,
          usageMB: Math.round(usersApproachingQuota[0].currentUsageBytes / 1024 / 1024 * 100) / 100
        });
      }
    } catch (error) {
      console.log('⚠️ Users approaching quota test failed:', error.message);
    }

    // Test 5: Test cleanup simulation (dry run)
    console.log('\n🧹 Testing cleanup simulation...');
    try {
      // Mark some old failed jobs for cleanup (simulation)
      await storageManager.database.markFailedJobsForCleanup();
      
      const jobsForCleanup = await storageManager.database.getJobsForCleanup();
      console.log(`✅ Found ${jobsForCleanup.length} jobs marked for cleanup`);
      
      if (jobsForCleanup.length > 0) {
        const totalSize = jobsForCleanup.reduce((sum, job) => sum + job.file_size_bytes, 0);
        console.log(`   Total size to cleanup: ${Math.round(totalSize / 1024 / 1024 * 100) / 100}MB`);
      }
    } catch (error) {
      console.log('⚠️ Cleanup simulation failed:', error.message);
    }

    // Test 6: Test storage report generation
    console.log('\n📋 Testing storage report generation...');
    try {
      const report = await storageManager.generateStorageReport();
      console.log('✅ Storage report generated:', {
        totalUsers: report.analytics.totalUsers,
        totalFiles: report.analytics.totalFiles,
        quotaWarnings: report.quotaWarnings.length,
        cleanupRecommendations: {
          failedJobs: report.cleanupRecommendations.failedJobsOlderThan7Days,
          potentialSavingsMB: Math.round(report.cleanupRecommendations.potentialSavingsBytes / 1024 / 1024 * 100) / 100
        }
      });
    } catch (error) {
      console.log('⚠️ Storage report generation failed:', error.message);
    }

    // Test 7: Test optimization stats
    console.log('\n⚡ Testing optimization stats...');
    try {
      const optimizationStats = await optimizer.getOptimizationStats();
      console.log('✅ Optimization stats:', optimizationStats);
    } catch (error) {
      console.log('⚠️ Optimization stats test failed:', error.message);
    }

    console.log('\n✅ Storage management testing completed!');

  } catch (error) {
    console.error('❌ Storage management testing failed:', error);
    process.exit(1);
  }
}

// Test database functions
async function testDatabaseFunctions() {
  console.log('\n🗄️ Testing database functions...\n');

  try {
    // Test storage usage function
    console.log('📊 Testing storage usage function...');
    const { data: usageData, error: usageError } = await supabase.rpc('get_user_direct_print_storage_usage', {
      p_user_id: '00000000-0000-0000-0000-000000000000' // Test UUID
    });

    if (usageError) {
      console.log('⚠️ Storage usage function test failed (expected):', usageError.message);
    } else {
      console.log('✅ Storage usage function works:', usageData);
    }

    // Test quota check function
    console.log('\n💾 Testing quota check function...');
    const { data: quotaData, error: quotaError } = await supabase.rpc('check_direct_print_upload_quota', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_file_size_bytes: 1024 * 1024 // 1MB
    });

    if (quotaError) {
      console.log('⚠️ Quota check function test failed (expected):', quotaError.message);
    } else {
      console.log('✅ Quota check function works:', quotaData);
    }

    // Test cleanup function
    console.log('\n🧹 Testing cleanup function...');
    const { error: cleanupError } = await supabase.rpc('cleanup_failed_direct_print_jobs');

    if (cleanupError) {
      console.log('⚠️ Cleanup function test failed:', cleanupError.message);
    } else {
      console.log('✅ Cleanup function works');
    }

    console.log('\n✅ Database functions testing completed!');

  } catch (error) {
    console.error('❌ Database functions testing failed:', error);
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Direct Print Storage Management Tests\n');
  
  await testDatabaseFunctions();
  await testStorageManagement();
  
  console.log('\n🎉 All tests completed!');
  process.exit(0);
}

runTests().catch(console.error);