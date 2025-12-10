// Job Status Synchronization Service for Direct 3D Model Printing
import { DirectPrintDatabase } from './direct-print-database';
import { PrintServiceClient } from './print-service-client';
import { WebhookService } from './webhook-service';
import { 
  DirectPrintJob, 
  DirectPrintJobStatus, 
  UpdateJobStatusParams 
} from '@/lib/types/direct-print-jobs';

interface PollingJob {
  jobId: string;
  lastChecked: Date;
  retryCount: number;
  maxRetries: number;
}

export class JobStatusSynchronizer {
  private database: DirectPrintDatabase;
  private printService: PrintServiceClient;
  private webhookService: WebhookService;
  private pollingJobs: Map<string, PollingJob>;
  private pollingInterval: NodeJS.Timeout | null;
  private isRunning: boolean;
  private readonly POLL_INTERVAL_MS: number;
  private readonly MAX_RETRIES: number;
  private readonly CLEANUP_INTERVAL_MS: number;

  constructor() {
    this.database = new DirectPrintDatabase();
    this.printService = new PrintServiceClient();
    this.webhookService = new WebhookService();
    this.pollingJobs = new Map();
    this.pollingInterval = null;
    this.isRunning = false;
    
    // Configuration
    this.POLL_INTERVAL_MS = 30000; // 30 seconds
    this.MAX_RETRIES = 5;
    this.CLEANUP_INTERVAL_MS = 300000; // 5 minutes
  }

  /**
   * Start the status synchronization service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('📊 Job status synchronizer is already running');
      return;
    }

    console.log('🚀 Starting job status synchronizer...');
    this.isRunning = true;

    // Load existing active jobs into polling queue
    await this.loadActiveJobs();

    // Start polling loop
    this.pollingInterval = setInterval(async () => {
      await this.pollJobStatuses();
    }, this.POLL_INTERVAL_MS);

    // Start cleanup loop
    setInterval(async () => {
      await this.cleanupCompletedJobs();
    }, this.CLEANUP_INTERVAL_MS);

    console.log(`✅ Job status synchronizer started (polling every ${this.POLL_INTERVAL_MS}ms)`);
  }

  /**
   * Stop the status synchronization service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping job status synchronizer...');
    this.isRunning = false;

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    this.pollingJobs.clear();
    console.log('✅ Job status synchronizer stopped');
  }

  /**
   * Add a job to the polling queue
   */
  addJobToPolling(jobId: string): void {
    if (this.pollingJobs.has(jobId)) {
      return; // Already being polled
    }

    const pollingJob: PollingJob = {
      jobId,
      lastChecked: new Date(),
      retryCount: 0,
      maxRetries: this.MAX_RETRIES
    };

    this.pollingJobs.set(jobId, pollingJob);
    console.log(`📋 Added job ${jobId} to polling queue`);
  }

  /**
   * Remove a job from the polling queue
   */
  removeJobFromPolling(jobId: string): void {
    if (this.pollingJobs.delete(jobId)) {
      console.log(`🗑️  Removed job ${jobId} from polling queue`);
    }
  }

  /**
   * Load all active jobs from database into polling queue
   */
  private async loadActiveJobs(): Promise<void> {
    try {
      // Get all active jobs from all users (admin operation)
      const { data: activeJobs, error } = await this.database['supabase']
        .from('direct_print_jobs')
        .select('id')
        .in('status', ['pending', 'downloading', 'slicing', 'uploading', 'printing']);

      if (error) {
        throw new Error(`Failed to load active jobs: ${error.message}`);
      }

      for (const job of activeJobs || []) {
        this.addJobToPolling(job.id);
      }

      console.log(`📊 Loaded ${activeJobs?.length || 0} active jobs for polling`);
    } catch (error) {
      console.error('❌ Error loading active jobs:', error);
    }
  }

  /**
   * Poll all jobs in the queue for status updates
   */
  private async pollJobStatuses(): Promise<void> {
    if (this.pollingJobs.size === 0) {
      return;
    }

    console.log(`🔄 Polling ${this.pollingJobs.size} jobs for status updates...`);

    const pollingPromises = Array.from(this.pollingJobs.values()).map(
      pollingJob => this.pollSingleJob(pollingJob)
    );

    // Process all jobs concurrently but with error isolation
    await Promise.allSettled(pollingPromises);
  }

  /**
   * Poll a single job for status updates
   */
  private async pollSingleJob(pollingJob: PollingJob): Promise<void> {
    try {
      // Get current job status from print service
      const serviceStatus = await this.printService.getJobStatus(pollingJob.jobId);
      
      // Get current job from database
      const currentJob = await this.database.getJob(pollingJob.jobId);
      
      if (!currentJob) {
        console.warn(`⚠️  Job ${pollingJob.jobId} not found in database, removing from polling`);
        this.removeJobFromPolling(pollingJob.jobId);
        return;
      }

      // Map print service status to our status enum
      const newStatus = this.mapPrintServiceStatus(serviceStatus.status);
      
      // Check if status has changed
      if (newStatus !== currentJob.status) {
        console.log(`📈 Job ${pollingJob.jobId} status changed: ${currentJob.status} → ${newStatus}`);
        
        // Update job status in database
        await this.updateJobFromPrintService(pollingJob.jobId, serviceStatus);
        
        // Send webhook notification if configured
        const updatedJob = await this.database.getJob(pollingJob.jobId);
        if (updatedJob && updatedJob.webhook_url) {
          await this.webhookService.sendJobStatusUpdate(updatedJob);
        }
      }

      // Update polling job metadata
      pollingJob.lastChecked = new Date();
      pollingJob.retryCount = 0; // Reset retry count on successful poll

      // Remove completed jobs from polling
      if (this.isTerminalStatus(newStatus)) {
        this.removeJobFromPolling(pollingJob.jobId);
      }

    } catch (error) {
      console.error(`❌ Error polling job ${pollingJob.jobId}:`, error);
      
      pollingJob.retryCount++;
      
      if (pollingJob.retryCount >= pollingJob.maxRetries) {
        console.error(`💀 Max retries exceeded for job ${pollingJob.jobId}, removing from polling`);
        this.removeJobFromPolling(pollingJob.jobId);
        
        // Mark job as failed due to sync issues
        try {
          await this.database.updateJobStatus({
            jobId: pollingJob.jobId,
            status: 'failed',
            errorMessage: `Status sync failed after ${pollingJob.maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        } catch (updateError) {
          console.error(`❌ Failed to mark job as failed:`, updateError);
        }
      }
    }
  }

  /**
   * Update job status from print service response
   */
  async updateJobFromPrintService(jobId: string, serviceResponse: any): Promise<void> {
    const status = this.mapPrintServiceStatus(serviceResponse.status);
    
    const updateParams: UpdateJobStatusParams = {
      jobId,
      status,
      printServiceResponse: serviceResponse
    };

    // Add error message if job failed
    if (status === 'failed' && serviceResponse.error) {
      updateParams.errorMessage = serviceResponse.error;
    }

    await this.database.updateJobStatus(updateParams);
  }

  /**
   * Map print service status to our internal status enum
   */
  private mapPrintServiceStatus(serviceStatus: string): DirectPrintJobStatus {
    const statusMap: Record<string, DirectPrintJobStatus> = {
      'pending': 'pending',
      'queued': 'pending',
      'downloading': 'downloading',
      'download': 'downloading',
      'slicing': 'slicing',
      'slice': 'slicing',
      'uploading': 'uploading',
      'upload': 'uploading',
      'printing': 'printing',
      'print': 'printing',
      'completed': 'complete',
      'complete': 'complete',
      'finished': 'complete',
      'success': 'complete',
      'failed': 'failed',
      'error': 'failed',
      'cancelled': 'failed',
      'canceled': 'failed'
    };

    const normalizedStatus = serviceStatus.toLowerCase();
    return statusMap[normalizedStatus] || 'failed';
  }

  /**
   * Check if a status is terminal (job won't change anymore)
   */
  private isTerminalStatus(status: DirectPrintJobStatus): boolean {
    return ['complete', 'failed', 'cleanup_pending'].includes(status);
  }

  /**
   * Clean up completed jobs from polling queue
   */
  private async cleanupCompletedJobs(): Promise<void> {
    const completedJobs: string[] = [];

    for (const [jobId, pollingJob] of Array.from(this.pollingJobs.entries())) {
      try {
        const job = await this.database.getJob(jobId);
        
        if (!job || this.isTerminalStatus(job.status)) {
          completedJobs.push(jobId);
        }
      } catch (error) {
        console.error(`❌ Error checking job ${jobId} for cleanup:`, error);
        // Remove problematic jobs from polling
        completedJobs.push(jobId);
      }
    }

    for (const jobId of completedJobs) {
      this.removeJobFromPolling(jobId);
    }

    if (completedJobs.length > 0) {
      console.log(`🧹 Cleaned up ${completedJobs.length} completed jobs from polling queue`);
    }
  }

  /**
   * Sync all active jobs immediately (manual trigger)
   */
  async syncAllActiveJobs(): Promise<void> {
    console.log('🔄 Manual sync of all active jobs triggered');
    
    await this.loadActiveJobs();
    await this.pollJobStatuses();
    
    console.log('✅ Manual sync completed');
  }

  /**
   * Get current polling statistics
   */
  getPollingStats(): {
    activeJobs: number;
    isRunning: boolean;
    pollInterval: number;
    jobs: Array<{
      jobId: string;
      lastChecked: string;
      retryCount: number;
    }>;
  } {
    return {
      activeJobs: this.pollingJobs.size,
      isRunning: this.isRunning,
      pollInterval: this.POLL_INTERVAL_MS,
      jobs: Array.from(this.pollingJobs.values()).map(job => ({
        jobId: job.jobId,
        lastChecked: job.lastChecked.toISOString(),
        retryCount: job.retryCount
      }))
    };
  }

  /**
   * Force sync a specific job
   */
  async forceSyncJob(jobId: string): Promise<void> {
    console.log(`🎯 Force syncing job ${jobId}`);
    
    const pollingJob: PollingJob = {
      jobId,
      lastChecked: new Date(),
      retryCount: 0,
      maxRetries: this.MAX_RETRIES
    };

    await this.pollSingleJob(pollingJob);
    console.log(`✅ Force sync completed for job ${jobId}`);
  }
}

// Singleton instance for global use
export const jobStatusSynchronizer = new JobStatusSynchronizer();

// Auto-start in production environments
if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
  // Only start in server-side production environment
  jobStatusSynchronizer.start().catch(error => {
    console.error('❌ Failed to start job status synchronizer:', error);
  });
}