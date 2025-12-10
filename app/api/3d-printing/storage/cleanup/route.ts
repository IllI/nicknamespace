// API endpoint for storage cleanup operations
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DirectPrintStorageManager } from '@/lib/services/direct-print-storage-manager';

export async function POST(request: NextRequest) {
  try {
    // Verify admin access or service role
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the token is a service role key or admin user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('user_usage')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { type, olderThanDays } = await request.json();
    const storageManager = new DirectPrintStorageManager();

    let result;
    switch (type) {
      case 'failed_jobs':
        result = await storageManager.cleanupFailedJobs(olderThanDays || 7);
        break;
      case 'orphaned_files':
        result = await storageManager.cleanupOrphanedFiles();
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid cleanup type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: `Cleanup completed: ${result.filesDeleted} files deleted, ${Math.round(result.bytesFreed / 1024 / 1024 * 100) / 100}MB freed`
    });

  } catch (error) {
    console.error('Storage cleanup error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Storage cleanup failed' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const storageManager = new DirectPrintStorageManager();

    switch (action) {
      case 'analytics':
        const analytics = await storageManager.getStorageAnalytics();
        return NextResponse.json({
          success: true,
          data: analytics
        });

      case 'quota_warnings':
        const threshold = parseInt(searchParams.get('threshold') || '80');
        const warnings = await storageManager.getUsersApproachingQuota(threshold);
        return NextResponse.json({
          success: true,
          data: warnings
        });

      case 'report':
        const report = await storageManager.generateStorageReport();
        return NextResponse.json({
          success: true,
          data: report
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Storage management error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Storage management failed' 
      },
      { status: 500 }
    );
  }
}