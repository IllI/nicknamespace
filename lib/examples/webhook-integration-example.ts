// Example: Complete webhook integration for Direct 3D Model Printing Service
import { DirectPrintDatabase } from '@/lib/services/direct-print-database';
import { WebhookService } from '@/lib/services/webhook-service';
import { generateWebhookUrl, isValidWebhookUrl } from '@/lib/utils/webhook-utils';
import { DirectPrintJob, CreateJobParams } from '@/lib/types/direct-print-jobs';

/**
 * Example: Complete workflow with webhook integration
 */
export class DirectPrintWorkflowExample {
  private database: DirectPrintDatabase;
  private webhookService: WebhookService;

  constructor() {
    this.database = new DirectPrintDatabase();
    this.webhookService = new WebhookService();
  }

  /**
   * Example 1: Submit a print job with webhook notifications
   */
  async submitPrintJobWithWebhook(
    userId: string,
    filename: string,
    storagePath: string,
    fileSizeBytes: number,
    customWebhookUrl?: string
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      // Generate webhook URL (use custom or default)
      const webhookUrl = customWebhookUrl || generateWebhookUrl();
      
      // Validate webhook URL
      if (!isValidWebhookUrl(webhookUrl)) {
        return { success: false, error: 'Invalid webhook URL' };
      }

      // Create job parameters
      const jobParams: CreateJobParams = {
        userId,
        filename,
        storagePath,
        fileSizeBytes,
        modelMetadata: {
          format: 'stl',
          vertices: 0, // Will be populated after validation
          faces: 0,
          dimensions: { x: 0, y: 0, z: 0 },
          fileSize: fileSizeBytes,
          isValid: true,
          validationIssues: [],
          fitsInBuildVolume: true,
          uploadedAt: new Date().toISOString()
        },
        printSettings: {
          material: 'PLA',
          quality: 'standard',
          infill: 20,
          supports: false,
          layerHeight: 0.2,
          printSpeed: 50,
          bedTemperature: 60,
          nozzleTemperature: 200
        },
        webhookUrl // Include webhook URL
      };

      // Create the job in database
      const job = await this.database.createJob(jobParams);

      // Send initial webhook notification (job created)
      await this.webhookService.sendJobStatusUpdate(job);

      console.log(`✅ Print job created with webhook: ${job.id}`);
      console.log(`📡 Webhook URL: ${webhookUrl}`);

      return { success: true, jobId: job.id };

    } catch (error) {
      console.error('❌ Error submitting print job:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Example 2: Update job status and send webhook notification
   */
  async updateJobStatusWithWebhook(
    jobId: string,
    newStatus: DirectPrintJob['status'],
    errorMessage?: string
  ): Promise<boolean> {
    try {
      // Update job status in database
      await this.database.updateJobStatus({
        jobId,
        status: newStatus,
        errorMessage
      });

      // Get updated job
      const updatedJob = await this.database.getJob(jobId);
      if (!updatedJob) {
        console.error(`❌ Job ${jobId} not found after update`);
        return false;
      }

      // Send webhook notification
      const webhookSent = await this.webhookService.sendJobStatusUpdate(updatedJob);
      
      if (webhookSent) {
        console.log(`✅ Job ${jobId} updated to ${newStatus} with webhook notification`);
      } else {
        console.warn(`⚠️  Job ${jobId} updated to ${newStatus} but webhook failed`);
      }

      return true;

    } catch (error) {
      console.error(`❌ Error updating job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Example 3: Process a complete print job lifecycle with webhooks
   */
  async simulatePrintJobLifecycle(jobId: string): Promise<void> {
    const statuses: DirectPrintJob['status'][] = [
      'downloading',
      'slicing', 
      'uploading',
      'printing',
      'complete'
    ];

    console.log(`🚀 Starting print job lifecycle simulation for ${jobId}`);

    for (const status of statuses) {
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update status with webhook
      await this.updateJobStatusWithWebhook(jobId, status);
      
      console.log(`📊 Job ${jobId} → ${status}`);
    }

    console.log(`🎉 Print job lifecycle completed for ${jobId}`);
  }

  /**
   * Example 4: Handle webhook failures and retries
   */
  async handleFailedWebhooks(): Promise<void> {
    try {
      // Get jobs that need webhook notifications
      const jobs = await this.database.getJobsNeedingWebhookNotification();
      
      if (jobs.length === 0) {
        console.log('📭 No pending webhook notifications');
        return;
      }

      console.log(`📤 Processing ${jobs.length} failed webhook notifications`);

      for (const job of jobs) {
        const attempts = job.webhook_attempts || 0;
        console.log(`🔄 Retrying webhook for job ${job.id} (attempt ${attempts + 1}/3)`);
        
        const success = await this.webhookService.sendJobStatusUpdate(job);
        
        if (success) {
          console.log(`✅ Webhook retry successful for job ${job.id}`);
        } else {
          console.log(`❌ Webhook retry failed for job ${job.id}`);
        }
      }

    } catch (error) {
      console.error('❌ Error handling failed webhooks:', error);
    }
  }

  /**
   * Example 5: Test webhook endpoint
   */
  async testWebhookEndpoint(webhookUrl: string): Promise<boolean> {
    try {
      console.log(`🧪 Testing webhook endpoint: ${webhookUrl}`);
      
      const result = await this.webhookService.testWebhook(webhookUrl);
      
      if (result.success) {
        console.log(`✅ Webhook test successful`);
        return true;
      } else {
        console.log(`❌ Webhook test failed: ${result.error}`);
        return false;
      }

    } catch (error) {
      console.error('❌ Webhook test error:', error);
      return false;
    }
  }

  /**
   * Example 6: Subscribe to real-time job updates
   */
  subscribeToJobUpdates(jobId: string, onUpdate: (job: DirectPrintJob) => void) {
    console.log(`👂 Subscribing to real-time updates for job ${jobId}`);
    
    return this.database.subscribeToJobUpdates(jobId, (job) => {
      console.log(`📡 Real-time update: Job ${job.id} → ${job.status}`);
      onUpdate(job);
    });
  }

  /**
   * Example 7: Complete integration example
   */
  async completeWorkflowExample(): Promise<void> {
    try {
      console.log('🚀 Starting complete webhook workflow example...\n');

      // 1. Test webhook endpoint first
      const webhookUrl = generateWebhookUrl();
      const isEndpointWorking = await this.testWebhookEndpoint(webhookUrl);
      
      if (!isEndpointWorking) {
        console.log('⚠️  Webhook endpoint not responding, continuing without webhooks');
      }

      // 2. Submit a print job with webhook
      const result = await this.submitPrintJobWithWebhook(
        'example-user-id',
        'example-model.stl',
        'uploads/example-model.stl',
        1024 * 1024 // 1MB
      );

      if (!result.success || !result.jobId) {
        console.error('❌ Failed to submit print job');
        return;
      }

      // 3. Subscribe to real-time updates
      const subscription = this.subscribeToJobUpdates(result.jobId, (job) => {
        console.log(`📱 UI Update: ${job.filename} is now ${job.status}`);
      });

      // 4. Simulate the print job lifecycle
      await this.simulatePrintJobLifecycle(result.jobId);

      // 5. Clean up subscription
      this.database.unsubscribe(subscription);

      console.log('\n🎉 Complete workflow example finished!');

    } catch (error) {
      console.error('❌ Workflow example error:', error);
    }
  }
}

/**
 * Usage examples
 */
export async function runWebhookExamples() {
  const workflow = new DirectPrintWorkflowExample();

  // Run the complete workflow example
  await workflow.completeWorkflowExample();

  // Or run individual examples:
  
  // Test webhook endpoint
  // await workflow.testWebhookEndpoint('https://your-app.com/api/webhooks/print-status');
  
  // Handle failed webhooks (run this periodically)
  // await workflow.handleFailedWebhooks();
  
  // Submit job with custom webhook
  // await workflow.submitPrintJobWithWebhook(
  //   'user-123',
  //   'model.stl', 
  //   'uploads/model.stl',
  //   2048000,
  //   'https://custom-webhook.com/print-status'
  // );
}

// Export for use in other files
export default DirectPrintWorkflowExample;