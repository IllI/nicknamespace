import { CONVERSION_CONFIG } from '../config/3d-conversion';
import {
  ModelResult,
  ConversionError,
  ProcessingError
} from '../types/3d-conversion';

const API_BASE_URL = 'https://api.meshy.ai/openapi/v1';

type MeshyTaskStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELED';

type MeshyTask = {
  id: string;
  status: MeshyTaskStatus;
  progress?: number;
  model_urls?: {
    glb?: string;
    obj?: string;
    fbx?: string;
    usdz?: string;
  };
  texture_urls?: Array<{
    base_color?: string;
    metallic?: string;
    normal?: string;
    roughness?: string;
  }>;
  task_error?: {
    message?: string;
  };
  created_at?: number;
  started_at?: number;
  finished_at?: number;
};

export class Meshy3DService {
  private static readonly API_KEY = CONVERSION_CONFIG.MESHY_API_KEY;
  private static readonly POLL_INTERVAL_MS = 5000;
  private static readonly TIMEOUT_MS = CONVERSION_CONFIG.TIMEOUT_MS;

  /**
   * Convert a 2D image to a 3D mesh using Meshy Image-to-3D API
   */
  static async convertImageTo3D(imageBuffer: Buffer): Promise<ModelResult> {
    if (!this.API_KEY) {
      throw new ConversionError('Meshy API key not configured', 'MISSING_API_KEY', 500);
    }

    try {
      const mimeType = this.detectMimeType(imageBuffer);
      const imageDataUri = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

      const taskId = await this.createImageTo3DTask(imageDataUri);
      const task = await this.waitForTaskCompletion(taskId);

      const objUrl = task.model_urls?.obj;
      if (!objUrl) {
        throw new ConversionError('Meshy task succeeded but OBJ download URL is missing', 'API_ERROR', 502);
      }

      const objBuffer = await this.downloadFile(objUrl);
      const { plyBuffer, vertexCount, faceCount } = this.convertObjToPly(objBuffer.toString('utf-8'));

      const processingTime = task.finished_at && task.started_at
        ? Math.max(task.finished_at - task.started_at, 0)
        : Date.now();

      return {
        model_data: plyBuffer,
        format: 'ply',
        has_texture: Array.isArray(task.texture_urls) && task.texture_urls.length > 0,
        texture_data: undefined,
        metadata: {
          vertices: vertexCount,
          faces: faceCount,
          processing_time: processingTime
        }
      };
    } catch (error) {
      if (error instanceof ConversionError) {
        throw error;
      }

      throw new ProcessingError(
        `Meshy conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  private static detectMimeType(buffer: Buffer): string {
    if (buffer.length > 8) {
      // PNG signature
      if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      ) {
        return 'image/png';
      }

      // JPEG signature
      if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg';
      }
    }

    return 'image/png';
  }

  private static async createImageTo3DTask(imageDataUri: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/image-to-3d`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image_url: imageDataUri,
        should_texture: true,
        should_remesh: true,
        enable_pbr: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new ConversionError(
        `Meshy task creation failed: ${response.status} ${response.statusText} - ${errorText}`,
        response.status === 401 ? 'UNAUTHORIZED' : 'API_ERROR',
        response.status
      );
    }

    const data = (await response.json()) as { result?: string };
    if (!data.result) {
      throw new ConversionError('Meshy API did not return a task id', 'API_ERROR', 502);
    }

    return data.result;
  }

  private static async waitForTaskCompletion(taskId: string): Promise<MeshyTask> {
    const start = Date.now();

    while (Date.now() - start < this.TIMEOUT_MS) {
      const task = await this.fetchTask(taskId);

      if (task.status === 'SUCCEEDED') {
        return task;
      }

      if (task.status === 'FAILED') {
        const errorMessage = task.task_error?.message || 'Meshy task failed without error details';
        throw new ConversionError(errorMessage, 'PROCESSING_ERROR', 500);
      }

      await new Promise((resolve) => setTimeout(resolve, this.POLL_INTERVAL_MS));
    }

    throw new ConversionError('Meshy task timed out while waiting for completion', 'TIMEOUT', 408);
  }

  private static async fetchTask(taskId: string): Promise<MeshyTask> {
    const response = await fetch(`${API_BASE_URL}/image-to-3d/${taskId}`, {
      headers: {
        Authorization: `Bearer ${this.API_KEY}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new ConversionError(
        `Failed to fetch Meshy task status: ${response.status} ${response.statusText} - ${errorText}`,
        'API_ERROR',
        response.status
      );
    }

    return (await response.json()) as MeshyTask;
  }

  private static async downloadFile(url: string): Promise<Buffer> {
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new ConversionError(
        `Failed to download Meshy model: ${response.status} ${response.statusText} - ${errorText}`,
        'DOWNLOAD_ERROR',
        response.status
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private static convertObjToPly(objText: string): {
    plyBuffer: Buffer;
    vertexCount: number;
    faceCount: number;
  } {
    const vertices: Array<[number, number, number]> = [];
    const faces: Array<[number, number, number]> = [];

    const lines = objText.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      if (trimmed.startsWith('v ')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 4) {
          const x = parseFloat(parts[1]);
          const y = parseFloat(parts[2]);
          const z = parseFloat(parts[3]);
          vertices.push([x, y, z]);
        }
      } else if (trimmed.startsWith('f ')) {
        const parts = trimmed.split(/\s+/).slice(1);
        if (parts.length < 3) {
          continue;
        }

        const indices = parts
          .map((token) => token.split('/')[0])
          .map((value) => parseInt(value, 10) - 1)
          .filter((value) => !Number.isNaN(value));

        for (let i = 1; i < indices.length - 1; i++) {
          const tri: [number, number, number] = [indices[0], indices[i], indices[i + 1]];
          faces.push(tri);
        }
      }
    }

    if (!vertices.length || !faces.length) {
      throw new ConversionError('Meshy OBJ model did not contain vertices or faces', 'PROCESSING_ERROR', 500);
    }

    const plyLines: string[] = [];
    plyLines.push('ply');
    plyLines.push('format ascii 1.0');
    plyLines.push(`element vertex ${vertices.length}`);
    plyLines.push('property float x');
    plyLines.push('property float y');
    plyLines.push('property float z');
    plyLines.push(`element face ${faces.length}`);
    plyLines.push('property list uchar int vertex_indices');
    plyLines.push('end_header');

    for (const [x, y, z] of vertices) {
      plyLines.push(`${x} ${y} ${z}`);
    }

    for (const [a, b, c] of faces) {
      plyLines.push(`3 ${a} ${b} ${c}`);
    }

    const plyBuffer = Buffer.from(plyLines.join('\n'), 'utf-8');

    return {
      plyBuffer,
      vertexCount: vertices.length,
      faceCount: faces.length
    };
  }
}
