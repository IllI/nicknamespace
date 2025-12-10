/**
 * Analytics and monitoring service for 3D Direct Print functionality
 * Tracks job success/failure rates, performance metrics, and user analytics
 */

import { createClient } from '@/utils/supabase/server';
import { getValidatedDirectPrintConfig } from '@/lib/config/direct-print-config';
import type { DirectPrintJob, JobStatus } from '@/lib/types/direct-print-jobs';

export interface JobMetrics {
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  successRate: number;
  averageProcessingTime: number;
  averageUploadTime: number;
  averageFileSize: number;
}

export interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  averageJobsPerUser: number;
  topFileFormats: Array<{ format: string; count: number; percentage: number }>;
  usageByTimeOfDay: Array<{ hour: number; jobCount: number }>;
}

export interface PerformanceMetrics {
  uploadTimes: {
    p50: number;
    p95: number;
    p99: number;
    average: number;
  };
  processingTimes: {
    p50: number;
    p95: number;
    p99: number;
    average: number;
  };
  errorRates: {
    uploadErrors: number;
    validationErrors: number;
    printServiceErrors: number;
    storageErrors: number;
  };
}

export interface AnalyticsReport {
  period: {
    start: string;
    end: string;
    days: number;
  };
  jobMetrics: JobMetrics;
  userAnalytics: UserAnalytics;
  performanceMetrics: PerformanceMetrics;
  trends: {
    jobVolumeChange: number;
    successRateChange: number;
    performanceChange: number;
  };
  generatedAt: string;
}

export class DirectPrintAnalyticsService {
  private supabase = createClient();
  private config = getValidatedDirectPrintConfig();

  /**
   * Generate comprehensive analytics report for a given period
   */
  async generateReport(
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<AnalyticsReport> {
    const period = {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      days: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
    };

    const [jobMetrics, userAnalytics, performanceMetrics, trends] = await Promise.all([
      this.getJobMetrics(startDate, endDate),
      this.getUserAnalytics(startDate, endDate),
      this.getPerformanceMetrics(startDate, endDate),
      this.getTrends(startDate, endDate),
    ]);

    return {
      period,
      jobMetrics,
      userAnalytics,
      performanceMetrics,
      trends,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get job success/failure metrics
   */
  async getJobMetrics(startDate: Date, endDate: Date): Promise<JobMetrics> {
    const { data: jobs, error } = await this.supabase
      .from('direct_print_jobs')
      .select('status, created_at, submitted_at, completed_at, file_size_bytes')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) {
      console.error('Failed to fetch job metrics:', error);
      throw new Error(`Failed to fetch job metrics: ${error.message}`);
    }

    const totalJobs = jobs?.length || 0;
    const successfulJobs = jobs?.filter(job => job.status === 'complete').length || 0;
    const failedJobs = jobs?.filter(job => job.status === 'failed').length || 0;
    const successRate = totalJobs > 0 ? (successfulJobs / totalJobs) * 100 : 0;

    // Calculate average processing time (from submission to completion)
    const completedJobs = jobs?.filter(job => 
      job.status === 'complete' && job.submitted_at && job.completed_at
    ) || [];

    const processingTimes = completedJobs.map(job => {
      const submitted = new Date(job.submitted_at!).getTime();
      const completed = new Date(job.completed_at!).getTime();
      return completed - submitted;
    });

    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;

    // Calculate average upload time (created to submitted)
    const submittedJobs = jobs?.filter(job => job.submitted_at) || [];
    const uploadTimes = submittedJobs.map(job => {
      const created = new Date(job.created_at).getTime();
      const submitted = new Date(job.submitted_at!).getTime();
      return submitted - created;
    });

    const averageUploadTime = uploadTimes.length > 0
      ? uploadTimes.reduce((sum, time) => sum + time, 0) / uploadTimes.length
      : 0;

    // Calculate average file size
    const fileSizes = jobs?.map(job => job.file_size_bytes || 0).filter(size => size > 0) || [];
    const averageFileSize = fileSizes.length > 0
      ? fileSizes.reduce((sum, size) => sum + size, 0) / fileSizes.length
      : 0;

    return {
      totalJobs,
      successfulJobs,
      failedJobs,
      successRate,
      averageProcessingTime,
      averageUploadTime,
      averageFileSize,
    };
  }

  /**
   * Get user analytics and usage patterns
   */
  async getUserAnalytics(startDate: Date, endDate: Date): Promise<UserAnalytics> {
    // Get unique users who created jobs in the period
    const { data: userJobs, error } = await this.supabase
      .from('direct_print_jobs')
      .select('user_id, created_at, model_metadata')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) {
      console.error('Failed to fetch user analytics:', error);
      throw new Error(`Failed to fetch user analytics: ${error.message}`);
    }

    const uniqueUsers = new Set(userJobs?.map(job => job.user_id) || []);
    const totalUsers = uniqueUsers.size;

    // Calculate active users (users with jobs in the last 7 days)
    const sevenDaysAgo = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const activeUserIds = new Set(
      userJobs?.filter(job => new Date(job.created_at) >= sevenDaysAgo)
        .map(job => job.user_id) || []
    );
    const activeUsers = activeUserIds.size;

    // Calculate new users (first job in the period)
    const { data: allUserJobs, error: allJobsError } = await this.supabase
      .from('direct_print_jobs')
      .select('user_id, created_at')
      .order('created_at', { ascending: true });

    if (allJobsError) {
      console.error('Failed to fetch all user jobs:', allJobsError);
    }

    const firstJobDates = new Map<string, Date>();
    allUserJobs?.forEach(job => {
      const userId = job.user_id;
      const jobDate = new Date(job.created_at);
      if (!firstJobDates.has(userId) || jobDate < firstJobDates.get(userId)!) {
        firstJobDates.set(userId, jobDate);
      }
    });

    const newUsers = Array.from(firstJobDates.entries()).filter(([userId, firstJobDate]) => 
      firstJobDate >= startDate && firstJobDate <= endDate
    ).length;

    const averageJobsPerUser = totalUsers > 0 ? (userJobs?.length || 0) / totalUsers : 0;

    // Analyze file formats
    const formatCounts = new Map<string, number>();
    userJobs?.forEach(job => {
      const metadata = job.model_metadata as any;
      const format = metadata?.format || 'unknown';
      formatCounts.set(format, (formatCounts.get(format) || 0) + 1);
    });

    const totalFormatJobs = userJobs?.length || 0;
    const topFileFormats = Array.from(formatCounts.entries())
      .map(([format, count]) => ({
        format,
        count,
        percentage: totalFormatJobs > 0 ? (count / totalFormatJobs) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Analyze usage by time of day
    const hourCounts = new Array(24).fill(0);
    userJobs?.forEach(job => {
      const hour = new Date(job.created_at).getHours();
      hourCounts[hour]++;
    });

    const usageByTimeOfDay = hourCounts.map((jobCount, hour) => ({
      hour,
      jobCount,
    }));

    return {
      totalUsers,
      activeUsers,
      newUsers,
      averageJobsPerUser,
      topFileFormats,
      usageByTimeOfDay,
    };
  }

  /**
   * Get performance metrics and percentiles
   */
  async getPerformanceMetrics(startDate: Date, endDate: Date): Promise<PerformanceMetrics> {
    const { data: jobs, error } = await this.supabase
      .from('direct_print_jobs')
      .select('created_at, submitted_at, completed_at, status, error_message')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) {
      console.error('Failed to fetch performance metrics:', error);
      throw new Error(`Failed to fetch performance metrics: ${error.message}`);
    }

    // Calculate upload times (created to submitted)
    const uploadTimes = jobs?.filter(job => job.submitted_at)
      .map(job => {
        const created = new Date(job.created_at).getTime();
        const submitted = new Date(job.submitted_at!).getTime();
        return submitted - created;
      })
      .sort((a, b) => a - b) || [];

    // Calculate processing times (submitted to completed)
    const processingTimes = jobs?.filter(job => job.submitted_at && job.completed_at)
      .map(job => {
        const submitted = new Date(job.submitted_at!).getTime();
        const completed = new Date(job.completed_at!).getTime();
        return completed - submitted;
      })
      .sort((a, b) => a - b) || [];

    // Calculate percentiles
    const getPercentile = (arr: number[], percentile: number): number => {
      if (arr.length === 0) return 0;
      const index = Math.ceil((percentile / 100) * arr.length) - 1;
      return arr[Math.max(0, Math.min(index, arr.length - 1))];
    };

    const uploadMetrics = {
      p50: getPercentile(uploadTimes, 50),
      p95: getPercentile(uploadTimes, 95),
      p99: getPercentile(uploadTimes, 99),
      average: uploadTimes.length > 0 
        ? uploadTimes.reduce((sum, time) => sum + time, 0) / uploadTimes.length 
        : 0,
    };

    const processingMetrics = {
      p50: getPercentile(processingTimes, 50),
      p95: getPercentile(processingTimes, 95),
      p99: getPercentile(processingTimes, 99),
      average: processingTimes.length > 0 
        ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length 
        : 0,
    };

    // Analyze error types
    const failedJobs = jobs?.filter(job => job.status === 'failed') || [];
    const errorCounts = {
      uploadErrors: 0,
      validationErrors: 0,
      printServiceErrors: 0,
      storageErrors: 0,
    };

    failedJobs.forEach(job => {
      const errorMessage = job.error_message?.toLowerCase() || '';
      if (errorMessage.includes('upload') || errorMessage.includes('file')) {
        errorCounts.uploadErrors++;
      } else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
        errorCounts.validationErrors++;
      } else if (errorMessage.includes('print service') || errorMessage.includes('orca')) {
        errorCounts.printServiceErrors++;
      } else if (errorMessage.includes('storage') || errorMessage.includes('bucket')) {
        errorCounts.storageErrors++;
      }
    });

    return {
      uploadTimes: uploadMetrics,
      processingTimes: processingMetrics,
      errorRates: errorCounts,
    };
  }

  /**
   * Calculate trends compared to previous period
   */
  async getTrends(startDate: Date, endDate: Date) {
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodLength);
    const previousEndDate = startDate;

    const [currentMetrics, previousMetrics] = await Promise.all([
      this.getJobMetrics(startDate, endDate),
      this.getJobMetrics(previousStartDate, previousEndDate),
    ]);

    const jobVolumeChange = previousMetrics.totalJobs > 0
      ? ((currentMetrics.totalJobs - previousMetrics.totalJobs) / previousMetrics.totalJobs) * 100
      : 0;

    const successRateChange = previousMetrics.successRate > 0
      ? currentMetrics.successRate - previousMetrics.successRate
      : 0;

    const performanceChange = previousMetrics.averageProcessingTime > 0
      ? ((previousMetrics.averageProcessingTime - currentMetrics.averageProcessingTime) / previousMetrics.averageProcessingTime) * 100
      : 0;

    return {
      jobVolumeChange,
      successRateChange,
      performanceChange,
    };
  }

  /**
   * Track a job event for analytics
   */
  async trackJobEvent(
    jobId: string,
    event: 'created' | 'uploaded' | 'validated' | 'submitted' | 'completed' | 'failed',
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.config.monitoring.enabled) {
      return;
    }

    try {
      // Store event in analytics table (if exists) or log for external analytics
      console.log(`Job Event: ${event}`, {
        jobId,
        event,
        metadata,
        timestamp: new Date().toISOString(),
      });

      // You could also send to external analytics services here
      // await this.sendToExternalAnalytics(jobId, event, metadata);

    } catch (error) {
      console.error('Failed to track job event:', error);
      // Don't throw - analytics failures shouldn't break the main flow
    }
  }

  /**
   * Get real-time metrics for dashboard
   */
  async getRealTimeMetrics() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

    const [last24HourMetrics, lastHourMetrics] = await Promise.all([
      this.getJobMetrics(last24Hours, now),
      this.getJobMetrics(lastHour, now),
    ]);

    return {
      last24Hours: last24HourMetrics,
      lastHour: lastHourMetrics,
      timestamp: now.toISOString(),
    };
  }
}