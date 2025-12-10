# Webhook Integration Guide

The print service supports webhooks to send real-time status updates to your frontend. This eliminates the need for polling and provides instant notifications when job status changes.

## Overview

When a print job status changes, the service will automatically send a POST request to the webhook URL you provide. This allows your frontend to update the UI in real-time without constantly querying the database.

## How It Works

1. **Frontend provides webhook URL** when submitting a print job
2. **Service stores webhook URL** in the job record
3. **Service sends webhook notifications** whenever job status changes
4. **Frontend receives updates** and updates the UI accordingly

## Webhook Payload

The service sends a POST request with the following JSON payload:

```json
{
  "event": "job_status_update",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "printing",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "job": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "printing",
    "filename": "model.stl",
    "storage_path": "uploads/model.stl",
    "gcode_path": "/path/to/output.gcode",
    "error_message": null,
    "created_at": "2025-01-15T10:25:00.000Z",
    "updated_at": "2025-01-15T10:30:00.000Z",
    "slicing_started_at": "2025-01-15T10:28:00.000Z",
    "printing_started_at": "2025-01-15T10:30:00.000Z"
  }
}
```

### Headers

The webhook request includes these headers:
- `Content-Type: application/json`
- `User-Agent: OrcaSlicer-Print-Service/1.0.0`
- `X-Print-Service-Event: job-status-update`

## Status Events

Webhooks are sent for these status transitions:

- `pending` → `downloading` - When service starts downloading the STL
- `downloading` → `slicing` - When download completes and slicing begins
- `slicing` → `uploading` - When slicing completes and G-code upload begins
- `uploading` → `printing` - When G-code is uploaded and printing starts
- `printing` → `complete` - When print job finishes successfully
- Any status → `failed` - When an error occurs

## Frontend Integration

### Step 1: Create Webhook Endpoint

Create a Next.js API route to receive webhook notifications:

**Pages Router:** `pages/api/webhooks/print-status.js`
**App Router:** `app/api/webhooks/print-status/route.js`

```javascript
// pages/api/webhooks/print-status.js (Pages Router)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { event, job_id, status, job, timestamp } = req.body;

  // Verify this is a job_status_update event
  if (event !== 'job_status_update') {
    return res.status(400).json({ error: 'Invalid event type' });
  }

  // Update your application state here
  // For example, update Supabase or emit to connected clients
  
  console.log(`📥 Webhook received: Job ${job_id} → ${status}`);

  // Optionally: Update Supabase job record (if you want to sync)
  // const { supabase } = require('@supabase/supabase-js');
  // await supabase
  //   .from('print_jobs')
  //   .update({ status, updated_at: timestamp })
  //   .eq('id', job_id);

  // Emit to connected clients (if using WebSockets/Server-Sent Events)
  // io.emit('job-status-update', { job_id, status, job });

  res.status(200).json({ received: true });
}

// App Router (if using App Router)
export async function POST(request) {
  const body = await request.json();
  const { event, job_id, status, job, timestamp } = body;

  if (event !== 'job_status_update') {
    return Response.json({ error: 'Invalid event type' }, { status: 400 });
  }

  console.log(`📥 Webhook received: Job ${job_id} → ${status}`);

  // Handle the webhook update here
  
  return Response.json({ received: true });
}
```

### Step 2: Provide Webhook URL When Submitting Job

Update your print job submission to include the webhook URL:

```javascript
async function submitPrintJob(jobId, storagePath, filename) {
  // Construct webhook URL
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/print-status`;

  const response = await fetch('/api/submit-print', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      job_id: jobId,
      storage_path: storagePath,
      filename: filename,
      webhook_url: webhookUrl  // Add webhook URL
    })
  });

  return await response.json();
}
```

### Step 3: Handle Webhook Updates in Frontend

If you're using a state management solution or real-time subscriptions:

```javascript
// Example: Using Supabase Realtime + Webhooks
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Listen for job updates
supabase
  .channel('print-jobs')
  .on('postgres_changes', 
    { event: 'UPDATE', schema: 'public', table: 'print_jobs' },
    (payload) => {
      console.log('Job updated:', payload.new);
      // Update your UI here
    }
  )
  .subscribe();

// Also handle webhook updates (for real-time notifications)
// Your webhook endpoint can emit events to connected clients
```

## Webhook Retry Logic

The service includes automatic retry logic:

- **3 retry attempts** with exponential backoff
- **10 second timeout** per request
- **No retry** on 4xx client errors (invalid URL, etc.)
- **Retry** on 5xx server errors and network failures
- **Fire and forget** - webhook failures don't block print job processing

## Security Considerations

### 1. Validate Webhook Source (Recommended)

Add a signature verification to ensure webhooks come from the print service:

```javascript
import crypto from 'crypto';

function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(payload)).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

// In your webhook handler
const signature = req.headers['x-print-service-signature'];
if (!verifyWebhookSignature(req.body, signature, process.env.WEBHOOK_SECRET)) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

**Note:** Signature verification is not currently implemented in the service, but you can add it if needed.

### 2. Use HTTPS

Always use HTTPS for webhook URLs in production to prevent man-in-the-middle attacks.

### 3. Validate Job ID

Always verify that the `job_id` in the webhook payload belongs to your application before processing.

## Testing Webhooks Locally

### Option 1: Use ngrok

```bash
# Install ngrok
brew install ngrok/ngrok/ngrok

# Start your Next.js app
npm run dev

# In another terminal, expose port 3000
ngrok http 3000

# Use the ngrok URL as your webhook URL
# Example: https://abc123.ngrok.io/api/webhooks/print-status
```

### Option 2: Use localtunnel

```bash
# Install localtunnel
npm install -g localtunnel

# Expose port 3000
lt --port 3000

# Use the provided URL as your webhook URL
```

### Option 3: Test with curl

```bash
# Simulate a webhook payload
curl -X POST http://localhost:3000/api/webhooks/print-status \
  -H "Content-Type: application/json" \
  -H "User-Agent: OrcaSlicer-Print-Service/1.0.0" \
  -H "X-Print-Service-Event: job-status-update" \
  -d '{
    "event": "job_status_update",
    "job_id": "test-123",
    "status": "printing",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "job": {
      "id": "test-123",
      "status": "printing",
      "filename": "test.stl"
    }
  }'
```

## Database Schema Update

Make sure your `print_jobs` table includes the `webhook_url` column:

```sql
ALTER TABLE print_jobs 
ADD COLUMN IF NOT EXISTS webhook_url TEXT;
```

Or run the updated `supabase-schema.sql` which includes this field.

## Error Handling

The service handles webhook failures gracefully:

- Webhook failures **do not** stop the print job
- Failed webhooks are logged but don't affect job processing
- You can still query job status via the API if webhooks fail

## Monitoring

Check service logs to monitor webhook delivery:

```bash
tail -f ~/AI_PIPELINE/service/logs/access.log
```

Look for:
- `✅ Webhook notification sent for job {id}` - Success
- `⚠️  Webhook notification failed for job {id}` - Failure (non-critical)
- `❌ Webhook error for job {id}` - Error

## Best Practices

1. **Always provide webhook URL** when submitting jobs for real-time updates
2. **Handle webhook failures gracefully** - fall back to polling if needed
3. **Validate webhook payloads** before processing
4. **Use HTTPS** in production
5. **Implement idempotency** - webhooks may be sent multiple times
6. **Keep webhook handlers fast** - respond quickly to avoid timeouts

## Example Complete Integration

```javascript
// Complete workflow with webhooks
async function handlePrintRequest(file) {
  try {
    // 1. Upload to Supabase
    const { jobId, storagePath, filename } = await uploadFileAndCreateJob(file);
    
    // 2. Submit with webhook URL
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/print-status`;
    const result = await submitPrintJob(jobId, storagePath, filename, webhookUrl);
    
    if (result.success) {
      // Webhooks will automatically notify you of status changes
      return {
        success: true,
        jobId: result.job_id,
        message: 'Print job started. Status updates will be sent via webhook.'
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

---

**For more information, see:**
- `API_QUICK_REFERENCE.md` - API endpoint documentation
- `API_GUIDE.md` - Complete API guide

