// Health check endpoint for background services
import { NextRequest, NextResponse } from 'next/server';
import { backgroundServiceManager } from '@/lib/services/background-service-manager';

/**
 * GET /api/health/background-services - Health check for background services
 */
export async function GET(request: NextRequest) {
  try {
    const healthStatus = await backgroundServiceManager.healthCheck();
    const servicesStatus = backgroundServiceManager.getServicesStatus();

    const response = {
      ...healthStatus,
      details: servicesStatus,
      environment: process.env.NODE_ENV,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };

    const statusCode = healthStatus.healthy ? 200 : 503;

    return NextResponse.json(response, { status: statusCode });

  } catch (error) {
    console.error('❌ Health check error:', error);
    
    return NextResponse.json(
      {
        healthy: false,
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/health/background-services - Control background services
 */
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    switch (action) {
      case 'restart':
        await backgroundServiceManager.restart();
        return NextResponse.json({
          success: true,
          message: 'Background services restarted',
          timestamp: new Date().toISOString()
        });

      case 'initialize':
        await backgroundServiceManager.initialize();
        return NextResponse.json({
          success: true,
          message: 'Background services initialized',
          timestamp: new Date().toISOString()
        });

      case 'shutdown':
        await backgroundServiceManager.shutdown();
        return NextResponse.json({
          success: true,
          message: 'Background services shut down',
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: restart, initialize, shutdown' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('❌ Background service control error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to control background services',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}