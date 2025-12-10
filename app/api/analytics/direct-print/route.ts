import { NextRequest, NextResponse } from 'next/server';
import { DirectPrintAnalyticsService } from '@/lib/services/direct-print-analytics';
import { getValidatedDirectPrintConfig } from '@/lib/config/direct-print-config';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Get analytics report for direct print service
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const config = getValidatedDirectPrintConfig();
    
    if (!config.monitoring.enabled) {
      return NextResponse.json(
        { error: 'Analytics is disabled' },
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d';
    const format = searchParams.get('format') || 'json';
    const includeRealTime = searchParams.get('realtime') === 'true';

    // Calculate date range based on period
    const endDate = new Date();
    let startDate: Date;

    switch (period) {
      case '1d':
        startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        // Custom date range
        const customStart = searchParams.get('start');
        const customEnd = searchParams.get('end');
        
        if (customStart && customEnd) {
          startDate = new Date(customStart);
          endDate.setTime(new Date(customEnd).getTime());
        } else {
          startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
    }

    const analyticsService = new DirectPrintAnalyticsService();
    
    // Generate report
    const report = await analyticsService.generateReport(startDate, endDate);
    
    // Add real-time metrics if requested
    if (includeRealTime) {
      const realTimeMetrics = await analyticsService.getRealTimeMetrics();
      (report as any).realTime = realTimeMetrics;
    }

    // Return in requested format
    if (format === 'csv') {
      const csv = convertReportToCSV(report);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="direct-print-analytics-${period}.csv"`,
        },
      });
    }

    return NextResponse.json(report, {
      headers: {
        'Cache-Control': 'private, max-age=300', // Cache for 5 minutes
      },
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate analytics report',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Track analytics events (for external integrations)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const config = getValidatedDirectPrintConfig();
    
    if (!config.monitoring.enabled) {
      return NextResponse.json(
        { error: 'Analytics tracking is disabled' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { jobId, event, metadata } = body;

    if (!jobId || !event) {
      return NextResponse.json(
        { error: 'Missing required fields: jobId, event' },
        { status: 400 }
      );
    }

    const analyticsService = new DirectPrintAnalyticsService();
    await analyticsService.trackJobEvent(jobId, event, metadata);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Analytics tracking error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to track analytics event',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Convert analytics report to CSV format
 */
function convertReportToCSV(report: any): string {
  const lines: string[] = [];
  
  // Header
  lines.push('Direct Print Analytics Report');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Period: ${report.period.start} to ${report.period.end} (${report.period.days} days)`);
  lines.push('');

  // Job Metrics
  lines.push('Job Metrics');
  lines.push('Metric,Value');
  lines.push(`Total Jobs,${report.jobMetrics.totalJobs}`);
  lines.push(`Successful Jobs,${report.jobMetrics.successfulJobs}`);
  lines.push(`Failed Jobs,${report.jobMetrics.failedJobs}`);
  lines.push(`Success Rate,${report.jobMetrics.successRate.toFixed(2)}%`);
  lines.push(`Average Processing Time,${(report.jobMetrics.averageProcessingTime / 1000 / 60).toFixed(2)} minutes`);
  lines.push(`Average Upload Time,${(report.jobMetrics.averageUploadTime / 1000).toFixed(2)} seconds`);
  lines.push(`Average File Size,${(report.jobMetrics.averageFileSize / 1024 / 1024).toFixed(2)} MB`);
  lines.push('');

  // User Analytics
  lines.push('User Analytics');
  lines.push('Metric,Value');
  lines.push(`Total Users,${report.userAnalytics.totalUsers}`);
  lines.push(`Active Users,${report.userAnalytics.activeUsers}`);
  lines.push(`New Users,${report.userAnalytics.newUsers}`);
  lines.push(`Average Jobs Per User,${report.userAnalytics.averageJobsPerUser.toFixed(2)}`);
  lines.push('');

  // File Formats
  lines.push('Top File Formats');
  lines.push('Format,Count,Percentage');
  report.userAnalytics.topFileFormats.forEach((format: any) => {
    lines.push(`${format.format},${format.count},${format.percentage.toFixed(2)}%`);
  });
  lines.push('');

  // Performance Metrics
  lines.push('Performance Metrics');
  lines.push('Metric,P50,P95,P99,Average');
  lines.push(`Upload Times (ms),${report.performanceMetrics.uploadTimes.p50},${report.performanceMetrics.uploadTimes.p95},${report.performanceMetrics.uploadTimes.p99},${report.performanceMetrics.uploadTimes.average.toFixed(0)}`);
  lines.push(`Processing Times (ms),${report.performanceMetrics.processingTimes.p50},${report.performanceMetrics.processingTimes.p95},${report.performanceMetrics.processingTimes.p99},${report.performanceMetrics.processingTimes.average.toFixed(0)}`);
  lines.push('');

  // Error Rates
  lines.push('Error Analysis');
  lines.push('Error Type,Count');
  lines.push(`Upload Errors,${report.performanceMetrics.errorRates.uploadErrors}`);
  lines.push(`Validation Errors,${report.performanceMetrics.errorRates.validationErrors}`);
  lines.push(`Print Service Errors,${report.performanceMetrics.errorRates.printServiceErrors}`);
  lines.push(`Storage Errors,${report.performanceMetrics.errorRates.storageErrors}`);
  lines.push('');

  // Trends
  lines.push('Trends (vs Previous Period)');
  lines.push('Metric,Change');
  lines.push(`Job Volume,${report.trends.jobVolumeChange.toFixed(2)}%`);
  lines.push(`Success Rate,${report.trends.successRateChange.toFixed(2)}%`);
  lines.push(`Performance,${report.trends.performanceChange.toFixed(2)}%`);

  return lines.join('\n');
}