import { NextRequest, NextResponse } from 'next/server';
import { getValidatedDirectPrintConfig } from '@/lib/config/direct-print-config';
import { createClient } from '@/utils/supabase/server';
import { PrintServiceClient } from '@/lib/services/print-service-client';

export const dynamic = 'force-dynamic';

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message: string;
  responseTime?: number;
  details?: any;
}

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  checks: HealthCheckResult[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  };
}

/**
 * Comprehensive health check for 3D Direct Print service
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const checks: HealthCheckResult[] = [];

  try {
    // Load configuration
    const config = getValidatedDirectPrintConfig();

    // Check database connectivity
    const dbCheck = await checkDatabase();
    checks.push(dbCheck);

    // Check Supabase storage
    const storageCheck = await checkStorage(config.directPrint.storageBucket);
    checks.push(storageCheck);

    // Check print service connectivity
    const printServiceCheck = await checkPrintService(config);
    checks.push(printServiceCheck);

    // Check background services
    const backgroundCheck = await checkBackgroundServices();
    checks.push(backgroundCheck);

    // Calculate summary
    const summary = {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length,
    };

    // Determine overall status
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (summary.unhealthy > 0) {
      overallStatus = 'unhealthy';
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded';
    }

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
      summary,
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(response, { status: statusCode });

  } catch (error) {
    console.error('Health check failed:', error);

    const errorResponse: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: [{
        service: 'health-check',
        status: 'unhealthy',
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
      }],
      summary: { total: 1, healthy: 0, unhealthy: 1, degraded: 0 },
    };

    return NextResponse.json(errorResponse, { status: 503 });
  }
}

/**
 * Check database connectivity and basic operations
 */
async function checkDatabase(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const supabase = createClient();
    
    // Test basic query
    const { data, error } = await supabase
      .from('direct_print_jobs')
      .select('count')
      .limit(1);

    if (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        message: `Database query failed: ${error.message}`,
        responseTime: Date.now() - startTime,
      };
    }

    return {
      service: 'database',
      status: 'healthy',
      message: 'Database connection successful',
      responseTime: Date.now() - startTime,
    };

  } catch (error) {
    return {
      service: 'database',
      status: 'unhealthy',
      message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Check Supabase storage connectivity
 */
async function checkStorage(bucketName: string): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const supabase = createClient();
    
    // Test bucket access
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list('', { limit: 1 });

    if (error) {
      return {
        service: 'storage',
        status: 'unhealthy',
        message: `Storage access failed: ${error.message}`,
        responseTime: Date.now() - startTime,
        details: { bucket: bucketName },
      };
    }

    return {
      service: 'storage',
      status: 'healthy',
      message: 'Storage access successful',
      responseTime: Date.now() - startTime,
      details: { bucket: bucketName },
    };

  } catch (error) {
    return {
      service: 'storage',
      status: 'unhealthy',
      message: `Storage check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      responseTime: Date.now() - startTime,
      details: { bucket: bucketName },
    };
  }
}

/**
 * Check print service connectivity
 */
async function checkPrintService(config: any): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const printService = new PrintServiceClient();
    const healthStatus = await printService.checkServiceHealth();

    if (healthStatus.isHealthy) {
      return {
        service: 'print-service',
        status: 'healthy',
        message: 'Print service is healthy',
        responseTime: Date.now() - startTime,
        details: {
          url: config.printService.url,
          version: healthStatus.version,
        },
      };
    } else {
      return {
        service: 'print-service',
        status: 'degraded',
        message: `Print service is degraded: ${healthStatus.message}`,
        responseTime: Date.now() - startTime,
        details: {
          url: config.printService.url,
          issues: healthStatus.issues,
        },
      };
    }

  } catch (error) {
    return {
      service: 'print-service',
      status: 'unhealthy',
      message: `Print service unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`,
      responseTime: Date.now() - startTime,
      details: { url: config.printService.url },
    };
  }
}

/**
 * Check background services status
 */
async function checkBackgroundServices(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    // Check if background services are running by looking at recent job status updates
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('direct_print_jobs')
      .select('updated_at')
      .gte('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
      .limit(1);

    if (error) {
      return {
        service: 'background-services',
        status: 'degraded',
        message: `Cannot verify background services: ${error.message}`,
        responseTime: Date.now() - startTime,
      };
    }

    // If we have recent updates, background services are likely working
    const hasRecentActivity = data && data.length > 0;

    return {
      service: 'background-services',
      status: hasRecentActivity ? 'healthy' : 'degraded',
      message: hasRecentActivity 
        ? 'Background services are active' 
        : 'No recent background service activity detected',
      responseTime: Date.now() - startTime,
      details: { recentActivity: hasRecentActivity },
    };

  } catch (error) {
    return {
      service: 'background-services',
      status: 'unhealthy',
      message: `Background services check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Simple health check endpoint for load balancers
 */
export async function HEAD(): Promise<NextResponse> {
  try {
    const config = getValidatedDirectPrintConfig();
    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}