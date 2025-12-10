import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DirectPrintDatabase } from '@/lib/services/direct-print-database';

// Initialize Supabase client with service role key for storage operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const database = new DirectPrintDatabase();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get user ID from request headers or query params
    // In a real implementation, you'd extract this from JWT token
    const authHeader = request.headers.get('authorization');
    const userId = request.nextUrl.searchParams.get('userId');
    
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

    const jobId = params.id;

    // Get job details and verify ownership
    const job = await database.getJob(jobId);
    
    if (!job) {
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

    if (job.user_id !== userId) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'FORBIDDEN', 
            message: 'You do not have permission to download this file' 
          } 
        },
        { status: 403 }
      );
    }

    // Generate signed URL for file download
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('direct-3d-models')
      .createSignedUrl(job.storage_path, 3600); // 1 hour expiry

    if (signedUrlError) {
      console.error('Signed URL error:', signedUrlError);
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'DOWNLOAD_ERROR', 
            message: 'Failed to generate download link' 
          } 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      downloadUrl: signedUrlData.signedUrl,
      filename: job.filename,
      fileSize: job.file_size_bytes,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString() // 1 hour from now
    });

  } catch (error) {
    console.error('Download API error:', error);
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