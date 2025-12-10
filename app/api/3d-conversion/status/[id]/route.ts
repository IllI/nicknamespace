import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { ConversionOrchestrator } from '@/lib/services/conversion-orchestrator';
import { ConversionError } from '@/lib/types/3d-conversion';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
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

    const conversionId = params.id;
    const fullParam = request.nextUrl.searchParams.get('full');

    if (!conversionId) {
      return NextResponse.json(
        { error: 'Conversion ID is required' },
        { status: 400 }
      );
    }

    // Get conversion status
    const statusResult = await ConversionOrchestrator.getConversionStatus(conversionId);

    // Verify user owns this conversion (skip check for mock records)
    if (statusResult.record.user_id !== user.id && statusResult.record.user_id !== 'mock-user') {
      return NextResponse.json(
        { error: 'Conversion not found' },
        { status: 404 }
      );
    }

    // If full=true, return the entire conversion record for preview UI to consume
    if (fullParam === 'true') {
      return NextResponse.json(statusResult.record);
    }

    // Default: return summarized status payload
    return NextResponse.json({
      conversion_id: conversionId,
      status: statusResult.record.status,
      progress_percentage: statusResult.progress_percentage,
      estimated_completion: statusResult.estimated_completion,
      error_message: statusResult.record.error_message,
      created_at: statusResult.record.created_at,
      completed_at: statusResult.record.completed_at,
      file_sizes: statusResult.record.file_sizes,
      model_metadata: statusResult.record.model_metadata,
      print_metadata: statusResult.record.print_metadata,
      urls: {
        original_image: statusResult.record.original_image_url,
        model_file: statusResult.record.model_file_url
      }
    });

  } catch (error) {
    console.error('Status API error:', error);

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

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
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

    const conversionId = params.id;
    const body = await request.json();
    const action = body.action;

    if (!conversionId) {
      return NextResponse.json(
        { error: 'Conversion ID is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'retry':
        const retryResult = await ConversionOrchestrator.retryConversion(conversionId);

        // Verify user owns this conversion
        if (retryResult.user_id !== user.id) {
          return NextResponse.json(
            { error: 'Conversion not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          conversion_id: conversionId,
          status: retryResult.status,
          message: 'Conversion retry initiated'
        });

      case 'cancel':
        await ConversionOrchestrator.cancelConversion(conversionId);
        
        return NextResponse.json({
          conversion_id: conversionId,
          status: 'cancelled',
          message: 'Conversion cancelled successfully'
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: retry, cancel' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Status action API error:', error);

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