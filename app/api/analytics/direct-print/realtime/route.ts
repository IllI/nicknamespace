import { NextRequest, NextResponse } from 'next/server';
import { DirectPrintAnalyticsService } from '@/lib/services/direct-print-analytics';
import { getValidatedDirectPrintConfig } from '@/lib/config/direct-print-config';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

interface RealTimeMetrics {
  timestamp: string;
  activeJobs: {
    total: number;
    byStatus: Record<string, number>;
  };
  recentActivity: {
    last5Minutes: number;
    last15Minutes: number;
    lastHour: number;
  };
  systemHealth: {
    printServiceConnected: boolean;
    storageHealthy: boolean;
    errorRate: number;
  };
  performance: {
    averageUploadTime: number;
    averageProcessingTime: number;
    queueLength: number;
  };
}

/**
 * Get real-time metrics for monitoring dashboard
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const config = getValidatedDirectPrintConfig();
    
    if (!config.monitoring.enabled) {
      return NextResponse.json(
        { error: 'Real-time monitoring is disabled' },
        { status: 404 }
      );
    }

    // Check authentication
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const metrics = await collectRealTimeMetrics();

    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('Real-time metrics error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to collect real-time metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Collect real-time metrics from various sources
 */
async function collectRealTimeMetrics(): Promise<RealTimeMetrics> {
  const supabase = createClient();
  const now = new Date();
  
  // Time ranges for activity tracking
  const last5Minutes = new Date(now.getTime() - 5 * 60 * 1000);
  const last15Minutes = new Date(now.getTime() - 15 * 60 * 1000);
  const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

  // Get active jobs by status
  const { data: activeJobs, error: activeJobsError } = await supabase
    .from('direct_print_jobs')
    .select('status')
    .in('status', ['pending', 'downloading', 'slicing', 'uploading', 'printing']);

  if (activeJobsError) {
    console.error('Failed to fetch active jobs:', activeJobsError);
  }

  const activeJobsByStatus: Record<string, number> = {};
  activeJobs?.forEach(job => {
    activeJobsByStatus[job.status] = (activeJobsByStatus[job.status] || 0) + 1;
  });

  // Get recent activity
  const [activity5min, activity15min, activity1hour] = await Promise.all([
    getJobCountSince(supabase, last5Minutes),
    getJobCountSince(supabase, last15Minutes),
    getJobCountSince(supabase, lastHour),
  ]);

  // Get system health indicators
  const systemHealth = await getSystemHealth(supabase, lastHour);

  // Get performance metrics
  const performance = await getPerformanceMetrics(supabase, lastHour);

  return {
    timestamp: now.toISOString(),
    activeJobs: {
      total: activeJobs?.length || 0,
      byStatus: activeJobsByStatus,
    },
    recentActivity: {
      last5Minutes: activity5min,
      last15Minutes: activity15min,
      lastHour: activity1hour,
    },
    systemHealth,
    performance,
  };
}

/**
 * Get job count since a specific time
 */
async function getJobCountSince(supabase: any, since: Date): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('direct_print_jobs')
      .select('count')
      .gte('created_at', since.toISOString());

    if (error) {
      console.error('Failed to get job count:', error);
      return 0;
    }

    return data?.[0]?.count || 0;
  } catch (error) {
    console.error('Error getting job count:', error);
    return 0;
  }
}

/**
 * Get system health indicators
 */
async function getSystemHealth(supabase: any, since: Date) {
  try {
    // Check for recent failed jobs to calculate error rate
    const [totalJobs, failedJobs] = await Promise.all([
      supabase
        .from('direct_print_jobs')
        .select('count')
        .gte('created_at', since.toISOString()),
      supabase
        .from('direct_print_jobs')
        .select('count')
        .eq('status', 'failed')
        .gte('created_at', since.toISOString()),
    ]);

    const totalCount = totalJobs.data?.[0]?.count || 0;
    const failedCount = failedJobs.data?.[0]?.count || 0;
    const errorRate = totalCount > 0 ? (failedCount / totalCount) * 100 : 0;

    // Check print service connectivity (simplified)
    const config = getValidatedDirectPrintConfig();
    let printServiceConnected = false;
    
    try {
      const response = await fetch(`${config.printService.url}/health`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      printServiceConnected = response.ok;
    } catch {
      printServiceConnected = false;
    }

    // Check storage health by attempting to list bucket contents
    let storageHealthy = false;
    try {
      const { error } = await supabase.storage
        .from(config.directPrint.storageBucket)
        .list('', { limit: 1 });
      storageHealthy = !error;
    } catch {
      storageHealthy = false;
    }

    return {
      printServiceConnected,
      storageHealthy,
      errorRate,
    };

  } catch (error) {
    console.error('Error getting system health:', error);
    return {
      printServiceConnected: false,
      storageHealthy: false,
      errorRate: 100,
    };
  }
}

/**
 * Get current performance metrics
 */
async function getPerformanceMetrics(supabase: any, since: Date) {
  try {
    // Get recent completed jobs for performance calculation
    const { data: recentJobs, error } = await supabase
      .from('direct_print_jobs')
      .select('created_at, submitted_at, completed_at, status')
      .gte('created_at', since.toISOString())
      .not('submitted_at', 'is', null);

    if (error) {
      console.error('Failed to get performance metrics:', error);
      return {
        averageUploadTime: 0,
        averageProcessingTime: 0,
        queueLength: 0,
      };
    }

    // Calculate average upload time (created to submitted)
    const uploadTimes = recentJobs
      ?.filter(job => job.submitted_at)
      .map(job => {
        const created = new Date(job.created_at).getTime();
        const submitted = new Date(job.submitted_at).getTime();
        return submitted - created;
      }) || [];

    const averageUploadTime = uploadTimes.length > 0
      ? uploadTimes.reduce((sum, time) => sum + time, 0) / uploadTimes.length
      : 0;

    // Calculate average processing time (submitted to completed)
    const processingTimes = recentJobs
      ?.filter(job => job.submitted_at && job.completed_at)
      .map(job => {
        const submitted = new Date(job.submitted_at).getTime();
        const completed = new Date(job.completed_at).getTime();
        return completed - submitted;
      }) || [];

    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;

    // Estimate queue length (jobs in processing states)
    const { data: queueJobs } = await supabase
      .from('direct_print_jobs')
      .select('count')
      .in('status', ['pending', 'downloading', 'slicing', 'uploading']);

    const queueLength = queueJobs?.[0]?.count || 0;

    return {
      averageUploadTime,
      averageProcessingTime,
      queueLength,
    };

  } catch (error) {
    console.error('Error getting performance metrics:', error);
    return {
      averageUploadTime: 0,
      averageProcessingTime: 0,
      queueLength: 0,
    };
  }
}