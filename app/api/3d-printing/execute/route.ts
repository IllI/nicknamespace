/**
 * Execute Print Job API
 * Actually communicates with the printer using the IP from the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { executePrintJob } from '@/lib/services/print-job-executor';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { job_id } = body;

    if (!job_id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required field: job_id',
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    console.log(`Executing print job: ${job_id}`);

    // Verify job exists and get printer info
    const { data: job, error: jobError } = await supabase
      .from('direct_print_jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Job not found',
          timestamp: new Date().toISOString()
        },
        { status: 404 }
      );
    }

    // Check if job is in correct status
    if (job.status !== 'pending') {
      return NextResponse.json(
        { 
          success: false,
          error: `Job is not in pending status. Current status: ${job.status}`,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    // Execute the print job (this will communicate with the actual printer)
    const success = await executePrintJob(job_id);

    if (success) {
      return NextResponse.json({
        success: true,
        job_id,
        message: 'Print job execution started successfully',
        printer_ip: job.printer_ip,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json(
        { 
          success: false,
          job_id,
          error: 'Failed to execute print job',
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Print job execution error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Get execution status for a job
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const job_id = searchParams.get('job_id');

    if (!job_id) {
      return NextResponse.json(
        { error: 'Missing job_id parameter' },
        { status: 400 }
      );
    }

    const { data: job, error } = await supabase
      .from('direct_print_jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (error || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job_id,
      status: job.status,
      printer_ip: job.printer_ip,
      printer_serial: job.printer_serial,
      created_at: job.created_at,
      updated_at: job.updated_at,
      error_message: job.error_message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}