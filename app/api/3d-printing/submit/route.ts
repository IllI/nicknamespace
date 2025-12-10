import { NextRequest, NextResponse } from 'next/server';
import { DirectPrintDatabase } from '@/lib/services/direct-print-database';
import { PrintServiceClient } from '@/lib/services/print-service-client';
import { jobStatusSynchronizer } from '@/lib/services/job-status-synchronizer';
import { PrintSettings } from '@/lib/types/direct-print-jobs';
import { createPrintServiceError, errorHandler } from '@/lib/services/error-handling-service';
import { errorMonitoring } from '@/lib/services/error-monitoring';

const database = new DirectPrintDatabase();
const printService = new PrintServiceClient();

export async function POST(request: NextRequest) {
  try {
    const { jobId, printSettings } = await request.json();

    // Validate required fields
    if (!jobId) {
      const error = errorHandler.createError('MISSING_JOB_ID', 'Job ID is required');
      await errorMonitoring.logError(error, { 
        operation: 'submit',
        timestamp: new Date().toISOString()
      }, request);
      return NextResponse.json({ success: false, error }, { status: 400 });
    }

    // Get job details from database
    const job = await database.getJob(jobId);
    if (!job) {
      const error = createPrintServiceError('JOB_NOT_FOUND', jobId);
      await errorMonitoring.logError(error, { 
        jobId,
        operation: 'submit',
        timestamp: new Date().toISOString()
      }, request);
      return NextResponse.json({ success: false, error }, { status: 404 });
    }

    // Check if job is in correct status for submission
    if (job.status !== 'pending') {
      const error = createPrintServiceError('INVALID_JOB_STATUS', jobId, 
        new Error(`Job cannot be submitted. Current status: ${job.status}`));
      await errorMonitoring.logError(error, { 
        jobId,
        userId: job.user_id,
        operation: 'submit',
        timestamp: new Date().toISOString()
      }, request);
      return NextResponse.json({ success: false, error }, { status: 400 });
    }

    // Merge print settings with defaults
    const finalPrintSettings: PrintSettings = {
      material: 'PLA',
      quality: 'standard',
      infill: 20,
      supports: false,
      layerHeight: 0.2,
      printSpeed: 50,
      bedTemperature: 60,
      nozzleTemperature: 210,
      ...printSettings
    };

    // Update job with print settings
    await database.updateJobStatus({
      jobId,
      status: 'downloading',
      printServiceResponse: null
    });

    // Update print settings in database
    const { error: updateError } = await database['supabase']
      .from('direct_print_jobs')
      .update({ 
        print_settings: finalPrintSettings,
        submitted_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('Failed to update print settings:', updateError);
    }

    try {
      // Submit job to print service
      const printServiceResponse = await printService.submitPrintJob({
        job_id: jobId,
        storage_path: job.storage_path,
        filename: job.filename,
        print_settings: {
          material: finalPrintSettings.material,
          quality: finalPrintSettings.quality,
          supports: finalPrintSettings.supports
        }
      });

      // Update job status based on print service response
      await database.updateJobStatus({
        jobId,
        status: 'slicing',
        printServiceResponse
      });

      // Add job to status synchronization polling queue
      jobStatusSynchronizer.addJobToPolling(jobId);

      return NextResponse.json({
        success: true,
        jobId,
        message: 'Print job submitted successfully',
        printServiceResponse
      });

    } catch (printServiceError) {
      // Update job status to failed
      await database.updateJobStatus({
        jobId,
        status: 'failed',
        errorMessage: printServiceError instanceof Error ? printServiceError.message : 'Print service error',
        printServiceResponse: null
      });

      const error = createPrintServiceError('PRINT_SERVICE_ERROR', jobId, printServiceError as Error);
      await errorMonitoring.logError(error, { 
        jobId,
        userId: job.user_id,
        operation: 'print_service_submit',
        timestamp: new Date().toISOString()
      }, request);
      return NextResponse.json({ success: false, error }, { status: 503 });
    }

  } catch (error) {
    const errorDetails = errorHandler.createError('INTERNAL_ERROR', error as Error, {
      jobId,
      operation: 'submit',
      timestamp: new Date().toISOString()
    });
    await errorMonitoring.logError(errorDetails, { 
      jobId,
      operation: 'submit',
      timestamp: new Date().toISOString()
    }, request);
    return NextResponse.json({ success: false, error: errorDetails }, { status: 500 });
  }
}