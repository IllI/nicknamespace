import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// import { DirectPrintDatabase } from '@/lib/services/direct-print-database';
import { DirectPrintJobStatus } from '@/lib/types/direct-print-jobs';

// const database = new DirectPrintDatabase();

// Initialize Supabase client for user authentication
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Get user from session
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'Authorization header required' 
          } 
        },
        { status: 401 }
      );
    }

    // Extract user ID from auth header or session
    // For now, we'll expect the user ID to be passed as a query parameter
    // In a real implementation, you'd extract it from the JWT token
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'MISSING_USER_ID', 
            message: 'User ID is required' 
          } 
        },
        { status: 400 }
      );
    }

    // Parse query parameters
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') as DirectPrintJobStatus | null;
    const orderBy = searchParams.get('orderBy') as 'created_at' | 'submitted_at' | 'completed_at' || 'created_at';
    const orderDirection = searchParams.get('orderDirection') as 'asc' | 'desc' || 'desc';

    // Validate parameters
    if (limit > 100) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_LIMIT', 
            message: 'Limit cannot exceed 100' 
          } 
        },
        { status: 400 }
      );
    }

    // Get user jobs
    const result = await database.getUserJobs(userId, {
      limit,
      offset,
      status: status || undefined,
      orderBy,
      orderDirection
    });

    return NextResponse.json({
      success: true,
      jobs: result.jobs,
      totalCount: result.totalCount,
      hasMore: result.totalCount > offset + limit,
      pagination: {
        limit,
        offset,
        total: result.totalCount
      }
    });

  } catch (error) {
    console.error('History API error:', error);
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