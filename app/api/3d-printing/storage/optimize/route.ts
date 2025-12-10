// API endpoint for storage optimization operations
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DirectPrintStorageOptimizer } from '@/lib/services/direct-print-storage-optimizer';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Get user from auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    const { jobId, type } = await request.json();

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Get job details to verify ownership
    const { data: job, error: jobError } = await supabase
      .from('direct_print_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { success: false, error: 'Job not found or access denied' },
        { status: 404 }
      );
    }

    const optimizer = new DirectPrintStorageOptimizer();

    switch (type) {
      case 'optimize':
        const result = await optimizer.optimizeModelFile(
          user.id,
          jobId,
          job.storage_path,
          job.filename
        );
        
        return NextResponse.json({
          success: true,
          data: result,
          message: `Optimization completed. Saved ${Math.round(result.totalSavingsBytes / 1024 * 100) / 100}KB`
        });

      case 'compress':
        // Use the advanced compression service
        const { FileCompressionService } = await import('@/lib/services/file-compression-service');
        const compressionService = new FileCompressionService();
        
        const compressionResult = await compressionService.compressModelFile(
          user.id,
          jobId,
          job.storage_path,
          job.filename,
          {
            targetReduction: 0.3,
            preserveQuality: true,
            generateThumbnail: true,
            optimizeForPrinting: true
          }
        );
        
        return NextResponse.json({
          success: true,
          data: compressionResult,
          message: compressionResult.success 
            ? `Compression completed. ${Math.round((1 - compressionResult.compressionRatio) * 100)}% size reduction`
            : 'Compression failed'
        });

      case 'cleanup':
        await optimizer.cleanupOptimizationArtifacts(user.id, jobId);
        
        return NextResponse.json({
          success: true,
          message: 'Optimization artifacts cleaned up'
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid optimization type' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Storage optimization error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Storage optimization failed' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin access for stats
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const optimizer = new DirectPrintStorageOptimizer();
    const stats = await optimizer.getOptimizationStats();

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Storage optimization stats error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get optimization stats' 
      },
      { status: 500 }
    );
  }
}