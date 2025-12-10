// Utility functions for webhook handling
import { WebhookPayload } from '@/lib/types/direct-print-jobs';

/**
 * Generate webhook URL for the current application
 */
export function generateWebhookUrl(path: string = '/api/webhooks/print-status'): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                  'http://localhost:3000';
  
  return `${baseUrl}${path}`;
}

/**
 * Validate webhook URL format
 */
export function isValidWebhookUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extract job ID from webhook payload
 */
export function extractJobId(payload: WebhookPayload): string | null {
  return payload.job_id || payload.job?.id || null;
}

/**
 * Check if webhook payload is valid
 */
export function isValidWebhookPayload(payload: any): payload is WebhookPayload {
  return (
    payload &&
    typeof payload === 'object' &&
    payload.event === 'job_status_update' &&
    typeof payload.job_id === 'string' &&
    typeof payload.status === 'string' &&
    typeof payload.timestamp === 'string' &&
    payload.job &&
    typeof payload.job === 'object'
  );
}

/**
 * Get webhook retry delay based on attempt number
 */
export function getRetryDelay(attempt: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, etc.
  return Math.min(Math.pow(2, attempt) * 1000, 30000); // Max 30 seconds
}

/**
 * Check if webhook should be retried based on HTTP status
 */
export function shouldRetryWebhook(status: number): boolean {
  // Retry on 5xx server errors and some 4xx client errors
  if (status >= 500) return true; // Server errors
  if (status === 408) return true; // Request timeout
  if (status === 429) return true; // Rate limited
  
  return false; // Don't retry on other 4xx errors (bad request, unauthorized, etc.)
}

/**
 * Format webhook error message
 */
export function formatWebhookError(error: any): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object') {
    return JSON.stringify(error);
  }
  
  return 'Unknown webhook error';
}

/**
 * Create webhook headers for outgoing requests
 */
export function createWebhookHeaders(signature?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Direct-Print-Service/1.0.0',
    'X-Print-Service-Event': 'job-status-update'
  };
  
  if (signature) {
    headers['X-Print-Service-Signature'] = signature;
  }
  
  return headers;
}

/**
 * Parse webhook URL from environment or request
 */
export function parseWebhookUrl(input?: string): string | null {
  if (!input) return null;
  
  // If it's a relative path, make it absolute
  if (input.startsWith('/')) {
    return generateWebhookUrl(input);
  }
  
  // If it's already a full URL, validate and return
  if (isValidWebhookUrl(input)) {
    return input;
  }
  
  return null;
}

/**
 * Get webhook configuration from environment
 */
export function getWebhookConfig() {
  return {
    secret: process.env.WEBHOOK_SECRET,
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '10000'),
    maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY || '1000'),
    defaultUrl: generateWebhookUrl()
  };
}

/**
 * Log webhook event for debugging
 */
export function logWebhookEvent(
  event: 'sent' | 'received' | 'failed' | 'retry',
  jobId: string,
  status?: string,
  error?: string
) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] Webhook ${event}: Job ${jobId}`;
  
  switch (event) {
    case 'sent':
      console.log(`✅ ${message} → ${status}`);
      break;
    case 'received':
      console.log(`📥 ${message} → ${status}`);
      break;
    case 'failed':
      console.error(`❌ ${message}: ${error}`);
      break;
    case 'retry':
      console.warn(`🔄 ${message} (retry)`);
      break;
  }
}