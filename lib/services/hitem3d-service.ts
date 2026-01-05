// Hitem3D Service - Convert 2D images to 3D models using Hitem3D API
// Documentation: https://docs.hitem3d.ai/en/api/api-reference/overview

import { ConversionError, ModelResult, ProcessingError } from '../types/3d-conversion';

interface Hitem3DOptions {
  textDescription?: string;
  resolution?: 512 | 1024 | 1536 | 2048;
  requestType?: 1 | 2 | 3;
  faceCount?: number;
  modelVersion?: string;
  outputFormat?: 'obj' | 'glb' | 'stl' | 'fbx';
  pollIntervalMs?: number;
  timeoutMs?: number;
}

interface Hitem3DTaskResponse {
  task_id: string;
}

interface Hitem3DTaskResult {
  task_id: string;
  state: string;
  url?: string;
  cover_url?: string;
  progress?: number;
  id?: string;
}

export class Hitem3DService {
  private static readonly ACCESS_KEY = process.env.HITEM3D_ACCESS_KEY || '';
  private static readonly SECRET_KEY = process.env.HITEM3D_SECRET_KEY || '';
  private static readonly API_BASE_URL = 'https://api.hitem3d.ai/open-api/v1';
  private static readonly TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes default window for longer generations
  private static readonly TOKEN_TTL_MS = 23 * 60 * 60 * 1000; // 23 hours
  private static tokenCache: { token: string; expiresAt: number } | null = null;
  private static tokenPromise: Promise<string> | null = null;

  /**
   * Convert a 2D image to 3D model using Hitem3D API
   */
  static async convertImageTo3D(
    imageBuffer: Buffer,
    options: Hitem3DOptions = {}
  ): Promise<ModelResult> {
    if (!this.ACCESS_KEY || !this.SECRET_KEY) {
      throw new ConversionError(
        'Hitem3D API credentials not configured. Please set HITEM3D_ACCESS_KEY and HITEM3D_SECRET_KEY environment variables.',
        'MISSING_API_TOKEN',
        500
      );
    }

    console.log('🎯 Starting Hitem3D conversion using official API...');
    const startTime = Date.now();

    try {
      const { modelBuffer, format } = await this.executeConversionWithRetry(imageBuffer, options);

      const processingTime = Date.now() - startTime;
      console.log(`✅ Hitem3D conversion completed in ${(processingTime / 1000).toFixed(2)}s`);

      return {
        model_data: modelBuffer,
        format,
        has_texture: format === 'glb',
        texture_data: undefined,
        metadata: {
          vertices: 0,
          faces: 0,
          processing_time: processingTime
        }
      };

    } catch (error) {
      console.error('❌ Hitem3D conversion failed:', error);
      if (error instanceof ConversionError) {
        throw error;
      }
      throw new ProcessingError(
        `Hitem3D conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create a new generation task
   */
  private static async createGenerationTask(
    imageBuffer: Buffer,
    options: Hitem3DOptions,
    token: string
  ): Promise<string> {
    const formData = new FormData();

    // Add image file
    const imageBlob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' });
    formData.append('images', imageBlob, 'input.png');

    const requestType = options.requestType ?? 3; // 3 = Image-to-3D All-in-One
    const resolution = options.resolution ?? 1024;
    const faceCount = options.faceCount ?? 600000;
    const modelVersion = options.modelVersion ?? 'hitem3dv1';
    const outputFormat = this.mapOutputFormat(options.outputFormat ?? 'glb');

    formData.append('request_type', requestType.toString());
    formData.append('resolution', resolution.toString());
    formData.append('face', faceCount.toString());
    formData.append('model', modelVersion);
    formData.append('format', outputFormat);

    if (options.textDescription && options.textDescription.trim()) {
      formData.append('text_prompt', options.textDescription.trim());
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/submit-task`, {
        method: 'POST',
        headers: {
          Authorization: token
        },
        body: formData
      });

      const data = await response.json().catch(() => null) as { code?: number; msg?: string; data?: Hitem3DTaskResponse } | null;

      if (!response.ok || !data) {
        const message = data?.msg || `HTTP ${response.status}`;
        throw new ConversionError(
          `Hitem3D submit-task failed: ${message}`,
          'API_ERROR',
          response.status || 500
        );
      }

      if (data.code !== 200 || !data.data?.task_id) {
        throw new ConversionError(
          `Hitem3D submit-task error: ${data.msg || 'Unexpected response'}`,
          'API_ERROR',
          response.status || 500
        );
      }

      return data.data.task_id;

    } catch (error) {
      if (error instanceof ConversionError) {
        throw error;
      }
      throw new ProcessingError(
        `Failed to create Hitem3D task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Wait for generation to complete
   */
  private static async waitForCompletion(
    taskId: string,
    token: string,
    pollIntervalOverride?: number,
    timeoutOverride?: number
  ): Promise<Hitem3DTaskResult> {
    const startTime = Date.now();
    const pollInterval = pollIntervalOverride ?? 5000; // default 5 seconds
    const timeoutMs = timeoutOverride ?? this.TIMEOUT_MS;

    while (Date.now() - startTime < timeoutMs) {
      const url = new URL(`${this.API_BASE_URL}/query-task`);
      url.searchParams.set('task_id', taskId);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json().catch(() => null) as { code?: number; msg?: string; data?: Hitem3DTaskResult } | null;

      if (!response.ok || !data) {
        const message = data?.msg || `HTTP ${response.status}`;
        throw new ConversionError(
          `Failed to check Hitem3D task status: ${message}`,
          'API_ERROR',
          response.status || 500
        );
      }

      if (data.code !== 200 || !data.data) {
        throw new ConversionError(
          `Unexpected response while checking Hitem3D task: ${data.msg || 'Unknown response'}`,
          'API_ERROR',
          response.status || 500
        );
      }

      const task = data.data;
      const state = (task.state || '').toLowerCase();

      if (state === 'success' || state === 'completed') {
        return task;
      }

      if (state === 'failed' || state === 'fail' || state === 'error') {
        throw new ConversionError(
          `Hitem3D generation failed: ${data.msg || 'Service reported failure'}`,
          'PROCESSING_ERROR',
          502
        );
      }

      console.log(`⏳ Task ${taskId} status: ${task.state}... (${task.progress ?? 0}%)`);
      await this.sleep(pollInterval);
    }

    throw new ConversionError(
      'Hitem3D generation timeout - task took too long to complete',
      'TIMEOUT',
      504
    );
  }

  /**
   * Download the generated model file
   */
  private static async downloadModel(modelUrl: string): Promise<Buffer> {
    const response = await fetch(modelUrl);

    if (!response.ok) {
      throw new ConversionError(
        `Failed to download Hitem3D model: HTTP ${response.status}`,
        'API_ERROR',
        response.status
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Health check for Hitem3D service
   */
  static async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    if (!this.ACCESS_KEY || !this.SECRET_KEY) {
      return {
        healthy: false,
        message: 'Hitem3D credentials not configured'
      };
    }

    try {
      await this.getAccessToken();
      return {
        healthy: true,
        message: 'Hitem3D service available'
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Hitem3D health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check if service is available
   */
  static isAvailable(): boolean {
    return !!(this.ACCESS_KEY && this.SECRET_KEY);
  }

  /**
   * Sleep utility
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static async getAccessToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    if (this.tokenPromise) {
      return this.tokenPromise;
    }

    this.tokenPromise = this.fetchAccessToken();

    try {
      const token = await this.tokenPromise;
      return token;
    } finally {
      this.tokenPromise = null;
    }
  }

  private static async fetchAccessToken(): Promise<string> {
    const credentials = Buffer.from(`${this.ACCESS_KEY}:${this.SECRET_KEY}`, 'utf-8').toString('base64');

    const response = await fetch(`${this.API_BASE_URL}/auth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json().catch(() => null) as { code?: number; message?: string; data?: { accessToken?: string; tokenType?: string } } | null;

    if (!response.ok || !data) {
      const message = data?.message || `HTTP ${response.status}`;
      throw new ConversionError(
        `Failed to obtain Hitem3D token: ${message}`,
        'AUTH_ERROR',
        response.status || 500
      );
    }

    if (data.code !== 200 || !data.data?.accessToken) {
      throw new ConversionError(
        `Hitem3D token response error: ${data.message || 'Unexpected response'}`,
        'AUTH_ERROR',
        response.status || 500
      );
    }

    const tokenType = data.data.tokenType || 'Bearer';
    const bearerToken = `${tokenType} ${data.data.accessToken}`.trim();

    this.tokenCache = {
      token: bearerToken,
      expiresAt: Date.now() + this.TOKEN_TTL_MS
    };

    return bearerToken;
  }

  private static clearTokenCache() {
    this.tokenCache = null;
  }

  private static mapOutputFormat(format: 'obj' | 'glb' | 'stl' | 'fbx'): string {
    switch (format) {
      case 'obj':
        return '1';
      case 'glb':
        return '2';
      case 'stl':
        return '3';
      case 'fbx':
        return '4';
      default:
        return '2';
    }
  }

  private static inferFormatFromUrl(url: string): ModelResult['format'] {
    const cleaned = url.split('?')[0];
    const extension = cleaned.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'ply':
        return 'ply';
      case 'obj':
        return 'obj';
      case 'stl':
        return 'stl';
      case 'glb':
      default:
        return 'glb';
    }
  }

  private static shouldRetryWithFreshToken(error: unknown): boolean {
    if (!(error instanceof ConversionError)) {
      return false;
    }

    const normalized = error.message.toLowerCase();
    return normalized.includes('login expired')
      || normalized.includes('token expired')
      || normalized.includes('token invalid')
      || normalized.includes('unauthorized');
  }

  private static async executeConversionWithRetry(
    imageBuffer: Buffer,
    options: Hitem3DOptions,
    allowRetry: boolean = true
  ): Promise<{ modelBuffer: Buffer; format: ModelResult['format'] }> {
    const token = await this.getAccessToken();

    try {
      return await this.executeConversion(imageBuffer, options, token);
    } catch (error) {
      if (allowRetry && this.shouldRetryWithFreshToken(error)) {
        console.warn('Hitem3D token may be expired. Refreshing token and retrying...');
        this.clearTokenCache();
        return await this.executeConversionWithRetry(imageBuffer, options, false);
      }
      throw error;
    }
  }

  private static async executeConversion(
    imageBuffer: Buffer,
    options: Hitem3DOptions,
    token: string
  ): Promise<{ modelBuffer: Buffer; format: ModelResult['format'] }> {
    // Step 1: Create a generation task
    const taskId = await this.createGenerationTask(imageBuffer, options, token);
    console.log(`✅ Task created: ${taskId}`);

    // Step 2: Poll for completion
    const taskResult = await this.waitForCompletion(
      taskId,
      token,
      options.pollIntervalMs,
      options.timeoutMs
    );
    console.log('✅ Generation completed');

    if (!taskResult.url) {
      throw new ProcessingError('Hitem3D returned a successful status but no model URL was provided');
    }

    // Step 3: Download the model
    const modelBuffer = await this.downloadModel(taskResult.url);
    const format = this.inferFormatFromUrl(taskResult.url);

    return { modelBuffer, format };
  }
}
