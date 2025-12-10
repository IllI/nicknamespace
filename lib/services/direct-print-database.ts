// Database service for Direct 3D Model Printing Jobs
import { createClient } from '@supabase/supabase-js';
import { 
  DirectPrintJob, 
  DirectPrintJobStatus, 
  ModelMetadata, 
  PrintSettings,
  StorageUsage,
  UploadQuotaCheck,
  CreateJobParams,
  UpdateJobStatusParams
} from '@/lib/types/direct-print-jobs';

export class DirectPrintDatabase {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  /**
   * Create a new direct print job record
   */
  async createJob(params: CreateJobParams): Promise<DirectPrintJob> {
    const { data, error } = await this.supabase
      .from('direct_print_jobs')
      .insert({
        user_id: params.userId,
        filename: params.filename,
        storage_path: params.storagePath,
        file_size_bytes: params.fileSizeBytes,
        model_metadata: params.modelMetadata,
        print_settings: params.printSettings || {},
        webhook_url: params.webhookUrl,
        printer_ip: process.env.DEFAULT_PRINTER_IP || '192.168.1.129',
        printer_serial: process.env.DEFAULT_PRINTER_SERIAL || '01P09A3A1800831',
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create job: ${error.message}`);
    }

    return data;
  }

  /**
   * Update job status with automatic timestamp tracking
   */
  async updateJobStatus(params: UpdateJobStatusParams): Promise<void> {
    const { error } = await this.supabase.rpc('update_direct_print_job_status', {
      p_job_id: params.jobId,
      p_status: params.status,
      p_error_message: params.errorMessage || null,
      p_print_service_response: params.printServiceResponse || null
    });

    if (error) {
      throw new Error(`Failed to update job status: ${error.message}`);
    }
  }

  /**
   * Get a specific job by ID (user must own the job)
   */
  async getJob(jobId: string): Promise<DirectPrintJob | null> {
    const { data, error } = await this.supabase
      .from('direct_print_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Job not found
      }
      throw new Error(`Failed to get job: ${error.message}`);
    }

    return data;
  }

  /**
   * Get user's job history with pagination and filtering
   */
  async getUserJobs(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: DirectPrintJobStatus;
      orderBy?: 'created_at' | 'submitted_at' | 'completed_at';
      orderDirection?: 'asc' | 'desc';
    } = {}
  ): Promise<{ jobs: DirectPrintJob[]; totalCount: number }> {
    const {
      limit = 20,
      offset = 0,
      status,
      orderBy = 'created_at',
      orderDirection = 'desc'
    } = options;

    let query = this.supabase
      .from('direct_print_jobs')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (status) {
      query = query.eq('status', status);
    }

    query = query
      .order(orderBy, { ascending: orderDirection === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to get user jobs: ${error.message}`);
    }

    return {
      jobs: data || [],
      totalCount: count || 0
    };
  }

  /**
   * Get active jobs for a user (jobs that are currently processing)
   */
  async getActiveJobs(userId: string): Promise<DirectPrintJob[]> {
    const { data, error } = await this.supabase
      .from('direct_print_jobs')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'downloading', 'slicing', 'uploading', 'printing'])
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get active jobs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get user's storage usage statistics
   */
  async getUserStorageUsage(userId: string): Promise<StorageUsage> {
    const { data, error } = await this.supabase.rpc('get_user_direct_print_storage_usage', {
      p_user_id: userId
    });

    if (error) {
      throw new Error(`Failed to get storage usage: ${error.message}`);
    }

    return data[0] || {
      total_files: 0,
      total_size_bytes: 0,
      active_jobs: 0,
      completed_jobs: 0,
      failed_jobs: 0
    };
  }

  /**
   * Check if user can upload a file (quota enforcement)
   */
  async checkUploadQuota(userId: string, fileSizeBytes: number): Promise<UploadQuotaCheck> {
    const { data, error } = await this.supabase.rpc('check_direct_print_upload_quota', {
      p_user_id: userId,
      p_file_size_bytes: fileSizeBytes
    });

    if (error) {
      throw new Error(`Failed to check upload quota: ${error.message}`);
    }

    return data[0] || {
      can_upload: false,
      current_usage_bytes: 0,
      quota_limit_bytes: 0,
      reason: 'Unknown error'
    };
  }

  /**
   * Delete a job and its associated files (user must own the job)
   */
  async deleteJob(jobId: string): Promise<void> {
    const { error } = await this.supabase
      .from('direct_print_jobs')
      .delete()
      .eq('id', jobId);

    if (error) {
      throw new Error(`Failed to delete job: ${error.message}`);
    }
  }

  /**
   * Get jobs that need cleanup (failed jobs older than 7 days)
   */
  async getJobsForCleanup(): Promise<DirectPrintJob[]> {
    const { data, error } = await this.supabase
      .from('direct_print_jobs')
      .select('*')
      .eq('status', 'cleanup_pending')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get cleanup jobs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Mark failed jobs for cleanup (called by cron job)
   */
  async markFailedJobsForCleanup(): Promise<void> {
    const { error } = await this.supabase.rpc('cleanup_failed_direct_print_jobs');

    if (error) {
      throw new Error(`Failed to mark jobs for cleanup: ${error.message}`);
    }
  }

  /**
   * Subscribe to real-time job status updates
   */
  subscribeToJobUpdates(
    jobId: string,
    callback: (job: DirectPrintJob) => void
  ) {
    const subscription = this.supabase
      .channel(`direct_print_job_${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_print_jobs',
          filter: `id=eq.${jobId}`
        },
        (payload) => {
          callback(payload.new as DirectPrintJob);
        }
      )
      .subscribe();

    return subscription;
  }

  /**
   * Subscribe to all job updates for a user
   */
  subscribeToUserJobUpdates(
    userId: string,
    callback: (job: DirectPrintJob, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void
  ) {
    const subscription = this.supabase
      .channel(`user_direct_print_jobs_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_print_jobs',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
          const job = (payload.new || payload.old) as DirectPrintJob;
          callback(job, eventType);
        }
      )
      .subscribe();

    return subscription;
  }

  /**
   * Unsubscribe from real-time updates
   */
  unsubscribe(subscription: any) {
    this.supabase.removeChannel(subscription);
  }

  /**
   * Record a webhook attempt
   */
  async recordWebhookAttempt(jobId: string, success: boolean = false): Promise<void> {
    const { error } = await this.supabase.rpc('record_webhook_attempt', {
      p_job_id: jobId,
      p_success: success
    });

    if (error) {
      throw new Error(`Failed to record webhook attempt: ${error.message}`);
    }
  }

  /**
   * Get jobs that need webhook notifications
   */
  async getJobsNeedingWebhookNotification(): Promise<DirectPrintJob[]> {
    const { data, error } = await this.supabase.rpc('get_jobs_needing_webhook_notification');

    if (error) {
      throw new Error(`Failed to get jobs needing webhook notification: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update webhook URL for a job
   */
  async updateWebhookUrl(jobId: string, webhookUrl: string): Promise<void> {
    const { error } = await this.supabase
      .from('direct_print_jobs')
      .update({ webhook_url: webhookUrl })
      .eq('id', jobId);

    if (error) {
      throw new Error(`Failed to update webhook URL: ${error.message}`);
    }
  }
}