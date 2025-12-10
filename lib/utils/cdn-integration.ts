// CDN Integration utilities for Direct Print Storage
import { createClient } from '@supabase/supabase-js';

interface CDNConfig {
  enabled: boolean;
  baseUrl: string;
  cacheTTL: number;
  compressionEnabled: boolean;
}

interface CDNUrlOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'png' | 'jpg';
  resize?: 'fit' | 'fill' | 'crop';
}

export class CDNIntegration {
  private supabase;
  private config: CDNConfig;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.config = {
      enabled: process.env.CDN_ENABLED === 'true',
      baseUrl: process.env.CDN_BASE_URL || '',
      cacheTTL: parseInt(process.env.CDN_CACHE_TTL || '3600'),
      compressionEnabled: process.env.CDN_COMPRESSION === 'true'
    };
  }

  /**
   * Get optimized URL for a file with CDN transformations
   */
  getOptimizedUrl(
    bucket: string,
    filePath: string,
    options: CDNUrlOptions = {}
  ): string {
    if (!this.config.enabled || !this.config.baseUrl) {
      // Fallback to Supabase public URL
      return this.supabase.storage
        .from(bucket)
        .getPublicUrl(filePath).data.publicUrl;
    }

    // Build CDN URL with transformations
    const baseUrl = `${this.config.baseUrl}/${bucket}/${filePath}`;
    const params = new URLSearchParams();

    if (options.width) params.set('w', options.width.toString());
    if (options.height) params.set('h', options.height.toString());
    if (options.quality) params.set('q', options.quality.toString());
    if (options.format) params.set('f', options.format);
    if (options.resize) params.set('fit', options.resize);

    // Add cache control
    params.set('cache', this.config.cacheTTL.toString());

    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }

  /**
   * Get thumbnail URL with optimized settings
   */
  getThumbnailUrl(
    bucket: string,
    filePath: string,
    size: number = 256
  ): string {
    return this.getOptimizedUrl(bucket, filePath, {
      width: size,
      height: size,
      quality: 80,
      format: 'webp',
      resize: 'fit'
    });
  }

  /**
   * Get preview URL for 3D model files
   */
  getModelPreviewUrl(
    bucket: string,
    filePath: string,
    size: 'small' | 'medium' | 'large' = 'medium'
  ): string {
    const sizes = {
      small: 128,
      medium: 256,
      large: 512
    };

    return this.getThumbnailUrl(bucket, filePath, sizes[size]);
  }

  /**
   * Preload critical files into CDN cache
   */
  async preloadFiles(files: Array<{ bucket: string; path: string }>): Promise<void> {
    if (!this.config.enabled) return;

    try {
      // Make HEAD requests to warm up the CDN cache
      const preloadPromises = files.map(async (file) => {
        const url = this.getOptimizedUrl(file.bucket, file.path);
        try {
          await fetch(url, { method: 'HEAD' });
        } catch (error) {
          console.warn(`Failed to preload ${url}:`, error);
        }
      });

      await Promise.all(preloadPromises);
    } catch (error) {
      console.error('CDN preload failed:', error);
    }
  }

  /**
   * Purge files from CDN cache
   */
  async purgeCache(files: Array<{ bucket: string; path: string }>): Promise<void> {
    if (!this.config.enabled || !process.env.CDN_PURGE_API_KEY) return;

    try {
      const urls = files.map(file => this.getOptimizedUrl(file.bucket, file.path));
      
      // This would be specific to your CDN provider (CloudFlare, AWS CloudFront, etc.)
      // Example for CloudFlare:
      if (process.env.CDN_PROVIDER === 'cloudflare') {
        await this.purgeCloudflareCache(urls);
      }
    } catch (error) {
      console.error('CDN cache purge failed:', error);
    }
  }

  /**
   * CloudFlare cache purge implementation
   */
  private async purgeCloudflareCache(urls: string[]): Promise<void> {
    if (!process.env.CLOUDFLARE_ZONE_ID || !process.env.CLOUDFLARE_API_TOKEN) {
      return;
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/purge_cache`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ files: urls })
        }
      );

      if (!response.ok) {
        throw new Error(`CloudFlare purge failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('CloudFlare cache purge failed:', error);
    }
  }

  /**
   * Get file organization recommendations
   */
  getFileOrganization(userId: string, jobId: string): {
    originalPath: string;
    optimizedPath: string;
    thumbnailPath: string;
    previewPath: string;
  } {
    const basePath = `${userId}/${jobId}`;
    
    return {
      originalPath: `${basePath}/original`,
      optimizedPath: `${basePath}/optimized`,
      thumbnailPath: `${basePath}/thumbnail.webp`,
      previewPath: `${basePath}/preview.webp`
    };
  }

  /**
   * Generate responsive image URLs for different screen sizes
   */
  getResponsiveUrls(
    bucket: string,
    filePath: string
  ): {
    small: string;
    medium: string;
    large: string;
    original: string;
  } {
    return {
      small: this.getOptimizedUrl(bucket, filePath, { width: 320, quality: 75 }),
      medium: this.getOptimizedUrl(bucket, filePath, { width: 768, quality: 80 }),
      large: this.getOptimizedUrl(bucket, filePath, { width: 1200, quality: 85 }),
      original: this.getOptimizedUrl(bucket, filePath)
    };
  }

  /**
   * Check if CDN is properly configured
   */
  isConfigured(): boolean {
    return this.config.enabled && !!this.config.baseUrl;
  }

  /**
   * Get CDN configuration status
   */
  getStatus(): {
    enabled: boolean;
    configured: boolean;
    baseUrl: string;
    cacheTTL: number;
    compressionEnabled: boolean;
  } {
    return {
      enabled: this.config.enabled,
      configured: this.isConfigured(),
      baseUrl: this.config.baseUrl,
      cacheTTL: this.config.cacheTTL,
      compressionEnabled: this.config.compressionEnabled
    };
  }
}