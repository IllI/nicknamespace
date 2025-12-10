// Cron job endpoint for automatic job status synchronization
import { NextRequest, NextResponse } from 'next/server';
import { jobStatusSynchronizer } from '@/lib/services/job-status-synchronizer';

/**
 * POST /api/cron/sync-job-status - Cron job endpoint for status synchronization
 * 
 * This endpoint should be called by a cron service (like Vercel Cron, GitHub Actions, etc.)
 * to periodically sync job statuses from the print service.
 * 
 * Security: Uses a cron secret to prevent unauthorized access
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      console.warn('⚠️  CRON_SECRET not configured, skipping cron job');
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      );
    }

    if (cronSecret !== expectedSecret) {
      console.warn('⚠️  Invalid cron secret received');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🕐 Cron job: Starting job status synchronization...');
    const startTime = Date.now();

    // Ensure synchronizer is running
    await jobStatusSynchronizer.start();

    // Perform synchronization of all active jobs
    await jobStatusSynchronizer.syncAllActiveJobs();

    const duration = Date.now() - startTime;
    const stats = jobStatusSynchronizer.getPollingStats();

    console.log(`✅ Cron job completed in ${duration}ms. Active jobs: ${stats.activeJobs}`);

    return NextResponse.json({
      success: true,
      message: 'Job status synchronization completed',
      stats: {
        duration_ms: duration,
        active_jobs: stats.activeJobs,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Cron job error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Cron job failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Health check for cron endpoint
 */
export async function GET() {
  const stats = jobStatusSynchronizer.getPollingStats();
  
  return NextResponse.json({
    message: 'Job status synchronization cron endpoint',
    method: 'POST',
    headers_required: ['x-cron-secret'],
    synchronizer_status: {
      is_running: stats.isRunning,
      active_jobs: stats.activeJobs,
      poll_interval_ms: stats.pollInterval
    },
    timestamp: new Date().toISOString()
  });
}