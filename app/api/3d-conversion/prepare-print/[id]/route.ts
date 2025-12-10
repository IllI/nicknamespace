import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { ConversionDatabaseService } from '@/lib/services/conversion-database';
import { PrintPreparationService } from '@/lib/services/print-preparation-service';
import { OrcaSlicerProfileService } from '@/lib/services/orcaslicer-profile-service';
import { SupabaseStorageService } from '@/lib/utils/supabase-storage';
import { 
  ConversionError, 
  ValidationError,
  PrintPreparationRequest 
} from '@/lib/types/3d-conversion';

interface RouteParams {
  params: {
    id: string;
  };
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

    if (!conversionId) {
      return NextResponse.json(
        { error: 'Conversion ID is required' },
        { status: 400 }
      );
    }

    // Parse request body
    const body: PrintPreparationRequest = await request.json();
    
    // Validate request parameters
    const validPrinterTypes = ['bambu_p1p', 'bambu_a1_mini', 'generic_fdm'];
    const validMaterialTypes = ['PLA', 'PETG', 'ABS', 'TPU'];
    const validQualityPresets = ['draft', 'standard', 'fine'];

    if (!validPrinterTypes.includes(body.printer_type)) {
      return NextResponse.json(
        { 
          error: 'Invalid printer type',
          valid_types: validPrinterTypes
        },
        { status: 400 }
      );
    }

    if (!validMaterialTypes.includes(body.material_type)) {
      return NextResponse.json(
        { 
          error: 'Invalid material type',
          valid_types: validMaterialTypes
        },
        { status: 400 }
      );
    }

    if (!validQualityPresets.includes(body.quality_preset)) {
      return NextResponse.json(
        { 
          error: 'Invalid quality preset',
          valid_presets: validQualityPresets
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

    if (!conversionRecord.model_file_url) {
      return NextResponse.json(
        { error: 'Model file not available' },
        { status: 400 }
      );
    }

    // Download the original model file
    const modelBuffer = await SupabaseStorageService.downloadFile('MODELS_RAW', conversionRecord.model_file_url);

    // Prepare the model for printing with specified parameters
    const modelFormat = conversionRecord.model_file_url?.split('.').pop()?.split('?')[0]?.toLowerCase();

    if (!modelFormat || !['ply', 'obj', 'glb', 'stl'].includes(modelFormat)) {
      throw new ConversionError(
        `Unsupported or missing model format for print preparation: ${modelFormat ?? 'unknown'}`,
        'INVALID_MODEL_FORMAT',
        400
      );
    }

    const printPreparation = await PrintPreparationService.preparePrintReadyModel(
      modelBuffer,
      user.id,
      conversionId,
      body.printer_type,
      body.material_type,
      modelFormat as 'ply' | 'obj' | 'glb' | 'stl'
    );

    // Update conversion record with new print metadata
    await ConversionDatabaseService.updateConversionRecord(conversionId, {
      print_metadata: printPreparation.printMetadata
    });

    // Generate OrcaSlicer profile for Bambu printers
    let orcaslicerProfileUrl: string | undefined;
    
    if (body.printer_type === 'bambu_p1p' || body.printer_type === 'bambu_a1_mini') {
      try {
        orcaslicerProfileUrl = await OrcaSlicerProfileService.generateProfile(
          conversionId,
          user.id,
          printPreparation.modelMetadata,
          printPreparation.printMetadata,
          printPreparation.validationResults,
          body.printer_type,
          body.material_type,
          body.quality_preset
        );
        
        console.log(`Generated OrcaSlicer profile for ${body.printer_type}: ${orcaslicerProfileUrl}`);
      } catch (profileError) {
        console.warn('Failed to generate OrcaSlicer profile:', profileError);
        // Continue without profile - it's optional
      }
    }

    return NextResponse.json({
      conversion_id: conversionId,
      print_ready_url: printPreparation.printReadyUrl,
      validation_results: printPreparation.validationResults,
      print_estimates: {
        print_time_minutes: printPreparation.printMetadata.estimated_print_time_minutes,
        material_usage_grams: printPreparation.printMetadata.material_usage_grams,
        estimated_cost_usd: calculatePrintCost(
          printPreparation.printMetadata.material_usage_grams,
          body.material_type
        ),
        layer_count: Math.ceil(
          (printPreparation.modelMetadata.dimensions.z || 0) / 
          printPreparation.printMetadata.recommended_layer_height
        ),
        support_material_grams: printPreparation.printMetadata.supports_required ? 
          printPreparation.printMetadata.material_usage_grams * 0.1 : 0
      },
      orcaslicer_profile_url: orcaslicerProfileUrl,
      printer_settings: {
        printer_type: body.printer_type,
        material_type: body.material_type,
        quality_preset: body.quality_preset,
        layer_height: printPreparation.printMetadata.recommended_layer_height,
        infill_percentage: printPreparation.printMetadata.recommended_infill,
        supports_required: printPreparation.printMetadata.supports_required,
        build_volume_fit: printPreparation.printMetadata.build_volume_fit
      }
    });

  } catch (error) {
    console.error('Print preparation API error:', error);

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
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

    if (!conversionId) {
      return NextResponse.json(
        { error: 'Conversion ID is required' },
        { status: 400 }
      );
    }

    // Get conversion record to check print preparation status
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

    return NextResponse.json({
      conversion_id: conversionId,
      print_preparation_available: !!conversionRecord.print_metadata,
      model_metadata: conversionRecord.model_metadata,
      print_metadata: conversionRecord.print_metadata,
      supported_printers: ['bambu_p1p', 'bambu_a1_mini', 'generic_fdm'],
      supported_materials: ['PLA', 'PETG', 'ABS', 'TPU'],
      quality_presets: ['draft', 'standard', 'fine']
    });

  } catch (error) {
    console.error('Print preparation info API error:', error);

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

// Helper function to calculate print cost based on material usage
function calculatePrintCost(materialGrams: number, materialType: string): number {
  // Rough cost estimates per gram (in USD)
  const materialCosts = {
    'PLA': 0.025,    // $25/kg
    'PETG': 0.030,   // $30/kg
    'ABS': 0.028,    // $28/kg
    'TPU': 0.045     // $45/kg
  };

  const costPerGram = materialCosts[materialType as keyof typeof materialCosts] || 0.025;
  return Math.round(materialGrams * costPerGram * 100) / 100; // Round to 2 decimal places
}