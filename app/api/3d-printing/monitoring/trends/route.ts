import { NextRequest, NextResponse } from 'next/server';
import { errorMonitoring } from '@/lib/services/error-monitoring';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') as '24h' | '7d' | '30d' || '7d';

    // Get error trends
    const trends = await errorMonitoring.getErrorTrends(range);

    return NextResponse.json(trends);

  } catch (error) {
    console.error('Failed to get error trends:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'MONITORING_ERROR', 
          message: 'Failed to retrieve error trends' 
        } 
      },
      { status: 500 }
    );
  }
}