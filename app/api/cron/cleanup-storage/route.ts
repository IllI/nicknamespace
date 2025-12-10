// Cron job endpoint for automated storage cleanup
import { NextRequest, NextResponse } from 'next/server';
import { DirectPrintStorageManager } from '@/lib/services/direct-print-storage-manager';

export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const storageManager = new DirectPrintStorageManager();
    
    console.log('Starting automated storage cleanup...');
    
    // Cleanup failed jobs older than 7 days
    const failedJobsResult = await storageManager.cleanupFailedJobs(7);
    console.log(`Failed jobs cleanup: ${failedJobsResult.filesDeleted} files deleted, ${Math.round(failedJobsResult.bytesFreed / 1024 / 1024 * 100) / 100}MB freed`);
    
    // Cleanup orphaned files
    const orphanedFilesResult = await storageManager.cleanupOrphanedFiles();
    console.log(`Orphaned files cleanup: ${orphanedFilesResult.filesDeleted} files deleted, ${Math.round(orphanedFilesResult.bytesFreed / 1024 / 1024 * 100) / 100}MB freed`);
    
    // Get users approaching quota for monitoring
    const quotaWarnings = await storageManager.getUsersApproachingQuota(90);
    console.log(`Users approaching quota (90%): ${quotaWarnings.length}`);
    
    const totalFilesDeleted = failedJobsResult.filesDeleted + orphanedFilesResult.filesDeleted;
    const totalBytesFreed = failedJobsResult.bytesFreed + orphanedFilesResult.bytesFreed;
    const totalErrors = [...failedJobsResult.errors, ...orphanedFilesResult.errors];
    
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalFilesDeleted,
        totalBytesFreed,
        totalMBFreed: Math.round(totalBytesFreed / 1024 / 1024 * 100) / 100,
        usersApproachingQuota: quotaWarnings.length,
        errors: totalErrors
      },
      details: {
        failedJobsCleanup: failedJobsResult,
        orphanedFilesCleanup: orphanedFilesResult,
        quotaWarnings: quotaWarnings.slice(0, 10) // Only return top 10 for logging
      }
    };
    
    console.log('Storage cleanup completed:', result.summary);
    
    return NextResponse.json(result);

  } catch (error) {
    console.error('Automated storage cleanup failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Storage cleanup failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Storage cleanup cron endpoint is healthy',
    timestamp: new Date().toISOString()
  });
}