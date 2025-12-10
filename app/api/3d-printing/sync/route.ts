// API endpoint for managing job status synchronization
import { NextRequest, NextResponse } from 'next/server';
import { jobStatusSynchronizer } from '@/lib/services/job-status-synchronizer';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for auth
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/3d-printing/sync - Get synchronization status and statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Get auth token from request
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    // Get synchronization statistics
    const stats = jobStatusSynchronizer.getPollingStats();

    return NextResponse.json({
      success: true,
      data: {
        synchronizer: stats,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error getting sync status:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get synchronization status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/3d-printing/sync - Trigger manual synchronization actions
 */
export async function POST(request: NextRequest) {
  try {
    // Get auth token from request
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { action, jobId } = body;

    switch (action) {
      case 'start':
        await jobStatusSynchronizer.start();
        return NextResponse.json({
          success: true,
          message: 'Job status synchronizer started',
          timestamp: new Date().toISOString()
        });

      case 'stop':
        jobStatusSynchronizer.stop();
        return NextResponse.json({
          success: true,
          message: 'Job status synchronizer stopped',
          timestamp: new Date().toISOString()
        });

      case 'sync_all':
        await jobStatusSynchronizer.syncAllActiveJobs();
        return NextResponse.json({
          success: true,
          message: 'Manual sync of all active jobs completed',
          timestamp: new Date().toISOString()
        });

      case 'sync_job':
        if (!jobId) {
          return NextResponse.json(
            { error: 'jobId is required for sync_job action' },
            { status: 400 }
          );
        }
        await jobStatusSynchronizer.forceSyncJob(jobId);
        return NextResponse.json({
          success: true,
          message: `Job ${jobId} synchronized`,
          timestamp: new Date().toISOString()
        });

      case 'add_job':
        if (!jobId) {
          return NextResponse.json(
            { error: 'jobId is required for add_job action' },
            { status: 400 }
          );
        }
        jobStatusSynchronizer.addJobToPolling(jobId);
        return NextResponse.json({
          success: true,
          message: `Job ${jobId} added to polling queue`,
          timestamp: new Date().toISOString()
        });

      case 'remove_job':
        if (!jobId) {
          return NextResponse.json(
            { error: 'jobId is required for remove_job action' },
            { status: 400 }
          );
        }
        jobStatusSynchronizer.removeJobFromPolling(jobId);
        return NextResponse.json({
          success: true,
          message: `Job ${jobId} removed from polling queue`,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: start, stop, sync_all, sync_job, add_job, remove_job' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('❌ Error processing sync action:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to process synchronization action',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS - Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}