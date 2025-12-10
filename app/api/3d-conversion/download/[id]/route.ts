import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { ConversionDatabaseService } from '@/lib/services/conversion-database';
import { SupabaseStorageService } from '@/lib/utils/supabase-storage';
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
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'stl';
    const variant = searchParams.get('variant') || 'print-ready';
    const printer = searchParams.get('printer') || 'bambu_p1p';

    if (!conversionId) {
      return NextResponse.json(
        { error: 'Conversion ID is required' },
        { status: 400 }
      );
    }

    // Validate format
    const supportedFormats = ['stl', 'obj', 'ply'];
    if (!supportedFormats.includes(format)) {
      return NextResponse.json(
        { 
          error: 'Unsupported format',
          supported_formats: supportedFormats
        },
        { status: 400 }
      );
    }

    // Get conversion record
    const conversionRecord = await ConversionDatabaseService.getConversionRecord(conversionId);

    if (!conversionRecord) {
      return NextResponse.json(
        { error: 'Conversion not found' },
        { status: 404 }
      );
    }

    // Verify user owns this conversion
    if (conversionRecord.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Conversion not found' },
        { status: 404 }
      );
    }

    // Check if conversion is completed
    if (conversionRecord.status !== 'completed') {
      return NextResponse.json(
        { 
          error: 'Conversion not completed',
          status: conversionRecord.status
        },
        { status: 400 }
      );
    }

    // Determine file to download based on format and variant
    let fileUrl: string | undefined;
    let fileName: string;
    let contentType: string;
    let bucketType: 'MODELS_RAW' | 'MODELS_PRINT_READY' = 'MODELS_RAW';

    switch (format) {
      case 'stl':
        if (variant === 'print-ready') {
          // Print-ready STL with printer optimizations
          fileUrl = `${user.id}/${conversionId}/print-ready.stl`;
          fileName = `model_${conversionId}_${printer}_optimized.stl`;
          bucketType = 'MODELS_PRINT_READY';
        } else if (variant === 'original') {
          // Standard STL conversion without optimizations
          fileUrl = `${user.id}/${conversionId}/model.stl`;
          fileName = `model_${conversionId}_standard.stl`;
        } else {
          return NextResponse.json(
            { error: 'Invalid STL variant. Use "original" or "print-ready"' },
            { status: 400 }
          );
        }
        contentType = 'application/octet-stream';
        break;

      case 'ply':
        if (variant === 'original') {
          // Original TripoSR output with vertex colors
          fileUrl = conversionRecord.model_file_url;
          fileName = `model_${conversionId}_triposr_original.ply`;
        } else {
          return NextResponse.json(
            { error: 'PLY format only available as original variant' },
            { status: 400 }
          );
        }
        contentType = 'application/octet-stream';
        break;

      case 'obj':
        if (variant === 'original') {
          // Converted OBJ version for editing
          fileUrl = `${user.id}/${conversionId}/model.obj`;
          fileName = `model_${conversionId}_editable.obj`;
        } else if (variant === 'repaired') {
          // Repaired OBJ version if mesh repair was applied
          fileUrl = `${user.id}/${conversionId}/model_repaired.obj`;
          fileName = `model_${conversionId}_repaired.obj`;
        } else {
          return NextResponse.json(
            { error: 'Invalid OBJ variant. Use "original" or "repaired"' },
            { status: 400 }
          );
        }
        contentType = 'application/octet-stream';
        break;

      default:
        return NextResponse.json(
          { error: 'Unsupported format' },
          { status: 400 }
        );
    }

    if (!fileUrl) {
      return NextResponse.json(
        { error: 'File not available' },
        { status: 404 }
      );
    }

    try {
      // Download file from appropriate Supabase Storage bucket
      const fileBuffer = await SupabaseStorageService.downloadFile(bucketType, fileUrl);

      // Get file size for headers
      const fileSize = fileBuffer.length;
      
      // Set appropriate headers for different file types
      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileSize.toString(),
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
        'X-File-Format': format.toUpperCase(),
        'X-File-Variant': variant
      };

      // Add printer-specific headers for STL files
      if (format === 'stl' && variant === 'print-ready') {
        headers['X-Printer-Type'] = printer;
        headers['X-Print-Optimized'] = 'true';
      }

      return new NextResponse(new Uint8Array(fileBuffer), {
        status: 200,
        headers
      });

    } catch (downloadError) {
      console.error('File download error:', downloadError);
      
      // Check if it's a specific file not found vs general error
      const errorMessage = downloadError instanceof Error ? downloadError.message : 'Unknown error';
      
      if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'File not available',
            details: `The requested ${format.toUpperCase()} file (${variant}) is not available for this conversion.`,
            available_formats: ['ply:original', 'stl:print-ready', 'obj:original']
          },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: 'File download failed', details: errorMessage },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Download API error:', error);

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