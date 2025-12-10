import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { StatusUpdate } from '@/lib/types/direct-print-jobs';

// Use service role key for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id;

    if (!jobId) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'MISSING_JOB_ID', 
            message: 'Job ID is required' 
          } 
        },
        { status: 400 }
      );
    }

    // Get job details using service role (bypasses RLS)
    const { data: job, error: jobError } = await supabaseAdmin
      .from('direct_print_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      console.error('Job lookup error:', jobError);
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'JOB_NOT_FOUND', 
            message: 'Print job not found' 
          } 
        },
        { status: 404 }
      );
    }

    // Create status history from job timestamps
    const statusHistory: StatusUpdate[] = [];
    
    if (job.created_at) {
      statusHistory.push({
        status: 'pending',
        timestamp: job.created_at,
        message: 'Job created and ready for submission'
      });
    }

    if (job.submitted_at) {
      statusHistory.push({
        status: 'downloading',
        timestamp: job.submitted_at,
        message: 'Job submitted to print service'
      });
    }

    if (job.status !== 'pending' && job.status !== 'downloading') {
      statusHistory.push({
        status: job.status,
        timestamp: job.completed_at || new Date().toISOString(),
        message: getStatusMessage(job.status, job.error_message)
      });
    }

    // Calculate estimated completion time
    let estimatedCompletion: string | undefined;
    if (job.status === 'printing' && job.estimated_duration_minutes) {
      const startTime = new Date(job.submitted_at || job.created_at);
      const estimatedEnd = new Date(startTime.getTime() + (job.estimated_duration_minutes * 60 * 1000));
      estimatedCompletion = estimatedEnd.toISOString();
    }

    return NextResponse.json({
      success: true,
      job,
      statusHistory,
      estimatedCompletion
    });

  } catch (error) {
    console.error('Status API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: error instanceof Error ? error.message : 'Internal server error'
        } 
      },
      { status: 500 }
    );
  }
}

/**
 * Get user-friendly status message
 */
function getStatusMessage(status: string, errorMessage?: string): string {
  switch (status) {
    case 'pending':
      return 'Waiting for submission';
    case 'downloading':
      return 'Print service is downloading the model';
    case 'slicing':
      return 'Model is being sliced for printing';
    case 'uploading':
      return 'Sliced file is being uploaded to printer';
    case 'printing':
      return 'Model is currently being printed';
    case 'complete':
      return 'Print job completed successfully';
    case 'failed':
      return errorMessage || 'Print job failed';
    case 'cleanup_pending':
      return 'Job completed, files scheduled for cleanup';
    default:
      return `Status: ${status}`;
  }
}