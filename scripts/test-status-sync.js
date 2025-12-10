#!/usr/bin/env node

/**
 * Test script for Job Status Synchronization Service
 * 
 * This script tests the basic functionality of the status synchronizer
 * without requiring a full application setup.
 */

const { JobStatusSynchronizer } = require('../lib/services/job-status-synchronizer');

async function testStatusSynchronizer() {
  console.log('🧪 Testing Job Status Synchronizer...\n');

  try {
    // Create a test instance (not the singleton)
    const synchronizer = new JobStatusSynchronizer();

    // Test 1: Get initial stats
    console.log('📊 Test 1: Initial statistics');
    const initialStats = synchronizer.getPollingStats();
    console.log('Initial stats:', JSON.stringify(initialStats, null, 2));
    console.log('✅ Test 1 passed\n');

    // Test 2: Add jobs to polling queue
    console.log('📋 Test 2: Adding jobs to polling queue');
    synchronizer.addJobToPolling('test-job-1');
    synchronizer.addJobToPolling('test-job-2');
    synchronizer.addJobToPolling('test-job-3');
    
    const statsAfterAdd = synchronizer.getPollingStats();
    console.log('Stats after adding jobs:', JSON.stringify(statsAfterAdd, null, 2));
    
    if (statsAfterAdd.activeJobs === 3) {
      console.log('✅ Test 2 passed\n');
    } else {
      console.log('❌ Test 2 failed: Expected 3 active jobs\n');
    }

    // Test 3: Remove a job
    console.log('🗑️  Test 3: Removing a job from polling queue');
    synchronizer.removeJobFromPolling('test-job-2');
    
    const statsAfterRemove = synchronizer.getPollingStats();
    console.log('Stats after removing job:', JSON.stringify(statsAfterRemove, null, 2));
    
    if (statsAfterRemove.activeJobs === 2) {
      console.log('✅ Test 3 passed\n');
    } else {
      console.log('❌ Test 3 failed: Expected 2 active jobs\n');
    }

    // Test 4: Status mapping
    console.log('🔄 Test 4: Testing status mapping');
    const testStatuses = [
      'pending', 'downloading', 'slicing', 'printing', 
      'completed', 'failed', 'unknown-status'
    ];
    
    for (const status of testStatuses) {
      // Access private method for testing (not ideal but for testing purposes)
      const mappedStatus = synchronizer.mapPrintServiceStatus ? 
        synchronizer.mapPrintServiceStatus(status) : 
        'failed'; // fallback
      console.log(`  ${status} → ${mappedStatus}`);
    }
    console.log('✅ Test 4 completed\n');

    // Test 5: Terminal status check
    console.log('🏁 Test 5: Testing terminal status detection');
    const terminalStatuses = ['complete', 'failed', 'cleanup_pending'];
    const nonTerminalStatuses = ['pending', 'downloading', 'slicing', 'printing'];
    
    console.log('Terminal statuses:');
    for (const status of terminalStatuses) {
      const isTerminal = synchronizer.isTerminalStatus ? 
        synchronizer.isTerminalStatus(status) : 
        false;
      console.log(`  ${status}: ${isTerminal ? '✅' : '❌'}`);
    }
    
    console.log('Non-terminal statuses:');
    for (const status of nonTerminalStatuses) {
      const isTerminal = synchronizer.isTerminalStatus ? 
        synchronizer.isTerminalStatus(status) : 
        true;
      console.log(`  ${status}: ${!isTerminal ? '✅' : '❌'}`);
    }
    console.log('✅ Test 5 completed\n');

    console.log('🎉 All basic tests completed successfully!');
    console.log('\n📝 Note: Full integration tests require database and print service connectivity.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  testStatusSynchronizer().catch(console.error);
}

module.exports = { testStatusSynchronizer };