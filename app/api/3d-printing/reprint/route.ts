import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DirectPrintDatabase } from '@/lib/services/direct-print-database';
import { PrintSettings } from '@/lib/types/direct-print-jobs';

// Initialize Supabase client with service role key for storage operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const database = new DirectPrintDatabase();

export async function POST(request: NextRequest) {
  try {
    // Get user ID from request headers or body
    // In a real implementation, you'd extract this from JWT token
    const body = await request.json();
    const { originalJobId, printSettings, userId } = body;
    
    if (!userId) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'User ID required' 
          } 
        },
        { status: 401 }
      );
    }

    if (!originalJobId) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'MISSING_JOB_ID', 
            message: 'Original job ID is required' 
          } 
        },
        { status: 400 }
      );
    }

    // Get original job details and verify ownership
    const originalJob = await database.getJob(originalJobId);
    
    if (!originalJob) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'JOB_NOT_FOUND', 
            message: 'Original print job not found' 
          } 
        },
        { status: 404 }
      );
    }

    if (originalJob.user_id !== userId) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'FORBIDDEN', 
            message: 'You do not have permission to reprint this job' 
          } 
        },
        { status: 403 }
      );
    }

    // Verify the original file still exists in storage
    const { data: fileExists, error: fileCheckError } = await supabase.storage
      .from('direct-3d-models')
      .list(originalJob.storage_path.split('/').slice(0, -1).join('/'), {
        search: originalJob.storage_path.split('/').pop()
      });

    if (fileCheckError || !fileExists || fileExists.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'FILE_NOT_FOUND', 
            message: 'Original model file no longer exists and cannot be reprinted' 
          } 
        },
        { status: 404 }
      );
    }

    // Create new job with same file but potentially different settings
    const newJob = await database.createJob({
      userId: userId,
      filename: `reprint_${originalJob.filename}`,
      storagePath: originalJob.storage_path, // Reuse same file
      fileSizeBytes: originalJob.file_size_bytes,
      modelMetadata: originalJob.model_metadata,
      printSettings: printSettings || originalJob.print_settings
    });

    return NextResponse.json({
      success: true,
      jobId: newJob.id,
      message: 'Reprint job created successfully',
      originalJobId: originalJobId,
      newJob: {
        id: newJob.id,
        filename: newJob.filename,
        status: newJob.status,
        createdAt: newJob.created_at
      }
    });

  } catch (error) {
    console.error('Reprint API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Internal server error' 
        } 
      },
      { status: 500 }
    );
  }
}