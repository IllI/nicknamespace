// Stable Fast 3D via Hugging Face Gradio API using Python gradio_client
// Free service - no API token required!
// @ts-nocheck - Suppress Turbopack dynamic import warnings

import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { CONVERSION_CONFIG } from '../config/3d-conversion';
import { 
  ModelResult, 
  ConversionError, 
  ProcessingError 
} from '../types/3d-conversion';

export class SF3DGradioService {
  private static readonly GRADIO_SPACE = 'stabilityai/stable-fast-3d';
  private static readonly TIMEOUT_MS = CONVERSION_CONFIG.TIMEOUT_MS;

  /**
   * Convert a 2D image to 3D model using SF3D via Gradio Python client
   * This is FREE - no API token needed!
   */
  static async convertImageTo3D(
    imageBuffer: Buffer,
    options: {
      foregroundRatio?: number;
      remeshOption?: 'None' | 'Triangle' | 'Quad';
      vertexCount?: number;
      textureSize?: number;
    } = {}
  ): Promise<ModelResult> {
    const {
      foregroundRatio = 0.85,
      remeshOption = 'None',
      vertexCount = -1,
      textureSize = 1024
    } = options;

    console.log('🔄 Starting SF3D conversion via Gradio Python client (FREE)...');

    // Save image to temp file
    const tempImagePath = join(tmpdir(), `sf3d-input-${Date.now()}.png`);
    const tempOutputPath = join(tmpdir(), `sf3d-output-${Date.now()}.glb`);
    
    try {
      writeFileSync(tempImagePath, imageBuffer);
      console.log(`  Temp image saved: ${tempImagePath}`);

      // Create Python script to call Gradio
      // Using keyword arguments as recommended by gradio_client docs
      const pythonScript = `
# -*- coding: utf-8 -*-
import sys
import io
import os

# Fix Windows encoding issues  
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

from gradio_client import Client, handle_file

try:
    client = Client("${this.GRADIO_SPACE}")
    
    # Call with keyword arguments (recommended by gradio_client)
    result = client.predict(
        input_image=handle_file('${tempImagePath.replace(/\\/g, '\\\\')}'),
        foreground_ratio=${foregroundRatio},
        remesh_option="${remeshOption}",
        vertex_count=${vertexCount},
        texture_size=${textureSize},
        api_name="/run_button"
    )
    
    # Result is a tuple: (preview_image_path, model_path)
    # Both are FileData dicts with 'path' key
    preview_data = result[0]
    model_data = result[1]
    
    # Extract file path from FileData dict
    if isinstance(model_data, dict) and 'path' in model_data:
        model_path = model_data['path']
    elif isinstance(model_data, str):
        model_path = model_data
    else:
        raise ValueError(f"Unexpected model data format: {type(model_data)} - {model_data}")
    
    # Verify the file exists
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found: {model_path}")
    
    print(f"SUCCESS:{model_path}")
        
except Exception as e:
    print(f"ERROR:{str(e)}", file=sys.stderr)
    import traceback
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)
`;

      const scriptPath = join(tmpdir(), `sf3d-script-${Date.now()}.py`);
      writeFileSync(scriptPath, pythonScript);

      // Run Python script
      const modelPath = await this.runPythonScript(scriptPath);
      console.log(`  Model generated: ${modelPath}`);

      // Read the model file
      // @ts-ignore - Dynamic path from Python script execution
      const modelData = readFileSync(modelPath);

      // Cleanup temp files
      try {
        unlinkSync(tempImagePath);
        unlinkSync(scriptPath);
        unlinkSync(modelPath);
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp files:', cleanupError);
      }

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
      // Cleanup on error
      try {
        unlinkSync(tempImagePath);
      } catch {}
      
      console.error('❌ SF3D Gradio error:', error);
      if (error instanceof ConversionError) {
        throw error;
      }
      throw new ProcessingError(
        `SF3D Gradio failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Run Python script and wait for result
   */
  private static async runPythonScript(scriptPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const python = spawn('python', ['-u', scriptPath], {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });
      let stdout = '';
      let stderr = '';

      const timeout = setTimeout(() => {
        python.kill();
        reject(new ConversionError('Python script timeout', 'TIMEOUT', 408));
      }, this.TIMEOUT_MS);

      python.stdout.on('data', (data) => {
        stdout += data.toString('utf8');
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString('utf8');
      });

      python.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code !== 0) {
          const errorMsg = stderr || stdout || 'Unknown error';
          reject(new ConversionError(
            `Python script failed: ${errorMsg}`,
            'SCRIPT_ERROR',
            500
          ));
          return;
        }

        // Parse output for SUCCESS:path
        const match = stdout.match(/SUCCESS:(.+)/);
        if (match && match[1]) {
          resolve(match[1].trim());
        } else {
          reject(new ConversionError(
            'No model path in output',
            'NO_OUTPUT',
            500
          ));
        }
      });

      python.on('error', (error) => {
        clearTimeout(timeout);
        reject(new ConversionError(
          `Failed to spawn Python: ${error.message}. Make sure Python and gradio_client are installed.`,
          'PYTHON_ERROR',
          500
        ));
      });
    });
  }



  /**
   * Health check - verify Python and gradio_client are available
   */
  static async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    return new Promise((resolve) => {
      const python = spawn('python', ['-c', 'import gradio_client; print("OK")']);
      let output = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.on('close', (code) => {
        if (code === 0 && output.includes('OK')) {
          resolve({
            healthy: true,
            message: 'SF3D Gradio Python client available (FREE)'
          });
        } else {
          resolve({
            healthy: false,
            message: 'Python or gradio_client not installed. Run: pip install gradio_client'
          });
        }
      });

      python.on('error', () => {
        resolve({
          healthy: false,
          message: 'Python not found. Please install Python 3.8+'
        });
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        python.kill();
        resolve({
          healthy: false,
          message: 'Health check timeout'
        });
      }, 5000);
    });
  }

  /**
   * Check if service is available
   */
  static async isAvailable(): Promise<boolean> {
    const health = await this.healthCheck();
    return health.healthy;
  }
}
