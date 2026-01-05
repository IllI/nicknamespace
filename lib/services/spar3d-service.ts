/**
 * SPAR3D Service - Stable Point-Aware 3D Model Generation
 * 
 * This service provides integration with the locally-installed SPAR3D model
 * for converting 2D images to 3D models with point-aware conditioning.
 * 
 * Integrates with the existing 3D conversion architecture as a replacement
 * for TripoSR with superior quality and point-aware conditioning.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { 
  ModelResult, 
  ConversionError, 
  ProcessingError 
} from '../types/3d-conversion';
import { SupabaseStorageService } from '../utils/supabase-storage';

export interface SPAR3DOptions {
  device?: 'cpu' | 'cuda' | 'mps';
  textureResolution?: 512 | 1024 | 2048;
  foregroundRatio?: number;
  remeshOption?: 'none' | 'triangle' | 'quad';
  lowVramMode?: boolean;
  textPrompt?: string; // Optional text prompt for context
}

export interface SPAR3DResult {
  success: boolean;
  meshPath?: string;
  pointCloudPath?: string;
  inputPath?: string;
  error?: string;
  processingTime?: number;
}

export class SPAR3DService {
  private static readonly spar3dPath = path.join(process.cwd(), 'stable-point-aware-3d');
  private static readonly pythonPath = 'python'; // Assumes python is in PATH
  private static readonly tempDir = path.join(process.cwd(), 'temp', 'spar3d');

  /**
   * Check if SPAR3D is installed and configured
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const runScriptPath = path.join(this.spar3dPath, 'run.py');
      return existsSync(runScriptPath);
    } catch {
      return false;
    }
  }

  /**
   * Convert image buffer to 3D model (compatible with existing architecture)
   * This is the main method that integrates with ConversionOrchestrator
   */
  static async convertImageTo3D(imageBuffer: Buffer, options: SPAR3DOptions = {}): Promise<ModelResult> {
    const startTime = Date.now();

    try {
      // Check if SPAR3D is available
      if (!await this.isAvailable()) {
        throw new ConversionError(
          'SPAR3D is not installed or configured. Please run setup.',
          'SERVICE_UNAVAILABLE',
          503
        );
      }

      // Create temp directory for processing
      const conversionId = crypto.randomUUID();
      const tempInputDir = path.join(this.tempDir, conversionId, 'input');
      const tempOutputDir = path.join(this.tempDir, conversionId, 'output');
      
      await fs.mkdir(tempInputDir, { recursive: true });
      await fs.mkdir(tempOutputDir, { recursive: true });

      // Save image buffer to temp file
      const tempImagePath = path.join(tempInputDir, 'input.png');
      await fs.writeFile(tempImagePath, imageBuffer);

      // Run SPAR3D conversion
      const result = await this.runConversion(tempImagePath, tempOutputDir, options);

      if (!result.success || !result.meshPath) {
        throw new ProcessingError(
          result.error || 'SPAR3D conversion failed',
          new Error(result.error)
        );
      }

      // Read the generated GLB file
      const modelData = await fs.readFile(result.meshPath);
      
      // Extract metadata
      const metadata = await this.extractModelMetadata(result);

      // Clean up temp files
      await this.cleanupTempFiles(conversionId);

      const processingTime = Date.now() - startTime;

      return {
        model_data: modelData,
        format: 'ply', // SPAR3D outputs GLB but we'll mark as ply for compatibility
        has_texture: true,
        texture_data: undefined, // Textures are embedded in GLB
        metadata: {
          vertices: metadata.vertices,
          faces: metadata.faces,
          processing_time: processingTime
        }
      };

    } catch (error) {
      if (error instanceof ConversionError) {
        throw error;
      }
      throw new ProcessingError(
        `SPAR3D conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Run the SPAR3D Python script
   */
  private static async runConversion(
    imagePath: string,
    outputDir: string,
    options: SPAR3DOptions
  ): Promise<SPAR3DResult> {
    const startTime = Date.now();

    // Build command arguments
    const args = [
      path.join(this.spar3dPath, 'run.py'),
      imagePath,
      '--output-dir', outputDir,
      '--device', options.device || 'cpu',
    ];

    if (options.textureResolution) {
      args.push('--texture-resolution', options.textureResolution.toString());
    }

    if (options.foregroundRatio) {
      args.push('--foreground-ratio', options.foregroundRatio.toString());
    }

    if (options.remeshOption) {
      args.push('--remesh_option', options.remeshOption);
    }

    if (options.lowVramMode) {
      args.push('--low-vram-mode');
    }

    // Execute SPAR3D
    const result = await this.executePython(args);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        processingTime: Date.now() - startTime,
      };
    }

    // Find output files
    const outputIndex = '0'; // First image
    const meshPath = path.join(outputDir, outputIndex, 'mesh.glb');
    const pointCloudPath = path.join(outputDir, outputIndex, 'points.ply');
    const inputPath = path.join(outputDir, outputIndex, 'input.png');

    // Verify outputs exist
    if (!existsSync(meshPath)) {
      return {
        success: false,
        error: 'Output mesh file not generated',
        processingTime: Date.now() - startTime,
      };
    }

    return {
      success: true,
      meshPath,
      pointCloudPath: existsSync(pointCloudPath) ? pointCloudPath : undefined,
      inputPath: existsSync(inputPath) ? inputPath : undefined,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Execute Python script and capture output
   */
  private static executePython(args: string[]): Promise<{ success: boolean; error?: string; output?: string }> {
    return new Promise((resolve) => {
      const pythonProcess = spawn(this.pythonPath, args, {
        cwd: this.spar3dPath,
        env: {
          ...process.env,
          SPAR3D_USE_CPU: '1', // Force CPU mode by default
        },
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('[SPAR3D]', data.toString());
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error('[SPAR3D Error]', data.toString());
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({
            success: false,
            error: stderr || `Process exited with code ${code}`,
          });
        }
      });

      pythonProcess.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
        });
      });
    });
  }

  /**
   * Extract metadata from SPAR3D result
   */
  private static async extractModelMetadata(result: SPAR3DResult): Promise<{
    vertices: number;
    faces: number;
  }> {
    try {
      if (!result.meshPath) {
        return { vertices: 0, faces: 0 };
      }

      // Read GLB file header to extract basic info
      // For now, return estimates - could be enhanced with actual GLB parsing
      const stats = await fs.stat(result.meshPath);
      const fileSizeKB = stats.size / 1024;
      
      // Rough estimates based on file size
      const estimatedVertices = Math.floor(fileSizeKB * 100);
      const estimatedFaces = Math.floor(estimatedVertices * 1.5);

      return {
        vertices: estimatedVertices,
        faces: estimatedFaces
      };
    } catch (error) {
      console.warn('Failed to extract model metadata:', error);
      return { vertices: 0, faces: 0 };
    }
  }

  /**
   * Clean up temporary files
   */
  private static async cleanupTempFiles(conversionId: string): Promise<void> {
    try {
      const tempPath = path.join(this.tempDir, conversionId);
      if (existsSync(tempPath)) {
        await fs.rm(tempPath, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Failed to cleanup temp files:', error);
    }
  }

  /**
   * Upload generated model to Supabase storage
   */
  static async uploadToSupabaseStorage(
    modelBuffer: Buffer,
    userId: string,
    conversionId: string,
    fileName: string = 'model.glb'
  ): Promise<string> {
    try {
      const result = await SupabaseStorageService.uploadFile(
        'MODELS_RAW',
        userId,
        conversionId,
        fileName,
        modelBuffer,
        'model/gltf-binary'
      );

      return result.url;
    } catch (error) {
      throw new ProcessingError(
        `Failed to upload model to storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Health check for SPAR3D service
   */
  static async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      // Check if SPAR3D is installed
      if (!await this.isAvailable()) {
        return {
          healthy: false,
          message: 'SPAR3D is not installed. Run setup in stable-point-aware-3d folder.'
        };
      }

      // Check if Python is available
      const pythonCheck = await new Promise<boolean>((resolve) => {
        const proc = spawn(this.pythonPath, ['--version']);
        proc.on('close', (code) => resolve(code === 0));
        proc.on('error', () => resolve(false));
      });

      if (!pythonCheck) {
        return {
          healthy: false,
          message: 'Python is not available or not in PATH'
        };
      }

      // Check if required Python packages are installed
      const packageCheck = await new Promise<boolean>((resolve) => {
        const proc = spawn(this.pythonPath, ['-c', 'import torch; import trimesh; import transparent_background'], {
          cwd: this.spar3dPath
        });
        proc.on('close', (code) => resolve(code === 0));
        proc.on('error', () => resolve(false));
      });

      if (!packageCheck) {
        return {
          healthy: false,
          message: 'Required Python packages not installed. Run: pip install -r requirements.txt'
        };
      }

      return {
        healthy: true,
        message: 'SPAR3D service is available and configured'
      };

    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get estimated processing time based on options
   */
  static getEstimatedTime(options: SPAR3DOptions = {}): number {
    // Base time on CPU: 3 minutes
    let baseTime = 180000; // milliseconds

    // Adjust for texture resolution
    if (options.textureResolution === 2048) {
      baseTime *= 1.5;
    } else if (options.textureResolution === 512) {
      baseTime *= 0.7;
    }

    // Adjust for remeshing
    if (options.remeshOption && options.remeshOption !== 'none') {
      baseTime *= 1.3;
    }

    return baseTime;
  }
}

// Export singleton-style for compatibility
export const spar3dService = SPAR3DService;
