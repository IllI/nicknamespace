import { NextRequest, NextResponse } from 'next/server';
import { errorMonitoring } from '@/lib/services/error-monitoring';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') as '1h' | '24h' | '7d' | '30d' || '24h';

    // Get error metrics
    const metrics = await errorMonitoring.getErrorMetrics(range);

    return NextResponse.json(metrics);

  } catch (error) {
    console.error('Failed to get error metrics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'MONITORING_ERROR', 
          message: 'Failed to retrieve error metrics' 
        } 
      },
      { status: 500 }
    );
  }
}