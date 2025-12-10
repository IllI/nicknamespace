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

// Use anon key for user authentication
const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename, storage_path, file_size_bytes, user_id } = body;

    // Validate required fields
    if (!filename || !storage_path || !file_size_bytes || !user_id) {
      return NextResponse.json(
        { error: 'Missing required fields: filename, storage_path, file_size_bytes, user_id' },
        { status: 400 }
      );
    }

    // Basic validation - in production you'd want proper auth verification
    // For now, we'll trust the user_id if it's provided since we're using service role
    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json(
        { error: 'Valid user_id is required' },
        { status: 400 }
      );
    }

    // Create job record using service role (bypasses RLS)
    const { data: jobData, error: jobError } = await supabaseAdmin
      .from('direct_print_jobs')
      .insert({
        user_id: user_id,
        filename: filename,
        storage_path: storage_path,
        file_size_bytes: file_size_bytes,
        status: 'pending',
        model_metadata: {},
        print_settings: {},
        printer_ip: process.env.DEFAULT_PRINTER_IP || '192.168.1.129',
        printer_serial: process.env.DEFAULT_PRINTER_SERIAL || '01P09A3A1800831'
      })
      .select()
      .single();

    if (jobError) {
      console.error('Database error:', jobError);
      return NextResponse.json(
        { error: `Job creation failed: ${jobError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      job: jobData,
      message: 'Print job created successfully'
    });

  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}