// Webhook endpoint for receiving print job status updates
import { NextRequest, NextResponse } from 'next/server';
import { WebhookService } from '@/lib/services/webhook-service';
import { DirectPrintDatabase } from '@/lib/services/direct-print-database';
import { WebhookPayload } from '@/lib/types/direct-print-jobs';

export async function POST(request: NextRequest) {
  try {
    // Parse the webhook payload
    const body = await request.text();
    let payload: WebhookPayload;
    
    try {
      payload = JSON.parse(body);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Validate the event type
    if (payload.event !== 'job_status_update') {
      return NextResponse.json(
        { error: 'Invalid event type' },
        { status: 400 }
      );
    }

    // Verify webhook signature if secret is configured
    const signature = request.headers.get('x-print-service-signature');
    const webhookSecret = process.env.WEBHOOK_SECRET;
    
    if (webhookSecret && signature) {
      const isValid = WebhookService.verifySignature(body, signature, webhookSecret);
      if (!isValid) {
        console.warn('⚠️  Invalid webhook signature received');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // Log the webhook receipt
    console.log(`📥 Webhook received: Job ${payload.job_id} → ${payload.status}`);

    // Update the job status in our database (optional - for sync)
    const database = new DirectPrintDatabase();
    
    try {
      // Verify the job exists and update its status
      const existingJob = await database.getJob(payload.job_id);
      
      if (existingJob) {
        await database.updateJobStatus({
          jobId: payload.job_id,
          status: payload.status,
          errorMessage: payload.job.error_message,
          printServiceResponse: payload.job.print_service_response
        });
        
        console.log(`✅ Job ${payload.job_id} status updated to ${payload.status}`);
      } else {
        console.warn(`⚠️  Job ${payload.job_id} not found in database`);
      }
    } catch (dbError) {
      console.error('❌ Error updating job status:', dbError);
      // Don't fail the webhook for database errors
    }

    // Emit real-time update to connected clients (if using WebSockets/SSE)
    // This is where you would integrate with your real-time system
    // Example: io.emit('job-status-update', payload);

    // Broadcast to Supabase Realtime (if using Supabase Realtime)
    // The database update above will automatically trigger Supabase Realtime events

    return NextResponse.json({ 
      received: true,
      job_id: payload.job_id,
      status: payload.status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle other HTTP methods
export async function GET() {
  return NextResponse.json(
    { 
      message: 'Print status webhook endpoint',
      methods: ['POST'],
      description: 'Receives job status updates from the print service'
    },
    { status: 200 }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Print-Service-Event, X-Print-Service-Signature'
    }
  });
}