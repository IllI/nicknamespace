// Hyper3D API Integration Service
// Production-ready 3D generation with competitive pricing

import { CONVERSION_CONFIG } from '../config/3d-conversion';
import { SupabaseStorageService } from '../utils/supabase-storage';
import { 
  ModelResult, 
  ConversionError, 
  RateLimitError, 
  ProcessingError 
} from '../types/3d-conversion';

export class Hyper3DService {
  private static readonly API_TOKEN = process.env.HYPER3D_API_TOKEN;
  private static readonly BASE_URL = process.env.HYPER3D_API_ENDPOINT || 'https://api.stability.ai/v2beta';
  private static readonly TIMEOUT_MS = CONVERSION_CONFIG.TIMEOUT_MS;
  private static readonly MAX_RETRIES = CONVERSION_CONFIG.MAX_RETRIES;

  /**
   * Convert image to 3D using Hyper3D API
   */
  static async convertImageTo3D(
    imageBuffer: Buffer, 
    textDescription?: string
  ): Promise<ModelResult> {
    if (!this.API_TOKEN) {
      throw new ConversionError('Hyper3D API token not configured', 'MISSING_API_TOKEN', 500);
    }

    try {
      // Prepare form data for image upload
      const formData = new FormData();
      
      // Add the image
      const imageBlob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/jpeg' });
      formData.append('image', imageBlob, 'input.jpg');
      
      // Add text description if provided
      if (textDescription && textDescription.trim()) {
        formData.append('text_prompt', textDescription.trim());
      }

      // Add generation parameters
      formData.append('output_format', 'ply');
      formData.append('quality', 'standard'); // 'draft', 'standard', 'high'
      formData.append('texture_resolution', '1024');

      // Make the API request
      const response = await this.makeRequest('/3d/stable-fast-3d', {
        method: 'POST',
        body: formData
      });

      // Handle the response
      const result = await this.handleGenerationResponse(response);
      
      // Download the generated model
      const modelData = await this.downloadModel(result.output_url);

      // Extract metadata from response
      const metadata = {
        vertices: result.metadata?.vertex_count || 5000,
        faces: result.metadata?.face_count || 4000,
        processing_time: result.processing_time || Date.now()
      };

      return {
        model_data: modelData,
        format: 'ply',
        has_texture: true,
        texture_data: undefined, // Embedded in PLY
        metadata
      };

    } catch (error) {
      if (error instanceof ConversionError) {
        throw error;
      }
      throw new ProcessingError(
        `Hyper3D image-to-3D conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generate 3D model from text description only
   */
  static async generateFromText(textDescription: string): Promise<ModelResult> {
    if (!this.API_TOKEN) {
      throw new ConversionError('Hyper3D API token not configured', 'MISSING_API_TOKEN', 500);
    }

    if (!textDescription || textDescription.trim().length < 3) {
      throw new ConversionError('Text description must be at least 3 characters long', 'INVALID_TEXT_DESCRIPTION', 400);
    }

    try {
      const payload = {
        text_prompt: textDescription.trim(),
        output_format: 'ply',
        quality: 'standard',
        texture_resolution: 1024,
        guidance_scale: 7.5,
        num_inference_steps: 50,
        seed: Math.floor(Math.random() * 1000000)
      };

      const response = await this.makeRequest('/3d/stable-3d', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const result = await this.handleGenerationResponse(response);
      const modelData = await this.downloadModel(result.output_url);

      const metadata = {
        vertices: result.metadata?.vertex_count || 6000,
        faces: result.metadata?.face_count || 5000,
        processing_time: result.processing_time || Date.now()
      };

      return {
        model_data: modelData,
        format: 'ply',
        has_texture: true,
        texture_data: undefined,
        metadata
      };

    } catch (error) {
      if (error instanceof ConversionError) {
        throw error;
      }
      throw new ProcessingError(
        `Hyper3D text-to-3D generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Make authenticated request to Hyper3D API
   */
  private static async makeRequest(endpoint: string, options: RequestInit): Promise<Response> {
    const url = `${this.BASE_URL}${endpoint}`;
    
    const headers = {
      'Authorization': `Bearer ${this.API_TOKEN}`,
      'Accept': 'application/json',
      ...options.headers
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ConversionError(
          `Request timeout after ${this.TIMEOUT_MS / 1000} seconds`,
          'TIMEOUT',
          408
        );
      }
      
      throw error;
    }
  }

  /**
   * Handle generation response and poll for completion if needed
   */
  private static async handleGenerationResponse(response: Response): Promise<any> {
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '60');
      throw new RateLimitError(
        'Hyper3D API rate limit exceeded. Please try again later.',
        retryAfter
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      let errorMessage = `Hyper3D API error: ${response.status} ${response.statusText}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        errorMessage += ` - ${errorText}`;
      }

      throw new ConversionError(errorMessage, 'API_ERROR', response.status);
    }

    const result = await response.json();

    // If the generation is async, poll for completion
    if (result.status === 'processing' && result.id) {
      return await this.pollForCompletion(result.id);
    }

    // If completed immediately
    if (result.status === 'completed' || result.output_url) {
      return result;
    }

    throw new ConversionError(
      `Unexpected response status: ${result.status}`,
      'UNEXPECTED_STATUS',
      500
    );
  }

  /**
   * Poll for generation completion
   */
  private static async pollForCompletion(generationId: string): Promise<any> {
    const startTime = Date.now();
    const maxWaitTime = this.TIMEOUT_MS;
    
    while (Date.now() - startTime < maxWaitTime) {
      const response = await this.makeRequest(`/3d/generation/${generationId}`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new ConversionError(
          `Failed to check generation status: ${response.status}`,
          'POLLING_ERROR',
          response.status
        );
      }

      const result = await response.json();

      if (result.status === 'completed') {
        return result;
      } else if (result.status === 'failed') {
        throw new ConversionError(
          `Generation failed: ${result.error || 'Unknown error'}`,
          'GENERATION_FAILED',
          500
        );
  