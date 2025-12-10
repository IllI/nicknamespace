import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const status = searchParams.get('status') || 'active'; // 'active', 'all', or specific status

    if (!userId) {
      return NextResponse.json(
        { error: 'user_id parameter is required' },
        { status: 400 }
      );
    }

    // Build status filter
    let statusFilter;
    if (status === 'active') {
      statusFilter = ['pending', 'downloading', 'slicing', 'uploading', 'printing'];
    } else if (status === 'all') {
      statusFilter = null; // No filter
    } else {
      statusFilter = [status]; // Specific status
    }

    // Query jobs using service role (bypasses RLS)
    let query = supabaseAdmin
      .from('direct_print_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (statusFilter) {
      query = query.in('status', statusFilter);
    }

    const { data: jobs, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: `Failed to fetch jobs: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      jobs: jobs || [],
      count: jobs?.length || 0
    });

  } catch (error) {
    console.error('Jobs API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}