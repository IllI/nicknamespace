import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { ConversionOrchestrator } from '@/lib/services/conversion-orchestrator';
import { ConversionDatabaseService } from '@/lib/services/conversion-database';
import { UsageTrackingService } from '@/lib/services/usage-tracking-service';
import { 
  ValidationError, 
  ConversionError, 
  RateLimitError 
} from '@/lib/types/3d-conversion';
import { CONVERSION_CONFIG } from '@/lib/config/3d-conversion';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check user rate limits using usage tracking service
    const limitCheck = await UsageTrackingService.canUserConvert(user.id);
    
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { 
          error: limitCheck.reason,
          usage: limitCheck.usage,
          upgrade_available: limitCheck.usage.daily.limit <= 5
        },
        { status: 429 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const textDescriptionRaw = formData.get('text_description');
    const textDescription = typeof textDescriptionRaw === 'string'
      ? textDescriptionRaw.trim().slice(0, 500)
      : undefined;

    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    // Validate file
    if (imageFile.size > CONVERSION_CONFIG.MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { 
          error: 'File too large',
          max_size_mb: CONVERSION_CONFIG.MAX_FILE_SIZE_BYTES / (1024 * 1024),
          file_size_mb: imageFile.size / (1024 * 1024)
        },
        { status: 400 }
      );
    }

    const allowedTypes = CONVERSION_CONFIG.SUPPORTED_IMAGE_FORMATS;
    if (!allowedTypes.includes(imageFile.type as any)) {
      return NextResponse.json(
        { 
          error: 'Unsupported file format',
          supported_formats: allowedTypes,
          received_format: imageFile.type
        },
        { status: 400 }
      );
    }

    // Create conversion record and start processing
    const conversionId = crypto.randomUUID();
    
    // Create initial conversion record
    await ConversionDatabaseService.createConversionRecord(user.id, {
      id: conversionId,
      status: 'uploading',
      created_at: new Date().toISOString(),
      file_sizes: {
        original_image_bytes: imageFile.size
      },
      text_description: textDescription && textDescription.length > 0 ? textDescription : undefined
    });

    // Record conversion attempt and update usage
    await UsageTrackingService.recordConversionAttempt(user.id, conversionId);

    // Start background processing (don't await - return immediately)
    processConversionAsync(imageFile, user.id, conversionId, textDescription);

    return NextResponse.json({
      conversion_id: conversionId,
      status: 'uploaded',
      message: 'Image uploaded successfully. Processing started.'
    });

  } catch (error) {
    console.error('Upload API error:', error);

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { 
          error: error.message,
          retry_after: error.retryAfter
        },
        { status: 429 }
      );
    }

    if (error instanceof ConversionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Background processing function
async function processConversionAsync(
  imageFile: File,
  userId: string,
  conversionId: string,
  textDescription?: string | undefined
): Promise<void> {
  try {
    // Process the conversion in the background
    // Note: This only converts image to 3D model - print preparation happens later
    await ConversionOrchestrator.processImageToModel(
      imageFile,
      userId,
      textDescription,
      conversionId
    );
  } catch (error) {
    console.error(`Background conversion failed for ${conversionId}:`, error);
    
    // Update conversion record with error
    try {
      await ConversionDatabaseService.updateConversionRecord(conversionId, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } catch (dbError) {
      console.error('Failed to update conversion record with error:', dbError);
    }
  }
}

export async function GET() {
  return NextResponse.json(
    { 
      message: 'Upload endpoint ready',
      supported_formats: CONVERSION_CONFIG.SUPPORTED_IMAGE_FORMATS,
      max_file_size_mb: CONVERSION_CONFIG.MAX_FILE_SIZE_BYTES / (1024 * 1024)
    }
  );
}