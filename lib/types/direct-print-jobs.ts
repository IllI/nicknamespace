// Types for Direct 3D Model Printing Service

export type DirectPrintJobStatus = 
  | 'pending'
  | 'downloading' 
  | 'slicing'
  | 'uploading'
  | 'printing'
  | 'complete'
  | 'failed'
  | 'cleanup_pending';

export interface DirectPrintJob {
  id: string;
  user_id: string;
  filename: string;
  storage_path: string;
  file_size_bytes: number;
  status: DirectPrintJobStatus;
  created_at: string;
  submitted_at?: string;
  completed_at?: string;
  error_message?: string;
  print_service_response?: any;
  model_metadata: ModelMetadata;
  print_settings: PrintSettings;
  estimated_duration_minutes?: number;
  webhook_url?: string;
  webhook_attempts?: number;
  last_webhook_attempt?: string;
  printer_ip?: string;
  printer_serial?: string;
  printer_access_code?: string;
}

export interface ModelMetadata {
  format: '3mf' | 'stl' | 'obj' | 'ply' | 'gltf' | 'glb' | 'fbx' | 'dae' | 'x3d' | 'amf';
  vertices: number;
  faces: number;
  dimensions: {
    x: number;
    y: number;
    z: number;
  };
  fileSize: number;
  isValid: boolean;
  validationIssues: string[];
  fitsInBuildVolume: boolean;
  uploadedAt: string;
}

export interface PrintSettings {
  material: 'PLA' | 'PETG' | 'ABS' | 'TPU';
  quality: 'draft' | 'standard' | 'fine';
  infill: number; // percentage
  supports: boolean;
  layerHeight: number; // mm
  printSpeed: number; // mm/s
  bedTemperature: number; // celsius
  nozzleTemperature: number; // celsius
}

export interface ValidationResult {
  isValid: boolean;
  format: '3mf' | 'stl' | 'obj' | 'ply' | 'gltf' | 'glb' | 'fbx' | 'dae' | 'x3d' | 'amf' | 'unknown';
  fileSize: number;
  modelStats: {
    vertices: number;
    faces: number;
    dimensions: { x: number; y: number; z: number };
  };
  issues: string[];
  warnings: string[];
  fitsInBuildVolume: boolean;
  estimatedPrintTime: number; // minutes
}

export interface DimensionCheck {
  fitsInBuildVolume: boolean;
  dimensions: { x: number; y: number; z: number };
  buildVolume: { x: number; y: number; z: number };
  exceedsLimits: {
    x: boolean;
    y: boolean;
    z: boolean;
  };
}

export interface StorageUsage {
  total_files: number;
  total_size_bytes: number;
  active_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
}

export interface UploadQuotaCheck {
  can_upload: boolean;
  current_usage_bytes: number;
  quota_limit_bytes: number;
  reason: string;
}

export interface StatusUpdate {
  status: DirectPrintJobStatus;
  timestamp: string;
  message?: string;
}

export interface PrintJobRequest {
  job_id: string;
  storage_path: string;
  filename: string;
  print_settings?: {
    material?: string;
    quality?: string;
    supports?: boolean;
  };
}

export interface PrintJobResponse {
  success: boolean;
  job_id: string;
  message: string;
  print_service_response?: any;
}

export interface PrintServiceError {
  code: string;
  message: string;
  details?: any;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  message: string;
  timestamp: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

export interface UploadResponse {
  success: boolean;
  jobId: string;
  storagePath: string;
  modelMetadata: ModelMetadata;
  message: string;
}

export interface JobHistoryResponse {
  jobs: DirectPrintJob[];
  totalCount: number;
  hasMore: boolean;
}

// Database function parameter types
export interface UpdateJobStatusParams {
  jobId: string;
  status: DirectPrintJobStatus;
  errorMessage?: string;
  printServiceResponse?: any;
}

export interface CreateJobParams {
  userId: string;
  filename: string;
  storagePath: string;
  fileSizeBytes: number;
  modelMetadata: ModelMetadata;
  printSettings?: Partial<PrintSettings>;
  webhookUrl?: string;
}

// Webhook payload types
export interface WebhookPayload {
  event: 'job_status_update';
  job_id: string;
  status: DirectPrintJobStatus;
  timestamp: string;
  job: DirectPrintJob;
}

export interface WebhookHeaders {
  'Content-Type': 'application/json';
  'User-Agent': 'Direct-Print-Service/1.0.0';
  'X-Print-Service-Event': 'job-status-update';
  'X-Print-Service-Signature'?: string;
  [key: string]: string | undefined;
}

export interface WebhookAttempt {
  jobId: string;
  url: string;
  payload: WebhookPayload;
  attempt: number;
  success: boolean;
  error?: string;
  timestamp: string;
}

// Constants
export const BUILD_VOLUME_LIMITS = {
  x: 256, // mm
  y: 256, // mm
  z: 256  // mm
} as const;

export const FILE_SIZE_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB (increased for more complex formats)
  SUPPORTED_FORMATS: ['3mf', 'stl', 'obj', 'ply', 'gltf', 'glb', 'fbx', 'dae', 'x3d', 'amf'] as const
} as const;

export const STORAGE_QUOTAS = {
  free: 1073741824,      // 1GB
  premium: 5368709120,   // 5GB
  enterprise: 21474836480 // 20GB
} as const;

export const PRINT_MATERIALS = ['PLA', 'PETG', 'ABS', 'TPU'] as const;
export const PRINT_QUALITIES = ['draft', 'standard', 'fine'] as const;

export type PrintMaterial = typeof PRINT_MATERIALS[number];
export type PrintQuality = typeof PRINT_QUALITIES[number];

// Component Props Types
export interface ModelUploadProps {
  onUploadComplete: (jobId: string, modelInfo: ModelInfo) => void;
  onUploadError: (error: string) => void;
  maxFileSize?: number;
  acceptedFormats?: string[];
  disabled?: boolean;
  userId: string;
}

export interface ModelInfo {
  jobId: string;
  filename: string;
  storagePath: string;
  fileSize: number;
  modelMetadata: ModelMetadata;
}