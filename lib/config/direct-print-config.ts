/**
 * Configuration service for 3D Direct Print functionality
 * Centralizes all environment variable access and provides type safety
 */

export interface DirectPrintConfig {
  // Print Service Configuration
  printService: {
    url: string;
    apiKey: string;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  };

  // Direct Print Job Configuration
  directPrint: {
    maxFileSizeMB: number;
    storageBucket: string;
    buildVolume: {
      x: number;
      y: number;
      z: number;
    };
  };

  // Job Status Sync Configuration
  jobStatusSync: {
    intervalMs: number;
    cleanupDays: number;
    maxRetries: number;
  };

  // Storage Management Configuration
  storage: {
    cleanupFailedJobsDays: number;
    quotaFreeMB: number;
    quotaPremiumMB: number;
    cdnEnabled: boolean;
    cdnUrl?: string;
  };

  // Monitoring and Analytics Configuration
  monitoring: {
    enabled: boolean;
    analyticsRetentionDays: number;
    errorReportingEnabled: boolean;
    performanceMonitoringEnabled: boolean;
  };

  // Health Check Configuration
  healthCheck: {
    enabled: boolean;
    intervalMs: number;
    timeoutMs: number;
  };
}

/**
 * Get configuration from environment variables with defaults
 */
export function getDirectPrintConfig(): DirectPrintConfig {
  return {
    printService: {
      url: process.env.PRINT_SERVICE_URL || 'http://localhost:4141',
      apiKey: process.env.PRINT_SERVICE_API_KEY || '',
      timeout: parseInt(process.env.PRINT_SERVICE_TIMEOUT_MS || '30000'),
      retryAttempts: parseInt(process.env.PRINT_SERVICE_RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.PRINT_SERVICE_RETRY_DELAY_MS || '1000'),
    },

    directPrint: {
      maxFileSizeMB: parseInt(process.env.DIRECT_PRINT_MAX_FILE_SIZE_MB || '50'),
      storageBucket: process.env.DIRECT_PRINT_STORAGE_BUCKET || 'direct-3d-models',
      buildVolume: {
        x: parseInt(process.env.DIRECT_PRINT_BUILD_VOLUME_X || '256'),
        y: parseInt(process.env.DIRECT_PRINT_BUILD_VOLUME_Y || '256'),
        z: parseInt(process.env.DIRECT_PRINT_BUILD_VOLUME_Z || '256'),
      },
    },

    jobStatusSync: {
      intervalMs: parseInt(process.env.JOB_STATUS_SYNC_INTERVAL_MS || '30000'),
      cleanupDays: parseInt(process.env.JOB_STATUS_CLEANUP_DAYS || '30'),
      maxRetries: parseInt(process.env.JOB_STATUS_MAX_RETRIES || '5'),
    },

    storage: {
      cleanupFailedJobsDays: parseInt(process.env.STORAGE_CLEANUP_FAILED_JOBS_DAYS || '7'),
      quotaFreeMB: parseInt(process.env.STORAGE_QUOTA_FREE_MB || '1000'),
      quotaPremiumMB: parseInt(process.env.STORAGE_QUOTA_PREMIUM_MB || '10000'),
      cdnEnabled: process.env.STORAGE_CDN_ENABLED === 'true',
      cdnUrl: process.env.STORAGE_CDN_URL || undefined,
    },

    monitoring: {
      enabled: process.env.MONITORING_ENABLED !== 'false',
      analyticsRetentionDays: parseInt(process.env.ANALYTICS_RETENTION_DAYS || '90'),
      errorReportingEnabled: process.env.ERROR_REPORTING_ENABLED !== 'false',
      performanceMonitoringEnabled: process.env.PERFORMANCE_MONITORING_ENABLED !== 'false',
    },

    healthCheck: {
      enabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
      intervalMs: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '60000'),
      timeoutMs: parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS || '5000'),
    },
  };
}

/**
 * Validate configuration and throw errors for missing required values
 */
export function validateDirectPrintConfig(config: DirectPrintConfig): void {
  const errors: string[] = [];

  // Validate required print service configuration
  if (!config.printService.url) {
    errors.push('PRINT_SERVICE_URL is required');
  }

  if (!config.printService.apiKey && process.env.NODE_ENV === 'production') {
    errors.push('PRINT_SERVICE_API_KEY is required in production');
  }

  // Validate numeric values
  if (config.directPrint.maxFileSizeMB <= 0) {
    errors.push('DIRECT_PRINT_MAX_FILE_SIZE_MB must be greater than 0');
  }

  if (config.directPrint.buildVolume.x <= 0 ||
    config.directPrint.buildVolume.y <= 0 ||
    config.directPrint.buildVolume.z <= 0) {
    errors.push('Build volume dimensions must be greater than 0');
  }

  if (config.storage.quotaFreeMB <= 0 || config.storage.quotaPremiumMB <= 0) {
    errors.push('Storage quotas must be greater than 0');
  }

  if (errors.length > 0) {
    throw new Error(`Direct Print configuration errors:\n${errors.join('\n')}`);
  }
}

/**
 * Get validated configuration instance
 */
export function getValidatedDirectPrintConfig(): DirectPrintConfig {
  const config = getDirectPrintConfig();
  validateDirectPrintConfig(config);
  return config;
}

/**
 * Environment-specific configuration helpers
 */
export const isProduction = () => process.env.NODE_ENV === 'production';
export const isDevelopment = () => process.env.NODE_ENV === 'development';
export const isTest = () => process.env.NODE_ENV === 'test';

/**
 * Feature flags based on environment
 */
export function getFeatureFlags() {
  return {
    enableMonitoring: getDirectPrintConfig().monitoring.enabled,
    enableHealthChecks: getDirectPrintConfig().healthCheck.enabled,
    enableCDN: getDirectPrintConfig().storage.cdnEnabled,
    enableErrorReporting: getDirectPrintConfig().monitoring.errorReportingEnabled,
    enablePerformanceMonitoring: getDirectPrintConfig().monitoring.performanceMonitoringEnabled,
  };
}