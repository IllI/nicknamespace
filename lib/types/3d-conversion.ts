// TypeScript types for 3D Conversion Service

export interface ConversionRecord {
  id: string;
  user_id: string;
  original_image_url?: string;
  model_file_url?: string;
  text_description?: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  error_message?: string;
  file_sizes: {
    original_image_bytes: number;
    model_file_bytes?: number;
  };
  model_metadata?: ModelMetadata;
  print_metadata?: PrintMetadata;
}

export interface ModelMetadata {
  vertices: number;
  faces: number;
  dimensions: {
    x: number;
    y: number;
    z: number;
  };
  original_format: 'ply' | 'obj' | 'glb' | 'stl';
  print_ready_format: 'ply' | 'obj' | 'glb' | 'stl';
  is_manifold: boolean;
  has_errors: boolean;
  repair_applied: boolean;
}

export interface PrintMetadata {
  estimated_print_time_minutes: number;
  material_usage_grams: number;
  build_volume_fit: boolean;
  recommended_layer_height: number;
  recommended_infill: number;
  supports_required: boolean;
  orcaslicer_compatible: boolean;
  printer_compatibility: string[];
}

export interface UserUsage {
  user_id: string;
  daily_conversions: number;
  monthly_conversions: number;
  total_api_cost: number;
  last_conversion_date: string;
  subscription_tier: 'free' | 'premium' | 'enterprise';
  created_at: string;
  updated_at: string;
}

// API Request/Response Types
export interface UploadRequest {
  image: File;
  user_id: string;
}

export interface UploadResponse {
  conversion_id: string;
  status: 'uploaded';
  message: string;
}

export interface StatusResponse {
  conversion_id: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress_percentage: number;
  estimated_completion?: string;
  error_message?: string;
}

export interface PrintPreparationRequest {
  printer_type: 'bambu_p1p' | 'bambu_a1_mini' | 'generic_fdm';
  material_type: 'PLA' | 'PETG' | 'ABS' | 'TPU';
  quality_preset: 'draft' | 'standard' | 'fine';
}

export interface PrintPreparationResponse {
  print_ready_url: string;
  validation_results: ValidationResult;
  print_estimates: PrintEstimates;
  orcaslicer_profile_url?: string;
}

export interface ValidationResult {
  is_manifold: boolean;
  has_holes: boolean;
  wall_thickness_adequate: boolean;
  fits_build_volume: boolean;
  errors: string[];
  repair_suggestions: string[];
}

export interface PrintEstimates {
  print_time_minutes: number;
  material_usage_grams: number;
  estimated_cost_usd: number;
  layer_count: number;
  support_material_grams?: number;
}

// Hugging Face API Types
export interface TripoSRRequest {
  inputs: string; // Base64 encoded image
  parameters?: {
    do_remove_background?: boolean;
    foreground_ratio?: number;
  };
}

export interface TripoSRResponse {
  // The API returns binary PLY data
  model_data: ArrayBuffer;
  format: 'ply';
}

export interface ModelResult {
  model_data: Buffer;
  format: 'ply' | 'obj' | 'glb' | 'stl';
  has_texture: boolean;
  texture_data?: Buffer;
  metadata: {
    vertices: number;
    faces: number;
    processing_time: number;
  };
}

// Component Props Types
export interface ImageUploadProps {
  onUploadComplete: (uploadId: string) => void;
  onUploadError: (error: string) => void;
  maxFileSize?: number;
  acceptedFormats?: string[];
  disabled?: boolean;
}

export interface ConversionStatusProps {
  conversionId: string;
  onComplete: (result: ConversionRecord) => void;
  onError: (error: string) => void;
  pollInterval?: number;
}

export interface Model3DPreviewProps {
  modelUrl: string;
  format: 'ply' | 'obj' | 'stl' | 'glb';
  onAccept: () => void;
  onReject: () => void;
  showControls?: boolean;
  autoRotate?: boolean;
}

export interface PrintPreparationProps {
  conversionId: string;
  modelMetadata: ModelMetadata;
  onPrintReady: (result: PrintPreparationResponse) => void;
  defaultPrinterType?: 'bambu_p1p' | 'bambu_a1_mini' | 'generic_fdm';
}

// Error Types
export class ConversionError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'ConversionError';
  }
}

export class RateLimitError extends ConversionError {
  constructor(message: string, public retryAfter?: number) {
    super(message, 'RATE_LIMIT', 429);
  }
}

export class ValidationError extends ConversionError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class ProcessingError extends ConversionError {
  constructor(message: string, public originalError?: Error) {
    super(message, 'PROCESSING_ERROR', 500);
  }
}