// 3D Conversion Service Configuration

export const CONVERSION_CONFIG = {
  // Hugging Face API Configuration
  HUGGINGFACE_API_TOKEN: process.env.HUGGINGFACE_API_TOKEN || '',
  MESHY_API_KEY: process.env.MESHY_API_KEY || '',
  
  // File Upload Limits
  MAX_FILE_SIZE_MB: parseInt(process.env.CONVERSION_MAX_FILE_SIZE_MB || '10'),
  MAX_FILE_SIZE_BYTES: parseInt(process.env.CONVERSION_MAX_FILE_SIZE_MB || '10') * 1024 * 1024,
  SUPPORTED_IMAGE_FORMATS: ['image/jpeg', 'image/jpg', 'image/png'],
  SUPPORTED_IMAGE_EXTENSIONS: ['.jpg', '.jpeg', '.png'],
  
  // API Timeouts and Limits
  TIMEOUT_MINUTES: parseInt(process.env.CONVERSION_TIMEOUT_MINUTES || '5'),
  TIMEOUT_MS: parseInt(process.env.CONVERSION_TIMEOUT_MINUTES || '5') * 60 * 1000,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2000,
  
  // User Limits
  DAILY_LIMIT_FREE: parseInt(process.env.CONVERSION_DAILY_LIMIT_FREE || '5'),
  DAILY_LIMIT_PREMIUM: parseInt(process.env.CONVERSION_DAILY_LIMIT_PREMIUM || '50'),
  
  // Storage Configuration
  STORAGE_BUCKETS: {
    IMAGES: 'conversion-images',
    MODELS_RAW: '3d-models-raw',
    MODELS_PRINT_READY: '3d-models-print-ready'
  },
  
  // 3D Model Processing
  SUPPORTED_OUTPUT_FORMATS: ['ply', 'obj', 'stl'],
  PRINT_READY_FORMAT: 'stl',
  
  // Bambu Labs P1P Specifications
  BAMBU_P1P: {
    BUILD_VOLUME: {
      X: 256, // mm
      Y: 256, // mm
      Z: 256  // mm
    },
    NOZZLE_DIAMETER: 0.4, // mm
    MIN_WALL_THICKNESS: 0.8, // mm (2 * nozzle diameter)
    SUPPORTED_MATERIALS: ['PLA', 'PETG', 'ABS', 'TPU'],
    LAYER_HEIGHTS: {
      DRAFT: 0.28,
      STANDARD: 0.20,
      FINE: 0.12
    }
  },
  
  // Cost Tracking (in USD)
  API_COSTS: {
    STORAGE_PER_GB_MONTH: 0.021 // Supabase storage cost
  }
} as const;

// Type definitions for the configuration
export type ConversionStatus = 'uploading' | 'processing' | 'completed' | 'failed';
export type SubscriptionTier = 'free' | 'premium' | 'enterprise';
export type ModelFormat = 'ply' | 'obj' | 'stl';
export type PrinterType = 'bambu_p1p' | 'bambu_a1_mini' | 'generic_fdm';
export type MaterialType = 'PLA' | 'PETG' | 'ABS' | 'TPU';
export type QualityPreset = 'draft' | 'standard' | 'fine';

// Validation functions
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  if (!CONVERSION_CONFIG.SUPPORTED_IMAGE_FORMATS.includes(file.type as any)) {
    return {
      valid: false,
      error: `Unsupported file format. Please use: ${CONVERSION_CONFIG.SUPPORTED_IMAGE_EXTENSIONS.join(', ')}`
    };
  }
  
  if (file.size > CONVERSION_CONFIG.MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${CONVERSION_CONFIG.MAX_FILE_SIZE_MB}MB`
    };
  }
  
  return { valid: true };
};

export const getDailyLimit = (tier: SubscriptionTier): number => {
  switch (tier) {
    case 'free':
      return CONVERSION_CONFIG.DAILY_LIMIT_FREE;
    case 'premium':
      return CONVERSION_CONFIG.DAILY_LIMIT_PREMIUM;
    case 'enterprise':
      return 1000; // High limit for enterprise
    default:
      return CONVERSION_CONFIG.DAILY_LIMIT_FREE;
  }
};

export const getStoragePath = (userId: string, conversionId: string): string => {
  return `${userId}/${conversionId}`;
};