// Webhook service for Direct 3D Model Printing Jobs
import { DirectPrintJob, WebhookPayload, WebhookHeaders, WebhookAttempt } from '@/lib/types/direct-print-jobs';
import { DirectPrintDatabase } from './direct-print-database';
import crypto from 'crypto';

export class WebhookService {
  private database: DirectPrintDatabase;
  private webhookSecret?: string;

  constructor() {
    this.database = new DirectPrintDatabase();
    this.webhookSecret = process.env.WEBHOOK_SECRET;
  }

  /**
   * Send webhook notification for job status update
   */
  async sendJobStatusUpdate(job: DirectPrintJob): Promise<boolean> {
    if (!job.webhook_url) {
      return false; // No webhook URL configured
    }

    const payload: WebhookPayload = {
      event: 'job_status_update',
      job_id: job.id,
      status: job.status,
      timestamp: new Date().toISOString(),
      job: job
    };

    const attempt: WebhookAttempt = {
      jobId: job.id,
      url: job.webhook_url,
      payload,
      attempt: (job.webhook_attempts || 0) + 1,
      success: false,
      timestamp: new Date().toISOString()
    };

    try {
      const success = await this.sendWebhook(job.webhook_url, payload);
      attempt.success = success;
      
      // Record the attempt in the database
      await this.database.recordWebhookAttempt(job.id, success);
      
      if (success) {
        console.log(`✅ Webhook notification sent for job ${job.id} → ${job.status}`);
      } else {
        console.log(`⚠️  Webhook notification failed for job ${job.id} (attempt ${attempt.attempt})`);
      }
      
      return success;
    } catch (error) {
      attempt.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Webhook error for job ${job.id}:`, error);
      
      // Record the failed attempt
      await this.database.recordWebhookAttempt(job.id, false);
      
      return false;
    }
  }

  /**
   * Send webhook HTTP request
   */
  private async sendWebhook(url: string, payload: WebhookPayload): Promise<boolean> {
    const headers: WebhookHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Direct-Print-Service/1.0.0',
      'X-Print-Service-Event': 'job-status-update'
    };

    // Add signature if webhook secret is configured
    if (this.webhookSecret) {
      const signature = this.generateSignature(payload, this.webhookSecret);
      headers['X-Print-Service-Signature'] = signature;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      // Consider 2xx responses as successful
      return response.ok;
    } catch (error) {
      // Network errors, timeouts, etc.
      return false;
    }
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: WebhookPayload, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(JSON.stringify(payload)).digest('hex');
    return `sha256=${digest}`;
  }

  /**
   * Verify webhook signature
   */
  static verifySignature(payload: string, signature: string, secret: string): boolean {
    try {
      const hmac = crypto.createHmac('sha256', secret);
      const digest = hmac.update(payload).digest('hex');
      const expectedSignature = `sha256=${digest}`;
      
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Process pending webhook notifications
   * This can be called by a cron job or background process
   */
  async processPendingWebhooks(): Promise<void> {
    try {
      const jobs = await this.database.getJobsNeedingWebhookNotification();
      
      if (jobs.length === 0) {
        return;
      }

      console.log(`📤 Processing ${jobs.length} pending webhook notifications`);

      for (const job of jobs) {
        await this.sendJobStatusUpdate(job);
        
        // Add small delay between requests to avoid overwhelming the target server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('❌ Error processing pending webhooks:', error);
    }
  }

  /**
   * Send webhook notification with retry logic
   */
  async sendWithRetry(job: DirectPrintJob, maxRetries: number = 3): Promise<boolean> {
    const currentAttempts = job.webhook_attempts || 0;
    
    if (currentAttempts >= maxRetries) {
      console.log(`⚠️  Max webhook attempts reached for job ${job.id}`);
      return false;
    }

    const success = await this.sendJobStatusUpdate(job);
    
    if (!success && currentAttempts < maxRetries - 1) {
      // Schedule retry with exponential backoff
      const delay = Math.pow(2, currentAttempts) * 1000; // 1s, 2s, 4s
      console.log(`🔄 Scheduling webhook retry for job ${job.id} in ${delay}ms`);
      
      setTimeout(async () => {
        const updatedJob = await this.database.getJob(job.id);
        if (updatedJob) {
          await this.sendWithRetry(updatedJob, maxRetries);
        }
      }, delay);
    }
    
    return success;
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(url: string): Promise<{ success: boolean; error?: string }> {
    const testPayload: WebhookPayload = {
      event: 'job_status_update',
      job_id: 'test-webhook-' + Date.now(),
      status: 'pending',
      timestamp: new Date().toISOString(),
      job: {
        id: 'test-webhook-' + Date.now(),
        user_id: 'test-user',
        filename: 'test.stl',
        storage_path: 'test/test.stl',
        file_size_bytes: 1024,
        status: 'pending',
        created_at: new Date().toISOString(),
        model_metadata: {
          format: 'stl',
          vertices: 100,
          faces: 50,
          dimensions: { x: 10, y: 10, z: 10 },
          fileSize: 1024,
          isValid: true,
          validationIssues: [],
          fitsInBuildVolume: true,
          uploadedAt: new Date().toISOString()
        },
        print_settings: {
          material: 'PLA',
          quality: 'standard',
          infill: 20,
          supports: false,
          layerHeight: 0.2,
          printSpeed: 50,
          bedTemperature: 60,
          nozzleTemperature: 200
        }
      }
    };

    try {
      const success = await this.sendWebhook(url, testPayload);
      return { success };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}