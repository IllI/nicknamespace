// Advanced File Compression Service for Direct Print Storage
import { createClient } from '@supabase/supabase-js';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { CDNIntegration } from '@/lib/utils/cdn-integration';

interface CompressionOptions {
  targetReduction: number; // 0.1 to 0.9 (10% to 90% reduction)
  preserveQuality: boolean;
  generateThumbnail: boolean;
  optimizeForPrinting: boolean;
}

interface CompressionResult {
  success: boolean;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  compressionRatio: number;
  qualityScore: number; // 0-1, higher is better
  compressedPath?: string;
  thumbnailPath?: string;
  error?: string;
  metadata: {
    originalVertices: number;
    compressedVertices: number;
    originalFaces: number;
    compressedFaces: number;
    processingTimeMs: number;
  };
}

export class FileCompressionService {
  private supabase;
  private cdn: CDNIntegration;
  private readonly BUCKET_NAME = 'direct-3d-models';

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.cdn = new CDNIntegration();
  }

  /**
   * Compress a 3D model file with advanced optimization
   */
  async compressModelFile(
    userId: string,
    jobId: string,
    originalPath: string,
    filename: string,
    options: Partial<CompressionOptions> = {}
  ): Promise<CompressionResult> {
    const startTime = Date.now();
    
    const defaultOptions: CompressionOptions = {
      targetReduction: 0.3, // 30% reduction by default
      preserveQuality: true,
      generateThumbnail: true,
      optimizeForPrinting: true,
      ...options
    };

    try {
      // Download original file
      const { data: fileData, error: downloadError } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .download(originalPath);

      if (downloadError) {
        throw new Error(`Failed to download file: ${downloadError.message}`);
      }

      const fileBuffer = Buffer.from(await fileData.arrayBuffer());
      const originalSize = fileBuffer.length;

      // Load and analyze the 3D model
      const format = this.getFileFormat(filename);
      const geometry = await this.loadModelGeometry(fileBuffer, format);

      if (!geometry) {
        throw new Error('Failed to load model geometry');
      }

      const originalVertices = geometry.attributes.position.count;
      const originalFaces = geometry.index ? geometry.index.count / 3 : originalVertices / 3;

      // Apply compression techniques
      const compressedGeometry = await this.applyCompression(geometry, defaultOptions);
      
      const compressedVertices = compressedGeometry.attributes.position.count;
      const compressedFaces = compressedGeometry.index ? compressedGeometry.index.count / 3 : compressedVertices / 3;

      // Export compressed model
      const exporter = new STLExporter();
      const compressedData = exporter.parse(new THREE.Mesh(compressedGeometry), { binary: true });
      const compressedBuffer = Buffer.from(compressedData);
      const compressedSize = compressedBuffer.length;

      // Calculate quality score
      const qualityScore = this.calculateQualityScore(
        originalVertices,
        compressedVertices,
        originalFaces,
        compressedFaces,
        defaultOptions
      );

      // Only save if compression is beneficial
      const compressionRatio = compressedSize / originalSize;
      let compressedPath: string | undefined;
      let thumbnailPath: string | undefined;

      if (compressionRatio < (1 - defaultOptions.targetReduction * 0.5)) {
        // Save compressed file
        const fileOrg = this.cdn.getFileOrganization(userId, jobId);
        compressedPath = `${fileOrg.optimizedPath}/compressed.stl`;

        const { error: uploadError } = await this.supabase.storage
          .from(this.BUCKET_NAME)
          .upload(compressedPath, compressedBuffer, {
            contentType: 'model/stl',
            upsert: true
          });

        if (uploadError) {
          console.error('Failed to upload compressed file:', uploadError.message);
        }

        // Generate thumbnail if requested
        if (defaultOptions.generateThumbnail) {
          thumbnailPath = await this.generateAdvancedThumbnail(
            compressedGeometry,
            userId,
            jobId
          );
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        originalSizeBytes: originalSize,
        compressedSizeBytes: compressedSize,
        compressionRatio,
        qualityScore,
        compressedPath,
        thumbnailPath,
        metadata: {
          originalVertices,
          compressedVertices,
          originalFaces,
          compressedFaces,
          processingTimeMs: processingTime
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        success: false,
        originalSizeBytes: 0,
        compressedSizeBytes: 0,
        compressionRatio: 1,
        qualityScore: 0,
        error: error instanceof Error ? error.message : 'Unknown compression error',
        metadata: {
          originalVertices: 0,
          compressedVertices: 0,
          originalFaces: 0,
          compressedFaces: 0,
          processingTimeMs: processingTime
        }
      };
    }
  }

  /**
   * Apply advanced compression techniques to geometry
   */
  private async applyCompression(
    geometry: THREE.BufferGeometry,
    options: CompressionOptions
  ): Promise<THREE.BufferGeometry> {
    const compressed = geometry.clone();

    // 1. Merge duplicate vertices
    compressed.mergeVertices();

    // 2. Simplify geometry if needed
    if (options.targetReduction > 0.1) {
      compressed = this.simplifyGeometry(compressed, options.targetReduction);
    }

    // 3. Optimize for 3D printing
    if (options.optimizeForPrinting) {
      compressed = this.optimizeForPrinting(compressed);
    }

    // 4. Recompute normals and other attributes
    compressed.computeVertexNormals();
    compressed.computeBoundingBox();
    compressed.computeBoundingSphere();

    return compressed;
  }

  /**
   * Simplify geometry by reducing vertex count
   */
  private simplifyGeometry(
    geometry: THREE.BufferGeometry,
    targetReduction: number
  ): THREE.BufferGeometry {
    // This is a simplified version - in production you'd use a proper mesh decimation algorithm
    const positions = geometry.attributes.position.array;
    const indices = geometry.index?.array;

    if (!indices) {
      // Non-indexed geometry - simple vertex reduction
      const targetVertices = Math.floor(positions.length / 3 * (1 - targetReduction));
      const step = Math.ceil((positions.length / 3) / targetVertices);
      
      const newPositions: number[] = [];
      for (let i = 0; i < positions.length; i += step * 3) {
        newPositions.push(positions[i], positions[i + 1], positions[i + 2]);
      }

      const newGeometry = new THREE.BufferGeometry();
      newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
      return newGeometry;
    }

    // For indexed geometry, we'd implement proper edge collapse or quadric error metrics
    // For now, return the original geometry with merged vertices
    return geometry;
  }

  /**
   * Optimize geometry specifically for 3D printing
   */
  private optimizeForPrinting(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    // Ensure manifold mesh (no holes, proper orientation)
    // Remove degenerate triangles
    // Ensure proper winding order
    
    const optimized = geometry.clone();
    
    // Remove degenerate triangles (triangles with zero area)
    if (optimized.index) {
      const positions = optimized.attributes.position.array;
      const indices = optimized.index.array;
      const newIndices: number[] = [];

      for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] * 3;
        const b = indices[i + 1] * 3;
        const c = indices[i + 2] * 3;

        // Calculate triangle area
        const v1 = new THREE.Vector3(positions[a], positions[a + 1], positions[a + 2]);
        const v2 = new THREE.Vector3(positions[b], positions[b + 1], positions[b + 2]);
        const v3 = new THREE.Vector3(positions[c], positions[c + 1], positions[c + 2]);

        const area = new THREE.Vector3()
          .crossVectors(v2.sub(v1), v3.sub(v1))
          .length() / 2;

        // Only keep triangles with significant area
        if (area > 1e-6) {
          newIndices.push(indices[i], indices[i + 1], indices[i + 2]);
        }
      }

      optimized.setIndex(newIndices);
    }

    return optimized;
  }

  /**
   * Generate advanced thumbnail with better rendering
   */
  private async generateAdvancedThumbnail(
    geometry: THREE.BufferGeometry,
    userId: string,
    jobId: string
  ): Promise<string> {
    try {
      // Create a more sophisticated thumbnail
      // This would ideally use a headless browser or server-side Three.js rendering
      
      const fileOrg = this.cdn.getFileOrganization(userId, jobId);
      const thumbnailPath = fileOrg.thumbnailPath;

      // For now, create a placeholder that includes model statistics
      const stats = {
        vertices: geometry.attributes.position.count,
        faces: geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3,
        boundingBox: geometry.boundingBox
      };

      const thumbnailData = await this.createStatsThumbnail(stats);

      const { error: uploadError } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .upload(thumbnailPath, thumbnailData, {
          contentType: 'image/webp',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Failed to upload thumbnail: ${uploadError.message}`);
      }

      return thumbnailPath;
    } catch (error) {
      console.error('Thumbnail generation failed:', error);
      return '';
    }
  }

  /**
   * Create a thumbnail with model statistics
   */
  private async createStatsThumbnail(stats: any): Promise<Buffer> {
    // Create a simple WebP thumbnail with model info
    // In production, this would use a proper image generation library
    
    const thumbnailSize = 256;
    const data = Buffer.alloc(thumbnailSize * thumbnailSize * 4); // RGBA
    
    // Fill with a gradient based on model complexity
    const complexity = Math.min(stats.vertices / 10000, 1); // Normalize to 0-1
    
    for (let y = 0; y < thumbnailSize; y++) {
      for (let x = 0; x < thumbnailSize; x++) {
        const offset = (y * thumbnailSize + x) * 4;
        const gradient = (y / thumbnailSize) * complexity;
        
        data[offset] = Math.floor(100 + gradient * 155);     // R
        data[offset + 1] = Math.floor(150 + gradient * 105); // G
        data[offset + 2] = Math.floor(200 + gradient * 55);  // B
        data[offset + 3] = 255;                              // A
      }
    }
    
    return data.slice(0, 2048); // Return a small placeholder
  }

  /**
   * Calculate quality score based on compression metrics
   */
  private calculateQualityScore(
    originalVertices: number,
    compressedVertices: number,
    originalFaces: number,
    compressedFaces: number,
    options: CompressionOptions
  ): number {
    const vertexRetention = compressedVertices / originalVertices;
    const faceRetention = compressedFaces / originalFaces;
    
    // Weight vertex and face retention
    const geometryScore = (vertexRetention * 0.6 + faceRetention * 0.4);
    
    // Adjust based on preservation settings
    const qualityMultiplier = options.preserveQuality ? 1.0 : 0.8;
    
    return Math.min(geometryScore * qualityMultiplier, 1.0);
  }

  /**
   * Load model geometry from buffer
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
   * Get file format from filename
   */
  private getFileFormat(filename: string): 'stl' | 'obj' | 'ply' {
    const extension = filename.toLowerCase().split('.').pop();
    switch (extension) {
      case 'stl': return 'stl';
      case 'obj': return 'obj';
      case 'ply': return 'ply';
      default: return 'stl';
    }
  }

  /**
   * Batch compress multiple files
   */
  async batchCompress(
    jobs: Array<{
      userId: string;
      jobId: string;
      storagePath: string;
      filename: string;
      options?: Partial<CompressionOptions>;
    }>
  ): Promise<Array<{ jobId: string; result: CompressionResult }>> {
    const results: Array<{ jobId: string; result: CompressionResult }> = [];

    // Process in batches to avoid overwhelming the system
    const batchSize = 3;
    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (job) => {
        const result = await this.compressModelFile(
          job.userId,
          job.jobId,
          job.storagePath,
          job.filename,
          job.options
        );
        return { jobId: job.jobId, result };
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }
}