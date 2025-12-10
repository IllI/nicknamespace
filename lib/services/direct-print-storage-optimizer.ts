// Storage Optimization Service for Direct 3D Model Printing
import { createClient } from '@supabase/supabase-js';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

interface CompressionResult {
  originalSizeBytes: number;
  compressedSizeBytes: number;
  compressionRatio: number;
  format: 'stl' | 'obj' | 'ply';
  success: boolean;
  error?: string;
}

interface ThumbnailResult {
  thumbnailPath: string;
  thumbnailSizeBytes: number;
  success: boolean;
  error?: string;
}

interface OptimizationResult {
  compression?: CompressionResult;
  thumbnail?: ThumbnailResult;
  optimizedStoragePath?: string;
  totalSavingsBytes: number;
}

export class DirectPrintStorageOptimizer {
  private supabase;
  private readonly BUCKET_NAME = 'direct-3d-models';
  private readonly THUMBNAIL_SIZE = 256; // 256x256 pixels
  private readonly COMPRESSION_THRESHOLD = 1024 * 1024; // 1MB - only compress files larger than this

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Optimize a 3D model file by compressing and generating thumbnail
   */
  async optimizeModelFile(
    userId: string,
    jobId: string,
    originalPath: string,
    filename: string
  ): Promise<OptimizationResult> {
    const result: OptimizationResult = {
      totalSavingsBytes: 0
    };

    try {
      // Download the original file
      const { data: fileData, error: downloadError } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .download(originalPath);

      if (downloadError) {
        throw new Error(`Failed to download file for optimization: ${downloadError.message}`);
      }

      const fileBuffer = Buffer.from(await fileData.arrayBuffer());
      const originalSize = fileBuffer.length;

      // Only compress files larger than threshold
      if (originalSize > this.COMPRESSION_THRESHOLD) {
        try {
          result.compression = await this.compressModelFile(
            fileBuffer,
            filename,
            userId,
            jobId
          );
          
          if (result.compression.success) {
            result.totalSavingsBytes += (originalSize - result.compression.compressedSizeBytes);
          }
        } catch (error) {
          console.error('Compression failed:', error);
          result.compression = {
            originalSizeBytes: originalSize,
            compressedSizeBytes: originalSize,
            compressionRatio: 1,
            format: this.getFileFormat(filename),
            success: false,
            error: error instanceof Error ? error.message : 'Unknown compression error'
          };
        }
      }

      // Generate thumbnail
      try {
        result.thumbnail = await this.generateModelThumbnail(
          fileBuffer,
          filename,
          userId,
          jobId
        );
      } catch (error) {
        console.error('Thumbnail generation failed:', error);
        result.thumbnail = {
          thumbnailPath: '',
          thumbnailSizeBytes: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown thumbnail error'
        };
      }

      return result;
    } catch (error) {
      throw new Error(`File optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Compress a 3D model file (convert to optimized STL if not already)
   */
  private async compressModelFile(
    fileBuffer: Buffer,
    filename: string,
    userId: string,
    jobId: string
  ): Promise<CompressionResult> {
    const format = this.getFileFormat(filename);
    const originalSize = fileBuffer.length;

    try {
      // Load the 3D model
      const geometry = await this.loadModelGeometry(fileBuffer, format);
      
      if (!geometry) {
        throw new Error('Failed to load model geometry');
      }

      // Optimize geometry (merge vertices, remove duplicates)
      geometry.mergeVertices();
      geometry.computeVertexNormals();

      // Export as optimized STL (binary format is more compact)
      const exporter = new STLExporter();
      const stlData = exporter.parse(new THREE.Mesh(geometry), { binary: true });
      
      const compressedBuffer = Buffer.from(stlData);
      const compressedSize = compressedBuffer.length;

      // Only save if compression achieved significant savings (>10%)
      const compressionRatio = compressedSize / originalSize;
      if (compressionRatio < 0.9) {
        const optimizedPath = `${userId}/${jobId}/optimized.stl`;
        
        const { error: uploadError } = await this.supabase.storage
          .from(this.BUCKET_NAME)
          .upload(optimizedPath, compressedBuffer, {
            contentType: 'model/stl',
            upsert: true
          });

        if (uploadError) {
          throw new Error(`Failed to upload compressed file: ${uploadError.message}`);
        }
      }

      return {
        originalSizeBytes: originalSize,
        compressedSizeBytes: compressedSize,
        compressionRatio,
        format,
        success: true
      };
    } catch (error) {
      return {
        originalSizeBytes: originalSize,
        compressedSizeBytes: originalSize,
        compressionRatio: 1,
        format,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown compression error'
      };
    }
  }

  /**
   * Generate a thumbnail image for a 3D model
   */
  private async generateModelThumbnail(
    fileBuffer: Buffer,
    filename: string,
    userId: string,
    jobId: string
  ): Promise<ThumbnailResult> {
    try {
      const format = this.getFileFormat(filename);
      const geometry = await this.loadModelGeometry(fileBuffer, format);
      
      if (!geometry) {
        throw new Error('Failed to load model geometry for thumbnail');
      }

      // Create a scene for rendering
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf0f0f0);

      // Create mesh with basic material
      const material = new THREE.MeshPhongMaterial({ 
        color: 0x606060,
        shininess: 100
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      // Center and scale the model
      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      
      mesh.position.sub(center);
      mesh.scale.setScalar(2 / maxDim);

      // Set up camera
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
      camera.position.set(2, 2, 2);
      camera.lookAt(0, 0, 0);

      // Add lighting
      const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
      scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 1, 1);
      scene.add(directionalLight);

      // Render to canvas (this would need to be adapted for server-side rendering)
      // For now, we'll create a placeholder thumbnail
      const thumbnailData = await this.createPlaceholderThumbnail(filename);
      
      const thumbnailPath = `${userId}/${jobId}/thumbnail.png`;
      
      const { error: uploadError } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .upload(thumbnailPath, thumbnailData, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Failed to upload thumbnail: ${uploadError.message}`);
      }

      return {
        thumbnailPath,
        thumbnailSizeBytes: thumbnailData.length,
        success: true
      };
    } catch (error) {
      return {
        thumbnailPath: '',
        thumbnailSizeBytes: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown thumbnail error'
      };
    }
  }

  /**
   * Load 3D model geometry from buffer based on format
   */
  private async loadModelGeometry(
    fileBuffer: Buffer,
    format: 'stl' | 'obj' | 'ply'
  ): Promise<THREE.BufferGeometry | null> {
    try {
      const arrayBuffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength
      );

      switch (format) {
        case 'stl': {
          const loader = new STLLoader();
          return loader.parse(arrayBuffer);
        }
        case 'obj': {
          const loader = new OBJLoader();
          const text = new TextDecoder().decode(arrayBuffer);
          const object = loader.parse(text);
          
          // Extract geometry from the first mesh found
          let geometry: THREE.BufferGeometry | null = null;
          object.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry) {
              geometry = child.geometry;
            }
          });
          return geometry;
        }
        case 'ply': {
          const loader = new PLYLoader();
          return loader.parse(arrayBuffer);
        }
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      console.error(`Failed to load ${format} geometry:`, error);
      return null;
    }
  }

  /**
   * Create a placeholder thumbnail (since server-side rendering is complex)
   */
  private async createPlaceholderThumbnail(filename: string): Promise<Buffer> {
    // Create a simple PNG thumbnail placeholder
    // In a real implementation, you'd use a headless browser or server-side rendering
    const width = this.THUMBNAIL_SIZE;
    const height = this.THUMBNAIL_SIZE;
    
    // Simple PNG header for a gray square (placeholder)
    const pngData = Buffer.alloc(width * height * 4 + 100); // RGBA + PNG headers
    
    // Fill with a simple pattern based on filename
    const hash = this.simpleHash(filename);
    const r = (hash & 0xFF0000) >> 16;
    const g = (hash & 0x00FF00) >> 8;
    const b = hash & 0x0000FF;
    
    // Create a simple colored square
    for (let i = 0; i < width * height; i++) {
      const offset = i * 4;
      pngData[offset] = r;     // R
      pngData[offset + 1] = g; // G
      pngData[offset + 2] = b; // B
      pngData[offset + 3] = 255; // A
    }
    
    return pngData.slice(0, 1024); // Return a small placeholder
  }

  /**
   * Simple hash function for generating colors
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get file format from filename
   */
  private getFileFormat(filename: string): 'stl' | 'obj' | 'ply' {
    const extension = filename.toLowerCase().split('.').pop();
    switch (extension) {
      case 'stl':
        return 'stl';
      case 'obj':
        return 'obj';
      case 'ply':
        return 'ply';
      default:
        return 'stl'; // Default to STL
    }
  }

  /**
   * Batch optimize multiple files
   */
  async batchOptimizeFiles(
    jobs: Array<{ userId: string; jobId: string; storagePath: string; filename: string }>
  ): Promise<Array<{ jobId: string; result: OptimizationResult }>> {
    const results: Array<{ jobId: string; result: OptimizationResult }> = [];

    for (const job of jobs) {
      try {
        const result = await this.optimizeModelFile(
          job.userId,
          job.jobId,
          job.storagePath,
          job.filename
        );
        results.push({ jobId: job.jobId, result });
      } catch (error) {
        console.error(`Failed to optimize job ${job.jobId}:`, error);
        results.push({
          jobId: job.jobId,
          result: {
            totalSavingsBytes: 0,
            compression: {
              originalSizeBytes: 0,
              compressedSizeBytes: 0,
              compressionRatio: 1,
              format: this.getFileFormat(job.filename),
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        });
      }
    }

    return results;
  }

  /**
   * Get optimization statistics
   */
  async getOptimizationStats(): Promise<{
    totalFilesOptimized: number;
    totalSavingsBytes: number;
    averageCompressionRatio: number;
    thumbnailsGenerated: number;
  }> {
    try {
      // This would need to be tracked in the database
      // For now, return placeholder stats
      return {
        totalFilesOptimized: 0,
        totalSavingsBytes: 0,
        averageCompressionRatio: 1.0,
        thumbnailsGenerated: 0
      };
    } catch (error) {
      throw new Error(`Failed to get optimization stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up optimization artifacts (compressed files, thumbnails) for deleted jobs
   */
  async cleanupOptimizationArtifacts(userId: string, jobId: string): Promise<void> {
    try {
      const artifactPaths = [
        `${userId}/${jobId}/optimized.stl`,
        `${userId}/${jobId}/thumbnail.png`
      ];

      const { error } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .remove(artifactPaths);

      if (error) {
        console.error(`Failed to cleanup optimization artifacts for job ${jobId}:`, error.message);
      }
    } catch (error) {
      console.error(`Error cleaning up optimization artifacts:`, error);
    }
  }
}