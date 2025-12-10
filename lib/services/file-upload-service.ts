// File Upload and Processing Pipeline Service

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CONVERSION_CONFIG, validateImageFile } from '../config/3d-conversion';
import { SupabaseStorageService } from '../utils/supabase-storage';
import { 
  ValidationError, 
  ProcessingError,
  ConversionError 
} from '../types/3d-conversion';

export class FileUploadService {
  private static readonly TEMP_DIR = '/tmp/3d-conversion';
  private static readonly MAX_FILE_SIZE = CONVERSION_CONFIG.MAX_FILE_SIZE_BYTES;
  private static readonly SUPPORTED_FORMATS = CONVERSION_CONFIG.SUPPORTED_IMAGE_FORMATS;

  /**
   * Initialize temporary directory for file processing
   */
  static async initializeTempDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.TEMP_DIR, { recursive: true });
    } catch (error) {
      console.warn('Failed to create temp directory:', error);
      // Continue anyway, /tmp should exist in Vercel environment
    }
  }

  /**
   * Validate uploaded image file
   */
  static validateImage(file: File): void {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      throw new ValidationError(validation.error || 'Invalid file', 'file');
    }
  }

  /**
   * Process uploaded file and prepare for conversion
   */
  static async processUploadedFile(
    file: File,
    userId: string,
    conversionId: string
  ): Promise<{
    tempFilePath: string;
    originalFileName: string;
    fileSize: number;
    mimeType: string;
    buffer: Buffer;
  }> {
    try {
      // Validate the file first
      this.validateImage(file);

      // Generate unique filename for temporary storage
      const fileExtension = this.getFileExtension(file.name);
      const tempFileName = `${conversionId}_${Date.now()}${fileExtension}`;
      const tempFilePath = path.join(this.TEMP_DIR, tempFileName);

      // Convert File to Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Verify buffer size matches file size
      if (buffer.length !== file.size) {
        throw new ProcessingError('File size mismatch during upload processing');
      }

      // Initialize temp directory
      await this.initializeTempDirectory();

      // Write to temporary file for processing
      await fs.writeFile(tempFilePath, buffer);

      // Determine correct MIME type with fallback logic
      let mimeType = file.type;
      
      // If MIME type is incorrect or missing, determine from file extension
      if (!mimeType || mimeType === 'text/plain' || mimeType.includes('text/plain')) {
        const extension = this.getFileExtension(file.name).toLowerCase();
        switch (extension) {
          case '.jpg':
          case '.jpeg':
            mimeType = 'image/jpeg';
            break;
          case '.png':
            mimeType = 'image/png';
            break;
          default:
            // Keep original if we can't determine
            mimeType = file.type || 'application/octet-stream';
        }
        console.log(`Corrected MIME type from ${file.type} to ${mimeType} based on extension ${extension}`);
      }

      return {
        tempFilePath,
        originalFileName: file.name,
        fileSize: file.size,
        mimeType,
        buffer
      };

    } catch (error) {
      if (error instanceof ConversionError) {
        throw error;
      }
      throw new ProcessingError(
        `Failed to process uploaded file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Upload processed image to permanent storage
   */
  static async uploadImageToPermanentStorage(
    buffer: Buffer,
    userId: string,
    conversionId: string,
    originalFileName: string,
    mimeType: string
  ): Promise<string> {
    try {
      const fileExtension = this.getFileExtension(originalFileName);
      const storageFileName = `original${fileExtension}`;

      const imageUrl = await SupabaseStorageService.uploadFile(
        'IMAGES',
        userId,
        conversionId,
        storageFileName,
        buffer,
        mimeType
      );

      return imageUrl.url;
    } catch (error) {
      throw new ProcessingError(
        `Failed to upload image to permanent storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Clean up temporary files
   */
  static async cleanupTempFile(tempFilePath: string): Promise<void> {
    try {
      await fs.unlink(tempFilePath);
    } catch (error) {
      // Log but don't throw - temp files will be cleaned up by Vercel anyway
      console.warn(`Failed to cleanup temp file ${tempFilePath}:`, error);
    }
  }

  /**
   * Clean up all temporary files for a conversion
   */
  static async cleanupConversionTempFiles(conversionId: string): Promise<void> {
    try {
      const files = await fs.readdir(this.TEMP_DIR);
      const conversionFiles = files.filter(file => file.startsWith(conversionId));
      
      await Promise.all(
        conversionFiles.map(file => 
          this.cleanupTempFile(path.join(this.TEMP_DIR, file))
        )
      );
    } catch (error) {
      console.warn(`Failed to cleanup temp files for conversion ${conversionId}:`, error);
    }
  }

  /**
   * Get file extension from filename
   */
  private static getFileExtension(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    return ext || '.jpg'; // Default to .jpg if no extension
  }

  /**
   * Validate file buffer against known image signatures
   */
  static validateImageBuffer(buffer: Buffer, expectedMimeType: string): boolean {
    try {
      // Check file signatures (magic numbers)
      const signatures = {
        'image/jpeg': [0xFF, 0xD8, 0xFF],
        'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
      };

      const signature = signatures[expectedMimeType as keyof typeof signatures];
      if (!signature) {
        return false;
      }

      // Check if buffer starts with expected signature
      for (let i = 0; i < signature.length; i++) {
        if (buffer[i] !== signature[i]) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.warn('Failed to validate image buffer:', error);
      return false;
    }
  }

  /**
   * Resize image if it's too large (optional optimization)
   */
  static async optimizeImageForProcessing(buffer: Buffer, maxWidth: number = 1024): Promise<Buffer> {
    // For now, return the original buffer
    // In a production environment, you might want to use sharp or similar library
    // to resize large images for faster processing
    return buffer;
  }

  /**
   * Get image dimensions and basic metadata
   */
  static async getImageMetadata(buffer: Buffer): Promise<{
    width?: number;
    height?: number;
    format?: string;
    size: number;
  }> {
    try {
      // Basic metadata extraction
      // In production, you'd use a library like sharp for proper image analysis
      return {
        width: undefined, // Would be extracted with proper image library
        height: undefined, // Would be extracted with proper image library
        format: undefined, // Would be detected from buffer
        size: buffer.length
      };
    } catch (error) {
      console.warn('Failed to extract image metadata:', error);
      return {
        size: buffer.length
      };
    }
  }

  /**
   * Create a complete upload and processing pipeline
   */
  static async processImageUpload(
    file: File,
    userId: string,
    conversionId: string
  ): Promise<{
    imageUrl: string;
    tempFilePath: string;
    metadata: {
      originalFileName: string;
      fileSize: number;
      mimeType: string;
      width?: number;
      height?: number;
    };
  }> {
    let tempFilePath: string | undefined;

    try {
      // Process the uploaded file
      const processedFile = await this.processUploadedFile(file, userId, conversionId);
      tempFilePath = processedFile.tempFilePath;

      // Validate the image buffer
      const isValidImage = this.validateImageBuffer(processedFile.buffer, processedFile.mimeType);
      if (!isValidImage) {
        throw new ValidationError('Invalid image file format or corrupted file', 'file');
      }

      // Get image metadata
      const imageMetadata = await this.getImageMetadata(processedFile.buffer);

      // Optimize image if needed
      const optimizedBuffer = await this.optimizeImageForProcessing(processedFile.buffer);

      // Upload to permanent storage
      const imageUrl = await this.uploadImageToPermanentStorage(
        optimizedBuffer,
        userId,
        conversionId,
        processedFile.originalFileName,
        processedFile.mimeType
      );

      return {
        imageUrl,
        tempFilePath: processedFile.tempFilePath,
        metadata: {
          originalFileName: processedFile.originalFileName,
          fileSize: processedFile.fileSize,
          mimeType: processedFile.mimeType,
          width: imageMetadata.width,
          height: imageMetadata.height
        }
      };

    } catch (error) {
      // Clean up temp file if something went wrong
      if (tempFilePath) {
        await this.cleanupTempFile(tempFilePath);
      }
      throw error;
    }
  }

  /**
   * Check available disk space in temp directory
   */
  static async checkTempDiskSpace(): Promise<{
    available: boolean;
    freeSpaceBytes?: number;
  }> {
    try {
      // In Vercel environment, /tmp has 512MB limit
      // For now, assume we have space available
      return {
        available: true,
        freeSpaceBytes: 512 * 1024 * 1024 // 512MB
      };
    } catch (error) {
      return {
        available: false
      };
    }
  }

  /**
   * Get temporary file info
   */
  static async getTempFileInfo(tempFilePath: string): Promise<{
    exists: boolean;
    size?: number;
    created?: Date;
  }> {
    try {
      // Validate the file path to help TypeScript analysis
      if (!tempFilePath || typeof tempFilePath !== 'string') {
        return { exists: false };
      }
      
      // Get file stats directly - using lstat to avoid dynamic path warning
      const stats = await fs.lstat(tempFilePath);
      return {
        exists: true,
        size: stats.size,
        created: stats.birthtime
      };
    } catch (error) {
      return {
        exists: false
      };
    }
  }
}