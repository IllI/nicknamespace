/**
 * Comprehensive error handling service for 3D printing operations
 */

import { 
  ErrorDetails, 
  ErrorContext, 
  ErrorCategory, 
  ErrorSeverity,
  ERROR_DEFINITIONS,
  ERROR_SEVERITY_MAP,
  RecoveryAction,
  TroubleshootingStep
} from '@/lib/types/error-handling';

export class ErrorHandlingService {
  private static instance: ErrorHandlingService;
  private errorLog: Array<{ error: ErrorDetails; context: ErrorContext }> = [];

  static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  /**
   * Creates a standardized error response with user-friendly messages and recovery actions
   */
  createError(
    code: string, 
    originalError?: Error | string, 
    context?: Partial<ErrorContext>,
    customMessage?: string
  ): ErrorDetails {
    const baseError = ERROR_DEFINITIONS[code] || {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      userMessage: 'Something went wrong. Please try again or contact support'
    };

    const errorDetails: ErrorDetails = {
      ...baseError,
      timestamp: new Date().toISOString(),
      details: originalError instanceof Error ? {
        name: originalError.name,
        message: originalError.message,
        stack: process.env.NODE_ENV === 'development' ? originalError.stack : undefined
      } : originalError
    };

    if (customMessage) {
      errorDetails.userMessage = customMessage;
    }

    // Add context-specific recovery actions
    this.enhanceErrorWithContext(errorDetails, context);

    // Log the error
    this.logError(errorDetails, {
      timestamp: new Date().toISOString(),
      ...context
    } as ErrorContext);

    return errorDetails;
  }

  /**
   * Enhances error with context-specific information and recovery actions
   */
  private enhanceErrorWithContext(error: ErrorDetails, context?: Partial<ErrorContext>): void {
    if (!context) return;

    // Add file-specific guidance
    if (context.filename) {
      const extension = context.filename.split('.').pop()?.toLowerCase();
      
      if (error.code === 'INVALID_FILE_FORMAT' && extension) {
        error.userMessage += ` (detected: .${extension})`;
        
        // Add format-specific troubleshooting
        if (!['stl', 'obj', 'ply'].includes(extension)) {
          error.troubleshootingSteps = [
            ...(error.troubleshootingSteps || []),
            {
              step: 3,
              title: 'Convert file format',
              description: `Convert your .${extension} file to STL, OBJ, or PLY format using 3D modeling software`,
              expected: 'File should have .stl, .obj, or .ply extension'
            }
          ];
        }
      }

      if (error.code === 'FILE_TOO_LARGE' && context.fileSize) {
        const sizeMB = Math.round(context.fileSize / (1024 * 1024));
        error.userMessage += ` (current: ${sizeMB}MB)`;
      }
    }

    // Add operation-specific recovery actions
    if (context.operation) {
      switch (context.operation) {
        case 'upload':
          if (error.code === 'NETWORK_ERROR') {
            error.recoveryActions = [
              { label: 'Retry Upload', action: 'retry' },
              { label: 'Try Smaller File', action: 'custom', data: { action: 'openFileDialog' } },
              ...(error.recoveryActions || [])
            ];
          }
          break;
        
        case 'submit':
          if (error.code === 'PRINT_SERVICE_ERROR') {
            error.recoveryActions = [
              { label: 'Retry Submission', action: 'retry' },
              { label: 'Check Job Status', action: 'navigate', target: `/3d-printing/job/${context.jobId}` },
              ...(error.recoveryActions || [])
            ];
          }
          break;
      }
    }

    // Add user-specific recovery actions
    if (context.userId) {
      if (error.code === 'STORAGE_QUOTA_EXCEEDED') {
        error.recoveryActions = [
          { label: 'Manage Files', action: 'navigate', target: '/3d-printing/history' },
          { label: 'View Storage Usage', action: 'navigate', target: '/account/storage' },
          ...(error.recoveryActions || [])
        ];
      }
    }
  }

  /**
   * Gets error severity level
   */
  getErrorSeverity(code: string): ErrorSeverity {
    return ERROR_SEVERITY_MAP[code] || ErrorSeverity.MEDIUM;
  }

  /**
   * Determines if an error should be retried automatically
   */
  shouldRetry(code: string, attemptCount: number = 0): boolean {
    const maxRetries = 3;
    const retryableErrors = [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'STORAGE_ERROR',
      'PRINT_SERVICE_UNAVAILABLE'
    ];

    return retryableErrors.includes(code) && attemptCount < maxRetries;
  }

  /**
   * Gets retry delay in milliseconds with exponential backoff
   */
  getRetryDelay(attemptCount: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attemptCount), maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return delay + jitter;
  }

  /**
   * Logs error for monitoring and analytics
   */
  private logError(error: ErrorDetails, context: ErrorContext): void {
    // Add to in-memory log (for development/debugging)
    this.errorLog.push({ error, context });

    // Keep only last 100 errors in memory
    if (this.errorLog.length > 100) {
      this.errorLog = this.errorLog.slice(-100);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('3D Printing Error:', {
        code: error.code,
        message: error.message,
        context,
        severity: this.getErrorSeverity(error.code)
      });
    }

    // In production, you would send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoring(error, context);
    }
  }

  /**
   * Sends error to monitoring service (placeholder for production implementation)
   */
  private async sendToMonitoring(error: ErrorDetails, context: ErrorContext): Promise<void> {
    try {
      // This would integrate with your monitoring service (e.g., Sentry, DataDog, etc.)
      // For now, we'll just log critical errors
      const severity = this.getErrorSeverity(error.code);
      
      if (severity === ErrorSeverity.CRITICAL || severity === ErrorSeverity.HIGH) {
        console.error('CRITICAL ERROR - 3D Printing Service:', {
          error,
          context,
          severity,
          timestamp: new Date().toISOString()
        });

        // You could also send to external monitoring service here
        // await monitoringService.reportError(error, context);
      }
    } catch (monitoringError) {
      console.error('Failed to send error to monitoring:', monitoringError);
    }
  }

  /**
   * Gets recent errors for debugging (development only)
   */
  getRecentErrors(count: number = 10): Array<{ error: ErrorDetails; context: ErrorContext }> {
    if (process.env.NODE_ENV !== 'development') {
      return [];
    }
    return this.errorLog.slice(-count);
  }

  /**
   * Clears error log (development only)
   */
  clearErrorLog(): void {
    if (process.env.NODE_ENV === 'development') {
      this.errorLog = [];
    }
  }

  /**
   * Creates user-friendly error message with recovery suggestions
   */
  formatUserError(error: ErrorDetails): {
    title: string;
    message: string;
    actions: RecoveryAction[];
    troubleshooting?: TroubleshootingStep[];
    severity: ErrorSeverity;
  } {
    const severity = this.getErrorSeverity(error.code);
    
    let title = 'Error';
    switch (severity) {
      case ErrorSeverity.LOW:
        title = 'Minor Issue';
        break;
      case ErrorSeverity.MEDIUM:
        title = 'Action Required';
        break;
      case ErrorSeverity.HIGH:
        title = 'Upload Failed';
        break;
      case ErrorSeverity.CRITICAL:
        title = 'System Error';
        break;
    }

    return {
      title,
      message: error.userMessage || error.message,
      actions: error.recoveryActions || [],
      troubleshooting: error.troubleshootingSteps,
      severity
    };
  }

  /**
   * Validates file before upload and returns potential issues
   */
  validateFilePreUpload(file: File): ErrorDetails | null {
    // Check file existence
    if (!file) {
      return this.createError('MISSING_FILE');
    }

    // Check file size
    if (file.size === 0) {
      return this.createError('EMPTY_FILE');
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      return this.createError('FILE_TOO_LARGE', undefined, {
        filename: file.name,
        fileSize: file.size
      });
    }

    // Check file format
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !['stl', 'obj', 'ply'].includes(extension)) {
      return this.createError('INVALID_FILE_FORMAT', undefined, {
        filename: file.name
      });
    }

    return null; // No errors found
  }

  /**
   * Handles API response errors and converts them to standardized format
   */
  handleApiError(response: Response, operation?: string): ErrorDetails {
    let code = 'INTERNAL_ERROR';
    
    switch (response.status) {
      case 400:
        code = 'VALIDATION_FAILED';
        break;
      case 401:
        code = 'UNAUTHORIZED';
        break;
      case 403:
        code = 'ACCESS_DENIED';
        break;
      case 404:
        code = 'JOB_NOT_FOUND';
        break;
      case 413:
        code = 'STORAGE_QUOTA_EXCEEDED';
        break;
      case 429:
        code = 'RATE_LIMIT_EXCEEDED';
        break;
      case 500:
        code = 'INTERNAL_ERROR';
        break;
      case 503:
        code = 'PRINT_SERVICE_UNAVAILABLE';
        break;
      default:
        code = 'NETWORK_ERROR';
    }

    return this.createError(code, `HTTP ${response.status}: ${response.statusText}`, {
      operation
    });
  }
}

// Export singleton instance
export const errorHandler = ErrorHandlingService.getInstance();

// Utility functions for common error scenarios
export const createUploadError = (code: string, file?: File, originalError?: Error) => {
  return errorHandler.createError(code, originalError, {
    filename: file?.name,
    fileSize: file?.size,
    operation: 'upload'
  });
};

export const createPrintServiceError = (code: string, jobId?: string, originalError?: Error) => {
  return errorHandler.createError(code, originalError, {
    jobId,
    operation: 'submit'
  });
};

export const createValidationError = (issues: string[], filename?: string) => {
  const message = `Model validation failed: ${issues.join(', ')}`;
  return errorHandler.createError('VALIDATION_FAILED', message, {
    filename,
    operation: 'validation'
  });
};