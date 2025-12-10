// API route following API_QUICK_REFERENCE.md specifications
import { NextRequest, NextResponse } from 'next/server';

const PRINT_SERVICE_URL = process.env.PRINT_SERVICE_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { job_id, storage_path, filename } = body;

    // Validate required fields as specified in API guide
    if (!job_id || !storage_path || !filename) {
      return NextResponse.json(
        { error: 'Missing required fields: job_id, storage_path, filename' },
        { status: 400 }
      );
    }

    // Call print service as specified in API guide
    const response = await fetch(`${PRINT_SERVICE_URL}/api/print`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        job_id,
        storage_path,
        filename
      })
    });

    const data = await response.json();
    
    // Return response in API-compliant format
    return NextResponse.json(data, { 
      status: response.ok ? 200 : 500 
    });
    
  } catch (error) {
    console.error('Print service error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to print service',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}