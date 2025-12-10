/**
 * Error monitoring and logging service for 3D printing operations
 */

import { ErrorDetails, ErrorContext, ErrorSeverity } from '@/lib/types/error-handling';
import { DirectPrintDatabase } from './direct-print-database';

interface ErrorLogEntry {
  id: string;
  error_code: string;
  error_message: string;
  user_message: string;
  severity: ErrorSeverity;
  context: ErrorContext;
  user_id?: string;
  job_id?: string;
  operation?: string;
  user_agent?: string;
  ip_address?: string;
  created_at: string;
  resolved_at?: string;
  resolution_notes?: string;
}

interface ErrorMetrics {
  totalErrors: number;
  errorsByCode: Record<string, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByOperation: Record<string, number>;
  recentErrors: ErrorLogEntry[];
  errorRate: number; // errors per hour
  topErrors: Array<{ code: string; count: number; percentage: number }>;
}

export class ErrorMonitoringService {
  private database: DirectPrintDatabase;
  private metricsCache: { metrics: ErrorMetrics; timestamp: number } | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.database = new DirectPrintDatabase();
  }

  /**
   * Logs an error to the database for monitoring and analytics
   */
  async logError(
    error: ErrorDetails, 
    context: ErrorContext,
    request?: Request
  ): Promise<void> {
    try {
      const errorEntry: Omit<ErrorLogEntry, 'id' | 'created_at'> = {
        error_code: error.code,
        error_message: error.message,
        user_message: error.userMessage || error.message,
        severity: this.getSeverity(error.code),
        context,
        user_id: context.userId,
        job_id: context.jobId,
        operation: context.operation,
        user_agent: request?.headers.get('user-agent') || context.userAgent,
        ip_address: this.getClientIP(request)
      };

      // Insert into database
      const { error: dbError } = await this.database['supabase']
        .from('error_logs')
        .insert([{
          ...errorEntry,
          created_at: new Date().toISOString()
        }]);

      if (dbError) {
        console.error('Failed to log error to database:', dbError);
      }

      // Send critical errors to external monitoring immediately
      if (errorEntry.severity === ErrorSeverity.CRITICAL) {
        await this.sendCriticalAlert(error, context);
      }

      // Clear metrics cache to force refresh
      this.metricsCache = null;

    } catch (loggingError) {
      console.error('Error logging failed:', loggingError);
    }
  }

  /**
   * Gets error metrics and analytics
   */
  async getErrorMetrics(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<ErrorMetrics> {
    // Check cache first
    if (this.metricsCache && Date.now() - this.metricsCache.timestamp < this.CACHE_DURATION) {
      return this.metricsCache.metrics;
    }

    try {
      const hoursBack = this.getHoursFromRange(timeRange);
      const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

      // Get error data from database
      const { data: errors, error } = await this.database['supabase']
        .from('error_logs')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const errorEntries = errors as ErrorLogEntry[];
      const metrics = this.calculateMetrics(errorEntries, hoursBack);

      // Cache the results
      this.metricsCache = {
        metrics,
        timestamp: Date.now()
      };

      return metrics;

    } catch (error) {
      console.error('Failed to get error metrics:', error);
      return this.getEmptyMetrics();
    }
  }

  /**
   * Gets errors for a specific user
   */
  async getUserErrors(
    userId: string, 
    limit: number = 50
  ): Promise<ErrorLogEntry[]> {
    try {
      const { data: errors, error } = await this.database['supabase']
        .from('error_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return errors as ErrorLogEntry[];

    } catch (error) {
      console.error('Failed to get user errors:', error);
      return [];
    }
  }

  /**
   * Gets errors for a specific job
   */
  async getJobErrors(jobId: string): Promise<ErrorLogEntry[]> {
    try {
      const { data: errors, error } = await this.database['supabase']
        .from('error_logs')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return errors as ErrorLogEntry[];

    } catch (error) {
      console.error('Failed to get job errors:', error);
      return [];
    }
  }

  /**
   * Marks an error as resolved
   */
  async resolveError(
    errorId: string, 
    resolutionNotes?: string
  ): Promise<void> {
    try {
      const { error } = await this.database['supabase']
        .from('error_logs')
        .update({
          resolved_at: new Date().toISOString(),
          resolution_notes: resolutionNotes
        })
        .eq('id', errorId);

      if (error) {
        throw error;
      }

      // Clear metrics cache
      this.metricsCache = null;

    } catch (error) {
      console.error('Failed to resolve error:', error);
    }
  }

  /**
   * Gets error trends over time
   */
  async getErrorTrends(
    timeRange: '24h' | '7d' | '30d' = '7d'
  ): Promise<Array<{ date: string; count: number; severity: ErrorSeverity }>> {
    try {
      const hoursBack = this.getHoursFromRange(timeRange);
      const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

      const { data: errors, error } = await this.database['supabase']
        .from('error_logs')
        .select('created_at, severity')
        .gte('created_at', since)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      // Group errors by date and severity
      const trends: Record<string, Record<ErrorSeverity, number>> = {};
      
      for (const errorEntry of errors as ErrorLogEntry[]) {
        const date = errorEntry.created_at.split('T')[0]; // Get date part
        if (!trends[date]) {
          trends[date] = {
            [ErrorSeverity.LOW]: 0,
            [ErrorSeverity.MEDIUM]: 0,
            [ErrorSeverity.HIGH]: 0,
            [ErrorSeverity.CRITICAL]: 0
          };
        }
        trends[date][errorEntry.severity]++;
      }

      // Convert to array format
      const result: Array<{ date: string; count: number; severity: ErrorSeverity }> = [];
      for (const [date, severityCounts] of Object.entries(trends)) {
        for (const [severity, count] of Object.entries(severityCounts)) {
          if (count > 0) {
            result.push({
              date,
              count,
              severity: severity as ErrorSeverity
            });
          }
        }
      }

      return result;

    } catch (error) {
      console.error('Failed to get error trends:', error);
      return [];
    }
  }

  /**
   * Sends critical error alerts to monitoring systems
   */
  private async sendCriticalAlert(
    error: ErrorDetails, 
    context: ErrorContext
  ): Promise<void> {
    try {
      // In production, this would integrate with alerting systems
      // For now, we'll log to console and could send to webhook/email
      
      const alertData = {
        timestamp: new Date().toISOString(),
        service: '3D Printing Service',
        severity: 'CRITICAL',
        error: {
          code: error.code,
          message: error.message,
          userMessage: error.userMessage
        },
        context,
        environment: process.env.NODE_ENV
      };

      console.error('🚨 CRITICAL ERROR ALERT:', alertData);

      // You could send to external services here:
      // - Slack webhook
      // - Email notification
      // - PagerDuty
      // - Sentry
      // await this.sendSlackAlert(alertData);
      // await this.sendEmailAlert(alertData);

    } catch (alertError) {
      console.error('Failed to send critical alert:', alertError);
    }
  }

  /**
   * Calculates error metrics from raw error data
   */
  private calculateMetrics(errors: ErrorLogEntry[], timeRangeHours: number): ErrorMetrics {
    const totalErrors = errors.length;
    const errorRate = totalErrors / timeRangeHours;

    // Count by error code
    const errorsByCode: Record<string, number> = {};
    errors.forEach(error => {
      errorsByCode[error.error_code] = (errorsByCode[error.error_code] || 0) + 1;
    });

    // Count by severity
    const errorsBySeverity: Record<ErrorSeverity, number> = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0
    };
    errors.forEach(error => {
      errorsBySeverity[error.severity]++;
    });

    // Count by operation
    const errorsByOperation: Record<string, number> = {};
    errors.forEach(error => {
      if (error.operation) {
        errorsByOperation[error.operation] = (errorsByOperation[error.operation] || 0) + 1;
      }
    });

    // Get top errors
    const topErrors = Object.entries(errorsByCode)
      .map(([code, count]) => ({
        code,
        count,
        percentage: Math.round((count / totalErrors) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalErrors,
      errorsByCode,
      errorsBySeverity,
      errorsByOperation,
      recentErrors: errors.slice(0, 20), // Last 20 errors
      errorRate,
      topErrors
    };
  }

  /**
   * Gets severity level for error code
   */
  private getSeverity(code: string): ErrorSeverity {
    // Map from error-handling.ts
    const severityMap: Record<string, ErrorSeverity> = {
      MISSING_FILE: ErrorSeverity.LOW,
      INVALID_FILE_FORMAT: ErrorSeverity.MEDIUM,
      FILE_TOO_LARGE: ErrorSeverity.MEDIUM,
      VALIDATION_FAILED: ErrorSeverity.MEDIUM,
      STORAGE_QUOTA_EXCEEDED: ErrorSeverity.HIGH,
      UPLOAD_FAILED: ErrorSeverity.HIGH,
      PRINT_SERVICE_ERROR: ErrorSeverity.HIGH,
      DATABASE_ERROR: ErrorSeverity.CRITICAL,
      INTERNAL_ERROR: ErrorSeverity.CRITICAL
    };

    return severityMap[code] || ErrorSeverity.MEDIUM;
  }

  /**
   * Converts time range to hours
   */
  private getHoursFromRange(range: string): number {
    switch (range) {
      case '1h': return 1;
      case '24h': return 24;
      case '7d': return 24 * 7;
      case '30d': return 24 * 30;
      default: return 24;
    }
  }

  /**
   * Gets client IP address from request
   */
  private getClientIP(request?: Request): string | undefined {
    if (!request) return undefined;

    // Check various headers for IP address
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    return request.headers.get('x-real-ip') || 
           request.headers.get('cf-connecting-ip') || 
           undefined;
  }

  /**
   * Returns empty metrics structure
   */
  private getEmptyMetrics(): ErrorMetrics {
    return {
      totalErrors: 0,
      errorsByCode: {},
      errorsBySeverity: {
        [ErrorSeverity.LOW]: 0,
        [ErrorSeverity.MEDIUM]: 0,
        [ErrorSeverity.HIGH]: 0,
        [ErrorSeverity.CRITICAL]: 0
      },
      errorsByOperation: {},
      recentErrors: [],
      errorRate: 0,
      topErrors: []
    };
  }
}

// Export singleton instance
export const errorMonitoring = new ErrorMonitoringService();