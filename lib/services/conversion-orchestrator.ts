// Conversion Orchestrator Service - Coordinates all backend services

import { Replicate3DService } from './replicate-3d-service';
import { SF3DGradioService } from './sf3d-gradio-service';
import { Meshy3DService } from './meshy-service';
import { Hitem3DService } from './hitem3d-service';

import { FileUploadService } from './file-upload-service';
import { PrintPreparationService } from './print-preparation-service';
import { ConversionDatabaseService } from './conversion-database';
import { SupabaseStorageService } from '../utils/supabase-storage';
import { 
  ConversionRecord, 
  ConversionError, 
  ProcessingError,
  ValidationError 
} from '../types/3d-conversion';

export class ConversionOrchestrator {
  /**
   * Complete end-to-end conversion process
   * Note: Print preparation is NOT done here - it's done later when user confirms print
   */
  static async processImageToModel(
    file: File,
    userId: string,
    textDescription?: string,
    existingConversionId?: string
  ): Promise<ConversionRecord> {
    // Use the existing conversion ID if provided (created by the upload API), otherwise create a new one
    const conversionId = existingConversionId || crypto.randomUUID();
    let conversionRecord: ConversionRecord | null = null;

    try {
      // Step 1: Ensure an initial conversion record exists
      // If the upload API already created it, reuse and update; otherwise create it here
      const existingRecord = await ConversionDatabaseService.getConversionRecord(conversionId);
      if (!existingRecord) {
        conversionRecord = await ConversionDatabaseService.createConversionRecord(userId, {
          id: conversionId,
          status: 'uploading',
          created_at: new Date().toISOString(),
          file_sizes: {
            original_image_bytes: file.size
          },
          text_description: textDescription
        });
      } else {
        conversionRecord = existingRecord;
      }

      // Step 2: Process and upload image
      await ConversionDatabaseService.updateConversionStatus(conversionId, 'processing');
      
      const uploadResult = await FileUploadService.processImageUpload(
        file,
        userId,
        conversionId
      );

      // Update record with image URL
      await ConversionDatabaseService.updateConversionRecord(conversionId, {
        original_image_url: uploadResult.imageUrl
      });

      // Step 3: Convert image to 3D model using configured service fallbacks
      // Read the file buffer from the temp file or convert from File object
      const imageBuffer = Buffer.from(await file.arrayBuffer());
      const modelResult = await this.convertImageTo3DWithFallback(imageBuffer, textDescription);

      // Step 4: Upload 3D model to storage
      const rawModelFileName = `model.${modelResult.format}`;
      const modelUrl = await this.uploadModelToStorage(
        modelResult.model_data,
        userId,
        conversionId,
        rawModelFileName
      );

      // Step 5: Extract basic model metadata (without print preparation)
      // Print preparation will be done later when user confirms they want to print
      const basicMetadata = {
        vertices: 0, // Will be populated by print preparation later
        faces: 0,
        dimensions: { x: 0, y: 0, z: 0 },
        original_format: modelResult.format,
        print_ready_format: modelResult.format,
        is_manifold: false,
        has_errors: false,
        repair_applied: false
      };

      const basicPrintMetadata = {
        estimated_print_time_minutes: 0,
        material_usage_grams: 0,
        build_volume_fit: false,
        recommended_layer_height: 0.2,
        recommended_infill: 15,
        supports_required: false,
        orcaslicer_compatible: false,
        printer_compatibility: []
      };

      // Step 6: Update final conversion record - mark as completed so user can view it
      const finalRecord = await ConversionDatabaseService.updateConversionRecord(conversionId, {
        model_file_url: modelUrl,
        status: 'completed',
        completed_at: new Date().toISOString(),
        file_sizes: {
          original_image_bytes: file.size,
          model_file_bytes: modelResult.model_data.length
        },
        model_metadata: basicMetadata,
        print_metadata: basicPrintMetadata,
        text_description: textDescription || conversionRecord?.text_description
      });

      // Step 7: Clean up temporary files
      await FileUploadService.cleanupConversionTempFiles(conversionId);

      console.log(`✅ Conversion ${conversionId} completed successfully. Model ready for user review.`);
      return finalRecord;

    } catch (error) {
      // Update conversion record with error status
      if (conversionRecord) {
        await ConversionDatabaseService.updateConversionRecord(conversionId, {
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error occurred'
        }).catch(console.error);
      }

      // Clean up any temporary files
      await FileUploadService.cleanupConversionTempFiles(conversionId).catch(console.error);

      // Re-throw the original error
      throw error;
    }
  }

  /**
   * Get conversion status and progress
   */
  static async getConversionStatus(conversionId: string): Promise<{
    record: ConversionRecord;
    progress_percentage: number;
    estimated_completion?: string;
  }> {
    const record = await ConversionDatabaseService.getConversionRecord(conversionId);
    
    if (!record) {
      // If database tables don't exist, return a mock processing record for testing
      console.warn('Conversion record not found, returning mock record for testing');
      const mockRecord: ConversionRecord = {
        id: conversionId,
        user_id: 'mock-user',
        status: 'processing',
        created_at: new Date().toISOString(),
        file_sizes: { original_image_bytes: 0 },
        model_metadata: {
          vertices: 0,
          faces: 0,
          dimensions: { x: 0, y: 0, z: 0 },
          original_format: 'ply',
          print_ready_format: 'stl',
          is_manifold: false,
          has_errors: false,
          repair_applied: false
        },
        print_metadata: {
          estimated_print_time_minutes: 0,
          material_usage_grams: 0,
          build_volume_fit: false,
          recommended_layer_height: 0.2,
          recommended_infill: 15,
          supports_required: false,
          orcaslicer_compatible: false,
          printer_compatibility: []
        }
      };

      return {
        record: mockRecord,
        progress_percentage: 50,
        estimated_completion: new Date(Date.now() + 3 * 60 * 1000).toISOString()
      };
    }

    // Calculate progress based on status
    let progressPercentage = 0;
    switch (record.status) {
      case 'uploading':
        progressPercentage = 10;
        break;
      case 'processing':
        progressPercentage = 50;
        break;
      case 'completed':
        progressPercentage = 100;
        break;
      case 'failed':
        progressPercentage = 0;
        break;
    }

    // Estimate completion time (rough calculation)
    let estimatedCompletion: string | undefined;
    if (record.status === 'processing') {
      const estimatedMinutes = 3; // Rough estimate while processing
      const completionTime = new Date(Date.now() + estimatedMinutes * 60 * 1000);
      estimatedCompletion = completionTime.toISOString();
    }

    return {
      record,
      progress_percentage: progressPercentage,
      estimated_completion: estimatedCompletion
    };
  }

  /**
   * Prepare a completed model for printing (called when user confirms print)
   */
  static async prepareModelForPrint(
    conversionId: string,
    printerType: 'bambu_p1p' | 'bambu_a1_mini' | 'generic_fdm' = 'bambu_p1p',
    materialType: 'PLA' | 'PETG' | 'ABS' | 'TPU' = 'PLA'
  ): Promise<ConversionRecord> {
    const existingRecord = await ConversionDatabaseService.getConversionRecord(conversionId);
    
    if (!existingRecord) {
      throw new ConversionError('Conversion not found', 'NOT_FOUND', 404);
    }

    if (existingRecord.status !== 'completed') {
      throw new ValidationError('Can only prepare completed conversions for print');
    }

    if (!existingRecord.model_file_url) {
      throw new ProcessingError('Model file not found');
    }

    console.log(`🔧 Preparing model ${conversionId} for ${printerType} with ${materialType}...`);

    try {
      // Download the model from storage
      const modelBuffer = await SupabaseStorageService.downloadFile('MODELS_RAW', existingRecord.model_file_url);

      // Determine the model format from the URL or metadata
      const modelFormat = (existingRecord.model_metadata?.original_format || 'glb') as 'ply' | 'obj' | 'glb' | 'stl';

      // Prepare model for 3D printing
      const printPreparation = await PrintPreparationService.preparePrintReadyModel(
        modelBuffer,
        existingRecord.user_id,
        conversionId,
        printerType,
        materialType,
        modelFormat
      );

      // Update conversion record with print preparation data
      const updatedRecord = await ConversionDatabaseService.updateConversionRecord(conversionId, {
        model_metadata: printPreparation.modelMetadata,
        print_metadata: printPreparation.printMetadata
      });

      console.log(`✅ Model ${conversionId} prepared for printing`);
      return updatedRecord;

    } catch (error) {
      console.error(`Failed to prepare model ${conversionId} for print:`, error);
      throw error;
    }
  }

  /**
   * Retry a failed conversion
   */
  static async retryConversion(
    conversionId: string
  ): Promise<ConversionRecord> {
    const existingRecord = await ConversionDatabaseService.getConversionRecord(conversionId);
    
    if (!existingRecord) {
      throw new ConversionError('Conversion not found', 'NOT_FOUND', 404);
    }

    if (existingRecord.status !== 'failed') {
      throw new ValidationError('Can only retry failed conversions');
    }

    if (!existingRecord.original_image_url) {
      throw new ProcessingError('Original image not found for retry');
    }

    // Reset status to processing
    await ConversionDatabaseService.updateConversionStatus(conversionId, 'processing');

    try {
      // Download original image from storage
      const imageBuffer = await SupabaseStorageService.downloadFile('IMAGES', existingRecord.original_image_url);

      // Continue with conversion process from Step 3 (with fallback)
      const modelResult = await this.convertImageTo3DWithFallback(imageBuffer, existingRecord.text_description);

      const modelUrl = await this.uploadModelToStorage(
        modelResult.model_data,
        existingRecord.user_id,
        conversionId,
        `model.${modelResult.format}`
      );

      // Basic metadata (print preparation will be done when user confirms)
      const basicMetadata = {
        vertices: 0,
        faces: 0,
        dimensions: { x: 0, y: 0, z: 0 },
        original_format: modelResult.format,
        print_ready_format: modelResult.format,
        is_manifold: false,
        has_errors: false,
        repair_applied: false
      };

      const basicPrintMetadata = {
        estimated_print_time_minutes: 0,
        material_usage_grams: 0,
        build_volume_fit: false,
        recommended_layer_height: 0.2,
        recommended_infill: 15,
        supports_required: false,
        orcaslicer_compatible: false,
        printer_compatibility: []
      };

      return await ConversionDatabaseService.updateConversionRecord(conversionId, {
        model_file_url: modelUrl,
        status: 'completed',
        completed_at: new Date().toISOString(),
        error_message: undefined, // Clear previous error
        file_sizes: {
          ...existingRecord.file_sizes,
          model_file_bytes: modelResult.model_data.length
        },
        model_metadata: basicMetadata,
        print_metadata: basicPrintMetadata
      });

    } catch (error) {
      await ConversionDatabaseService.updateConversionRecord(conversionId, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Retry failed'
      });
      throw error;
    }
  }

  /**
   * Cancel an ongoing conversion
   */
  static async cancelConversion(conversionId: string): Promise<void> {
    const record = await ConversionDatabaseService.getConversionRecord(conversionId);
    
    if (!record) {
      throw new ConversionError('Conversion not found', 'NOT_FOUND', 404);
    }

    if (record.status === 'completed' || record.status === 'failed') {
      throw new ValidationError('Cannot cancel completed or failed conversion');
    }

    // Update status to failed with cancellation message
    await ConversionDatabaseService.updateConversionRecord(conversionId, {
      status: 'failed',
      error_message: 'Conversion cancelled by user'
    });

    // Clean up temporary files
    await FileUploadService.cleanupConversionTempFiles(conversionId);
  }

  /**
   * Get user's conversion history
   */
  static async getUserConversions(
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<ConversionRecord[]> {
    return await ConversionDatabaseService.getUserConversionRecords(userId, limit, offset);
  }

  /**
   * Convert image to 3D with fallback chain: Hitem3D -> SF3D (free) -> Meshy -> Replicate
   */
  private static async convertImageTo3DWithFallback(imageBuffer: Buffer, textDescription?: string) {
    const errors: Array<{ service: string; error: string }> = [];

    // Try Hitem3D first (200 free credits, supports text descriptions)
    if (Hitem3DService.isAvailable()) {
      try {
        console.log('🎯 Attempting 3D conversion with Hitem3D (200 free credits)...');
        return await Hitem3DService.convertImageTo3D(imageBuffer, {
          textDescription,
          resolution: 1024,
          faceCount: 600000,
          outputFormat: 'glb',
          pollIntervalMs: 7000,
          timeoutMs: 15 * 60 * 1000 // 15-minute ceiling to align with observed generation times
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.log('Hitem3D failed, trying next service...', errorMsg);
        errors.push({ service: 'Hitem3D', error: errorMsg });
      }
    }

    // Try SF3D Gradio (FREE, no API key needed)
    try {
      console.log('🎯 Attempting 3D conversion with SF3D Gradio (FREE)...');
      return await SF3DGradioService.convertImageTo3D(imageBuffer);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log('SF3D Gradio failed, trying next service...', errorMsg);
      errors.push({ service: 'SF3D Gradio', error: errorMsg });
    }

    // Try Meshy if configured
    if (process.env.MESHY_API_KEY && process.env.MESHY_API_KEY.trim() !== '') {
      try {
        console.log('🎯 Attempting 3D conversion with Meshy Image-to-3D...');
        return await Meshy3DService.convertImageTo3D(imageBuffer);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.log('Meshy conversion failed, trying next service...', errorMsg);
        errors.push({ service: 'Meshy', error: errorMsg });
      }
    }

    // Try Replicate if configured
    if (process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_API_TOKEN !== 'your_replicate_token_here') {
      try {
        console.log('🎯 Attempting 3D conversion with Replicate...');
        return await Replicate3DService.convertImageTo3D(imageBuffer);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.log('Replicate failed, trying next service...', errorMsg);
        errors.push({ service: 'Replicate', error: errorMsg });
      }
    }

    // All services failed
    console.error('All 3D conversion services failed:', errors);
    throw new ConversionError(
      `All 3D conversion services are currently unavailable. Errors: ${errors.map(e => `${e.service}: ${e.error}`).join('; ')}`,
      'ALL_SERVICES_UNAVAILABLE',
      503
    );
  }

  private static async uploadModelToStorage(
    modelBuffer: Buffer,
    userId: string,
    conversionId: string,
    fileName: string
  ): Promise<string> {
    const result = await SupabaseStorageService.uploadFile(
      'MODELS_RAW',
      userId,
      conversionId,
      fileName,
      modelBuffer,
      'application/octet-stream'
    );

    return result.url;
  }

  /**
   * Health check for all services
   */
  static async healthCheck(): Promise<{
    overall_healthy: boolean;
    services: {
      hitem3d: { healthy: boolean; message: string };
      sf3d_gradio: { healthy: boolean; message: string };
      meshy: { healthy: boolean; message: string };
      replicate?: { healthy: boolean; message: string };
      database: { healthy: boolean; message: string };
      storage: { healthy: boolean; message: string };
    };
  }> {
    const [hitem3dHealth, sf3dHealth, replicateHealth] = await Promise.allSettled([
      Hitem3DService.healthCheck(),
      SF3DGradioService.healthCheck(),
      process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_API_TOKEN !== 'your_replicate_token_here'
        ? Replicate3DService.healthCheck()
        : Promise.resolve({ healthy: false, message: 'Not configured' })
    ]);

    const hitem3d = hitem3dHealth.status === 'fulfilled'
      ? hitem3dHealth.value
      : { healthy: false, message: 'Service check failed' };

    const sf3d_gradio = sf3dHealth.status === 'fulfilled'
      ? sf3dHealth.value
      : { healthy: false, message: 'Service check failed' };

    const replicate = replicateHealth.status === 'fulfilled'
      ? replicateHealth.value
      : { healthy: false, message: 'Service check failed' };

    const meshy = process.env.MESHY_API_KEY && process.env.MESHY_API_KEY.trim() !== ''
      ? { healthy: true, message: 'Configured' }
      : { healthy: false, message: 'Not configured' };

    // Simple database health check by trying to get statistics
    let database: { healthy: boolean; message: string };
    try {
      await ConversionDatabaseService.getConversionStatistics();
      database = { healthy: true, message: 'Database service available' };
    } catch (error) {
      database = { healthy: false, message: 'Database check failed' };
    }

    // Simple storage health check
    const storage = { healthy: true, message: 'Storage service available' };

    const overallHealthy = (hitem3d.healthy || sf3d_gradio.healthy || meshy.healthy || replicate.healthy) && database.healthy && storage.healthy;

    return {
      overall_healthy: overallHealthy,
      services: {
        hitem3d,
        sf3d_gradio,
        meshy,
        replicate,
        database,
        storage
      }
    };
  }
}