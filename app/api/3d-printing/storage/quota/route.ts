// API endpoint for storage quota management
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DirectPrintStorageManager } from '@/lib/services/direct-print-storage-manager';

export async function GET(request: NextRequest) {
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

    const storageManager = new DirectPrintStorageManager();
    const quota = await storageManager.getUserStorageQuota(user.id);

    return NextResponse.json({
      success: true,
      data: quota
    });

  } catch (error) {
    console.error('Storage quota error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get storage quota' 
      },
      { status: 500 }
    );
  }
}

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

    const { fileSizeBytes } = await request.json();

    if (!fileSizeBytes || typeof fileSizeBytes !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Invalid file size' },
        { status: 400 }
      );
    }

    const storageManager = new DirectPrintStorageManager();
    const quotaCheck = await storageManager.enforceStorageQuota(user.id, fileSizeBytes);

    return NextResponse.json({
      success: true,
      data: quotaCheck
    });

  } catch (error) {
    console.error('Storage quota check error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to check storage quota' 
      },
      { status: 500 }
    );
  }
}