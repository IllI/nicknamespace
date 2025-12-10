import { NextRequest, NextResponse } from 'next/server';
import { getValidatedDirectPrintConfig } from '@/lib/config/direct-print-config';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

interface SystemMetrics {
  timestamp: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  database: {
    connections: number;
    activeJobs: number;
    totalJobs: number;
    failedJobs: number;
  };
  storage: {
    totalFiles: number;
    totalSize: number;
    bucketHealth: boolean;
  };
  printService: {
    isConnected: boolean;
    responseTime: number;
    queueLength: number;
  };
}

/**
 * System monitoring endpoint for operational metrics
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const config = getValidatedDirectPrintConfig();
    
    if (!config.monitoring.enabled) {
      return NextResponse.json(
        { error: 'Monitoring is disabled' },
        { status: 404 }
      );
    }

    const metrics = await collectSystemMetrics();
    
    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('System metrics collection failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to collect system metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Collect comprehensive system metrics
 */
async function collectSystemMetrics(): Promise<SystemMetrics> {
  const startTime = Date.now();
  
  // Collect memory metrics
  const memoryUsage = process.memoryUsage();
  const memory = {
    used: memoryUsage.heapUsed,
    total: memoryUsage.heapTotal,
    percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
  };

  // Collect database metrics
  const database = await collectDatabaseMetrics();
  
  // Collect storage metrics
  const storage = await collectStorageMetrics();
  
  // Collect print service metrics
  const printService = await collectPrintServiceMetrics();

  return {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory,
    cpu: {
      usage: await getCpuUsage(),
    },
    database,
    storage,
    printService,
  };
}

/**
 * Collect database-related metrics
 */
async function collectDatabaseMetrics() {
  try {
    const supabase = createClient();
    
    // Get active jobs count
    const { data: activeJobs, error: activeError } = await supabase
      .from('direct_print_jobs')
      .select('count')
      .in('status', ['pending', 'downloading', 'slicing', 'uploading', 'printing']);

    // Get total jobs count
    const { data: totalJobs, error: totalError } = await supabase
      .from('direct_print_jobs')
      .select('count');

    // Get failed jobs count (last 24 hours)
    const { data: failedJobs, error: failedError } = await supabase
      .from('direct_print_jobs')
      .select('count')
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return {
      connections: 1, // Supabase handles connection pooling
      activeJobs: activeJobs?.[0]?.count || 0,
      totalJobs: totalJobs?.[0]?.count || 0,
      failedJobs: failedJobs?.[0]?.count || 0,
    };

  } catch (error) {
    console.error('Database metrics collection failed:', error);
    return {
      connections: 0,
      activeJobs: 0,
      totalJobs: 0,
      failedJobs: 0,
    };
  }
}

/**
 * Collect storage-related metrics
 */
async function collectStorageMetrics() {
  try {
    const supabase = createClient();
    const config = getValidatedDirectPrintConfig();
    
    // List files in the storage bucket
    const { data: files, error } = await supabase.storage
      .from(config.directPrint.storageBucket)
      .list('', { limit: 1000 });

    if (error) {
      return {
        totalFiles: 0,
        totalSize: 0,
        bucketHealth: false,
      };
    }

    // Calculate total size (approximate)
    const totalSize = files?.reduce((sum, file) => {
      return sum + (file.metadata?.size || 0);
    }, 0) || 0;

    return {
      totalFiles: files?.length || 0,
      totalSize,
      bucketHealth: true,
    };

  } catch (error) {
    console.error('Storage metrics collection failed:', error);
    return {
      totalFiles: 0,
      totalSize: 0,
      bucketHealth: false,
    };
  }
}

/**
 * Collect print service metrics
 */
async function collectPrintServiceMetrics() {
  try {
    const config = getValidatedDirectPrintConfig();
    const startTime = Date.now();
    
    // Simple connectivity check
    const response = await fetch(`${config.printService.url}/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.printService.apiKey}`,
      },
      signal: AbortSignal.timeout(config.healthCheck.timeoutMs),
    });

    const responseTime = Date.now() - startTime;
    const isConnected = response.ok;
    
    let queueLength = 0;
    if (isConnected) {
      try {
        const data = await response.json();
        queueLength = data.queueLength || 0;
      } catch {
        // Ignore JSON parsing errors
      }
    }

    return {
      isConnected,
      responseTime,
      queueLength,
    };

  } catch (error) {
    console.error('Print service metrics collection failed:', error);
    return {
      isConnected: false,
      responseTime: -1,
      queueLength: 0,
    };
  }
}

/**
 * Get CPU usage percentage (simplified)
 */
async function getCpuUsage(): Promise<number> {
  return new Promise((resolve) => {
    const startUsage = process.cpuUsage();
    
    setTimeout(() => {
      const currentUsage = process.cpuUsage(startUsage);
      const totalUsage = currentUsage.user + currentUsage.system;
      const percentage = (totalUsage / 1000000) * 100; // Convert to percentage
      resolve(Math.min(percentage, 100));
    }, 100);
  });
}