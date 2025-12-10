// Replicate API Integration for 3D Generation
// Alternative to Hugging Face when models are unavailable

import { CONVERSION_CONFIG } from '../config/3d-conversion';
import { SupabaseStorageService } from '../utils/supabase-storage';
import { 
  ModelResult, 
  ConversionError, 
  RateLimitError, 
  ProcessingError 
} from '../types/3d-conversion';

export class Replicate3DService {
  private static readonly REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
  private static readonly TIMEOUT_MS = CONVERSION_CONFIG.TIMEOUT_MS;
  private static readonly MAX_RETRIES = CONVERSION_CONFIG.MAX_RETRIES;
  private static readonly RETRY_DELAY_MS = CONVERSION_CONFIG.RETRY_DELAY_MS;

  // Available 3D generation models on Replicate
  // Using firtoz/trellis - 464.8K runs, recommended for production
  private static readonly MODEL_VERSION = process.env.REPLICATE_TRELLIS_VERSION
    || 'firtoz/trellis:4876f2a8da1c544772dffa32e8889da4a1bab3a1f5c1937bfcfccb99ae347251';

  /**
   * Convert a 2D image to 3D model using Replicate
   */
  static async convertImageTo3D(imageBuffer: Buffer): Promise<ModelResult> {
    if (!this.REPLICATE_API_TOKEN) {
      throw new ConversionError('Replicate API token not configured', 'MISSING_API_TOKEN', 500);
    }

    try {
      // Convert image buffer to base64 data URL
      const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
      
      // Create prediction
      const prediction = await this.createPrediction(base64Image);
      
      // Wait for completion
      const result = await this.waitForCompletion(prediction.id);
      
      // Download the generated model
      const modelData = await this.downloadModel(result.output);

      return {
        model_data: Buffer.from(modelData),
        format: 'ply',
        has_texture: true,
        texture_data: undefined,
        metadata: {
          vertices: 0, // Would need to parse PLY to get exact count
          faces: 0,
          processing_time: Date.now()
        }
      };

    } catch (error) {
      if (error instanceof ConversionError) {
        throw error;
      }
      throw new ProcessingError(
        `Failed to convert image to 3D model: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create a new prediction on Replicate
   */
  private static async createPrediction(imageBase64: string): Promise<any> {
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: this.MODEL_VERSION,
        input: {
          image: imageBase64
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ConversionError(
        `Failed to create prediction: ${response.status} ${response.statusText} - ${errorText}`,
        'API_ERROR',
        response.status
      );
    }

    return await response.json();
  }

  /**
   * Wait for prediction to complete
   */
  private static async waitForCompletion(predictionId: string): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < this.TIMEOUT_MS) {
      const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: {
          'Authorization': `Token ${this.REPLICATE_API_TOKEN}`,
        }
      });

      if (!response.ok) {
        throw new ConversionError(
          `Failed to check prediction status: ${response.status}`,
          'API_ERROR',
          response.status
        );
      }

      const prediction = await response.json();

      if (prediction.status === 'succeeded') {
        return prediction;
      } else if (prediction.status === 'failed') {
        throw new ConversionError(
          `Prediction failed: ${prediction.error || 'Unknown error'}`,
          'PROCESSING_ERROR',
          500
        );
      } else if (prediction.status === 'canceled') {
        throw new ConversionError(
          'Prediction was canceled',
          'PROCESSING_ERROR',
          500
        );
      }

      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new ConversionError(
      'Prediction timed out',
      'TIMEOUT',
      408
    );
  }

  /**
   * Download the generated model file
   */
  private static async downloadModel(outputUrl: string): Promise<ArrayBuffer> {
    const response = await fetch(outputUrl);
    
    if (!response.ok) {
      throw new ConversionError(
        `Failed to download model: ${response.status}`,
        'DOWNLOAD_ERROR',
        response.status
      );
    }

    return await response.arrayBuffer();
  }

  /**
   * Health check for Replicate service
   */
  static async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    if (!this.REPLICATE_API_TOKEN) {
      return {
        healthy: false,
        message: 'Replicate API token not configured'
      };
    }

    try {
      const response = await fetch('https://api.replicate.com/v1/models', {
        headers: {
          'Authorization': `Token ${this.REPLICATE_API_TOKEN}`,
        }
      });

      if (response.ok) {
        return {
          healthy: true,
          message: 'Replicate API is available'
        };
      }

      return {
        healthy: false,
        message: `API returned status ${response.status}`
      };
    } catch (error) {
      return {
        healthy: false,
        message: `API health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}