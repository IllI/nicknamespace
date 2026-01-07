import {
  PrintJobRequest,
  PrintJobResponse,
  PrintServiceError,
  HealthStatus
} from '@/lib/types/direct-print-jobs';

export class PrintServiceClient {
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;

  constructor() {
    this.baseUrl = process.env.PRINT_SERVICE_URL || 'http://localhost:4141';
    this.timeout = 30000; // 30 seconds
    this.maxRetries = 3;
  }

  /**
   * Submit a print job to the OrcaSlicer service
   */
  async submitPrintJob(jobData: PrintJobRequest): Promise<PrintJobResponse> {
    const url = `${this.baseUrl}/api/print-job`;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(jobData),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new PrintServiceError(
            errorData.message || `HTTP ${response.status}: ${response.statusText}`,
            errorData.code || 'HTTP_ERROR',
            response.status
          );
        }

        const result = await response.json();
        return {
          success: true,
          job_id: jobData.job_id,
          message: result.message || 'Job submitted successfully',
          print_service_response: result
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt < this.maxRetries) {
          // Exponential backoff: wait 2^attempt seconds
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Print service attempt ${attempt} failed, retrying in ${delay}ms:`, error);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    throw new PrintServiceError(
      `Failed to submit job after ${this.maxRetries} attempts: ${lastError?.message}`,
      'MAX_RETRIES_EXCEEDED',
      503
    );
  }

  /**
   * Check the health status of the print service
   */
  async checkServiceHealth(): Promise<HealthStatus> {
    try {
      const url = `${this.baseUrl}/api/health`;
      const response = await this.makeRequest(url, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          status: 'healthy',
          message: data.message || 'Service is healthy',
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          status: 'unhealthy',
          message: `HTTP ${response.status}: ${response.statusText}`,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get job status from print service
   */
  async getJobStatus(jobId: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/api/job-status/${jobId}`;
      const response = await this.makeRequest(url, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new PrintServiceError(
          `Failed to get job status: HTTP ${response.status}`,
          'STATUS_REQUEST_FAILED',
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Cancel a print job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/api/cancel-job/${jobId}`;
      const response = await this.makeRequest(url, {
        method: 'POST',
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to cancel job:', error);
      return false;
    }
  }

  /**
   * Make HTTP request with timeout
   */
  private async makeRequest(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handle and normalize API errors
   */
  private handleApiError(error: any): PrintServiceError {
    if (error instanceof PrintServiceError) {
      return error;
    }

    if (error.name === 'AbortError') {
      return new PrintServiceError(
        'Request timeout',
        'TIMEOUT',
        408
      );
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new PrintServiceError(
        'Print service unavailable',
        'SERVICE_UNAVAILABLE',
        503
      );
    }

    return new PrintServiceError(
      error.message || 'Unknown print service error',
      'UNKNOWN_ERROR',
      500
    );
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Error class for print service specific errors
export class PrintServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'PrintServiceError';
  }
}

// Singleton instance for reuse
export const printServiceClient = new PrintServiceClient();