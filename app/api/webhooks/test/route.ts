// API endpoint for testing webhook functionality
import { NextRequest, NextResponse } from 'next/server';
import { WebhookService } from '@/lib/services/webhook-service';

export async function POST(request: NextRequest) {
  try {
    const { webhook_url } = await request.json();

    if (!webhook_url) {
      return NextResponse.json(
        { error: 'webhook_url is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(webhook_url);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid webhook URL format' },
        { status: 400 }
      );
    }

    const webhookService = new WebhookService();
    const result = await webhookService.testWebhook(webhook_url);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Webhook test successful',
        url: webhook_url,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Webhook test failed',
        error: result.error,
        url: webhook_url,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Webhook test error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Webhook test endpoint',
    usage: 'POST with { "webhook_url": "https://your-app.com/api/webhooks/print-status" }',
    description: 'Tests webhook delivery by sending a test payload'
  });
}