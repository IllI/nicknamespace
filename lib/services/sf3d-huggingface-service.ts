// Stable Fast 3D via Hugging Face Gradio Client
// FREE service using gradio_client Python library

import { CONVERSION_CONFIG } from '../config/3d-conversion';
import { 
  ModelResult, 
  ConversionError, 
  ProcessingError 
} from '../types/3d-conversion';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

export class SF3DHuggingFaceService {
  private static readonly SPACE_NAME = 'stabilityai/stable-fast-3d';
  private static readonly TIMEOUT_MS = CONVERSION_CONFIG.TIMEOUT_MS;
  private static readonly PYTHON_PATH = 'python';

  /**
   * Convert a 2D image to 3D model using SF3D via Gradio Client
   * This is FREE - no API token needed!
   */
  static async convertImageTo3D(
    imageBuffer: Buffer,
    options: {
      foregroundRatio?: number;
      remeshOption?: 'none' | 'triangle' | 'quad';
      vertexCount?: number;
      textureSize?: number;
    } = {}
  ): Promise<ModelResult> {
    const {
      foregroundRatio = 0.85,
      remeshOption = 'none',
      vertexCount = -1,
      textureSize = 1024
    } = options;

    console.log('🔄 Starting SF3D conversion via Hugging Face Gradio (FREE)...');

    try {
      // Create temp directory
      const tempDir = path.join(process.cwd(), 'temp', 'sf3d-hf');
      await fs.mkdir(tempDir, { recursive: true });

      // Save image to temp file
      const tempImagePath = path.join(tempDir, `input-${Date.now()}.png`);
      await fs.writeFile(tempImagePath, imageBuffer);

      // Run Python script to call Gradio
      const result = await this.runGradioClient(
        tempImagePath,
        foregroundRatio,
        remeshOption,
        vertexCount,
        textureSize
      );

      if (!result.success || !result.outputPath) {
        throw new ProcessingError(
          result.error || 'SF3D conversion failed',
          new Error(result.error)
        );
      }

      // Read the generated model file
      const modelData = await fs.readFile(result.outputPath);

      // Clean up temp files
      await fs.unlink(tempImagePath).catch(() => {});
      await fs.unlink(result.outputPath).catch(() => {});

      console.log('  ✅ SF3D conversion completed!');

      return {
        model_data: modelData,
        format: 'glb',
        has_texture: true,
        texture_data: undefined,
        metadata: {
          vertices: 0,
          faces: 0,
          processing_time: Date.now()
        }
      };

    } catch (error) {
      console.error('❌ SF3D HuggingFace error:', error);
      if (error instanceof ConversionError) {
        throw error;
      }
      throw new ProcessingError(
        `SF3D HuggingFace failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Run Gradio client via Python
   */
  private static async runGradioClient(
    imagePath: string,
    foregroundRatio: number,
    remeshOption: string,
    vertexCount: number,
    textureSize: number
  ): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    return new Promise((resolve) => {
      // Create Python script inline
      const pythonScript = `
import sys
from gradio_client import Client

try:
    client = Client("${this.SPACE_NAME}")
    result = client.predict(
        '${imagePath.replace(/\\/g, '\\\\')}',
        ${foregroundRatio},
        "${remeshOption}",
        ${vertexCount},
        ${textureSize},
        api_name="/run_button"
    )
    
    # Result is a tuple: (preview_image_path, model_path)
    if result and len(result) >= 2:
        model_path = result[1]
        print(f"SUCCESS:{model_path}")
    else:
        print("ERROR:No output from model")
        
except Exception as e:
    print(f"ERROR:{str(e)}")
`;

      const pythonProcess = spawn(this.PYTHON_PATH, ['-c', pythonScript], {
        timeout: this.TIMEOUT_MS
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (stdout.includes('SUCCESS:')) {
          const outputPath = stdout.split('SUCCESS:')[1].trim();
          resolve({ success: true, outputPath });
        } else if (stdout.includes('ERROR:')) {
          const error = stdout.split('ERROR:')[1].trim();
          resolve({ success: false, error });
        } else {
          resolve({ 
            success: false, 
            error: stderr || 'Unknown error' 
          });
        }
      });

      pythonProcess.on('error', (error) => {
        resolve({ 
          success: false, 
          error: error.message 
        });
      });
    });
  }

  /**
   * Check if gradio_client is installed
   */
  static async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(this.PYTHON_PATH, ['-c', 'import gradio_client']);
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
  }

  /**
   * Health check
   */
  static async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    const available = await this.isAvailable();
    
    if (!available) {
      return {
        healthy: false,
        message: 'gradio_client not installed. Run: pip install gradio_client'
      };
    }

    return {
      healthy: true,
      message: 'SF3D HuggingFace (Gradio) available (FREE)'
    };
  }
}
