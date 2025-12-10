/**
 * Comprehensive error handling types for 3D printing service
 */

export interface ErrorDetails {
  code: string;
  message: string;
  details?: any;
  timestamp?: string;
  userMessage?: string;
  recoveryActions?: RecoveryAction[];
  troubleshootingSteps?: TroubleshootingStep[];
}

export interface RecoveryAction {
  label: string;
  action: 'retry' | 'navigate' | 'contact' | 'upgrade' | 'custom';
  target?: string;
  data?: any;
}

export interface TroubleshootingStep {
  step: number;
  title: string;
  description: string;
  action?: string;
  expected?: string;
}

export interface ErrorContext {
  userId?: string;
  jobId?: string;
  filename?: string;
  fileSize?: number;
  operation?: string;
  userAgent?: string;
  timestamp: string;
}

// Error categories for better organization
export enum ErrorCategory {
  FILE_UPLOAD = 'FILE_UPLOAD',
  FILE_VALIDATION = 'FILE_VALIDATION',
  PRINT_SERVICE = 'PRINT_SERVICE',
  STORAGE = 'STORAGE',
  DATABASE = 'DATABASE',
  AUTHENTICATION = 'AUTHENTICATION',
  QUOTA = 'QUOTA',
  NETWORK = 'NETWORK',
  SYSTEM = 'SYSTEM'
}

// Specific error codes with user-friendly messages and recovery actions
export const ERROR_DEFINITIONS: Record<string, ErrorDetails> = {
  // File Upload Errors
  MISSING_FILE: {
    code: 'MISSING_FILE',
    message: 'No file was selected for upload',
    userMessage: 'Please select a 3D model file to upload',
    recoveryActions: [
      { label: 'Select File', action: 'custom', data: { action: 'openFileDialog' } }
    ]
  },
  
  INVALID_FILE_FORMAT: {
    code: 'INVALID_FILE_FORMAT',
    message: 'Unsupported file format',
    userMessage: 'Please upload a valid 3D model file (STL, OBJ, or PLY format)',
    recoveryActions: [
      { label: 'Convert File', action: 'navigate', target: '/help/file-conversion' },
      { label: 'Try Another File', action: 'custom', data: { action: 'openFileDialog' } }
    ],
    troubleshootingSteps: [
      {
        step: 1,
        title: 'Check file extension',
        description: 'Ensure your file has a .stl, .obj, or .ply extension',
        expected: 'File should end with .stl, .obj, or .ply'
      },
      {
        step: 2,
        title: 'Verify file source',
        description: 'Make sure the file was exported from a 3D modeling software',
        expected: 'File should be a valid 3D model export'
      }
    ]
  },

  FILE_TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    message: 'File size exceeds maximum limit',
    userMessage: 'Your file is too large. Please reduce the file size or upgrade your plan',
    recoveryActions: [
      { label: 'Compress File', action: 'navigate', target: '/help/file-compression' },
      { label: 'Upgrade Plan', action: 'navigate', target: '/account/upgrade' },
      { label: 'Try Smaller File', action: 'custom', data: { action: 'openFileDialog' } }
    ],
    troubleshootingSteps: [
      {
        step: 1,
        title: 'Reduce polygon count',
        description: 'Use your 3D software to simplify the mesh and reduce file size',
        expected: 'File size should be under 50MB for free accounts'
      },
      {
        step: 2,
        title: 'Export with compression',
        description: 'Use binary STL format instead of ASCII for smaller file sizes',
        expected: 'Binary STL files are typically 50% smaller'
      }
    ]
  },

  EMPTY_FILE: {
    code: 'EMPTY_FILE',
    message: 'File is empty or corrupted',
    userMessage: 'The selected file appears to be empty or corrupted',
    recoveryActions: [
      { label: 'Try Another File', action: 'custom', data: { action: 'openFileDialog' } },
      { label: 'Re-export Model', action: 'navigate', target: '/help/export-guide' }
    ]
  },

  // Validation Errors
  VALIDATION_FAILED: {
    code: 'VALIDATION_FAILED',
    message: 'Model validation failed',
    userMessage: 'Your 3D model has issues that prevent it from being printed',
    recoveryActions: [
      { label: 'View Details', action: 'custom', data: { action: 'showValidationDetails' } },
      { label: 'Repair Guide', action: 'navigate', target: '/help/model-repair' },
      { label: 'Try Another File', action: 'custom', data: { action: 'openFileDialog' } }
    ]
  },

  MODEL_TOO_LARGE: {
    code: 'MODEL_TOO_LARGE',
    message: 'Model exceeds printer build volume',
    userMessage: 'Your model is too large for the printer. Maximum size is 256×256×256mm',
    recoveryActions: [
      { label: 'Scale Down', action: 'custom', data: { action: 'showScaleDialog' } },
      { label: 'Scaling Guide', action: 'navigate', target: '/help/scaling' }
    ],
    troubleshootingSteps: [
      {
        step: 1,
        title: 'Check model dimensions',
        description: 'Verify your model fits within 256×256×256mm',
        expected: 'All dimensions should be under 256mm'
      },
      {
        step: 2,
        title: 'Scale in 3D software',
        description: 'Reduce model size by 50-80% in your modeling software',
        expected: 'Model should fit within build volume after scaling'
      }
    ]
  },

  // Storage Errors
  STORAGE_QUOTA_EXCEEDED: {
    code: 'STORAGE_QUOTA_EXCEEDED',
    message: 'Storage quota exceeded',
    userMessage: 'You have reached your storage limit. Please free up space or upgrade your plan',
    recoveryActions: [
      { label: 'Delete Old Files', action: 'navigate', target: '/3d-printing/history' },
      { label: 'Upgrade Plan', action: 'navigate', target: '/account/upgrade' },
      { label: 'View Usage', action: 'navigate', target: '/account/storage' }
    ]
  },

  UPLOAD_FAILED: {
    code: 'UPLOAD_FAILED',
    message: 'File upload failed',
    userMessage: 'Failed to upload your file. Please check your connection and try again',
    recoveryActions: [
      { label: 'Retry Upload', action: 'retry' },
      { label: 'Check Connection', action: 'navigate', target: '/help/connection-issues' }
    ],
    troubleshootingSteps: [
      {
        step: 1,
        title: 'Check internet connection',
        description: 'Ensure you have a stable internet connection',
        expected: 'Connection should be stable with good upload speed'
      },
      {
        step: 2,
        title: 'Try smaller file',
        description: 'Test with a smaller file to isolate the issue',
        expected: 'Smaller files should upload successfully'
      }
    ]
  },

  STORAGE_ERROR: {
    code: 'STORAGE_ERROR',
    message: 'Storage service unavailable',
    userMessage: 'Our storage service is temporarily unavailable. Please try again in a few minutes',
    recoveryActions: [
      { label: 'Retry in 5 minutes', action: 'retry' },
      { label: 'Check Status', action: 'navigate', target: '/status' }
    ]
  },

  // Print Service Errors
  PRINT_SERVICE_UNAVAILABLE: {
    code: 'PRINT_SERVICE_UNAVAILABLE',
    message: 'Print service is unavailable',
    userMessage: 'The 3D printing service is temporarily unavailable. Please try again later',
    recoveryActions: [
      { label: 'Retry Later', action: 'retry' },
      { label: 'Check Status', action: 'navigate', target: '/status' },
      { label: 'Contact Support', action: 'contact' }
    ]
  },

  PRINT_SERVICE_ERROR: {
    code: 'PRINT_SERVICE_ERROR',
    message: 'Print service error',
    userMessage: 'There was an error submitting your print job. Please try again',
    recoveryActions: [
      { label: 'Retry Submission', action: 'retry' },
      { label: 'Contact Support', action: 'contact' }
    ]
  },

  PRINTER_QUEUE_FULL: {
    code: 'PRINTER_QUEUE_FULL',
    message: 'Printer queue is full',
    userMessage: 'All printers are currently busy. Your job will be queued automatically',
    recoveryActions: [
      { label: 'View Queue Status', action: 'navigate', target: '/3d-printing/queue' },
      { label: 'Get Notifications', action: 'custom', data: { action: 'enableNotifications' } }
    ]
  },

  // Database Errors
  DATABASE_ERROR: {
    code: 'DATABASE_ERROR',
    message: 'Database operation failed',
    userMessage: 'A system error occurred. Please try again or contact support if the problem persists',
    recoveryActions: [
      { label: 'Try Again', action: 'retry' },
      { label: 'Contact Support', action: 'contact' }
    ]
  },

  JOB_NOT_FOUND: {
    code: 'JOB_NOT_FOUND',
    message: 'Print job not found',
    userMessage: 'The requested print job could not be found',
    recoveryActions: [
      { label: 'View All Jobs', action: 'navigate', target: '/3d-printing/history' },
      { label: 'Start New Job', action: 'navigate', target: '/3d-printing' }
    ]
  },

  INVALID_JOB_STATUS: {
    code: 'INVALID_JOB_STATUS',
    message: 'Invalid job status for operation',
    userMessage: 'This operation cannot be performed on the current job status',
    recoveryActions: [
      { label: 'View Job Details', action: 'custom', data: { action: 'showJobDetails' } },
      { label: 'Start New Job', action: 'navigate', target: '/3d-printing' }
    ]
  },

  // Authentication Errors
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required',
    userMessage: 'Please sign in to access this feature',
    recoveryActions: [
      { label: 'Sign In', action: 'navigate', target: '/auth/signin' },
      { label: 'Create Account', action: 'navigate', target: '/auth/signup' }
    ]
  },

  ACCESS_DENIED: {
    code: 'ACCESS_DENIED',
    message: 'Access denied',
    userMessage: 'You do not have permission to access this resource',
    recoveryActions: [
      { label: 'Go Back', action: 'navigate', target: '/' },
      { label: 'Contact Support', action: 'contact' }
    ]
  },

  // Network Errors
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    message: 'Network connection error',
    userMessage: 'Unable to connect to our servers. Please check your internet connection',
    recoveryActions: [
      { label: 'Retry', action: 'retry' },
      { label: 'Check Connection', action: 'navigate', target: '/help/connection-issues' }
    ],
    troubleshootingSteps: [
      {
        step: 1,
        title: 'Check internet connection',
        description: 'Verify you are connected to the internet',
        expected: 'Should be able to browse other websites'
      },
      {
        step: 2,
        title: 'Disable VPN/Proxy',
        description: 'Try disabling VPN or proxy if you are using one',
        expected: 'Connection should improve without VPN/proxy'
      },
      {
        step: 3,
        title: 'Try different network',
        description: 'Switch to a different network (mobile data, different WiFi)',
        expected: 'Different network should work if local network has issues'
      }
    ]
  },

  TIMEOUT_ERROR: {
    code: 'TIMEOUT_ERROR',
    message: 'Request timeout',
    userMessage: 'The operation took too long to complete. Please try again',
    recoveryActions: [
      { label: 'Try Again', action: 'retry' },
      { label: 'Use Smaller File', action: 'custom', data: { action: 'openFileDialog' } }
    ]
  },

  // System Errors
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    userMessage: 'An unexpected error occurred. Our team has been notified',
    recoveryActions: [
      { label: 'Try Again', action: 'retry' },
      { label: 'Contact Support', action: 'contact' }
    ]
  },

  MAINTENANCE_MODE: {
    code: 'MAINTENANCE_MODE',
    message: 'System under maintenance',
    userMessage: 'The system is currently under maintenance. Please try again later',
    recoveryActions: [
      { label: 'Check Status', action: 'navigate', target: '/status' },
      { label: 'Get Updates', action: 'navigate', target: '/notifications' }
    ]
  }
};

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',        // User can continue with minor inconvenience
  MEDIUM = 'medium',  // User needs to take action but can recover
  HIGH = 'high',      // Blocks user progress, needs immediate attention
  CRITICAL = 'critical' // System-level error, may affect multiple users
}

// Map error codes to severity levels
export const ERROR_SEVERITY_MAP: Record<string, ErrorSeverity> = {
  MISSING_FILE: ErrorSeverity.LOW,
  INVALID_FILE_FORMAT: ErrorSeverity.MEDIUM,
  FILE_TOO_LARGE: ErrorSeverity.MEDIUM,
  EMPTY_FILE: ErrorSeverity.MEDIUM,
  VALIDATION_FAILED: ErrorSeverity.MEDIUM,
  MODEL_TOO_LARGE: ErrorSeverity.MEDIUM,
  STORAGE_QUOTA_EXCEEDED: ErrorSeverity.HIGH,
  UPLOAD_FAILED: ErrorSeverity.HIGH,
  STORAGE_ERROR: ErrorSeverity.HIGH,
  PRINT_SERVICE_UNAVAILABLE: ErrorSeverity.HIGH,
  PRINT_SERVICE_ERROR: ErrorSeverity.HIGH,
  PRINTER_QUEUE_FULL: ErrorSeverity.MEDIUM,
  DATABASE_ERROR: ErrorSeverity.CRITICAL,
  JOB_NOT_FOUND: ErrorSeverity.MEDIUM,
  INVALID_JOB_STATUS: ErrorSeverity.MEDIUM,
  UNAUTHORIZED: ErrorSeverity.HIGH,
  ACCESS_DENIED: ErrorSeverity.HIGH,
  NETWORK_ERROR: ErrorSeverity.HIGH,
  TIMEOUT_ERROR: ErrorSeverity.MEDIUM,
  INTERNAL_ERROR: ErrorSeverity.CRITICAL,
  MAINTENANCE_MODE: ErrorSeverity.HIGH
};